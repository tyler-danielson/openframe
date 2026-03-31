import type { FastifyPluginAsync } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import {
  siriusxmAccounts,
  siriusxmFavorites,
  siriusxmHistory,
} from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";
import { encrypt, decrypt } from "../../lib/encryption.js";
import { SiriusXMClient } from "../../services/siriusxm.js";

// Per-user client cache (keyed by user ID)
const clientCache = new Map<string, SiriusXMClient>();

async function getClientForUser(
  db: any,
  userId: string
): Promise<SiriusXMClient | null> {
  // Check cache first
  const cached = clientCache.get(userId);
  if (cached) return cached;

  const [account] = await db
    .select()
    .from(siriusxmAccounts)
    .where(
      and(eq(siriusxmAccounts.userId, userId), eq(siriusxmAccounts.isActive, true))
    )
    .limit(1);

  if (!account) return null;

  let password: string;
  try {
    password = decrypt(account.password);
  } catch {
    password = account.password;
  }

  const client = new SiriusXMClient(account.username, password, account.id);
  clientCache.set(userId, client);
  return client;
}

export const siriusxmRoutes: FastifyPluginAsync = async (fastify) => {
  // ==================== ACCOUNT ====================

  // Get account status
  fastify.get(
    "/account",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get SiriusXM account status",
        tags: ["SiriusXM"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const [account] = await fastify.db
        .select({
          id: siriusxmAccounts.id,
          username: siriusxmAccounts.username,
          isActive: siriusxmAccounts.isActive,
          lastAuthenticatedAt: siriusxmAccounts.lastAuthenticatedAt,
          createdAt: siriusxmAccounts.createdAt,
        })
        .from(siriusxmAccounts)
        .where(eq(siriusxmAccounts.userId, user.id))
        .limit(1);

      return {
        success: true,
        data: account
          ? { connected: true, ...account }
          : { connected: false },
      };
    }
  );

  // Connect SiriusXM account
  fastify.post(
    "/account",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Connect SiriusXM account",
        tags: ["SiriusXM"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { username, password } = request.body as {
        username: string;
        password: string;
      };

      if (!username || !password) {
        throw fastify.httpErrors.badRequest("Username and password required");
      }

      // Validate credentials
      try {
        const valid = await SiriusXMClient.validateCredentials(
          username,
          password
        );
        if (!valid) {
          throw fastify.httpErrors.unauthorized(
            "Invalid SiriusXM credentials"
          );
        }
      } catch (err: any) {
        throw fastify.httpErrors.unauthorized(
          err.message || "Failed to authenticate with SiriusXM"
        );
      }

      // Delete existing account if any
      await fastify.db
        .delete(siriusxmAccounts)
        .where(eq(siriusxmAccounts.userId, user.id));

      // Save new account with encrypted password
      const encryptedPassword = encrypt(password);

      const [account] = await fastify.db
        .insert(siriusxmAccounts)
        .values({
          userId: user.id,
          username,
          password: encryptedPassword,
          lastAuthenticatedAt: new Date(),
        })
        .returning();

      // Clear any cached client
      clientCache.delete(user.id);

      return {
        success: true,
        data: {
          id: account.id,
          username: account.username,
          connected: true,
        },
      };
    }
  );

  // Disconnect SiriusXM account
  fastify.delete(
    "/account",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Disconnect SiriusXM account",
        tags: ["SiriusXM"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      await fastify.db
        .delete(siriusxmAccounts)
        .where(eq(siriusxmAccounts.userId, user.id));

      // Clear cached client
      const client = clientCache.get(user.id);
      if (client) {
        client.clearSession();
        clientCache.delete(user.id);
      }

      return { success: true };
    }
  );

  // ==================== CHANNELS ====================

  // List channels
  fastify.get(
    "/channels",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "List SiriusXM channels",
        tags: ["SiriusXM"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const client = await getClientForUser(fastify.db, user.id);
      if (!client) {
        throw fastify.httpErrors.preconditionRequired(
          "SiriusXM account not connected"
        );
      }

      const query = request.query as {
        category?: string;
        search?: string;
        refresh?: string;
      };

      try {
        let channels = await client.getChannels(query.refresh === "true");

        // Filter by category
        if (query.category) {
          channels = channels.filter(
            (c) =>
              c.category.toLowerCase() === query.category!.toLowerCase()
          );
        }

        // Filter by search
        if (query.search) {
          const search = query.search.toLowerCase();
          channels = channels.filter(
            (c) =>
              c.name.toLowerCase().includes(search) ||
              c.shortName.toLowerCase().includes(search) ||
              String(c.channelNumber).includes(search) ||
              c.nowPlaying?.title?.toLowerCase().includes(search) ||
              c.nowPlaying?.artist?.toLowerCase().includes(search)
          );
        }

        // Get categories for filter UI
        const categories = [
          ...new Set(
            (await client.getChannels()).map((c) => c.category)
          ),
        ].sort();

        return {
          success: true,
          data: { channels, categories },
        };
      } catch (err: any) {
        // If auth fails, clear the cached client
        clientCache.delete(user.id);
        throw fastify.httpErrors.serviceUnavailable(
          `SiriusXM error: ${err.message}`
        );
      }
    }
  );

  // ==================== STREAM PROXY ====================

  // Get stream info for a channel (returns proxy URL)
  fastify.get(
    "/channels/:channelId/stream",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get stream URL for a SiriusXM channel",
        tags: ["SiriusXM"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { channelId } = request.params as { channelId: string };

      const client = await getClientForUser(fastify.db, user.id);
      if (!client) {
        throw fastify.httpErrors.preconditionRequired(
          "SiriusXM account not connected"
        );
      }

      // Return the proxy URL — the actual HLS playlist is served from our stream proxy
      const baseUrl = `/api/v1/siriusxm/stream/${channelId}`;
      return {
        success: true,
        data: {
          streamUrl: `${baseUrl}/playlist.m3u8`,
          channelId,
        },
      };
    }
  );

  // Proxy HLS playlist
  fastify.get(
    "/stream/:channelId/playlist.m3u8",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Proxy SiriusXM HLS playlist",
        tags: ["SiriusXM"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { channelId } = request.params as { channelId: string };

      const client = await getClientForUser(fastify.db, user.id);
      if (!client) {
        throw fastify.httpErrors.preconditionRequired(
          "SiriusXM account not connected"
        );
      }

      try {
        const proxyBaseUrl = `/api/v1/siriusxm/stream/${channelId}`;
        const playlist = await client.getPlaylist(channelId, proxyBaseUrl);

        reply.type("application/vnd.apple.mpegurl");
        reply.header("Cache-Control", "no-cache, no-store");
        return playlist;
      } catch (err: any) {
        clientCache.delete(user.id);
        throw fastify.httpErrors.serviceUnavailable(
          `Stream error: ${err.message}`
        );
      }
    }
  );

  // Proxy HLS segment
  fastify.get(
    "/stream/:channelId/segment/:segmentUrl",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Proxy SiriusXM HLS audio segment",
        tags: ["SiriusXM"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { segmentUrl } = request.params as { segmentUrl: string };

      const client = await getClientForUser(fastify.db, user.id);
      if (!client) {
        throw fastify.httpErrors.preconditionRequired(
          "SiriusXM account not connected"
        );
      }

      try {
        const decodedUrl = decodeURIComponent(segmentUrl);
        const segment = await client.getSegment(decodedUrl);

        reply.type("audio/aac");
        reply.header("Cache-Control", "no-cache");
        return reply.send(segment);
      } catch (err: any) {
        throw fastify.httpErrors.serviceUnavailable(
          `Segment error: ${err.message}`
        );
      }
    }
  );

  // Proxy HLS key
  fastify.get(
    "/stream/:channelId/key",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "SiriusXM HLS decryption key",
        tags: ["SiriusXM"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const client = await getClientForUser(fastify.db, user.id);
      if (!client) {
        throw fastify.httpErrors.preconditionRequired(
          "SiriusXM account not connected"
        );
      }

      reply.type("application/octet-stream");
      reply.header("Cache-Control", "no-cache");
      return reply.send(client.getHLSKey());
    }
  );

  // ==================== FAVORITES ====================

  // List favorites
  fastify.get(
    "/favorites",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "List SiriusXM favorite channels",
        tags: ["SiriusXM"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const favorites = await fastify.db
        .select()
        .from(siriusxmFavorites)
        .where(eq(siriusxmFavorites.userId, user.id))
        .orderBy(desc(siriusxmFavorites.createdAt));

      return { success: true, data: favorites };
    }
  );

  // Add favorite
  fastify.post(
    "/favorites/:channelId",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Add SiriusXM channel to favorites",
        tags: ["SiriusXM"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { channelId } = request.params as { channelId: string };
      const { channelName } = (request.body as { channelName?: string }) || {};

      // Check if already favorited
      const [existing] = await fastify.db
        .select()
        .from(siriusxmFavorites)
        .where(
          and(
            eq(siriusxmFavorites.userId, user.id),
            eq(siriusxmFavorites.channelId, channelId)
          )
        )
        .limit(1);

      if (existing) {
        return { success: true, data: existing };
      }

      const [favorite] = await fastify.db
        .insert(siriusxmFavorites)
        .values({
          userId: user.id,
          channelId,
          channelName: channelName || channelId,
        })
        .returning();

      return { success: true, data: favorite };
    }
  );

  // Remove favorite
  fastify.delete(
    "/favorites/:channelId",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Remove SiriusXM channel from favorites",
        tags: ["SiriusXM"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { channelId } = request.params as { channelId: string };

      await fastify.db
        .delete(siriusxmFavorites)
        .where(
          and(
            eq(siriusxmFavorites.userId, user.id),
            eq(siriusxmFavorites.channelId, channelId)
          )
        );

      return { success: true };
    }
  );

  // ==================== HISTORY ====================

  // Get listen history
  fastify.get(
    "/history",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get SiriusXM listen history",
        tags: ["SiriusXM"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const query = request.query as { limit?: string };
      const limit = Math.min(Number(query.limit) || 20, 100);

      const history = await fastify.db
        .select()
        .from(siriusxmHistory)
        .where(eq(siriusxmHistory.userId, user.id))
        .orderBy(desc(siriusxmHistory.listenedAt))
        .limit(limit);

      return { success: true, data: history };
    }
  );

  // Record listen
  fastify.post(
    "/history/:channelId",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Record SiriusXM listen event",
        tags: ["SiriusXM"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { channelId } = request.params as { channelId: string };
      const { channelName } = (request.body as { channelName?: string }) || {};

      const [entry] = await fastify.db
        .insert(siriusxmHistory)
        .values({
          userId: user.id,
          channelId,
          channelName: channelName || channelId,
        })
        .returning();

      return { success: true, data: entry };
    }
  );
};
