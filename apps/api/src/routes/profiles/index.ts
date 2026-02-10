/**
 * Family Profiles API Routes
 * Endpoints for managing family member profiles and their planner configurations
 */

import type { FastifyPluginAsync } from "fastify";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import {
  familyProfiles,
  profileCalendars,
  profileNewsFeeds,
  profilePlannerConfig,
  profileRemarkableSettings,
  calendars,
  newsFeeds,
  events,
  taskLists,
  tasks,
  newsArticles,
  remarkableConfig,
  remarkableDocuments,
} from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";
import type { PlannerLayoutConfig } from "@openframe/shared";
import { generatePlannerPdf, type CalendarEvent, type TaskItem, type NewsItem, type WeatherData, type PlannerGeneratorOptions } from "../../services/planner-generator.js";
import { getRemarkableClient } from "../../services/remarkable/client.js";
import { getCategorySettings } from "../settings/index.js";
import { startOfDay, endOfDay, format } from "date-fns";

/**
 * Helper to gather all data needed for planner PDF generation
 */
async function gatherPlannerData(
  fastify: Parameters<FastifyPluginAsync>[0],
  userId: string,
  profileId: string,
  date: Date,
  layoutConfig: PlannerLayoutConfig
): Promise<PlannerGeneratorOptions> {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  // Check which widget types are in the layout
  const widgetTypes = new Set(layoutConfig.widgets.map(w => w.type));
  const needsEvents = widgetTypes.has("calendar-day") || widgetTypes.has("calendar-week") || widgetTypes.has("calendar-month");
  const needsTasks = widgetTypes.has("tasks");
  const needsNews = widgetTypes.has("news-headlines");
  const needsWeather = widgetTypes.has("weather");

  // Get visible calendar IDs for this profile
  let calendarEvents: CalendarEvent[] = [];
  if (needsEvents) {
    // Get calendars visible for this profile
    const profileCalendarSettings = await fastify.db
      .select()
      .from(profileCalendars)
      .where(eq(profileCalendars.profileId, profileId));

    // Get all user calendars
    const userCalendars = await fastify.db
      .select()
      .from(calendars)
      .where(eq(calendars.userId, userId));

    // Determine visible calendars (default to all if no profile settings)
    const visibleCalendarIds = profileCalendarSettings.length > 0
      ? profileCalendarSettings.filter(s => s.isVisible).map(s => s.calendarId)
      : userCalendars.map(c => c.id);

    // Build calendar map for names/colors
    const calendarMap = new Map(userCalendars.map(c => [c.id, c]));

    // Fetch events from visible calendars
    if (visibleCalendarIds.length > 0) {
      const allEvents = await fastify.db
        .select()
        .from(events)
        .where(
          and(
            inArray(events.calendarId, visibleCalendarIds),
            lte(events.startTime, dayEnd),
            gte(events.endTime, dayStart)
          )
        );

      calendarEvents = allEvents.map(e => ({
        id: e.id,
        title: e.title,
        startTime: e.startTime,
        endTime: e.endTime,
        isAllDay: e.isAllDay,
        location: e.location ?? undefined,
        description: e.description ?? undefined,
        calendarName: calendarMap.get(e.calendarId)?.name,
        color: calendarMap.get(e.calendarId)?.color ?? undefined,
      }));
    }
  }

  // Get tasks (incomplete, due today or overdue)
  let taskItems: TaskItem[] = [];
  if (needsTasks) {
    const userTaskLists = await fastify.db
      .select()
      .from(taskLists)
      .where(and(eq(taskLists.userId, userId), eq(taskLists.isVisible, true)));

    if (userTaskLists.length > 0) {
      const listIds = userTaskLists.map(l => l.id);
      const allTasks = await fastify.db
        .select()
        .from(tasks)
        .where(
          and(
            inArray(tasks.taskListId, listIds),
            eq(tasks.status, "needsAction")
          )
        );

      // Filter to tasks due today/before or without due date
      taskItems = allTasks
        .filter(t => !t.dueDate || t.dueDate <= dayEnd)
        .map(t => ({
          id: t.id,
          title: t.title,
          dueDate: t.dueDate ?? undefined,
          completed: t.status === "completed",
        }));
    }
  }

  // Get news headlines
  let newsItems: NewsItem[] = [];
  if (needsNews) {
    // Get visible news feeds for this profile
    const profileFeedSettings = await fastify.db
      .select()
      .from(profileNewsFeeds)
      .where(eq(profileNewsFeeds.profileId, profileId));

    const userFeeds = await fastify.db
      .select()
      .from(newsFeeds)
      .where(eq(newsFeeds.userId, userId));

    const visibleFeedIds = profileFeedSettings.length > 0
      ? profileFeedSettings.filter(s => s.isVisible).map(s => s.newsFeedId)
      : userFeeds.filter(f => f.isActive).map(f => f.id);

    if (visibleFeedIds.length > 0) {
      // Get recent articles from visible feeds
      const articles = await fastify.db
        .select()
        .from(newsArticles)
        .where(inArray(newsArticles.feedId, visibleFeedIds))
        .orderBy(newsArticles.publishedAt)
        .limit(10);

      // Build feed name map
      const feedMap = new Map(userFeeds.map(f => [f.id, f]));

      newsItems = articles.map(a => ({
        id: a.id,
        title: a.title,
        source: feedMap.get(a.feedId)?.name,
        publishedAt: a.publishedAt ?? undefined,
      }));
    }
  }

  // Get weather data
  let weatherData: WeatherData | undefined;
  if (needsWeather) {
    try {
      const weatherSettings = await getCategorySettings(fastify.db, "weather");
      const homeSettings = await getCategorySettings(fastify.db, "home");

      const apiKey = weatherSettings.api_key || process.env.OPENWEATHERMAP_API_KEY;
      const lat = homeSettings.latitude || process.env.OPENWEATHERMAP_LAT;
      const lon = homeSettings.longitude || process.env.OPENWEATHERMAP_LON;
      const units = (weatherSettings.units || "imperial") as "imperial" | "metric";

      if (apiKey && lat && lon) {
        // Fetch current weather
        const currentResponse = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${units}`
        );

        if (currentResponse.ok) {
          const currentData = await currentResponse.json() as {
            main: { temp: number };
            weather: Array<{ description: string; icon: string }>;
          };

          // Fetch forecast
          const forecastResponse = await fetch(
            `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${units}`
          );

          const forecast: WeatherData["forecast"] = [];
          if (forecastResponse.ok) {
            const forecastData = await forecastResponse.json() as {
              list: Array<{
                dt: number;
                main: { temp_min: number; temp_max: number };
                weather: Array<{ icon: string }>;
              }>;
            };

            // Group by day
            const dailyData = new Map<string, { high: number; low: number; icon: string; date: Date }>();
            for (const item of forecastData.list) {
              const itemDate = new Date(item.dt * 1000);
              const dayKey = format(itemDate, "yyyy-MM-dd");

              const existing = dailyData.get(dayKey);
              if (existing) {
                existing.high = Math.max(existing.high, item.main.temp_max);
                existing.low = Math.min(existing.low, item.main.temp_min);
              } else {
                dailyData.set(dayKey, {
                  date: itemDate,
                  high: item.main.temp_max,
                  low: item.main.temp_min,
                  icon: item.weather[0]?.icon || "01d",
                });
              }
            }

            forecast.push(...Array.from(dailyData.values()).slice(0, 5));
          }

          weatherData = {
            current: {
              temp: Math.round(currentData.main.temp),
              description: currentData.weather[0]?.description || "Unknown",
              icon: currentData.weather[0]?.icon || "01d",
            },
            forecast,
          };
        }
      }
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch weather for planner");
    }
  }

  return {
    date,
    events: calendarEvents,
    tasks: taskItems,
    news: newsItems,
    weather: weatherData,
  };
}

export const profileRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /profiles
   * List all family profiles for the current user
   */
  fastify.get("/", {
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

    const profiles = await fastify.db
      .select()
      .from(familyProfiles)
      .where(eq(familyProfiles.userId, userId))
      .orderBy(familyProfiles.createdAt);

    return reply.send({ success: true, data: profiles });
  });

  /**
   * POST /profiles
   * Create a new family profile
   */
  fastify.post<{
    Body: {
      name: string;
      icon?: string;
      color?: string;
      isDefault?: boolean;
    };
  }>("/", {
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

    const { name, icon, color, isDefault } = request.body;

    if (!name) {
      return reply.status(400).send({
        success: false,
        error: { message: "name is required" },
      });
    }

    // If this profile should be default, unset other defaults first
    if (isDefault) {
      await fastify.db
        .update(familyProfiles)
        .set({ isDefault: false })
        .where(eq(familyProfiles.userId, userId));
    }

    const [profile] = await fastify.db
      .insert(familyProfiles)
      .values({
        userId,
        name,
        icon: icon || null,
        color: color || null,
        isDefault: isDefault || false,
      })
      .returning();

    if (!profile) {
      return reply.status(500).send({
        success: false,
        error: { message: "Failed to create profile" },
      });
    }

    // Create default planner config for the profile
    await fastify.db.insert(profilePlannerConfig).values({
      profileId: profile.id,
      layoutConfig: {
        gridColumns: 12,
        gridRows: 8,
        pageSize: "remarkable",
        orientation: "portrait",
        widgets: [],
        backgroundColor: "#ffffff",
      },
    });

    // Create default remarkable settings for the profile
    await fastify.db.insert(profileRemarkableSettings).values({
      profileId: profile.id,
      enabled: true,
      folderPath: `/Calendar/${name}`,
      scheduleType: "daily",
      pushTime: "06:00",
      timezone: user.timezone || "America/New_York",
    });

    return reply.status(201).send({ success: true, data: profile });
  });

  /**
   * GET /profiles/:id
   * Get a specific profile with all settings
   */
  fastify.get<{
    Params: { id: string };
  }>("/:id", {
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

    const [profile] = await fastify.db
      .select()
      .from(familyProfiles)
      .where(and(eq(familyProfiles.id, id), eq(familyProfiles.userId, userId)))
      .limit(1);

    if (!profile) {
      return reply.status(404).send({
        success: false,
        error: { message: "Profile not found" },
      });
    }

    // Get planner config
    const [plannerConfig] = await fastify.db
      .select()
      .from(profilePlannerConfig)
      .where(eq(profilePlannerConfig.profileId, id))
      .limit(1);

    // Get remarkable settings
    const [remarkableSettings] = await fastify.db
      .select()
      .from(profileRemarkableSettings)
      .where(eq(profileRemarkableSettings.profileId, id))
      .limit(1);

    return reply.send({
      success: true,
      data: {
        ...profile,
        plannerConfig: plannerConfig?.layoutConfig || null,
        remarkableSettings: remarkableSettings || null,
      },
    });
  });

  /**
   * PATCH /profiles/:id
   * Update a profile (name, icon, color)
   */
  fastify.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      icon?: string;
      color?: string;
    };
  }>("/:id", {
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
    const { name, icon, color } = request.body;

    const updates: Partial<{ name: string; icon: string | null; color: string | null; updatedAt: Date }> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updates.name = name;
    if (icon !== undefined) updates.icon = icon || null;
    if (color !== undefined) updates.color = color || null;

    const [updated] = await fastify.db
      .update(familyProfiles)
      .set(updates)
      .where(and(eq(familyProfiles.id, id), eq(familyProfiles.userId, userId)))
      .returning();

    if (!updated) {
      return reply.status(404).send({
        success: false,
        error: { message: "Profile not found" },
      });
    }

    return reply.send({ success: true, data: updated });
  });

  /**
   * DELETE /profiles/:id
   * Delete a profile
   */
  fastify.delete<{
    Params: { id: string };
  }>("/:id", {
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
      .delete(familyProfiles)
      .where(and(eq(familyProfiles.id, id), eq(familyProfiles.userId, userId)))
      .returning();

    if (result.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { message: "Profile not found" },
      });
    }

    return reply.send({ success: true, data: { deleted: true } });
  });

  /**
   * POST /profiles/:id/default
   * Set a profile as the default
   */
  fastify.post<{
    Params: { id: string };
  }>("/:id/default", {
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

    // Verify profile exists and belongs to user
    const [profile] = await fastify.db
      .select()
      .from(familyProfiles)
      .where(and(eq(familyProfiles.id, id), eq(familyProfiles.userId, userId)))
      .limit(1);

    if (!profile) {
      return reply.status(404).send({
        success: false,
        error: { message: "Profile not found" },
      });
    }

    // Unset all defaults for this user
    await fastify.db
      .update(familyProfiles)
      .set({ isDefault: false })
      .where(eq(familyProfiles.userId, userId));

    // Set this profile as default
    const [updated] = await fastify.db
      .update(familyProfiles)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(familyProfiles.id, id))
      .returning();

    return reply.send({ success: true, data: updated });
  });

  /**
   * GET /profiles/:id/calendars
   * Get calendar visibility settings for a profile
   */
  fastify.get<{
    Params: { id: string };
  }>("/:id/calendars", {
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

    // Get all user calendars
    const userCalendars = await fastify.db
      .select()
      .from(calendars)
      .where(eq(calendars.userId, userId));

    // Get profile calendar settings
    const profileCalendarSettings = await fastify.db
      .select()
      .from(profileCalendars)
      .where(eq(profileCalendars.profileId, id));

    // Merge: for each calendar, check if there's a profile setting, otherwise default to visible
    const calendarVisibility = userCalendars.map((cal) => {
      const setting = profileCalendarSettings.find((s) => s.calendarId === cal.id);
      return {
        calendar: cal,
        isVisible: setting?.isVisible ?? true,
      };
    });

    return reply.send({ success: true, data: calendarVisibility });
  });

  /**
   * PATCH /profiles/:id/calendars
   * Update calendar visibility for a profile
   */
  fastify.patch<{
    Params: { id: string };
    Body: {
      calendars: Array<{ calendarId: string; isVisible: boolean }>;
    };
  }>("/:id/calendars", {
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
    const { calendars: calendarUpdates } = request.body;

    // Verify profile belongs to user
    const [profile] = await fastify.db
      .select()
      .from(familyProfiles)
      .where(and(eq(familyProfiles.id, id), eq(familyProfiles.userId, userId)))
      .limit(1);

    if (!profile) {
      return reply.status(404).send({
        success: false,
        error: { message: "Profile not found" },
      });
    }

    // Upsert each calendar visibility setting
    for (const update of calendarUpdates) {
      const existing = await fastify.db
        .select()
        .from(profileCalendars)
        .where(
          and(
            eq(profileCalendars.profileId, id),
            eq(profileCalendars.calendarId, update.calendarId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await fastify.db
          .update(profileCalendars)
          .set({ isVisible: update.isVisible })
          .where(
            and(
              eq(profileCalendars.profileId, id),
              eq(profileCalendars.calendarId, update.calendarId)
            )
          );
      } else {
        await fastify.db.insert(profileCalendars).values({
          profileId: id,
          calendarId: update.calendarId,
          isVisible: update.isVisible,
        });
      }
    }

    return reply.send({ success: true, data: { updated: true } });
  });

  /**
   * GET /profiles/:id/news
   * Get news feed settings for a profile
   */
  fastify.get<{
    Params: { id: string };
  }>("/:id/news", {
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

    // Get all user news feeds
    const userFeeds = await fastify.db
      .select()
      .from(newsFeeds)
      .where(eq(newsFeeds.userId, userId));

    // Get profile feed settings
    const profileFeedSettings = await fastify.db
      .select()
      .from(profileNewsFeeds)
      .where(eq(profileNewsFeeds.profileId, id));

    // Merge
    const feedVisibility = userFeeds.map((feed) => {
      const setting = profileFeedSettings.find((s) => s.newsFeedId === feed.id);
      return {
        feed,
        isVisible: setting?.isVisible ?? true,
      };
    });

    return reply.send({ success: true, data: feedVisibility });
  });

  /**
   * PATCH /profiles/:id/news
   * Update news feed visibility for a profile
   */
  fastify.patch<{
    Params: { id: string };
    Body: {
      feeds: Array<{ feedId: string; isVisible: boolean }>;
    };
  }>("/:id/news", {
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
    const { feeds: feedUpdates } = request.body;

    // Verify profile belongs to user
    const [profile] = await fastify.db
      .select()
      .from(familyProfiles)
      .where(and(eq(familyProfiles.id, id), eq(familyProfiles.userId, userId)))
      .limit(1);

    if (!profile) {
      return reply.status(404).send({
        success: false,
        error: { message: "Profile not found" },
      });
    }

    // Upsert each feed visibility setting
    for (const update of feedUpdates) {
      const existing = await fastify.db
        .select()
        .from(profileNewsFeeds)
        .where(
          and(
            eq(profileNewsFeeds.profileId, id),
            eq(profileNewsFeeds.newsFeedId, update.feedId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await fastify.db
          .update(profileNewsFeeds)
          .set({ isVisible: update.isVisible })
          .where(
            and(
              eq(profileNewsFeeds.profileId, id),
              eq(profileNewsFeeds.newsFeedId, update.feedId)
            )
          );
      } else {
        await fastify.db.insert(profileNewsFeeds).values({
          profileId: id,
          newsFeedId: update.feedId,
          isVisible: update.isVisible,
        });
      }
    }

    return reply.send({ success: true, data: { updated: true } });
  });

  /**
   * GET /profiles/:id/planner
   * Get planner layout config for a profile
   */
  fastify.get<{
    Params: { id: string };
  }>("/:id/planner", {
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

    // Verify profile belongs to user
    const [profile] = await fastify.db
      .select()
      .from(familyProfiles)
      .where(and(eq(familyProfiles.id, id), eq(familyProfiles.userId, userId)))
      .limit(1);

    if (!profile) {
      return reply.status(404).send({
        success: false,
        error: { message: "Profile not found" },
      });
    }

    const [config] = await fastify.db
      .select()
      .from(profilePlannerConfig)
      .where(eq(profilePlannerConfig.profileId, id))
      .limit(1);

    return reply.send({
      success: true,
      data: config?.layoutConfig || {
        gridColumns: 12,
        gridRows: 8,
        pageSize: "remarkable",
        orientation: "portrait",
        widgets: [],
        backgroundColor: "#ffffff",
      },
    });
  });

  /**
   * PATCH /profiles/:id/planner
   * Save planner layout config for a profile
   */
  fastify.patch<{
    Params: { id: string };
    Body: {
      layoutConfig: PlannerLayoutConfig;
    };
  }>("/:id/planner", {
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
    const { layoutConfig } = request.body;

    // Verify profile belongs to user
    const [profile] = await fastify.db
      .select()
      .from(familyProfiles)
      .where(and(eq(familyProfiles.id, id), eq(familyProfiles.userId, userId)))
      .limit(1);

    if (!profile) {
      return reply.status(404).send({
        success: false,
        error: { message: "Profile not found" },
      });
    }

    // Upsert planner config
    const existing = await fastify.db
      .select()
      .from(profilePlannerConfig)
      .where(eq(profilePlannerConfig.profileId, id))
      .limit(1);

    if (existing.length > 0) {
      await fastify.db
        .update(profilePlannerConfig)
        .set({ layoutConfig, updatedAt: new Date() })
        .where(eq(profilePlannerConfig.profileId, id));
    } else {
      await fastify.db.insert(profilePlannerConfig).values({
        profileId: id,
        layoutConfig,
      });
    }

    return reply.send({ success: true, data: layoutConfig });
  });

  /**
   * GET /profiles/:id/remarkable
   * Get reMarkable settings for a profile
   */
  fastify.get<{
    Params: { id: string };
  }>("/:id/remarkable", {
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

    // Verify profile belongs to user
    const [profile] = await fastify.db
      .select()
      .from(familyProfiles)
      .where(and(eq(familyProfiles.id, id), eq(familyProfiles.userId, userId)))
      .limit(1);

    if (!profile) {
      return reply.status(404).send({
        success: false,
        error: { message: "Profile not found" },
      });
    }

    const [settings] = await fastify.db
      .select()
      .from(profileRemarkableSettings)
      .where(eq(profileRemarkableSettings.profileId, id))
      .limit(1);

    return reply.send({
      success: true,
      data: settings || {
        enabled: true,
        folderPath: "/Calendar",
        scheduleType: "daily",
        pushTime: "06:00",
        pushDay: null,
        timezone: "America/New_York",
        lastPushAt: null,
      },
    });
  });

  /**
   * PATCH /profiles/:id/remarkable
   * Update reMarkable settings for a profile
   */
  fastify.patch<{
    Params: { id: string };
    Body: {
      enabled?: boolean;
      folderPath?: string;
      scheduleType?: "daily" | "weekly" | "monthly" | "manual";
      pushTime?: string;
      pushDay?: number | null;
      timezone?: string;
    };
  }>("/:id/remarkable", {
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
    const { enabled, folderPath, scheduleType, pushTime, pushDay, timezone } = request.body;

    // Verify profile belongs to user
    const [profile] = await fastify.db
      .select()
      .from(familyProfiles)
      .where(and(eq(familyProfiles.id, id), eq(familyProfiles.userId, userId)))
      .limit(1);

    if (!profile) {
      return reply.status(404).send({
        success: false,
        error: { message: "Profile not found" },
      });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (enabled !== undefined) updates.enabled = enabled;
    if (folderPath !== undefined) updates.folderPath = folderPath;
    if (scheduleType !== undefined) updates.scheduleType = scheduleType;
    if (pushTime !== undefined) updates.pushTime = pushTime;
    if (pushDay !== undefined) updates.pushDay = pushDay;
    if (timezone !== undefined) updates.timezone = timezone;

    // Upsert settings
    const existing = await fastify.db
      .select()
      .from(profileRemarkableSettings)
      .where(eq(profileRemarkableSettings.profileId, id))
      .limit(1);

    let result;
    if (existing.length > 0) {
      [result] = await fastify.db
        .update(profileRemarkableSettings)
        .set(updates)
        .where(eq(profileRemarkableSettings.profileId, id))
        .returning();
    } else {
      [result] = await fastify.db
        .insert(profileRemarkableSettings)
        .values({
          profileId: id,
          enabled: enabled ?? true,
          folderPath: folderPath ?? "/Calendar",
          scheduleType: scheduleType ?? "daily",
          pushTime: pushTime ?? "06:00",
          pushDay: pushDay ?? null,
          timezone: timezone ?? "America/New_York",
        })
        .returning();
    }

    return reply.send({ success: true, data: result });
  });

  /**
   * POST /profiles/:id/preview
   * Generate a planner preview PDF for a profile
   */
  fastify.post<{
    Params: { id: string };
    Body: {
      date?: string; // ISO date string, defaults to today
    };
  }>("/:id/preview", {
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

    // Verify profile belongs to user
    const [profile] = await fastify.db
      .select()
      .from(familyProfiles)
      .where(and(eq(familyProfiles.id, id), eq(familyProfiles.userId, userId)))
      .limit(1);

    if (!profile) {
      return reply.status(404).send({
        success: false,
        error: { message: "Profile not found" },
      });
    }

    // Get planner config
    const [config] = await fastify.db
      .select()
      .from(profilePlannerConfig)
      .where(eq(profilePlannerConfig.profileId, id))
      .limit(1);

    if (!config || !config.layoutConfig) {
      return reply.status(400).send({
        success: false,
        error: { message: "No planner layout configured" },
      });
    }

    const layoutConfig = config.layoutConfig as PlannerLayoutConfig;
    const targetDate = request.body.date ? new Date(request.body.date) : new Date();

    try {
      // Gather all data needed for the planner
      const plannerData = await gatherPlannerData(
        fastify,
        userId,
        id,
        targetDate,
        layoutConfig
      );

      // Generate the PDF
      const { buffer, filename } = await generatePlannerPdf(layoutConfig, plannerData);

      // Return PDF as binary response
      return reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `inline; filename="${filename}"`)
        .send(buffer);
    } catch (err) {
      fastify.log.error({ err, profileId: id }, "Failed to generate planner preview");
      return reply.status(500).send({
        success: false,
        error: { message: "Failed to generate planner preview" },
      });
    }
  });

  /**
   * POST /profiles/:id/push
   * Push the planner to reMarkable device
   */
  fastify.post<{
    Params: { id: string };
    Body: {
      date?: string; // ISO date string, defaults to today
    };
  }>("/:id/push", {
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

    // Verify profile belongs to user
    const [profile] = await fastify.db
      .select()
      .from(familyProfiles)
      .where(and(eq(familyProfiles.id, id), eq(familyProfiles.userId, userId)))
      .limit(1);

    if (!profile) {
      return reply.status(404).send({
        success: false,
        error: { message: "Profile not found" },
      });
    }

    // Get remarkable settings
    const [settings] = await fastify.db
      .select()
      .from(profileRemarkableSettings)
      .where(eq(profileRemarkableSettings.profileId, id))
      .limit(1);

    if (!settings?.enabled) {
      return reply.status(400).send({
        success: false,
        error: { message: "reMarkable delivery is disabled for this profile" },
      });
    }

    // Check if reMarkable is connected for this user
    const [rmConfig] = await fastify.db
      .select()
      .from(remarkableConfig)
      .where(and(eq(remarkableConfig.userId, userId), eq(remarkableConfig.isConnected, true)))
      .limit(1);

    if (!rmConfig) {
      return reply.status(400).send({
        success: false,
        error: { message: "reMarkable is not connected. Please connect your reMarkable device first." },
      });
    }

    // Get planner config
    const [config] = await fastify.db
      .select()
      .from(profilePlannerConfig)
      .where(eq(profilePlannerConfig.profileId, id))
      .limit(1);

    if (!config || !config.layoutConfig) {
      return reply.status(400).send({
        success: false,
        error: { message: "No planner layout configured for this profile" },
      });
    }

    const layoutConfig = config.layoutConfig as PlannerLayoutConfig;
    const targetDate = request.body.date ? new Date(request.body.date) : new Date();

    try {
      // Gather all data needed for the planner
      const plannerData = await gatherPlannerData(
        fastify,
        userId,
        id,
        targetDate,
        layoutConfig
      );

      // Generate the PDF
      const { buffer, filename } = await generatePlannerPdf(layoutConfig, plannerData);

      // Get reMarkable client and upload
      const client = getRemarkableClient(fastify, userId);

      // Test connection first
      const isConnected = await client.testConnection();
      if (!isConnected) {
        return reply.status(400).send({
          success: false,
          error: { message: "reMarkable connection failed. Please reconnect your device." },
        });
      }

      // Upload the PDF
      const folderPath = settings.folderPath || "/Calendar";
      const documentId = await client.uploadPdf(buffer, filename, folderPath);

      // Track the document in our database
      await fastify.db.insert(remarkableDocuments).values({
        userId,
        documentId,
        documentVersion: 1,
        documentName: filename,
        documentType: "pdf",
        folderPath,
        isAgenda: true,
        isProcessed: false,
      });

      // Update lastPushAt timestamp
      await fastify.db
        .update(profileRemarkableSettings)
        .set({
          lastPushAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(profileRemarkableSettings.profileId, id));

      fastify.log.info(
        { profileId: id, documentId, filename, folderPath },
        "Planner pushed to reMarkable"
      );

      return reply.send({
        success: true,
        data: {
          documentId,
          filename,
          folderPath,
          pushedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      fastify.log.error({ err, profileId: id }, "Failed to push planner to reMarkable");
      return reply.status(500).send({
        success: false,
        error: { message: "Failed to push planner to reMarkable" },
      });
    }
  });
};
