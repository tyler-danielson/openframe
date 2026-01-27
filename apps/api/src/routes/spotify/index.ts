import type { FastifyPluginAsync } from "fastify";
import { eq, and } from "drizzle-orm";
import { oauthTokens } from "@openframe/database/schema";
import { randomBytes } from "crypto";
import { getCurrentUser } from "../../plugins/auth.js";
import { SpotifyService } from "../../services/spotify.js";

// In-memory OAuth state store
const oauthStateStore = new Map<string, { createdAt: number; returnUrl?: string }>();

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
  // Check Spotify connection status
  fastify.get(
    "/status",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Check Spotify connection status",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);

      const [token] = await fastify.db
        .select()
        .from(oauthTokens)
        .where(
          and(
            eq(oauthTokens.userId, user.id),
            eq(oauthTokens.provider, "spotify")
          )
        )
        .limit(1);

      if (!token) {
        return {
          success: true,
          data: { connected: false },
        };
      }

      try {
        const spotify = new SpotifyService(fastify.db, user.id);
        const spotifyUser = await spotify.getCurrentUser();
        return {
          success: true,
          data: {
            connected: true,
            user: {
              id: spotifyUser.id,
              name: spotifyUser.display_name,
              image: spotifyUser.images?.[0]?.url,
            },
          },
        };
      } catch {
        return {
          success: true,
          data: { connected: false },
        };
      }
    }
  );

  // Spotify OAuth initiation
  fastify.get(
    "/auth",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Initiate Spotify OAuth flow",
        tags: ["Spotify", "OAuth"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const clientId = process.env.SPOTIFY_CLIENT_ID;
      const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

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
      ];

      const url = new URL("https://accounts.spotify.com/authorize");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("scope", scopes.join(" "));
      url.searchParams.set("state", state);

      // Get return URL
      const query = request.query as Record<string, string>;
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

      oauthStateStore.set(state, { createdAt: Date.now(), returnUrl });

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

      // Exchange code for tokens
      const tokenResponse = await fetch(
        "https://accounts.spotify.com/api/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(
              `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
            ).toString("base64")}`,
          },
          body: new URLSearchParams({
            code,
            redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
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

      // Get user from JWT cookie or header
      const authHeader = request.headers.authorization;
      let userId: string | null = null;

      if (authHeader?.startsWith("Bearer ")) {
        try {
          const decoded = fastify.jwt.verify(authHeader.slice(7)) as {
            userId: string;
          };
          userId = decoded.userId;
        } catch {
          // Ignore
        }
      }

      // Try to get userId from cookies if not in header
      if (!userId) {
        const cookies = request.headers.cookie?.split(";") || [];
        for (const cookie of cookies) {
          const [name, value] = cookie.trim().split("=");
          if (name === "accessToken" && value) {
            try {
              const decoded = fastify.jwt.verify(value) as { userId: string };
              userId = decoded.userId;
            } catch {
              // Ignore
            }
          }
        }
      }

      // If we still don't have a user, redirect to login
      if (!userId) {
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        return reply.redirect(
          `${frontendUrl}/login?error=spotify_auth_failed&reason=not_logged_in`
        );
      }

      // Store OAuth tokens
      const [existingOAuth] = await fastify.db
        .select()
        .from(oauthTokens)
        .where(
          and(
            eq(oauthTokens.userId, userId),
            eq(oauthTokens.provider, "spotify")
          )
        )
        .limit(1);

      if (existingOAuth) {
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
        await fastify.db.insert(oauthTokens).values({
          userId,
          provider: "spotify",
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          scope: tokens.scope,
        });
      }

      // Redirect back to frontend
      const baseUrl = storedState.returnUrl
        ? new URL(storedState.returnUrl).origin
        : process.env.FRONTEND_URL || "http://localhost:3000";

      return reply.redirect(`${baseUrl}/settings?tab=spotify&connected=true`);
    }
  );

  // Disconnect Spotify
  fastify.delete(
    "/disconnect",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Disconnect Spotify account",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);

      await fastify.db
        .delete(oauthTokens)
        .where(
          and(
            eq(oauthTokens.userId, user.id),
            eq(oauthTokens.provider, "spotify")
          )
        );

      return { success: true };
    }
  );

  // Get playback state
  fastify.get(
    "/playback",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Get current playback state",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      const spotify = new SpotifyService(fastify.db, user.id);

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
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Get available Spotify devices",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      const spotify = new SpotifyService(fastify.db, user.id);

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
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Start or resume playback",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
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
      const spotify = new SpotifyService(fastify.db, user.id);
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
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Pause playback",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      const spotify = new SpotifyService(fastify.db, user.id);

      await spotify.pause();

      return { success: true };
    }
  );

  // Next track
  fastify.post(
    "/next",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Skip to next track",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      const spotify = new SpotifyService(fastify.db, user.id);

      await spotify.next();

      return { success: true };
    }
  );

  // Previous track
  fastify.post(
    "/previous",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Skip to previous track",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      const spotify = new SpotifyService(fastify.db, user.id);

      await spotify.previous();

      return { success: true };
    }
  );

  // Seek
  fastify.put(
    "/seek",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Seek to position in track",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
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
      const spotify = new SpotifyService(fastify.db, user.id);
      const { positionMs } = request.body as { positionMs: number };

      await spotify.seek(positionMs);

      return { success: true };
    }
  );

  // Set volume
  fastify.put(
    "/volume",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Set playback volume",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
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
      const spotify = new SpotifyService(fastify.db, user.id);
      const { volumePercent } = request.body as { volumePercent: number };

      await spotify.setVolume(volumePercent);

      return { success: true };
    }
  );

  // Set shuffle
  fastify.put(
    "/shuffle",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Set shuffle state",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
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
      const spotify = new SpotifyService(fastify.db, user.id);
      const { state } = request.body as { state: boolean };

      await spotify.setShuffle(state);

      return { success: true };
    }
  );

  // Set repeat
  fastify.put(
    "/repeat",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Set repeat state",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
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
      const spotify = new SpotifyService(fastify.db, user.id);
      const { state } = request.body as { state: "off" | "track" | "context" };

      await spotify.setRepeat(state);

      return { success: true };
    }
  );

  // Transfer playback
  fastify.put(
    "/transfer",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Transfer playback to another device",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
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
      const spotify = new SpotifyService(fastify.db, user.id);
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
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Get user playlists",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            limit: { type: "number", default: 20 },
            offset: { type: "number", default: 0 },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      const spotify = new SpotifyService(fastify.db, user.id);
      const { limit, offset } = request.query as {
        limit?: number;
        offset?: number;
      };

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
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Get recently played tracks",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            limit: { type: "number", default: 20 },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      const spotify = new SpotifyService(fastify.db, user.id);
      const { limit } = request.query as { limit?: number };

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
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Search Spotify",
        tags: ["Spotify"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
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
      const spotify = new SpotifyService(fastify.db, user.id);
      const { q, types, limit } = request.query as {
        q: string;
        types?: string;
        limit?: number;
      };

      const typeArray = types?.split(",") || ["track", "artist", "album", "playlist"];
      const results = await spotify.search(q, typeArray, limit);

      return {
        success: true,
        data: results,
      };
    }
  );
};
