/**
 * IPTV Cache Service
 * Pre-caches EPG data and channel listings for faster page loads
 */

import type { FastifyInstance } from "fastify";
import { eq, inArray } from "drizzle-orm";
import {
  iptvServers,
  iptvChannels,
  iptvCategories,
} from "@openframe/database/schema";
import { XtremeCodesClient, type XtremeCodesEpgListing } from "./xtreme-codes.js";

export interface CachedEpgEntry {
  id: string;
  channelId: string;
  channelExternalId: string;
  title: string;
  description: string | null;
  startTime: Date;
  endTime: Date;
}

export interface CachedChannelData {
  channels: Array<{
    id: string;
    serverId: string;
    categoryId: string | null;
    externalId: string;
    name: string;
    streamUrl: string;
    logoUrl: string | null;
    epgChannelId: string | null;
    categoryName: string | null;
  }>;
  categories: Array<{
    id: string;
    serverId: string;
    externalId: string;
    name: string;
    channelCount: number;
  }>;
  epg: Map<string, CachedEpgEntry[]>; // channelId -> epg entries
  lastUpdated: Date;
}

// In-memory cache per user
const userCache = new Map<string, CachedChannelData>();
const cacheTimestamps = new Map<string, Date>();

// Cache TTL: 4 hours
const CACHE_TTL_MS = 4 * 60 * 60 * 1000;

export class IptvCacheService {
  private fastify: FastifyInstance;
  private refreshPromises = new Map<string, Promise<void>>();

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  /**
   * Check if cache is valid for a user
   */
  isCacheValid(userId: string): boolean {
    const timestamp = cacheTimestamps.get(userId);
    if (!timestamp) return false;
    return Date.now() - timestamp.getTime() < CACHE_TTL_MS;
  }

  /**
   * Get cached data for a user
   */
  getCachedData(userId: string): CachedChannelData | null {
    if (!this.isCacheValid(userId)) return null;
    return userCache.get(userId) || null;
  }

  /**
   * Get cached EPG for a specific channel
   */
  getCachedEpg(userId: string, channelId: string): CachedEpgEntry[] | null {
    const data = this.getCachedData(userId);
    if (!data) return null;
    return data.epg.get(channelId) || [];
  }

  /**
   * Refresh cache for a specific user (all their servers)
   */
  async refreshUserCache(userId: string): Promise<void> {
    // Prevent duplicate refreshes
    const existingPromise = this.refreshPromises.get(userId);
    if (existingPromise) {
      return existingPromise;
    }

    const promise = this._doRefreshUserCache(userId);
    this.refreshPromises.set(userId, promise);

    try {
      await promise;
    } finally {
      this.refreshPromises.delete(userId);
    }
  }

