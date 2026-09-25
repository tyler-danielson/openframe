import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { eq, and, sql, desc } from "drizzle-orm";
import { users, kiosks, joinRequests, companionAccess } from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JOIN_CODE_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;

type Kiosk = typeof kiosks.$inferSelect;

/**
 * The code a kiosk's "Join" QR shows. It names the kiosk, signed so it can't
 * be made up for another one, and unlike the kiosk's token (which can be
 * exchanged for the owner's API key) it grants nothing: it can only be used
 * to ask the owner to join.
 */
function joinCodeFor(fastify: FastifyInstance, kioskId: string): string {
  return Buffer.from(fastify.signCookie(kioskId)).toString("base64url");
}

/** The id of the kiosk a join code names, or null if it isn't a valid join code. */
function kioskIdFromJoinCode(fastify: FastifyInstance, code: string): string | null {
  if (!JOIN_CODE_PATTERN.test(code)) return null;
  const unsigned = fastify.unsignCookie(Buffer.from(code, "base64url").toString("utf8"));
  return unsigned.valid && UUID_PATTERN.test(unsigned.value) ? unsigned.value : null;
}

/**
 * The kiosk a join link is for. Links carry a join code; QR codes shown
 * before join codes existed carry the kiosk's token, which still works.
 */
async function findKioskToJoin(fastify: FastifyInstance, codeOrToken: string): Promise<Kiosk | null> {
  const kioskId = kioskIdFromJoinCode(fastify, codeOrToken);
  if (kioskId) {
    const [kiosk] = await fastify.db
      .select()
      .from(kiosks)
      .where(and(eq(kiosks.id, kioskId), eq(kiosks.isActive, true)))
      .limit(1);
    return kiosk ?? null;
  }

  if (!UUID_PATTERN.test(codeOrToken)) return null;
  const [kiosk] = await fastify.db
    .select()
    .from(kiosks)
    .where(eq(kiosks.token, codeOrToken))
    .limit(1);
  return kiosk ?? null;
}

