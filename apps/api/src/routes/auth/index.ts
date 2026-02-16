import type { FastifyPluginAsync } from "fastify";
import { eq, and } from "drizzle-orm";
import {
  users,
  refreshTokens,
  apiKeys,
  oauthTokens,
  kioskConfig,
  kiosks,
} from "@openframe/database/schema";
import {
  refreshTokenSchema,
  createApiKeySchema,
} from "@openframe/shared/validators";
import { createHash, randomBytes, randomUUID } from "crypto";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";
import { getCurrentUser } from "../../plugins/auth.js";
import { getCategorySettings } from "../settings/index.js";

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

// In-memory device code store (for QR code login flow)
interface DeviceCodeEntry {
  deviceCode: string;
  userCode: string;
  status: "pending" | "approved" | "expired" | "denied";
  kioskToken?: string;
  expiresAt: number;
  createdAt: number;
}
const deviceCodeStore = new Map<string, DeviceCodeEntry>();
const userCodeIndex = new Map<string, string>(); // userCode → deviceCode

// In-memory TV Connect store (for remote push setup flow)
interface TvConnectEntry {
  registrationId: string;
  status: "pending" | "assigned" | "expired";
  kioskToken?: string;
  ipAddress: string;
  userAgent: string;
  createdAt: number;
  expiresAt: number;
}
const tvConnectStore = new Map<string, TvConnectEntry>();

// Unambiguous characters for user codes (no 0/O, 1/I/L, B/8, 5/S)
const UNAMBIGUOUS_CHARS = "ACDEFGHJKMNPQRTUVWXY2346789";
function generateUserCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += UNAMBIGUOUS_CHARS[Math.floor(Math.random() * UNAMBIGUOUS_CHARS.length)];
  }
  return code;
}

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
  // Clean up expired device codes
  for (const [deviceCode, entry] of deviceCodeStore.entries()) {
    if (now > entry.expiresAt) {
      userCodeIndex.delete(entry.userCode);
      deviceCodeStore.delete(deviceCode);
    }
  }
  // Clean up expired TV connect registrations
  for (const [regId, entry] of tvConnectStore.entries()) {
    if (now > entry.expiresAt) {
      tvConnectStore.delete(regId);
    }
  }
}, 2 * 60 * 1000);

