import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { calendars, events, tasks, newsArticles, newsFeeds } from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";
import { getSystemSetting } from "../settings/index.js";
import { generateDailyBriefing, checkBriefingStatus } from "../../services/ai-briefing.js";
import type { CalendarEvent, Task, NewsHeadline } from "@openframe/shared";

// Helper to get current weather
async function getCurrentWeather(db: any): Promise<{ temp: number; description: string; units: string } | null> {
  try {
    const apiKey = await getSystemSetting(db, "weather", "api_key");
    const units = (await getSystemSetting(db, "weather", "units")) || "imperial";
    const lat = await getSystemSetting(db, "home", "latitude");
    const lon = await getSystemSetting(db, "home", "longitude");

    if (!apiKey || !lat || !lon) return null;

    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${units}&appid=${apiKey}`
    );

    if (!response.ok) return null;

    const data = await response.json() as {
      main: { temp: number };
      weather: Array<{ description: string }>;
    };

    return {
      temp: data.main.temp,
      description: data.weather[0]?.description || "Unknown",
      units,
    };
  } catch {
    return null;
  }
}

export const briefingRoutes: FastifyPluginAsync = async (fastify) => {
  // Get briefing status
  fastify.get(
    "/status",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Check AI briefing configuration status",
        tags: ["Briefing"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  configured: { type: "boolean" },
                  error: { type: "string" },
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

      const apiKey = await getSystemSetting(fastify.db, "anthropic", "api_key");
      const status = await checkBriefingStatus(apiKey);

      return {
        success: true,
        data: status,
      };
    }
  );

  // Get daily briefing
  fastify.get(
    "/daily",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Get AI-generated daily briefing",
        tags: ["Briefing"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  summary: { type: "string" },
                  highlights: {
                    type: "array",
                    items: { type: "string" },
                  },
                  generatedAt: { type: "string" },
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

      // Check if API key is configured
      const apiKey = await getSystemSetting(fastify.db, "anthropic", "api_key");
      if (!apiKey) {
        return reply.badRequest("Anthropic API key not configured. Add it in Settings.");
      }

      // Get today's date range
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

      // Fetch today's events
      const userCalendars = await fastify.db
        .select({ id: calendars.id })
        .from(calendars)
        .where(eq(calendars.userId, user.id));

      const calendarIds = userCalendars.map((c) => c.id);

      let todayEvents: CalendarEvent[] = [];
      if (calendarIds.length > 0) {
        const allEvents = await fastify.db
          .select()
          .from(events)
          .where(eq(events.status, "confirmed"));

        todayEvents = allEvents
          .filter((e) => {
            const startTime = new Date(e.startTime);
            return (
              calendarIds.includes(e.calendarId) &&
              startTime >= startOfDay &&
              startTime < endOfDay
            );
          })
          .map((e) => ({
            ...e,
            attendees: (e.attendees as any) || [],
            reminders: (e.reminders as any) || [],
          })) as CalendarEvent[];
      }

      // Fetch incomplete tasks
      const userTasks = (await fastify.db
        .select()
        .from(tasks)
        .where(eq(tasks.status, "needsAction"))) as Task[];

      // Fetch recent headlines
      const userFeeds = await fastify.db
        .select({ id: newsFeeds.id })
        .from(newsFeeds)
        .where(eq(newsFeeds.userId, user.id));

      const feedIds = userFeeds.map((f) => f.id);

      let headlines: NewsHeadline[] = [];
      if (feedIds.length > 0) {
        const articles = await fastify.db
          .select({
            id: newsArticles.id,
            title: newsArticles.title,
            link: newsArticles.link,
            imageUrl: newsArticles.imageUrl,
            publishedAt: newsArticles.publishedAt,
            feedId: newsArticles.feedId,
          })
          .from(newsArticles)
          .limit(10);

        headlines = articles
          .filter((a) => feedIds.includes(a.feedId))
          .slice(0, 5)
          .map((a) => ({
            id: a.id,
            title: a.title,
            link: a.link,
            imageUrl: a.imageUrl,
            publishedAt: a.publishedAt,
            feedName: "",
            feedCategory: null,
          }));
      }

      // Fetch weather
      const weather = await getCurrentWeather(fastify.db);

      try {
        const briefing = await generateDailyBriefing(
          apiKey,
          {
            events: todayEvents,
            tasks: userTasks,
            weather,
            headlines,
            userName: user.name || undefined,
          },
          user.id
        );

        return {
          success: true,
          data: briefing,
        };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Failed to generate daily briefing");
        return reply.internalServerError(error.message || "Failed to generate briefing");
      }
    }
  );
};
