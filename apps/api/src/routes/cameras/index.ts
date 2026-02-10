import type { FastifyPluginAsync } from "fastify";
import { eq, and, asc } from "drizzle-orm";
import { cameras, systemSettings } from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";
import { mediamtx, MediaMTXService } from "../../services/mediamtx.js";

export const cameraRoutes: FastifyPluginAsync = async (fastify) => {
  // List cameras
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "List all cameras",
        tags: ["Cameras"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const userCameras = await fastify.db
        .select()
        .from(cameras)
        .where(eq(cameras.userId, user.id))
        .orderBy(asc(cameras.sortOrder));

      // Don't expose passwords in the response
      return {
        success: true,
        data: userCameras.map((cam) => ({
          id: cam.id,
          userId: cam.userId,
          name: cam.name,
          rtspUrl: cam.rtspUrl,
          mjpegUrl: cam.mjpegUrl,
          snapshotUrl: cam.snapshotUrl,
          username: cam.username,
          hasPassword: !!cam.password,
          isEnabled: cam.isEnabled,
          sortOrder: cam.sortOrder,
          settings: cam.settings,
          createdAt: cam.createdAt,
          updatedAt: cam.updatedAt,
        })),
      };
    }
  );

  // Get single camera
  fastify.get(
    "/:id",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get a camera by ID",
        tags: ["Cameras"],
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

      const [camera] = await fastify.db
        .select()
        .from(cameras)
        .where(and(eq(cameras.id, id), eq(cameras.userId, user.id)))
        .limit(1);

      if (!camera) {
        return reply.notFound("Camera not found");
      }

      return {
        success: true,
        data: {
          id: camera.id,
          userId: camera.userId,
          name: camera.name,
          rtspUrl: camera.rtspUrl,
          mjpegUrl: camera.mjpegUrl,
          snapshotUrl: camera.snapshotUrl,
          username: camera.username,
          hasPassword: !!camera.password,
          isEnabled: camera.isEnabled,
          sortOrder: camera.sortOrder,
          settings: camera.settings,
          createdAt: camera.createdAt,
          updatedAt: camera.updatedAt,
        },
      };
    }
  );

  // Create camera
  fastify.post(
    "/",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Add a new camera",
        tags: ["Cameras"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            rtspUrl: { type: "string" },
            mjpegUrl: { type: "string" },
            snapshotUrl: { type: "string" },
            username: { type: "string" },
            password: { type: "string" },
            settings: {
              type: "object",
              properties: {
                refreshInterval: { type: "number" },
                aspectRatio: { type: "string", enum: ["16:9", "4:3", "1:1"] },
                showInDashboard: { type: "boolean" },
                isFavorite: { type: "boolean" },
              },
            },
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
      const body = request.body as {
        name: string;
        rtspUrl?: string;
        mjpegUrl?: string;
        snapshotUrl?: string;
        username?: string;
        password?: string;
        settings?: {
          refreshInterval?: number;
          aspectRatio?: "16:9" | "4:3" | "1:1";
          showInDashboard?: boolean;
          isFavorite?: boolean;
        };
      };

      // Get max sort order
      const existingCameras = await fastify.db
        .select({ sortOrder: cameras.sortOrder })
        .from(cameras)
        .where(eq(cameras.userId, user.id));
      const maxOrder = Math.max(0, ...existingCameras.map((c) => c.sortOrder));

      const [camera] = await fastify.db
        .insert(cameras)
        .values({
          userId: user.id,
          name: body.name,
          rtspUrl: body.rtspUrl || null,
          mjpegUrl: body.mjpegUrl || null,
          snapshotUrl: body.snapshotUrl || null,
          username: body.username || null,
          password: body.password || null,
          settings: body.settings || {},
          sortOrder: maxOrder + 1,
        })
        .returning();

      return reply.status(201).send({
        success: true,
        data: {
          id: camera!.id,
          userId: camera!.userId,
          name: camera!.name,
          rtspUrl: camera!.rtspUrl,
          mjpegUrl: camera!.mjpegUrl,
          snapshotUrl: camera!.snapshotUrl,
          username: camera!.username,
          hasPassword: !!camera!.password,
          isEnabled: camera!.isEnabled,
          sortOrder: camera!.sortOrder,
          settings: camera!.settings,
          createdAt: camera!.createdAt,
          updatedAt: camera!.updatedAt,
        },
      });
    }
  );

  // Update camera
  fastify.patch(
    "/:id",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Update a camera",
        tags: ["Cameras"],
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
            name: { type: "string" },
            rtspUrl: { type: "string", nullable: true },
            mjpegUrl: { type: "string", nullable: true },
            snapshotUrl: { type: "string", nullable: true },
            username: { type: "string", nullable: true },
            password: { type: "string", nullable: true },
            isEnabled: { type: "boolean" },
            sortOrder: { type: "number" },
            settings: {
              type: "object",
              properties: {
                refreshInterval: { type: "number" },
                aspectRatio: { type: "string", enum: ["16:9", "4:3", "1:1"] },
                showInDashboard: { type: "boolean" },
                isFavorite: { type: "boolean" },
              },
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
      const { id } = request.params as { id: string };
      const body = request.body as {
        name?: string;
        rtspUrl?: string | null;
        mjpegUrl?: string | null;
        snapshotUrl?: string | null;
        username?: string | null;
        password?: string | null;
        isEnabled?: boolean;
        sortOrder?: number;
        settings?: {
          refreshInterval?: number;
          aspectRatio?: "16:9" | "4:3" | "1:1";
          showInDashboard?: boolean;
          isFavorite?: boolean;
        };
      };

      // Verify ownership
      const [existing] = await fastify.db
        .select()
        .from(cameras)
        .where(and(eq(cameras.id, id), eq(cameras.userId, user.id)))
        .limit(1);

      if (!existing) {
        return reply.notFound("Camera not found");
      }

      const updates: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (body.name !== undefined) updates.name = body.name;
      if (body.rtspUrl !== undefined) updates.rtspUrl = body.rtspUrl;
      if (body.mjpegUrl !== undefined) updates.mjpegUrl = body.mjpegUrl;
      if (body.snapshotUrl !== undefined) updates.snapshotUrl = body.snapshotUrl;
      if (body.username !== undefined) updates.username = body.username;
      if (body.password !== undefined) updates.password = body.password;
      if (body.isEnabled !== undefined) updates.isEnabled = body.isEnabled;
      if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;
      if (body.settings !== undefined) {
        updates.settings = { ...existing.settings, ...body.settings };
      }

      const [camera] = await fastify.db
        .update(cameras)
        .set(updates)
        .where(eq(cameras.id, id))
        .returning();

      return {
        success: true,
        data: {
          id: camera!.id,
          userId: camera!.userId,
          name: camera!.name,
          rtspUrl: camera!.rtspUrl,
          mjpegUrl: camera!.mjpegUrl,
          snapshotUrl: camera!.snapshotUrl,
          username: camera!.username,
          hasPassword: !!camera!.password,
          isEnabled: camera!.isEnabled,
          sortOrder: camera!.sortOrder,
          settings: camera!.settings,
          createdAt: camera!.createdAt,
          updatedAt: camera!.updatedAt,
        },
      };
    }
  );

  // Reorder cameras (batch update sort orders)
  fastify.post(
    "/reorder",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Reorder cameras by updating sort orders",
        tags: ["Cameras"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            order: {
              type: "array",
              items: { type: "string", format: "uuid" },
              description: "Array of camera IDs in the desired order",
            },
          },
          required: ["order"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { order } = request.body as { order: string[] };

      // Verify all cameras belong to user
      const userCameras = await fastify.db
        .select({ id: cameras.id })
        .from(cameras)
        .where(eq(cameras.userId, user.id));

      const userCameraIds = new Set(userCameras.map((c) => c.id));
      for (const id of order) {
        if (!userCameraIds.has(id)) {
          return reply.badRequest(`Camera ${id} not found or not owned by user`);
        }
      }

      // Update sort orders
      for (let i = 0; i < order.length; i++) {
        const cameraId = order[i]!;
        await fastify.db
          .update(cameras)
          .set({ sortOrder: i, updatedAt: new Date() })
          .where(eq(cameras.id, cameraId));
      }

      return { success: true };
    }
  );

  // Toggle camera favorite
  fastify.post(
    "/:id/favorite",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Toggle camera favorite status",
        tags: ["Cameras"],
        security: [{ bearerAuth: [] }],
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

      const [existing] = await fastify.db
        .select()
        .from(cameras)
        .where(and(eq(cameras.id, id), eq(cameras.userId, user.id)))
        .limit(1);

      if (!existing) {
        return reply.notFound("Camera not found");
      }

      const currentSettings = existing.settings || {};
      const newIsFavorite = !currentSettings.isFavorite;

      const [camera] = await fastify.db
        .update(cameras)
        .set({
          settings: { ...currentSettings, isFavorite: newIsFavorite },
          updatedAt: new Date(),
        })
        .where(eq(cameras.id, id))
        .returning();

      return {
        success: true,
        data: {
          id: camera!.id,
          isFavorite: newIsFavorite,
        },
      };
    }
  );

  // Delete camera
  fastify.delete(
    "/:id",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Delete a camera",
        tags: ["Cameras"],
        security: [{ bearerAuth: [] }],
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

      const [camera] = await fastify.db
        .select()
        .from(cameras)
        .where(and(eq(cameras.id, id), eq(cameras.userId, user.id)))
        .limit(1);

      if (!camera) {
        return reply.notFound("Camera not found");
      }

      await fastify.db.delete(cameras).where(eq(cameras.id, id));

      return { success: true };
    }
  );

  // Proxy snapshot image (to handle auth and CORS)
  fastify.get(
    "/:id/snapshot",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get camera snapshot image",
        tags: ["Cameras"],
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

      const [camera] = await fastify.db
        .select()
        .from(cameras)
        .where(and(eq(cameras.id, id), eq(cameras.userId, user.id)))
        .limit(1);

      if (!camera) {
        return reply.notFound("Camera not found");
      }

      if (!camera.snapshotUrl) {
        return reply.badRequest("Camera does not have a snapshot URL configured");
      }

      try {
        const headers: Record<string, string> = {};
        if (camera.username && camera.password) {
          const auth = Buffer.from(`${camera.username}:${camera.password}`).toString("base64");
          headers.Authorization = `Basic ${auth}`;
        }

        const response = await fetch(camera.snapshotUrl, { headers });

        if (!response.ok) {
          return reply.status(response.status).send("Failed to fetch snapshot");
        }

        const contentType = response.headers.get("content-type") ?? "image/jpeg";
        const buffer = await response.arrayBuffer();

        return reply
          .header("Content-Type", contentType)
          .header("Cache-Control", "no-cache, no-store, must-revalidate")
          .send(Buffer.from(buffer));
      } catch (error) {
        console.error("Failed to fetch camera snapshot:", error);
        return reply.internalServerError("Failed to fetch snapshot");
      }
    }
  );

  // Proxy MJPEG stream (to handle auth and CORS)
  fastify.get(
    "/:id/stream",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Proxy MJPEG stream from camera",
        tags: ["Cameras"],
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

      const [camera] = await fastify.db
        .select()
        .from(cameras)
        .where(and(eq(cameras.id, id), eq(cameras.userId, user.id)))
        .limit(1);

      if (!camera) {
        return reply.notFound("Camera not found");
      }

      if (!camera.mjpegUrl) {
        return reply.badRequest("Camera does not have an MJPEG URL configured");
      }

      // Create abort controller for timeout and client disconnect
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 10000); // 10 second connection timeout

      // Abort on client disconnect
      request.raw.on("close", () => {
        abortController.abort();
      });

      try {
        const headers: Record<string, string> = {
          "User-Agent": "Mozilla/5.0",
        };

        // Build URL with auth if needed (some cameras like Reolink prefer URL auth)
        let streamUrl = camera.mjpegUrl;
        if (camera.username && camera.password) {
          // Try both header auth and URL auth
          const auth = Buffer.from(`${camera.username}:${camera.password}`).toString("base64");
          headers.Authorization = `Basic ${auth}`;

          // Also embed auth in URL for cameras that need it
          try {
            const url = new URL(camera.mjpegUrl);
            if (!url.username) {
              url.username = camera.username;
              url.password = camera.password;
              streamUrl = url.toString();
            }
          } catch {
            // Keep original URL if parsing fails
          }
        }

        const response = await fetch(streamUrl, {
          headers,
          signal: abortController.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.error(`Camera stream failed: ${response.status} ${response.statusText}`);
          return reply.status(response.status).send("Failed to connect to camera stream");
        }

        const contentType = response.headers.get("content-type") ?? "multipart/x-mixed-replace";

        // Stream the response
        reply.raw.writeHead(200, {
          "Content-Type": contentType,
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Connection: "close",
        });

        // Pipe the stream
        if (response.body) {
          const reader = response.body.getReader();
          const pump = async () => {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (!reply.raw.writableEnded) {
                  reply.raw.write(value);
                }
              }
            } catch {
              // Stream closed or aborted
            } finally {
              if (!reply.raw.writableEnded) {
                reply.raw.end();
              }
            }
          };
          pump();
        }
      } catch (error) {
        clearTimeout(timeoutId);
        if ((error as Error).name === "AbortError") {
          console.error("Camera stream connection timed out or client disconnected");
          if (!reply.sent) {
            return reply.status(504).send("Camera connection timed out");
          }
        } else {
          console.error("Failed to proxy camera stream:", error);
          if (!reply.sent) {
            return reply.internalServerError("Failed to connect to camera stream");
          }
        }
      }
    }
  );

  // ============================================
  // MediaMTX Stream Management Endpoints
  // ============================================

  // Get MediaMTX configuration
  fastify.get(
    "/mediamtx/config",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Get MediaMTX configuration",
        tags: ["Cameras"],
        security: [{ bearerAuth: [] }],
      },
    },
    async () => {
      // Get stored config from systemSettings
      const [apiUrlSetting] = await fastify.db
        .select()
        .from(systemSettings)
        .where(and(eq(systemSettings.category, "mediamtx"), eq(systemSettings.key, "apiUrl")))
        .limit(1);

      const [webrtcPortSetting] = await fastify.db
        .select()
        .from(systemSettings)
        .where(and(eq(systemSettings.category, "mediamtx"), eq(systemSettings.key, "webrtcPort")))
        .limit(1);

      const [hlsPortSetting] = await fastify.db
        .select()
        .from(systemSettings)
        .where(and(eq(systemSettings.category, "mediamtx"), eq(systemSettings.key, "hlsPort")))
        .limit(1);

      const [hostSetting] = await fastify.db
        .select()
        .from(systemSettings)
        .where(and(eq(systemSettings.category, "mediamtx"), eq(systemSettings.key, "host")))
        .limit(1);

      return {
        success: true,
        data: {
          apiUrl: apiUrlSetting?.value || process.env.MEDIAMTX_API_URL || "http://localhost:9997",
          webrtcPort: webrtcPortSetting?.value || process.env.MEDIAMTX_WEBRTC_PORT || "8889",
          hlsPort: hlsPortSetting?.value || process.env.MEDIAMTX_HLS_PORT || "8888",
          host: hostSetting?.value || process.env.MEDIAMTX_HOST || "localhost",
        },
      };
    }
  );

  // Save MediaMTX configuration
  fastify.post(
    "/mediamtx/config",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Save MediaMTX configuration",
        tags: ["Cameras"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            apiUrl: { type: "string" },
            webrtcPort: { type: "string" },
            hlsPort: { type: "string" },
            host: { type: "string" },
          },
        },
      },
    },
    async (request) => {
      const body = request.body as {
        apiUrl?: string;
        webrtcPort?: string;
        hlsPort?: string;
        host?: string;
      };

      const settings = [
        { key: "apiUrl", value: body.apiUrl },
        { key: "webrtcPort", value: body.webrtcPort },
        { key: "hlsPort", value: body.hlsPort },
        { key: "host", value: body.host },
      ];

      for (const setting of settings) {
        if (setting.value === undefined) continue;

        const [existing] = await fastify.db
          .select()
          .from(systemSettings)
          .where(and(eq(systemSettings.category, "mediamtx"), eq(systemSettings.key, setting.key)))
          .limit(1);

        if (existing) {
          await fastify.db
            .update(systemSettings)
            .set({ value: setting.value, updatedAt: new Date() })
            .where(eq(systemSettings.id, existing.id));
        } else {
          await fastify.db.insert(systemSettings).values({
            category: "mediamtx",
            key: setting.key,
            value: setting.value,
            isSecret: false,
          });
        }
      }

      return { success: true };
    }
  );

  // Check MediaMTX availability (with optional custom URL for testing)
  fastify.get(
    "/mediamtx/status",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Check if MediaMTX streaming server is available",
        tags: ["Cameras"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        querystring: {
          type: "object",
          properties: {
            testUrl: { type: "string" },
          },
        },
      },
    },
    async (request) => {
      const { testUrl } = request.query as { testUrl?: string };

      // If testUrl provided, test that specific URL
      if (testUrl) {
        const testService = new MediaMTXService(testUrl);
        const available = await testService.isAvailable();
        return {
          success: true,
          data: { available, testedUrl: testUrl },
        };
      }

      // Otherwise use the configured/default service
      const available = await mediamtx.isAvailable();
      return {
        success: true,
        data: { available },
      };
    }
  );

  // Get WebRTC stream URL for a camera
  fastify.get(
    "/:id/webrtc-url",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get WebRTC stream URL for a camera (requires MediaMTX)",
        tags: ["Cameras"],
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

      const [camera] = await fastify.db
        .select()
        .from(cameras)
        .where(and(eq(cameras.id, id), eq(cameras.userId, user.id)))
        .limit(1);

      if (!camera) {
        return reply.notFound("Camera not found");
      }

      if (!camera.rtspUrl) {
        return reply.badRequest("Camera does not have an RTSP URL configured");
      }

      const urls = mediamtx.getStreamUrls(camera.id);

      return {
        success: true,
        data: {
          webrtcUrl: urls.webrtcUrl,
          pathName: mediamtx.getPathName(camera.id),
        },
      };
    }
  );

  // Get HLS stream URL for a camera
  fastify.get(
    "/:id/hls-url",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get HLS stream URL for a camera (requires MediaMTX)",
        tags: ["Cameras"],
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

      const [camera] = await fastify.db
        .select()
        .from(cameras)
        .where(and(eq(cameras.id, id), eq(cameras.userId, user.id)))
        .limit(1);

      if (!camera) {
        return reply.notFound("Camera not found");
      }

      if (!camera.rtspUrl) {
        return reply.badRequest("Camera does not have an RTSP URL configured");
      }

      const urls = mediamtx.getStreamUrls(camera.id);

      return {
        success: true,
        data: {
          hlsUrl: urls.hlsUrl,
          pathName: mediamtx.getPathName(camera.id),
        },
      };
    }
  );

  // Start/register a camera stream with MediaMTX
  fastify.post(
    "/:id/start-stream",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Register camera with MediaMTX for WebRTC/HLS streaming",
        tags: ["Cameras"],
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

      console.log(`[Camera] Starting stream for camera ${id}`);

      const [camera] = await fastify.db
        .select()
        .from(cameras)
        .where(and(eq(cameras.id, id), eq(cameras.userId, user.id)))
        .limit(1);

      if (!camera) {
        return reply.notFound("Camera not found");
      }

      if (!camera.rtspUrl) {
        console.log(`[Camera] No RTSP URL configured for ${camera.name}`);
        return reply.badRequest("Camera does not have an RTSP URL configured");
      }

      console.log(`[Camera] RTSP URL: ${camera.rtspUrl.replace(/\/\/.*:.*@/, "//***:***@")}`);

      // Check if MediaMTX is available
      const available = await mediamtx.isAvailable();
      console.log(`[Camera] MediaMTX available: ${available}`);

      if (!available) {
        return reply.serviceUnavailable("MediaMTX streaming server is not available");
      }

      try {
        const result = await mediamtx.registerCamera(
          camera.id,
          camera.rtspUrl,
          camera.username,
          camera.password
        );

        console.log(`[Camera] Registered with MediaMTX: ${result.pathName}`);
        console.log(`[Camera] WebRTC URL: ${result.webrtcUrl}`);
        console.log(`[Camera] HLS URL: ${result.hlsUrl}`);

        return {
          success: true,
          data: {
            pathName: result.pathName,
            webrtcUrl: result.webrtcUrl,
            hlsUrl: result.hlsUrl,
          },
        };
      } catch (error) {
        console.error(`[Camera] Failed to register with MediaMTX:`, error);
        return reply.internalServerError("Failed to start stream");
      }
    }
  );

  // Stop/unregister a camera stream from MediaMTX
  fastify.delete(
    "/:id/stop-stream",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Unregister camera from MediaMTX streaming",
        tags: ["Cameras"],
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

      const [camera] = await fastify.db
        .select()
        .from(cameras)
        .where(and(eq(cameras.id, id), eq(cameras.userId, user.id)))
        .limit(1);

      if (!camera) {
        return reply.notFound("Camera not found");
      }

      try {
        await mediamtx.unregisterCamera(camera.id);
        return { success: true };
      } catch (error) {
        console.error("Failed to unregister camera from MediaMTX:", error);
        return reply.internalServerError("Failed to stop stream");
      }
    }
  );

  // Get stream status for a camera
  fastify.get(
    "/:id/stream-status",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Check if camera stream is active in MediaMTX with detailed diagnostics",
        tags: ["Cameras"],
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

      const [camera] = await fastify.db
        .select()
        .from(cameras)
        .where(and(eq(cameras.id, id), eq(cameras.userId, user.id)))
        .limit(1);

      if (!camera) {
        return reply.notFound("Camera not found");
      }

      const mediamtxAvailable = await mediamtx.isAvailable();
      if (!mediamtxAvailable) {
        return {
          success: true,
          data: {
            mediamtxAvailable: false,
            pathRegistered: false,
            streamReady: false,
            hasRtspUrl: !!camera.rtspUrl,
            hasMjpegUrl: !!camera.mjpegUrl,
            error: "MediaMTX streaming server is not reachable",
          },
        };
      }

      const urls = camera.rtspUrl ? mediamtx.getStreamUrls(camera.id) : null;

      if (!camera.rtspUrl) {
        return {
          success: true,
          data: {
            mediamtxAvailable: true,
            pathRegistered: false,
            streamReady: false,
            hasRtspUrl: false,
            hasMjpegUrl: !!camera.mjpegUrl,
            webrtcUrl: null,
            hlsUrl: null,
          },
        };
      }

      const streamStatus = await mediamtx.getStreamStatus(camera.id);

      console.log(`[Camera] Stream status for ${camera.name}:`, {
        pathRegistered: streamStatus.pathRegistered,
        streamReady: streamStatus.streamReady,
        readers: streamStatus.readers,
        bytesReceived: streamStatus.bytesReceived,
        sourceType: streamStatus.sourceType,
        tracks: streamStatus.tracks,
      });

      return {
        success: true,
        data: {
          mediamtxAvailable: true,
          pathRegistered: streamStatus.pathRegistered,
          streamReady: streamStatus.streamReady,
          readyTime: streamStatus.readyTime,
          readers: streamStatus.readers,
          bytesReceived: streamStatus.bytesReceived,
          sourceType: streamStatus.sourceType,
          tracks: streamStatus.tracks,
          hasRtspUrl: true,
          hasMjpegUrl: !!camera.mjpegUrl,
          webrtcUrl: urls?.webrtcUrl,
          hlsUrl: urls?.hlsUrl,
        },
      };
    }
  );

  // ============================================
  // Troubleshooting Endpoints
  // ============================================

  // List all registered MediaMTX paths
  fastify.get(
    "/mediamtx/paths",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "List all registered paths in MediaMTX",
        tags: ["Cameras"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const available = await mediamtx.isAvailable();
      if (!available) {
        return reply.serviceUnavailable("MediaMTX streaming server is not available");
      }

      try {
        const paths = await mediamtx.getPaths();
        return {
          success: true,
          data: paths.map((path) => ({
            name: path.name,
            ready: path.ready,
            readyTime: path.readyTime,
            sourceType: path.source?.type ?? null,
            readers: path.readers?.length ?? 0,
            bytesReceived: path.bytesReceived,
            tracks: path.tracks,
          })),
        };
      } catch (error) {
        console.error("Failed to get MediaMTX paths:", error);
        return reply.internalServerError("Failed to get paths");
      }
    }
  );

  // Test an RTSP URL without saving (for troubleshooting)
  fastify.post(
    "/mediamtx/test-rtsp",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Test an RTSP URL by temporarily registering it with MediaMTX",
        tags: ["Cameras"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            rtspUrl: { type: "string" },
            username: { type: "string" },
            password: { type: "string" },
          },
          required: ["rtspUrl"],
        },
      },
    },
    async (request, reply) => {
      const { rtspUrl, username, password } = request.body as {
        rtspUrl: string;
        username?: string;
        password?: string;
      };

      const available = await mediamtx.isAvailable();
      if (!available) {
        return reply.serviceUnavailable("MediaMTX streaming server is not available");
      }

      // Use a temporary path name for testing
      const testPathName = `test/${Date.now()}`;
      const fullRtspUrl = mediamtx.buildRtspUrl(rtspUrl, username, password);

      console.log(`[Camera Test] Testing RTSP URL: ${rtspUrl.replace(/\/\/.*:.*@/, "//***:***@")}`);

      try {
        // Register the test path
        await mediamtx.addPath(testPathName, fullRtspUrl);
        console.log(`[Camera Test] Registered test path: ${testPathName}`);

        // Wait a bit for the stream to connect (on-demand)
        // The stream will start when we query it
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Check the path status
        const path = await mediamtx.getPath(testPathName);
        console.log(`[Camera Test] Path status:`, path);

        // Wait a bit more and check again if not ready
        let status = {
          registered: !!path,
          ready: path?.ready ?? false,
          sourceType: path?.source?.type ?? null,
          tracks: path?.tracks ?? [],
          error: null as string | null,
        };

        if (!status.ready) {
          // Wait up to 5 seconds for the stream to become ready
          for (let i = 0; i < 10; i++) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            const updatedPath = await mediamtx.getPath(testPathName);
            if (updatedPath?.ready) {
              status = {
                registered: true,
                ready: true,
                sourceType: updatedPath.source?.type ?? null,
                tracks: updatedPath.tracks ?? [],
                error: null,
              };
              console.log(`[Camera Test] Stream became ready after ${(i + 1) * 500}ms`);
              break;
            }
          }
        }

        // Clean up the test path
        try {
          await mediamtx.removePath(testPathName);
          console.log(`[Camera Test] Cleaned up test path`);
        } catch {
          // Ignore cleanup errors
        }

        if (!status.ready) {
          status.error = "Stream did not become ready within 5 seconds. Check if the RTSP URL is correct and the camera is accessible.";
        }

        return {
          success: true,
          data: status,
        };
      } catch (error) {
        // Clean up on error
        try {
          await mediamtx.removePath(testPathName);
        } catch {
          // Ignore cleanup errors
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Camera Test] Failed:`, errorMessage);

        return {
          success: true,
          data: {
            registered: false,
            ready: false,
            sourceType: null,
            tracks: [],
            error: `Failed to test stream: ${errorMessage}`,
          },
        };
      }
    }
  );
};
