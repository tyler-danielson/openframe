import type { FastifyPluginAsync } from "fastify";
import { eq, and, isNull } from "drizzle-orm";
import { users, invitations, refreshTokens } from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";
import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomUUID } from "crypto";

export const userRoutes: FastifyPluginAsync = async (fastify) => {
  // GET / — List all users on the instance (admin only)
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "List all users",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      await fastify.requireAdmin(request, reply);
      if (reply.sent) return;

      const rows = await fastify.db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          avatarUrl: users.avatarUrl,
          role: users.role,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(users.createdAt);

      return { success: true, data: rows };
    }
  );

  // POST /invite — Create invitation (admin only)
  fastify.post(
    "/invite",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Create a user invitation",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            email: { type: "string", format: "email" },
            name: { type: "string" },
            role: { type: "string", enum: ["admin", "member"] },
          },
          required: ["email", "role"],
        },
      },
    },
    async (request, reply) => {
      await fastify.requireAdmin(request, reply);
      if (reply.sent) return;

      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { email, name, role } = request.body as {
        email: string;
        name?: string;
        role: "admin" | "member";
      };

      // Check if a user with this email already exists
      const [existingUser] = await fastify.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser) {
        throw fastify.httpErrors.conflict(
          "A user with this email already exists"
        );
      }

      // Check if there's already a pending invite for this email
      const [existingInvite] = await fastify.db
        .select({ id: invitations.id })
        .from(invitations)
        .where(
          and(eq(invitations.email, email), isNull(invitations.acceptedAt))
        )
        .limit(1);

      if (existingInvite) {
        // Delete old invite and create fresh one
        await fastify.db
          .delete(invitations)
          .where(eq(invitations.id, existingInvite.id));
      }

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const [invitation] = await fastify.db
        .insert(invitations)
        .values({
          email,
          name: name || null,
          role,
          invitedBy: user.id,
          expiresAt,
        })
        .returning();

      return reply.status(201).send({
        success: true,
        data: {
          invitation: invitation!,
          inviteUrl: `/invite/${invitation!.token}`,
        },
      });
    }
  );

  // GET /invitations — List pending invitations (admin only)
  fastify.get(
    "/invitations",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "List pending invitations",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      await fastify.requireAdmin(request, reply);
      if (reply.sent) return;

      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const rows = await fastify.db
        .select()
        .from(invitations)
        .where(isNull(invitations.acceptedAt))
        .orderBy(invitations.createdAt);

      return { success: true, data: rows };
    }
  );

  // DELETE /invitations/:id — Revoke invitation (admin only)
  fastify.delete(
    "/invitations/:id",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Revoke an invitation",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: { id: { type: "string", format: "uuid" } },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      await fastify.requireAdmin(request, reply);
      if (reply.sent) return;

      const { id } = request.params as { id: string };

      const [deleted] = await fastify.db
        .delete(invitations)
        .where(eq(invitations.id, id))
        .returning();

      if (!deleted) throw fastify.httpErrors.notFound("Invitation not found");

      return { success: true };
    }
  );

  // GET /invite/:token — Validate invite token (public, no auth)
  fastify.get(
    "/invite/:token",
    {
      schema: {
        description: "Validate an invite token",
        tags: ["Users"],
        params: {
          type: "object",
          properties: { token: { type: "string", format: "uuid" } },
          required: ["token"],
        },
      },
    },
    async (request) => {
      const { token } = request.params as { token: string };

      const [invitation] = await fastify.db
        .select({
          id: invitations.id,
          email: invitations.email,
          name: invitations.name,
          role: invitations.role,
          invitedBy: invitations.invitedBy,
          expiresAt: invitations.expiresAt,
          acceptedAt: invitations.acceptedAt,
        })
        .from(invitations)
        .where(eq(invitations.token, token))
        .limit(1);

      if (!invitation) {
        throw fastify.httpErrors.notFound("Invitation not found");
      }

      if (invitation.acceptedAt) {
        throw fastify.httpErrors.gone("This invitation has already been used");
      }

      if (new Date() > invitation.expiresAt) {
        throw fastify.httpErrors.gone("This invitation has expired");
      }

      // Get inviter name
      const [inviter] = await fastify.db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, invitation.invitedBy))
        .limit(1);

      return {
        success: true,
        data: {
          email: invitation.email,
          name: invitation.name,
          role: invitation.role,
          invitedByName: inviter?.name || "Unknown",
        },
      };
    }
  );

  // POST /invite/:token/accept — Accept invite and create account (public)
  fastify.post(
    "/invite/:token/accept",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: {
        description: "Accept an invitation and create account",
        tags: ["Users"],
        params: {
          type: "object",
          properties: { token: { type: "string", format: "uuid" } },
          required: ["token"],
        },
        body: {
          type: "object",
          properties: {
            password: { type: "string", minLength: 8 },
            name: { type: "string" },
          },
          required: ["password"],
        },
      },
    },
    async (request, reply) => {
      const { token } = request.params as { token: string };
      const { password, name } = request.body as {
        password: string;
        name?: string;
      };

      const [invitation] = await fastify.db
        .select()
        .from(invitations)
        .where(eq(invitations.token, token))
        .limit(1);

      if (!invitation) {
        throw fastify.httpErrors.notFound("Invitation not found");
      }

      if (invitation.acceptedAt) {
        throw fastify.httpErrors.gone("This invitation has already been used");
      }

      if (new Date() > invitation.expiresAt) {
        throw fastify.httpErrors.gone("This invitation has expired");
      }

      // Check if email is already taken
      const [existingUser] = await fastify.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, invitation.email))
        .limit(1);

      if (existingUser) {
        throw fastify.httpErrors.conflict(
          "A user with this email already exists"
        );
      }

      // Hash password and create user
      const passwordHash = await bcrypt.hash(password, 12);

      const [newUser] = await fastify.db
        .insert(users)
        .values({
          email: invitation.email,
          name: name || invitation.name || null,
          passwordHash,
          role: invitation.role,
        })
        .returning();

      // Mark invitation as accepted
      await fastify.db
        .update(invitations)
        .set({ acceptedAt: new Date() })
        .where(eq(invitations.id, invitation.id));

      // Create session tokens (log user in immediately)
      const accessToken = fastify.jwt.sign({ userId: newUser!.id });
      const refreshToken = randomBytes(32).toString("base64url");
      const tokenHash = createHash("sha256")
        .update(refreshToken)
        .digest("hex");
      const familyId = randomUUID();

      await fastify.db.insert(refreshTokens).values({
        userId: newUser!.id,
        tokenHash,
        familyId,
        deviceInfo: request.headers["user-agent"],
        ipAddress: request.ip,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      return reply.status(201).send({
        success: true,
        data: {
          user: {
            id: newUser!.id,
            email: newUser!.email,
            name: newUser!.name,
            role: newUser!.role,
          },
          accessToken,
          refreshToken,
          expiresIn: 900,
        },
      });
    }
  );

  // PATCH /:id/role — Update user role (admin only)
  fastify.patch(
    "/:id/role",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Update a user's role",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: { id: { type: "string", format: "uuid" } },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            role: { type: "string", enum: ["admin", "member"] },
          },
          required: ["role"],
        },
      },
    },
    async (request, reply) => {
      await fastify.requireAdmin(request, reply);
      if (reply.sent) return;

      const currentUser = await getCurrentUser(request);
      if (!currentUser)
        throw fastify.httpErrors.unauthorized("Not authenticated");

      const { id } = request.params as { id: string };
      const { role } = request.body as { role: "admin" | "member" };

      if (id === currentUser.id) {
        throw fastify.httpErrors.badRequest("Cannot change your own role");
      }

      const [updated] = await fastify.db
        .update(users)
        .set({ role, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
        });

      if (!updated) throw fastify.httpErrors.notFound("User not found");

      return { success: true, data: updated };
    }
  );

  // DELETE /:id — Remove user (admin only)
  fastify.delete(
    "/:id",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Remove a user",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: { id: { type: "string", format: "uuid" } },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      await fastify.requireAdmin(request, reply);
      if (reply.sent) return;

      const currentUser = await getCurrentUser(request);
      if (!currentUser)
        throw fastify.httpErrors.unauthorized("Not authenticated");

      const { id } = request.params as { id: string };

      if (id === currentUser.id) {
        throw fastify.httpErrors.badRequest("Cannot delete yourself");
      }

      const [deleted] = await fastify.db
        .delete(users)
        .where(eq(users.id, id))
        .returning({ id: users.id });

      if (!deleted) throw fastify.httpErrors.notFound("User not found");

      return { success: true };
    }
  );
};
