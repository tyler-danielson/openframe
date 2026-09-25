/**
 * reMarkable Cloud Client
 * Wrapper around ddvk/rmapi CLI tool (https://github.com/ddvk/rmapi)
 * — maintained fork with sync15 protocol support
 *
 * Authentication flow:
 * 1. User gets a one-time code from my.remarkable.com/device/desktop/connect
 * 2. We pass the code to rmapi, which stores the tokens in that user's own
 *    rmapi config (`${DATA_DIR}/rmapi/<userId>.conf`, see ./rmapi.ts)
 * 3. All subsequent calls run rmapi against that user's config
 *
 * Every user has their own reMarkable connection: one user's connect,
 * disconnect or document access never touches another user's config.
 * Self-hosted installs (not HOSTED_MODE) that connected with the older shared
 * config (~/.config/rmapi/rmapi.conf) are moved over per user on first use.
 */

import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { remarkableConfig } from "@openframe/database/schema";
import * as fs from "fs";
import * as path from "path";
import {
  buildStatScript,
  configFileExists,
  ensureRmapiUserDirs,
  execRmapi,
  isHostedMode,
  legacyRmapiConfigPath,
  makeRmapiWorkDir,
  removeDir,
  removeFileIfExists,
  rmapiError,
  rmapiUserPaths,
  toRmapiPath,
  type RmapiUserPaths,
} from "./rmapi.js";

export { remarkablePathProblem, REMARKABLE_PATH_MAX_LENGTH } from "./rmapi.js";

export interface RemarkableDocument {
  id: string;
  version: number;
  name: string;
  type: "DocumentType" | "CollectionType"; // Document or folder
  parent: string; // Parent folder ID or path
  lastModified: string;
  pinned: boolean;
}

export interface RemarkableClient {
  /** Whether this user has an rmapi config (without migrating a legacy one) */
  isConnected(): boolean;
  /**
   * Whether this user has an rmapi config to run commands with. On self-hosted
   * installs this first adopts the shared pre-per-user config for a user whose
   * connection is recorded as active.
   */
  ensureConfigured(): Promise<boolean>;
  connect(oneTimeCode: string): Promise<void>;
  disconnect(): Promise<void>;
  testConnection(): Promise<boolean>;
  refreshTokenIfNeeded(): Promise<void>;
  getDocuments(folderPath?: string): Promise<RemarkableDocument[]>;
  downloadDocument(documentId: string): Promise<Buffer>;
  downloadDocumentWithAnnotations(docPath: string): Promise<Buffer>;
  uploadPdf(pdfBuffer: Buffer, name: string, folderPath: string): Promise<string>;
  createFolder(name: string, parentPath?: string): Promise<string>;
  getUserToken(): Promise<string | null>;
}

/**
 * Execute an rmapi command for a user and return its output
 */
async function runRmapi(
  paths: RmapiUserPaths,
  args: string[],
  timeoutMs = 30000,
  workDir?: string
): Promise<string> {
  try {
    const { stdout, stderr } = await execRmapi(paths, args, { timeoutMs, workDir });

    if (stderr && !stderr.includes("Refreshing tree") && !stderr.includes("WARNING")) {
      console.warn("[rmapi] stderr:", stderr);
    }

    return stdout.trim();
  } catch (err: unknown) {
    throw rmapiError(err, timeoutMs);
  }
}

/**
 * The file rmapi downloaded into a run's private directory: one of the
 * expected names, else the newest file with one of the extensions
 */
