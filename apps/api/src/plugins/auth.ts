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

    // Accept either JWT or API key
    fastify.decorate(
      "authenticateAny",
      async (request: FastifyRequest, reply: FastifyReply) => {
        const authHeader = request.headers.authorization;
        const apiKey = request.headers["x-api-key"];

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

        // If user has auth credentials, use normal authentication
        if (authHeader?.startsWith("Bearer ") || apiKey) {
          return fastify.authenticateAny(request, reply);
        }

        // Check if any active kiosk device exists
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
