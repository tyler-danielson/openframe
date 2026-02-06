/**
 * ESPN API Service
 * Fetches sports data from ESPN's unofficial public API
 */

import type { SportsLeague, SportsTeam, SportsGame, GameStatus } from "@openframe/shared";

// ESPN API base URL
const ESPN_API_BASE = "https://site.api.espn.com/apis/site/v2/sports";

// Supported leagues configuration
export const SUPPORTED_LEAGUES: SportsLeague[] = [
  { sport: "football", league: "nfl", displayName: "NFL" },
  { sport: "basketball", league: "nba", displayName: "NBA" },
  { sport: "hockey", league: "nhl", displayName: "NHL" },
  { sport: "hockey", league: "olympics-mens-ice-hockey", displayName: "Olympic Hockey (M)" },
  { sport: "hockey", league: "olympics-womens-ice-hockey", displayName: "Olympic Hockey (W)" },
  { sport: "baseball", league: "mlb", displayName: "MLB" },
];

// Olympic hockey teams (hardcoded since ESPN doesn't expose via teams API)
const OLYMPIC_HOCKEY_TEAMS: SportsTeam[] = [
  { id: "oly-can", name: "Canada", abbreviation: "CAN", logo: "https://a.espncdn.com/i/teamlogos/countries/500/can.png", color: "#FF0000", sport: "hockey", league: "" },
  { id: "oly-usa", name: "United States", abbreviation: "USA", logo: "https://a.espncdn.com/i/teamlogos/countries/500/usa.png", color: "#002868", sport: "hockey", league: "" },
  { id: "oly-fin", name: "Finland", abbreviation: "FIN", logo: "https://a.espncdn.com/i/teamlogos/countries/500/fin.png", color: "#003580", sport: "hockey", league: "" },
  { id: "oly-swe", name: "Sweden", abbreviation: "SWE", logo: "https://a.espncdn.com/i/teamlogos/countries/500/swe.png", color: "#006AA7", sport: "hockey", league: "" },
  { id: "oly-rus", name: "Russia", abbreviation: "RUS", logo: "https://a.espncdn.com/i/teamlogos/countries/500/rus.png", color: "#D52B1E", sport: "hockey", league: "" },
  { id: "oly-cze", name: "Czech Republic", abbreviation: "CZE", logo: "https://a.espncdn.com/i/teamlogos/countries/500/cze.png", color: "#11457E", sport: "hockey", league: "" },
  { id: "oly-sui", name: "Switzerland", abbreviation: "SUI", logo: "https://a.espncdn.com/i/teamlogos/countries/500/sui.png", color: "#FF0000", sport: "hockey", league: "" },
  { id: "oly-ger", name: "Germany", abbreviation: "GER", logo: "https://a.espncdn.com/i/teamlogos/countries/500/ger.png", color: "#000000", sport: "hockey", league: "" },
  { id: "oly-svk", name: "Slovakia", abbreviation: "SVK", logo: "https://a.espncdn.com/i/teamlogos/countries/500/svk.png", color: "#0B4EA2", sport: "hockey", league: "" },
  { id: "oly-lat", name: "Latvia", abbreviation: "LAT", logo: "https://a.espncdn.com/i/teamlogos/countries/500/lat.png", color: "#9E3039", sport: "hockey", league: "" },
  { id: "oly-den", name: "Denmark", abbreviation: "DEN", logo: "https://a.espncdn.com/i/teamlogos/countries/500/den.png", color: "#C60C30", sport: "hockey", league: "" },
  { id: "oly-nor", name: "Norway", abbreviation: "NOR", logo: "https://a.espncdn.com/i/teamlogos/countries/500/nor.png", color: "#EF2B2D", sport: "hockey", league: "" },
  { id: "oly-jpn", name: "Japan", abbreviation: "JPN", logo: "https://a.espncdn.com/i/teamlogos/countries/500/jpn.png", color: "#BC002D", sport: "hockey", league: "" },
  { id: "oly-chn", name: "China", abbreviation: "CHN", logo: "https://a.espncdn.com/i/teamlogos/countries/500/chn.png", color: "#DE2910", sport: "hockey", league: "" },
  { id: "oly-aut", name: "Austria", abbreviation: "AUT", logo: "https://a.espncdn.com/i/teamlogos/countries/500/aut.png", color: "#ED2939", sport: "hockey", league: "" },
  { id: "oly-fra", name: "France", abbreviation: "FRA", logo: "https://a.espncdn.com/i/teamlogos/countries/500/fra.png", color: "#002395", sport: "hockey", league: "" },
];

// ESPN API response types
interface ESPNLogo {
  href: string;
  width: number;
  height: number;
  alt?: string;
  rel: string[];
}

interface ESPNTeam {
  id: string;
  displayName: string;
  abbreviation: string;
  logo?: string;
  logos?: ESPNLogo[];
  color?: string;
  alternateColor?: string;
}

interface ESPNCompetitor {
  id: string;
  homeAway: "home" | "away";
  team: ESPNTeam & { logos?: ESPNLogo[] };
  score?: string;
}

