import type { FastifyPluginAsync } from "fastify";
import { eq, and } from "drizzle-orm";
import { oauthTokens } from "@openframe/database/schema";
import { randomBytes } from "crypto";
import { getCurrentUser } from "../../plugins/auth.js";
import { SpotifyService, setSpotifyCredentials, type SpotifyAccount } from "../../services/spotify.js";
import { getCategorySettings } from "../settings/index.js";
import { isPrivateIp, getRequestOrigin } from "../../utils/oauth-helpers.js";

// Helper to get Spotify OAuth config from DB settings, falling back to env vars
// When requestOrigin is provided, use it as the base URL for redirect URIs.
async function getSpotifyConfig(db: any, requestOrigin?: string) {
  const settings = await getCategorySettings(db, "spotify");
  const serverSettings = await getCategorySettings(db, "server");
  const externalUrl = serverSettings.external_url || process.env.FRONTEND_URL;
  const baseUrl = requestOrigin || (externalUrl ? externalUrl.replace(/\/+$/, "") : null);

  return {
    clientId: settings.client_id || process.env.SPOTIFY_CLIENT_ID,
    clientSecret: settings.client_secret || process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: baseUrl
      ? `${baseUrl}/api/v1/spotify/auth/callback`
      : process.env.SPOTIFY_REDIRECT_URI,
  };
}

// Helper to get frontend URL from DB
async function getFrontendUrl(db: any): Promise<string> {
  const serverSettings = await getCategorySettings(db, "server");
  return serverSettings.external_url || process.env.FRONTEND_URL || "http://localhost:3000";
}

// In-memory OAuth state store
const oauthStateStore = new Map<string, { createdAt: number; returnUrl?: string; userId?: string; requestOrigin?: string }>();

// Clean up expired states every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of oauthStateStore.entries()) {
    if (now - data.createdAt > 10 * 60 * 1000) {
      oauthStateStore.delete(state);
    }
  }
}, 5 * 60 * 1000);

