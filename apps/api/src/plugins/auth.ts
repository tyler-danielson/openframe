import fp from "fastify-plugin";
import { eq } from "drizzle-orm";
import { users, apiKeys, kiosks } from "@openframe/database/schema";
import { createHash, timingSafeEqual } from "crypto";
import type { FastifyRequest, FastifyReply } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
    authenticateApiKey: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
    authenticateAny: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
    authenticateKioskOrAny: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { userId: string };
    user: { userId: string };
  }
}

export const authPlugin = fp(
  async (fastify) => {
    // JWT authentication
    fastify.decorate(
      "authenticate",
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          await request.jwtVerify();
        } catch (err) {
          reply.unauthorized("Invalid or expired token");
        }
      }
    );

    // API key authentication
    fastify.decorate(
      "authenticateApiKey",
      async (request: FastifyRequest, reply: FastifyReply) => {
        const apiKey = request.headers["x-api-key"];

        if (!apiKey || typeof apiKey !== "string") {
          return reply.unauthorized("API key required");
        }

        // Check for kiosk token format: kiosk_<uuid>
        if (apiKey.startsWith("kiosk_")) {
          const kioskToken = apiKey.substring(6); // Remove "kiosk_" prefix

          const [kiosk] = await fastify.db
            .select()
            .from(kiosks)
            .where(eq(kiosks.token, kioskToken))
            .limit(1);

          if (!kiosk) {
            return reply.unauthorized("Invalid kiosk token");
          }

          if (!kiosk.isActive) {
            return reply.unauthorized("Kiosk is disabled");
          }

          // Update last accessed
          await fastify.db
            .update(kiosks)
            .set({ lastAccessedAt: new Date() })
            .where(eq(kiosks.id, kiosk.id));

          request.user = { userId: kiosk.userId };
          return;
        }

        // API keys format: openframe_<prefix>_<secret>
        const parts = apiKey.split("_");
        if (parts.length !== 3 || parts[0] !== "openframe") {
          return reply.unauthorized("Invalid API key format");
        }

        const keyPrefix = `openframe_${parts[1]}`;
        const keyHash = createHash("sha256").update(apiKey).digest("hex");

        const [key] = await fastify.db
          .select()
          .from(apiKeys)
          .where(eq(apiKeys.keyPrefix, keyPrefix))
          .limit(1);

        if (
          !key ||
          !timingSafeEqual(
            Buffer.from(key.keyHash, "hex"),
            Buffer.from(keyHash, "hex")
          )
        ) {
          return reply.unauthorized("Invalid API key");
        }

        if (key.expiresAt && key.expiresAt < new Date()) {
          return reply.unauthorized("API key expired");
        }

        // Update last used
        await fastify.db
          .update(apiKeys)
          .set({ lastUsedAt: new Date() })
          .where(eq(apiKeys.id, key.id));

        request.user = { userId: key.userId };
      }
    );

    // Accept either JWT, API key, or relay secret
    fastify.decorate(
      "authenticateAny",
      async (request: FastifyRequest, reply: FastifyReply) => {
        const authHeader = request.headers.authorization;
        const apiKey = request.headers["x-api-key"];
        const relaySecret = request.headers["x-relay-secret"];

        // Relay secret auth (used by cloud proxy)
        if (relaySecret && typeof relaySecret === "string") {
          if (fastify.relaySecret && relaySecret === fastify.relaySecret) {
            // In hosted mode, require x-relay-user-id header to identify the user
            const relayUserId = request.headers["x-relay-user-id"];
            if (fastify.hostedMode) {
              if (!relayUserId || typeof relayUserId !== "string") {
                return reply.unauthorized(
                  "x-relay-user-id header required in hosted mode"
                );
              }
              const [targetUser] = await fastify.db
                .select()
                .from(users)
                .where(eq(users.id, relayUserId))
                .limit(1);
              if (targetUser) {
                request.user = { userId: targetUser.id };
                return;
              }
              return reply.unauthorized("User not found");
            }

            // Self-hosted: use x-relay-user-id if provided, else fall back to first user
            if (relayUserId && typeof relayUserId === "string") {
              const [targetUser] = await fastify.db
                .select()
                .from(users)
                .where(eq(users.id, relayUserId))
                .limit(1);
              if (targetUser) {
                request.user = { userId: targetUser.id };
                return;
              }
            }

            // Fall back to instance owner (first user) for self-hosted
            const [ownerUser] = await fastify.db
              .select()
              .from(users)
              .limit(1);

            if (ownerUser) {
              request.user = { userId: ownerUser.id };
              return;
            }
          }
          return reply.unauthorized("Invalid relay secret");
        }

        if (authHeader?.startsWith("Bearer ")) {
          return fastify.authenticate(request, reply);
        }

        if (apiKey) {
          return fastify.authenticateApiKey(request, reply);
        }

        reply.unauthorized("Authentication required");
      }
    );

    // Kiosk mode authentication - checks kiosk first, then falls back to normal auth
    fastify.decorate(
      "authenticateKioskOrAny",
      async (request: FastifyRequest, reply: FastifyReply) => {
        const authHeader = request.headers.authorization;
        const apiKey = request.headers["x-api-key"];
        const relaySecret = request.headers["x-relay-secret"];

        // If user has auth credentials, use normal authentication
        if (authHeader?.startsWith("Bearer ") || apiKey || relaySecret) {
          return fastify.authenticateAny(request, reply);
        }

        // In hosted mode, always require explicit auth - no anonymous kiosk fallback
        if (fastify.hostedMode) {
          return reply.unauthorized("Authentication required");
        }

        // Self-hosted only: check if any active kiosk device exists
        const [kiosk] = await fastify.db
          .select()
          .from(kiosks)
          .where(eq(kiosks.isActive, true))
          .limit(1);

        if (kiosk) {
          // Use the kiosk owner's user ID
          request.user = { userId: kiosk.userId };
          return;
        }

        reply.unauthorized("Authentication required");
      }
    );
  },
  {
    name: "auth",
    dependencies: ["database"],
  }
);

// Helper to get current user
export async function getCurrentUser(request: FastifyRequest) {
  if (!request.user) {
    return null;
  }

  const { userId } = request.user;
  const [user] = await request.server.db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return null;
  }

  return user;
}
