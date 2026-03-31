import { Client as FtpClient } from "basic-ftp";
import SftpClient from "ssh2-sftp-client";
import { createClient as createWebdavClient, type FileStat } from "webdav";
import path from "path";
import { eq, and } from "drizzle-orm";
import { storageServers } from "@openframe/database";
import { decryptField } from "../lib/encryption.js";
import type { StorageProtocol, StorageFileEntry } from "@openframe/shared";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Readable } from "stream";

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface StorageClientConfig {
  protocol: StorageProtocol;
  host: string;
  port?: number | null;
  basePath: string;
  username?: string | null;
  password?: string | null;
  shareName?: string | null;
}

export interface IStorageClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  testConnection(): Promise<{ success: boolean; message: string }>;
  list(remotePath: string): Promise<StorageFileEntry[]>;
  read(remotePath: string): Promise<Buffer>;
  readStream(remotePath: string): Promise<Readable>;
  write(remotePath: string, data: Buffer | Readable): Promise<void>;
  mkdir(remotePath: string): Promise<void>;
  delete(remotePath: string): Promise<void>;
  exists(remotePath: string): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Default ports
// ---------------------------------------------------------------------------

const DEFAULT_PORTS: Record<StorageProtocol, number> = {
  ftp: 21,
  sftp: 22,
  smb: 445,
  webdav: 443,
};

// ---------------------------------------------------------------------------
// MIME type helper
// ---------------------------------------------------------------------------

const EXT_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".json": "application/json",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".zip": "application/zip",
};

function mimeFromName(name: string): string | null {
  const ext = path.extname(name).toLowerCase();
  return EXT_MIME[ext] ?? null;
}

// ---------------------------------------------------------------------------
// FTP Client
// ---------------------------------------------------------------------------

class FtpStorageClient implements IStorageClient {
  private client = new FtpClient();
  private config: StorageClientConfig;

  constructor(config: StorageClientConfig) {
    this.config = config;
  }

  private resolvePath(remotePath: string): string {
    return path.posix.join(this.config.basePath || "/", remotePath);
  }

  async connect(): Promise<void> {
    await this.client.access({
      host: this.config.host,
      port: this.config.port ?? DEFAULT_PORTS.ftp,
      user: this.config.username ?? undefined,
      password: this.config.password ?? undefined,
      secure: false,
    });
  }

