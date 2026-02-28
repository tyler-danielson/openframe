import Anthropic from "@anthropic-ai/sdk";
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
  assumptions,
} from "@openframe/database/schema";
import { getSystemSetting, getCategorySettings } from "../routes/settings/index.js";

interface ChatContext {
  systemPrompt: string;
}

/**
 * Build the system prompt with full data context for the chat assistant.
 */
export async function buildChatContext(
  db: any,
  userId: string,
  userName?: string
): Promise<ChatContext> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const threeDaysOut = new Date(todayStart.getTime() + 3 * 24 * 60 * 60 * 1000);

  // Fetch all context in parallel
  const [
    eventsData,
    tasksData,
    weather,
    sportsData,
    headlines,
    haData,
    customInstructions,
    userAssumptions,
  ] = await Promise.all([
    fetchUpcomingEvents(db, userId, todayStart, threeDaysOut),
    fetchIncompleteTasks(db, userId),
    fetchWeather(db),
    fetchSportsGames(db, userId),
    fetchHeadlines(db, userId),
    fetchHAEntities(db, userId),
    getSystemSetting(db, "chat", "system_prompt_extra"),
    fetchAssumptions(db, userId),
  ]);

  // Build system prompt sections
  const sections: string[] = [
    `You are a helpful personal assistant for ${userName || "the user"}. You have access to their calendar, tasks, weather, sports, news, and smart home data. Be concise, friendly, and helpful. When answering questions about their schedule, be specific with times and details.`,
    "",
    `Current date/time: ${now.toLocaleString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}`,
  ];

  // Calendar events
  if (eventsData.length > 0) {
    sections.push("");
    sections.push("## UPCOMING EVENTS (next 3 days)");
    for (const e of eventsData) {
      const start = new Date(e.startTime);
      const dateStr = start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      const timeStr = e.isAllDay ? "All day" : start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      const end = new Date(e.endTime);
      const endStr = e.isAllDay ? "" : ` - ${end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
      const location = e.location ? ` @ ${e.location}` : "";
      sections.push(`- ${dateStr} ${timeStr}${endStr}: ${e.title}${location} [${e.calendarName}]`);
    }
  } else {
    sections.push("\n## UPCOMING EVENTS\nNo events in the next 3 days.");
  }

  // Tasks
  if (tasksData.length > 0) {
    sections.push("");
    sections.push("## INCOMPLETE TASKS");
    for (const t of tasksData) {
      const due = t.dueDate ? ` (due: ${new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })})` : "";
      sections.push(`- ${t.title}${due} [${t.listName}]`);
    }
  }

  // Weather
  if (weather) {
    sections.push("");
    sections.push("## CURRENT WEATHER");
    sections.push(`${Math.round(weather.temp)}°${weather.units === "metric" ? "C" : "F"}, ${weather.description}`);
    if (weather.forecast) {
      sections.push("Forecast:");
      for (const f of weather.forecast) {
        sections.push(`- ${f.day}: ${Math.round(f.high)}°/${Math.round(f.low)}° ${f.description}`);
      }
    }
  }

  // Sports
  if (sportsData.length > 0) {
    sections.push("");
    sections.push("## SPORTS (favorite teams)");
    for (const g of sportsData) {
      const time = new Date(g.startTime);
      const dateStr = time.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      const timeStr = time.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      const score = g.status === "final" || g.status === "in_progress"
        ? ` | ${g.awayTeamAbbreviation} ${g.awayTeamScore ?? 0} - ${g.homeTeamAbbreviation} ${g.homeTeamScore ?? 0}`
        : "";
      const status = g.statusDetail || g.status;
      sections.push(`- ${dateStr} ${timeStr}: ${g.awayTeamName} @ ${g.homeTeamName} (${g.league.toUpperCase()}) [${status}]${score}`);
    }
  }

  // News headlines
  if (headlines.length > 0) {
    sections.push("");
    sections.push("## RECENT NEWS HEADLINES");
    for (const h of headlines) {
      sections.push(`- ${h.title} (${h.feedName})`);
    }
  }

  // Home Assistant
  if (haData.rooms.length > 0) {
    sections.push("");
    sections.push("## SMART HOME STATUS");
    for (const room of haData.rooms) {
      sections.push(`### ${room.name}`);
      for (const entity of room.entities) {
        sections.push(`- ${entity.displayName || entity.entityId}: ${entity.state || "unknown"}`);
      }
    }
  }

  // User assumptions (AI behavior rules)
  if (userAssumptions.length > 0) {
    sections.push("");
    sections.push("## USER ASSUMPTIONS (always follow these rules)");
    for (const a of userAssumptions) {
      sections.push(`- ${a.text}`);
    }
  }

  // Custom instructions
  if (customInstructions) {
    sections.push("");
    sections.push("## ADDITIONAL INSTRUCTIONS FROM USER");
    sections.push(customInstructions);
  }

  return {
    systemPrompt: sections.join("\n"),
  };
}