interface ESPNStatus {
  type: {
    id: string;
    name: string;
    state: string; // "pre", "in", "post"
    completed: boolean;
    description: string;
    detail: string;
    shortDetail: string;
  };
  period?: number;
  displayClock?: string;
}

interface ESPNCompetition {
  id: string;
  competitors: ESPNCompetitor[];
  status: ESPNStatus;
  venue?: {
    fullName: string;
    address?: {
      city: string;
      state: string;
    };
  };
  broadcasts?: Array<{
    names: string[];
  }>;
}

interface ESPNEvent {
  id: string;
  date: string;
  competitions: ESPNCompetition[];
}

interface ESPNScoreboardResponse {
  events: ESPNEvent[];
}

interface ESPNTeamEntry {
  team: ESPNTeam & {
    logos?: ESPNLogo[];
  };
}

interface ESPNTeamsResponse {
  sports: Array<{
    leagues: Array<{
      teams: ESPNTeamEntry[];
    }>;
  }>;
}

/**
 * Get the best logo URL from ESPN logos array
 * Prefers: default > full > any available
 */
function getBestLogo(logos?: ESPNLogo[], fallbackLogo?: string): string | null {
  if (!logos || logos.length === 0) {
    return fallbackLogo || null;
  }

  // First try to find the default logo
  const defaultLogo = logos.find((l) => l.rel.includes("default"));
  if (defaultLogo) return defaultLogo.href;

  // Then try full size
  const fullLogo = logos.find((l) => l.rel.includes("full"));
  if (fullLogo) return fullLogo.href;

  // Fall back to first available
  return logos[0]?.href || fallbackLogo || null;
}

/**
 * Get list of supported leagues
 */
export function getLeagues(): SportsLeague[] {
  return SUPPORTED_LEAGUES;
}

/**
 * Check if a league is supported
 */
export function isLeagueSupported(sport: string, league: string): boolean {
  return SUPPORTED_LEAGUES.some(
    (l) => l.sport === sport && l.league === league
  );
}

/**
 * Fetch all teams for a given sport/league
 */
export async function fetchTeams(
  sport: string,
  league: string
): Promise<SportsTeam[]> {
  if (!isLeagueSupported(sport, league)) {
    throw new Error(`Unsupported league: ${sport}/${league}`);
  }

  // Return hardcoded teams for Olympic hockey (ESPN doesn't provide via API)
  if (league === "olympics-mens-ice-hockey" || league === "olympics-womens-ice-hockey") {
    return OLYMPIC_HOCKEY_TEAMS.map((team) => ({ ...team, league }));
  }

  const url = `${ESPN_API_BASE}/${sport}/${league}/teams?limit=100`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`ESPN API error: ${response.status}`);
  }

  const data = (await response.json()) as ESPNTeamsResponse;
  const teams: SportsTeam[] = [];

  for (const sportData of data.sports || []) {
    for (const leagueData of sportData.leagues || []) {
      for (const teamData of leagueData.teams || []) {
        const team = teamData.team;
        // Get the best available logo (ESPN provides helmet logos for NFL by default)
        const logo = getBestLogo(team.logos, team.logo);

        teams.push({
          id: team.id,
          name: team.displayName,
          abbreviation: team.abbreviation,
          logo,
          color: team.color ? `#${team.color}` : null,
          sport,
          league,
        });
      }
    }
  }

  // Sort teams alphabetically by name
  teams.sort((a, b) => a.name.localeCompare(b.name));

  return teams;
}

/**
 * Map ESPN status to our GameStatus enum
 */
function mapESPNStatus(status: ESPNStatus, startTime?: Date): GameStatus {
  const state = status.type.state;
  const name = status.type.name.toLowerCase();
  const completed = status.type.completed;
  const detail = status.type.detail?.toLowerCase() || "";
  const shortDetail = status.type.shortDetail?.toLowerCase() || "";

  if (state === "pre") {
    return "scheduled";
  }

  if (state === "post" || completed) {
    if (name.includes("postponed")) {
      return "postponed";
    }
    if (name.includes("cancel")) {
      return "cancelled";
    }
    return "final";
  }

  if (state === "in") {
    // Check for halftime
    if (name.includes("halftime") || detail.includes("halftime")) {
      return "halftime";
    }

    // Check for final/end indicators in detail (ESPN sometimes has stale state)
    if (name.includes("final") || detail.includes("final") || shortDetail.includes("final")) {
      return "final";
    }

    // Safety check: if game started more than 6 hours ago and still shows "in",
    // it's likely stale data from ESPN - treat as final
    if (startTime) {
      const hoursSinceStart = (Date.now() - startTime.getTime()) / (1000 * 60 * 60);
      if (hoursSinceStart > 6) {
        return "final";
      }
    }

    return "in_progress";
  }

  return "scheduled";
}

/**
 * Parse ESPN event to our SportsGame format
 */