  private async _doRefreshUserCache(userId: string): Promise<void> {
    this.fastify.log.info(`Refreshing IPTV cache for user ${userId}`);
    const startTime = Date.now();

    try {
      // Get user's servers
      const servers = await this.fastify.db
        .select()
        .from(iptvServers)
        .where(eq(iptvServers.userId, userId));

      if (servers.length === 0) {
        // Clear cache if no servers
        userCache.delete(userId);
        cacheTimestamps.delete(userId);
        return;
      }

      const serverIds = servers.map((s) => s.id);

      // Get categories with channel counts
      const categories = await this.fastify.db
        .select()
        .from(iptvCategories)
        .where(inArray(iptvCategories.serverId, serverIds));

      // Get all channels
      const channelsWithCategories = await this.fastify.db
        .select({
          channel: iptvChannels,
          categoryName: iptvCategories.name,
        })
        .from(iptvChannels)
        .leftJoin(iptvCategories, eq(iptvChannels.categoryId, iptvCategories.id))
        .where(inArray(iptvChannels.serverId, serverIds));

      // Count channels per category
      const categoryChannelCounts = new Map<string, number>();
      for (const { channel } of channelsWithCategories) {
        if (channel.categoryId) {
          categoryChannelCounts.set(
            channel.categoryId,
            (categoryChannelCounts.get(channel.categoryId) || 0) + 1
          );
        }
      }

      // Fetch EPG for all channels from each server
      const epgMap = new Map<string, CachedEpgEntry[]>();

      // Create a map of externalId -> channelId for EPG matching
      const externalIdToChannelId = new Map<string, string>();
      for (const { channel } of channelsWithCategories) {
        externalIdToChannelId.set(channel.externalId, channel.id);
      }

      // Fetch EPG from each server
      for (const server of servers) {
        const client = new XtremeCodesClient({
          serverUrl: server.serverUrl,
          username: server.username,
          password: server.password,
        });

        try {
          // Get channels for this server
          const serverChannels = channelsWithCategories
            .filter((c) => c.channel.serverId === server.id)
            .map((c) => c.channel);

          // Fetch EPG for each channel (batch of 10 concurrent requests)
          // Use epgChannelId if available, otherwise fall back to externalId
          const BATCH_SIZE = 10;
          let epgFetchAttempts = 0;
          let epgFetchSuccesses = 0;

          for (let i = 0; i < serverChannels.length; i += BATCH_SIZE) {
            const batch = serverChannels.slice(i, i + BATCH_SIZE);
            const epgPromises = batch.map(async (channel) => {
              epgFetchAttempts++;
              try {
                // Some providers use epgChannelId for EPG lookups instead of stream_id
                const epgId = channel.epgChannelId || channel.externalId;
                const epgData = await client.getEpg(epgId, 50);

                if (epgData.length > 0) {
                  epgFetchSuccesses++;
                  // Log first successful EPG fetch for debugging
                  if (epgFetchSuccesses === 1) {
                    this.fastify.log.info({
                      channelName: channel.name,
                      epgId,
                      epgCount: epgData.length,
                      firstEntry: epgData[0]?.title
                    }, "First EPG data found");
                  }
                }

                const entries: CachedEpgEntry[] = epgData.map((entry) => ({
                  id: entry.id,
                  channelId: channel.id,
                  channelExternalId: channel.externalId,
                  title: entry.title,
                  description: entry.description || null,
                  startTime: new Date(parseInt(entry.start_timestamp) * 1000),
                  endTime: new Date(parseInt(entry.stop_timestamp) * 1000),
                }));
                return { channelId: channel.id, entries };
              } catch (err) {
                // Log first few errors
                if (epgFetchAttempts <= 3) {
                  this.fastify.log.warn({ err, channelName: channel.name }, "EPG fetch failed");
                }
                return { channelId: channel.id, entries: [] };
              }
            });

            const results = await Promise.all(epgPromises);
            for (const { channelId, entries } of results) {
              if (entries.length > 0) {
                epgMap.set(channelId, entries);
              }
            }
          }

          this.fastify.log.info({
            server: server.name,
            attempts: epgFetchAttempts,
            successes: epgFetchSuccesses
          }, "EPG fetch completed for server");
        } catch (error) {
          this.fastify.log.warn(
            `Failed to fetch EPG from server ${server.name}: ${error}`
          );
        }
      }

      // Build cache data
      const cacheData: CachedChannelData = {
        channels: channelsWithCategories.map(({ channel, categoryName }) => ({
          id: channel.id,
          serverId: channel.serverId,
          categoryId: channel.categoryId,
          externalId: channel.externalId,
          name: channel.name,
          streamUrl: channel.streamUrl,
          logoUrl: channel.logoUrl,
          epgChannelId: channel.epgChannelId,
          categoryName,
        })),
        categories: categories.map((cat) => ({
          id: cat.id,
          serverId: cat.serverId,
          externalId: cat.externalId,
          name: cat.name,
          channelCount: categoryChannelCounts.get(cat.id) || 0,
        })),
        epg: epgMap,
        lastUpdated: new Date(),
      };

      // Store in cache
      userCache.set(userId, cacheData);
      cacheTimestamps.set(userId, new Date());

      const duration = Date.now() - startTime;
      this.fastify.log.info(
        `IPTV cache refreshed for user ${userId}: ${cacheData.channels.length} channels, ${epgMap.size} channels with EPG (${duration}ms)`
      );
    } catch (error) {
      this.fastify.log.error({ err: error, userId }, "Failed to refresh IPTV cache for user");
      throw error;
    }
  }

  /**
   * Refresh cache for all users with IPTV servers
   */
  async refreshAllUsersCache(): Promise<void> {
    this.fastify.log.info("Starting IPTV cache refresh for all users");

    // Get all unique users with IPTV servers
    const usersWithServers = await this.fastify.db
      .selectDistinct({ userId: iptvServers.userId })
      .from(iptvServers);

    const userIds = usersWithServers.map((u) => u.userId);
    this.fastify.log.info(`Found ${userIds.length} users with IPTV servers`);

    // Refresh cache for each user (one at a time to avoid overloading)
    for (const userId of userIds) {
      try {
        await this.refreshUserCache(userId);
      } catch (error) {
        this.fastify.log.error({ err: error, userId }, "Failed to refresh cache for user");
      }
    }

    this.fastify.log.info("IPTV cache refresh completed for all users");
  }

  /**
   * Clear cache for a user
   */
  clearUserCache(userId: string): void {
    userCache.delete(userId);
    cacheTimestamps.delete(userId);
  }

  /**
   * Get cache stats
   */
  getCacheStats(): {
    userCount: number;
    totalChannels: number;
    totalEpgEntries: number;
  } {
    let totalChannels = 0;
    let totalEpgEntries = 0;

    for (const data of userCache.values()) {
      totalChannels += data.channels.length;
      for (const entries of data.epg.values()) {
        totalEpgEntries += entries.length;
      }
    }

    return {
      userCount: userCache.size,
      totalChannels,
      totalEpgEntries,
    };
  }
}

// Singleton instance
let cacheServiceInstance: IptvCacheService | null = null;

export function getIptvCacheService(fastify: FastifyInstance): IptvCacheService {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new IptvCacheService(fastify);
  }
  return cacheServiceInstance;
}
