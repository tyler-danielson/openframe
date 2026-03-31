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

// Source metadata for connection entries
const SOURCE_METADATA: Record<string, { name: string; icon: string; description: string }> = {
  nytimes: { name: "New York Times", icon: "🗽", description: "All the news that's fit to print" },
  bbc: { name: "BBC News", icon: "📡", description: "Breaking news from the BBC" },
  reuters: { name: "Reuters", icon: "🌐", description: "Reuters wire service" },
  npr: { name: "NPR", icon: "🎙️", description: "National Public Radio" },
  "ars-technica": { name: "Ars Technica", icon: "🔬", description: "Technology news & analysis" },
  techcrunch: { name: "TechCrunch", icon: "💻", description: "Startup and tech news" },
  "the-verge": { name: "The Verge", icon: "📱", description: "Technology & culture" },
  "hacker-news": { name: "Hacker News", icon: "🟧", description: "Y Combinator community news" },
  nasa: { name: "NASA", icon: "🚀", description: "Space and science updates" },
  espn: { name: "ESPN", icon: "🏀", description: "Sports headlines" },
  cnbc: { name: "CNBC", icon: "📈", description: "Financial news & markets" },
};

// Recommended RSS feeds organized by source (slugs match SOURCE_METADATA keys)
const PRESET_FEEDS = [
  // NYTimes
  { name: "NYT Top Stories", url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml", category: "general", source: "nytimes" },
  { name: "NYT World", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", category: "world", source: "nytimes" },
  { name: "NYT US", url: "https://rss.nytimes.com/services/xml/rss/nyt/US.xml", category: "us", source: "nytimes" },
  { name: "NYT Technology", url: "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml", category: "tech", source: "nytimes" },
  { name: "NYT Business", url: "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml", category: "business", source: "nytimes" },
  { name: "NYT Sports", url: "https://rss.nytimes.com/services/xml/rss/nyt/Sports.xml", category: "sports", source: "nytimes" },
  // BBC
  { name: "BBC Top Stories", url: "https://feeds.bbci.co.uk/news/rss.xml", category: "general", source: "bbc" },
  { name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml", category: "world", source: "bbc" },
  { name: "BBC Technology", url: "https://feeds.bbci.co.uk/news/technology/rss.xml", category: "tech", source: "bbc" },
  { name: "BBC Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml", category: "business", source: "bbc" },
  { name: "BBC Science", url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", category: "science", source: "bbc" },
  // Reuters
  { name: "Reuters World", url: "https://www.reutersagency.com/feed/?best-topics=world&post_type=best", category: "world", source: "reuters" },
  { name: "Reuters Business", url: "https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best", category: "business", source: "reuters" },
  { name: "Reuters Tech", url: "https://www.reutersagency.com/feed/?best-topics=tech&post_type=best", category: "tech", source: "reuters" },
  // NPR
  { name: "NPR News", url: "https://feeds.npr.org/1001/rss.xml", category: "general", source: "npr" },
  { name: "NPR Technology", url: "https://feeds.npr.org/1019/rss.xml", category: "tech", source: "npr" },
  { name: "NPR Science", url: "https://feeds.npr.org/1007/rss.xml", category: "science", source: "npr" },
  // Tech
  { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", category: "tech", source: "ars-technica" },
  { name: "TechCrunch", url: "https://techcrunch.com/feed/", category: "tech", source: "techcrunch" },
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", category: "tech", source: "the-verge" },
  { name: "Hacker News", url: "https://hnrss.org/frontpage", category: "tech", source: "hacker-news" },
  // Science
  { name: "NASA Breaking News", url: "https://www.nasa.gov/news-release/feed/", category: "science", source: "nasa" },
  // Sports
  { name: "ESPN Top Headlines", url: "https://www.espn.com/espn/rss/news", category: "sports", source: "espn" },
  // Finance
  { name: "CNBC Top News", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114", category: "business", source: "cnbc" },
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
   * GET /news/sources
   * Get available RSS source connections with metadata
   */
  fastify.get("/sources", async (_request, reply) => {
    const sources = Object.entries(SOURCE_METADATA).map(([id, meta]) => ({
      id,
      ...meta,
      presetCount: PRESET_FEEDS.filter((f) => f.source === id).length,
    }));
    return reply.send({ success: true, data: sources });
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
      source?: string;
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

    const { name, feedUrl, category, source } = request.body;

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
        source: source || null,
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