function findDownloadedFile(
  dir: string,
  expectedNames: string[],
  extensions: string[]
): string | null {
  for (const name of expectedNames) {
    const candidate = path.join(dir, name);
    if (path.dirname(candidate) === dir && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const matches = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext)))
    .map((entry) => {
      const file = path.join(dir, entry.name);
      return { file, mtime: fs.statSync(file).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);

  return matches[0]?.file ?? null;
}

/**
 * Parse rmapi ls output into document objects
 * Output format: "[d]    folder_name" or "[f]    file_name"
 */
function parseLsOutput(output: string, parentPath: string): RemarkableDocument[] {
  const lines = output.split("\n").filter(line => line.trim());
  const docs: RemarkableDocument[] = [];

  for (const line of lines) {
    const match = line.match(/^\[([df])\]\s+(.+)$/);
    if (match && match[2]) {
      const isFolder = match[1] === "d";
      const name = match[2].trim();

      docs.push({
        id: parentPath ? `${parentPath}/${name}` : `/${name}`,
        version: 1,
        name,
        type: isFolder ? "CollectionType" : "DocumentType",
        parent: parentPath || "/",
        lastModified: new Date().toISOString(),
        pinned: false,
      });
    }
  }

  return docs;
}

/**
 * Get the reMarkable client for a user. Everything it does runs against that
 * user's own rmapi config.
 */
export function getRemarkableClient(
  fastify: FastifyInstance,
  userId: string
): RemarkableClient {
  const paths = rmapiUserPaths(userId);

  /**
   * Get the current user's reMarkable config from DB
   */
  async function getConfig() {
    const [config] = await fastify.db
      .select()
      .from(remarkableConfig)
      .where(eq(remarkableConfig.userId, userId))
      .limit(1);
    return config;
  }

  /**
   * Save config to database
   */
  async function saveConfig(data: {
    deviceToken: string;
    userToken?: string | null;
    userTokenExpiresAt?: Date | null;
    isConnected?: boolean;
    lastSyncAt?: Date | null;
  }) {
    const existing = await getConfig();

    if (existing) {
      await fastify.db
        .update(remarkableConfig)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(remarkableConfig.userId, userId));
    } else {
      await fastify.db.insert(remarkableConfig).values({
        userId,
        deviceToken: data.deviceToken,
        userToken: data.userToken,
        userTokenExpiresAt: data.userTokenExpiresAt,
        isConnected: data.isConnected ?? true,
      });
    }
  }

  /**
   * Self-hosted installs used to share one rmapi config between all users.
   * Give a user whose connection is recorded as active their own copy of it.
   * Never in hosted mode, where that file could be anyone's: users reconnect.
   */
  async function adoptLegacyConfig(): Promise<boolean> {
    if (isHostedMode()) {
      return false;
    }

    const legacyPath = legacyRmapiConfigPath();
    if (!configFileExists(legacyPath)) {
      return false;
    }

    const config = await getConfig();
    if (!config?.isConnected) {
      return false;
    }

    try {
      ensureRmapiUserDirs(paths);
      fs.copyFileSync(legacyPath, paths.configPath, fs.constants.COPYFILE_EXCL);
      fs.chmodSync(paths.configPath, 0o600);
    } catch (err) {
      // EEXIST: a concurrent request adopted it first
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
        fastify.log.warn({ err, userId }, "Failed to copy the shared reMarkable config for this user");
        return false;
      }
    }

    fastify.log.info({ userId }, "Moved the shared reMarkable connection to this user's own rmapi config");
    return true;
  }

  async function ensureConfigured(): Promise<boolean> {
    if (configFileExists(paths.configPath)) {
      return true;
    }
    return adoptLegacyConfig();
  }

  async function requireConfigured(): Promise<void> {
    if (!(await ensureConfigured())) {
      throw new Error("reMarkable not connected");
    }
  }

  async function createFolder(folderPath: string, _parentPath?: string): Promise<string> {
    fastify.log.info({ folderPath }, "Creating reMarkable folder");
    toRmapiPath(folderPath);
    await requireConfigured();

    // Create each level of the path one at a time
    // e.g., "/Calendar/Daily Agenda" → mkdir "/Calendar", then mkdir "/Calendar/Daily Agenda"
    const segments = folderPath.replace(/^\//, "").split("/").filter(Boolean);
    let currentPath = "";

    for (const segment of segments) {
      currentPath += "/" + segment;
      try {
        await runRmapi(paths, ["mkdir", toRmapiPath(currentPath)], 30000);
        fastify.log.info({ path: currentPath }, "Created folder");
      } catch (err) {
        const errorMsg = (err as Error).message || "";
        if (errorMsg.includes("already exists") || errorMsg.includes("entry exists") || errorMsg.includes("directory already")) {
          // Folder exists — continue to next level
          continue;
        }
        fastify.log.error({ err, path: currentPath }, "Failed to create folder level");
        throw err;
      }
    }

    fastify.log.info({ folderPath }, "Successfully ensured folder path exists");
    return folderPath;
  }

  return {
    isConnected(): boolean {
      return configFileExists(paths.configPath);
    },

    ensureConfigured,

    async connect(oneTimeCode: string): Promise<void> {
      fastify.log.info("Connecting to reMarkable cloud via rmapi (ddvk fork)...");

      const code = oneTimeCode.trim();
      if (code.length !== 8) {
        throw new Error(`Invalid code: expected 8 characters, got ${code.length}`);
      }
      if (!/^[a-zA-Z0-9]{8}$/.test(code)) {
        throw new Error("Invalid code: expected letters and digits only");
      }

      // rmapi registers into a new file, which replaces this user's config
      // only once registration worked
      const pendingPaths: RmapiUserPaths = {
        ...paths,
        configPath: `${paths.configPath}.${randomUUID()}.pending`,
      };

      let stdout = "";
      let stderr = "";
      let failure: unknown = null;
      try {
        // rmapi asks for the code on stdin, authenticates, then exits at EOF
        const output = await execRmapi(pendingPaths, [], { input: `${code}\n`, timeoutMs: 30000 });
        stdout = output.stdout;
        stderr = output.stderr;
        fastify.log.info({ stdout: stdout.trim(), stderr: stderr.trim() }, "rmapi connect output");
      } catch (err) {
        failure = err;
      }

      try {
        // rmapi sometimes exits non-zero after it has registered, so the
        // config it wrote decides
        if (configFileExists(pendingPaths.configPath)) {
          fs.chmodSync(pendingPaths.configPath, 0o600);
          fs.renameSync(pendingPaths.configPath, paths.configPath);
          await saveConfig({
            deviceToken: "rmapi",
            isConnected: true,
          });
          fastify.log.info(
            failure
              ? "Connected to reMarkable (config created despite exit code)"
              : "Successfully connected to reMarkable cloud via rmapi"
          );
          return;
        }
      } finally {
        removeFileIfExists(pendingPaths.configPath);
      }

      const error = (failure ?? {}) as { stderr?: string; message?: string };
      const message = error.stderr || error.message || stderr || stdout || "rmapi config not created";
      fastify.log.error({ err: failure }, "Failed to connect to reMarkable");
      throw new Error(`Failed to connect: ${message}`);
    },

    async disconnect(): Promise<void> {
      // Remove this user's rmapi config and cache (never anyone else's)
      removeFileIfExists(paths.configPath);
      removeDir(paths.homeDir);

      // Remove from database
      const config = await getConfig();
      if (config) {
        await fastify.db
          .delete(remarkableConfig)
          .where(eq(remarkableConfig.userId, userId));
      }

      fastify.log.info("Disconnected from reMarkable cloud");
    },

    async testConnection(): Promise<boolean> {
      try {
        if (!(await ensureConfigured())) {
          return false;
        }

        // Try listing root directory
        await runRmapi(paths, ["ls", "/"], 15000);
        return true;
      } catch (error) {
        fastify.log.error({ err: error }, "reMarkable connection test failed");
        return false;
      }
    },

    async refreshTokenIfNeeded(): Promise<void> {
      // rmapi handles token refresh automatically
      // Nothing to do here
    },

    async getDocuments(folderPath?: string): Promise<RemarkableDocument[]> {
      const targetPath = folderPath || "/";

      fastify.log.info({ folderPath: targetPath }, "Listing reMarkable documents");

      try {
        const rmapiPath = toRmapiPath(targetPath);
        await requireConfigured();

        // Build a batch command: ls the folder, then stat each entry
        const lsOutput = await runRmapi(paths, ["ls", rmapiPath], 30000);
        const docs = parseLsOutput(lsOutput, targetPath === "/" ? "" : targetPath);

        // Batch stat all docs in a single rmapi session for timestamps
        const statScript = buildStatScript(docs.map(d => d.id));
        if (statScript) {
          try {
            const { stdout } = await execRmapi(paths, [], { input: statScript, timeoutMs: 60000 });

            // Parse stat JSON blocks from output
            const jsonBlocks = stdout.match(/\{[^}]+\}/g) || [];
            for (const block of jsonBlocks) {
              try {
                const stat = JSON.parse(block);
                if (stat.Name && stat.ModifiedClient) {
                  const doc = docs.find(d => d.name === stat.Name);
                  if (doc) {
                    doc.lastModified = stat.ModifiedClient;
                    doc.id = stat.ID || doc.id;
                    doc.pinned = stat.Pinned || false;
                  }
                }
              } catch {
                // Skip unparseable blocks
              }
            }
          } catch {
            // If batch stat fails, timestamps remain as "now" — still functional
            fastify.log.warn("Failed to batch-stat documents for timestamps");
          }
        }

        fastify.log.info({ count: docs.length }, "Found reMarkable documents");
        return docs;
      } catch (err) {
        fastify.log.error({ err, folderPath: targetPath }, "Failed to list documents");
        throw err;
      }
    },

    async downloadDocument(documentId: string): Promise<Buffer> {
      // documentId is the full path like "/folder/document"
      const docName = path.basename(documentId);

      fastify.log.info({ documentId }, "Downloading reMarkable document");

      const workDir = makeRmapiWorkDir();
      try {
        const rmapiPath = toRmapiPath(documentId);
        await requireConfigured();

        // rmapi get downloads into the directory it runs in
        await runRmapi(paths, ["get", rmapiPath], 60000, workDir);

        // Find the downloaded file (rmapi creates a .zip, newer versions a .rmdoc)
        const zipPath = findDownloadedFile(
          workDir,
          [`${docName}.zip`, `${docName}.rmdoc`],
          [".zip", ".rmdoc"]
        );

        if (!zipPath) {
          throw new Error(`Downloaded file not found: ${docName}.zip`);
        }

        return fs.readFileSync(zipPath);
      } catch (err) {
        fastify.log.error({ err, documentId }, "Failed to download document");
        throw err;
      } finally {
        // Clean up
        removeDir(workDir);
      }
    },

    async downloadDocumentWithAnnotations(docPath: string): Promise<Buffer> {
      // Use rmapi geta to download with annotations as PDF
      const docName = path.basename(docPath);

      fastify.log.info({ docPath }, "Downloading reMarkable document with annotations");

      const workDir = makeRmapiWorkDir();
      try {
        const rmapiPath = toRmapiPath(docPath);
        await requireConfigured();

        // rmapi geta downloads into the directory it runs in, as PDF
        await runRmapi(paths, ["geta", rmapiPath], 120000, workDir);

        // Find the downloaded PDF file (rmapi names it "<name>-annotations.pdf";
        // the run's directory is private, so any PDF in it is this document)
        const pdfPath = findDownloadedFile(
          workDir,
          [`${docName}-annotations.pdf`, `${docName}.pdf`],
          [".pdf"]
        );

        if (!pdfPath) {
          throw new Error("Downloaded PDF not found");
        }

        const buffer = fs.readFileSync(pdfPath);

        fastify.log.info({ size: buffer.length }, "Downloaded document with annotations");
        return buffer;
      } catch (err) {
        fastify.log.error({ err, docPath }, "Failed to download document with annotations");
        throw err;
      } finally {
        // Clean up
        removeDir(workDir);
      }
    },

    async uploadPdf(pdfBuffer: Buffer, name: string, folderPath: string): Promise<string> {
      let safeName = name.replace(/[^a-zA-Z0-9-_. ]/g, "_");
      if (!safeName.endsWith(".pdf")) safeName += ".pdf";

      fastify.log.info({ name: safeName, folderPath }, "Uploading PDF to reMarkable");

      const workDir = makeRmapiWorkDir();
      try {
        const rmapiFolder = toRmapiPath(folderPath || "/");
        await requireConfigured();

        // Write PDF to a temp file (its name becomes the document name)
        const tempFile = path.join(workDir, safeName);
        fs.writeFileSync(tempFile, pdfBuffer, { mode: 0o600 });

        // Ensure target folder exists
        if (folderPath && folderPath !== "/") {
          try {
            await createFolder(folderPath);
          } catch {
            // Folder might already exist, continue
          }
        }

        // Upload using rmapi put
        const destination = folderPath && folderPath !== "/"
          ? `${folderPath}/${safeName}`
          : `/${safeName}`;

        await runRmapi(paths, ["put", "--force", tempFile, rmapiFolder], 60000, workDir);

        // Update last sync time
        const config = await getConfig();
        if (config) {
          await saveConfig({
            deviceToken: config.deviceToken,
            lastSyncAt: new Date(),
          });
        }

        fastify.log.info({ destination }, "Successfully uploaded PDF to reMarkable");
        return destination;
      } catch (err) {
        fastify.log.error({ err, name, folderPath }, "Failed to upload PDF");
        throw err;
      } finally {
        // Clean up temp file
        removeDir(workDir);
      }
    },

    createFolder,

    async getUserToken(): Promise<string | null> {
      // rmapi manages tokens internally
      // Return a placeholder if configured
      if (await ensureConfigured()) {
        return "rmapi-managed";
      }
      return null;
    },
  };
}
