/**
 * News Cache Service
 * Fetches and caches RSS feed articles for all users
 */

import type { FastifyInstance } from "fastify";
import { eq, and, lt, desc, inArray } from "drizzle-orm";
import { newsFeeds, newsArticles } from "@openframe/database/schema";
import { parseRssFeed, type ParsedArticle } from "./rss-parser.js";

// Cache TTL: 30 minutes
const CACHE_TTL_MS = 30 * 60 * 1000;

// Article retention: 7 days
const ARTICLE_RETENTION_DAYS = 7;

// Max articles per feed to keep
const MAX_ARTICLES_PER_FEED = 50;

export class NewsCacheService {
  private fastify: FastifyInstance;
  private refreshPromises = new Map<string, Promise<void>>();
  private lastRefreshTime: Date | null = null;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  /**
   * Check if cache needs refresh
   */
  needsRefresh(): boolean {
    if (!this.lastRefreshTime) return true;
    return Date.now() - this.lastRefreshTime.getTime() > CACHE_TTL_MS;
  }

  /**
   * Refresh a single feed
   */
  async refreshFeed(feedId: string): Promise<{ newArticles: number; errors: string[] }> {
    const errors: string[] = [];
    let newArticles = 0;

    try {
      const [feed] = await this.fastify.db
        .select()
        .from(newsFeeds)
        .where(eq(newsFeeds.id, feedId))
        .limit(1);

      if (!feed) {
        return { newArticles: 0, errors: ["Feed not found"] };
      }

      if (!feed.isActive) {
        return { newArticles: 0, errors: [] };
      }

      this.fastify.log.info({ feedId: feed.id, name: feed.name }, "Refreshing news feed");

      const parsed = await parseRssFeed(feed.feedUrl);

      // Insert new articles, skip duplicates by GUID
      for (const article of parsed.articles) {
        try {
          // Check if article already exists
          const existing = await this.fastify.db
            .select({ id: newsArticles.id })
            .from(newsArticles)
            .where(
              and(
                eq(newsArticles.feedId, feed.id),
                eq(newsArticles.guid, article.guid)
              )
            )
            .limit(1);

          if (existing.length === 0) {
            await this.fastify.db.insert(newsArticles).values({
              feedId: feed.id,
              guid: article.guid,
              title: article.title,
              description: article.description,
              link: article.link,
              imageUrl: article.imageUrl,
              author: article.author,
              publishedAt: article.publishedAt,
            });
            newArticles++;
          }
        } catch (err) {
          // Skip duplicate key errors silently
          if (err instanceof Error && !err.message.includes("duplicate")) {
            errors.push(`Failed to insert article: ${err.message}`);
          }
        }
      }

      // Update last fetched timestamp
      await this.fastify.db
        .update(newsFeeds)
        .set({ lastFetchedAt: new Date() })
        .where(eq(newsFeeds.id, feed.id));

      this.fastify.log.info(
        { feedId: feed.id, name: feed.name, newArticles },
        "Feed refresh complete"
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push(message);
      this.fastify.log.error({ feedId, error: message }, "Failed to refresh feed");
    }

    return { newArticles, errors };
  }

  /**
   * Refresh all feeds for a user
   */
  async refreshUserFeeds(userId: string): Promise<void> {
    // Prevent duplicate refreshes
    const existingPromise = this.refreshPromises.get(userId);
    if (existingPromise) {
      return existingPromise;
    }

    const promise = this._doRefreshUserFeeds(userId);
    this.refreshPromises.set(userId, promise);

    try {
      await promise;
    } finally {
      this.refreshPromises.delete(userId);
    }
  }

  private async _doRefreshUserFeeds(userId: string): Promise<void> {
    this.fastify.log.info(`Refreshing news feeds for user ${userId}`);
    const startTime = Date.now();

    try {
      // Get user's active feeds
      const feeds = await this.fastify.db
        .select()
        .from(newsFeeds)
        .where(and(eq(newsFeeds.userId, userId), eq(newsFeeds.isActive, true)));

      if (feeds.length === 0) {
        return;
      }

      let totalNewArticles = 0;

      // Refresh each feed
      for (const feed of feeds) {
        const result = await this.refreshFeed(feed.id);
        totalNewArticles += result.newArticles;
      }

      const duration = Date.now() - startTime;
      this.fastify.log.info(
        { userId, feedCount: feeds.length, newArticles: totalNewArticles, duration },
        "User feeds refresh complete"
      );
    } catch (error) {
      this.fastify.log.error({ err: error, userId }, "Failed to refresh user feeds");
      throw error;
    }
  }

  /**
   * Refresh all feeds for all users
   */
  async refreshAllFeeds(): Promise<void> {
    this.fastify.log.info("Starting news feed refresh for all users");
    const startTime = Date.now();

    try {
      // Get all unique users with active feeds
      const usersWithFeeds = await this.fastify.db
        .selectDistinct({ userId: newsFeeds.userId })
        .from(newsFeeds)
        .where(eq(newsFeeds.isActive, true));

      const userIds = usersWithFeeds.map((u) => u.userId);
      this.fastify.log.info(`Found ${userIds.length} users with active news feeds`);

      let totalNewArticles = 0;

      // Refresh feeds for each user
      for (const userId of userIds) {
        try {
          await this.refreshUserFeeds(userId);
        } catch (error) {
          this.fastify.log.error({ err: error, userId }, "Failed to refresh feeds for user");
        }
      }

      // Clean up old articles
      await this.cleanupOldArticles();

      this.lastRefreshTime = new Date();
      const duration = Date.now() - startTime;
      this.fastify.log.info(
        { userCount: userIds.length, duration },
        "News feed refresh completed for all users"
      );
    } catch (error) {
      this.fastify.log.error({ err: error }, "Failed to refresh all news feeds");
      throw error;
    }
  }

  /**
   * Clean up old articles
   */
  async cleanupOldArticles(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ARTICLE_RETENTION_DAYS);

    const result = await this.fastify.db
      .delete(newsArticles)
      .where(lt(newsArticles.createdAt, cutoffDate))
      .returning({ id: newsArticles.id });

    if (result.length > 0) {
      this.fastify.log.info(
        { deletedCount: result.length },
        "Cleaned up old news articles"
      );
    }

    return result.length;
  }

  /**
   * Get cache stats
   */
  async getCacheStats(): Promise<{
    feedCount: number;
    articleCount: number;
    lastRefresh: Date | null;
  }> {
    const feeds = await this.fastify.db
      .select({ count: newsFeeds.id })
      .from(newsFeeds);

    const articles = await this.fastify.db
      .select({ count: newsArticles.id })
      .from(newsArticles);

    return {
      feedCount: feeds.length,
      articleCount: articles.length,
      lastRefresh: this.lastRefreshTime,
    };
  }
}

// Singleton instance
let cacheServiceInstance: NewsCacheService | null = null;

export function getNewsCacheService(fastify: FastifyInstance): NewsCacheService {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new NewsCacheService(fastify);
  }
  return cacheServiceInstance;
}
