import type { FastifyPluginAsync } from "fastify";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import {
  iptvServers,
  iptvCategories,
  iptvChannels,
  iptvFavorites,
  iptvWatchHistory,
  iptvEpg,
} from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";
import { XtremeCodesClient } from "../../services/xtreme-codes.js";
import { getIptvCacheService } from "../../services/iptv-cache.js";

export const iptvRoutes: FastifyPluginAsync = async (fastify) => {
  // ==================== SERVERS ====================

  // List IPTV servers
  fastify.get(
    "/servers",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "List user's IPTV servers",
        tags: ["IPTV"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const servers = await fastify.db
        .select()
        .from(iptvServers)
        .where(eq(iptvServers.userId, user.id))
        .orderBy(desc(iptvServers.createdAt));

      // Get counts for each server
      const serversWithCounts = await Promise.all(
        servers.map(async (server) => {
          const [categoryCount] = await fastify.db
            .select({ count: sql<number>`count(*)` })
            .from(iptvCategories)
            .where(eq(iptvCategories.serverId, server.id));

          const [channelCount] = await fastify.db
            .select({ count: sql<number>`count(*)` })
            .from(iptvChannels)
            .where(eq(iptvChannels.serverId, server.id));

          return {
            id: server.id,
            userId: server.userId,
            name: server.name,
            serverUrl: server.serverUrl,
            username: server.username,
            isActive: server.isActive,
            lastSyncedAt: server.lastSyncedAt,
            createdAt: server.createdAt,
            updatedAt: server.updatedAt,
            categoryCount: Number(categoryCount?.count || 0),
            channelCount: Number(channelCount?.count || 0),
          };
        })
      );

      return { success: true, data: serversWithCounts };
    }
  );

  // Add IPTV server
  fastify.post(
    "/servers",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Add a new IPTV server",
        tags: ["IPTV"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            serverUrl: { type: "string" },
            username: { type: "string" },
            password: { type: "string" },
          },
          required: ["name", "serverUrl", "username", "password"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { name, serverUrl, username, password } = request.body as {
        name: string;
        serverUrl: string;
        username: string;
        password: string;
      };

      // Validate credentials by authenticating
      const client = new XtremeCodesClient({ serverUrl, username, password });

      try {
        await client.authenticate();
      } catch (error) {
        return reply.badRequest(
          `Failed to authenticate with server: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }

      const [server] = await fastify.db
        .insert(iptvServers)
        .values({
          userId: user.id,
          name,
          serverUrl,
          username,
          password,
        })
        .returning();

      return reply.status(201).send({
        success: true,
        data: {
          id: server!.id,
          userId: server!.userId,
          name: server!.name,
          serverUrl: server!.serverUrl,
          username: server!.username,
          isActive: server!.isActive,
          lastSyncedAt: server!.lastSyncedAt,
          createdAt: server!.createdAt,
          updatedAt: server!.updatedAt,
        },
      });
    }
  );

  // Delete IPTV server
  fastify.delete(
    "/servers/:id",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Delete an IPTV server",
        tags: ["IPTV"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
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
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id } = request.params as { id: string };

      const [server] = await fastify.db
        .select()
        .from(iptvServers)
        .where(and(eq(iptvServers.id, id), eq(iptvServers.userId, user.id)))
        .limit(1);

      if (!server) {
        return reply.notFound("Server not found");
      }

      await fastify.db.delete(iptvServers).where(eq(iptvServers.id, id));

      return { success: true };
    }
  );

  // Sync server channels
  fastify.post(
    "/servers/:id/sync",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Sync channels from an IPTV server",
        tags: ["IPTV"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
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
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id } = request.params as { id: string };

      const [server] = await fastify.db
        .select()
        .from(iptvServers)
        .where(and(eq(iptvServers.id, id), eq(iptvServers.userId, user.id)))
        .limit(1);

      if (!server) {
        return reply.notFound("Server not found");
      }

      const client = new XtremeCodesClient({
        serverUrl: server.serverUrl,
        username: server.username,
        password: server.password,
      });

      try {
        // Fetch categories and streams
        const [categories, streams] = await Promise.all([
          client.getLiveCategories(),
          client.getLiveStreams(),
        ]);

        // Delete existing categories and channels for this server
        await fastify.db
          .delete(iptvCategories)
          .where(eq(iptvCategories.serverId, server.id));

        // Insert categories in batches
        const categoryMap = new Map<string, string>();
        const BATCH_SIZE = 100;

        if (categories.length > 0) {
          const categoryValues = categories.map((cat) => ({
            serverId: server.id,
            externalId: cat.category_id,
            name: cat.category_name,
          }));

          for (let i = 0; i < categoryValues.length; i += BATCH_SIZE) {
            const batch = categoryValues.slice(i, i + BATCH_SIZE);
            const insertedCategories = await fastify.db
              .insert(iptvCategories)
              .values(batch)
              .returning();

            for (const cat of insertedCategories) {
              categoryMap.set(cat.externalId, cat.id);
            }
          }
        }

        // Insert channels in batches to avoid stack overflow
        if (streams.length > 0) {
          const BATCH_SIZE = 100;
          const channelValues = streams.map((stream) => ({
            serverId: server.id,
            categoryId: categoryMap.get(stream.category_id) || null,
            externalId: stream.stream_id.toString(),
            name: stream.name,
            streamUrl: client.buildStreamUrl(stream.stream_id),
            logoUrl: stream.stream_icon || null,
            epgChannelId: stream.epg_channel_id || null,
            streamIcon: stream.stream_icon || null,
          }));

          for (let i = 0; i < channelValues.length; i += BATCH_SIZE) {
            const batch = channelValues.slice(i, i + BATCH_SIZE);
            await fastify.db.insert(iptvChannels).values(batch);
          }
        }

        // Update last synced time
        await fastify.db
          .update(iptvServers)
          .set({ lastSyncedAt: new Date(), updatedAt: new Date() })
          .where(eq(iptvServers.id, server.id));

        return {
          success: true,
          data: {
            categories: categories.length,
            channels: streams.length,
          },
        };
      } catch (error) {
        return reply.internalServerError(
          `Sync failed: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }
  );

  // ==================== CATEGORIES ====================

  // List categories
  fastify.get(
    "/categories",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "List IPTV categories",
        tags: ["IPTV"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        querystring: {
          type: "object",
          properties: {
            serverId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { serverId } = request.query as { serverId?: string };

      // Get user's servers
      const userServers = await fastify.db
        .select({ id: iptvServers.id })
        .from(iptvServers)
        .where(eq(iptvServers.userId, user.id));

      const serverIds = serverId
        ? userServers.filter((s) => s.id === serverId).map((s) => s.id)
        : userServers.map((s) => s.id);

      if (serverIds.length === 0) {
        return { success: true, data: [] };
      }

      const categories = await fastify.db
        .select()
        .from(iptvCategories)
        .where(inArray(iptvCategories.serverId, serverIds));

      // Get channel counts
      const categoriesWithCounts = await Promise.all(
        categories.map(async (cat) => {
          const [countResult] = await fastify.db
            .select({ count: sql<number>`count(*)` })
            .from(iptvChannels)
            .where(eq(iptvChannels.categoryId, cat.id));

          return {
            id: cat.id,
            serverId: cat.serverId,
            externalId: cat.externalId,
            name: cat.name,
            channelCount: Number(countResult?.count || 0),
          };
        })
      );

      return { success: true, data: categoriesWithCounts };
    }
  );

  // ==================== CHANNELS ====================

  // List channels
  fastify.get(
    "/channels",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "List IPTV channels",
        tags: ["IPTV"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        querystring: {
          type: "object",
          properties: {
            serverId: { type: "string", format: "uuid" },
            categoryId: { type: "string", format: "uuid" },
            search: { type: "string" },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { serverId, categoryId, search } = request.query as {
        serverId?: string;
        categoryId?: string;
        search?: string;
      };

      // Get user's servers
      const userServers = await fastify.db
        .select({ id: iptvServers.id })
        .from(iptvServers)
        .where(eq(iptvServers.userId, user.id));

      const serverIds = serverId
        ? userServers.filter((s) => s.id === serverId).map((s) => s.id)
        : userServers.map((s) => s.id);

      if (serverIds.length === 0) {
        return { success: true, data: [] };
      }

      // Get user's favorites
      const favorites = await fastify.db
        .select({ channelId: iptvFavorites.channelId })
        .from(iptvFavorites)
        .where(eq(iptvFavorites.userId, user.id));
      const favoriteIds = new Set(favorites.map((f) => f.channelId));

      // Build query
      let channels = await fastify.db
        .select({
          channel: iptvChannels,
          categoryName: iptvCategories.name,
        })
        .from(iptvChannels)
        .leftJoin(iptvCategories, eq(iptvChannels.categoryId, iptvCategories.id))
        .where(inArray(iptvChannels.serverId, serverIds));

      // Filter by category
      if (categoryId) {
        channels = channels.filter((c) => c.channel.categoryId === categoryId);
      }

      // Filter by search
      if (search) {
        const searchLower = search.toLowerCase();
        channels = channels.filter((c) =>
          c.channel.name.toLowerCase().includes(searchLower)
        );
      }

      return {
        success: true,
        data: channels.map((c) => ({
          id: c.channel.id,
          serverId: c.channel.serverId,
          categoryId: c.channel.categoryId,
          externalId: c.channel.externalId,
          name: c.channel.name,
          streamUrl: c.channel.streamUrl,
          logoUrl: c.channel.logoUrl,
          epgChannelId: c.channel.epgChannelId,
          streamIcon: c.channel.streamIcon,
          isFavorite: favoriteIds.has(c.channel.id),
          categoryName: c.categoryName,
        })),
      };
    }
  );

  // Get channel stream URL
  fastify.get(
    "/channels/:id/stream",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get stream URL for a channel",
        tags: ["IPTV"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
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
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id } = request.params as { id: string };

      // Get channel and verify ownership
      const [result] = await fastify.db
        .select({
          channel: iptvChannels,
          server: iptvServers,
        })
        .from(iptvChannels)
        .innerJoin(iptvServers, eq(iptvChannels.serverId, iptvServers.id))
        .where(
          and(eq(iptvChannels.id, id), eq(iptvServers.userId, user.id))
        )
        .limit(1);

      if (!result) {
        return reply.notFound("Channel not found");
      }

      // Build fresh stream URL
      const client = new XtremeCodesClient({
        serverUrl: result.server.serverUrl,
        username: result.server.username,
        password: result.server.password,
      });

      const streamUrl = client.buildStreamUrl(result.channel.externalId);

      return {
        success: true,
        data: {
          streamUrl,
          channelId: result.channel.id,
          channelName: result.channel.name,
        },
      };
    }
  );

  // Get channel EPG
  fastify.get(
    "/channels/:id/epg",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get EPG for a channel",
        tags: ["IPTV"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
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
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id } = request.params as { id: string };

      // Get channel and verify ownership
      const [result] = await fastify.db
        .select({
          channel: iptvChannels,
          server: iptvServers,
        })
        .from(iptvChannels)
        .innerJoin(iptvServers, eq(iptvChannels.serverId, iptvServers.id))
        .where(
          and(eq(iptvChannels.id, id), eq(iptvServers.userId, user.id))
        )
        .limit(1);

      if (!result) {
        return reply.notFound("Channel not found");
      }

      // Fetch EPG from server
      const client = new XtremeCodesClient({
        serverUrl: result.server.serverUrl,
        username: result.server.username,
        password: result.server.password,
      });

      try {
        // Use epgChannelId if available, otherwise fall back to externalId
        const epgId = result.channel.epgChannelId || result.channel.externalId;
        const epgData = await client.getEpg(epgId, 20);

        const epgEntries = epgData.map((entry) => ({
          id: entry.id,
          channelId: result.channel.id,
          title: entry.title,
          description: entry.description || null,
          startTime: new Date(parseInt(entry.start_timestamp) * 1000),
          endTime: new Date(parseInt(entry.stop_timestamp) * 1000),
        }));

        return { success: true, data: epgEntries };
      } catch (error) {
        // Return empty EPG if fetch fails
        return { success: true, data: [] };
      }
    }
  );

  // ==================== FAVORITES ====================

  // List favorites
  fastify.get(
    "/favorites",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "List favorite channels",
        tags: ["IPTV"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const favorites = await fastify.db
        .select({
          favorite: iptvFavorites,
          channel: iptvChannels,
          categoryName: iptvCategories.name,
        })
        .from(iptvFavorites)
        .innerJoin(iptvChannels, eq(iptvFavorites.channelId, iptvChannels.id))
        .leftJoin(iptvCategories, eq(iptvChannels.categoryId, iptvCategories.id))
        .where(eq(iptvFavorites.userId, user.id))
        .orderBy(desc(iptvFavorites.createdAt));

      return {
        success: true,
        data: favorites.map((f) => ({
          id: f.channel.id,
          serverId: f.channel.serverId,
          categoryId: f.channel.categoryId,
          externalId: f.channel.externalId,
          name: f.channel.name,
          streamUrl: f.channel.streamUrl,
          logoUrl: f.channel.logoUrl,
          epgChannelId: f.channel.epgChannelId,
          streamIcon: f.channel.streamIcon,
          isFavorite: true,
          categoryName: f.categoryName,
        })),
      };
    }
  );

  // Add to favorites
  fastify.post(
    "/favorites/:channelId",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Add channel to favorites",
        tags: ["IPTV"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: {
            channelId: { type: "string", format: "uuid" },
          },
          required: ["channelId"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { channelId } = request.params as { channelId: string };

      // Verify channel belongs to user's server
      const [channel] = await fastify.db
        .select()
        .from(iptvChannels)
        .innerJoin(iptvServers, eq(iptvChannels.serverId, iptvServers.id))
        .where(
          and(eq(iptvChannels.id, channelId), eq(iptvServers.userId, user.id))
        )
        .limit(1);

      if (!channel) {
        return reply.notFound("Channel not found");
      }

      // Check if already favorited
      const [existing] = await fastify.db
        .select()
        .from(iptvFavorites)
        .where(
          and(
            eq(iptvFavorites.userId, user.id),
            eq(iptvFavorites.channelId, channelId)
          )
        )
        .limit(1);

      if (existing) {
        return { success: true, data: { added: false, message: "Already in favorites" } };
      }

      await fastify.db.insert(iptvFavorites).values({
        userId: user.id,
        channelId,
      });

      return reply.status(201).send({
        success: true,
        data: { added: true },
      });
    }
  );

  // Remove from favorites
  fastify.delete(
    "/favorites/:channelId",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Remove channel from favorites",
        tags: ["IPTV"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: {
            channelId: { type: "string", format: "uuid" },
          },
          required: ["channelId"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { channelId } = request.params as { channelId: string };

      const result = await fastify.db
        .delete(iptvFavorites)
        .where(
          and(
            eq(iptvFavorites.userId, user.id),
            eq(iptvFavorites.channelId, channelId)
          )
        );

      return { success: true };
    }
  );

  // ==================== WATCH HISTORY ====================

  // Get watch history
  fastify.get(
    "/history",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get watch history",
        tags: ["IPTV"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", default: 20 },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { limit = 20 } = request.query as { limit?: number };

      // Get user's favorites for marking
      const favorites = await fastify.db
        .select({ channelId: iptvFavorites.channelId })
        .from(iptvFavorites)
        .where(eq(iptvFavorites.userId, user.id));
      const favoriteIds = new Set(favorites.map((f) => f.channelId));

      const history = await fastify.db
        .select({
          history: iptvWatchHistory,
          channel: iptvChannels,
          categoryName: iptvCategories.name,
        })
        .from(iptvWatchHistory)
        .innerJoin(iptvChannels, eq(iptvWatchHistory.channelId, iptvChannels.id))
        .leftJoin(iptvCategories, eq(iptvChannels.categoryId, iptvCategories.id))
        .where(eq(iptvWatchHistory.userId, user.id))
        .orderBy(desc(iptvWatchHistory.watchedAt))
        .limit(limit);

      // Deduplicate by channel (keep most recent)
      const seen = new Set<string>();
      const uniqueHistory = history.filter((h) => {
        if (seen.has(h.channel.id)) return false;
        seen.add(h.channel.id);
        return true;
      });

      return {
        success: true,
        data: uniqueHistory.map((h) => ({
          id: h.channel.id,
          serverId: h.channel.serverId,
          categoryId: h.channel.categoryId,
          externalId: h.channel.externalId,
          name: h.channel.name,
          streamUrl: h.channel.streamUrl,
          logoUrl: h.channel.logoUrl,
          epgChannelId: h.channel.epgChannelId,
          streamIcon: h.channel.streamIcon,
          isFavorite: favoriteIds.has(h.channel.id),
          categoryName: h.categoryName,
          watchedAt: h.history.watchedAt,
        })),
      };
    }
  );

  // Record watch event
  fastify.post(
    "/history/:channelId",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Record a channel watch event",
        tags: ["IPTV"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: {
            channelId: { type: "string", format: "uuid" },
          },
          required: ["channelId"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { channelId } = request.params as { channelId: string };

      // Verify channel belongs to user's server
      const [channel] = await fastify.db
        .select()
        .from(iptvChannels)
        .innerJoin(iptvServers, eq(iptvChannels.serverId, iptvServers.id))
        .where(
          and(eq(iptvChannels.id, channelId), eq(iptvServers.userId, user.id))
        )
        .limit(1);

      if (!channel) {
        return reply.notFound("Channel not found");
      }

      await fastify.db.insert(iptvWatchHistory).values({
        userId: user.id,
        channelId,
      });

      return reply.status(201).send({ success: true });
    }
  );

  // ==================== CACHE & GUIDE ====================

  // Get full TV guide (EPG for all channels) from cache
  fastify.get(
    "/guide",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get full TV guide (EPG) from cache for instant loading",
        tags: ["IPTV"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        querystring: {
          type: "object",
          properties: {
            serverId: { type: "string", format: "uuid" },
            categoryId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { serverId, categoryId } = request.query as {
        serverId?: string;
        categoryId?: string;
      };

      const cacheService = getIptvCacheService(fastify);
      const cachedData = await cacheService.getOrLoadCachedData(user.id);

      if (!cachedData) {
        // No cache, return empty - client should trigger refresh
        return {
          success: true,
          data: {
            channels: [],
            categories: [],
            epg: {},
            cached: false,
            lastUpdated: null,
          },
        };
      }

      // Get user's favorites
      const favorites = await fastify.db
        .select({ channelId: iptvFavorites.channelId })
        .from(iptvFavorites)
        .where(eq(iptvFavorites.userId, user.id));
      const favoriteIds = new Set(favorites.map((f) => f.channelId));

      // Filter channels by server and category if specified
      let channels = cachedData.channels;
      if (serverId) {
        channels = channels.filter((c) => c.serverId === serverId);
      }
      if (categoryId) {
        channels = channels.filter((c) => c.categoryId === categoryId);
      }

      // Filter categories by server if specified
      let categories = cachedData.categories;
      if (serverId) {
        categories = categories.filter((c) => c.serverId === serverId);
      }

      // Build EPG map for filtered channels
      const epg: Record<string, Array<{
        id: string;
        title: string;
        description: string | null;
        startTime: string;
        endTime: string;
      }>> = {};

      for (const channel of channels) {
        const channelEpg = cachedData.epg.get(channel.id);
        if (channelEpg && channelEpg.length > 0) {
          epg[channel.id] = channelEpg.map((e) => ({
            id: e.id,
            title: e.title,
            description: e.description,
            startTime: e.startTime.toISOString(),
            endTime: e.endTime.toISOString(),
          }));
        }
      }

      return {
        success: true,
        data: {
          channels: channels.map((c) => ({
            ...c,
            isFavorite: favoriteIds.has(c.id),
          })),
          categories,
          epg,
          cached: true,
          lastUpdated: cachedData.lastUpdated.toISOString(),
        },
      };
    }
  );

  // Refresh cache for current user
  fastify.post(
    "/cache/refresh",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Refresh IPTV cache for current user",
        tags: ["IPTV"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const cacheService = getIptvCacheService(fastify);

      try {
        await cacheService.refreshUserCache(user.id);
        const cachedData = cacheService.getCachedData(user.id);

        return {
          success: true,
          data: {
            channelCount: cachedData?.channels.length || 0,
            categoryCount: cachedData?.categories.length || 0,
            epgChannelCount: cachedData?.epg.size || 0,
            lastUpdated: cachedData?.lastUpdated.toISOString() || null,
          },
        };
      } catch (error) {
        return reply.internalServerError(
          `Cache refresh failed: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }
  );

  // Get cache status
  fastify.get(
    "/cache/status",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get IPTV cache status for current user",
        tags: ["IPTV"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const cacheService = getIptvCacheService(fastify);
      const cachedData = cacheService.getCachedData(user.id);
      const isValid = cacheService.isCacheValid(user.id);

      return {
        success: true,
        data: {
          cached: !!cachedData,
          valid: isValid,
          channelCount: cachedData?.channels.length || 0,
          categoryCount: cachedData?.categories.length || 0,
          epgChannelCount: cachedData?.epg.size || 0,
          lastUpdated: cachedData?.lastUpdated.toISOString() || null,
        },
      };
    }
  );
};