// Helper to get OAuth config from DB settings, falling back to env vars
async function getOAuthConfig(db: any, provider: "google" | "microsoft") {
  const settings = await getCategorySettings(db, provider);
  if (provider === "google") {
    return {
      clientId: settings.client_id || process.env.GOOGLE_CLIENT_ID,
      clientSecret: settings.client_secret || process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_REDIRECT_URI,
    };
  }
  return {
    clientId: settings.client_id || process.env.MICROSOFT_CLIENT_ID,
    clientSecret: settings.client_secret || process.env.MICROSOFT_CLIENT_SECRET,
    tenantId: settings.tenant_id || process.env.MICROSOFT_TENANT_ID || "common",
    redirectUri: process.env.MICROSOFT_REDIRECT_URI,
  };
}

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Email/password login
  fastify.post(
    "/login",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: {
        description: "Login with email and password",
        tags: ["Auth"],
        body: {
          type: "object",
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string" },
          },
          required: ["email", "password"],
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body as {
        email: string;
        password: string;
      };

      // Find user by email
      const [user] = await fastify.db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user || !user.passwordHash) {
        return reply.unauthorized("Invalid email or password");
      }

      // Verify password
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return reply.unauthorized("Invalid email or password");
      }

      // Create session tokens
      const accessToken = fastify.jwt.sign({ userId: user.id });
      const refreshToken = randomBytes(32).toString("base64url");
      const tokenHash = createHash("sha256").update(refreshToken).digest("hex");
      const familyId = randomUUID();

      await fastify.db.insert(refreshTokens).values({
        userId: user.id,
        tokenHash,
        familyId,
        deviceInfo: request.headers["user-agent"],
        ipAddress: request.ip,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      return {
        success: true,
        data: {
          accessToken,
          refreshToken,
          expiresIn: 900,
        },
      };
    }
  );

  // Refresh tokens
  fastify.post(
    "/refresh",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
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
      const googleConfig = await getOAuthConfig(fastify.db, "google");
      const clientId = googleConfig.clientId;
      const redirectUri = googleConfig.redirectUri;

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
            const refererUrl = new URL(referer);
            returnUrl = refererUrl.origin + refererUrl.pathname + refererUrl.search;
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

      // Exchange code for tokens using DB config
      const googleConfig = await getOAuthConfig(fastify.db, "google");

      const tokenResponse = await fetch(
        "https://oauth2.googleapis.com/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: googleConfig.clientId!,
            client_secret: googleConfig.clientSecret!,
            redirect_uri: googleConfig.redirectUri!,
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
    async (request, reply) => {
      const msConfig = await getOAuthConfig(fastify.db, "microsoft");
      const clientId = msConfig.clientId;
      const redirectUri = msConfig.redirectUri;
      const tenantId = (msConfig as any).tenantId || "common";

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
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`
      );
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", scopes.join(" "));
      url.searchParams.set("state", state);

      // Get the return URL from query param (most reliable) or construct from referer
      const query = request.query as Record<string, string>;
      let returnUrl = query.returnUrl;

      if (!returnUrl) {
        const referer = request.headers.referer;
        if (referer) {
          try {
            const refererUrl = new URL(referer);
            returnUrl = refererUrl.origin + refererUrl.pathname + refererUrl.search;
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

  // Microsoft OAuth callback
  fastify.get(
    "/oauth/microsoft/callback",
    {
      schema: {
        description: "Microsoft OAuth callback",
        tags: ["Auth", "OAuth"],
        querystring: {
          type: "object",
          properties: {
            code: { type: "string" },
            state: { type: "string" },
            error: { type: "string" },
            error_description: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const { code, state, error, error_description } = request.query as Record<string, string | undefined>;

      if (error) {
        return reply.badRequest(`OAuth error: ${error}${error_description ? ` - ${error_description}` : ""}`);
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

      // Exchange code for tokens using DB config
      const msConfig = await getOAuthConfig(fastify.db, "microsoft");
      const tenantId = (msConfig as any).tenantId || "common";

      const tokenResponse = await fetch(
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: msConfig.clientId!,
            client_secret: msConfig.clientSecret!,
            redirect_uri: msConfig.redirectUri!,
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

      // Get user info from Microsoft Graph
      const userInfoResponse = await fetch(
        "https://graph.microsoft.com/v1.0/me",
        {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        }
      );

      if (!userInfoResponse.ok) {
        return reply.internalServerError("Failed to get user info");
      }

      const userInfo = await userInfoResponse.json() as {
        mail?: string;
        userPrincipalName?: string;
        displayName?: string;
      };

      const email = userInfo.mail || userInfo.userPrincipalName;
      if (!email) {
        return reply.internalServerError("Failed to get user email");
      }

      // Find or create user
      let [user] = await fastify.db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        [user] = await fastify.db
          .insert(users)
          .values({
            email: email,
            name: userInfo.displayName,
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
            eq(oauthTokens.provider, "microsoft")
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
          provider: "microsoft",
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

  // ============================================================
  // Device Code / QR Login Flow
  // ============================================================

  // Generate a new device code (called by TV)
  fastify.post(
    "/device-code",
    {
      schema: {
        description: "Generate a device code for QR login flow",
        tags: ["Auth", "Device Code"],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  deviceCode: { type: "string" },
                  userCode: { type: "string" },
                  verificationUrl: { type: "string" },
                  expiresIn: { type: "number" },
                },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const deviceCode = randomUUID();
      let userCode = generateUserCode();

      // Ensure user code is unique
      while (userCodeIndex.has(userCode)) {
        userCode = generateUserCode();
      }

      const expiresIn = 600; // 10 minutes
      const entry: DeviceCodeEntry = {
        deviceCode,
        userCode,
        status: "pending",
        expiresAt: Date.now() + expiresIn * 1000,
        createdAt: Date.now(),
      };

      deviceCodeStore.set(deviceCode, entry);
      userCodeIndex.set(userCode, deviceCode);

      // Build verification URL from request origin or FRONTEND_URL
      const frontendUrl =
        process.env.FRONTEND_URL ||
        `${request.protocol}://${request.hostname}`;
      const verificationUrl = `${frontendUrl}/device-login?code=${userCode}`;

      return {
        success: true,
        data: {
          deviceCode,
          userCode,
          verificationUrl,
          expiresIn,
        },
      };
    }
  );

  // Poll for device code approval (called by TV)
  fastify.post(
    "/device-code/poll",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: {
        description: "Poll for device code approval status",
        tags: ["Auth", "Device Code"],
        body: {
          type: "object",
          properties: {
            deviceCode: { type: "string" },
          },
          required: ["deviceCode"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  status: { type: "string" },
                  kioskToken: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { deviceCode } = request.body as { deviceCode: string };
      const entry = deviceCodeStore.get(deviceCode);

      if (!entry) {
        return reply.notFound("Invalid device code");
      }

      if (Date.now() > entry.expiresAt) {
        entry.status = "expired";
        return {
          success: true,
          data: { status: "expired" },
        };
      }

      if (entry.status === "approved" && entry.kioskToken) {
        // Clean up after successful approval
        userCodeIndex.delete(entry.userCode);
        deviceCodeStore.delete(deviceCode);
        return {
          success: true,
          data: { status: "approved", kioskToken: entry.kioskToken },
        };
      }

      return {
        success: true,
        data: { status: entry.status },
      };
    }
  );

  // Verify a user code (called by web app)
  fastify.get(
    "/device-code/verify",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Verify a device user code",
        tags: ["Auth", "Device Code"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            code: { type: "string" },
          },
          required: ["code"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  userCode: { type: "string" },
                  expiresIn: { type: "number" },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { code } = request.query as { code: string };
      const upperCode = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const deviceCode = userCodeIndex.get(upperCode);

      if (!deviceCode) {
        return reply.notFound("Invalid or expired code");
      }

      const entry = deviceCodeStore.get(deviceCode);
      if (!entry || Date.now() > entry.expiresAt) {
        return reply.notFound("Code has expired");
      }

      if (entry.status !== "pending") {
        return reply.badRequest("Code has already been used");
      }

      const expiresIn = Math.floor((entry.expiresAt - Date.now()) / 1000);

      return {
        success: true,
        data: {
          userCode: entry.userCode,
          expiresIn,
        },
      };
    }
  );

  // Approve a device code (called by web app)
  fastify.post(
    "/device-code/approve",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Approve a device code and create a kiosk",
        tags: ["Auth", "Device Code"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            userCode: { type: "string" },
            kioskName: { type: "string" },
          },
          required: ["userCode"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  kioskToken: { type: "string" },
                  kioskName: { type: "string" },
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

      const { userCode, kioskName } = request.body as {
        userCode: string;
        kioskName?: string;
      };

      const upperCode = userCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const deviceCode = userCodeIndex.get(upperCode);

      if (!deviceCode) {
        return reply.notFound("Invalid or expired code");
      }

      const entry = deviceCodeStore.get(deviceCode);
      if (!entry || Date.now() > entry.expiresAt) {
        return reply.notFound("Code has expired");
      }

      if (entry.status !== "pending") {
        return reply.badRequest("Code has already been used");
      }

      // Create a new kiosk for this user
      const name = kioskName?.trim() || "TV Kiosk";
      const [newKiosk] = await fastify.db
        .insert(kiosks)
        .values({
          userId: user.id,
          name,
        })
        .returning();

      // Mark the device code as approved with the kiosk token
      entry.status = "approved";
      entry.kioskToken = newKiosk!.token;

      // Also enable kiosk mode for the user if not already enabled
      const [existingKioskConfig] = await fastify.db
        .select()
        .from(kioskConfig)
        .where(eq(kioskConfig.userId, user.id))
        .limit(1);

      if (!existingKioskConfig) {
        await fastify.db.insert(kioskConfig).values({
          userId: user.id,
          enabled: true,
        });
      } else if (!existingKioskConfig.enabled) {
        await fastify.db
          .update(kioskConfig)
          .set({ enabled: true, updatedAt: new Date() })
          .where(eq(kioskConfig.userId, user.id));
      }

      fastify.log.info(
        `Device code approved: user=${user.id}, kiosk=${newKiosk!.id}, name=${name}`
      );

      return {
        success: true,
        data: {
          kioskToken: newKiosk!.token,
          kioskName: name,
        },
      };
    }
  );

  // ============================================================
  // TV Connect / Remote Push Setup Flow
  // ============================================================

  // Register a TV for remote setup (called by TV)
  fastify.post(
    "/tv-connect/register",
    {
      schema: {
        description: "Register a TV for remote push setup",
        tags: ["Auth", "TV Connect"],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  registrationId: { type: "string" },
                  expiresIn: { type: "number" },
                },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const registrationId = randomUUID();
      const expiresIn = 600; // 10 minutes

      const entry: TvConnectEntry = {
        registrationId,
        status: "pending",
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"] || "Unknown",
        createdAt: Date.now(),
        expiresAt: Date.now() + expiresIn * 1000,
      };

      tvConnectStore.set(registrationId, entry);

      fastify.log.info(`TV Connect registered: ${registrationId} from ${request.ip}`);

      return {
        success: true,
        data: {
          registrationId,
          expiresIn,
        },
      };
    }
  );

  // Poll for TV connect assignment (called by TV)
  fastify.post(
    "/tv-connect/poll",
    {
      schema: {
        description: "Poll for TV connect assignment status",
        tags: ["Auth", "TV Connect"],
        body: {
          type: "object",
          properties: {
            registrationId: { type: "string" },
          },
          required: ["registrationId"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  status: { type: "string" },
                  kioskToken: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { registrationId } = request.body as { registrationId: string };
      const entry = tvConnectStore.get(registrationId);

      if (!entry) {
        return reply.notFound("Invalid registration ID");
      }

      if (Date.now() > entry.expiresAt) {
        entry.status = "expired";
        return {
          success: true,
          data: { status: "expired" },
        };
      }

      if (entry.status === "assigned" && entry.kioskToken) {
        // Clean up after successful assignment pickup
        tvConnectStore.delete(registrationId);
        return {
          success: true,
          data: { status: "assigned", kioskToken: entry.kioskToken },
        };
      }

      return {
        success: true,
        data: { status: entry.status },
      };
    }
  );

  // List pending TV connect registrations (called by web app)
  fastify.get(
    "/tv-connect/pending",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "List pending TV connect registrations",
        tags: ["Auth", "TV Connect"],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    registrationId: { type: "string" },
                    ipAddress: { type: "string" },
                    userAgent: { type: "string" },
                    createdAt: { type: "number" },
                    expiresAt: { type: "number" },
                  },
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

      const now = Date.now();
      const pending: Array<{
        registrationId: string;
        ipAddress: string;
        userAgent: string;
        createdAt: number;
        expiresAt: number;
      }> = [];

      for (const entry of tvConnectStore.values()) {
        if (entry.status === "pending" && now < entry.expiresAt) {
          pending.push({
            registrationId: entry.registrationId,
            ipAddress: entry.ipAddress,
            userAgent: entry.userAgent,
            createdAt: entry.createdAt,
            expiresAt: entry.expiresAt,
          });
        }
      }

      return {
        success: true,
        data: pending,
      };
    }
  );

  // Assign a kiosk to a pending TV (called by web app)
  fastify.post(
    "/tv-connect/assign",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Assign a kiosk to a pending TV connect registration",
        tags: ["Auth", "TV Connect"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            registrationId: { type: "string" },
            kioskId: { type: "string" },
          },
          required: ["registrationId", "kioskId"],
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
        return reply.unauthorized("Not authenticated");
      }

      const { registrationId, kioskId } = request.body as {
        registrationId: string;
        kioskId: string;
      };

      // Find the pending registration
      const entry = tvConnectStore.get(registrationId);
      if (!entry || entry.status !== "pending") {
        return reply.notFound("Registration not found or already assigned");
      }

      if (Date.now() > entry.expiresAt) {
        entry.status = "expired";
        return reply.badRequest("Registration has expired");
      }

      // Look up the kiosk (scoped to user)
      const [kiosk] = await fastify.db
        .select()
        .from(kiosks)
        .where(and(eq(kiosks.id, kioskId), eq(kiosks.userId, user.id)))
        .limit(1);

      if (!kiosk) {
        return reply.notFound("Kiosk not found");
      }

      // Mark the registration as assigned
      entry.status = "assigned";
      entry.kioskToken = kiosk.token;

      // Enable kiosk config for user if not already enabled
      const [existingKioskConfig] = await fastify.db
        .select()
        .from(kioskConfig)
        .where(eq(kioskConfig.userId, user.id))
        .limit(1);

      if (!existingKioskConfig) {
        await fastify.db.insert(kioskConfig).values({
          userId: user.id,
          enabled: true,
        });
      } else if (!existingKioskConfig.enabled) {
        await fastify.db
          .update(kioskConfig)
          .set({ enabled: true, updatedAt: new Date() })
          .where(eq(kioskConfig.userId, user.id));
      }

      fastify.log.info(
        `TV Connect assigned: reg=${registrationId}, kiosk=${kiosk.id}, user=${user.id}`
      );

      return { success: true };
    }
  );
};
