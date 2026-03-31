import type { FastifyPluginAsync } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import { storageServers, autoBackupConfig } from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";
import { encryptField, decryptField } from "../../lib/encryption.js";
import {
  getStorageClient,
  createStorageClient,
  type StorageClientConfig,
} from "../../services/storage-client.js";
import type { StorageProtocol } from "@openframe/shared";
import path from "path";

export const storageRoutes: FastifyPluginAsync = async (fastify) => {
  // ==================== SERVERS CRUD ====================

  // List storage servers
  fastify.get(
    "/servers",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "List user's storage servers",
        tags: ["Storage"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const servers = await fastify.db
        .select()
        .from(storageServers)
        .where(eq(storageServers.userId, user.id))
        .orderBy(desc(storageServers.createdAt));

      return {
        success: true,
        data: servers.map((s) => ({
          id: s.id,
          userId: s.userId,
          name: s.name,
          protocol: s.protocol,
          host: s.host,
          port: s.port,
          basePath: s.basePath,
          username: s.username,
          shareName: s.shareName,
          isActive: s.isActive,
          hasPassword: !!s.password,
          lastConnectedAt: s.lastConnectedAt,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        })),
      };
    }
  );

  // Add storage server
  fastify.post(
    "/servers",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Add a new storage server",
        tags: ["Storage"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            protocol: { type: "string", enum: ["ftp", "sftp", "smb", "webdav"] },
            host: { type: "string" },
            port: { type: "number", nullable: true },
            basePath: { type: "string" },
            username: { type: "string", nullable: true },
            password: { type: "string", nullable: true },
            shareName: { type: "string", nullable: true },
          },
          required: ["name", "protocol", "host"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const body = request.body as {
        name: string;
        protocol: StorageProtocol;
        host: string;
        port?: number | null;
        basePath?: string;
        username?: string | null;
        password?: string | null;
        shareName?: string | null;
      };

      const [server] = await fastify.db
        .insert(storageServers)
        .values({
          userId: user.id,
          name: body.name,
          protocol: body.protocol,
          host: body.host,
          port: body.port ?? null,
          basePath: body.basePath || "/",
          username: body.username ?? null,
          password: encryptField(body.password),
          shareName: body.shareName ?? null,
        })
        .returning();

      return {
        success: true,
        data: {
          ...server,
          password: undefined,
          hasPassword: !!server!.password,
        },
      };
    }
  );

  // Update storage server
  fastify.patch(
    "/servers/:id",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Update a storage server",
        tags: ["Storage"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { id } = request.params as { id: string };
      const body = request.body as Partial<{
        name: string;
        protocol: StorageProtocol;
        host: string;
        port: number | null;
        basePath: string;
        username: string | null;
        password: string | null;
        shareName: string | null;
        isActive: boolean;
      }>;

      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (body.name !== undefined) updateData.name = body.name;
      if (body.protocol !== undefined) updateData.protocol = body.protocol;
      if (body.host !== undefined) updateData.host = body.host;
      if (body.port !== undefined) updateData.port = body.port;
      if (body.basePath !== undefined) updateData.basePath = body.basePath;
      if (body.username !== undefined) updateData.username = body.username;
      if (body.password !== undefined)
        updateData.password = encryptField(body.password);
      if (body.shareName !== undefined) updateData.shareName = body.shareName;
      if (body.isActive !== undefined) updateData.isActive = body.isActive;

      const [server] = await fastify.db
        .update(storageServers)
        .set(updateData)
        .where(
          and(eq(storageServers.id, id), eq(storageServers.userId, user.id))
        )
        .returning();

      if (!server) throw fastify.httpErrors.notFound("Server not found");

      return {
        success: true,
        data: {
          ...server,
          password: undefined,
          hasPassword: !!server.password,
        },
      };
    }
  );

  // Delete storage server
  fastify.delete(
    "/servers/:id",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Delete a storage server",
        tags: ["Storage"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { id } = request.params as { id: string };

      const [deleted] = await fastify.db
        .delete(storageServers)
        .where(
          and(eq(storageServers.id, id), eq(storageServers.userId, user.id))
        )
        .returning();

      if (!deleted) throw fastify.httpErrors.notFound("Server not found");

      return { success: true };
    }
  );

  // ==================== STORAGE OPERATIONS ====================

  // Test connection
  fastify.post(
    "/servers/:id/test",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Test connection to a storage server",
        tags: ["Storage"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { id } = request.params as { id: string };

      // Load server config
      const [server] = await fastify.db
        .select()
        .from(storageServers)
        .where(
          and(eq(storageServers.id, id), eq(storageServers.userId, user.id))
        );

      if (!server) throw fastify.httpErrors.notFound("Server not found");

      const config: StorageClientConfig = {
        protocol: server.protocol as StorageProtocol,
        host: server.host,
        port: server.port,
        basePath: server.basePath ?? "/",
        username: server.username,
        password: decryptField(server.password),
        shareName: server.shareName,
      };

      const client = createStorageClient(config);
      const result = await client.testConnection();

      if (result.success) {
        await fastify.db
          .update(storageServers)
          .set({ lastConnectedAt: new Date(), updatedAt: new Date() })
          .where(eq(storageServers.id, id));
      }

      return { success: true, data: result };
    }
  );

  // Browse files
  fastify.get(
    "/servers/:id/browse",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Browse files on a storage server",
        tags: ["Storage"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        querystring: {
          type: "object",
          properties: { path: { type: "string", default: "/" } },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { id } = request.params as { id: string };
      const { path: browsePath } = request.query as { path?: string };

      const { client, server } = await getStorageClient(
        fastify.db,
        id,
        user.id
      );

      try {
        const files = await client.list(browsePath || "/");
        return {
          success: true,
          data: {
            serverName: server.name,
            path: browsePath || "/",
            files,
          },
        };
      } finally {
        await client.disconnect();
      }
    }
  );

  // Download file
  fastify.get(
    "/servers/:id/download",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Download a file from a storage server",
        tags: ["Storage"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        querystring: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { id } = request.params as { id: string };
      const { path: filePath } = request.query as { path: string };

      const { client } = await getStorageClient(fastify.db, id, user.id);

      try {
        const data = await client.read(filePath);
        const filename = path.basename(filePath);
        const ext = path.extname(filename).toLowerCase();

        // Determine content type
        const mimeTypes: Record<string, string> = {
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".png": "image/png",
          ".gif": "image/gif",
          ".webp": "image/webp",
          ".pdf": "application/pdf",
          ".txt": "text/plain",
          ".mp4": "video/mp4",
          ".mp3": "audio/mpeg",
        };
        const contentType = mimeTypes[ext] ?? "application/octet-stream";

        reply.header("Content-Type", contentType);
        reply.header(
          "Content-Disposition",
          `attachment; filename="${filename}"`
        );
        return reply.send(data);
      } finally {
        await client.disconnect();
      }
    }
  );

  // Upload file
  fastify.post(
    "/servers/:id/upload",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Upload a file to a storage server",
        tags: ["Storage"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { id } = request.params as { id: string };

      const data = await request.file();
      if (!data) throw fastify.httpErrors.badRequest("No file provided");

      const destPath =
        (data.fields?.path as any)?.value || "/";
      const remotePath = path.posix.join(destPath, data.filename);

      const { client } = await getStorageClient(fastify.db, id, user.id);

      try {
        const buf = await data.toBuffer();
        await client.write(remotePath, buf);
        return { success: true, data: { path: remotePath } };
      } finally {
        await client.disconnect();
      }
    }
  );

  // Create directory
  fastify.post(
    "/servers/:id/mkdir",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Create a directory on a storage server",
        tags: ["Storage"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { id } = request.params as { id: string };
      const { path: dirPath } = request.body as { path: string };

      const { client } = await getStorageClient(fastify.db, id, user.id);

      try {
        await client.mkdir(dirPath);
        return { success: true };
      } finally {
        await client.disconnect();
      }
    }
  );

  // Delete file/directory
  fastify.delete(
    "/servers/:id/file",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Delete a file or directory on a storage server",
        tags: ["Storage"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        querystring: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { id } = request.params as { id: string };
      const { path: filePath } = request.query as { path: string };

      const { client } = await getStorageClient(fastify.db, id, user.id);

      try {
        await client.delete(filePath);
        return { success: true };
      } finally {
        await client.disconnect();
      }
    }
  );

  // ==================== AUTO-BACKUP CONFIG ====================

  // Get auto-backup config
  fastify.get(
    "/auto-backup",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get auto-backup configuration",
        tags: ["Storage"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const [config] = await fastify.db
        .select()
        .from(autoBackupConfig)
        .where(eq(autoBackupConfig.userId, user.id));

      return { success: true, data: config || null };
    }
  );

  // Upsert auto-backup config
  fastify.put(
    "/auto-backup",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Create or update auto-backup configuration",
        tags: ["Storage"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        body: {
          type: "object",
          properties: {
            storageServerId: { type: "string", nullable: true },
            enabled: { type: "boolean" },
            intervalHours: { type: "number" },
            categories: {
              type: "array",
              items: { type: "string" },
            },
            includePhotos: { type: "boolean" },
            includeCredentials: { type: "boolean" },
            backupPath: { type: "string" },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const body = request.body as Partial<{
        storageServerId: string | null;
        enabled: boolean;
        intervalHours: number;
        categories: string[];
        includePhotos: boolean;
        includeCredentials: boolean;
        backupPath: string;
      }>;

      // Check if config exists
      const [existing] = await fastify.db
        .select()
        .from(autoBackupConfig)
        .where(eq(autoBackupConfig.userId, user.id));

      if (existing) {
        const updateData: Record<string, any> = { updatedAt: new Date() };
        if (body.storageServerId !== undefined)
          updateData.storageServerId = body.storageServerId;
        if (body.enabled !== undefined) updateData.enabled = body.enabled;
        if (body.intervalHours !== undefined)
          updateData.intervalHours = body.intervalHours;
        if (body.categories !== undefined)
          updateData.categories = body.categories;
        if (body.includePhotos !== undefined)
          updateData.includePhotos = body.includePhotos;
        if (body.includeCredentials !== undefined)
          updateData.includeCredentials = body.includeCredentials;
        if (body.backupPath !== undefined)
          updateData.backupPath = body.backupPath;

        const [updated] = await fastify.db
          .update(autoBackupConfig)
          .set(updateData)
          .where(eq(autoBackupConfig.userId, user.id))
          .returning();

        return { success: true, data: updated };
      }

      const [created] = await fastify.db
        .insert(autoBackupConfig)
        .values({
          userId: user.id,
          storageServerId: body.storageServerId ?? null,
          enabled: body.enabled ?? false,
          intervalHours: body.intervalHours ?? 24,
          categories: body.categories ?? ["settings"],
          includePhotos: body.includePhotos ?? false,
          includeCredentials: body.includeCredentials ?? false,
          backupPath: body.backupPath ?? "/openframe-backups",
        })
        .returning();

      return { success: true, data: created };
    }
  );

  // Trigger manual backup
  fastify.post(
    "/auto-backup/run-now",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Trigger an immediate auto-backup",
        tags: ["Storage"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const [config] = await fastify.db
        .select()
        .from(autoBackupConfig)
        .where(eq(autoBackupConfig.userId, user.id));

      if (!config || !config.storageServerId) {
        throw fastify.httpErrors.badRequest(
          "Auto-backup not configured or no storage server selected"
        );
      }

      // Get the export data using the settings export logic
      const categories = (config.categories as string[]) || ["settings"];
      const exportUrl = `/api/v1/settings/export?categories=${categories.join(",")}&includeCredentials=${config.includeCredentials}&includePhotos=${config.includePhotos}`;

      // Inject request to the export endpoint
      const exportResponse = await fastify.inject({
        method: "GET",
        url: exportUrl,
        headers: request.headers,
      });

      if (exportResponse.statusCode !== 200) {
        throw fastify.httpErrors.internalServerError("Failed to generate backup data");
      }

      const exportData = exportResponse.json();
      const backupJson = JSON.stringify(exportData);
      const backupBuffer = Buffer.from(backupJson, "utf-8");

      // Upload to storage server
      const { client } = await getStorageClient(
        fastify.db,
        config.storageServerId,
        user.id
      );

      try {
        const timestamp = new Date().toISOString().split("T")[0];
        const filename = `openframe-backup-${timestamp}.json`;
        const remotePath = path.posix.join(
          config.backupPath || "/openframe-backups",
          filename
        );

        // Ensure backup directory exists
        await client.mkdir(config.backupPath || "/openframe-backups");
        await client.write(remotePath, backupBuffer);

        // Update last backup time
        await fastify.db
          .update(autoBackupConfig)
          .set({
            lastBackupAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(autoBackupConfig.userId, user.id));

        return {
          success: true,
          data: {
            message: "Backup completed successfully",
            path: remotePath,
            size: backupBuffer.length,
          },
        };
      } finally {
        await client.disconnect();
      }
    }
  );
};
