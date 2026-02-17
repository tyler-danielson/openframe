import type { FastifyPluginAsync } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import {
  youtubeBookmarks,
  youtubeWatchHistory,
} from "@openframe/database/schema";
import { getSystemSetting } from "../settings/index.js";
import { getCurrentUser } from "../../plugins/auth.js";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

async function getYouTubeApiKey(db: any): Promise<string | null> {
  return getSystemSetting(db, "google", "youtube_api_key");
}

async function youtubeApiFetch(apiKey: string, endpoint: string, params: Record<string, string>) {
  const url = new URL(`${YOUTUBE_API_BASE}/${endpoint}`);
  url.searchParams.set("key", apiKey);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url.toString());
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(error.error?.message || `YouTube API error: ${response.status}`);
  }
  return response.json();
}

export const youtubeRoutes: FastifyPluginAsync = async (fastify) => {
  const { authenticateAny } = fastify;

  // Search YouTube
  fastify.get<{
    Querystring: { q: string; type?: string; pageToken?: string; maxResults?: string };
  }>(
    "/search",
    { preHandler: [authenticateAny] },
    async (request, reply) => {
      const apiKey = await getYouTubeApiKey(fastify.db);
      if (!apiKey) return reply.badRequest("YouTube API key not configured");

      const { q, type = "video", pageToken, maxResults = "20" } = request.query;
      if (!q) return reply.badRequest("Search query required");

      const params: Record<string, string> = {
        part: "snippet",
        q,
        type,
        maxResults,
      };
      if (pageToken) params.pageToken = pageToken;

      const data = await youtubeApiFetch(apiKey, "search", params) as {
        items: Array<{
          id: { videoId?: string; channelId?: string; playlistId?: string; kind: string };
          snippet: {
            title: string;
            description: string;
            thumbnails: { medium?: { url: string }; default?: { url: string } };
            channelTitle: string;
            channelId: string;
            publishedAt: string;
            liveBroadcastContent: string;
          };
        }>;
        nextPageToken?: string;
        pageInfo: { totalResults: number };
      };

      const results = data.items.map((item) => {
        const youtubeId = item.id.videoId || item.id.channelId || item.id.playlistId || "";
        let itemType = "video";
        if (item.id.kind === "youtube#channel" || item.id.channelId) itemType = "channel";
        else if (item.id.kind === "youtube#playlist" || item.id.playlistId) itemType = "playlist";
        else if (item.snippet.liveBroadcastContent === "live") itemType = "live";

        return {
          youtubeId,
          type: itemType,
          title: item.snippet.title,
          description: item.snippet.description,
          thumbnailUrl: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || "",
          channelTitle: item.snippet.channelTitle,
          channelId: item.snippet.channelId,
          publishedAt: item.snippet.publishedAt,
          isLive: item.snippet.liveBroadcastContent === "live",
        };
      });

      return {
        success: true,
        data: {
          results,
          nextPageToken: data.nextPageToken || null,
          totalResults: data.pageInfo.totalResults,
        },
      };
    }
  );

  // Trending videos
  fastify.get<{
    Querystring: { regionCode?: string; categoryId?: string; maxResults?: string };
  }>(
    "/trending",
    { preHandler: [authenticateAny] },
    async (request, reply) => {
      const apiKey = await getYouTubeApiKey(fastify.db);
      if (!apiKey) return reply.badRequest("YouTube API key not configured");

      const { regionCode = "US", categoryId, maxResults = "20" } = request.query;

      const params: Record<string, string> = {
        part: "snippet,contentDetails,statistics",
        chart: "mostPopular",
        regionCode,
        maxResults,
      };
      if (categoryId) params.videoCategoryId = categoryId;

      const data = await youtubeApiFetch(apiKey, "videos", params) as {
        items: Array<{
          id: string;
          snippet: {
            title: string;
            description: string;
            thumbnails: { medium?: { url: string }; default?: { url: string } };
            channelTitle: string;
            channelId: string;
            publishedAt: string;
            liveBroadcastContent: string;
          };
          contentDetails: { duration: string };
          statistics: { viewCount: string; likeCount?: string };
        }>;
        nextPageToken?: string;
      };

      const results = data.items.map((item) => ({
        youtubeId: item.id,
        type: item.snippet.liveBroadcastContent === "live" ? "live" : "video",
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnailUrl: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || "",
        channelTitle: item.snippet.channelTitle,
        channelId: item.snippet.channelId,
        publishedAt: item.snippet.publishedAt,
        isLive: item.snippet.liveBroadcastContent === "live",
        duration: item.contentDetails.duration,
        viewCount: item.statistics.viewCount,
      }));

      return { success: true, data: results };
    }
  );

  // Get video details
  fastify.get<{ Params: { videoId: string } }>(
    "/videos/:videoId",
    { preHandler: [authenticateAny] },
    async (request, reply) => {
      const apiKey = await getYouTubeApiKey(fastify.db);
      if (!apiKey) return reply.badRequest("YouTube API key not configured");

      const { videoId } = request.params;

      const data = await youtubeApiFetch(apiKey, "videos", {
        part: "snippet,contentDetails,statistics",
        id: videoId,
      }) as {
        items: Array<{
          id: string;
          snippet: {
            title: string;
            description: string;
            thumbnails: { medium?: { url: string }; default?: { url: string } };
            channelTitle: string;
            channelId: string;
            publishedAt: string;
            tags?: string[];
            liveBroadcastContent: string;
          };
          contentDetails: { duration: string };
          statistics: { viewCount: string; likeCount?: string };
        }>;
      };

      if (!data.items?.length) return reply.notFound("Video not found");

      const item = data.items[0]!;
      return {
        success: true,
        data: {
          youtubeId: item.id,
          title: item.snippet.title,
          description: item.snippet.description,
          thumbnailUrl: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || "",
          channelTitle: item.snippet.channelTitle,
          channelId: item.snippet.channelId,
          publishedAt: item.snippet.publishedAt,
          duration: item.contentDetails.duration,
          viewCount: item.statistics.viewCount,
          likeCount: item.statistics.likeCount || "0",
          isLive: item.snippet.liveBroadcastContent === "live",
          tags: item.snippet.tags || [],
        },
      };
    }
  );

  // Get channel details
  fastify.get<{ Params: { channelId: string } }>(
    "/channels/:channelId",
    { preHandler: [authenticateAny] },
    async (request, reply) => {
      const apiKey = await getYouTubeApiKey(fastify.db);
      if (!apiKey) return reply.badRequest("YouTube API key not configured");

      const { channelId } = request.params;

      const data = await youtubeApiFetch(apiKey, "channels", {
        part: "snippet,statistics",
        id: channelId,
      }) as {
        items: Array<{
          id: string;
          snippet: {
            title: string;
            description: string;
            thumbnails: { medium?: { url: string }; default?: { url: string } };
          };
          statistics: { subscriberCount: string; videoCount: string };
        }>;
      };

      if (!data.items?.length) return reply.notFound("Channel not found");

      const item = data.items[0]!;
      return {
        success: true,
        data: {
          channelId: item.id,
          title: item.snippet.title,
          description: item.snippet.description,
          thumbnailUrl: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || "",
          subscriberCount: item.statistics.subscriberCount,
          videoCount: item.statistics.videoCount,
        },
      };
    }
  );

  // Get channel videos
  fastify.get<{ Params: { channelId: string }; Querystring: { pageToken?: string; maxResults?: string } }>(
    "/channels/:channelId/videos",
    { preHandler: [authenticateAny] },
    async (request, reply) => {
      const apiKey = await getYouTubeApiKey(fastify.db);
      if (!apiKey) return reply.badRequest("YouTube API key not configured");

      const { channelId } = request.params;
      const { pageToken, maxResults = "20" } = request.query;

      const params: Record<string, string> = {
        part: "snippet",
        channelId,
        type: "video",
        order: "date",
        maxResults,
      };
      if (pageToken) params.pageToken = pageToken;

      const data = await youtubeApiFetch(apiKey, "search", params) as {
        items: Array<{
          id: { videoId?: string };
          snippet: {
            title: string;
            description: string;
            thumbnails: { medium?: { url: string }; default?: { url: string } };
            channelTitle: string;
            channelId: string;
            publishedAt: string;
            liveBroadcastContent: string;
          };
        }>;
        nextPageToken?: string;
      };

      const results = data.items.map((item) => ({
        youtubeId: item.id.videoId || "",
        type: item.snippet.liveBroadcastContent === "live" ? "live" : "video",
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnailUrl: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || "",
        channelTitle: item.snippet.channelTitle,
        channelId: item.snippet.channelId,
        publishedAt: item.snippet.publishedAt,
        isLive: item.snippet.liveBroadcastContent === "live",
      }));

      return {
        success: true,
        data: { results, nextPageToken: data.nextPageToken || null },
      };
    }
  );

  // List bookmarks
  fastify.get(
    "/bookmarks",
    { preHandler: [authenticateAny] },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) return reply.unauthorized();

      const bookmarks = await fastify.db
        .select()
        .from(youtubeBookmarks)
        .where(eq(youtubeBookmarks.userId, user.id))
        .orderBy(desc(youtubeBookmarks.createdAt));

      return { success: true, data: bookmarks };
    }
  );

  // Add bookmark (upsert)
  fastify.post<{
    Body: {
      youtubeId: string;
      type?: string;
      title: string;
      thumbnailUrl?: string;
      channelTitle?: string;
      channelId?: string;
      duration?: string;
      isLive?: boolean;
    };
  }>(
    "/bookmarks",
    { preHandler: [authenticateAny] },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) return reply.unauthorized();

      const { youtubeId, type = "video", title, thumbnailUrl, channelTitle, channelId, duration, isLive } = request.body;
      if (!youtubeId || !title) return reply.badRequest("youtubeId and title required");

      // Check if already bookmarked
      const [existing] = await fastify.db
        .select()
        .from(youtubeBookmarks)
        .where(
          and(
            eq(youtubeBookmarks.userId, user.id),
            eq(youtubeBookmarks.youtubeId, youtubeId)
          )
        )
        .limit(1);

      if (existing) {
        return { success: true, data: existing };
      }

      const [bookmark] = await fastify.db
        .insert(youtubeBookmarks)
        .values({
          userId: user.id,
          youtubeId,
          type: type as any,
          title,
          thumbnailUrl: thumbnailUrl || null,
          channelTitle: channelTitle || null,
          channelId: channelId || null,
          duration: duration || null,
          isLive: isLive || false,
        })
        .returning();

      return { success: true, data: bookmark };
    }
  );

  // Remove bookmark
  fastify.delete<{ Params: { id: string } }>(
    "/bookmarks/:id",
    { preHandler: [authenticateAny] },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) return reply.unauthorized();

      await fastify.db
        .delete(youtubeBookmarks)
        .where(
          and(
            eq(youtubeBookmarks.id, request.params.id),
            eq(youtubeBookmarks.userId, user.id)
          )
        );

      return { success: true, message: "Bookmark removed" };
    }
  );

  // Get watch history
  fastify.get<{ Querystring: { limit?: string } }>(
    "/history",
    { preHandler: [authenticateAny] },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) return reply.unauthorized();

      const limit = parseInt(request.query.limit || "50", 10);

      const history = await fastify.db
        .select()
        .from(youtubeWatchHistory)
        .where(eq(youtubeWatchHistory.userId, user.id))
        .orderBy(desc(youtubeWatchHistory.watchedAt))
        .limit(limit);

      return { success: true, data: history };
    }
  );

  // Record watch
  fastify.post<{
    Body: {
      youtubeId: string;
      type?: string;
      title: string;
      thumbnailUrl?: string;
      channelTitle?: string;
    };
  }>(
    "/history",
    { preHandler: [authenticateAny] },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) return reply.unauthorized();

      const { youtubeId, type = "video", title, thumbnailUrl, channelTitle } = request.body;
      if (!youtubeId || !title) return reply.badRequest("youtubeId and title required");

      // Update existing entry or insert new one
      const [existing] = await fastify.db
        .select()
        .from(youtubeWatchHistory)
        .where(
          and(
            eq(youtubeWatchHistory.userId, user.id),
            eq(youtubeWatchHistory.youtubeId, youtubeId)
          )
        )
        .limit(1);

      if (existing) {
        await fastify.db
          .update(youtubeWatchHistory)
          .set({ watchedAt: new Date(), title, thumbnailUrl, channelTitle })
          .where(eq(youtubeWatchHistory.id, existing.id));
      } else {
        await fastify.db.insert(youtubeWatchHistory).values({
          userId: user.id,
          youtubeId,
          type: type as any,
          title,
          thumbnailUrl: thumbnailUrl || null,
          channelTitle: channelTitle || null,
        });
      }

      return { success: true, message: "Watch recorded" };
    }
  );

  // Resolve YouTube URL to type + ID
  fastify.get<{ Querystring: { url: string } }>(
    "/resolve-url",
    { preHandler: [authenticateAny] },
    async (request, reply) => {
      const { url } = request.query;
      if (!url) return reply.badRequest("URL required");

      let youtubeId: string | null = null;
      let type: string = "video";

      try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.replace("www.", "");

        if (hostname === "youtu.be") {
          youtubeId = parsed.pathname.slice(1);
          type = "video";
        } else if (hostname === "youtube.com" || hostname === "m.youtube.com") {
          if (parsed.pathname === "/watch") {
            youtubeId = parsed.searchParams.get("v");
            type = "video";
          } else if (parsed.pathname.startsWith("/playlist")) {
            youtubeId = parsed.searchParams.get("list");
            type = "playlist";
          } else if (parsed.pathname.startsWith("/channel/")) {
            youtubeId = parsed.pathname.split("/channel/")[1]?.split("/")[0] || null;
            type = "channel";
          } else if (parsed.pathname.startsWith("/@")) {
            youtubeId = parsed.pathname.slice(1);
            type = "channel";
          } else if (parsed.pathname.startsWith("/live/")) {
            youtubeId = parsed.pathname.split("/live/")[1]?.split("/")[0] || null;
            type = "live";
          } else if (parsed.pathname.startsWith("/shorts/")) {
            youtubeId = parsed.pathname.split("/shorts/")[1]?.split("/")[0] || null;
            type = "video";
          }
        }
      } catch {
        return reply.badRequest("Invalid URL");
      }

      if (!youtubeId) {
        return reply.badRequest("Could not parse YouTube URL");
      }

      return { success: true, data: { youtubeId, type } };
    }
  );
};