  async disconnect(): Promise<void> {
    this.client.close();
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.connect();
      await this.client.pwd();
      await this.disconnect();
      return { success: true, message: "Connected successfully" };
    } catch (err: any) {
      return { success: false, message: err.message ?? "Connection failed" };
    }
  }

  async list(remotePath: string): Promise<StorageFileEntry[]> {
    const fullPath = this.resolvePath(remotePath);
    const items = await this.client.list(fullPath);
    return items
      .filter((f) => f.name !== "." && f.name !== "..")
      .map((f) => ({
        name: f.name,
        path: path.posix.join(remotePath, f.name),
        isDirectory: f.isDirectory,
        size: f.size,
        modifiedAt: f.modifiedAt ?? null,
        mimeType: f.isDirectory ? null : mimeFromName(f.name),
      }));
  }

  async read(remotePath: string): Promise<Buffer> {
    const fullPath = this.resolvePath(remotePath);
    const chunks: Buffer[] = [];
    const writable = new (await import("stream")).Writable({
      write(chunk, _enc, cb) {
        chunks.push(Buffer.from(chunk));
        cb();
      },
    });
    await this.client.downloadTo(writable, fullPath);
    return Buffer.concat(chunks);
  }

  async readStream(remotePath: string): Promise<Readable> {
    // basic-ftp doesn't support streaming reads directly. Buffer then stream.
    const buf = await this.read(remotePath);
    const { Readable: ReadableStream } = await import("stream");
    return ReadableStream.from(buf);
  }

  async write(remotePath: string, data: Buffer | Readable): Promise<void> {
    const fullPath = this.resolvePath(remotePath);
    const { Readable: ReadableStream } = await import("stream");
    const stream =
      data instanceof Buffer ? ReadableStream.from(data) : data;
    await this.client.uploadFrom(stream as Readable, fullPath);
  }

  async mkdir(remotePath: string): Promise<void> {
    const fullPath = this.resolvePath(remotePath);
    await this.client.ensureDir(fullPath);
  }

  async delete(remotePath: string): Promise<void> {
    const fullPath = this.resolvePath(remotePath);
    try {
      await this.client.remove(fullPath);
    } catch {
      // Might be a directory
      await this.client.removeDir(fullPath);
    }
  }

  async exists(remotePath: string): Promise<boolean> {
    const fullPath = this.resolvePath(remotePath);
    try {
      await this.client.size(fullPath);
      return true;
    } catch {
      // Try as directory
      try {
        await this.client.list(fullPath);
        return true;
      } catch {
        return false;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// SFTP Client
// ---------------------------------------------------------------------------

class SftpStorageClient implements IStorageClient {
  private client = new SftpClient();
  private config: StorageClientConfig;

  constructor(config: StorageClientConfig) {
    this.config = config;
  }

  private resolvePath(remotePath: string): string {
    return path.posix.join(this.config.basePath || "/", remotePath);
  }

  async connect(): Promise<void> {
    await this.client.connect({
      host: this.config.host,
      port: this.config.port ?? DEFAULT_PORTS.sftp,
      username: this.config.username ?? undefined,
      password: this.config.password ?? undefined,
    });
  }

  async disconnect(): Promise<void> {
    await this.client.end();
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.connect();
      await this.client.cwd();
      await this.disconnect();
      return { success: true, message: "Connected successfully" };
    } catch (err: any) {
      return { success: false, message: err.message ?? "Connection failed" };
    }
  }

  async list(remotePath: string): Promise<StorageFileEntry[]> {
    const fullPath = this.resolvePath(remotePath);
    const items = await this.client.list(fullPath);
    return items
      .filter((f) => f.name !== "." && f.name !== "..")
      .map((f) => ({
        name: f.name,
        path: path.posix.join(remotePath, f.name),
        isDirectory: f.type === "d",
        size: f.size,
        modifiedAt: new Date(f.modifyTime),
        mimeType: f.type === "d" ? null : mimeFromName(f.name),
      }));
  }

  async read(remotePath: string): Promise<Buffer> {
    const fullPath = this.resolvePath(remotePath);
    const result = await this.client.get(fullPath) as unknown;
    if (Buffer.isBuffer(result)) return result;
    // Collect stream
    const chunks: Buffer[] = [];
    for await (const chunk of result as AsyncIterable<Buffer>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async readStream(remotePath: string): Promise<Readable> {
    const fullPath = this.resolvePath(remotePath);
    const result = await this.client.get(fullPath) as unknown;
    if (Buffer.isBuffer(result)) {
      const { Readable: ReadableStream } = await import("stream");
      return ReadableStream.from(result);
    }
    return result as Readable;
  }

  async write(remotePath: string, data: Buffer | Readable): Promise<void> {
    const fullPath = this.resolvePath(remotePath);
    await this.client.put(data, fullPath);
  }

  async mkdir(remotePath: string): Promise<void> {
    const fullPath = this.resolvePath(remotePath);
    await this.client.mkdir(fullPath, true);
  }

  async delete(remotePath: string): Promise<void> {
    const fullPath = this.resolvePath(remotePath);
    try {
      await this.client.delete(fullPath);
    } catch {
      await this.client.rmdir(fullPath, true);
    }
  }

  async exists(remotePath: string): Promise<boolean> {
    const fullPath = this.resolvePath(remotePath);
    return (await this.client.exists(fullPath)) !== false;
  }
}

// ---------------------------------------------------------------------------
// SMB Client
// ---------------------------------------------------------------------------

class SmbStorageClient implements IStorageClient {
  private client: any;
  private config: StorageClientConfig;

  constructor(config: StorageClientConfig) {
    this.config = config;
  }

  private resolvePath(remotePath: string): string {
    return path.posix.join(this.config.basePath || "/", remotePath);
  }

  async connect(): Promise<void> {
    // Dynamic import since smb2 may not be available on all platforms
    // @ts-expect-error — optional dependency, not always installed
    const SMB2 = (await import("@nicman23/smb2")).default;
    this.client = new SMB2({
      share: `\\\\${this.config.host}\\${this.config.shareName || "share"}`,
      port: this.config.port ?? DEFAULT_PORTS.smb,
      username: this.config.username ?? "",
      password: this.config.password ?? "",
    });
  }

  async disconnect(): Promise<void> {
    if (this.client?.close) {
      await new Promise<void>((resolve) => {
        this.client.close(() => resolve());
      });
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.connect();
      await this.smbReaddir("/");
      await this.disconnect();
      return { success: true, message: "Connected successfully" };
    } catch (err: any) {
      return { success: false, message: err.message ?? "Connection failed" };
    }
  }

  private smbReaddir(dir: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.client.readdir(dir, (err: any, files: string[]) => {
        if (err) reject(err);
        else resolve(files || []);
      });
    });
  }

  private smbReadFile(filePath: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      this.client.readFile(filePath, (err: any, data: Buffer) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
  }

  private smbWriteFile(filePath: string, data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.writeFile(filePath, data, (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private smbMkdir(dirPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.mkdir(dirPath, (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private smbUnlink(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.unlink(filePath, (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private smbStat(filePath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.stat?.(filePath, (err: any, stat: any) => {
        if (err) reject(err);
        else resolve(stat);
      });
    });
  }

  async list(remotePath: string): Promise<StorageFileEntry[]> {
    const fullPath = this.resolvePath(remotePath);
    const files = await this.smbReaddir(fullPath);
    const entries: StorageFileEntry[] = [];
    for (const name of files) {
      if (name === "." || name === "..") continue;
      const filePath = path.posix.join(remotePath, name);
      let isDirectory = false;
      let size: number | null = null;
      try {
        const stat = await this.smbStat(path.posix.join(fullPath, name));
        isDirectory = stat?.isDirectory?.() ?? false;
        size = stat?.size ?? null;
      } catch {
        // stat may not be supported, treat as file
      }
      entries.push({
        name,
        path: filePath,
        isDirectory,
        size,
        modifiedAt: null,
        mimeType: isDirectory ? null : mimeFromName(name),
      });
    }
    return entries;
  }

  async read(remotePath: string): Promise<Buffer> {
    const fullPath = this.resolvePath(remotePath);
    return this.smbReadFile(fullPath);
  }

  async readStream(remotePath: string): Promise<Readable> {
    const buf = await this.read(remotePath);
    const { Readable: ReadableStream } = await import("stream");
    return ReadableStream.from(buf);
  }

  async write(remotePath: string, data: Buffer | Readable): Promise<void> {
    const fullPath = this.resolvePath(remotePath);
    let buf: Buffer;
    if (Buffer.isBuffer(data)) {
      buf = data;
    } else {
      const chunks: Buffer[] = [];
      for await (const chunk of data) {
        chunks.push(Buffer.from(chunk));
      }
      buf = Buffer.concat(chunks);
    }
    await this.smbWriteFile(fullPath, buf);
  }

  async mkdir(remotePath: string): Promise<void> {
    const fullPath = this.resolvePath(remotePath);
    await this.smbMkdir(fullPath);
  }

  async delete(remotePath: string): Promise<void> {
    const fullPath = this.resolvePath(remotePath);
    await this.smbUnlink(fullPath);
  }

  async exists(remotePath: string): Promise<boolean> {
    try {
      await this.smbStat(this.resolvePath(remotePath));
      return true;
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// WebDAV Client
// ---------------------------------------------------------------------------

class WebdavStorageClient implements IStorageClient {
  private client: ReturnType<typeof createWebdavClient> | null = null;
  private config: StorageClientConfig;

  constructor(config: StorageClientConfig) {
    this.config = config;
  }

  private resolvePath(remotePath: string): string {
    return path.posix.join(this.config.basePath || "/", remotePath);
  }

  async connect(): Promise<void> {
    const port = this.config.port ?? DEFAULT_PORTS.webdav;
    const scheme = port === 443 ? "https" : "http";
    const portSuffix =
      (scheme === "https" && port === 443) ||
      (scheme === "http" && port === 80)
        ? ""
        : `:${port}`;
    const url = `${scheme}://${this.config.host}${portSuffix}`;
    this.client = createWebdavClient(url, {
      username: this.config.username ?? undefined,
      password: this.config.password ?? undefined,
    });
  }

  async disconnect(): Promise<void> {
    this.client = null;
  }

  private getClient() {
    if (!this.client) throw new Error("WebDAV client not connected");
    return this.client;
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.connect();
      await this.getClient().getDirectoryContents("/");
      await this.disconnect();
      return { success: true, message: "Connected successfully" };
    } catch (err: any) {
      return { success: false, message: err.message ?? "Connection failed" };
    }
  }

  async list(remotePath: string): Promise<StorageFileEntry[]> {
    const fullPath = this.resolvePath(remotePath);
    const items = (await this.getClient().getDirectoryContents(
      fullPath
    )) as FileStat[];
    return items
      .filter((f) => f.basename !== "." && f.basename !== "..")
      .map((f) => ({
        name: f.basename,
        path: path.posix.join(remotePath, f.basename),
        isDirectory: f.type === "directory",
        size: f.size,
        modifiedAt: f.lastmod ? new Date(f.lastmod) : null,
        mimeType:
          f.type === "directory" ? null : (f.mime ?? mimeFromName(f.basename)),
      }));
  }

  async read(remotePath: string): Promise<Buffer> {
    const fullPath = this.resolvePath(remotePath);
    const data = (await this.getClient().getFileContents(fullPath)) as Buffer;
    return Buffer.from(data);
  }

  async readStream(remotePath: string): Promise<Readable> {
    const fullPath = this.resolvePath(remotePath);
    return this.getClient().createReadStream(fullPath) as unknown as Readable;
  }

  async write(remotePath: string, data: Buffer | Readable): Promise<void> {
    const fullPath = this.resolvePath(remotePath);
    if (Buffer.isBuffer(data)) {
      await this.getClient().putFileContents(fullPath, data);
    } else {
      // Collect stream to buffer for webdav
      const chunks: Buffer[] = [];
      for await (const chunk of data) {
        chunks.push(Buffer.from(chunk));
      }
      await this.getClient().putFileContents(fullPath, Buffer.concat(chunks));
    }
  }

  async mkdir(remotePath: string): Promise<void> {
    const fullPath = this.resolvePath(remotePath);
    await this.getClient().createDirectory(fullPath, { recursive: true });
  }

  async delete(remotePath: string): Promise<void> {
    const fullPath = this.resolvePath(remotePath);
    await this.getClient().deleteFile(fullPath);
  }

  async exists(remotePath: string): Promise<boolean> {
    const fullPath = this.resolvePath(remotePath);
    return this.getClient().exists(fullPath);
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createStorageClient(
  config: StorageClientConfig
): IStorageClient {
  switch (config.protocol) {
    case "ftp":
      return new FtpStorageClient(config);
    case "sftp":
      return new SftpStorageClient(config);
    case "smb":
      return new SmbStorageClient(config);
    case "webdav":
      return new WebdavStorageClient(config);
    default:
      throw new Error(`Unsupported storage protocol: ${config.protocol}`);
  }
}

/**
 * Load a storage server from the database and return a connected client.
 * Caller is responsible for calling `disconnect()` when done.
 */
export async function getStorageClient(
  db: NodePgDatabase<any>,
  serverId: string,
  userId: string
): Promise<{ client: IStorageClient; server: typeof storageServers.$inferSelect }> {
  const [server] = await db
    .select()
    .from(storageServers)
    .where(
      and(eq(storageServers.id, serverId), eq(storageServers.userId, userId))
    );

  if (!server) {
    throw new Error("Storage server not found");
  }

  const client = createStorageClient({
    protocol: server.protocol as StorageProtocol,
    host: server.host,
    port: server.port,
    basePath: server.basePath ?? "/",
    username: server.username,
    password: decryptField(server.password),
    shareName: server.shareName,
  });

  await client.connect();
  return { client, server };
}
