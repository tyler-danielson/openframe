/**
 * Sports API Routes
 * Endpoints for managing favorite teams and fetching sports data
 */

import type { FastifyPluginAsync } from "fastify";
import { eq, and, inArray } from "drizzle-orm";
import { favoriteSportsTeams, sportsGames } from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";
import {
  getLeagues,
  fetchTeams,
  fetchScoreboard,
  fetchGamesForTeams,
  formatDateForESPN,
  SUPPORTED_LEAGUES,
} from "../../services/espn.js";
import type { SportsGame, GameStatus } from "@openframe/shared";

export const sportsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /sports/leagues
   * Get list of supported sports leagues
   */
  fastify.get("/leagues", async (_request, reply) => {
    const leagues = getLeagues();
    return reply.send({ success: true, data: leagues });
  });

  /**
   * GET /sports/teams
   * Get teams for a specific sport/league
   */
  fastify.get<{
    Querystring: { sport: string; league: string };
  }>("/teams", async (request, reply) => {
    const { sport, league } = request.query;

    if (!sport || !league) {
      return reply.status(400).send({
        success: false,
        error: { message: "sport and league are required" },
      });
    }

    try {
      const teams = await fetchTeams(sport, league);
      return reply.send({ success: true, data: teams });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch teams";
      return reply.status(500).send({
        success: false,
        error: { message },
      });
    }
  });

  /**
   * GET /sports/favorites
   * Get user's favorite teams
   */
  fastify.get("/favorites", {
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

    const favorites = await fastify.db
      .select()
      .from(favoriteSportsTeams)
      .where(eq(favoriteSportsTeams.userId, userId))
      .orderBy(favoriteSportsTeams.createdAt);

    return reply.send({ success: true, data: favorites });
  });

  /**
   * POST /sports/favorites
   * Add a favorite team
   */
  fastify.post<{
    Body: {
      sport: string;
      league: string;
      teamId: string;
      teamName: string;
      teamAbbreviation: string;
      teamLogo?: string;
      teamColor?: string;
    };
  }>("/favorites", {
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

    const { sport, league, teamId, teamName, teamAbbreviation, teamLogo, teamColor } =
      request.body;

    if (!sport || !league || !teamId || !teamName || !teamAbbreviation) {
      return reply.status(400).send({
        success: false,
        error: { message: "Missing required fields" },
      });
    }

    // Check if already a favorite
    const existing = await fastify.db
      .select()
      .from(favoriteSportsTeams)
      .where(
        and(
          eq(favoriteSportsTeams.userId, userId),
          eq(favoriteSportsTeams.league, league),
          eq(favoriteSportsTeams.teamId, teamId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return reply.status(409).send({
        success: false,
        error: { message: "Team is already a favorite" },
      });
    }

    const [favorite] = await fastify.db
      .insert(favoriteSportsTeams)
      .values({
        userId,
        sport,
        league,
        teamId,
        teamName,
        teamAbbreviation,
        teamLogo: teamLogo || null,
        teamColor: teamColor || null,
      })
      .returning();

    return reply.status(201).send({ success: true, data: favorite });
  });

  /**
   * DELETE /sports/favorites/:id
   * Remove a favorite team
   */
  fastify.delete<{
    Params: { id: string };
  }>("/favorites/:id", {
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
      .delete(favoriteSportsTeams)
      .where(
        and(
          eq(favoriteSportsTeams.id, id),
          eq(favoriteSportsTeams.userId, userId)
        )
      )
      .returning();

    if (result.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { message: "Favorite team not found" },
      });
    }

    return reply.send({ success: true, data: { deleted: true } });
  });

  /**
   * PATCH /sports/favorites/:id
   * Update favorite team visibility settings
   */
  fastify.patch<{
    Params: { id: string };
    Body: {
      isVisible?: boolean;
      showOnDashboard?: boolean;
    };
  }>("/favorites/:id", {
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
    const { isVisible, showOnDashboard } = request.body;

    const updates: Partial<{
      isVisible: boolean;
      showOnDashboard: boolean;
    }> = {};

    if (typeof isVisible === "boolean") {
      updates.isVisible = isVisible;
    }
    if (typeof showOnDashboard === "boolean") {
      updates.showOnDashboard = showOnDashboard;
    }

    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({
        success: false,
        error: { message: "No valid fields to update" },
      });
    }

    const [updated] = await fastify.db
      .update(favoriteSportsTeams)
      .set(updates)
      .where(
        and(
          eq(favoriteSportsTeams.id, id),
          eq(favoriteSportsTeams.userId, userId)
        )
      )
      .returning();

    if (!updated) {
      return reply.status(404).send({
        success: false,
        error: { message: "Favorite team not found" },
      });
    }

    return reply.send({ success: true, data: updated });
  });

  /**
   * GET /sports/games
   * Get games for a specific date and/or teams
   */
  fastify.get<{
    Querystring: {
      date?: string;
      teamIds?: string;
      sport?: string;
      league?: string;
    };
  }>("/games", {
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

    const { date, teamIds: teamIdsParam, sport, league } = request.query;

    // Format date for ESPN API
    const espnDate = date
      ? formatDateForESPN(new Date(date))
      : formatDateForESPN(new Date());

    try {
      let games: SportsGame[] = [];

      if (teamIdsParam) {
        // Fetch games for specific teams
        const favorites = await fastify.db
          .select()
          .from(favoriteSportsTeams)
          .where(eq(favoriteSportsTeams.userId, userId));

        const teamIds = teamIdsParam.split(",");
        const relevantFavorites = favorites.filter((f) =>
          teamIds.includes(f.id)
        );

        games = await fetchGamesForTeams(
          relevantFavorites.map((f) => ({
            sport: f.sport,
            league: f.league,
            teamId: f.teamId,
          })),
          espnDate
        );
      } else if (sport && league) {
        // Fetch all games for a specific league
        games = await fetchScoreboard(sport, league, espnDate);
      } else {
        // Fetch games for user's favorite teams
        const favorites = await fastify.db
          .select()
          .from(favoriteSportsTeams)
          .where(eq(favoriteSportsTeams.userId, userId));

        if (favorites.length > 0) {
          games = await fetchGamesForTeams(
            favorites.map((f) => ({
              sport: f.sport,
              league: f.league,
              teamId: f.teamId,
            })),
            espnDate
          );
        }
      }

      return reply.send({ success: true, data: games });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch games";
      return reply.status(500).send({
        success: false,
        error: { message },
      });
    }
  });

  /**
   * GET /sports/live
   * Get currently live games for user's favorite teams
   */
  fastify.get("/live", {
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

    try {
      // Get user's favorite teams that are visible on dashboard
      const favorites = await fastify.db
        .select()
        .from(favoriteSportsTeams)
        .where(
          and(
            eq(favoriteSportsTeams.userId, userId),
            eq(favoriteSportsTeams.showOnDashboard, true)
          )
        );

      if (favorites.length === 0) {
        return reply.send({ success: true, data: [] });
      }

      // Group favorites by league
      const byLeague = new Map<string, typeof favorites>();
      for (const fav of favorites) {
        const key = `${fav.sport}/${fav.league}`;
        if (!byLeague.has(key)) {
          byLeague.set(key, []);
        }
        byLeague.get(key)!.push(fav);
      }

      const liveGames: SportsGame[] = [];

      // Fetch scoreboards and filter to live games
      for (const [key, favs] of byLeague) {
        const parts = key.split("/");
        const sport = parts[0] ?? "";
        const league = parts[1] ?? "";
        const teamIdSet = new Set(favs.map((f) => f.teamId));

        try {
          const games = await fetchScoreboard(sport, league);
          const relevantLive = games.filter(
            (game) =>
              (game.status === "in_progress" || game.status === "halftime") &&
              (teamIdSet.has(game.homeTeam.id) || teamIdSet.has(game.awayTeam.id))
          );
          liveGames.push(...relevantLive);
        } catch (err) {
          console.error(`Failed to fetch ${key} scoreboard:`, err);
        }
      }

      // Sort by start time
      liveGames.sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );

      return reply.send({ success: true, data: liveGames });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch live games";
      return reply.status(500).send({
        success: false,
        error: { message },
      });
    }
  });

  /**
   * GET /sports/scores/today
   * Get today's scores for user's favorite teams (all games, not just live)
   */
  fastify.get("/scores/today", {
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

    try {
      // Get user's favorite teams that are visible on dashboard
      const favorites = await fastify.db
        .select()
        .from(favoriteSportsTeams)
        .where(
          and(
            eq(favoriteSportsTeams.userId, userId),
            eq(favoriteSportsTeams.showOnDashboard, true)
          )
        );

      if (favorites.length === 0) {
        return reply.send({ success: true, data: [] });
      }

      const today = formatDateForESPN(new Date());
      const games = await fetchGamesForTeams(
        favorites.map((f) => ({
          sport: f.sport,
          league: f.league,
          teamId: f.teamId,
        })),
        today
      );

      return reply.send({ success: true, data: games });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch today's scores";
      return reply.status(500).send({
        success: false,
        error: { message },
      });
    }
  });

  /**
   * GET /sports/events
   * Get games as calendar events (for calendar integration)
   */
  fastify.get<{
    Querystring: {
      start: string;
      end: string;
      teamIds?: string;
    };
  }>("/events", {
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

    const { start, end, teamIds: teamIdsParam } = request.query;

    if (!start || !end) {
      return reply.status(400).send({
        success: false,
        error: { message: "start and end dates are required" },
      });
    }

    try {
      // Get favorites to filter by
      let favorites = await fastify.db
        .select()
        .from(favoriteSportsTeams)
        .where(
          and(
            eq(favoriteSportsTeams.userId, userId),
            eq(favoriteSportsTeams.isVisible, true)
          )
        );

      if (teamIdsParam) {
        const teamIds = teamIdsParam.split(",");
        favorites = favorites.filter((f) => teamIds.includes(f.id));
      }

      if (favorites.length === 0) {
        return reply.send({ success: true, data: [] });
      }

      // For multi-day range, we need to fetch each day
      const startDate = new Date(start);
      const endDate = new Date(end);
      const allGames: SportsGame[] = [];

      // Limit to 14 days to avoid excessive API calls
      const maxDays = 14;
      const daysDiff = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const daysToFetch = Math.min(daysDiff, maxDays);

      for (let i = 0; i < daysToFetch; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const espnDate = formatDateForESPN(date);

        try {
          const games = await fetchGamesForTeams(
            favorites.map((f) => ({
              sport: f.sport,
              league: f.league,
              teamId: f.teamId,
            })),
            espnDate
          );
          allGames.push(...games);
        } catch (err) {
          console.error(`Failed to fetch games for ${espnDate}:`, err);
        }
      }

      // Convert to calendar event format
      const events = allGames.map((game) => {
        // Find the favorite team in this game to get the color
        const favoriteTeam = favorites.find(
          (f) => f.teamId === game.homeTeam.id || f.teamId === game.awayTeam.id
        );

        // Build the title
        let title = `${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation}`;
        if (game.status === "final") {
          title = `${game.awayTeam.abbreviation} ${game.awayTeam.score} - ${game.homeTeam.score} ${game.homeTeam.abbreviation} (Final)`;
        } else if (game.status === "in_progress" || game.status === "halftime") {
          title = `${game.awayTeam.abbreviation} ${game.awayTeam.score ?? 0} - ${game.homeTeam.score ?? 0} ${game.homeTeam.abbreviation} (${game.statusDetail || "Live"})`;
        }

        // Game duration is typically 3 hours
        const endTime = new Date(game.startTime);
        endTime.setHours(endTime.getHours() + 3);

        return {
          id: `sports-${game.externalId}`,
          calendarId: `sports-${favoriteTeam?.id || "unknown"}`,
          externalId: game.externalId,
          title,
          description: `${game.awayTeam.name} vs ${game.homeTeam.name}\n${game.broadcast ? `Broadcast: ${game.broadcast}` : ""}`,
          location: game.venue,
          startTime: game.startTime,
          endTime,
          isAllDay: false,
          status: "confirmed" as const,
          recurrenceRule: null,
          recurringEventId: null,
          attendees: [],
          reminders: [],
          // Extra sports data
          _sports: {
            game,
            color: favoriteTeam?.teamColor || "#6366F1",
          },
        };
      });

      return reply.send({ success: true, data: events });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch sports events";
      return reply.status(500).send({
        success: false,
        error: { message },
      });
    }
  });
};
