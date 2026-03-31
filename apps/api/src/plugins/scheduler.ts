/**
 * Scheduler Plugin
 * Handles periodic background tasks like IPTV cache refresh, sports data updates,
 * and Home Assistant entity timers
 */

import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { eq, and, gte, lte, inArray, isNotNull, desc } from "drizzle-orm";
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
  matterDevices,
  photoAlbums,
  photos,
} from "@openframe/database/schema";
import { getRemarkableClient } from "../services/remarkable/client.js";
import { syncGoogleCalendars } from "../services/calendar-sync/google.js";
import { syncMicrosoftCalendars } from "../services/calendar-sync/microsoft.js";
import { syncICSCalendar } from "../services/calendar-sync/ics.js";
import { decryptEventFields, decryptOAuthToken } from "../lib/encryption.js";
import { oauthTokens, users } from "@openframe/database/schema";
import { hasRequiredScopes, getScopesForFeature } from "../utils/oauth-scopes.js";
import { generateAgendaPdf, getAgendaFilename, type AgendaEvent } from "../services/remarkable/agenda-generator.js";
import { generatePlannerPdf, type CalendarEvent, type TaskItem, type NewsItem, type WeatherData, type PlannerGeneratorOptions } from "../services/planner-generator.js";
import type { PlannerLayoutConfig } from "@openframe/shared";
import { getCategorySettings } from "../routes/settings/index.js";
import { syncRemarkableDocuments } from "../services/remarkable/note-processor.js";
import { startOfDay, endOfDay, format, parse } from "date-fns";
import { listAlbumPhotos, getAccessToken, getPhotoUrl } from "../services/google-photos.js";
import { randomUUID } from "crypto";
import { processImage } from "../services/photos/processor.js";
import { mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import * as os from "os";
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

// rmapi config file path (must match client.ts)
const RMAPI_HOME = process.env.NODE_ENV === "production" ? "/root" : os.homedir();
const RMAPI_CONFIG = join(RMAPI_HOME, ".config", "rmapi", "rmapi.conf");

// Max consecutive rmapi failures before stopping retries for the day
const MAX_RMAPI_FAILURES = 3;

// Matter device reachability check interval (2 minutes)
const MATTER_REACHABILITY_INTERVAL_MS = 2 * 60 * 1000;

// Calendar sync check interval (runs every 60s, respects per-calendar intervals)
const CALENDAR_SYNC_CHECK_INTERVAL_MS = 60 * 1000;

// Default sync intervals (used when calendar.syncInterval is null)
const DEFAULT_CALENDAR_SYNC_MINUTES = 2; // Google/Microsoft
const DEFAULT_ICS_SYNC_MINUTES = 15; // ICS feeds
const DEFAULT_HA_SYNC_MINUTES = 15; // Home Assistant calendars

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
  let matterReachabilityInterval: NodeJS.Timeout | null = null;
  let currentSportsPollingInterval = SPORTS_POLL_IDLE;
  // Track which users have already pushed agenda today
  const agendaPushedToday = new Map<string, string>(); // userId -> dateString
  // Track which profiles have already pushed planner today
  const profilePlannerPushedToday = new Map<string, string>(); // profileId -> dateString
  // Track consecutive rmapi failures to avoid infinite retries
  const agendaFailCount = new Map<string, number>(); // userId -> failure count
  const plannerFailCount = new Map<string, number>(); // profileId -> failure count

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

  // Unified calendar sync scheduler — checks per-calendar intervals
  const startCalendarSyncScheduler = () => {
    const isDueForSync = (calendar: { syncInterval: number | null; lastSyncAt: Date | null; provider: string }): boolean => {
      if (!calendar.lastSyncAt) return true; // Never synced
      const defaultMinutes =
        calendar.provider === "ics" ? DEFAULT_ICS_SYNC_MINUTES :
        calendar.provider === "homeassistant" ? DEFAULT_HA_SYNC_MINUTES :
        DEFAULT_CALENDAR_SYNC_MINUTES;
      const intervalMs = (calendar.syncInterval ?? defaultMinutes) * 60 * 1000;
      return Date.now() - new Date(calendar.lastSyncAt).getTime() >= intervalMs;
    };

    const syncDueCalendars = async () => {
      try {
        // --- Google calendars ---
        const googleTokens = await fastify.db
          .select()
          .from(oauthTokens)
          .where(eq(oauthTokens.provider, "google"));

        const googleCalScopes = getScopesForFeature("google", "calendar");
        for (const token of googleTokens) {
          if (!hasRequiredScopes(token.scope, googleCalScopes)) continue;
          // Check if any calendar for this token is due
          const tokenCalendars = await fastify.db
            .select({ syncInterval: calendars.syncInterval, lastSyncAt: calendars.lastSyncAt, provider: calendars.provider })
            .from(calendars)
            .where(and(eq(calendars.userId, token.userId), eq(calendars.provider, "google"), eq(calendars.syncEnabled, true)));
          if (!tokenCalendars.some(isDueForSync)) continue;
          try {
            await syncGoogleCalendars(fastify.db, token.userId, token);
          } catch (err) {
            fastify.log.error({ err, userId: token.userId }, "Failed to sync Google calendars");
          }
        }

        // --- Microsoft calendars ---
        const microsoftTokens = await fastify.db
          .select()
          .from(oauthTokens)
          .where(eq(oauthTokens.provider, "microsoft"));

        const msCalScopes = getScopesForFeature("microsoft", "calendar");
        for (const token of microsoftTokens) {
          if (!hasRequiredScopes(token.scope, msCalScopes)) continue;
          const tokenCalendars = await fastify.db
            .select({ syncInterval: calendars.syncInterval, lastSyncAt: calendars.lastSyncAt, provider: calendars.provider })
            .from(calendars)
            .where(and(eq(calendars.userId, token.userId), eq(calendars.provider, "microsoft"), eq(calendars.syncEnabled, true)));
          if (!tokenCalendars.some(isDueForSync)) continue;
          try {
            await syncMicrosoftCalendars(fastify.db, token.userId, token);
          } catch (err) {
            fastify.log.error({ err, userId: token.userId }, "Failed to sync Microsoft calendars");
          }
        }

        // --- ICS calendars (synced individually) ---
        const icsCalendars = await fastify.db
          .select()
          .from(calendars)
          .where(and(eq(calendars.provider, "ics"), eq(calendars.syncEnabled, true), isNotNull(calendars.sourceUrl)));

        for (const calendar of icsCalendars) {
          if (!isDueForSync(calendar)) continue;
          try {
            await syncICSCalendar(fastify.db, calendar.id, calendar.sourceUrl!);
            await fastify.db.update(calendars).set({ lastSyncAt: new Date() }).where(eq(calendars.id, calendar.id));
          } catch (err) {
            fastify.log.error({ err, calendarId: calendar.id }, "Failed to sync ICS feed");
          }
        }

        // --- Home Assistant calendars (synced individually) ---
        const haCalendars = await fastify.db
          .select({ id: calendars.id, userId: calendars.userId, externalId: calendars.externalId, syncInterval: calendars.syncInterval, lastSyncAt: calendars.lastSyncAt, provider: calendars.provider })
          .from(calendars)
          .where(and(eq(calendars.provider, "homeassistant"), eq(calendars.syncEnabled, true)));

        // Group by user to reuse HA config
        const haByUser = new Map<string, typeof haCalendars>();
        for (const cal of haCalendars) {
          if (!isDueForSync(cal)) continue;
          const group = haByUser.get(cal.userId) ?? [];
          group.push(cal);
          haByUser.set(cal.userId, group);
        }

        for (const [userId, cals] of haByUser) {
          const [config] = await fastify.db.select().from(homeAssistantConfig).where(eq(homeAssistantConfig.userId, userId)).limit(1);
          if (!config) continue;
          for (const cal of cals) {
            try {
              // Dynamic import to avoid circular deps
              const { syncHACalendar } = await import("../routes/homeassistant/index.js");
              await syncHACalendar(fastify.db, config.url, config.accessToken, cal.id, cal.externalId);
              await fastify.db.update(calendars).set({ lastSyncAt: new Date() }).where(eq(calendars.id, cal.id));
            } catch (err) {
              fastify.log.error({ err, calendarId: cal.id }, "Failed to sync HA calendar");
            }
          }
        }
      } catch (error) {
        fastify.log.error({ err: error }, "Calendar sync scheduler failed");
      }
    };

    // Initial sync shortly after startup (5s to let DB connections settle)
    setTimeout(async () => {
      fastify.log.info("Running initial calendar sync...");
      await syncDueCalendars();

      // Check every 60s which calendars need syncing
      calendarSyncInterval = setInterval(syncDueCalendars, CALENDAR_SYNC_CHECK_INTERVAL_MS);

      fastify.log.info("Calendar sync scheduler started (checking every 60s, per-calendar intervals)");
    }, 5000);
  };

  // Start reMarkable note polling scheduler
  const startRemarkableNoteScheduler = () => {
    const pollNotes = async () => {
      try {
        // Check if rmapi config file exists — if not, skip polling
        if (!existsSync(RMAPI_CONFIG)) {
          return;
        }

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

  // Helper: generate a simple agenda PDF (fallback when no planner config exists)
  async function generateSimpleAgenda(
    _fastify: typeof fastify,
    settings: { userId: string; showLocation: boolean; showDescription: boolean; notesLines: number; templateStyle: string | null; includeCalendarIds: string[] | null },
    now: Date
  ): Promise<{ buffer: Buffer; filename: string }> {
    const start = startOfDay(now);
    const end = endOfDay(now);
    let calendarIds: string[];
    if (settings.includeCalendarIds && settings.includeCalendarIds.length > 0) {
      calendarIds = settings.includeCalendarIds;
    } else {
      const userCalendars = await fastify.db.select().from(calendars)
        .where(and(eq(calendars.userId, settings.userId), eq(calendars.isVisible, true)));
      calendarIds = userCalendars.map(c => c.id);
    }
    const dayEvents: AgendaEvent[] = [];
    for (const calId of calendarIds) {
      const [cal] = await fastify.db.select().from(calendars).where(eq(calendars.id, calId)).limit(1);
      const calEvents = await fastify.db.select().from(events)
        .where(and(eq(events.calendarId, calId), lte(events.startTime, end), gte(events.endTime, start)));
      for (const event of calEvents.map(decryptEventFields)) {
        dayEvents.push({
          title: event.title, startTime: event.startTime, endTime: event.endTime,
          isAllDay: event.isAllDay, location: event.location, description: event.description,
          calendarName: cal?.name, calendarColor: cal?.color ?? undefined,
        });
      }
    }
    const buffer = await generateAgendaPdf({
      date: now, events: dayEvents, showLocation: settings.showLocation,
      showDescription: settings.showDescription, notesLines: settings.notesLines,
      templateStyle: (settings.templateStyle as "default" | "minimal" | "detailed") || "default",
    });
    return { buffer, filename: getAgendaFilename(now) };
  }

  // Start reMarkable agenda push scheduler
  const startRemarkableAgendaScheduler = () => {
    const checkAgendaPush = async () => {
      try {
        const now = new Date();
        const todayStr = format(now, "yyyy-MM-dd");
        const currentTime = format(now, "HH:mm");

        // Check if rmapi config file exists — if not, skip all pushes
        if (!existsSync(RMAPI_CONFIG)) {
          // Only log once per day to avoid spam
          return;
        }

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

          // Check if too many failures today — stop retrying
          const failures = agendaFailCount.get(settings.userId) ?? 0;
          if (failures >= MAX_RMAPI_FAILURES) {
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
              fastify.log.info({ userId: settings.userId }, "Pushing daily planner to reMarkable...");

              // Find the user's default profile with a planner config
              const userProfiles = await fastify.db
                .select()
                .from(familyProfiles)
                .where(eq(familyProfiles.userId, settings.userId));

              const defaultProfile = userProfiles.find(p => p.isDefault) || userProfiles[0];

              let pdfBuffer: Buffer;
              let filename: string;
              // Will be updated if planner config has a pushFolderPath
              let uploadFolder = settings.folderPath || "/Planners";

              if (defaultProfile) {
                // Check for planner config
                const [plannerConfig] = await fastify.db
                  .select()
                  .from(profilePlannerConfig)
                  .where(eq(profilePlannerConfig.profileId, defaultProfile.id))
                  .limit(1);

                if (plannerConfig?.layoutConfig) {
                  // Use planner layout
                  const layoutConfig = plannerConfig.layoutConfig as import("@openframe/shared").PlannerLayoutConfig;

                  // Use pushFolderPath from layout config if set
                  if (layoutConfig.pushFolderPath) {
                    uploadFolder = layoutConfig.pushFolderPath;
                  }

                  // Get user timezone
                  const [userRow] = await fastify.db
                    .select({ timezone: users.timezone })
                    .from(users)
                    .where(eq(users.id, settings.userId))
                    .limit(1);
                  const tz = userRow?.timezone || "UTC";

                  // Calculate day boundaries in user's timezone
                  const dateStr = format(now, "yyyy-MM-dd");
                  const sampleUtc = new Date(`${dateStr}T12:00:00Z`);
                  const sampleLocal = new Date(sampleUtc.toLocaleString("en-US", { timeZone: tz }));
                  const offsetMs = sampleUtc.getTime() - sampleLocal.getTime();
                  const dayStart = new Date(new Date(`${dateStr}T00:00:00Z`).getTime() + offsetMs);
                  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

                  // Gather planner data
                  const widgetTypes = new Set(layoutConfig.widgets.map(w => w.type));

                  // Events
                  const calendarEvents: CalendarEvent[] = [];
                  if (widgetTypes.has("calendar-day") || widgetTypes.has("calendar-week") || widgetTypes.has("calendar-month")) {
                    const userCalendars = await fastify.db
                      .select()
                      .from(calendars)
                      .where(eq(calendars.userId, settings.userId));
                    const visibleIds = userCalendars.map(c => c.id);
                    if (visibleIds.length > 0) {
                      const allEvents = await fastify.db
                        .select()
                        .from(events)
                        .where(and(inArray(events.calendarId, visibleIds), lte(events.startTime, dayEnd), gte(events.endTime, dayStart)));
                      const calMap = new Map(userCalendars.map(c => [c.id, c]));
                      for (const e of allEvents.map(decryptEventFields)) {
                        calendarEvents.push({
                          id: e.id, title: e.title, startTime: e.startTime, endTime: e.endTime,
                          isAllDay: e.isAllDay, location: e.location ?? undefined,
                          calendarName: calMap.get(e.calendarId)?.name, color: calMap.get(e.calendarId)?.color ?? undefined,
                        });
                      }
                    }
                  }

                  // Tasks
                  const taskItems: TaskItem[] = [];
                  if (widgetTypes.has("tasks")) {
                    const userTaskLists = await fastify.db.select().from(taskLists)
                      .where(and(eq(taskLists.userId, settings.userId), eq(taskLists.isVisible, true)));
                    if (userTaskLists.length > 0) {
                      const allTasks = await fastify.db.select().from(tasks)
                        .where(and(inArray(tasks.taskListId, userTaskLists.map(l => l.id)), eq(tasks.status, "needsAction")));
                      for (const t of allTasks.filter(t => !t.dueDate || t.dueDate <= dayEnd)) {
                        taskItems.push({ id: t.id, title: t.title, dueDate: t.dueDate ?? undefined, completed: false });
                      }
                    }
                  }

                  // News
                  const newsItems: NewsItem[] = [];
                  if (widgetTypes.has("news-headlines")) {
                    const userFeeds = await fastify.db.select().from(newsFeeds)
                      .where(and(eq(newsFeeds.userId, settings.userId), eq(newsFeeds.isActive, true)));
                    if (userFeeds.length > 0) {
                      const articles = await fastify.db.select().from(newsArticles)
                        .where(inArray(newsArticles.feedId, userFeeds.map(f => f.id)))
                        .orderBy(desc(newsArticles.publishedAt))
                        .limit(10);
                      for (const a of articles) {
                        const feed = userFeeds.find(f => f.id === a.feedId);
                        newsItems.push({ id: a.id, title: a.title, source: feed?.name, publishedAt: a.publishedAt ?? undefined });
                      }
                    }
                  }

                  const result = await generatePlannerPdf(layoutConfig, {
                    date: dayStart, events: calendarEvents, tasks: taskItems, news: newsItems, timezone: tz,
                  });
                  pdfBuffer = result.buffer;
                  filename = result.filename;
                } else {
                  // No planner config — fall back to simple agenda
                  const agendaPdf = await generateSimpleAgenda(fastify, settings, now);
                  pdfBuffer = agendaPdf.buffer;
                  filename = agendaPdf.filename;
                }
              } else {
                // No profile — fall back to simple agenda
                const agendaPdf = await generateSimpleAgenda(fastify, settings, now);
                pdfBuffer = agendaPdf.buffer;
                filename = agendaPdf.filename;
              }

              // Upload to reMarkable
              const client = getRemarkableClient(fastify, settings.userId);
              const documentId = await client.uploadPdf(pdfBuffer, filename, uploadFolder);

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
                { userId: settings.userId, filename, folder: uploadFolder },
                "Daily planner pushed to reMarkable"
              );
            } catch (err) {
              const count = (agendaFailCount.get(settings.userId) ?? 0) + 1;
              agendaFailCount.set(settings.userId, count);
              fastify.log.error(
                { err, userId: settings.userId, failCount: count, maxRetries: MAX_RMAPI_FAILURES },
                `Failed to push agenda to reMarkable (attempt ${count}/${MAX_RMAPI_FAILURES})`
              );
            }
          }
        }

        // Clean up old entries from agendaPushedToday and reset fail counts on new day
        for (const [userId, dateStr] of agendaPushedToday.entries()) {
          if (dateStr !== todayStr) {
            agendaPushedToday.delete(userId);
            agendaFailCount.delete(userId); // Reset retries for new day
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

          calendarEvents = allEvents.map(e => {
            const d = decryptEventFields(e);
            return {
              id: d.id,
              title: d.title,
              startTime: d.startTime,
              endTime: d.endTime,
              isAllDay: d.isAllDay,
              location: d.location ?? undefined,
              description: d.description ?? undefined,
              calendarName: calendarMap.get(d.calendarId)?.name,
              color: calendarMap.get(d.calendarId)?.color ?? undefined,
            };
          });
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

        // Check if rmapi config file exists — if not, skip all pushes
        if (!existsSync(RMAPI_CONFIG)) {
          return;
        }

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

          // Check if too many failures today — stop retrying
          const failures = plannerFailCount.get(settings.profileId) ?? 0;
          if (failures >= MAX_RMAPI_FAILURES) {
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
              const count = (plannerFailCount.get(settings.profileId) ?? 0) + 1;
              plannerFailCount.set(settings.profileId, count);
              fastify.log.error(
                { err, profileId: settings.profileId, failCount: count, maxRetries: MAX_RMAPI_FAILURES },
                `Failed to push profile planner to reMarkable (attempt ${count}/${MAX_RMAPI_FAILURES})`
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
                const count = (plannerFailCount.get(settings.profileId) ?? 0) + 1;
                plannerFailCount.set(settings.profileId, count);
                fastify.log.error(
                  { err, profileId: settings.profileId, failCount: count, maxRetries: MAX_RMAPI_FAILURES },
                  `Failed to push weekly profile planner to reMarkable (attempt ${count}/${MAX_RMAPI_FAILURES})`
                );
              }
            }
          }
        }

        // Clean up old entries and reset fail counts on new day
        for (const [profileId, dateStr] of profilePlannerPushedToday.entries()) {
          if (dateStr !== todayStr) {
            profilePlannerPushedToday.delete(profileId);
            plannerFailCount.delete(profileId); // Reset retries for new day
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

  // Start Matter device reachability checker
  const startMatterReachabilityScheduler = () => {
    const checkReachability = async () => {
      try {
        if (!fastify.matterController?.isInitialized()) return;

        const allDevices = await fastify.db
          .select()
          .from(matterDevices);

        if (allDevices.length === 0) return;

        let states;
        try {
          states = await fastify.matterController.getAllDeviceStates();
        } catch {
          return; // Controller may have been shut down
        }

        const stateMap = new Map(states.map((s) => [s.nodeId, s]));
        const now = new Date();

        for (const device of allDevices) {
          const live = stateMap.get(device.nodeId);
          const isReachable = live?.isReachable ?? false;

          if (isReachable !== device.isReachable) {
            await fastify.db
              .update(matterDevices)
              .set({
                isReachable,
                lastSeenAt: isReachable ? now : device.lastSeenAt,
                updatedAt: now,
              })
              .where(eq(matterDevices.id, device.id));
          } else if (isReachable) {
            await fastify.db
              .update(matterDevices)
              .set({ lastSeenAt: now, updatedAt: now })
              .where(eq(matterDevices.id, device.id));
          }
        }
      } catch (error) {
        fastify.log.error({ err: error }, "Matter reachability check failed");
      }
    };

    setTimeout(async () => {
      fastify.log.info("Starting Matter reachability scheduler (2 min interval)...");
      await checkReachability();

      matterReachabilityInterval = setInterval(checkReachability, MATTER_REACHABILITY_INTERVAL_MS);
    }, STARTUP_DELAY_MS + 35000); // Start 35 seconds after IPTV
  };

  // ========== Google Photos Album Sync ==========
  const GOOGLE_PHOTOS_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
  let googlePhotosSyncInterval: ReturnType<typeof setInterval> | null = null;

  const startGooglePhotosSyncScheduler = () => {
    const uploadDir = process.env.UPLOAD_DIR ?? "./uploads";

    const syncAllLinkedAlbums = async () => {
      try {
        // Find all albums with auto-sync enabled
        const linkedAlbums = await fastify.db
          .select()
          .from(photoAlbums)
          .where(and(eq(photoAlbums.autoSync, true), isNotNull(photoAlbums.googleAlbumId)));

        if (linkedAlbums.length === 0) return;

        // Group by user
        const byUser = new Map<string, typeof linkedAlbums>();
        for (const album of linkedAlbums) {
          const list = byUser.get(album.userId) ?? [];
          list.push(album);
          byUser.set(album.userId, list);
        }

        for (const [userId, albums] of byUser) {
          try {
            // Get Google token
            const [rawToken] = await fastify.db
              .select()
              .from(oauthTokens)
              .where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, "google")))
              .limit(1);
            if (!rawToken) continue;
            const token = decryptOAuthToken(rawToken);
            if (!token.scope?.includes("photoslibrary") && !token.scope?.includes("photospicker")) continue;

            for (const album of albums) {
              if (!album.googleAlbumId) continue;

              try {
                // Get existing external IDs
                const existing = await fastify.db
                  .select({ externalId: photos.externalId })
                  .from(photos)
                  .where(and(eq(photos.albumId, album.id), eq(photos.sourceType, "google")));
                const existingIds = new Set(existing.map((p) => p.externalId));

                const allPhotos = await fastify.db
                  .select({ sortOrder: photos.sortOrder })
                  .from(photos)
                  .where(eq(photos.albumId, album.id));
                let maxOrder = Math.max(0, ...allPhotos.map((p) => p.sortOrder));

                const userDir = join(uploadDir, userId);
                await mkdir(userDir, { recursive: true });
                await mkdir(join(userDir, "thumbnails"), { recursive: true });
                await mkdir(join(userDir, "medium"), { recursive: true });
                await mkdir(join(userDir, "original"), { recursive: true });

                let pageToken: string | undefined;
                let imported = 0;
                let accessToken = await getAccessToken(token);
                let photoCount = 0;

                do {
                  const page = await listAlbumPhotos(token, album.googleAlbumId, pageToken);

                  for (const item of page.photos) {
                    if (existingIds.has(item.id)) continue;

                    photoCount++;
                    if (photoCount % 50 === 0) accessToken = await getAccessToken(token);

                    try {
                      const downloadUrl = `${item.baseUrl}=d`;
                      let response = await fetch(downloadUrl, {
                        headers: { Authorization: `Bearer ${accessToken}` },
                      });
                      if (!response.ok) {
                        response = await fetch(getPhotoUrl(item.baseUrl, 2048, 1536), {
                          headers: { Authorization: `Bearer ${accessToken}` },
                        });
                      }
                      if (!response.ok) continue;

                      const buffer = Buffer.from(await response.arrayBuffer());
                      const fileId = randomUUID();
                      const ext = item.filename.split(".").pop() ?? "jpg";
                      const filename = `${fileId}.${ext}`;

                      const result = await processImage(buffer, {
                        userDir,
                        filename,
                        generateThumbnail: true,
                        generateMedium: true,
                      });

                      maxOrder++;
                      await fastify.db.insert(photos).values({
                        albumId: album.id,
                        filename,
                        originalFilename: item.filename,
                        mimeType: item.mimeType,
                        width: result.width,
                        height: result.height,
                        size: buffer.length,
                        thumbnailPath: result.thumbnailPath ? join(userId, result.thumbnailPath) : null,
                        mediumPath: result.mediumPath ? join(userId, result.mediumPath) : null,
                        originalPath: join(userId, result.originalPath),
                        metadata: result.metadata,
                        sortOrder: maxOrder,
                        sourceType: "google",
                        externalId: item.id,
                      });
                      imported++;
                    } catch {
                      // Skip individual photo errors
                    }
                  }

                  pageToken = page.nextPageToken;
                } while (pageToken);

                // Update sync timestamp
                await fastify.db
                  .update(photoAlbums)
                  .set({ lastSyncedAt: new Date(), updatedAt: new Date() })
                  .where(eq(photoAlbums.id, album.id));

                if (imported > 0) {
                  fastify.log.info(`[Google Photos Sync] Album "${album.name}": ${imported} new photos`);
                }
              } catch (err) {
                fastify.log.error(`[Google Photos Sync] Error syncing album ${album.id}: ${err}`);
              }
            }
          } catch (err) {
            fastify.log.error(`[Google Photos Sync] Error processing user ${userId}: ${err}`);
          }
        }
      } catch (err) {
        fastify.log.error(`[Google Photos Sync] Scheduler error: ${err}`);
      }
    };

    setTimeout(async () => {
      fastify.log.info("Starting Google Photos sync scheduler (6h interval)...");
      await syncAllLinkedAlbums();
      googlePhotosSyncInterval = setInterval(syncAllLinkedAlbums, GOOGLE_PHOTOS_SYNC_INTERVAL_MS);
    }, STARTUP_DELAY_MS + 40000);
  };

  // ============ Auto-Backup Scheduler ============
  const AUTO_BACKUP_CHECK_INTERVAL_MS = 15 * 60 * 1000; // Check every 15 minutes
  let autoBackupInterval: ReturnType<typeof setInterval> | null = null;

  async function checkAutoBackups() {
    try {
      const { autoBackupConfig: autoBackupConfigTable, storageServers: storageServersTable } = await import("@openframe/database/schema");
      const configs = await fastify.db
        .select()
        .from(autoBackupConfigTable)
        .where(
          and(
            eq(autoBackupConfigTable.enabled, true),
            isNotNull(autoBackupConfigTable.storageServerId)
          )
        );

      for (const config of configs) {
        if (!config.storageServerId) continue;

        // Check if backup is due
        const intervalMs = (config.intervalHours ?? 24) * 60 * 60 * 1000;
        const lastBackup = config.lastBackupAt ? new Date(config.lastBackupAt).getTime() : 0;
        const now = Date.now();

        if (now - lastBackup < intervalMs) continue;

        fastify.log.info(`Auto-backup due for user ${config.userId}`);

        try {
          const { getStorageClient } = await import("../services/storage-client.js");
          const categories = (config.categories as string[]) || ["settings"];
          const exportUrl = `/api/v1/settings/export?categories=${categories.join(",")}&includeCredentials=${config.includeCredentials}&includePhotos=${config.includePhotos}`;

          // Get user's auth token for the internal request
          const [user] = await fastify.db.select().from(users).where(eq(users.id, config.userId)).limit(1);
          if (!user) continue;

          const token = fastify.jwt.sign({ userId: user.id });
          const exportResponse = await fastify.inject({
            method: "GET",
            url: exportUrl,
            headers: { authorization: `Bearer ${token}` },
          });

          if (exportResponse.statusCode !== 200) {
            fastify.log.error(`Auto-backup export failed for user ${config.userId}`);
            continue;
          }

          const backupBuffer = Buffer.from(exportResponse.body, "utf-8");
          const { client } = await getStorageClient(fastify.db, config.storageServerId, config.userId);

          try {
            const timestamp = new Date().toISOString().split("T")[0];
            const filename = `openframe-backup-${timestamp}.json`;
            const backupDir = config.backupPath || "/openframe-backups";
            const remotePath = `${backupDir}/${filename}`;

            await client.mkdir(backupDir);
            await client.write(remotePath, backupBuffer);

            await fastify.db
              .update(autoBackupConfigTable)
              .set({ lastBackupAt: new Date(), updatedAt: new Date() })
              .where(eq(autoBackupConfigTable.id, config.id));

            fastify.log.info(`Auto-backup completed for user ${config.userId}: ${remotePath}`);
          } finally {
            await client.disconnect();
          }
        } catch (err: any) {
          fastify.log.error(`Auto-backup failed for user ${config.userId}: ${err.message}`);
        }
      }
    } catch (err: any) {
      fastify.log.error(`Auto-backup scheduler error: ${err.message}`);
    }
  }

  function startAutoBackupScheduler() {
    autoBackupInterval = setInterval(checkAutoBackups, AUTO_BACKUP_CHECK_INTERVAL_MS);
    fastify.log.info(`Auto-backup scheduler started (check every ${AUTO_BACKUP_CHECK_INTERVAL_MS / 1000 / 60} minutes)`);
    // Run initial check after 2 minutes
    setTimeout(checkAutoBackups, 2 * 60 * 1000);
  }

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
    startMatterReachabilityScheduler();
    startGooglePhotosSyncScheduler();
    startAutoBackupScheduler();
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
    if (matterReachabilityInterval) {
      clearInterval(matterReachabilityInterval);
      matterReachabilityInterval = null;
      fastify.log.info("Matter reachability scheduler stopped");
    }
    if (googlePhotosSyncInterval) {
      clearInterval(googlePhotosSyncInterval);
      googlePhotosSyncInterval = null;
      fastify.log.info("Google Photos sync scheduler stopped");
    }
    if (autoBackupInterval) {
      clearInterval(autoBackupInterval);
      autoBackupInterval = null;
      fastify.log.info("Auto-backup scheduler stopped");
    }
  });
};

export const schedulerPlugin = fp(schedulerPluginCallback, {
  name: "scheduler",
  dependencies: ["database"],
});
