/**
 * Scheduler Plugin
 * Handles periodic background tasks like IPTV cache refresh, sports data updates,
 * and Home Assistant entity timers
 */

import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { getIptvCacheService } from "../services/iptv-cache.js";
import { getAutomationEngine } from "../services/automation-engine.js";
import { getNewsCacheService } from "../services/news-cache.js";
import {
  favoriteSportsTeams,
  sportsGames,
  haEntityTimers,
  homeAssistantConfig,
  remarkableConfig,
  remarkableAgendaSettings,
  remarkableDocuments,
  calendars,
  events,
  familyProfiles,
  profileRemarkableSettings,
  profilePlannerConfig,
  profileCalendars,
  profileNewsFeeds,
  newsFeeds,
  newsArticles,
  taskLists,
  tasks,
  iptvServers,
} from "@openframe/database/schema";
import { getRemarkableClient } from "../services/remarkable/client.js";
import { syncGoogleCalendars } from "../services/calendar-sync/google.js";
import { oauthTokens, users } from "@openframe/database/schema";
import { generateAgendaPdf, getAgendaFilename, type AgendaEvent } from "../services/remarkable/agenda-generator.js";
import { generatePlannerPdf, type CalendarEvent, type TaskItem, type NewsItem, type WeatherData, type PlannerGeneratorOptions } from "../services/planner-generator.js";
import type { PlannerLayoutConfig } from "@openframe/shared";
import { getCategorySettings } from "../routes/settings/index.js";
import { syncRemarkableDocuments } from "../services/remarkable/note-processor.js";
import { startOfDay, endOfDay, format, parse } from "date-fns";
import {
  fetchGamesForTeams,
  formatDateForESPN,
  SUPPORTED_LEAGUES,
  fetchScoreboard,
} from "../services/espn.js";
import type { SportsGame, GameStatus } from "@openframe/shared";

// Refresh interval: 4 hours
const IPTV_CACHE_REFRESH_INTERVAL_MS = 4 * 60 * 60 * 1000;

// Sports polling intervals (in milliseconds)
const SPORTS_POLL_IDLE = 30 * 60 * 1000; // 30 minutes - no games today
const SPORTS_POLL_PREGAME = 5 * 60 * 1000; // 5 minutes - game within 1 hour
const SPORTS_POLL_LIVE = 30 * 1000; // 30 seconds - game in progress
const SPORTS_POLL_POSTGAME = 5 * 60 * 1000; // 5 minutes - game ended < 30 min ago

// Delay before first refresh on startup (30 seconds to let server fully start)
const STARTUP_DELAY_MS = 30 * 1000;

// Entity timer polling interval (10 seconds)
const ENTITY_TIMER_POLL_INTERVAL_MS = 10 * 1000;

// Automation polling interval (30 seconds)
const AUTOMATION_POLL_INTERVAL_MS = 30 * 1000;

// News feed refresh interval (30 minutes)
const NEWS_REFRESH_INTERVAL_MS = 30 * 60 * 1000;

// reMarkable polling interval (5 minutes for notes)
const REMARKABLE_POLL_INTERVAL_MS = 5 * 60 * 1000;

// reMarkable agenda check interval (1 minute - to check if push time reached)
const REMARKABLE_AGENDA_CHECK_INTERVAL_MS = 60 * 1000;

// Profile planner check interval (1 minute - to check if push time reached)
const PROFILE_PLANNER_CHECK_INTERVAL_MS = 60 * 1000;

// Calendar sync interval (2 minutes)
const CALENDAR_SYNC_INTERVAL_MS = 2 * 60 * 1000;

// Determine the appropriate polling interval based on game states
function determineSportsPollingInterval(games: SportsGame[]): number {
  if (games.length === 0) {
    return SPORTS_POLL_IDLE;
  }

  const now = new Date();
  let hasLiveGame = false;
  let hasUpcomingGame = false;
  let hasRecentlyEndedGame = false;

  for (const game of games) {
    const gameTime = new Date(game.startTime);
    const timeDiffMs = gameTime.getTime() - now.getTime();
    const timeSinceStartMs = now.getTime() - gameTime.getTime();

    if (game.status === "in_progress" || game.status === "halftime") {
      hasLiveGame = true;
      break; // Live game takes priority
    }

    if (game.status === "final") {
      // Assume games last about 3 hours, check if ended recently
      const estimatedEndTime = new Date(gameTime.getTime() + 3 * 60 * 60 * 1000);
      const timeSinceEnd = now.getTime() - estimatedEndTime.getTime();
      if (timeSinceEnd >= 0 && timeSinceEnd < 30 * 60 * 1000) {
        hasRecentlyEndedGame = true;
      }
    }

    if (game.status === "scheduled" && timeDiffMs > 0 && timeDiffMs < 60 * 60 * 1000) {
      hasUpcomingGame = true;
    }
  }

  if (hasLiveGame) {
    return SPORTS_POLL_LIVE;
  }
  if (hasUpcomingGame || hasRecentlyEndedGame) {
    return SPORTS_POLL_PREGAME;
  }
  return SPORTS_POLL_IDLE;
}

