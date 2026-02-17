#!/usr/bin/env node

/**
 * OpenFrame MCP Server
 *
 * Standalone stdio-based MCP server that exposes calendar, tasks, weather,
 * sports, news, and Home Assistant data as tools for Claude Desktop / Claude.ai.
 *
 * Usage:
 *   pnpm mcp                    (from apps/api)
 *   tsx src/mcp-server.ts        (direct)
 *
 * Required env vars: DATABASE_URL, ENCRYPTION_KEY
 * (Uses same .env / secrets as the main API server)
 */

import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createDatabase } from "@openframe/database";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import {
  calendars,
  events,
  tasks,
  taskLists,
  newsArticles,
  newsFeeds,
  favoriteSportsTeams,
  sportsGames,
  homeAssistantRooms,
  homeAssistantEntities,
  users,
  systemSettings,
} from "@openframe/database/schema";
import crypto from "crypto";

// ---- Database setup ----

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const db = createDatabase(DATABASE_URL);

// Encryption helpers (same as settings route)
function decrypt(encryptedText: string): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY not set");
  const [ivHex, authTagHex, encrypted] = encryptedText.split(":");
  if (!ivHex || !authTagHex || !encrypted) throw new Error("Invalid encrypted format");
  const keyBuffer = Buffer.from(key, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", keyBuffer, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

async function getSetting(category: string, key: string): Promise<string | null> {
  const [setting] = await db
    .select()
    .from(systemSettings)
    .where(and(eq(systemSettings.category, category), eq(systemSettings.key, key)))
    .limit(1);
  if (!setting?.value) return null;
  if (setting.isSecret) {
    try { return decrypt(setting.value); } catch { return null; }
  }
  return setting.value;
}

// Get first user (single-user setup)
async function getDefaultUserId(): Promise<string | null> {
  const [user] = await db.select({ id: users.id }).from(users).limit(1);
  return user?.id || null;
}

// ---- MCP Server ----

const server = new McpServer({
  name: "openframe",
  version: "1.0.0",
});

// Tool: get_calendars
server.tool("get_calendars", "List all calendars", {}, async () => {
  const userId = await getDefaultUserId();
  if (!userId) return { content: [{ type: "text", text: "No users found" }] };

  const cals = await db
    .select({ id: calendars.id, name: calendars.name, provider: calendars.provider, color: calendars.color, isVisible: calendars.isVisible })
    .from(calendars)
    .where(eq(calendars.userId, userId));

  return {
    content: [{ type: "text", text: JSON.stringify(cals, null, 2) }],
  };
});

// Tool: get_events
server.tool(
  "get_events",
  "Get calendar events for a date range",
  {
    start_date: z.string().describe("Start date (YYYY-MM-DD)"),
    end_date: z.string().describe("End date (YYYY-MM-DD)"),
  },
  async ({ start_date, end_date }) => {
    const userId = await getDefaultUserId();
    if (!userId) return { content: [{ type: "text", text: "No users found" }] };

    const start = new Date(start_date);
    const end = new Date(end_date);
    end.setHours(23, 59, 59, 999);

    const userCals = await db
      .select({ id: calendars.id, name: calendars.name })
      .from(calendars)
      .where(eq(calendars.userId, userId));

    const calMap = new Map(userCals.map((c) => [c.id, c.name]));
    const calIds = userCals.map((c) => c.id);

    const allEvents = await db
      .select({
        id: events.id, title: events.title, startTime: events.startTime,
        endTime: events.endTime, location: events.location, isAllDay: events.isAllDay,
        calendarId: events.calendarId, status: events.status,
      })
      .from(events)
      .where(eq(events.status, "confirmed"));

    const filtered = allEvents
      .filter((e) => {
        const st = new Date(e.startTime);
        return calIds.includes(e.calendarId) && st >= start && st <= end;
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .map((e) => ({
        ...e,
        calendar: calMap.get(e.calendarId),
        startTime: new Date(e.startTime).toISOString(),
        endTime: new Date(e.endTime).toISOString(),
      }));

    return {
      content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }],
    };
  }
);

// Tool: search_events
server.tool(
  "search_events",
  "Search events by title text",
  {
    query: z.string().describe("Search query"),
  },
  async ({ query }) => {
    const userId = await getDefaultUserId();
    if (!userId) return { content: [{ type: "text", text: "No users found" }] };

    const userCals = await db.select({ id: calendars.id, name: calendars.name }).from(calendars).where(eq(calendars.userId, userId));
    const calIds = userCals.map((c) => c.id);
    const calMap = new Map(userCals.map((c) => [c.id, c.name]));

    const allEvents = await db.select().from(events);
    const lowerQuery = query.toLowerCase();

    const matches = allEvents
      .filter((e) => calIds.includes(e.calendarId) && e.title.toLowerCase().includes(lowerQuery))
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, 20)
      .map((e) => ({
        id: e.id, title: e.title, startTime: new Date(e.startTime).toISOString(),
        endTime: new Date(e.endTime).toISOString(), location: e.location,
        calendar: calMap.get(e.calendarId),
      }));

    return {
      content: [{ type: "text", text: JSON.stringify(matches, null, 2) }],
    };
  }
);

