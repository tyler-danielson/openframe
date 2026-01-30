/**
 * News API Routes
 * Endpoints for managing RSS feed subscriptions and fetching articles
 */

import type { FastifyPluginAsync } from "fastify";
import { eq, and, desc, inArray } from "drizzle-orm";
import { newsFeeds, newsArticles } from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";
import { validateFeedUrl } from "../../services/rss-parser.js";
import { getNewsCacheService } from "../../services/news-cache.js";

// Preset NYTimes feeds
const PRESET_FEEDS = [
  { name: "NYT Top Stories", url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml", category: "general" },
  { name: "NYT World", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", category: "world" },
  { name: "NYT US", url: "https://rss.nytimes.com/services/xml/rss/nyt/US.xml", category: "us" },
  { name: "NYT Technology", url: "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml", category: "tech" },
  { name: "NYT Business", url: "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml", category: "business" },
  { name: "NYT Sports", url: "https://rss.nytimes.com/services/xml/rss/nyt/Sports.xml", category: "sports" },
];

export const newsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /news/presets
   * Get list of preset feed options
   */
  fastify.get("/presets", async (_request, reply) => {
    return reply.send({ success: true, data: PRESET_FEEDS });
  });

  /**
   * GET /news/feeds
   * List user's feed subscriptions
   */
  fastify.get("/feeds", {
    onRequest: [fastify.authenticateKioskOrAny],
  }, async (request, reply) => {
    const user = await getCurrentUser(request);
    const userId = user?.id;
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { message: "Unauthorized" },
      });
    }

    const feeds = await fastify.db
      .select()
      .from(newsFeeds)
      .where(eq(newsFeeds.userId, userId))
      .orderBy(newsFeeds.createdAt);

    // Get article counts for each feed
    const feedsWithCounts = await Promise.all(
      feeds.map(async (feed) => {
        const articles = await fastify.db
          .select({ id: newsArticles.id })
          .from(newsArticles)
          .where(eq(newsArticles.feedId, feed.id));

        return {
          ...feed,
          articleCount: articles.length,
        };
      })
    );

    return reply.send({ success: true, data: feedsWithCounts });
  });

  /**
   * POST /news/feeds
   * Subscribe to a feed
   */
  fastify.post<{
    Body: {
      name: string;
      feedUrl: string;
      category?: string;
    };
  }>("/feeds", {
    onRequest: [fastify.authenticateKioskOrAny],
  }, async (request, reply) => {
    const user = await getCurrentUser(request);
    const userId = user?.id;
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { message: "Unauthorized" },
      });
    }

    const { name, feedUrl, category } = request.body;

    if (!name || !feedUrl) {
      return reply.status(400).send({
        success: false,
        error: { message: "name and feedUrl are required" },
      });
    }

    // Validate the feed URL
    const validation = await validateFeedUrl(feedUrl);
    if (!validation.valid) {
      return reply.status(400).send({
        success: false,
        error: { message: `Invalid feed: ${validation.error}` },
      });
    }

    // Check if already subscribed
    const existing = await fastify.db
      .select()
      .from(newsFeeds)
      .where(
        and(
          eq(newsFeeds.userId, userId),
          eq(newsFeeds.feedUrl, feedUrl)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return reply.status(409).send({
        success: false,
        error: { message: "Already subscribed to this feed" },
      });
    }

    const [newFeed] = await fastify.db
      .insert(newsFeeds)
      .values({
        userId,
        name: name || validation.title || "Unnamed Feed",
        feedUrl,
        category: category || null,
      })
      .returning();

    if (!newFeed) {
      return reply.status(500).send({
        success: false,
        error: { message: "Failed to create feed" },
      });
    }

    // Trigger initial fetch for this feed
    const cacheService = getNewsCacheService(fastify);
    cacheService.refreshFeed(newFeed.id).catch((err) => {
      fastify.log.error({ err, feedId: newFeed.id }, "Failed to fetch initial articles");
    });

    return reply.status(201).send({ success: true, data: newFeed });
  });

  /**
   * PATCH /news/feeds/:id
   * Update a feed subscription
   */
  fastify.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      category?: string;
      isActive?: boolean;
    };
  }>("/feeds/:id", {
    onRequest: [fastify.authenticateKioskOrAny],
  }, async (request, reply) => {
    const user = await getCurrentUser(request);
    const userId = user?.id;
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { message: "Unauthorized" },
      });
    }

    const { id } = request.params;
    const { name, category, isActive } = request.body;

    const updates: Partial<{
      name: string;
      category: string | null;
      isActive: boolean;
    }> = {};

    if (name !== undefined) updates.name = name;
    if (category !== undefined) updates.category = category || null;
    if (isActive !== undefined) updates.isActive = isActive;

    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({
        success: false,
        error: { message: "No valid fields to update" },
      });
    }

    const [updated] = await fastify.db
      .update(newsFeeds)
      .set(updates)
      .where(
        and(
          eq(newsFeeds.id, id),
          eq(newsFeeds.userId, userId)
        )
      )
      .returning();

    if (!updated) {
      return reply.status(404).send({
        success: false,
        error: { message: "Feed not found" },
      });
    }

    return reply.send({ success: true, data: updated });
  });

  /**
   * DELETE /news/feeds/:id
   * Unsubscribe from a feed
   */
  fastify.delete<{
    Params: { id: string };
  }>("/feeds/:id", {
    onRequest: [fastify.authenticateKioskOrAny],
  }, async (request, reply) => {
    const user = await getCurrentUser(request);
    const userId = user?.id;
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { message: "Unauthorized" },
      });
    }

    const { id } = request.params;

    const result = await fastify.db
      .delete(newsFeeds)
      .where(
        and(
          eq(newsFeeds.id, id),
          eq(newsFeeds.userId, userId)
        )
      )
      .returning();

    if (result.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { message: "Feed not found" },
      });
    }

    return reply.send({ success: true, data: { deleted: true } });
  });

  /**
   * GET /news/articles
   * Get articles, optionally filtered by feed
   */
  fastify.get<{
    Querystring: {
      feedId?: string;
      limit?: string;
      offset?: string;
    };
  }>("/articles", {
    onRequest: [fastify.authenticateKioskOrAny],
  }, async (request, reply) => {
    const user = await getCurrentUser(request);
    const userId = user?.id;
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { message: "Unauthorized" },
      });
    }

    const { feedId, limit: limitStr, offset: offsetStr } = request.query;
    const limit = Math.min(parseInt(limitStr || "50", 10), 100);
    const offset = parseInt(offsetStr || "0", 10);

    // Get user's feed IDs
    const userFeeds = await fastify.db
      .select({ id: newsFeeds.id })
      .from(newsFeeds)
      .where(
        feedId
          ? and(eq(newsFeeds.userId, userId), eq(newsFeeds.id, feedId))
          : eq(newsFeeds.userId, userId)
      );

    if (userFeeds.length === 0) {
      return reply.send({ success: true, data: [] });
    }

    const feedIds = userFeeds.map((f) => f.id);

    const articles = await fastify.db
      .select({
        article: newsArticles,
        feedName: newsFeeds.name,
        feedCategory: newsFeeds.category,
      })
      .from(newsArticles)
      .innerJoin(newsFeeds, eq(newsArticles.feedId, newsFeeds.id))
      .where(inArray(newsArticles.feedId, feedIds))
      .orderBy(desc(newsArticles.publishedAt))
      .limit(limit)
      .offset(offset);

    const result = articles.map(({ article, feedName, feedCategory }) => ({
      ...article,
      feedName,
      feedCategory,
    }));

    return reply.send({ success: true, data: result });
  });

  /**
   * GET /news/headlines
   * Get top headlines for ticker/dashboard
   */
  fastify.get<{
    Querystring: {
      limit?: string;
    };
  }>("/headlines", {
    onRequest: [fastify.authenticateKioskOrAny],
  }, async (request, reply) => {
    const user = await getCurrentUser(request);
    const userId = user?.id;
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { message: "Unauthorized" },
      });
    }

    const { limit: limitStr } = request.query;
    const limit = Math.min(parseInt(limitStr || "10", 10), 50);

    // Get user's active feed IDs
    const userFeeds = await fastify.db
      .select({ id: newsFeeds.id })
      .from(newsFeeds)
      .where(and(eq(newsFeeds.userId, userId), eq(newsFeeds.isActive, true)));

    if (userFeeds.length === 0) {
      return reply.send({ success: true, data: [] });
    }

    const feedIds = userFeeds.map((f) => f.id);

    const headlines = await fastify.db
      .select({
        id: newsArticles.id,
        title: newsArticles.title,
        link: newsArticles.link,
        imageUrl: newsArticles.imageUrl,
        publishedAt: newsArticles.publishedAt,
        feedName: newsFeeds.name,
        feedCategory: newsFeeds.category,
      })
      .from(newsArticles)
      .innerJoin(newsFeeds, eq(newsArticles.feedId, newsFeeds.id))
      .where(inArray(newsArticles.feedId, feedIds))
      .orderBy(desc(newsArticles.publishedAt))
      .limit(limit);

    return reply.send({ success: true, data: headlines });
  });

  /**
   * POST /news/refresh
   * Force refresh all user's feeds
   */
  fastify.post("/refresh", {
    onRequest: [fastify.authenticateKioskOrAny],
  }, async (request, reply) => {
    const user = await getCurrentUser(request);
    const userId = user?.id;
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { message: "Unauthorized" },
      });
    }

    const cacheService = getNewsCacheService(fastify);
    await cacheService.refreshUserFeeds(userId);

    return reply.send({ success: true, data: { refreshed: true } });
  });

  /**
   * POST /news/validate
   * Validate a feed URL
   */
  fastify.post<{
    Body: { feedUrl: string };
  }>("/validate", {
    onRequest: [fastify.authenticateKioskOrAny],
  }, async (request, reply) => {
    const { feedUrl } = request.body;

    if (!feedUrl) {
      return reply.status(400).send({
        success: false,
        error: { message: "feedUrl is required" },
      });
    }

    const result = await validateFeedUrl(feedUrl);
    return reply.send({ success: true, data: result });
  });
};
