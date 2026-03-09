import type { FastifyPluginAsync } from "fastify";
import { eq, and, isNull, gt } from "drizzle-orm";
import {
  users,
  companionInvites,
  companionAccess,
  refreshTokens,
} from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";
import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomUUID } from "crypto";

export const companionInviteRoutes: FastifyPluginAsync = async (fastify) => {
  // POST / — Create a companion invite link
  fastify.post(
    "/",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Create a companion invite link (7-day expiry)",
        tags: ["Companion Invites"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            label: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const owner = await getCurrentUser(request);
      if (!owner) return reply.unauthorized("Not authenticated");

      const { label } = (request.body as { label?: string }) || {};

      const [invite] = await fastify.db
        .insert(companionInvites)
        .values({
          ownerId: owner.id,
          label: label || null,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        })
        .returning();

      return reply.status(201).send({ data: invite });
    }
  );

  // GET / — List invites for current user
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "List companion invites for the current user",
        tags: ["Companion Invites"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const owner = await getCurrentUser(request);
      if (!owner) return reply.unauthorized("Not authenticated");

      const invites = await fastify.db
        .select()
        .from(companionInvites)
        .where(eq(companionInvites.ownerId, owner.id))
        .orderBy(companionInvites.createdAt);

      return { data: invites };
    }
  );

  // DELETE /:id — Revoke/delete an invite
  fastify.delete(
    "/:id",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Delete a companion invite",
        tags: ["Companion Invites"],
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

      await fastify.db
        .delete(companionInvites)
        .where(
          and(
            eq(companionInvites.id, id),
            eq(companionInvites.ownerId, owner.id)
          )
        );

      return reply.status(204).send();
    }
  );

  // GET /token/:token — Validate a token (public)
  fastify.get(
    "/token/:token",
    {
      schema: {
        description: "Validate a companion invite token (public)",
        tags: ["Companion Invites"],
        params: {
          type: "object",
          properties: { token: { type: "string", format: "uuid" } },
          required: ["token"],
        },
      },
    },
    async (request, reply) => {
      const { token } = request.params as { token: string };

      const [invite] = await fastify.db
        .select({
          id: companionInvites.id,
          label: companionInvites.label,
          expiresAt: companionInvites.expiresAt,
          acceptedAt: companionInvites.acceptedAt,
          ownerName: users.name,
        })
        .from(companionInvites)
        .innerJoin(users, eq(companionInvites.ownerId, users.id))
        .where(eq(companionInvites.token, token))
        .limit(1);

      if (!invite) {
        throw fastify.httpErrors.notFound("Invalid invite link");
      }

      if (invite.acceptedAt) {
        throw fastify.httpErrors.gone("This invite has already been used");
      }

      if (new Date() > invite.expiresAt) {
        throw fastify.httpErrors.gone("This invite link has expired");
      }

      return {
        data: {
          ownerName: invite.ownerName,
          label: invite.label,
          expiresAt: invite.expiresAt,
        },
      };
    }
  );

  // POST /token/:token/accept — Accept an invite (public)
  fastify.post(
    "/token/:token/accept",
    {
      schema: {
        description: "Accept a companion invite — creates account + grants companion access",
        tags: ["Companion Invites"],
        params: {
          type: "object",
          properties: { token: { type: "string", format: "uuid" } },
          required: ["token"],
        },
        body: {
          type: "object",
          properties: {
            email: { type: "string", format: "email" },
            name: { type: "string" },
            password: { type: "string", minLength: 8 },
          },
          required: ["email", "password"],
        },
      },
    },
    async (request, reply) => {
      const { token } = request.params as { token: string };
      const { email, name, password } = request.body as {
        email: string;
        name?: string;
        password: string;
      };

      // Validate token
      const [invite] = await fastify.db
        .select()
        .from(companionInvites)
        .where(eq(companionInvites.token, token))
        .limit(1);

      if (!invite) {
        throw fastify.httpErrors.notFound("Invalid invite link");
      }

      if (invite.acceptedAt) {
        throw fastify.httpErrors.gone("This invite has already been used");
      }

      if (new Date() > invite.expiresAt) {
        throw fastify.httpErrors.gone("This invite link has expired");
      }

      // Check email not already taken
      const [existingUser] = await fastify.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (existingUser) {
        throw fastify.httpErrors.conflict(
          "An account with this email already exists"
        );
      }

      // Hash password and create user
      const passwordHash = await bcrypt.hash(password, 12);

      const [newUser] = await fastify.db
        .insert(users)
        .values({
          email: email.toLowerCase(),
          name: name || null,
          passwordHash,
          role: "member",
        })
        .returning();

      // Grant companion access with default permissions
      await fastify.db.insert(companionAccess).values({
        ownerId: invite.ownerId,
        userId: newUser!.id,
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

      // Mark invite as accepted
      await fastify.db
        .update(companionInvites)
        .set({ acceptedAt: new Date(), acceptedBy: newUser!.id })
        .where(eq(companionInvites.id, invite.id));

      // Create session tokens
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
};