// Tool: get_task_lists
server.tool("get_task_lists", "List all task lists", {}, async () => {
  const userId = await getDefaultUserId();
  if (!userId) return { content: [{ type: "text", text: "No users found" }] };

  const lists = await db
    .select({ id: taskLists.id, name: taskLists.name, isVisible: taskLists.isVisible })
    .from(taskLists)
    .where(eq(taskLists.userId, userId));

  return {
    content: [{ type: "text", text: JSON.stringify(lists, null, 2) }],
  };
});

// Tool: get_tasks
server.tool(
  "get_tasks",
  "Get tasks, optionally filtered by status or list",
  {
    status: z.enum(["needsAction", "completed", "all"]).optional().describe("Filter by status (default: needsAction)"),
    list_id: z.string().optional().describe("Filter by task list ID"),
  },
  async ({ status, list_id }) => {
    const userId = await getDefaultUserId();
    if (!userId) return { content: [{ type: "text", text: "No users found" }] };

    const userLists = await db.select({ id: taskLists.id, name: taskLists.name }).from(taskLists).where(eq(taskLists.userId, userId));
    const listIds = list_id ? [list_id] : userLists.map((l) => l.id);
    const listMap = new Map(userLists.map((l) => [l.id, l.name]));

    const allTasks = await db.select().from(tasks);

    const filtered = allTasks
      .filter((t) => {
        if (!listIds.includes(t.taskListId)) return false;
        if (status === "all") return true;
        return t.status === (status || "needsAction");
      })
      .slice(0, 50)
      .map((t) => ({
        id: t.id, title: t.title, notes: t.notes, status: t.status,
        dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
        list: listMap.get(t.taskListId),
      }));

    return {
      content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }],
    };
  }
);

// Tool: get_weather
server.tool("get_weather", "Get current weather and forecast", {}, async () => {
  const apiKey = await getSetting("weather", "api_key");
  const units = (await getSetting("weather", "units")) || "imperial";
  const lat = await getSetting("home", "latitude");
  const lon = await getSetting("home", "longitude");

  if (!apiKey || !lat || !lon) {
    return { content: [{ type: "text", text: "Weather not configured (missing API key or location)" }] };
  }

  try {
    const currentRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${units}&appid=${apiKey}`
    );
    const current = await currentRes.json() as any;

    const forecastRes = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${units}&appid=${apiKey}`
    );
    const forecast = await forecastRes.json() as any;

    const result = {
      current: {
        temp: current.main?.temp,
        feelsLike: current.main?.feels_like,
        humidity: current.main?.humidity,
        description: current.weather?.[0]?.description,
        windSpeed: current.wind?.speed,
        city: current.name,
      },
      forecast: (forecast.list || []).slice(0, 8).map((f: any) => ({
        time: new Date(f.dt * 1000).toISOString(),
        temp: f.main?.temp,
        description: f.weather?.[0]?.description,
      })),
      units,
    };

    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (err: any) {
    return { content: [{ type: "text", text: `Weather API error: ${err.message}` }] };
  }
});

