import type { FastifyPluginAsync } from "fastify";
import { eq, and } from "drizzle-orm";
import {
  users,
  refreshTokens,
  apiKeys,
  oauthTokens,
  kioskConfig,
} from "@openframe/database/schema";
import {
  refreshTokenSchema,
  createApiKeySchema,
} from "@openframe/shared/validators";
import { createHash, randomBytes, randomUUID } from "crypto";
import { nanoid } from "nanoid";
import { getCurrentUser } from "../../plugins/auth.js";

// In-memory OAuth state store (for single-server deployments)
// States expire after 10 minutes
const oauthStateStore = new Map<string, { createdAt: number; returnUrl?: string }>();

// In-memory kiosk command store
// Commands expire after 60 seconds (kiosks should poll every 10-30 seconds)
interface KioskCommand {
  type: "refresh" | "reload-photos";
  timestamp: number;
}
const kioskCommands = new Map<string, KioskCommand[]>();

// Clean up expired states every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of oauthStateStore.entries()) {
    if (now - data.createdAt > 10 * 60 * 1000) {
      oauthStateStore.delete(state);
    }
  }
  // Clean up expired kiosk commands (older than 60 seconds)
  for (const [userId, commands] of kioskCommands.entries()) {
    const validCommands = commands.filter((cmd) => now - cmd.timestamp < 60000);
    if (validCommands.length === 0) {
      kioskCommands.delete(userId);
    } else {
      kioskCommands.set(userId, validCommands);
    }
  }
}, 5 * 60 * 1000);

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Refresh tokens
  fastify.post(
    "/refresh",
    {
      schema: {
        description: "Refresh access token using refresh token",
        tags: ["Auth"],
        body: {
          type: "object",
          properties: {
            refreshToken: { type: "string" },
          },
          required: ["refreshToken"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  accessToken: { type: "string" },
                  refreshToken: { type: "string" },
                  expiresIn: { type: "number" },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { refreshToken } = refreshTokenSchema.parse(request.body);
      const tokenHash = createHash("sha256").update(refreshToken).digest("hex");

      // Find the refresh token
      const [existingToken] = await fastify.db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, tokenHash))
        .limit(1);

      if (!existingToken) {
        return reply.unauthorized("Invalid refresh token");
      }

      if (existingToken.revokedAt) {
        // Token reuse detected - revoke entire family
        await fastify.db
          .update(refreshTokens)
          .set({ revokedAt: new Date() })
          .where(eq(refreshTokens.familyId, existingToken.familyId));

        return reply.unauthorized("Token reuse detected");
      }

      if (existingToken.expiresAt < new Date()) {
        return reply.unauthorized("Refresh token expired");
      }

      // Revoke old token
      await fastify.db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.id, existingToken.id));

      // Create new tokens
      const accessToken = fastify.jwt.sign({ userId: existingToken.userId });
      const newRefreshToken = randomBytes(32).toString("base64url");
      const newTokenHash = createHash("sha256")
        .update(newRefreshToken)
        .digest("hex");

      await fastify.db.insert(refreshTokens).values({
        userId: existingToken.userId,
        tokenHash: newTokenHash,
        familyId: existingToken.familyId, // same family for rotation tracking
        deviceInfo: existingToken.deviceInfo,
        ipAddress: request.ip,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });

      return {
        success: true,
        data: {
          accessToken,
          refreshToken: newRefreshToken,
          expiresIn: 900, // 15 minutes
        },
      };
    }
  );

  // Google OAuth initiation
  fastify.get(
    "/oauth/google",
    {
      schema: {
        description: "Initiate Google OAuth flow",
        tags: ["Auth", "OAuth"],
        response: {
          302: {
            type: "null",
            description: "Redirect to Google OAuth",
          },
        },
      },
    },
    async (request, reply) => {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const redirectUri = process.env.GOOGLE_REDIRECT_URI;

      if (!clientId || !redirectUri) {
        return reply.badRequest("Google OAuth not configured");
      }

      const state = randomBytes(16).toString("hex");
      const scopes = [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/tasks.readonly",
        "https://www.googleapis.com/auth/tasks",
        "https://www.googleapis.com/auth/photospicker.mediaitems.readonly",
        "https://www.googleapis.com/auth/gmail.readonly",
      ];

      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", scopes.join(" "));
      url.searchParams.set("state", state);
      url.searchParams.set("access_type", "offline");
      url.searchParams.set("prompt", "consent");

      // Get the return URL from query param (most reliable) or construct from referer
      const query = request.query as Record<string, string>;
      let returnUrl = query.returnUrl;

      if (!returnUrl) {
        const referer = request.headers.referer;
        if (referer) {
          try {
            returnUrl = new URL(referer).origin + "/dashboard";
          } catch {
            // Ignore
          }
        }
      }

      // Store state in memory for verification (works across proxy boundaries)
      oauthStateStore.set(state, { createdAt: Date.now(), returnUrl });

      return reply.redirect(url.toString());
    }
  );

  // Google OAuth callback
  fastify.get(
    "/oauth/google/callback",
    {
      schema: {
        description: "Google OAuth callback",
        tags: ["Auth", "OAuth"],
        querystring: {
          type: "object",
          properties: {
            code: { type: "string" },
            state: { type: "string" },
            error: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const { code, state, error } = request.query as Record<string, string | undefined>;

      if (error) {
        return reply.badRequest(`OAuth error: ${error}`);
      }

      if (!state) {
        return reply.badRequest("Missing OAuth state");
      }

      // Verify state from in-memory store
      const storedState = oauthStateStore.get(state);
      if (!storedState) {
        return reply.badRequest("Invalid OAuth state");
      }

      // Remove used state
      oauthStateStore.delete(state);

      if (!code) {
        return reply.badRequest("Missing OAuth code");
      }

      // Exchange code for tokens
      const tokenResponse = await fetch(
        "https://oauth2.googleapis.com/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
            grant_type: "authorization_code",
          }),
        }
      );

      if (!tokenResponse.ok) {
        return reply.internalServerError("Failed to exchange OAuth code");
      }

      const tokens = await tokenResponse.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
        scope: string;
      };

      // Get user info
      const userInfoResponse = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        }
      );

      if (!userInfoResponse.ok) {
        return reply.internalServerError("Failed to get user info");
      }

      const userInfo = await userInfoResponse.json() as {
        email: string;
        name?: string;
        picture?: string;
      };

      // Find or create user
      let [user] = await fastify.db
        .select()
        .from(users)
        .where(eq(users.email, userInfo.email))
        .limit(1);

      if (!user) {
        [user] = await fastify.db
          .insert(users)
          .values({
            email: userInfo.email,
            name: userInfo.name,
            avatarUrl: userInfo.picture,
          })
          .returning();
      }

      // Store OAuth tokens (encrypted in production)
      const [existingOAuth] = await fastify.db
        .select()
        .from(oauthTokens)
        .where(
          and(
            eq(oauthTokens.userId, user!.id),
            eq(oauthTokens.provider, "google")
          )
        )
        .limit(1);

      if (existingOAuth) {
        await fastify.db
          .update(oauthTokens)
          .set({
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token ?? existingOAuth.refreshToken,
            expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
            scope: tokens.scope,
            updatedAt: new Date(),
          })
          .where(eq(oauthTokens.id, existingOAuth.id));
      } else {
        await fastify.db.insert(oauthTokens).values({
          userId: user!.id,
          provider: "google",
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          scope: tokens.scope,
        });
      }

      // Create session tokens
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

      // Redirect to frontend with tokens
      // Use the stored return URL from when OAuth started, fall back to FRONTEND_URL
      const baseUrl = storedState.returnUrl
        ? new URL(storedState.returnUrl).origin
        : (process.env.FRONTEND_URL || "http://localhost:3000");

      const finalReturnPath = storedState.returnUrl
        ? new URL(storedState.returnUrl).pathname + new URL(storedState.returnUrl).search
        : "/dashboard";

      const redirectUrl = new URL(`${baseUrl}/auth/callback`);
      redirectUrl.searchParams.set("accessToken", accessToken);
      redirectUrl.searchParams.set("refreshToken", refreshToken);
      redirectUrl.searchParams.set("returnTo", finalReturnPath);

      return reply.redirect(redirectUrl.toString());
    }
  );

  // Microsoft OAuth initiation
  fastify.get(
    "/oauth/microsoft",
    {
      schema: {
        description: "Initiate Microsoft OAuth flow",
        tags: ["Auth", "OAuth"],
      },
    },
    async (_request, reply) => {
      const clientId = process.env.MICROSOFT_CLIENT_ID;
      const redirectUri = process.env.MICROSOFT_REDIRECT_URI;

      if (!clientId || !redirectUri) {
        return reply.badRequest("Microsoft OAuth not configured");
      }

      const state = randomBytes(16).toString("hex");
      const scopes = [
        "openid",
        "email",
        "profile",
        "offline_access",
        "Calendars.ReadWrite",
        "Tasks.ReadWrite",
      ];

      const url = new URL(
        "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
      );
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", scopes.join(" "));
      url.searchParams.set("state", state);

      // Store state in memory for verification
      oauthStateStore.set(state, { createdAt: Date.now() });

      return reply.redirect(url.toString());
    }
  );

  // Create API key
  fastify.post(
    "/api-keys",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Create a new API key",
        tags: ["Auth", "API Keys"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            scopes: { type: "array", items: { type: "string" } },
            expiresInDays: { type: "number" },
          },
          required: ["name"],
        },
        response: {
          201: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  key: { type: "string" },
                  keyPrefix: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        return reply.unauthorized("Not authenticated");
      }
      const input = createApiKeySchema.parse(request.body);

      const prefix = nanoid(8);
      const secret = nanoid(32);
      const fullKey = `openframe_${prefix}_${secret}`;
      const keyHash = createHash("sha256").update(fullKey).digest("hex");

      const expiresAt = input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
        : null;

      const [apiKey] = await fastify.db
        .insert(apiKeys)
        .values({
          userId: user.id,
          name: input.name,
          keyHash,
          keyPrefix: `openframe_${prefix}`,
          scopes: input.scopes,
          expiresAt,
        })
        .returning();

      return reply.status(201).send({
        success: true,
        data: {
          id: apiKey!.id,
          name: apiKey!.name,
          key: fullKey, // Only returned once
          keyPrefix: apiKey!.keyPrefix,
        },
      });
    }
  );

  // List API keys
  fastify.get(
    "/api-keys",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "List all API keys",
        tags: ["Auth", "API Keys"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const keys = await fastify.db
        .select({
          id: apiKeys.id,
          name: apiKeys.name,
          keyPrefix: apiKeys.keyPrefix,
          scopes: apiKeys.scopes,
          lastUsedAt: apiKeys.lastUsedAt,
          expiresAt: apiKeys.expiresAt,
          createdAt: apiKeys.createdAt,
        })
        .from(apiKeys)
        .where(eq(apiKeys.userId, user.id));

      return {
        success: true,
        data: keys,
      };
    }
  );

  // Delete API key
  fastify.delete(
    "/api-keys/:id",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Delete an API key",
        tags: ["Auth", "API Keys"],
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
        return reply.unauthorized("Not authenticated");
      }
      const { id } = request.params as { id: string };

      const result = await fastify.db
        .delete(apiKeys)
        .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, user.id)));

      if (!result) {
        return reply.notFound("API key not found");
      }

      return { success: true };
    }
  );

  // Get server configuration (for frontend to know server URLs)
  fastify.get(
    "/config",
    {
      schema: {
        description: "Get server configuration",
        tags: ["Auth"],
      },
    },
    async () => {
      return {
        success: true,
        data: {
          frontendUrl: process.env.FRONTEND_URL || `http://localhost:${process.env.PORT || 3000}`,
        },
      };
    }
  );

  // Get current user
  fastify.get(
    "/me",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Get current authenticated user",
        tags: ["Auth"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      return {
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          timezone: user.timezone,
          preferences: user.preferences,
        },
      };
    }
  );

  // Logout - revoke refresh token
  fastify.post(
    "/logout",
    {
      schema: {
        description: "Logout and revoke refresh token",
        tags: ["Auth"],
        body: {
          type: "object",
          properties: {
            refreshToken: { type: "string" },
          },
        },
      },
    },
    async (request) => {
      const { refreshToken } = request.body as { refreshToken?: string };

      if (refreshToken) {
        const tokenHash = createHash("sha256")
          .update(refreshToken)
          .digest("hex");
        await fastify.db
          .update(refreshTokens)
          .set({ revokedAt: new Date() })
          .where(eq(refreshTokens.tokenHash, tokenHash));
      }

      return { success: true };
    }
  );

  // Kiosk mode status - public endpoint
  fastify.get(
    "/kiosk/status",
    {
      schema: {
        description: "Check if kiosk mode is enabled",
        tags: ["Auth", "Kiosk"],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  enabled: { type: "boolean" },
                },
              },
            },
          },
        },
      },
    },
    async () => {
      // Check if any user has kiosk mode enabled
      const [kiosk] = await fastify.db
        .select()
        .from(kioskConfig)
        .where(eq(kioskConfig.enabled, true))
        .limit(1);

      return {
        success: true,
        data: {
          enabled: !!kiosk,
        },
      };
    }
  );

  // Enable kiosk mode - protected
  fastify.post(
    "/kiosk/enable",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Enable kiosk mode for current user",
        tags: ["Auth", "Kiosk"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
            },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      // Disable kiosk mode for all users first
      await fastify.db
        .update(kioskConfig)
        .set({ enabled: false, updatedAt: new Date() })
        .where(eq(kioskConfig.enabled, true));

      // Check if user already has a kiosk config
      const [existing] = await fastify.db
        .select()
        .from(kioskConfig)
        .where(eq(kioskConfig.userId, user.id))
        .limit(1);

      if (existing) {
        // Update existing config
        await fastify.db
          .update(kioskConfig)
          .set({ enabled: true, updatedAt: new Date() })
          .where(eq(kioskConfig.userId, user.id));
      } else {
        // Create new config
        await fastify.db.insert(kioskConfig).values({
          userId: user.id,
          enabled: true,
        });
      }

      return { success: true };
    }
  );

  // Disable kiosk mode - protected
  fastify.post(
    "/kiosk/disable",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Disable kiosk mode for current user",
        tags: ["Auth", "Kiosk"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
            },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      await fastify.db
        .update(kioskConfig)
        .set({ enabled: false, updatedAt: new Date() })
        .where(eq(kioskConfig.userId, user.id));

      return { success: true };
    }
  );

  // Get kiosk status for current user - protected
  fastify.get(
    "/kiosk/me",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Get kiosk mode status for current user",
        tags: ["Auth", "Kiosk"],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  enabled: { type: "boolean" },
                },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const [kiosk] = await fastify.db
        .select()
        .from(kioskConfig)
        .where(eq(kioskConfig.userId, user.id))
        .limit(1);

      return {
        success: true,
        data: {
          enabled: kiosk?.enabled ?? false,
        },
      };
    }
  );

  // Get screensaver settings - public (for kiosk mode)
  fastify.get(
    "/kiosk/screensaver",
    {
      schema: {
        description: "Get screensaver settings",
        tags: ["Auth", "Kiosk"],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  enabled: { type: "boolean" },
                  timeout: { type: "number" },
                  interval: { type: "number" },
                  layout: { type: "string" },
                  transition: { type: "string" },
                  colorScheme: { type: "string" },
                  layoutConfig: { type: "object", additionalProperties: true },
                },
              },
            },
          },
        },
      },
    },
    async () => {
      // Get the active kiosk config with screensaver settings
      const [kiosk] = await fastify.db
        .select()
        .from(kioskConfig)
        .where(eq(kioskConfig.enabled, true))
        .limit(1);

      const layoutConfig = kiosk?.screensaverLayoutConfig;
      fastify.log.info({
        foundKiosk: !!kiosk,
        kioskId: kiosk?.id,
        kioskUserId: kiosk?.userId,
        hasLayoutConfig: !!layoutConfig,
        layoutConfigType: typeof layoutConfig,
        widgetCount: (layoutConfig as any)?.widgets?.length ?? 0,
        layoutConfigRaw: JSON.stringify(layoutConfig)?.slice(0, 200)
      }, "Kiosk screensaver GET request");

      return {
        success: true,
        data: {
          enabled: kiosk?.screensaverEnabled ?? true,
          timeout: kiosk?.screensaverTimeout ?? 300,
          interval: kiosk?.screensaverInterval ?? 15,
          layout: kiosk?.screensaverLayout ?? "fullscreen",
          transition: kiosk?.screensaverTransition ?? "fade",
          colorScheme: kiosk?.colorScheme ?? "default",
          layoutConfig: layoutConfig ?? null,
        },
      };
    }
  );

  // Update screensaver settings - protected
  fastify.put(
    "/kiosk/screensaver",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Update screensaver settings",
        tags: ["Auth", "Kiosk"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            enabled: { type: "boolean" },
            timeout: { type: "number", minimum: 30, maximum: 3600 },
            interval: { type: "number", minimum: 3, maximum: 300 },
            layout: { type: "string", enum: ["fullscreen", "informational", "quad", "scatter", "builder"] },
            transition: { type: "string", enum: ["fade", "slide-left", "slide-right", "slide-up", "slide-down", "zoom"] },
            colorScheme: { type: "string", enum: ["default", "homio", "ocean", "forest", "sunset", "lavender"] },
            layoutConfig: { type: "object" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        return reply.unauthorized("User not found");
      }
      const body = request.body as {
        enabled?: boolean;
        timeout?: number;
        interval?: number;
        layout?: "fullscreen" | "informational" | "quad" | "scatter" | "builder";
        transition?: "fade" | "slide-left" | "slide-right" | "slide-up" | "slide-down" | "zoom";
        colorScheme?: "default" | "homio" | "ocean" | "forest" | "sunset" | "lavender";
        layoutConfig?: Record<string, unknown>;
      };

      // Debug logging
      fastify.log.info({
        userId: user.id,
        hasLayoutConfig: !!body.layoutConfig,
        widgetCount: (body.layoutConfig as any)?.widgets?.length ?? 0,
        layoutConfigKeys: body.layoutConfig ? Object.keys(body.layoutConfig) : [],
        rawBody: JSON.stringify(body).slice(0, 500)
      }, "Screensaver settings update received");

      // Check if user has a kiosk config
      const [existing] = await fastify.db
        .select()
        .from(kioskConfig)
        .where(eq(kioskConfig.userId, user.id))
        .limit(1);

      const updates: Record<string, unknown> = { updatedAt: new Date(), enabled: true };
      if (body.enabled !== undefined) updates.screensaverEnabled = body.enabled;
      if (body.timeout !== undefined) updates.screensaverTimeout = body.timeout;
      if (body.interval !== undefined) updates.screensaverInterval = body.interval;
      if (body.layout !== undefined) updates.screensaverLayout = body.layout;
      if (body.transition !== undefined) updates.screensaverTransition = body.transition;
      if (body.colorScheme !== undefined) updates.colorScheme = body.colorScheme;
      if (body.layoutConfig !== undefined) updates.screensaverLayoutConfig = body.layoutConfig;

      if (existing) {
        fastify.log.info({ existingId: existing.id, userId: user.id }, "Updating existing kiosk config");
        await fastify.db
          .update(kioskConfig)
          .set(updates)
          .where(eq(kioskConfig.userId, user.id));
      } else {
        fastify.log.info({ userId: user.id }, "Creating new kiosk config");
        await fastify.db.insert(kioskConfig).values({
          userId: user.id,
          enabled: true,
          colorScheme: body.colorScheme ?? "default",
          screensaverEnabled: body.enabled ?? true,
          screensaverTimeout: body.timeout ?? 300,
          screensaverInterval: body.interval ?? 15,
          screensaverLayout: body.layout ?? "fullscreen",
          screensaverTransition: body.transition ?? "fade",
          screensaverLayoutConfig: body.layoutConfig ?? null,
        });
      }

      fastify.log.info({ userId: user.id }, "Screensaver settings saved successfully");
      return { success: true };
    }
  );

  // Trigger kiosk refresh - protected (admin sends command to kiosk)
  fastify.post(
    "/kiosk/refresh",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Trigger a full page refresh on all kiosk devices",
        tags: ["Auth", "Kiosk"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        return reply.unauthorized("User not found");
      }

      // Add refresh command for this user's kiosks
      const existingCommands = kioskCommands.get(user.id) ?? [];
      existingCommands.push({
        type: "refresh",
        timestamp: Date.now(),
      });
      kioskCommands.set(user.id, existingCommands);

      fastify.log.info(`Kiosk refresh triggered by user ${user.id}`);

      return { success: true };
    }
  );

  // Poll for kiosk commands - public (kiosk checks for pending commands)
  fastify.get(
    "/kiosk/commands",
    {
      schema: {
        description: "Poll for pending kiosk commands (called by kiosk devices)",
        tags: ["Auth", "Kiosk"],
        querystring: {
          type: "object",
          properties: {
            since: { type: "number", description: "Timestamp to get commands since" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  commands: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string" },
                        timestamp: { type: "number" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const { since } = request.query as { since?: number };
      const sinceTimestamp = since ?? 0;

      // Get the active kiosk owner
      const [kiosk] = await fastify.db
        .select()
        .from(kioskConfig)
        .where(eq(kioskConfig.enabled, true))
        .limit(1);

      if (!kiosk) {
        return {
          success: true,
          data: { commands: [] },
        };
      }

      // Get commands for this kiosk owner newer than 'since' timestamp
      const commands = kioskCommands.get(kiosk.userId) ?? [];
      const newCommands = commands.filter((cmd) => cmd.timestamp > sinceTimestamp);

      return {
        success: true,
        data: { commands: newCommands },
      };
    }
  );
};
