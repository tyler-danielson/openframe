import type { FastifyPluginAsync } from "fastify";
import { eq, and, sql, desc } from "drizzle-orm";
import { users, kiosks, joinRequests, companionAccess } from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";

export const joinRequestRoutes: FastifyPluginAsync = async (fastify) => {
  // POST / — Submit a join request (user scanned QR code)
  fastify.post(
    "/",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Submit a join request for a kiosk",
        tags: ["Join Requests"],
        body: {
          type: "object",
          properties: {
            kioskToken: { type: "string", format: "uuid" },
            message: { type: "string" },
          },
          required: ["kioskToken"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) return reply.unauthorized("Not authenticated");

      const { kioskToken, message } = request.body as {
        kioskToken: string;
        message?: string;
      };

      // Find the kiosk by token
      const [kiosk] = await fastify.db
        .select()
        .from(kiosks)
        .where(eq(kiosks.token, kioskToken))
        .limit(1);

      if (!kiosk) return reply.notFound("Kiosk not found");

      // Can't request to join your own kiosk
      if (kiosk.userId === user.id) {
        return reply.badRequest("You own this kiosk");
      }

      // Check if user already has companion access
      const [existingAccess] = await fastify.db
        .select()
        .from(companionAccess)
        .where(
          and(
            eq(companionAccess.ownerId, kiosk.userId),
            eq(companionAccess.userId, user.id),
            eq(companionAccess.isActive, true)
          )
        )
        .limit(1);

      if (existingAccess) {
        return reply.badRequest("You already have access");
      }

      // Check if there's already a pending request
      const [existingRequest] = await fastify.db
        .select()
        .from(joinRequests)
        .where(
          and(
            eq(joinRequests.userId, user.id),
            eq(joinRequests.kioskId, kiosk.id),
            eq(joinRequests.status, "pending")
          )
        )
        .limit(1);

      if (existingRequest) {
        return reply.badRequest("You already have a pending request");
      }

      const [request_] = await fastify.db
        .insert(joinRequests)
        .values({
          kioskId: kiosk.id,
          userId: user.id,
          ownerId: kiosk.userId,
          message: message || null,
        })
        .returning();

      return reply.status(201).send({ success: true, data: request_! });
    }
  );

  // GET / — List join requests for the current owner
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "List join requests for owner",
        tags: ["Join Requests"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["pending", "approved", "rejected"] },
          },
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) return reply.unauthorized("Not authenticated");

      const { status } = request.query as { status?: string };

      const conditions = [eq(joinRequests.ownerId, user.id)];
      if (status) {
        conditions.push(eq(joinRequests.status, status as "pending" | "approved" | "rejected"));
      }

      const rows = await fastify.db
        .select({
          id: joinRequests.id,
          kioskId: joinRequests.kioskId,
          kioskName: kiosks.name,
          userId: joinRequests.userId,
          userName: users.name,
          userEmail: users.email,
          userAvatar: users.avatarUrl,
          status: joinRequests.status,
          message: joinRequests.message,
          resolvedAt: joinRequests.resolvedAt,
          createdAt: joinRequests.createdAt,
        })
        .from(joinRequests)
        .leftJoin(users, eq(joinRequests.userId, users.id))
        .leftJoin(kiosks, eq(joinRequests.kioskId, kiosks.id))
        .where(and(...conditions))
        .orderBy(joinRequests.createdAt);

      return { success: true, data: rows };
    }
  );

  // GET /count — Get pending count for badge
  fastify.get(
    "/count",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Get pending join request count",
        tags: ["Join Requests"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) return reply.unauthorized("Not authenticated");

      const [result] = await fastify.db
        .select({ count: sql<number>`count(*)::int` })
        .from(joinRequests)
        .where(
          and(
            eq(joinRequests.ownerId, user.id),
            eq(joinRequests.status, "pending")
          )
        );

      return { success: true, data: { pending: result?.count ?? 0 } };
    }
  );

  // POST /:id/approve — Approve a join request
  fastify.post(
    "/:id/approve",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Approve a join request (creates companion access)",
        tags: ["Join Requests"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: { id: { type: "string", format: "uuid" } },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) return reply.unauthorized("Not authenticated");

      const { id } = request.params as { id: string };

      const [jr] = await fastify.db
        .select()
        .from(joinRequests)
        .where(
          and(
            eq(joinRequests.id, id),
            eq(joinRequests.ownerId, user.id),
            eq(joinRequests.status, "pending")
          )
        )
        .limit(1);

      if (!jr) return reply.notFound("Join request not found");

      // Update status
      await fastify.db
        .update(joinRequests)
        .set({ status: "approved", resolvedAt: new Date() })
        .where(eq(joinRequests.id, id));

      // Check if companion access already exists (might have been created manually)
      const [existingAccess] = await fastify.db
        .select()
        .from(companionAccess)
        .where(
          and(
            eq(companionAccess.ownerId, user.id),
            eq(companionAccess.userId, jr.userId)
          )
        )
        .limit(1);

      if (!existingAccess) {
        // Create companion access with default view permissions
        await fastify.db.insert(companionAccess).values({
          ownerId: user.id,
          userId: jr.userId,
          accessCalendar: "view",
          accessTasks: "view",
          accessKiosks: true,
          accessNews: true,
          accessWeather: true,
          accessRecipes: true,
          accessPhotos: false,
          accessIptv: false,
          accessHomeAssistant: false,
        });
      }

      return { success: true };
    }
  );

  // POST /:id/reject — Reject a join request
  fastify.post(
    "/:id/reject",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Reject a join request",
        tags: ["Join Requests"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: { id: { type: "string", format: "uuid" } },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) return reply.unauthorized("Not authenticated");

      const { id } = request.params as { id: string };

      const [jr] = await fastify.db
        .select()
        .from(joinRequests)
        .where(
          and(
            eq(joinRequests.id, id),
            eq(joinRequests.ownerId, user.id),
            eq(joinRequests.status, "pending")
          )
        )
        .limit(1);

      if (!jr) return reply.notFound("Join request not found");

      await fastify.db
        .update(joinRequests)
        .set({ status: "rejected", resolvedAt: new Date() })
        .where(eq(joinRequests.id, id));

      return { success: true };
    }
  );

  // GET /check/:kioskToken — Check user's status for a kiosk
  fastify.get(
    "/check/:kioskToken",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Check user's join status for a kiosk",
        tags: ["Join Requests"],
        params: {
          type: "object",
          properties: { kioskToken: { type: "string", format: "uuid" } },
          required: ["kioskToken"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) return reply.unauthorized("Not authenticated");

      const { kioskToken } = request.params as { kioskToken: string };

      const [kiosk] = await fastify.db
        .select()
        .from(kiosks)
        .where(eq(kiosks.token, kioskToken))
        .limit(1);

      if (!kiosk) return reply.notFound("Kiosk not found");

      // Check if user is the owner
      if (kiosk.userId === user.id) {
        return { success: true, data: { status: "is_owner" } };
      }

      // Check if user already has companion access
      const [access] = await fastify.db
        .select()
        .from(companionAccess)
        .where(
          and(
            eq(companionAccess.ownerId, kiosk.userId),
            eq(companionAccess.userId, user.id),
            eq(companionAccess.isActive, true)
          )
        )
        .limit(1);

      if (access) {
        return { success: true, data: { status: "has_access" } };
      }

      // Check for existing join request
      const [jr] = await fastify.db
        .select()
        .from(joinRequests)
        .where(
          and(
            eq(joinRequests.userId, user.id),
            eq(joinRequests.kioskId, kiosk.id)
          )
        )
        .orderBy(desc(joinRequests.createdAt))
        .limit(1);

      if (jr) {
        return { success: true, data: { status: jr.status } };
      }

      return { success: true, data: { status: "none" } };
    }
  );
};