// ---- Data fetchers ----

async function fetchUpcomingEvents(db: any, userId: string, start: Date, end: Date) {
  const userCalendars = await db
    .select({ id: calendars.id, name: calendars.name })
    .from(calendars)
    .where(eq(calendars.userId, userId));

  if (userCalendars.length === 0) return [];

  const calendarMap = new Map(userCalendars.map((c: any) => [c.id, c.name]));
  const calendarIds = userCalendars.map((c: any) => c.id);

  const allEvents = await db
    .select()
    .from(events)
    .where(eq(events.status, "confirmed"));

  return allEvents
    .filter((e: any) => {
      const st = new Date(e.startTime);
      return calendarIds.includes(e.calendarId) && st >= start && st < end;
    })
    .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 30)
    .map((e: any) => ({
      ...e,
      calendarName: calendarMap.get(e.calendarId) || "Unknown",
    }));
}

async function fetchIncompleteTasks(db: any, userId: string) {
  const userLists = await db
    .select({ id: taskLists.id, name: taskLists.name })
    .from(taskLists)
    .where(eq(taskLists.userId, userId));

  if (userLists.length === 0) return [];

  const listMap = new Map(userLists.map((l: any) => [l.id, l.name]));
  const listIds = userLists.map((l: any) => l.id);

  const allTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.status, "needsAction"));

  return allTasks
    .filter((t: any) => listIds.includes(t.taskListId))
    .slice(0, 20)
    .map((t: any) => ({
      ...t,
      listName: listMap.get(t.taskListId) || "Unknown",
    }));
}

async function fetchWeather(db: any) {
  try {
    const apiKey = await getSystemSetting(db, "weather", "api_key");
    const units = (await getSystemSetting(db, "weather", "units")) || "imperial";
    const lat = await getSystemSetting(db, "home", "latitude");
    const lon = await getSystemSetting(db, "home", "longitude");

    if (!apiKey || !lat || !lon) return null;

    // Current weather
    const currentRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${units}&appid=${apiKey}`
    );
    if (!currentRes.ok) return null;
    const currentData = await currentRes.json() as any;

    // 5-day forecast
    let forecast: { day: string; high: number; low: number; description: string }[] = [];
    try {
      const forecastRes = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${units}&appid=${apiKey}`
      );
      if (forecastRes.ok) {
        const forecastData = await forecastRes.json() as any;
        // Group by day and get highs/lows
        const dayMap = new Map<string, { temps: number[]; desc: string }>();
        for (const item of forecastData.list || []) {
          const date = new Date(item.dt * 1000);
          const dayKey = date.toLocaleDateString("en-US", { weekday: "short" });
          if (!dayMap.has(dayKey)) {
            dayMap.set(dayKey, { temps: [], desc: item.weather?.[0]?.description || "" });
          }
          dayMap.get(dayKey)!.temps.push(item.main.temp);
        }
        forecast = Array.from(dayMap.entries()).slice(0, 3).map(([day, data]) => ({
          day,
          high: Math.max(...data.temps),
          low: Math.min(...data.temps),
          description: data.desc,
        }));
      }
    } catch { /* forecast is optional */ }

    return {
      temp: currentData.main.temp,
      description: currentData.weather?.[0]?.description || "Unknown",
      units,
      forecast: forecast.length > 0 ? forecast : undefined,
    };
  } catch {
    return null;
  }
}

async function fetchSportsGames(db: any, userId: string) {
  const teams = await db
    .select()
    .from(favoriteSportsTeams)
    .where(eq(favoriteSportsTeams.userId, userId));

  if (teams.length === 0) return [];

  const now = new Date();
  const weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const allGames = await db.select().from(sportsGames);

  const teamIds = new Set(teams.map((t: any) => t.teamId));

  return allGames
    .filter((g: any) => {
      const st = new Date(g.startTime);
      return (
        (teamIds.has(g.homeTeamId) || teamIds.has(g.awayTeamId)) &&
        st >= new Date(now.getTime() - 24 * 60 * 60 * 1000) && // include recent finished games
        st <= weekOut
      );
    })
    .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 10);
}

async function fetchHeadlines(db: any, userId: string) {
  const userFeeds = await db
    .select({ id: newsFeeds.id, name: newsFeeds.name })
    .from(newsFeeds)
    .where(and(eq(newsFeeds.userId, userId), eq(newsFeeds.isActive, true)));

  if (userFeeds.length === 0) return [];

  const feedMap = new Map(userFeeds.map((f: any) => [f.id, f.name]));
  const feedIds = userFeeds.map((f: any) => f.id);

  const articles = await db
    .select()
    .from(newsArticles)
    .orderBy(desc(newsArticles.publishedAt))
    .limit(50);

  return articles
    .filter((a: any) => feedIds.includes(a.feedId))
    .slice(0, 10)
    .map((a: any) => ({
      title: a.title,
      feedName: feedMap.get(a.feedId) || "Unknown",
    }));
}

