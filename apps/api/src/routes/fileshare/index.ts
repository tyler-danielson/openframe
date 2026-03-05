import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { getCurrentUser } from "../../plugins/auth.js";

// Accepted MIME types
const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);
const ACCEPTED_PDF_TYPE = "application/pdf";

interface FileShareRecord {
  id: string;
  userId: string;
  originalName: string;
  storedPath: string;
  mimeType: string;
  fileType: "image" | "pdf";
  pageCount?: number;
  createdAt: number;
  expiresAt: number;
}

// In-memory store — shares expire after 24 hours
export const fileShares = new Map<string, FileShareRecord>();

// Cleanup expired shares every 30 minutes
const CLEANUP_INTERVAL = 30 * 60 * 1000;
const SHARE_TTL = 24 * 60 * 60 * 1000; // 24 hours

setInterval(async () => {
  const now = Date.now();
  for (const [id, share] of fileShares.entries()) {
    if (now >= share.expiresAt) {
      fileShares.delete(id);
      try {
        const dir = path.dirname(share.storedPath);
        await fs.rm(dir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}, CLEANUP_INTERVAL);

export const fileshareRoutes: FastifyPluginAsync = async (fastify) => {
  const uploadDir = process.env.UPLOAD_DIR ?? "./uploads";

  // Upload a file for temporary sharing
  fastify.post(
    "/upload",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Upload a file for temporary sharing to a kiosk display",
        tags: ["File Share"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        consumes: ["multipart/form-data"],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        return reply.unauthorized("User not found");
      }

      const data = await request.file();
      if (!data) {
        return reply.badRequest("No file uploaded");
      }

      const mimeType = data.mimetype;
      const isImage = ACCEPTED_IMAGE_TYPES.has(mimeType);
      const isPdf = mimeType === ACCEPTED_PDF_TYPE;

      if (!isImage && !isPdf) {
        return reply.unsupportedMediaType(
          "Only images (JPEG, PNG, GIF, WebP) and PDFs are supported"
        );
      }

      const buffer = await data.toBuffer();
      const shareId = randomUUID();
      const fileType: "image" | "pdf" = isPdf ? "pdf" : "image";

      // Extract PDF page count
      let pageCount: number | undefined;
      if (isPdf) {
        try {
          const pdfDoc = await PDFDocument.load(buffer);
          pageCount = pdfDoc.getPageCount();
        } catch {
          return reply.badRequest("Could not parse PDF file");
        }
      }

      // Store file on disk
      const shareDir = path.join(uploadDir, "fileshare", shareId);
      await fs.mkdir(shareDir, { recursive: true });

      const safeFilename = data.filename?.replace(/[^a-zA-Z0-9._-]/g, "_") || `file.${isPdf ? "pdf" : "bin"}`;
      const storedPath = path.join(shareDir, safeFilename);
      await fs.writeFile(storedPath, buffer);

      const now = Date.now();
      const record: FileShareRecord = {
        id: shareId,
        userId: user.id,
        originalName: data.filename || safeFilename,
        storedPath,
        mimeType,
        fileType,
        pageCount,
        createdAt: now,
        expiresAt: now + SHARE_TTL,
      };
      fileShares.set(shareId, record);

      fastify.log.info(`File share created: ${shareId} (${fileType}, ${buffer.length} bytes)`);

      return {
        success: true,
        data: {
          shareId,
          fileType,
          pageCount,
          mimeType,
          originalName: record.originalName,
        },
      };
    }
  );

  // Serve a shared file (public — UUID is the secret)
  fastify.get(
    "/:shareId/file",
    {
      schema: {
        description: "Serve a temporarily shared file (public, share ID is the secret)",
        tags: ["File Share"],
        params: {
          type: "object",
          properties: {
            shareId: { type: "string", format: "uuid" },
          },
          required: ["shareId"],
        },
      },
    },
    async (request, reply) => {
      const { shareId } = request.params as { shareId: string };
      const share = fileShares.get(shareId);

      if (!share || Date.now() >= share.expiresAt) {
        if (share) fileShares.delete(shareId);
        return reply.notFound("Share not found or expired");
      }

      const stream = createReadStream(share.storedPath);
      return reply
        .header("Content-Type", share.mimeType)
        .header("Cache-Control", "no-store")
        .header("Content-Disposition", `inline; filename="${share.originalName}"`)
        .send(stream);
    }
  );

  // Delete a share (authenticated, owner only)
  fastify.delete(
    "/:shareId",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Delete a temporary file share",
        tags: ["File Share"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: {
            shareId: { type: "string", format: "uuid" },
          },
          required: ["shareId"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        return reply.unauthorized("User not found");
      }

      const { shareId } = request.params as { shareId: string };
      const share = fileShares.get(shareId);

      if (!share) {
        return reply.notFound("Share not found");
      }

      if (share.userId !== user.id) {
        return reply.forbidden("Not your share");
      }

      // Remove from memory and disk
      fileShares.delete(shareId);
      try {
        const dir = path.dirname(share.storedPath);
        await fs.rm(dir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }

      fastify.log.info(`File share deleted: ${shareId}`);

      return { success: true };
    }
  );
};