export const spotifyRoutes: FastifyPluginAsync = async (fastify) => {
  // Set Spotify credentials from DB for the SpotifyService token refresh
  const spotifySettings = await getCategorySettings(fastify.db, "spotify");
  if (spotifySettings.client_id || spotifySettings.client_secret) {
    setSpotifyCredentials({
      clientId: spotifySettings.client_id || undefined,
      clientSecret: spotifySettings.client_secret || undefined,
    });
  }

  // Check Spotify connection status (returns all connected accounts)
  fastify.get(
    "/status",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Check Spotify connection status and get all connected accounts",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const accounts = await SpotifyService.getAllAccounts(fastify.db, user.id);

      if (accounts.length === 0) {
        return {
          success: true,
          data: { connected: false, accounts: [] },
        };
      }

      // Fetch Spotify user info for each account
      const accountsWithUsers: SpotifyAccount[] = await Promise.all(
        accounts.map(async (account) => {
          try {
            const spotify = new SpotifyService(fastify.db, user.id, account.id);
            const spotifyUser = await spotify.getCurrentUser();
            return {
              ...account,
              spotifyUser: {
                id: spotifyUser.id,
                display_name: spotifyUser.display_name,
                images: spotifyUser.images,
              },
            };
          } catch {
            return account;
          }
        })
      );

      // For backwards compatibility, also include the primary user info at top level
      const primaryAccount = accountsWithUsers.find((a) => a.isPrimary) || accountsWithUsers[0];

      return {
        success: true,
        data: {
          connected: true,
          accounts: accountsWithUsers,
          // Backwards compatible fields
          user: primaryAccount?.spotifyUser
            ? {
                id: primaryAccount.spotifyUser.id,
                name: primaryAccount.spotifyUser.display_name,
                image: primaryAccount.spotifyUser.images?.[0]?.url,
              }
            : undefined,
        },
      };
    }
  );

  // List all connected Spotify accounts (requires full auth, not kiosk)
  fastify.get(
    "/accounts",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "List all connected Spotify accounts",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const accounts = await SpotifyService.getAllAccounts(fastify.db, user.id);

      // Fetch Spotify user info for each account
      const accountsWithUsers = await Promise.all(
        accounts.map(async (account) => {
          try {
            const spotify = new SpotifyService(fastify.db, user.id, account.id);
            const spotifyUser = await spotify.getCurrentUser();
            return {
              ...account,
              spotifyUser: {
                id: spotifyUser.id,
                display_name: spotifyUser.display_name,
                images: spotifyUser.images,
              },
            };
          } catch {
            return account;
          }
        })
      );

      return {
        success: true,
        data: accountsWithUsers,
      };
    }
  );

  // Update a Spotify account (rename, set primary)
  fastify.patch(
    "/accounts/:id",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Update a Spotify account",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            accountName: { type: "string" },
            isPrimary: { type: "boolean" },
            icon: { type: "string", nullable: true },
            defaultDeviceId: { type: "string", nullable: true },
            favoriteDeviceIds: { type: "array", items: { type: "string" }, nullable: true },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id } = request.params as { id: string };
      const { accountName, isPrimary, icon, defaultDeviceId, favoriteDeviceIds } = request.body as {
        accountName?: string;
        isPrimary?: boolean;
        icon?: string | null;
        defaultDeviceId?: string | null;
        favoriteDeviceIds?: string[] | null;
      };

      await SpotifyService.updateAccount(fastify.db, user.id, id, {
        accountName,
        isPrimary,
        icon,
        defaultDeviceId,
        favoriteDeviceIds,
      });

      return { success: true };
    }
  );

  // Spotify OAuth initiation
  fastify.get(
    "/auth",
    {
      schema: {
        description: "Initiate Spotify OAuth flow",
        tags: ["Spotify", "OAuth"],
        querystring: {
          type: "object",
          properties: {
            token: { type: "string" },
            returnUrl: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      // Get token from query parameter (since this is accessed via link, not fetch)
      const query = request.query as Record<string, string>;
      const token = query.token;

      if (!token) {
        return reply.badRequest("Missing authentication token");
      }

      let userId: string;
      try {
        const decoded = fastify.jwt.verify(token) as { userId: string };
        userId = decoded.userId;
      } catch {
        return reply.unauthorized("Invalid or expired token");
      }

      // Derive redirect URI from the actual request origin
      const requestOrigin = getRequestOrigin(request);
      const originHostname = new URL(requestOrigin).hostname;

      // Block private IPs — OAuth providers reject them and the callback won't reach the server
      if (isPrivateIp(originHostname)) {
        const errorMsg = encodeURIComponent("Cannot start OAuth from a private IP address. Please access this page via localhost or a public domain.");
        return reply.redirect(`${requestOrigin}/settings?tab=entertainment&subtab=spotify&error=${errorMsg}`);
      }

      const spotifyConfig = await getSpotifyConfig(fastify.db, requestOrigin);
      const clientId = spotifyConfig.clientId;
      const redirectUri = spotifyConfig.redirectUri;

      if (!clientId || !redirectUri) {
        return reply.badRequest("Spotify OAuth not configured");
      }

      const state = randomBytes(16).toString("hex");
      const scopes = [
        "user-read-playback-state",
        "user-modify-playback-state",
        "user-read-currently-playing",
        "user-read-recently-played",
        "playlist-read-private",
        "playlist-read-collaborative",
        "streaming",
        "user-library-read",
        "user-library-modify",
        "user-read-playback-position",  // For podcast resume position
      ];

      const url = new URL("https://accounts.spotify.com/authorize");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("scope", scopes.join(" "));
      url.searchParams.set("state", state);
      // Force showing the login dialog so users can choose a different account
      url.searchParams.set("show_dialog", "true");

      // Get return URL
      let returnUrl = query.returnUrl;

      if (!returnUrl) {
        const referer = request.headers.referer;
        if (referer) {
          try {
            returnUrl = new URL(referer).origin + "/spotify";
          } catch {
            // Ignore
          }
        }
      }

      // Store userId and requestOrigin in state so we can retrieve them in callback
      oauthStateStore.set(state, { createdAt: Date.now(), returnUrl, userId, requestOrigin });

      return reply.redirect(url.toString());
    }
  );

  // Spotify OAuth callback
  fastify.get(
    "/auth/callback",
    {
      schema: {
        description: "Spotify OAuth callback",
        tags: ["Spotify", "OAuth"],
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
      const { code, state, error } = request.query as Record<
        string,
        string | undefined
      >;

      if (error) {
        return reply.badRequest(`Spotify OAuth error: ${error}`);
      }

      if (!state) {
        return reply.badRequest("Missing OAuth state");
      }

      const storedState = oauthStateStore.get(state);
      if (!storedState) {
        return reply.badRequest("Invalid OAuth state");
      }

      oauthStateStore.delete(state);

      if (!code) {
        return reply.badRequest("Missing OAuth code");
      }

      // Exchange code for tokens using the same redirect URI from initiation
      const spotifyConfig = await getSpotifyConfig(fastify.db, storedState.requestOrigin);

      const tokenResponse = await fetch(
        "https://accounts.spotify.com/api/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(
              `${spotifyConfig.clientId}:${spotifyConfig.clientSecret}`
            ).toString("base64")}`,
          },
          body: new URLSearchParams({
            code,
            redirect_uri: spotifyConfig.redirectUri!,
            grant_type: "authorization_code",
          }),
        }
      );

      if (!tokenResponse.ok) {
        return reply.internalServerError("Failed to exchange Spotify OAuth code");
      }

      const tokens = (await tokenResponse.json()) as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        scope: string;
      };

      // Get userId from the stored state
      const userId = storedState.userId;

      // If we don't have a user, redirect to login
      if (!userId) {
        const frontendUrl = await getFrontendUrl(fastify.db);
        const spotifyBasePath = (process.env.SPA_BASE_PATH || "").replace(/\/+$/, "");
        return reply.redirect(
          `${frontendUrl}${spotifyBasePath}/login?error=spotify_auth_failed&reason=not_logged_in`
        );
      }

      // Fetch Spotify user info to get external account ID
      const spotifyUserResponse = await fetch("https://api.spotify.com/v1/me", {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });

      let spotifyUserId: string | null = null;
      let spotifyUserName: string | null = null;
      if (spotifyUserResponse.ok) {
        const spotifyUser = (await spotifyUserResponse.json()) as {
          id: string;
          display_name: string;
        };
        spotifyUserId = spotifyUser.id;
        spotifyUserName = spotifyUser.display_name;
      }

      // Check if this specific Spotify account is already connected
      const [existingOAuth] = spotifyUserId
        ? await fastify.db
            .select()
            .from(oauthTokens)
            .where(
              and(
                eq(oauthTokens.userId, userId),
                eq(oauthTokens.provider, "spotify"),
                eq(oauthTokens.externalAccountId, spotifyUserId)
              )
            )
            .limit(1)
        : [null];

      // Check if user has any existing Spotify accounts (for setting isPrimary)
      const existingAccounts = await fastify.db
        .select()
        .from(oauthTokens)
        .where(
          and(
            eq(oauthTokens.userId, userId),
            eq(oauthTokens.provider, "spotify")
          )
        );
      const isFirstAccount = existingAccounts.length === 0;

      if (existingOAuth) {
        // Update existing account if same Spotify user reconnects
        await fastify.db
          .update(oauthTokens)
          .set({
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
            scope: tokens.scope,
            updatedAt: new Date(),
          })
          .where(eq(oauthTokens.id, existingOAuth.id));
      } else {
        // Create new account record
        await fastify.db.insert(oauthTokens).values({
          userId,
          provider: "spotify",
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          scope: tokens.scope,
          externalAccountId: spotifyUserId,
          accountName: spotifyUserName, // Default name from Spotify
          isPrimary: isFirstAccount, // First account is automatically primary
        });
      }

      // Redirect back to frontend
      const frontendUrl = await getFrontendUrl(fastify.db);
      const baseUrl = storedState.returnUrl
        ? new URL(storedState.returnUrl).origin
        : frontendUrl;

      const spotifyBasePath = (process.env.SPA_BASE_PATH || "").replace(/\/+$/, "");
      return reply.redirect(`${baseUrl}${spotifyBasePath}/settings?tab=spotify&connected=true`);
    }
  );

  // Disconnect Spotify (specific account or all)
  fastify.delete(
    "/disconnect",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Disconnect Spotify account(s)",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            accountId: { type: "string", description: "Specific account ID to disconnect. If not provided, disconnects all accounts." },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { accountId } = request.query as { accountId?: string };

      if (accountId) {
        // Disconnect specific account
        await SpotifyService.deleteAccount(fastify.db, user.id, accountId);
      } else {
        // Disconnect all accounts (backwards compatible)
        await fastify.db
          .delete(oauthTokens)
          .where(
            and(
              eq(oauthTokens.userId, user.id),
              eq(oauthTokens.provider, "spotify")
            )
          );
      }

      return { success: true };
    }
  );

  // Get playback state
  fastify.get(
    "/playback",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get current playback state",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            accountId: { type: "string", description: "Specific Spotify account to use" },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { accountId } = request.query as { accountId?: string };
      const spotify = new SpotifyService(fastify.db, user.id, accountId);

      const state = await spotify.getPlaybackState();

      return {
        success: true,
        data: state,
      };
    }
  );

  // Get available devices
  fastify.get(
    "/devices",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get available Spotify devices",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            accountId: { type: "string", description: "Specific Spotify account to use" },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { accountId } = request.query as { accountId?: string };
      const spotify = new SpotifyService(fastify.db, user.id, accountId);

      const devices = await spotify.getDevices();

      return {
        success: true,
        data: devices,
      };
    }
  );

  // Play
  fastify.put(
    "/play",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Start or resume playback",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            accountId: { type: "string", description: "Specific Spotify account to use" },
          },
        },
        body: {
          type: "object",
          properties: {
            deviceId: { type: "string" },
            contextUri: { type: "string" },
            uris: { type: "array", items: { type: "string" } },
            positionMs: { type: "number" },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { accountId } = request.query as { accountId?: string };
      const spotify = new SpotifyService(fastify.db, user.id, accountId);
      const body = request.body as {
        deviceId?: string;
        contextUri?: string;
        uris?: string[];
        positionMs?: number;
      };

      await spotify.play(body);

      return { success: true };
    }
  );

  // Pause
  fastify.put(
    "/pause",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Pause playback",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            accountId: { type: "string", description: "Specific Spotify account to use" },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { accountId } = request.query as { accountId?: string };
      const spotify = new SpotifyService(fastify.db, user.id, accountId);

      await spotify.pause();

      return { success: true };
    }
  );

  // Next track
  fastify.post(
    "/next",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Skip to next track",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            accountId: { type: "string", description: "Specific Spotify account to use" },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { accountId } = request.query as { accountId?: string };
      const spotify = new SpotifyService(fastify.db, user.id, accountId);

      await spotify.next();

      return { success: true };
    }
  );

  // Previous track
  fastify.post(
    "/previous",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Skip to previous track",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            accountId: { type: "string", description: "Specific Spotify account to use" },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { accountId } = request.query as { accountId?: string };
      const spotify = new SpotifyService(fastify.db, user.id, accountId);

      await spotify.previous();

      return { success: true };
    }
  );

  // Seek
  fastify.put(
    "/seek",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Seek to position in track",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            accountId: { type: "string", description: "Specific Spotify account to use" },
          },
        },
        body: {
          type: "object",
          properties: {
            positionMs: { type: "number" },
          },
          required: ["positionMs"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { accountId } = request.query as { accountId?: string };
      const spotify = new SpotifyService(fastify.db, user.id, accountId);
      const { positionMs } = request.body as { positionMs: number };

      await spotify.seek(positionMs);

      return { success: true };
    }
  );

  // Set volume
  fastify.put(
    "/volume",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Set playback volume",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            accountId: { type: "string", description: "Specific Spotify account to use" },
          },
        },
        body: {
          type: "object",
          properties: {
            volumePercent: { type: "number", minimum: 0, maximum: 100 },
          },
          required: ["volumePercent"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { accountId } = request.query as { accountId?: string };
      const spotify = new SpotifyService(fastify.db, user.id, accountId);
      const { volumePercent } = request.body as { volumePercent: number };

      await spotify.setVolume(volumePercent);

      return { success: true };
    }
  );

  // Set shuffle
  fastify.put(
    "/shuffle",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Set shuffle state",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            accountId: { type: "string", description: "Specific Spotify account to use" },
          },
        },
        body: {
          type: "object",
          properties: {
            state: { type: "boolean" },
          },
          required: ["state"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { accountId } = request.query as { accountId?: string };
      const spotify = new SpotifyService(fastify.db, user.id, accountId);
      const { state } = request.body as { state: boolean };

      await spotify.setShuffle(state);

      return { success: true };
    }
  );

  // Set repeat
  fastify.put(
    "/repeat",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Set repeat state",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            accountId: { type: "string", description: "Specific Spotify account to use" },
          },
        },
        body: {
          type: "object",
          properties: {
            state: { type: "string", enum: ["off", "track", "context"] },
          },
          required: ["state"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { accountId } = request.query as { accountId?: string };
      const spotify = new SpotifyService(fastify.db, user.id, accountId);
      const { state } = request.body as { state: "off" | "track" | "context" };

      await spotify.setRepeat(state);

      return { success: true };
    }
  );

  // Transfer playback
  fastify.put(
    "/transfer",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Transfer playback to another device",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            accountId: { type: "string", description: "Specific Spotify account to use" },
          },
        },
        body: {
          type: "object",
          properties: {
            deviceId: { type: "string" },
            play: { type: "boolean" },
          },
          required: ["deviceId"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { accountId } = request.query as { accountId?: string };
      const spotify = new SpotifyService(fastify.db, user.id, accountId);
      const { deviceId, play } = request.body as {
        deviceId: string;
        play?: boolean;
      };

      await spotify.transferPlayback(deviceId, play);

      return { success: true };
    }
  );

  // Get playlists
  fastify.get(
    "/playlists",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get user playlists",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            accountId: { type: "string", description: "Specific Spotify account to use" },
            limit: { type: "number", default: 20 },
            offset: { type: "number", default: 0 },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { accountId, limit, offset } = request.query as {
        accountId?: string;
        limit?: number;
        offset?: number;
      };
      const spotify = new SpotifyService(fastify.db, user.id, accountId);

      const playlists = await spotify.getPlaylists(limit, offset);

      return {
        success: true,
        data: playlists,
      };
    }
  );

  // Get recently played
  fastify.get(
    "/recently-played",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get recently played tracks",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            accountId: { type: "string", description: "Specific Spotify account to use" },
            limit: { type: "number", default: 20 },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { accountId, limit } = request.query as { accountId?: string; limit?: number };
      const spotify = new SpotifyService(fastify.db, user.id, accountId);

      const tracks = await spotify.getRecentlyPlayed(limit);

      return {
        success: true,
        data: tracks,
      };
    }
  );

  // Search
  fastify.get(
    "/search",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Search Spotify",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            accountId: { type: "string", description: "Specific Spotify account to use" },
            q: { type: "string" },
            types: { type: "string" },
            limit: { type: "number", default: 10 },
          },
          required: ["q"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { accountId, q, types, limit } = request.query as {
        accountId?: string;
        q: string;
        types?: string;
        limit?: number;
      };
      const spotify = new SpotifyService(fastify.db, user.id, accountId);

      const typeArray = types?.split(",") || ["track", "artist", "album", "playlist"];
      const results = await spotify.search(q, typeArray, limit);

      return {
        success: true,
        data: results,
      };
    }
  );

  // Check if tracks are saved
  fastify.get(
    "/tracks/saved",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Check if tracks are saved in user library",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            accountId: { type: "string", description: "Specific Spotify account to use" },
            ids: { type: "string", description: "Comma-separated track IDs" },
          },
          required: ["ids"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { accountId, ids } = request.query as { accountId?: string; ids: string };
      const spotify = new SpotifyService(fastify.db, user.id, accountId);

      const trackIds = ids.split(",");
      const saved = await spotify.checkSavedTracks(trackIds);

      return {
        success: true,
        data: saved,
      };
    }
  );

  // Save track to library
  fastify.put(
    "/tracks/save",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Save track to user library",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            accountId: { type: "string", description: "Specific Spotify account to use" },
          },
        },
        body: {
          type: "object",
          properties: {
            trackId: { type: "string" },
          },
          required: ["trackId"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { accountId } = request.query as { accountId?: string };
      const spotify = new SpotifyService(fastify.db, user.id, accountId);
      const { trackId } = request.body as { trackId: string };

      await spotify.saveTrack(trackId);

      return { success: true };
    }
  );

  // Remove track from library
  fastify.delete(
    "/tracks/save",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Remove track from user library",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            accountId: { type: "string", description: "Specific Spotify account to use" },
          },
        },
        body: {
          type: "object",
          properties: {
            trackId: { type: "string" },
          },
          required: ["trackId"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { accountId } = request.query as { accountId?: string };
      const spotify = new SpotifyService(fastify.db, user.id, accountId);
      const { trackId } = request.body as { trackId: string };

      await spotify.unsaveTrack(trackId);

      return { success: true };
    }
  );

  // Get saved shows (podcasts)
  fastify.get(
    "/shows",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get user's saved shows (podcasts)",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            accountId: { type: "string", description: "Specific Spotify account to use" },
            limit: { type: "number", default: 20 },
            offset: { type: "number", default: 0 },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { accountId, limit, offset } = request.query as {
        accountId?: string;
        limit?: number;
        offset?: number;
      };
      const spotify = new SpotifyService(fastify.db, user.id, accountId);

      const shows = await spotify.getSavedShows(limit, offset);

      return {
        success: true,
        data: shows,
      };
    }
  );

  // Get saved episodes
  fastify.get(
    "/episodes",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get user's saved episodes",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            accountId: { type: "string", description: "Specific Spotify account to use" },
            limit: { type: "number", default: 20 },
            offset: { type: "number", default: 0 },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { accountId, limit, offset } = request.query as {
        accountId?: string;
        limit?: number;
        offset?: number;
      };
      const spotify = new SpotifyService(fastify.db, user.id, accountId);

      const episodes = await spotify.getSavedEpisodes(limit, offset);

      return {
        success: true,
        data: episodes,
      };
    }
  );

  // Get saved albums
  fastify.get(
    "/albums",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get user's saved albums",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            accountId: { type: "string", description: "Specific Spotify account to use" },
            limit: { type: "number", default: 20 },
            offset: { type: "number", default: 0 },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { accountId, limit, offset } = request.query as {
        accountId?: string;
        limit?: number;
        offset?: number;
      };
      const spotify = new SpotifyService(fastify.db, user.id, accountId);

      const albums = await spotify.getSavedAlbums(limit, offset);

      return {
        success: true,
        data: albums,
      };
    }
  );

  // Get saved/liked tracks
  fastify.get(
    "/tracks",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get user's saved/liked tracks",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            accountId: { type: "string", description: "Specific Spotify account to use" },
            limit: { type: "number", default: 20 },
            offset: { type: "number", default: 0 },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { accountId, limit, offset } = request.query as {
        accountId?: string;
        limit?: number;
        offset?: number;
      };
      const spotify = new SpotifyService(fastify.db, user.id, accountId);

      const tracks = await spotify.getSavedTracks(limit, offset);

      return {
        success: true,
        data: tracks,
      };
    }
  );
};
