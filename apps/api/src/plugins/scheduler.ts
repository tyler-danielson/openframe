/**
 * Scheduler Plugin
 * Handles periodic background tasks like IPTV cache refresh, sports data updates,
 * and Home Assistant entity timers
 */

import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { eq, and, gte, lte } from "drizzle-orm";
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
} from "@openframe/database/schema";
import { getRemarkableClient } from "../services/remarkable/client.js";
import { syncGoogleCalendars } from "../services/calendar-sync/google.js";
import { oauthTokens, users } from "@openframe/database/schema";
import { generateAgendaPdf, getAgendaFilename, type AgendaEvent } from "../services/remarkable/agenda-generator.js";
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

// Calendar sync interval (5 minutes)
const CALENDAR_SYNC_INTERVAL_MS = 5 * 60 * 1000;

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
  let calendarSyncInterval: NodeJS.Timeout | null = null;
  let currentSportsPollingInterval = SPORTS_POLL_IDLE;
  // Track which users have already pushed agenda today
  const agendaPushedToday = new Map<string, string>(); // userId -> dateString

  // Start the IPTV cache refresh scheduler
  const startIptvCacheScheduler = () => {
    const cacheService = getIptvCacheService(fastify);

    // Initial refresh after startup delay
    setTimeout(async () => {
      fastify.log.info("Running initial IPTV cache refresh...");
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
  });
};

export const schedulerPlugin = fp(schedulerPluginCallback, {
  name: "scheduler",
  dependencies: ["database"],
});
