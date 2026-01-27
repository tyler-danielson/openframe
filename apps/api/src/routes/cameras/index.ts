import type { FastifyPluginAsync } from "fastify";
import { eq, and, asc } from "drizzle-orm";
import { cameras } from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";

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
              },
            },
          },
          required: ["name"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
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
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
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

      try {
        const headers: Record<string, string> = {};
        if (camera.username && camera.password) {
          const auth = Buffer.from(`${camera.username}:${camera.password}`).toString("base64");
          headers.Authorization = `Basic ${auth}`;
        }

        const response = await fetch(camera.mjpegUrl, { headers });

        if (!response.ok) {
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
                reply.raw.write(value);
              }
            } catch {
              // Stream closed
            } finally {
              reply.raw.end();
            }
          };
          pump();
        }
      } catch (error) {
        console.error("Failed to proxy camera stream:", error);
        return reply.internalServerError("Failed to connect to camera stream");
      }
    }
  );
};
