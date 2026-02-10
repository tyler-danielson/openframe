/**
 * reMarkable Cloud Client
 * Wrapper around rmapi CLI tool (https://github.com/juruen/rmapi)
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
const RMAPI_CONFIG = path.join(os.homedir(), ".rmapi");

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
    const { stdout, stderr } = await execAsync(command, {
      timeout: timeoutMs,
      encoding: "utf-8",
    });

    if (stderr && !stderr.includes("Refreshing tree")) {
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
 * Check if rmapi is installed and configured
 */
async function isRmapiConfigured(): Promise<boolean> {
  // Check if config file exists
  if (!fs.existsSync(RMAPI_CONFIG)) {
    return false;
  }

  // Try to run a simple command to verify authentication
  try {
    await runRmapi(["version"], 10000);
    return true;
  } catch {
    return false;
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
      fastify.log.info("Connecting to reMarkable cloud via rmapi...");

      // rmapi expects the code to be entered interactively
      // We need to use spawn to pipe the code to stdin
      return new Promise((resolve, reject) => {
        const proc = spawn("rmapi", [], {
          stdio: ["pipe", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";

        proc.stdout.on("data", (data) => {
          stdout += data.toString();
          // When rmapi asks for the code, send it
          if (stdout.includes("Enter one-time code")) {
            proc.stdin.write(oneTimeCode + "\n");
          }
          // When we see successful auth, exit
          if (stdout.includes("ReMarkable Cloud") || stdout.includes("rmapi>")) {
            proc.stdin.write("quit\n");
          }
        });

        proc.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        proc.on("close", async (code) => {
          if (fs.existsSync(RMAPI_CONFIG)) {
            // Save to database that we're connected
            await saveConfig({
              deviceToken: "rmapi", // We use rmapi's stored token
              isConnected: true,
            });
            fastify.log.info("Successfully connected to reMarkable cloud via rmapi");
            resolve();
          } else {
            reject(new Error(`Failed to connect: ${stderr || "rmapi config not created"}`));
          }
        });

        proc.on("error", (err) => {
          reject(new Error(`Failed to spawn rmapi: ${err.message}. Is rmapi installed?`));
        });

        // Timeout after 60 seconds
        setTimeout(() => {
          proc.kill();
          reject(new Error("Connection timed out"));
        }, 60000);
      });
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
        const output = await runRmapi(["ls", targetPath], 30000);
        const docs = parseLsOutput(output, targetPath === "/" ? "" : targetPath);

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
      const outputPath = path.join(TEMP_DIR, `${docName}.zip`);

      fastify.log.info({ documentId, outputPath }, "Downloading reMarkable document");

      try {
        // rmapi get downloads to current directory, so we need to cd first
        await execAsync(`cd "${TEMP_DIR}" && rmapi get "${documentId}"`, {
          timeout: 60000,
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
      const safeName = docName.replace(/[^a-zA-Z0-9-_]/g, "_");

      fastify.log.info({ docPath }, "Downloading reMarkable document with annotations");

      try {
        // rmapi geta downloads to current directory as PDF
        await execAsync(`cd "${TEMP_DIR}" && rmapi geta "${docPath}"`, {
          timeout: 120000, // 2 minutes for PDF generation
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
      const safeName = name.replace(/[^a-zA-Z0-9-_. ]/g, "_");
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

        await runRmapi(["put", tempFile, folderPath || "/"], 60000);

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

      try {
        // rmapi mkdir creates the full path
        await runRmapi(["mkdir", folderPath], 30000);

        fastify.log.info({ folderPath }, "Successfully created folder");
        return folderPath;
      } catch (err) {
        // Folder might already exist
        const errorMsg = (err as Error).message || "";
        if (errorMsg.includes("already exists") || errorMsg.includes("entry exists")) {
          fastify.log.info({ folderPath }, "Folder already exists");
          return folderPath;
        }
        fastify.log.error({ err, folderPath }, "Failed to create folder");
        throw err;
      }
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
