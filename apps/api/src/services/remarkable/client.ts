/**
 * reMarkable Cloud Client
 * Wrapper around ddvk/rmapi CLI tool (https://github.com/ddvk/rmapi)
 * — maintained fork with sync15 protocol support
 *
 * Authentication flow:
 * 1. User gets a one-time code from my.remarkable.com/device/desktop/connect
 * 2. We pass the code to rmapi which stores the token in ~/.rmapi
 * 3. All subsequent calls use rmapi commands
 *
 * Note: This is a single-account implementation (one reMarkable account per server)
 */

import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { remarkableConfig } from "@openframe/database/schema";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const execAsync = promisify(exec);

// Path to rmapi config file
// ddvk/rmapi uses ~/.config/rmapi/rmapi.conf (not ~/.rmapi like the original)
const RMAPI_HOME = process.env.NODE_ENV === "production" ? "/root" : os.homedir();
const RMAPI_CONFIG = path.join(RMAPI_HOME, ".config", "rmapi", "rmapi.conf");

// Temp directory for file operations
const TEMP_DIR = path.join(os.tmpdir(), "openframe-remarkable");

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
  isConnected(): boolean;
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

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Execute an rmapi command and return the output
 */
async function runRmapi(args: string[], timeoutMs = 30000): Promise<string> {
  const command = `rmapi ${args.map(a => a.includes(" ") ? `"${a}"` : a).join(" ")}`;

  try {
    const env = { ...process.env, HOME: RMAPI_HOME };
    const { stdout, stderr } = await execAsync(command, {
      timeout: timeoutMs,
      encoding: "utf-8",
      env,
    });

    if (stderr && !stderr.includes("Refreshing tree") && !stderr.includes("WARNING")) {
      console.warn("[rmapi] stderr:", stderr);
    }

    return stdout.trim();
  } catch (err: unknown) {
    const error = err as { code?: number; killed?: boolean; stderr?: string; message?: string };
    if (error.killed) {
      throw new Error(`rmapi command timed out after ${timeoutMs}ms`);
    }
    // rmapi returns exit code 1 on errors
    if (error.stderr) {
      throw new Error(`rmapi error: ${error.stderr}`);
    }
    throw new Error(`rmapi error: ${error.message || "Unknown error"}`);
  }
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
 * Get or create the reMarkable client for a user
 * Note: This is a single-account implementation - userId is tracked in DB but
 * all users share the same rmapi connection.
 */
export function getRemarkableClient(
  fastify: FastifyInstance,
  userId: string
): RemarkableClient {

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

  return {
    isConnected(): boolean {
      return fs.existsSync(RMAPI_CONFIG);
    },

    async connect(oneTimeCode: string): Promise<void> {
      fastify.log.info("Connecting to reMarkable cloud via rmapi (ddvk fork)...");

      const code = oneTimeCode.trim();
      if (code.length !== 8) {
        throw new Error(`Invalid code: expected 8 characters, got ${code.length}`);
      }

      try {
        // Pipe the code directly to rmapi via shell echo
        // rmapi reads the code from stdin, authenticates, then exits
        // Set HOME explicitly so rmapi writes config to the right place
        const env = { ...process.env, HOME: RMAPI_HOME };
        const { stdout, stderr } = await execAsync(
          `echo "${code}" | rmapi`,
          { timeout: 30000, encoding: "utf-8", env }
        );

        fastify.log.info({ stdout: stdout.trim(), stderr: stderr.trim() }, "rmapi connect output");

        if (fs.existsSync(RMAPI_CONFIG)) {
          await saveConfig({
            deviceToken: "rmapi",
            isConnected: true,
          });
          fastify.log.info("Successfully connected to reMarkable cloud via rmapi");
        } else {
          throw new Error(`Failed to connect: ${stderr || stdout || "rmapi config not created"}`);
        }
      } catch (err) {
        const error = err as { stderr?: string; message?: string };
        // Check if config was created despite error exit code (rmapi exits non-zero after auth sometimes)
        if (fs.existsSync(RMAPI_CONFIG)) {
          await saveConfig({
            deviceToken: "rmapi",
            isConnected: true,
          });
          fastify.log.info("Connected to reMarkable (config created despite exit code)");
          return;
        }
        const message = error.stderr || error.message || "Unknown error";
        fastify.log.error({ err }, "Failed to connect to reMarkable");
        throw new Error(`Failed to connect: ${message}`);
      }
    },

    async disconnect(): Promise<void> {
      // Remove rmapi config
      if (fs.existsSync(RMAPI_CONFIG)) {
        fs.unlinkSync(RMAPI_CONFIG);
      }

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
        if (!fs.existsSync(RMAPI_CONFIG)) {
          return false;
        }

        // Try listing root directory
        await runRmapi(["ls", "/"], 15000);
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
        // Use find to get all files recursively, then batch stat them for timestamps
        const env = { ...process.env, HOME: RMAPI_HOME };

        // Build a batch command: ls the folder, then stat each entry
        const lsOutput = await runRmapi(["ls", targetPath], 30000);
        const docs = parseLsOutput(lsOutput, targetPath === "/" ? "" : targetPath);

        // Batch stat all docs in a single rmapi session for timestamps
        if (docs.length > 0) {
          const statCommands = docs.map(d => `stat "${d.id}"`).join("\n");
          try {
            const { stdout } = await execAsync(
              `echo '${statCommands}\nquit' | rmapi`,
              { timeout: 60000, encoding: "utf-8", env }
            );

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

      try {
        // rmapi get downloads to current directory, so we need to cd first
        const env = { ...process.env, HOME: RMAPI_HOME };
        await execAsync(`cd "${TEMP_DIR}" && rmapi get "${documentId}"`, {
          timeout: 60000, env,
        });

        // Find the downloaded file (rmapi creates a .zip file)
        const zipPath = path.join(TEMP_DIR, `${docName}.zip`);

        if (!fs.existsSync(zipPath)) {
          throw new Error(`Downloaded file not found: ${zipPath}`);
        }

        const buffer = fs.readFileSync(zipPath);

        // Clean up
        fs.unlinkSync(zipPath);

        return buffer;
      } catch (err) {
        fastify.log.error({ err, documentId }, "Failed to download document");
        throw err;
      }
    },

    async downloadDocumentWithAnnotations(docPath: string): Promise<Buffer> {
      // Use rmapi geta to download with annotations as PDF
      const docName = path.basename(docPath);

      fastify.log.info({ docPath }, "Downloading reMarkable document with annotations");

      try {
        // rmapi geta downloads to current directory as PDF
        const env = { ...process.env, HOME: RMAPI_HOME };
        await execAsync(`cd "${TEMP_DIR}" && rmapi geta "${docPath}"`, {
          timeout: 120000, env,
        });

        // Find the downloaded PDF file
        const pdfPath = path.join(TEMP_DIR, `${docName}.pdf`);

        // Sometimes rmapi uses slightly different naming
        let actualPath = pdfPath;
        if (!fs.existsSync(pdfPath)) {
          // Try to find any PDF that was just created
          const files = fs.readdirSync(TEMP_DIR);
          const pdfFiles = files.filter(f => f.endsWith(".pdf"));
          if (pdfFiles.length > 0) {
            // Get most recently modified
            const sorted = pdfFiles
              .map(f => ({ name: f, mtime: fs.statSync(path.join(TEMP_DIR, f)).mtime }))
              .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
            const mostRecent = sorted[0];
            if (mostRecent) {
              actualPath = path.join(TEMP_DIR, mostRecent.name);
            } else {
              throw new Error(`Downloaded PDF not found in ${TEMP_DIR}`);
            }
          } else {
            throw new Error(`Downloaded PDF not found in ${TEMP_DIR}`);
          }
        }

        const buffer = fs.readFileSync(actualPath);

        // Clean up
        fs.unlinkSync(actualPath);

        fastify.log.info({ size: buffer.length }, "Downloaded document with annotations");
        return buffer;
      } catch (err) {
        fastify.log.error({ err, docPath }, "Failed to download document with annotations");
        throw err;
      }
    },

    async uploadPdf(pdfBuffer: Buffer, name: string, folderPath: string): Promise<string> {
      let safeName = name.replace(/[^a-zA-Z0-9-_. ]/g, "_");
      if (!safeName.endsWith(".pdf")) safeName += ".pdf";
      const tempFile = path.join(TEMP_DIR, safeName);

      fastify.log.info({ name: safeName, folderPath }, "Uploading PDF to reMarkable");

      try {
        // Write PDF to temp file
        fs.writeFileSync(tempFile, pdfBuffer);

        // Ensure target folder exists
        if (folderPath && folderPath !== "/") {
          try {
            await this.createFolder(folderPath);
          } catch {
            // Folder might already exist, continue
          }
        }

        // Upload using rmapi put
        const destination = folderPath && folderPath !== "/"
          ? `${folderPath}/${safeName}`
          : `/${safeName}`;

        await runRmapi(["put", "--force", tempFile, folderPath || "/"], 60000);

        // Clean up temp file
        fs.unlinkSync(tempFile);

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
        // Clean up temp file on error
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
        fastify.log.error({ err, name, folderPath }, "Failed to upload PDF");
        throw err;
      }
    },

    async createFolder(folderPath: string, _parentPath?: string): Promise<string> {
      fastify.log.info({ folderPath }, "Creating reMarkable folder");

      // Create each level of the path one at a time
      // e.g., "/Calendar/Daily Agenda" → mkdir "/Calendar", then mkdir "/Calendar/Daily Agenda"
      const segments = folderPath.replace(/^\//, "").split("/");
      let currentPath = "";

      for (const segment of segments) {
        currentPath += "/" + segment;
        try {
          await runRmapi(["mkdir", currentPath], 30000);
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
    },

    async getUserToken(): Promise<string | null> {
      // rmapi manages tokens internally
      // Return a placeholder if configured
      if (fs.existsSync(RMAPI_CONFIG)) {
        return "rmapi-managed";
      }
      return null;
    },
  };
}