const schedulerPluginCallback: FastifyPluginAsync = async (fastify) => {
  let iptvCacheInterval: NodeJS.Timeout | null = null;
  let sportsInterval: NodeJS.Timeout | null = null;
  let entityTimerInterval: NodeJS.Timeout | null = null;
  let automationInterval: NodeJS.Timeout | null = null;
  let newsInterval: NodeJS.Timeout | null = null;
  let remarkableNoteInterval: NodeJS.Timeout | null = null;
  let remarkableAgendaInterval: NodeJS.Timeout | null = null;
  let profilePlannerInterval: NodeJS.Timeout | null = null;
  let calendarSyncInterval: NodeJS.Timeout | null = null;
  let currentSportsPollingInterval = SPORTS_POLL_IDLE;
  // Track which users have already pushed agenda today
  const agendaPushedToday = new Map<string, string>(); // userId -> dateString
  // Track which profiles have already pushed planner today
  const profilePlannerPushedToday = new Map<string, string>(); // profileId -> dateString

  // Start the IPTV cache refresh scheduler
  const startIptvCacheScheduler = () => {
    const cacheService = getIptvCacheService(fastify);

    // Immediately load from database on startup (milliseconds, no API calls)
    (async () => {
      try {
        const usersWithServers = await fastify.db
          .selectDistinct({ userId: iptvServers.userId })
          .from(iptvServers);

        let loadedCount = 0;
        for (const { userId } of usersWithServers) {
          const loaded = await cacheService.loadFromDatabase(userId);
          if (loaded) loadedCount++;
        }

        if (usersWithServers.length > 0) {
          const stats = cacheService.getCacheStats();
          fastify.log.info(
            `IPTV DB cache loaded: ${loadedCount}/${usersWithServers.length} users, ${stats.totalChannels} channels, ${stats.totalEpgEntries} EPG entries`
          );
        }
      } catch (error) {
        fastify.log.error({ err: error }, "Failed to load IPTV cache from database on startup");
      }
    })();

    // Initial API refresh after startup delay (updates from live IPTV servers)
    setTimeout(async () => {
      fastify.log.info("Running initial IPTV cache refresh from API...");
      try {
        await cacheService.refreshAllUsersCache();
        const stats = cacheService.getCacheStats();
        fastify.log.info(
          `Initial IPTV cache complete: ${stats.userCount} users, ${stats.totalChannels} channels, ${stats.totalEpgEntries} EPG entries`
        );
      } catch (error) {
        fastify.log.error({ err: error }, "Initial IPTV cache refresh failed");
      }
    }, STARTUP_DELAY_MS);

    // Schedule periodic refresh
    iptvCacheInterval = setInterval(async () => {
      fastify.log.info("Running scheduled IPTV cache refresh...");
      try {
        await cacheService.refreshAllUsersCache();
        const stats = cacheService.getCacheStats();
        fastify.log.info(
          `Scheduled IPTV cache complete: ${stats.userCount} users, ${stats.totalChannels} channels, ${stats.totalEpgEntries} EPG entries`
        );
      } catch (error) {
        fastify.log.error({ err: error }, "Scheduled IPTV cache refresh failed");
      }
    }, IPTV_CACHE_REFRESH_INTERVAL_MS);

    fastify.log.info(
      `IPTV cache scheduler started (refresh every ${IPTV_CACHE_REFRESH_INTERVAL_MS / 1000 / 60 / 60} hours)`
    );
  };

  // Start sports data refresh scheduler with smart polling
  const startSportsScheduler = () => {
    const refreshSportsData = async () => {
      try {
        // Get all unique user/team combinations
        const allFavorites = await fastify.db
          .select()
          .from(favoriteSportsTeams);

        if (allFavorites.length === 0) {
          fastify.log.debug("No favorite sports teams configured, skipping sports refresh");
          return [];
        }

        // Group by league to minimize API calls
        const byLeague = new Map<string, Set<string>>();
        for (const fav of allFavorites) {
          const key = `${fav.sport}/${fav.league}`;
          if (!byLeague.has(key)) {
            byLeague.set(key, new Set());
          }
          byLeague.get(key)!.add(fav.teamId);
        }

        const today = formatDateForESPN(new Date());
        const allGames: SportsGame[] = [];

        // Fetch games for each league
        for (const [key, teamIds] of byLeague) {
          const parts = key.split("/");
          const sport = parts[0] ?? "";
          const league = parts[1] ?? "";
          try {
            const games = await fetchScoreboard(sport, league, today);
            // Filter to only games involving favorite teams
            const relevantGames = games.filter(
              (game) => teamIds.has(game.homeTeam.id) || teamIds.has(game.awayTeam.id)
            );
            allGames.push(...relevantGames);
          } catch (err) {
            fastify.log.error({ err, league: key }, "Failed to fetch sports scoreboard");
          }
        }

        return allGames;
      } catch (error) {
        fastify.log.error({ err: error }, "Sports data refresh failed");
        return [];
      }
    };

    const scheduleSportsRefresh = async () => {
      // Clear existing interval
      if (sportsInterval) {
        clearTimeout(sportsInterval);
      }

      // Refresh data
      const games = await refreshSportsData();

      // Determine next polling interval based on game states
      const newInterval = determineSportsPollingInterval(games);

      if (newInterval !== currentSportsPollingInterval) {
        const intervalName =
          newInterval === SPORTS_POLL_LIVE ? "LIVE (30s)" :
          newInterval === SPORTS_POLL_PREGAME ? "PRE-GAME (5min)" :
          "IDLE (30min)";
        fastify.log.info(`Sports polling interval changed to ${intervalName}`);
        currentSportsPollingInterval = newInterval;
      }

      // Schedule next refresh
      sportsInterval = setTimeout(scheduleSportsRefresh, currentSportsPollingInterval);
    };

    // Initial refresh after startup delay
    setTimeout(async () => {
      fastify.log.info("Starting sports data scheduler...");
      await scheduleSportsRefresh();
    }, STARTUP_DELAY_MS + 5000); // Start 5 seconds after IPTV
  };

  // Start entity timer scheduler
  const startEntityTimerScheduler = () => {
    const processTimers = async () => {
      try {
        const now = new Date();

        // Get all timers that are due
        const dueTimers = await fastify.db
          .select()
          .from(haEntityTimers)
          .where(lte(haEntityTimers.triggerAt, now));

        if (dueTimers.length === 0) return;

        fastify.log.info(`Processing ${dueTimers.length} due entity timer(s)`);

        for (const timer of dueTimers) {
          try {
            // Get user's HA config
            const [config] = await fastify.db
              .select()
              .from(homeAssistantConfig)
              .where(eq(homeAssistantConfig.userId, timer.userId))
              .limit(1);

            if (!config) {
              fastify.log.warn({ timerId: timer.id }, "No HA config found for timer, deleting");
              await fastify.db.delete(haEntityTimers).where(eq(haEntityTimers.id, timer.id));
              continue;
            }

            const domain = timer.entityId.split(".")[0];
            const service = timer.action === "turn_on" ? "turn_on" : "turn_off";

            // Build service data
            const serviceData: Record<string, unknown> = {
              entity_id: timer.entityId,
            };

            // Add transition for fade (lights only)
            if (timer.fadeEnabled && timer.fadeDuration > 0 && domain === "light") {
              serviceData.transition = timer.fadeDuration;
            }

            // Call HA service
            const baseUrl = config.url.replace(/\/+$/, "");
            const response = await fetch(`${baseUrl}/api/services/${domain}/${service}`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${config.accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(serviceData),
            });

            if (response.ok) {
              fastify.log.info(
                { entityId: timer.entityId, action: timer.action, fade: timer.fadeEnabled },
                "Entity timer executed successfully"
              );
            } else {
              fastify.log.error(
                { entityId: timer.entityId, status: response.status },
                "Entity timer execution failed"
              );
            }

            // Delete the timer after execution (one-time only)
            await fastify.db.delete(haEntityTimers).where(eq(haEntityTimers.id, timer.id));
          } catch (err) {
            fastify.log.error({ err, timerId: timer.id }, "Error processing entity timer");
            // Still delete the timer to prevent infinite retries
            await fastify.db.delete(haEntityTimers).where(eq(haEntityTimers.id, timer.id));
          }
        }
      } catch (error) {
        fastify.log.error({ err: error }, "Entity timer scheduler error");
      }
    };

    // Start polling after a short delay
    setTimeout(async () => {
      fastify.log.info("Starting entity timer scheduler (10s interval)...");
      await processTimers();

      entityTimerInterval = setInterval(processTimers, ENTITY_TIMER_POLL_INTERVAL_MS);
    }, 5000);
  };

  // Start automation scheduler
  const startAutomationScheduler = () => {
    const engine = getAutomationEngine(fastify);

    const processAutomations = async () => {
      try {
        // Process time-based triggers
        await engine.processTimeTriggers();

        // Process duration-based triggers
        await engine.processDurationTriggers();
      } catch (error) {
        fastify.log.error({ err: error }, "Automation scheduler error");
      }
    };

    // Start polling after startup delay
    setTimeout(async () => {
      fastify.log.info("Starting automation scheduler (30s interval)...");
      await processAutomations();

      automationInterval = setInterval(processAutomations, AUTOMATION_POLL_INTERVAL_MS);
    }, STARTUP_DELAY_MS + 10000); // Start 10 seconds after IPTV
  };

  // Start news feed refresh scheduler
  const startNewsScheduler = () => {
    const cacheService = getNewsCacheService(fastify);

    // Initial refresh after startup delay
    setTimeout(async () => {
      fastify.log.info("Running initial news feed refresh...");
      try {
        await cacheService.refreshAllFeeds();
        const stats = await cacheService.getCacheStats();
        fastify.log.info(
          `Initial news refresh complete: ${stats.feedCount} feeds, ${stats.articleCount} articles`
        );
      } catch (error) {
        fastify.log.error({ err: error }, "Initial news feed refresh failed");
      }
    }, STARTUP_DELAY_MS + 15000); // Start 15 seconds after IPTV

    // Schedule periodic refresh
    newsInterval = setInterval(async () => {
      fastify.log.info("Running scheduled news feed refresh...");
      try {
        await cacheService.refreshAllFeeds();
        const stats = await cacheService.getCacheStats();
        fastify.log.info(
          `Scheduled news refresh complete: ${stats.feedCount} feeds, ${stats.articleCount} articles`
        );
      } catch (error) {
        fastify.log.error({ err: error }, "Scheduled news feed refresh failed");
      }
    }, NEWS_REFRESH_INTERVAL_MS);

    fastify.log.info(
      `News feed scheduler started (refresh every ${NEWS_REFRESH_INTERVAL_MS / 1000 / 60} minutes)`
    );
  };

  // Start calendar sync scheduler
  const startCalendarSyncScheduler = () => {
    const syncAllCalendars = async () => {
      try {
        // Get all users with Google OAuth tokens
        const tokens = await fastify.db
          .select()
          .from(oauthTokens)
          .where(eq(oauthTokens.provider, "google"));

        for (const token of tokens) {
          try {
            await syncGoogleCalendars(fastify.db, token.userId, token);
          } catch (err) {
            fastify.log.error(
              { err, userId: token.userId },
              "Failed to sync Google calendars"
            );
          }
        }
      } catch (error) {
        fastify.log.error({ err: error }, "Calendar sync scheduler failed");
      }
    };

    // Initial sync after startup delay
    setTimeout(async () => {
      fastify.log.info("Running initial calendar sync...");
      await syncAllCalendars();

      // Schedule periodic sync
      calendarSyncInterval = setInterval(async () => {
        fastify.log.info("Running scheduled calendar sync...");
        await syncAllCalendars();
      }, CALENDAR_SYNC_INTERVAL_MS);

      fastify.log.info(
        `Calendar sync scheduler started (refresh every ${CALENDAR_SYNC_INTERVAL_MS / 1000 / 60} minutes)`
      );
    }, STARTUP_DELAY_MS + 10000); // Start 10 seconds after other services
  };

  // Start reMarkable note polling scheduler
  const startRemarkableNoteScheduler = () => {
    const pollNotes = async () => {
      try {
        // Get all connected reMarkable users
        const connectedUsers = await fastify.db
          .select()
          .from(remarkableConfig)
          .where(eq(remarkableConfig.isConnected, true));

        for (const config of connectedUsers) {
          try {
            await syncRemarkableDocuments(fastify, config.userId);
          } catch (err) {
            fastify.log.error(
              { err, userId: config.userId },
              "Failed to sync reMarkable documents"
            );
          }
        }
      } catch (error) {
        fastify.log.error({ err: error }, "reMarkable note polling failed");
      }
    };

    // Start polling after startup delay
    setTimeout(async () => {
      fastify.log.info("Starting reMarkable note polling (5 min interval)...");
      await pollNotes();

      remarkableNoteInterval = setInterval(pollNotes, REMARKABLE_POLL_INTERVAL_MS);
    }, STARTUP_DELAY_MS + 20000); // Start 20 seconds after IPTV
  };

  // Start reMarkable agenda push scheduler
  const startRemarkableAgendaScheduler = () => {
    const checkAgendaPush = async () => {
      try {
        const now = new Date();
        const todayStr = format(now, "yyyy-MM-dd");
        const currentTime = format(now, "HH:mm");

        // Get all users with agenda push enabled
        const agendaSettings = await fastify.db
          .select()
          .from(remarkableAgendaSettings)
          .where(eq(remarkableAgendaSettings.enabled, true));

        for (const settings of agendaSettings) {
          // Check if already pushed today
          if (agendaPushedToday.get(settings.userId) === todayStr) {
            continue;
          }

          // Check if it's time to push (within 1 minute window)
          if (currentTime >= settings.pushTime) {
            // Verify connection is active
            const [config] = await fastify.db
              .select()
              .from(remarkableConfig)
              .where(
                and(
                  eq(remarkableConfig.userId, settings.userId),
                  eq(remarkableConfig.isConnected, true)
                )
              )
              .limit(1);

            if (!config) {
              continue;
            }

            try {
              fastify.log.info({ userId: settings.userId }, "Pushing daily agenda to reMarkable...");

              const start = startOfDay(now);
              const end = endOfDay(now);

              // Get calendars to include
              let calendarIds: string[];
              if (settings.includeCalendarIds && settings.includeCalendarIds.length > 0) {
                calendarIds = settings.includeCalendarIds;
              } else {
                const userCalendars = await fastify.db
                  .select()
                  .from(calendars)
                  .where(and(eq(calendars.userId, settings.userId), eq(calendars.isVisible, true)));
                calendarIds = userCalendars.map((c) => c.id);
              }

              // Get events for today
              const dayEvents: AgendaEvent[] = [];
              const calendarMap = new Map<string, typeof calendars.$inferSelect>();

              for (const calId of calendarIds) {
                const [cal] = await fastify.db
                  .select()
                  .from(calendars)
                  .where(eq(calendars.id, calId))
                  .limit(1);

                if (cal) {
                  calendarMap.set(calId, cal);
                }

                const calEvents = await fastify.db
                  .select()
                  .from(events)
                  .where(
                    and(
                      eq(events.calendarId, calId),
                      lte(events.startTime, end),
                      gte(events.endTime, start)
                    )
                  );

                for (const event of calEvents) {
                  dayEvents.push({
                    title: event.title,
                    startTime: event.startTime,
                    endTime: event.endTime,
                    isAllDay: event.isAllDay,
                    location: event.location,
                    description: event.description,
                    calendarName: calendarMap.get(calId)?.name,
                    calendarColor: calendarMap.get(calId)?.color ?? undefined,
                  });
                }
              }

              // Generate PDF
              const pdfBuffer = await generateAgendaPdf({
                date: now,
                events: dayEvents,
                showLocation: settings.showLocation,
                showDescription: settings.showDescription,
                notesLines: settings.notesLines,
                templateStyle: settings.templateStyle as "default" | "minimal" | "detailed",
              });

              // Upload to reMarkable
              const client = getRemarkableClient(fastify, settings.userId);
              const filename = getAgendaFilename(now);
              const documentId = await client.uploadPdf(pdfBuffer, filename, settings.folderPath);

              // Track the document
              await fastify.db.insert(remarkableDocuments).values({
                userId: settings.userId,
                documentId,
                documentVersion: 1,
                documentName: filename,
                documentType: "pdf",
                folderPath: settings.folderPath,
                isAgenda: true,
                isProcessed: false,
              });

              // Update last push time
              await fastify.db
                .update(remarkableAgendaSettings)
                .set({ lastPushAt: now, updatedAt: now })
                .where(eq(remarkableAgendaSettings.id, settings.id));

              // Mark as pushed today
              agendaPushedToday.set(settings.userId, todayStr);

              fastify.log.info(
                { userId: settings.userId, eventCount: dayEvents.length },
                "Daily agenda pushed to reMarkable"
              );
            } catch (err) {
              fastify.log.error(
                { err, userId: settings.userId },
                "Failed to push agenda to reMarkable"
              );
            }
          }
        }

        // Clean up old entries from agendaPushedToday
        for (const [userId, dateStr] of agendaPushedToday.entries()) {
          if (dateStr !== todayStr) {
            agendaPushedToday.delete(userId);
          }
        }
      } catch (error) {
        fastify.log.error({ err: error }, "reMarkable agenda scheduler error");
      }
    };

    // Start checking after startup delay
    setTimeout(async () => {
      fastify.log.info("Starting reMarkable agenda scheduler (1 min interval)...");
      await checkAgendaPush();

      remarkableAgendaInterval = setInterval(checkAgendaPush, REMARKABLE_AGENDA_CHECK_INTERVAL_MS);
    }, STARTUP_DELAY_MS + 25000); // Start 25 seconds after IPTV
  };

  // Start profile planner push scheduler (new widget-based system)
  const startProfilePlannerScheduler = () => {
    /**
     * Helper to gather all data needed for planner PDF generation (similar to profiles route)
     */
    async function gatherPlannerData(
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

      // Get calendar events if needed
      let calendarEvents: CalendarEvent[] = [];
      if (needsEvents) {
        const calendarSettings = await fastify.db
          .select()
          .from(profileCalendars)
          .where(eq(profileCalendars.profileId, profileId));

        const userCalendars = await fastify.db
          .select()
          .from(calendars)
          .where(eq(calendars.userId, userId));

        const visibleCalendarIds = calendarSettings.length > 0
          ? calendarSettings.filter(s => s.isVisible).map(s => s.calendarId)
          : userCalendars.map(c => c.id);

        const calendarMap = new Map(userCalendars.map(c => [c.id, c]));

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

      // Get tasks if needed
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

      // Get news if needed
      let newsItems: NewsItem[] = [];
      if (needsNews) {
        const feedSettings = await fastify.db
          .select()
          .from(profileNewsFeeds)
          .where(eq(profileNewsFeeds.profileId, profileId));

        const userFeeds = await fastify.db
          .select()
          .from(newsFeeds)
          .where(eq(newsFeeds.userId, userId));

        const visibleFeedIds = feedSettings.length > 0
          ? feedSettings.filter(s => s.isVisible).map(s => s.newsFeedId)
          : userFeeds.filter(f => f.isActive).map(f => f.id);

        if (visibleFeedIds.length > 0) {
          const articles = await fastify.db
            .select()
            .from(newsArticles)
            .where(inArray(newsArticles.feedId, visibleFeedIds))
            .orderBy(newsArticles.publishedAt)
            .limit(10);

          const feedMap = new Map(userFeeds.map(f => [f.id, f]));
          newsItems = articles.map(a => ({
            id: a.id,
            title: a.title,
            source: feedMap.get(a.feedId)?.name,
            publishedAt: a.publishedAt ?? undefined,
          }));
        }
      }

      // Get weather if needed
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
            const currentResponse = await fetch(
              `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${units}`
            );

            if (currentResponse.ok) {
              const currentData = await currentResponse.json() as {
                main: { temp: number };
                weather: Array<{ description: string; icon: string }>;
              };

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
          fastify.log.error({ err }, "Failed to fetch weather for scheduled planner");
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

    const checkProfilePlannerPush = async () => {
      try {
        const now = new Date();
        const todayStr = format(now, "yyyy-MM-dd");
        const currentTime = format(now, "HH:mm");

        // Get all profile remarkable settings with enabled = true and scheduleType = daily
        const allSettings = await fastify.db
          .select()
          .from(profileRemarkableSettings)
          .where(eq(profileRemarkableSettings.enabled, true));

        for (const settings of allSettings) {
          // Check if already pushed today
          if (profilePlannerPushedToday.get(settings.profileId) === todayStr) {
            continue;
          }

          // Check schedule type and timing
          if (settings.scheduleType === "manual") {
            continue; // Manual mode - don't auto-push
          }

          // For daily schedule, check if current time >= push time
          const pushTime = settings.pushTime || "06:00";
          if (settings.scheduleType === "daily" && currentTime >= pushTime) {
            // Get the profile to find the user
            const [profile] = await fastify.db
              .select()
              .from(familyProfiles)
              .where(eq(familyProfiles.id, settings.profileId))
              .limit(1);

            if (!profile) {
              continue;
            }

            // Check if reMarkable is connected for this user
            const [rmConfig] = await fastify.db
              .select()
              .from(remarkableConfig)
              .where(
                and(
                  eq(remarkableConfig.userId, profile.userId),
                  eq(remarkableConfig.isConnected, true)
                )
              )
              .limit(1);

            if (!rmConfig) {
              continue;
            }

            // Get the planner config
            const [plannerConfig] = await fastify.db
              .select()
              .from(profilePlannerConfig)
              .where(eq(profilePlannerConfig.profileId, settings.profileId))
              .limit(1);

            if (!plannerConfig || !plannerConfig.layoutConfig) {
              continue;
            }

            const layoutConfig = plannerConfig.layoutConfig as PlannerLayoutConfig;

            // Skip if no widgets configured
            if (!layoutConfig.widgets || layoutConfig.widgets.length === 0) {
              continue;
            }

            try {
              fastify.log.info(
                { profileId: settings.profileId, profileName: profile.name },
                "Pushing scheduled profile planner to reMarkable..."
              );

              // Gather planner data
              const plannerData = await gatherPlannerData(
                profile.userId,
                settings.profileId,
                now,
                layoutConfig
              );

              // Generate PDF
              const { buffer, filename } = await generatePlannerPdf(layoutConfig, plannerData);

              // Upload to reMarkable
              const folderPath = settings.folderPath || "/Calendar";
              const client = getRemarkableClient(fastify, profile.userId);
              const documentId = await client.uploadPdf(buffer, filename, folderPath);

              // Track the document
              await fastify.db.insert(remarkableDocuments).values({
                userId: profile.userId,
                documentId,
                documentVersion: 1,
                documentName: filename,
                documentType: "pdf",
                folderPath,
                isAgenda: true,
                isProcessed: false,
              });

              // Update last push time
              await fastify.db
                .update(profileRemarkableSettings)
                .set({ lastPushAt: now, updatedAt: now })
                .where(eq(profileRemarkableSettings.id, settings.id));

              // Mark as pushed today
              profilePlannerPushedToday.set(settings.profileId, todayStr);

              fastify.log.info(
                { profileId: settings.profileId, profileName: profile.name, documentId },
                "Profile planner pushed to reMarkable"
              );
            } catch (err) {
              fastify.log.error(
                { err, profileId: settings.profileId },
                "Failed to push profile planner to reMarkable"
              );
            }
          }

          // Weekly schedule - check day of week
          if (settings.scheduleType === "weekly" && settings.pushDay !== null) {
            const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
            const weeklyPushTime = settings.pushTime || "06:00";
            if (currentDayOfWeek === settings.pushDay && currentTime >= weeklyPushTime) {
              // Same logic as daily, but only on the specified day
              const [profile] = await fastify.db
                .select()
                .from(familyProfiles)
                .where(eq(familyProfiles.id, settings.profileId))
                .limit(1);

              if (!profile) continue;

              const [rmConfig] = await fastify.db
                .select()
                .from(remarkableConfig)
                .where(
                  and(
                    eq(remarkableConfig.userId, profile.userId),
                    eq(remarkableConfig.isConnected, true)
                  )
                )
                .limit(1);

              if (!rmConfig) continue;

              const [plannerConfig] = await fastify.db
                .select()
                .from(profilePlannerConfig)
                .where(eq(profilePlannerConfig.profileId, settings.profileId))
                .limit(1);

              if (!plannerConfig || !plannerConfig.layoutConfig) continue;

              const layoutConfig = plannerConfig.layoutConfig as PlannerLayoutConfig;
              if (!layoutConfig.widgets || layoutConfig.widgets.length === 0) continue;

              try {
                fastify.log.info(
                  { profileId: settings.profileId, profileName: profile.name },
                  "Pushing weekly scheduled profile planner to reMarkable..."
                );

                const plannerData = await gatherPlannerData(
                  profile.userId,
                  settings.profileId,
                  now,
                  layoutConfig
                );

                const { buffer, filename } = await generatePlannerPdf(layoutConfig, plannerData);
                const weeklyFolderPath = settings.folderPath || "/Calendar";
                const client = getRemarkableClient(fastify, profile.userId);
                const documentId = await client.uploadPdf(buffer, filename, weeklyFolderPath);

                await fastify.db.insert(remarkableDocuments).values({
                  userId: profile.userId,
                  documentId,
                  documentVersion: 1,
                  documentName: filename,
                  documentType: "pdf",
                  folderPath: weeklyFolderPath,
                  isAgenda: true,
                  isProcessed: false,
                });

                await fastify.db
                  .update(profileRemarkableSettings)
                  .set({ lastPushAt: now, updatedAt: now })
                  .where(eq(profileRemarkableSettings.id, settings.id));

                profilePlannerPushedToday.set(settings.profileId, todayStr);

                fastify.log.info(
                  { profileId: settings.profileId, profileName: profile.name, documentId },
                  "Weekly profile planner pushed to reMarkable"
                );
              } catch (err) {
                fastify.log.error(
                  { err, profileId: settings.profileId },
                  "Failed to push weekly profile planner to reMarkable"
                );
              }
            }
          }
        }

        // Clean up old entries
        for (const [profileId, dateStr] of profilePlannerPushedToday.entries()) {
          if (dateStr !== todayStr) {
            profilePlannerPushedToday.delete(profileId);
          }
        }
      } catch (error) {
        fastify.log.error({ err: error }, "Profile planner scheduler error");
      }
    };

    // Start checking after startup delay
    setTimeout(async () => {
      fastify.log.info("Starting profile planner scheduler (1 min interval)...");
      await checkProfilePlannerPush();

      profilePlannerInterval = setInterval(checkProfilePlannerPush, PROFILE_PLANNER_CHECK_INTERVAL_MS);
    }, STARTUP_DELAY_MS + 30000); // Start 30 seconds after IPTV
  };

  // Start scheduler when server is ready
  fastify.addHook("onReady", async () => {
    startIptvCacheScheduler();
    startSportsScheduler();
    startEntityTimerScheduler();
    startAutomationScheduler();
    startNewsScheduler();
    startCalendarSyncScheduler();
    startRemarkableNoteScheduler();
    startRemarkableAgendaScheduler();
    startProfilePlannerScheduler();
  });

  // Clean up on server close
  fastify.addHook("onClose", async () => {
    if (iptvCacheInterval) {
      clearInterval(iptvCacheInterval);
      iptvCacheInterval = null;
      fastify.log.info("IPTV cache scheduler stopped");
    }
    if (sportsInterval) {
      clearTimeout(sportsInterval);
      sportsInterval = null;
      fastify.log.info("Sports data scheduler stopped");
    }
    if (entityTimerInterval) {
      clearInterval(entityTimerInterval);
      entityTimerInterval = null;
      fastify.log.info("Entity timer scheduler stopped");
    }
    if (automationInterval) {
      clearInterval(automationInterval);
      automationInterval = null;
      fastify.log.info("Automation scheduler stopped");
    }
    if (newsInterval) {
      clearInterval(newsInterval);
      newsInterval = null;
      fastify.log.info("News feed scheduler stopped");
    }
    if (calendarSyncInterval) {
      clearInterval(calendarSyncInterval);
      calendarSyncInterval = null;
      fastify.log.info("Calendar sync scheduler stopped");
    }
    if (remarkableNoteInterval) {
      clearInterval(remarkableNoteInterval);
      remarkableNoteInterval = null;
      fastify.log.info("reMarkable note scheduler stopped");
    }
    if (remarkableAgendaInterval) {
      clearInterval(remarkableAgendaInterval);
      remarkableAgendaInterval = null;
      fastify.log.info("reMarkable agenda scheduler stopped");
    }
    if (profilePlannerInterval) {
      clearInterval(profilePlannerInterval);
      profilePlannerInterval = null;
      fastify.log.info("Profile planner scheduler stopped");
    }
  });
};

export const schedulerPlugin = fp(schedulerPluginCallback, {
  name: "scheduler",
  dependencies: ["database"],
});