export function parseESPNGame(
  event: ESPNEvent,
  sport: string,
  league: string
): SportsGame | null {
  if (!event.competitions || event.competitions.length === 0) {
    return null;
  }

  const competition = event.competitions[0];
  if (!competition) {
    return null;
  }

  const homeCompetitor = competition.competitors.find((c) => c.homeAway === "home");
  const awayCompetitor = competition.competitors.find((c) => c.homeAway === "away");

  if (!homeCompetitor || !awayCompetitor) {
    return null;
  }

  const status = competition.status;
  const broadcasts = competition.broadcasts
    ?.flatMap((b) => b.names)
    .filter(Boolean)
    .join(", ");

  const startTime = new Date(event.date);

  return {
    id: "", // Will be set by database
    externalId: event.id,
    provider: "espn",
    sport,
    league,
    homeTeam: {
      id: homeCompetitor.team.id,
      name: homeCompetitor.team.displayName,
      abbreviation: homeCompetitor.team.abbreviation,
      logo: getBestLogo(homeCompetitor.team.logos, homeCompetitor.team.logo),
      color: homeCompetitor.team.color ? `#${homeCompetitor.team.color}` : null,
      score: homeCompetitor.score ? parseInt(homeCompetitor.score, 10) : null,
    },
    awayTeam: {
      id: awayCompetitor.team.id,
      name: awayCompetitor.team.displayName,
      abbreviation: awayCompetitor.team.abbreviation,
      logo: getBestLogo(awayCompetitor.team.logos, awayCompetitor.team.logo),
      color: awayCompetitor.team.color ? `#${awayCompetitor.team.color}` : null,
      score: awayCompetitor.score ? parseInt(awayCompetitor.score, 10) : null,
    },
    startTime,
    status: mapESPNStatus(status, startTime),
    statusDetail: status.type.shortDetail || status.type.detail || null,
    period: status.period || null,
    clock: status.displayClock || null,
    venue: competition.venue?.fullName || null,
    broadcast: broadcasts || null,
  };
}

/**
 * Fetch scoreboard (games) for a given sport/league
 * @param sport Sport name (e.g., "football")
 * @param league League name (e.g., "nfl")
 * @param date Optional date in YYYYMMDD format
 */
export async function fetchScoreboard(
  sport: string,
  league: string,
  date?: string
): Promise<SportsGame[]> {
  if (!isLeagueSupported(sport, league)) {
    throw new Error(`Unsupported league: ${sport}/${league}`);
  }

  let url = `${ESPN_API_BASE}/${sport}/${league}/scoreboard`;
  if (date) {
    url += `?dates=${date}`;
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`ESPN API error: ${response.status}`);
  }

  const data = (await response.json()) as ESPNScoreboardResponse;
  const games: SportsGame[] = [];

  for (const event of data.events || []) {
    const game = parseESPNGame(event, sport, league);
    if (game) {
      games.push(game);
    }
  }

  // Sort by start time
  games.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  return games;
}

/**
 * Fetch games for specific teams
 */
export async function fetchGamesForTeams(
  teamIds: Array<{ sport: string; league: string; teamId: string }>,
  date?: string
): Promise<SportsGame[]> {
  // Group teams by sport/league to minimize API calls
  const byLeague = new Map<string, string[]>();
  for (const { sport, league, teamId } of teamIds) {
    const key = `${sport}/${league}`;
    if (!byLeague.has(key)) {
      byLeague.set(key, []);
    }
    byLeague.get(key)!.push(teamId);
  }

  const allGames: SportsGame[] = [];

  for (const [key, ids] of byLeague) {
    const parts = key.split("/");
    const sport = parts[0] ?? "";
    const league = parts[1] ?? "";

    let games: SportsGame[];
    try {
      games = await fetchScoreboard(sport, league, date);
    } catch (err) {
      // Skip leagues that return errors (e.g., Olympic leagues when not active)
      console.warn(`Skipping ${sport}/${league}: ${err instanceof Error ? err.message : "unknown error"}`);
      continue;
    }

    // Filter to only include games involving the specified teams
    const teamIdSet = new Set(ids);
    const relevantGames = games.filter(
      (game) =>
        teamIdSet.has(game.homeTeam.id) || teamIdSet.has(game.awayTeam.id)
    );

    allGames.push(...relevantGames);
  }

  // Sort all games by start time
  allGames.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  return allGames;
}

/**
 * Get currently live games from all supported leagues
 */
export async function fetchAllLiveGames(): Promise<SportsGame[]> {
  const allGames: SportsGame[] = [];

  // Fetch scoreboards from all leagues in parallel
  const promises = SUPPORTED_LEAGUES.map(({ sport, league }) =>
    fetchScoreboard(sport, league).catch((err) => {
      console.error(`Failed to fetch ${sport}/${league} scoreboard:`, err);
      return [];
    })
  );

  const results = await Promise.all(promises);

  for (const games of results) {
    const liveGames = games.filter(
      (game) => game.status === "in_progress" || game.status === "halftime"
    );
    allGames.push(...liveGames);
  }

  return allGames;
}

/**
 * Format date for ESPN API (YYYYMMDD)
 */
export function formatDateForESPN(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}
