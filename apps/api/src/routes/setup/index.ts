import type { FastifyPluginAsync } from "fastify";
import { eq, and } from "drizzle-orm";
import { users, systemSettings, refreshTokens } from "@openframe/database/schema";
import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomUUID } from "crypto";
import { getCurrentUser } from "../../plugins/auth.js";
import { getCategorySettings } from "../settings/index.js";

export const setupRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /status - Check if setup is needed (unauthenticated)
  fastify.get(
    "/status",
    {
      schema: {
        description: "Check setup status",
        tags: ["Setup"],
      },
    },
    async () => {
      // Check if any admin user exists
      const [adminUser] = await fastify.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, "admin"))
        .limit(1);

      const hasAdmin = !!adminUser;

      // Check if setup is marked complete
      const [completeSetting] = await fastify.db
        .select()
        .from(systemSettings)
        .where(
          and(
            eq(systemSettings.category, "setup"),
            eq(systemSettings.key, "complete")
          )
        )
        .limit(1);

      const isComplete = completeSetting?.value === "true";

      return {
        success: true,
        data: {
          needsSetup: !hasAdmin,
          hasAdmin,
          isComplete,
        },
      };
    }
  );

  // POST /admin - Create first admin user (only if no admin exists)
  fastify.post(
    "/admin",
    {
      schema: {
        description: "Create the first admin user",
        tags: ["Setup"],
        body: {
          type: "object",
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 },
            name: { type: "string" },
          },
          required: ["email", "password", "name"],
        },
      },
    },
    async (request, reply) => {
      const { email, password, name } = request.body as {
        email: string;
        password: string;
        name: string;
      };

      // Check if an admin already exists
      const [existingAdmin] = await fastify.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, "admin"))
        .limit(1);

      if (existingAdmin) {
        return reply.badRequest("Admin user already exists");
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Check if a user with this email already exists (e.g. from OAuth)
      const [existingUser] = await fastify.db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      let user;
      if (existingUser) {
        // Upgrade existing user to admin and set password
        [user] = await fastify.db
          .update(users)
          .set({
            passwordHash,
            role: "admin",
            name: name || existingUser.name,
          })
          .where(eq(users.id, existingUser.id))
          .returning();
      } else {
        // Create new admin user
        [user] = await fastify.db
          .insert(users)
          .values({
            email,
            name,
            passwordHash,
            role: "admin",
          })
          .returning();
      }

      // Create session tokens (log user in immediately)
      const accessToken = fastify.jwt.sign({ userId: user!.id });
      const refreshToken = randomBytes(32).toString("base64url");
      const tokenHash = createHash("sha256").update(refreshToken).digest("hex");
      const familyId = randomUUID();

      await fastify.db.insert(refreshTokens).values({
        userId: user!.id,
        tokenHash,
        familyId,
        deviceInfo: request.headers["user-agent"],
        ipAddress: request.ip,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      return {
        success: true,
        data: {
          user: {
            id: user!.id,
            email: user!.email,
            name: user!.name,
            role: user!.role,
          },
          accessToken,
          refreshToken,
          expiresIn: 900,
        },
      };
    }
  );

  // POST /configure - Save settings for a category (requires admin JWT)
  fastify.post(
    "/configure",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Save setup configuration for a category",
        tags: ["Setup"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            category: { type: "string" },
            settings: { type: "object" },
          },
          required: ["category", "settings"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user || user.role !== "admin") {
        return reply.forbidden("Admin access required");
      }

      const { category, settings } = request.body as {
        category: string;
        settings: Record<string, string>;
      };

      // Use the existing settings infrastructure via direct DB operations
      // This mirrors the bulk update logic from settings routes
      const crypto = await import("crypto");
      const ALGORITHM = "aes-256-gcm";

      function encrypt(text: string): string {
        const key = process.env.ENCRYPTION_KEY;
        if (!key) throw new Error("ENCRYPTION_KEY not set");
        const keyBuffer = Buffer.from(key, "hex");
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
        let encrypted = cipher.update(text, "utf8", "hex");
        encrypted += cipher.final("hex");
        const authTag = cipher.getAuthTag();
        return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
      }

      // Known secret keys by category
      const SECRET_KEYS: Record<string, Set<string>> = {
        google: new Set(["client_secret", "maps_api_key", "gemini_api_key", "vision_api_key"]),
        microsoft: new Set(["client_secret"]),
        spotify: new Set(["client_secret"]),
        weather: new Set(["api_key"]),
        telegram: new Set(["bot_token"]),
        homeassistant: new Set(["token"]),
        openai: new Set(["api_key"]),
        anthropic: new Set(["api_key"]),
      };

      const secretKeys = SECRET_KEYS[category] || new Set<string>();

      for (const [key, value] of Object.entries(settings)) {
        if (!value && value !== "") continue; // Skip null/undefined

        const isSecret = secretKeys.has(key);
        const storedValue = isSecret && value ? encrypt(value) : value;

        const [existing] = await fastify.db
          .select()
          .from(systemSettings)
          .where(
            and(
              eq(systemSettings.category, category),
              eq(systemSettings.key, key)
            )
          )
          .limit(1);

        if (existing) {
          await fastify.db
            .update(systemSettings)
            .set({
              value: storedValue,
              isSecret,
              updatedAt: new Date(),
            })
            .where(eq(systemSettings.id, existing.id));
        } else {
          await fastify.db.insert(systemSettings).values({
            category,
            key,
            value: storedValue,
            isSecret,
          });
        }
      }

      return {
        success: true,
        message: `${category} settings saved`,
      };
    }
  );

  // POST /complete - Mark setup as complete (requires admin JWT)
  fastify.post(
    "/complete",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Mark setup as complete",
        tags: ["Setup"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user || user.role !== "admin") {
        return reply.forbidden("Admin access required");
      }

      // Set setup.complete = "true"
      const [existing] = await fastify.db
        .select()
        .from(systemSettings)
        .where(
          and(
            eq(systemSettings.category, "setup"),
            eq(systemSettings.key, "complete")
          )
        )
        .limit(1);

      if (existing) {
        await fastify.db
          .update(systemSettings)
          .set({ value: "true", updatedAt: new Date() })
          .where(eq(systemSettings.id, existing.id));
      } else {
        await fastify.db.insert(systemSettings).values({
          category: "setup",
          key: "complete",
          value: "true",
          isSecret: false,
          description: "Whether initial setup has been completed",
        });
      }

      return { success: true };
    }
  );

  // GET /providers - Which OAuth providers are configured (unauthenticated)
  fastify.get(
    "/providers",
    {
      schema: {
        description: "Get which OAuth providers are configured",
        tags: ["Setup"],
      },
    },
    async () => {
      // Check Google OAuth - from DB settings first, then env vars
      const googleSettings = await getCategorySettings(fastify.db, "google");
      const hasGoogle = !!(
        (googleSettings.client_id && googleSettings.client_secret) ||
        (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
      );

      // Check Microsoft OAuth
      const microsoftSettings = await getCategorySettings(fastify.db, "microsoft");
      const hasMicrosoft = !!(
        (microsoftSettings.client_id && microsoftSettings.client_secret) ||
        (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET)
      );

      return {
        success: true,
        data: {
          google: hasGoogle,
          microsoft: hasMicrosoft,
        },
      };
    }
  );
};