// Tool: get_sports_games
server.tool(
  "get_sports_games",
  "Get upcoming and recent games for favorite sports teams",
  {},
  async () => {
    const userId = await getDefaultUserId();
    if (!userId) return { content: [{ type: "text", text: "No users found" }] };

    const teams = await db.select().from(favoriteSportsTeams).where(eq(favoriteSportsTeams.userId, userId));
    if (teams.length === 0) return { content: [{ type: "text", text: "No favorite teams configured" }] };

    const teamIds = new Set(teams.map((t) => t.teamId));
    const now = new Date();
    const weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const allGames = await db.select().from(sportsGames);

    const filtered = allGames
      .filter((g) => {
        const st = new Date(g.startTime);
        return (teamIds.has(g.homeTeamId) || teamIds.has(g.awayTeamId)) &&
          st >= new Date(now.getTime() - 24 * 60 * 60 * 1000) && st <= weekOut;
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .map((g) => ({
        id: g.id, league: g.league, sport: g.sport,
        homeTeam: `${g.homeTeamName} (${g.homeTeamAbbreviation})`,
        awayTeam: `${g.awayTeamName} (${g.awayTeamAbbreviation})`,
        homeScore: g.homeTeamScore, awayScore: g.awayTeamScore,
        startTime: new Date(g.startTime).toISOString(),
        status: g.status, statusDetail: g.statusDetail,
        venue: g.venue, broadcast: g.broadcast,
      }));

    return { content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }] };
  }
);

// Tool: get_news
server.tool("get_news", "Get recent news headlines", {}, async () => {
  const userId = await getDefaultUserId();
  if (!userId) return { content: [{ type: "text", text: "No users found" }] };

  const feeds = await db
    .select({ id: newsFeeds.id, name: newsFeeds.name, category: newsFeeds.category })
    .from(newsFeeds)
    .where(and(eq(newsFeeds.userId, userId), eq(newsFeeds.isActive, true)));

  if (feeds.length === 0) return { content: [{ type: "text", text: "No news feeds configured" }] };

  const feedMap = new Map(feeds.map((f) => [f.id, { name: f.name, category: f.category }]));
  const feedIds = feeds.map((f) => f.id);

  const articles = await db
    .select()
    .from(newsArticles)
    .orderBy(desc(newsArticles.publishedAt))
    .limit(100);

  const filtered = articles
    .filter((a) => feedIds.includes(a.feedId))
    .slice(0, 20)
    .map((a) => ({
      title: a.title,
      link: a.link,
      publishedAt: a.publishedAt ? new Date(a.publishedAt).toISOString() : null,
      feed: feedMap.get(a.feedId)?.name,
      category: feedMap.get(a.feedId)?.category,
    }));

  return { content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }] };
});

// Tool: get_ha_rooms
server.tool("get_ha_rooms", "List Home Assistant rooms and their entities", {}, async () => {
  const userId = await getDefaultUserId();
  if (!userId) return { content: [{ type: "text", text: "No users found" }] };

  const rooms = await db.select().from(homeAssistantRooms).where(eq(homeAssistantRooms.userId, userId));
  const entities = await db.select().from(homeAssistantEntities).where(eq(homeAssistantEntities.userId, userId));

  const result = rooms.map((room) => ({
    id: room.id,
    name: room.name,
    entities: entities
      .filter((e) => e.roomId === room.id)
      .map((e) => ({
        entityId: e.entityId,
        displayName: e.displayName,
        showInDashboard: e.showInDashboard,
      })),
  }));

  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});

// Tool: get_ha_entities
server.tool(
  "get_ha_entities",
  "List Home Assistant entities, optionally filtered by domain",
  {
    domain: z.string().optional().describe("HA domain filter (e.g., light, switch, sensor)"),
  },
  async ({ domain }) => {
    const userId = await getDefaultUserId();
    if (!userId) return { content: [{ type: "text", text: "No users found" }] };

    const entities = await db.select().from(homeAssistantEntities).where(eq(homeAssistantEntities.userId, userId));

    const filtered = domain
      ? entities.filter((e) => e.entityId.startsWith(`${domain}.`))
      : entities;

    const result = filtered.map((e) => ({
      entityId: e.entityId,
      displayName: e.displayName,
      roomId: e.roomId,
      showInDashboard: e.showInDashboard,
    }));

    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ---- Start server ----

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("OpenFrame MCP server started (stdio)");
}

main().catch((err) => {
  console.error("MCP server failed to start:", err);
  process.exit(1);
});
