import type { FastifyPluginAsync } from "fastify";
import { eq, and } from "drizzle-orm";
import { photoAlbums, photos, oauthTokens } from "@openframe/database/schema";

// Upload token type
export interface UploadTokenData {
  userId: string;
  albumId: string;
  createdAt: Date;
  expiresAt: Date;
}

// Extend Fastify with upload tokens
declare module "fastify" {
  interface FastifyInstance {
    uploadTokens: Map<string, UploadTokenData>;
  }
}
import { createAlbumSchema, updateAlbumSchema } from "@openframe/shared/validators";
import { getCurrentUser } from "../../plugins/auth.js";
import { processImage } from "../../services/photos/processor.js";
import {
  createPickerSession,
  getPickerSession,
  listPickedMediaItems,
  deletePickerSession,
  getPhotoUrl,
  getAccessToken,
  setGoogleOAuthCredentials,
} from "../../services/google-photos.js";
import { fetchSubredditPhotos } from "../../services/reddit-photos.js";
import { getCategorySettings } from "../settings/index.js";
import { randomUUID } from "crypto";
import { mkdir, unlink, stat } from "fs/promises";
import { createReadStream } from "fs";
import path, { join } from "path";

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };
  return mimeTypes[ext] ?? "application/octet-stream";
}

export const photoRoutes: FastifyPluginAsync = async (fastify) => {
  const uploadDir = process.env.UPLOAD_DIR ?? "./uploads";

  // Set Google OAuth credentials from DB for the google-photos service
  const googleSettings = await getCategorySettings(fastify.db, "google");
  if (googleSettings.client_id || googleSettings.client_secret) {
    setGoogleOAuthCredentials({
      clientId: googleSettings.client_id || undefined,
      clientSecret: googleSettings.client_secret || undefined,
    });
  }

  // List albums
  fastify.get(
    "/albums",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "List all photo albums",
        tags: ["Photos"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const albums = await fastify.db
        .select()
        .from(photoAlbums)
        .where(eq(photoAlbums.userId, user.id));

      // Get photo counts
      const albumsWithCounts = await Promise.all(
        albums.map(async (album) => {
          const albumPhotos = await fastify.db
            .select()
            .from(photos)
            .where(eq(photos.albumId, album.id));

          return {
            ...album,
            photoCount: albumPhotos.length,
          };
        })
      );

      return {
        success: true,
        data: albumsWithCounts,
      };
    }
  );

  // Create album
  fastify.post(
    "/albums",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Create a new photo album",
        tags: ["Photos"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            slideshowInterval: { type: "number" },
          },
          required: ["name"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const input = createAlbumSchema.parse(request.body);

      const [album] = await fastify.db
        .insert(photoAlbums)
        .values({
          userId: user.id,
          name: input.name,
          description: input.description,
          slideshowInterval: input.slideshowInterval,
        })
        .returning();

      return reply.status(201).send({
        success: true,
        data: album,
      });
    }
  );

  // Update album
  fastify.patch(
    "/albums/:id",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Update album settings",
        tags: ["Photos"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id } = request.params as { id: string };
      const input = updateAlbumSchema.parse(request.body);

      const [album] = await fastify.db
        .update(photoAlbums)
        .set({ ...input, updatedAt: new Date() })
        .where(
          and(eq(photoAlbums.id, id), eq(photoAlbums.userId, user.id))
        )
        .returning();

      if (!album) {
        return reply.notFound("Album not found");
      }

      return {
        success: true,
        data: album,
      };
    }
  );

  // Delete album
  fastify.delete(
    "/albums/:id",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Delete an album and all its photos",
        tags: ["Photos"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id } = request.params as { id: string };

      const [album] = await fastify.db
        .select()
        .from(photoAlbums)
        .where(
          and(eq(photoAlbums.id, id), eq(photoAlbums.userId, user.id))
        )
        .limit(1);

      if (!album) {
        return reply.notFound("Album not found");
      }

      // Delete associated photos from disk
      const albumPhotos = await fastify.db
        .select()
        .from(photos)
        .where(eq(photos.albumId, id));

      for (const photo of albumPhotos) {
        try {
          await unlink(join(uploadDir, photo.originalPath));
          if (photo.thumbnailPath) {
            await unlink(join(uploadDir, photo.thumbnailPath));
          }
          if (photo.mediumPath) {
            await unlink(join(uploadDir, photo.mediumPath));
          }
        } catch {
          // Ignore file deletion errors
        }
      }

      // Delete from database (cascade will delete photos)
      await fastify.db.delete(photoAlbums).where(eq(photoAlbums.id, id));

      return { success: true };
    }
  );

  // Get album photos
  fastify.get(
    "/albums/:id/photos",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get photos in an album",
        tags: ["Photos"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id } = request.params as { id: string };

      const [album] = await fastify.db
        .select()
        .from(photoAlbums)
        .where(
          and(eq(photoAlbums.id, id), eq(photoAlbums.userId, user.id))
        )
        .limit(1);

      if (!album) {
        return reply.notFound("Album not found");
      }

      const albumPhotos = await fastify.db
        .select()
        .from(photos)
        .where(eq(photos.albumId, id))
        .orderBy(photos.sortOrder);

      // Convert paths to URLs (normalize path separators to forward slashes)
      const photosWithUrls = albumPhotos.map((photo) => ({
        id: photo.id,
        filename: photo.filename,
        originalFilename: photo.originalFilename,
        mimeType: photo.mimeType,
        width: photo.width,
        height: photo.height,
        thumbnailUrl: photo.thumbnailPath
          ? `/api/v1/photos/files/${photo.thumbnailPath.replace(/\\/g, "/")}`
          : null,
        mediumUrl: photo.mediumPath
          ? `/api/v1/photos/files/${photo.mediumPath.replace(/\\/g, "/")}`
          : null,
        originalUrl: `/api/v1/photos/files/${photo.originalPath.replace(/\\/g, "/")}`,
        takenAt: photo.takenAt,
        sortOrder: photo.sortOrder,
        sourceType: photo.sourceType,
        externalId: photo.externalId,
      }));

      return {
        success: true,
        data: photosWithUrls,
      };
    }
  );

  // Upload photo
  fastify.post(
    "/albums/:id/photos",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Upload a photo to an album",
        tags: ["Photos"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
        consumes: ["multipart/form-data"],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id: albumId } = request.params as { id: string };

      const [album] = await fastify.db
        .select()
        .from(photoAlbums)
        .where(
          and(eq(photoAlbums.id, albumId), eq(photoAlbums.userId, user.id))
        )
        .limit(1);

      if (!album) {
        return reply.notFound("Album not found");
      }

      const data = await request.file();
      if (!data) {
        return reply.badRequest("No file uploaded");
      }

      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!allowedTypes.includes(data.mimetype)) {
        return reply.badRequest("Invalid file type. Allowed: JPEG, PNG, WebP, GIF");
      }

      // Create upload directories
      const userDir = join(uploadDir, user.id);
      await mkdir(userDir, { recursive: true });
      await mkdir(join(userDir, "thumbnails"), { recursive: true });
      await mkdir(join(userDir, "medium"), { recursive: true });
      await mkdir(join(userDir, "original"), { recursive: true });

      // Generate unique filename
      const fileId = randomUUID();
      const ext = data.filename.split(".").pop() ?? "jpg";
      const filename = `${fileId}.${ext}`;

      // Process and save image
      const buffer = await data.toBuffer();
      const result = await processImage(buffer, {
        userDir,
        filename,
        generateThumbnail: true,
        generateMedium: true,
      });

      // Get next sort order
      const existingPhotos = await fastify.db
        .select()
        .from(photos)
        .where(eq(photos.albumId, albumId));
      const maxOrder = Math.max(0, ...existingPhotos.map((p) => p.sortOrder));

      // Save to database (prefix paths with user.id for file serving)
      const [photo] = await fastify.db
        .insert(photos)
        .values({
          albumId,
          filename,
          originalFilename: data.filename,
          mimeType: data.mimetype,
          width: result.width,
          height: result.height,
          size: buffer.length,
          thumbnailPath: result.thumbnailPath ? join(user.id, result.thumbnailPath) : null,
          mediumPath: result.mediumPath ? join(user.id, result.mediumPath) : null,
          originalPath: join(user.id, result.originalPath),
          metadata: result.metadata,
          sortOrder: maxOrder + 1,
          sourceType: "local",
        })
        .returning();

      return reply.status(201).send({
        success: true,
        data: {
          id: photo!.id,
          filename: photo!.filename,
          originalFilename: photo!.originalFilename,
          width: photo!.width,
          height: photo!.height,
        },
      });
    }
  );

  // Delete photo
  fastify.delete(
    "/:id",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Delete a photo",
        tags: ["Photos"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id } = request.params as { id: string };

      const [photo] = await fastify.db
        .select()
        .from(photos)
        .where(eq(photos.id, id))
        .limit(1);

      if (!photo) {
        return reply.notFound("Photo not found");
      }

      // Verify ownership
      const [album] = await fastify.db
        .select()
        .from(photoAlbums)
        .where(
          and(
            eq(photoAlbums.id, photo.albumId),
            eq(photoAlbums.userId, user.id)
          )
        )
        .limit(1);

      if (!album) {
        return reply.notFound("Photo not found");
      }

      // Delete files
      try {
        await unlink(join(uploadDir, photo.originalPath));
        if (photo.thumbnailPath) {
          await unlink(join(uploadDir, photo.thumbnailPath));
        }
        if (photo.mediumPath) {
          await unlink(join(uploadDir, photo.mediumPath));
        }
      } catch {
        // Ignore file deletion errors
      }

      await fastify.db.delete(photos).where(eq(photos.id, id));

      return { success: true };
    }
  );

  // Update photo (replace with edited version)
  fastify.put(
    "/:id",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Update a photo (replace with edited version)",
        tags: ["Photos"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        consumes: ["multipart/form-data"],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id } = request.params as { id: string };

      // Find existing photo
      const [existingPhoto] = await fastify.db
        .select()
        .from(photos)
        .where(eq(photos.id, id))
        .limit(1);

      if (!existingPhoto) {
        return reply.notFound("Photo not found");
      }

      // Verify ownership
      const [album] = await fastify.db
        .select()
        .from(photoAlbums)
        .where(
          and(
            eq(photoAlbums.id, existingPhoto.albumId),
            eq(photoAlbums.userId, user.id)
          )
        )
        .limit(1);

      if (!album) {
        return reply.notFound("Photo not found");
      }

      // Get uploaded file
      const data = await request.file();
      if (!data) {
        return reply.badRequest("No file uploaded");
      }

      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!allowedTypes.includes(data.mimetype)) {
        return reply.badRequest("Invalid file type. Allowed: JPEG, PNG, WebP, GIF");
      }

      // Process new image
      const userDir = join(uploadDir, user.id);
      const filename = `${randomUUID()}.jpg`;
      const buffer = await data.toBuffer();

      const result = await processImage(buffer, {
        userDir,
        filename,
        generateThumbnail: true,
        generateMedium: true,
      });

      // Delete old files
      try {
        await unlink(join(uploadDir, existingPhoto.originalPath));
        if (existingPhoto.thumbnailPath) {
          await unlink(join(uploadDir, existingPhoto.thumbnailPath));
        }
        if (existingPhoto.mediumPath) {
          await unlink(join(uploadDir, existingPhoto.mediumPath));
        }
      } catch {
        // Ignore file deletion errors
      }

      // Update database
      const [updatedPhoto] = await fastify.db
        .update(photos)
        .set({
          filename,
          mimeType: "image/jpeg",
          width: result.width,
          height: result.height,
          size: buffer.length,
          thumbnailPath: result.thumbnailPath ? join(user.id, result.thumbnailPath) : null,
          mediumPath: result.mediumPath ? join(user.id, result.mediumPath) : null,
          originalPath: join(user.id, result.originalPath),
        })
        .where(eq(photos.id, id))
        .returning();

      return {
        success: true,
        data: {
          id: updatedPhoto!.id,
          filename: updatedPhoto!.filename,
          width: updatedPhoto!.width,
          height: updatedPhoto!.height,
        },
      };
    }
  );

  // Create a Google Photos Picker session
  fastify.post(
    "/google/picker/session",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Create a Google Photos Picker session. Returns a pickerUri to open for user selection.",
        tags: ["Photos", "Google"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const [token] = await fastify.db
        .select()
        .from(oauthTokens)
        .where(
          and(eq(oauthTokens.userId, user.id), eq(oauthTokens.provider, "google"))
        )
        .limit(1);

      if (!token) {
        return reply.badRequest("Google account not connected");
      }

      const hasPickerScope = token.scope?.includes("photospicker");
      if (!hasPickerScope) {
        return reply.code(403).send({
          success: false,
          error: {
            code: "MISSING_SCOPE",
            message: "Google Photos Picker access not granted. Please reconnect your Google account.",
          },
        });
      }

      try {
        const session = await createPickerSession(token);
        return {
          success: true,
          data: {
            sessionId: session.id,
            pickerUri: session.pickerUri,
            pollInterval: parseInt(session.pollingConfig.pollInterval.replace("s", ""), 10) * 1000,
            timeout: parseInt(session.pollingConfig.timeoutIn.replace("s", ""), 10) * 1000,
          },
        };
      } catch (error) {
        console.error("Failed to create picker session:", error);
        return reply.internalServerError("Failed to create Google Photos picker session");
      }
    }
  );

  // Get Picker session status (for polling)
  fastify.get(
    "/google/picker/session/:sessionId",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Get the status of a Google Photos Picker session. Poll until mediaItemsSet is true.",
        tags: ["Photos", "Google"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            sessionId: { type: "string" },
          },
          required: ["sessionId"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { sessionId } = request.params as { sessionId: string };

      const [token] = await fastify.db
        .select()
        .from(oauthTokens)
        .where(
          and(eq(oauthTokens.userId, user.id), eq(oauthTokens.provider, "google"))
        )
        .limit(1);

      if (!token) {
        return reply.badRequest("Google account not connected");
      }

      try {
        const session = await getPickerSession(token, sessionId);
        return {
          success: true,
          data: {
            sessionId: session.id,
            mediaItemsSet: session.mediaItemsSet ?? false,
          },
        };
      } catch (error) {
        console.error("Failed to get picker session:", error);
        return reply.internalServerError("Failed to get picker session status");
      }
    }
  );

  // Get photos from a completed Picker session
  fastify.get(
    "/google/picker/session/:sessionId/photos",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Get the photos selected in a completed Picker session",
        tags: ["Photos", "Google"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            sessionId: { type: "string" },
          },
          required: ["sessionId"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { sessionId } = request.params as { sessionId: string };

      const [token] = await fastify.db
        .select()
        .from(oauthTokens)
        .where(
          and(eq(oauthTokens.userId, user.id), eq(oauthTokens.provider, "google"))
        )
        .limit(1);

      if (!token) {
        return reply.badRequest("Google account not connected");
      }

      try {
        const mediaItems = await listPickedMediaItems(token, sessionId);
        return {
          success: true,
          data: mediaItems.map((item) => ({
            id: item.id,
            url: getPhotoUrl(item.mediaFile.baseUrl, 1920, 1080),
            mimeType: item.mediaFile.mimeType,
            filename: item.mediaFile.filename,
          })),
        };
      } catch (error) {
        console.error("Failed to get picked photos:", error);
        return reply.internalServerError("Failed to get selected photos");
      }
    }
  );

  // Delete a Picker session (cleanup)
  fastify.delete(
    "/google/picker/session/:sessionId",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Delete a Picker session (cleanup)",
        tags: ["Photos", "Google"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            sessionId: { type: "string" },
          },
          required: ["sessionId"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { sessionId } = request.params as { sessionId: string };

      const [token] = await fastify.db
        .select()
        .from(oauthTokens)
        .where(
          and(eq(oauthTokens.userId, user.id), eq(oauthTokens.provider, "google"))
        )
        .limit(1);

      if (!token) {
        return reply.badRequest("Google account not connected");
      }

      try {
        await deletePickerSession(token, sessionId);
        return { success: true };
      } catch (error) {
        console.error("Failed to delete picker session:", error);
        return { success: true }; // Don't fail on cleanup errors
      }
    }
  );

  // Check if Google Photos Picker is connected
  fastify.get(
    "/google/picker/status",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Check if Google Photos Picker is available",
        tags: ["Photos", "Google"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const [token] = await fastify.db
        .select()
        .from(oauthTokens)
        .where(
          and(eq(oauthTokens.userId, user.id), eq(oauthTokens.provider, "google"))
        )
        .limit(1);

      if (!token) {
        return {
          success: true,
          data: { connected: false, reason: "No Google account connected" },
        };
      }

      const hasPickerScope = token.scope?.includes("photospicker");
      return {
        success: true,
        data: {
          connected: hasPickerScope,
          reason: hasPickerScope ? null : "Google Photos Picker scope not granted. Please reconnect.",
        },
      };
    }
  );

  // Import photos from Google Photos (download and save locally)
  fastify.post(
    "/albums/:id/import/google",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Import photos from Google Photos picker session and save locally",
        tags: ["Photos", "Google"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            sessionId: { type: "string" },
          },
          required: ["sessionId"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id: albumId } = request.params as { id: string };
      const { sessionId } = request.body as { sessionId: string };

      // Verify album ownership
      const [album] = await fastify.db
        .select()
        .from(photoAlbums)
        .where(
          and(eq(photoAlbums.id, albumId), eq(photoAlbums.userId, user.id))
        )
        .limit(1);

      if (!album) {
        return reply.notFound("Album not found");
      }

      // Get Google token
      const [token] = await fastify.db
        .select()
        .from(oauthTokens)
        .where(
          and(eq(oauthTokens.userId, user.id), eq(oauthTokens.provider, "google"))
        )
        .limit(1);

      if (!token) {
        return reply.badRequest("Google account not connected");
      }

      // Get photos from picker session
      let mediaItems;
      try {
        console.log(`Fetching media items for session: ${sessionId}`);
        mediaItems = await listPickedMediaItems(token, sessionId);
        console.log(`Found ${mediaItems.length} media items to import`);
      } catch (error) {
        console.error("Failed to get picked media items:", error);
        return reply.internalServerError("Failed to get photos from Google Photos");
      }

      if (mediaItems.length === 0) {
        console.log("No media items found in picker session");
        return {
          success: true,
          data: { imported: 0, skipped: 0 },
        };
      }

      // Create upload directories
      const userDir = join(uploadDir, user.id);
      await mkdir(userDir, { recursive: true });
      await mkdir(join(userDir, "thumbnails"), { recursive: true });
      await mkdir(join(userDir, "medium"), { recursive: true });
      await mkdir(join(userDir, "original"), { recursive: true });

      // Get existing photo external IDs to check for duplicates
      const existingPhotos = await fastify.db
        .select({ externalId: photos.externalId })
        .from(photos)
        .where(
          and(
            eq(photos.albumId, albumId),
            eq(photos.sourceType, "google")
          )
        );
      const existingIds = new Set(existingPhotos.map(p => p.externalId));

      // Get max sort order
      const allPhotos = await fastify.db
        .select({ sortOrder: photos.sortOrder })
        .from(photos)
        .where(eq(photos.albumId, albumId));
      let maxOrder = Math.max(0, ...allPhotos.map((p) => p.sortOrder));

      let imported = 0;
      let skipped = 0;

      // Get access token for downloading images
      let accessToken: string;
      try {
        accessToken = await getAccessToken(token);
      } catch (error) {
        console.error("Failed to get access token for download:", error);
        return reply.internalServerError("Failed to authenticate with Google Photos");
      }

      console.log(`Starting import of ${mediaItems.length} photos`);

      for (const item of mediaItems) {
        // Skip if already imported
        if (existingIds.has(item.id)) {
          console.log(`Skipping duplicate: ${item.id}`);
          skipped++;
          continue;
        }

        try {
          // Download the image from Google Photos
          // The baseUrl needs size parameters and =d for download
          // Try with download parameter first, then fallback to regular size params
          const downloadUrl = `${item.mediaFile.baseUrl}=d`;
          console.log(`Downloading: ${item.mediaFile.filename} from ${downloadUrl.substring(0, 100)}...`);

          let response = await fetch(downloadUrl, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

          // If download param fails, try with size parameters
          if (!response.ok) {
            console.log(`Download with =d failed (${response.status}), trying with size params...`);
            const sizedUrl = getPhotoUrl(item.mediaFile.baseUrl, 2048, 1536);
            response = await fetch(sizedUrl, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            });
          }

          if (!response.ok) {
            console.error(`Failed to download image ${item.id}: ${response.status} ${response.statusText}`);
            skipped++;
            continue;
          }

          const buffer = Buffer.from(await response.arrayBuffer());

          // Generate unique filename
          const fileId = randomUUID();
          const ext = item.mediaFile.filename.split(".").pop() ?? "jpg";
          const filename = `${fileId}.${ext}`;

          // Process and save image
          const result = await processImage(buffer, {
            userDir,
            filename,
            generateThumbnail: true,
            generateMedium: true,
          });

          maxOrder++;

          // Save to database with source tracking (prefix paths with user.id for file serving)
          await fastify.db
            .insert(photos)
            .values({
              albumId,
              filename,
              originalFilename: item.mediaFile.filename,
              mimeType: item.mediaFile.mimeType,
              width: result.width,
              height: result.height,
              size: buffer.length,
              thumbnailPath: result.thumbnailPath ? join(user.id, result.thumbnailPath) : null,
              mediumPath: result.mediumPath ? join(user.id, result.mediumPath) : null,
              originalPath: join(user.id, result.originalPath),
              metadata: result.metadata,
              sortOrder: maxOrder,
              sourceType: "google",
              externalId: item.id,
            });

          imported++;
          console.log(`Successfully imported: ${item.mediaFile.filename}`);
        } catch (error) {
          console.error(`Failed to import photo ${item.id}:`, error);
          skipped++;
        }
      }

      console.log(`Import complete: ${imported} imported, ${skipped} skipped`);

      // Clean up the picker session
      try {
        await deletePickerSession(token, sessionId);
      } catch {
        // Ignore cleanup errors
      }

      return {
        success: true,
        data: { imported, skipped },
      };
    }
  );

  // GET /files/* - Serve photo files
  fastify.get(
    "/files/*",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Serve uploaded photo files",
        tags: ["Photos"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
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

      // Check if file exists
      try {
        await stat(fullPath);
      } catch {
        return reply.notFound("File not found");
      }

      const stream = createReadStream(fullPath);
      const mimeType = getMimeType(normalizedPath);

      return reply
        .header("Content-Type", mimeType)
        .header("Cache-Control", "public, max-age=31536000")
        .send(stream);
    }
  );

  // Proxy Google Photos images (solves CORS and auth issues)
  fastify.get(
    "/google/proxy",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Proxy a Google Photos image",
        tags: ["Photos", "Google"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        querystring: {
          type: "object",
          properties: {
            url: { type: "string" },
          },
          required: ["url"],
        },
      },
    },
    async (request, reply) => {
      const { url } = request.query as { url: string };

      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return reply.badRequest("Invalid Google Photos URL");
      }
      if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".googleusercontent.com")) {
        return reply.badRequest("Invalid Google Photos URL");
      }

      try {
        const response = await fetch(url);
        if (!response.ok) {
          return reply.status(response.status).send("Failed to fetch image");
        }

        const contentType = response.headers.get("content-type") ?? "image/jpeg";
        const buffer = await response.arrayBuffer();

        return reply
          .header("Content-Type", contentType)
          .header("Cache-Control", "public, max-age=3600")
          .send(Buffer.from(buffer));
      } catch (error) {
        console.error("Failed to proxy Google Photos image:", error);
        return reply.internalServerError("Failed to fetch image");
      }
    }
  );

  // Get photos from a Reddit subreddit
  fastify.get(
    "/reddit/:subreddit",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get photos from a Reddit subreddit",
        tags: ["Photos", "Reddit"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: {
            subreddit: { type: "string" },
          },
          required: ["subreddit"],
        },
        querystring: {
          type: "object",
          properties: {
            limit: { type: "number", default: 50, minimum: 1, maximum: 100 },
            orientation: { type: "string", enum: ["all", "landscape", "portrait"], default: "all" },
            sort: { type: "string", enum: ["hot", "new", "top"], default: "hot" },
            time: { type: "string", enum: ["hour", "day", "week", "month", "year", "all"], default: "week" },
          },
        },
      },
    },
    async (request, reply) => {
      const { subreddit } = request.params as { subreddit: string };
      const { limit = 50, orientation = "all", sort = "hot", time = "week" } = request.query as {
        limit?: number;
        orientation?: "all" | "landscape" | "portrait";
        sort?: "hot" | "new" | "top";
        time?: "hour" | "day" | "week" | "month" | "year" | "all";
      };

      // Validate subreddit name (alphanumeric and underscore only)
      if (!/^[a-zA-Z0-9_]+$/.test(subreddit)) {
        return reply.badRequest("Invalid subreddit name");
      }

      try {
        const photos = await fetchSubredditPhotos(subreddit, {
          limit,
          orientation,
          sort,
          time,
        });

        return {
          success: true,
          data: {
            photos,
            subreddit,
          },
        };
      } catch (error) {
        console.error(`Failed to fetch photos from r/${subreddit}:`, error);
        return reply.internalServerError("Failed to fetch Reddit photos");
      }
    }
  );

  // Get active slideshow - returns local photos from active albums or specific album
  fastify.get(
    "/slideshow",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get photos for slideshow from active local albums",
        tags: ["Photos"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        querystring: {
          type: "object",
          properties: {
            albumId: { type: "string", format: "uuid", description: "Optional specific album ID" },
            orientation: {
              type: "string",
              enum: ["all", "landscape", "portrait"],
              default: "all",
              description: "Filter photos by orientation"
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { albumId, orientation = "all" } = request.query as { albumId?: string; orientation?: string };

      let targetAlbums;

      if (albumId) {
        // Get specific album
        const [album] = await fastify.db
          .select()
          .from(photoAlbums)
          .where(
            and(
              eq(photoAlbums.id, albumId),
              eq(photoAlbums.userId, user.id)
            )
          )
          .limit(1);

        if (!album) {
          return reply.notFound("Album not found");
        }
        targetAlbums = [album];
      } else {
        // Get all active albums
        targetAlbums = await fastify.db
          .select()
          .from(photoAlbums)
          .where(
            and(
              eq(photoAlbums.userId, user.id),
              eq(photoAlbums.isActive, true)
            )
          );
      }

      if (targetAlbums.length === 0) {
        return {
          success: true,
          data: {
            photos: [],
            interval: 30,
          },
        };
      }

      // Get photos from all target albums
      const allPhotos = [];
      for (const album of targetAlbums) {
        const albumPhotos = await fastify.db
          .select()
          .from(photos)
          .where(eq(photos.albumId, album.id));
        allPhotos.push(...albumPhotos);
      }

      // Filter by orientation
      let filteredPhotos = allPhotos;
      if (orientation === "landscape") {
        filteredPhotos = allPhotos.filter((p) => p.width && p.height && p.width > p.height);
      } else if (orientation === "portrait") {
        filteredPhotos = allPhotos.filter((p) => p.width && p.height && p.height > p.width);
      }

      // Shuffle photos
      const shuffled = filteredPhotos.sort(() => Math.random() - 0.5);

      return {
        success: true,
        data: {
          photos: shuffled.map((photo) => ({
            id: photo.id,
            // Normalize path separators to forward slashes for URLs
            url: `/api/v1/photos/files/${(photo.mediumPath ?? photo.originalPath).replace(/\\/g, "/")}`,
            width: photo.width,
            height: photo.height,
          })),
          interval: targetAlbums[0]?.slideshowInterval ?? 30,
        },
      };
    }
  );

  // ==================== TEMPORARY UPLOAD TOKENS ====================

  // Upload tokens Map is shared across routes (initialized in app.ts via decorate)
  const uploadTokens = fastify.uploadTokens;

  // Clean up expired tokens periodically
  setInterval(() => {
    const now = new Date();
    for (const [token, data] of uploadTokens.entries()) {
      if (data.expiresAt < now) {
        uploadTokens.delete(token);
      }
    }
  }, 60000); // Clean every minute

  // Generate temporary upload token
  fastify.post(
    "/albums/:id/upload-token",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Generate a temporary upload token for mobile uploads",
        tags: ["Photos"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id: albumId } = request.params as { id: string };

      // Verify album exists and belongs to user
      const [album] = await fastify.db
        .select()
        .from(photoAlbums)
        .where(
          and(
            eq(photoAlbums.id, albumId),
            eq(photoAlbums.userId, user.id)
          )
        )
        .limit(1);

      if (!album) {
        return reply.notFound("Album not found");
      }

      // Generate token (valid for 30 minutes)
      const token = randomUUID();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);

      uploadTokens.set(token, {
        userId: user.id,
        albumId,
        createdAt: now,
        expiresAt,
      });

      return {
        success: true,
        data: {
          token,
          expiresAt: expiresAt.toISOString(),
          albumName: album.name,
        },
      };
    }
  );

  // Revoke upload token
  fastify.delete(
    "/upload-token/:token",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Revoke a temporary upload token",
        tags: ["Photos"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            token: { type: "string" },
          },
          required: ["token"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { token } = request.params as { token: string };

      const tokenData = uploadTokens.get(token);
      if (!tokenData || tokenData.userId !== user.id) {
        return reply.notFound("Token not found");
      }

      uploadTokens.delete(token);

      return { success: true };
    }
  );

  // Get upload token info (public - for upload page)
  fastify.get(
    "/upload-token/:token",
    {
      schema: {
        description: "Get upload token info (public)",
        tags: ["Photos"],
        params: {
          type: "object",
          properties: {
            token: { type: "string" },
          },
          required: ["token"],
        },
      },
    },
    async (request, reply) => {
      const { token } = request.params as { token: string };

      const tokenData = uploadTokens.get(token);
      if (!tokenData) {
        return reply.notFound("Token not found or expired");
      }

      if (tokenData.expiresAt < new Date()) {
        uploadTokens.delete(token);
        return reply.notFound("Token expired");
      }

      // Get album name
      const [album] = await fastify.db
        .select()
        .from(photoAlbums)
        .where(eq(photoAlbums.id, tokenData.albumId))
        .limit(1);

      return {
        success: true,
        data: {
          albumName: album?.name ?? "Unknown Album",
          expiresAt: tokenData.expiresAt.toISOString(),
        },
      };
    }
  );

  // Public upload endpoint (using temporary token)
  fastify.post(
    "/upload-public/:token",
    {
      schema: {
        description: "Upload photo using temporary token (public, no auth required)",
        tags: ["Photos"],
        params: {
          type: "object",
          properties: {
            token: { type: "string" },
          },
          required: ["token"],
        },
        consumes: ["multipart/form-data"],
      },
    },
    async (request, reply) => {
      const { token } = request.params as { token: string };

      // Validate token
      const tokenData = uploadTokens.get(token);
      if (!tokenData) {
        return reply.unauthorized("Invalid or expired upload token");
      }

      if (tokenData.expiresAt < new Date()) {
        uploadTokens.delete(token);
        return reply.unauthorized("Upload token expired");
      }

      const data = await request.file();
      if (!data) {
        return reply.badRequest("No file uploaded");
      }

      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!allowedTypes.includes(data.mimetype)) {
        return reply.badRequest("Invalid file type. Allowed: JPEG, PNG, WebP, GIF");
      }

      // Create upload directories
      const userDir = join(uploadDir, tokenData.userId);
      await mkdir(userDir, { recursive: true });
      await mkdir(join(userDir, "thumbnails"), { recursive: true });
      await mkdir(join(userDir, "medium"), { recursive: true });

      // Generate unique filename
      const ext = path.extname(data.filename);
      const uniqueName = `${randomUUID()}${ext}`;
      const originalPath = join(tokenData.userId, uniqueName);

      // Process image (saves original and creates thumbnails)
      const buffer = await data.toBuffer();
      const { width, height, thumbnailPath, mediumPath } = await processImage(
        buffer,
        {
          userDir: join(uploadDir, tokenData.userId),
          filename: uniqueName,
          generateThumbnail: true,
          generateMedium: true,
        }
      );

      // Save to database (prefix paths with userId for file serving, like authenticated upload)
      const [photo] = await fastify.db
        .insert(photos)
        .values({
          albumId: tokenData.albumId,
          filename: uniqueName,
          originalFilename: data.filename,
          originalPath: join(tokenData.userId, uniqueName),
          thumbnailPath: thumbnailPath ? join(tokenData.userId, thumbnailPath) : null,
          mediumPath: mediumPath ? join(tokenData.userId, mediumPath) : null,
          width,
          height,
          mimeType: data.mimetype,
          size: buffer.length,
        })
        .returning();

      return {
        success: true,
        data: {
          id: photo!.id,
          filename: photo!.filename,
        },
      };
    }
  );
};