async function fetchHAEntities(db: any, userId: string) {
  const rooms = await db
    .select()
    .from(homeAssistantRooms)
    .where(eq(homeAssistantRooms.userId, userId));

  if (rooms.length === 0) return { rooms: [] };

  const entities = await db
    .select()
    .from(homeAssistantEntities)
    .where(eq(homeAssistantEntities.userId, userId));

  // Group entities by room
  const roomData = rooms.map((room: any) => ({
    name: room.name,
    entities: entities
      .filter((e: any) => e.roomId === room.id)
      .map((e: any) => ({
        entityId: e.entityId,
        displayName: e.displayName,
        state: null as string | null, // Would need HA WebSocket; leave null for now
      })),
  }));

  return { rooms: roomData };
}

async function fetchAssumptions(db: any, userId: string) {
  return db
    .select({ text: assumptions.text })
    .from(assumptions)
    .where(and(eq(assumptions.userId, userId), eq(assumptions.enabled, true)))
    .orderBy(assumptions.sortOrder);
}

// ---- Multi-provider streaming ----

export async function* streamClaude(
  apiKey: string,
  systemPrompt: string,
  messages: { role: string; content: string }[],
  model?: string
): AsyncGenerator<{ type: "token" | "done" | "error"; data: string; usage?: any }> {
  const client = new Anthropic({ apiKey });

  // Separate system from conversation messages
  const conversationMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  try {
    const stream = client.messages.stream({
      model: model || "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      system: systemPrompt,
      messages: conversationMessages,
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield { type: "token", data: event.delta.text };
      }
    }

    const finalMessage = await stream.finalMessage();
    yield {
      type: "done",
      data: "",
      usage: {
        promptTokens: finalMessage.usage?.input_tokens,
        completionTokens: finalMessage.usage?.output_tokens,
        totalTokens:
          (finalMessage.usage?.input_tokens || 0) +
          (finalMessage.usage?.output_tokens || 0),
      },
    };
  } catch (error: any) {
    yield { type: "error", data: error.message || "Claude API error" };
  }
}

export async function* streamOpenAI(
  apiKey: string,
  systemPrompt: string,
  messages: { role: string; content: string }[],
  model?: string
): AsyncGenerator<{ type: "token" | "done" | "error"; data: string; usage?: any }> {
  const apiMessages = [
    { role: "system", content: systemPrompt },
    ...messages.filter((m) => m.role !== "system"),
  ];

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || "gpt-4o",
        messages: apiMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as any;
      yield { type: "error", data: err.error?.message || `OpenAI API error: ${response.status}` };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: "error", data: "No response body" };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") {
          yield { type: "done", data: "" };
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            yield { type: "token", data: content };
          }
        } catch { /* skip malformed */ }
      }
    }

    yield { type: "done", data: "" };
  } catch (error: any) {
    yield { type: "error", data: error.message || "OpenAI API error" };
  }
}

export async function* streamGemini(
  apiKey: string,
  systemPrompt: string,
  messages: { role: string; content: string }[],
  model?: string
): AsyncGenerator<{ type: "token" | "done" | "error"; data: string; usage?: any }> {
  // Convert messages to Gemini format
  const geminiContents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const modelName = model || "gemini-2.5-flash";

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: geminiContents,
          generationConfig: {
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as any;
      yield { type: "error", data: err.error?.message || `Gemini API error: ${response.status}` };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: "error", data: "No response body" };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        try {
          const parsed = JSON.parse(data);
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            yield { type: "token", data: text };
          }
        } catch { /* skip malformed */ }
      }
    }

    yield { type: "done", data: "" };
  } catch (error: any) {
    yield { type: "error", data: error.message || "Gemini API error" };
  }
}

/**
 * Dispatch to the correct provider's streaming function.
 */
export async function* streamChat(
  provider: "claude" | "openai" | "gemini",
  apiKey: string,
  systemPrompt: string,
  messages: { role: string; content: string }[],
  model?: string
): AsyncGenerator<{ type: "token" | "done" | "error"; data: string; usage?: any }> {
  switch (provider) {
    case "claude":
      yield* streamClaude(apiKey, systemPrompt, messages, model);
      break;
    case "openai":
      yield* streamOpenAI(apiKey, systemPrompt, messages, model);
      break;
    case "gemini":
      yield* streamGemini(apiKey, systemPrompt, messages, model);
      break;
    default:
      yield { type: "error", data: `Unknown provider: ${provider}` };
  }
}
