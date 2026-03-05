import type { FastifyPluginAsync } from "fastify";
import { getCurrentUser } from "../../plugins/auth.js";
import { randomUUID } from "crypto";
import { mkdir, unlink, readdir, stat } from "fs/promises";
import { createReadStream } from "fs";
import path, { join } from "path";
import sharp from "sharp";

export const iconRoutes: FastifyPluginAsync = async (fastify) => {
  const uploadDir = process.env.UPLOAD_DIR ?? "./uploads";

  // POST /upload — upload a custom icon
  fastify.post(
    "/upload",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Upload a custom icon (SVG, PNG, or WebP, max 1MB)",
        tags: ["Icons"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        consumes: ["multipart/form-data"],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const data = await request.file();
      if (!data) return reply.badRequest("No file uploaded");

      const ext = path.extname(data.filename).toLowerCase();
      if (![".svg", ".png", ".webp"].includes(ext)) {
        return reply.badRequest("Only SVG, PNG, and WebP files are accepted");
      }

      // Read file into buffer
      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk as Buffer);
      }
      const buffer = Buffer.concat(chunks);

      if (buffer.length > 1024 * 1024) {
        return reply.badRequest("File must be under 1MB");
      }

      // Process: convert SVG to PNG, resize PNG/WebP to 128x128 max
      let outputBuffer: Buffer;
      if (ext === ".svg") {
        outputBuffer = await sharp(buffer)
          .resize(128, 128, { fit: "inside", withoutEnlargement: true })
          .png()
          .toBuffer();
      } else {
        outputBuffer = await sharp(buffer)
          .resize(128, 128, { fit: "inside", withoutEnlargement: true })
          .png()
          .toBuffer();
      }

      const filename = `${randomUUID()}.png`;
      const iconDir = join(uploadDir, user.id, "icons");
      await mkdir(iconDir, { recursive: true });
      const filePath = join(iconDir, filename);

      const { writeFile } = await import("fs/promises");
      await writeFile(filePath, outputBuffer);

      const iconString = `custom:${user.id}/icons/${filename}`;
      return { success: true, icon: iconString };
    }
  );

  // GET / — list user's custom icons
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "List all custom icons for the authenticated user",
        tags: ["Icons"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const iconDir = join(uploadDir, user.id, "icons");
      let files: string[] = [];
      try {
        files = await readdir(iconDir);
      } catch {
        // Directory doesn't exist yet = no icons
      }

      const icons = files
        .filter((f) => f.endsWith(".png"))
        .map((f) => `custom:${user.id}/icons/${f}`);

      return { success: true, icons };
    }
  );

  // GET /files/* — serve icon files
  fastify.get(
    "/files/*",
    {
      onRequest: [
        // Support token/apiKey as query params for <img> tag auth
        async (request) => {
          const query = request.query as Record<string, string>;
          if (query.token) {
            request.headers.authorization = `Bearer ${query.token}`;
          } else if (query.apiKey) {
            request.headers["x-api-key"] = query.apiKey;
          }
        },
        fastify.authenticateKioskOrAny,
      ],
      schema: {
        description: "Serve a custom icon file",
        tags: ["Icons"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const filePath = (request.params as { "*": string })["*"];

      // Security: validate path doesn't escape user directory
      const normalizedPath = path.normalize(filePath);
      if (normalizedPath.startsWith("..") || path.isAbsolute(normalizedPath)) {
        return reply.forbidden("Invalid file path");
      }

      // Verify file belongs to user
      if (!normalizedPath.startsWith(user.id)) {
        return reply.forbidden("Access denied");
      }

      const fullPath = join(uploadDir, normalizedPath);

      try {
        await stat(fullPath);
      } catch {
        return reply.notFound("File not found");
      }

      const stream = createReadStream(fullPath);
      return reply
        .header("Content-Type", "image/png")
        .header("Cache-Control", "public, max-age=31536000")
        .send(stream);
    }
  );

  // DELETE /:filename — delete a custom icon
  fastify.delete(
    "/:filename",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Delete a custom icon",
        tags: ["Icons"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: {
            filename: { type: "string" },
          },
          required: ["filename"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { filename } = request.params as { filename: string };

      // Security: prevent path traversal
      if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
        return reply.badRequest("Invalid filename");
      }

      const filePath = join(uploadDir, user.id, "icons", filename);

      try {
        await stat(filePath);
        await unlink(filePath);
      } catch {
        return reply.notFound("Icon not found");
      }

      return { success: true };
    }
  );
};