export const joinRequestRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /join-code/:kioskToken — The code for a kiosk's "Join" QR (public:
  // the kiosk shows it, and its token is the auth)
  fastify.get(
    "/join-code/:kioskToken",
    {
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: {
        description: "Get the join code a kiosk shows in its Join QR code (kiosk token authorizes)",
        tags: ["Join Requests"],
        params: {
          type: "object",
          properties: { kioskToken: { type: "string", format: "uuid" } },
          required: ["kioskToken"],
        },
      },
    },
    async (request, reply) => {
      const { kioskToken } = request.params as { kioskToken: string };

      const [kiosk] = await fastify.db
        .select({ id: kiosks.id })
        .from(kiosks)
        .where(and(eq(kiosks.token, kioskToken), eq(kiosks.isActive, true)))
        .limit(1);

      if (!kiosk) return reply.notFound("Kiosk not found");

      return { success: true, data: { joinCode: joinCodeFor(fastify, kiosk.id) } };
    }
  );

  // POST / — Submit a join request (public — the join code from the kiosk's
  // QR, or for older QR codes the kiosk token, says which kiosk)
  fastify.post(
    "/",
    {
      schema: {
        description: "Submit a join request for a kiosk (no auth required; the kiosk's join code, or its token, says which kiosk)",
        tags: ["Join Requests"],
        body: {
          type: "object",
          properties: {
            // A join code, or a kiosk token
            kioskToken: { type: "string", minLength: 1, maxLength: 200 },
            joinCode: { type: "string", minLength: 1, maxLength: 200 },
            email: { type: "string", format: "email" },
            name: { type: "string" },
            message: { type: "string" },
          },
          required: ["email"],
        },
      },
    },
    async (request, reply) => {
      const { kioskToken, joinCode, email, name, message } = request.body as {
        kioskToken?: string;
        joinCode?: string;
        email: string;
        name?: string;
        message?: string;
      };

      const code = joinCode ?? kioskToken;
      if (!code) return reply.badRequest("A join code is required");

      const kiosk = await findKioskToJoin(fastify, code);
      if (!kiosk) return reply.notFound("Kiosk not found");

      // Look up existing user by email (if they already have an account)
      const [existingUser] = await fastify.db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase().trim()))
        .limit(1);

      // Can't request to join your own kiosk
      if (existingUser && kiosk.userId === existingUser.id) {
        return reply.badRequest("You own this kiosk");
      }

      // Check if user already has companion access
      if (existingUser) {
        const [existingAccess] = await fastify.db
          .select()
          .from(companionAccess)
          .where(
            and(
              eq(companionAccess.ownerId, kiosk.userId),
              eq(companionAccess.userId, existingUser.id),
              eq(companionAccess.isActive, true)
            )
          )
          .limit(1);

        if (existingAccess) {
          return reply.badRequest("This email already has access");
        }
      }

      // Check if there's already a pending request for this email + kiosk
      const [existingRequest] = await fastify.db
        .select()
        .from(joinRequests)
        .where(
          and(
            eq(joinRequests.email, email.toLowerCase().trim()),
            eq(joinRequests.kioskId, kiosk.id),
            eq(joinRequests.status, "pending")
          )
        )
        .limit(1);

      if (existingRequest) {
        return reply.badRequest("A request for this email is already pending");
      }

      const [jr] = await fastify.db
        .insert(joinRequests)
        .values({
          kioskId: kiosk.id,
          userId: existingUser?.id ?? null,
          ownerId: kiosk.userId,
          email: email.toLowerCase().trim(),
          name: name?.trim() || existingUser?.name || null,
          message: message || null,
        })
        .returning();

      // Anyone can call this: don't tell them the owner's user id, or whether
      // (and as whom) the email has an account here
      const { userId: _userId, ownerId: _ownerId, ...created } = jr!;
      return reply.status(201).send({ success: true, data: created });
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
          // Email/name from the join request itself (for unauthenticated requests)
          requestEmail: joinRequests.email,
          requestName: joinRequests.name,
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

      // Normalize: prefer user data if linked, fall back to request data
      const data = rows.map((r) => ({
        id: r.id,
        kioskId: r.kioskId,
        kioskName: r.kioskName,
        userId: r.userId,
        userName: r.userName || r.requestName,
        userEmail: r.userEmail || r.requestEmail,
        userAvatar: r.userAvatar,
        status: r.status,
        message: r.message,
        resolvedAt: r.resolvedAt,
        createdAt: r.createdAt,
      }));

      return { success: true, data };
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

  // POST /:id/approve — Approve a join request (find-or-create user, grant companion access)
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
      const owner = await getCurrentUser(request);
      if (!owner) return reply.unauthorized("Not authenticated");

      const { id } = request.params as { id: string };

      const [jr] = await fastify.db
        .select()
        .from(joinRequests)
        .where(
          and(
            eq(joinRequests.id, id),
            eq(joinRequests.ownerId, owner.id),
            eq(joinRequests.status, "pending")
          )
        )
        .limit(1);

      if (!jr) return reply.notFound("Join request not found");

      // Resolve the target user: find by userId, by email, or create new
      let targetUserId = jr.userId;

      if (!targetUserId && jr.email) {
        // Try to find existing user by email
        const [existingUser] = await fastify.db
          .select()
          .from(users)
          .where(eq(users.email, jr.email))
          .limit(1);

        if (existingUser) {
          targetUserId = existingUser.id;
        } else {
          // Create a new user (no password — they'll use OAuth or password reset)
          const [newUser] = await fastify.db
            .insert(users)
            .values({
              email: jr.email,
              name: jr.name || null,
              role: "member",
            })
            .returning();
          targetUserId = newUser!.id;
        }

        // Link the join request to the resolved user
        await fastify.db
          .update(joinRequests)
          .set({ userId: targetUserId })
          .where(eq(joinRequests.id, id));
      }

      if (!targetUserId) {
        return reply.badRequest("Join request has no email or user");
      }

      // Update status
      await fastify.db
        .update(joinRequests)
        .set({ status: "approved", resolvedAt: new Date() })
        .where(eq(joinRequests.id, id));

      // Check if companion access already exists
      const [existingAccess] = await fastify.db
        .select()
        .from(companionAccess)
        .where(
          and(
            eq(companionAccess.ownerId, owner.id),
            eq(companionAccess.userId, targetUserId)
          )
        )
        .limit(1);

      if (!existingAccess) {
        await fastify.db.insert(companionAccess).values({
          ownerId: owner.id,
          userId: targetUserId,
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
      const owner = await getCurrentUser(request);
      if (!owner) return reply.unauthorized("Not authenticated");

      const { id } = request.params as { id: string };

      const [jr] = await fastify.db
        .select()
        .from(joinRequests)
        .where(
          and(
            eq(joinRequests.id, id),
            eq(joinRequests.ownerId, owner.id),
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

  // GET /check/:kioskToken — Check email's status for a kiosk (public; the
  // path carries the kiosk's join code, or for older QR codes its token)
  fastify.get(
    "/check/:kioskToken",
    {
      schema: {
        description: "Check join status for an email + kiosk (by the kiosk's join code, or its token)",
        tags: ["Join Requests"],
        params: {
          type: "object",
          properties: { kioskToken: { type: "string", minLength: 1, maxLength: 200 } },
          required: ["kioskToken"],
        },
        querystring: {
          type: "object",
          properties: { email: { type: "string" } },
        },
      },
    },
    async (request, reply) => {
      const { kioskToken } = request.params as { kioskToken: string };
      const { email } = request.query as { email?: string };

      if (!email) return reply.badRequest("Email is required");

      const kiosk = await findKioskToJoin(fastify, kioskToken);
      if (!kiosk) return reply.notFound("Kiosk not found");

      const normalizedEmail = email.toLowerCase().trim();

      // Check if this email belongs to the owner
      const [ownerUser] = await fastify.db
        .select()
        .from(users)
        .where(eq(users.id, kiosk.userId))
        .limit(1);

      if (ownerUser && ownerUser.email === normalizedEmail) {
        return { success: true, data: { status: "is_owner" } };
      }

      // Check if email has companion access
      const [emailUser] = await fastify.db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      if (emailUser) {
        const [access] = await fastify.db
          .select()
          .from(companionAccess)
          .where(
            and(
              eq(companionAccess.ownerId, kiosk.userId),
              eq(companionAccess.userId, emailUser.id),
              eq(companionAccess.isActive, true)
            )
          )
          .limit(1);

        if (access) {
          return { success: true, data: { status: "has_access" } };
        }
      }

      // Check for existing join request by email
      const [jr] = await fastify.db
        .select()
        .from(joinRequests)
        .where(
          and(
            eq(joinRequests.email, normalizedEmail),
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
