import Anthropic from "@anthropic-ai/sdk";
import type { DailyBriefing, CalendarEvent, Task, NewsHeadline } from "@openframe/shared";

interface BriefingContext {
  events: CalendarEvent[];
  tasks: Task[];
  weather: {
    temp: number;
    description: string;
    units: string;
  } | null;
  headlines: NewsHeadline[];
  userName?: string;
}

// In-memory cache for briefings (simple TTL cache)
interface CachedBriefing {
  briefing: DailyBriefing;
  expiresAt: number;
}

const briefingCache = new Map<string, CachedBriefing>();

// Clean up expired cache entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of briefingCache.entries()) {
    if (value.expiresAt < now) {
      briefingCache.delete(key);
    }
  }
}, 10 * 60 * 1000);

/**
 * Generates a personalized daily briefing using Claude AI.
 */
export async function generateDailyBriefing(
  apiKey: string,
  context: BriefingContext,
  userId: string
): Promise<DailyBriefing> {
  // Check cache first (30 minute TTL)
  const cacheKey = `briefing:${userId}:${new Date().toDateString()}`;
  const cached = briefingCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.briefing;
  }

  const client = new Anthropic({ apiKey });

  // Build context summary
  const now = new Date();
  const todayEvents = context.events.filter((e) => {
    const eventDate = new Date(e.startTime);
    return eventDate.toDateString() === now.toDateString();
  });

  const upcomingTasks = context.tasks
    .filter((t) => t.status === "needsAction")
    .slice(0, 5);

  const dueTodayTasks = upcomingTasks.filter((t) => {
    if (!t.dueDate) return false;
    const dueDate = new Date(t.dueDate);
    return dueDate.toDateString() === now.toDateString();
  });

  const overdueTasks = upcomingTasks.filter((t) => {
    if (!t.dueDate) return false;
    const dueDate = new Date(t.dueDate);
    return dueDate < now && dueDate.toDateString() !== now.toDateString();
  });

  // Format events for prompt
  const eventsSummary = todayEvents.length > 0
    ? todayEvents.map((e) => {
        const time = new Date(e.startTime).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        });
        return `- ${e.title} at ${time}${e.location ? ` (${e.location})` : ""}`;
      }).join("\n")
    : "No events scheduled";

  // Format weather
  const weatherSummary = context.weather
    ? `${Math.round(context.weather.temp)}${context.weather.units === "metric" ? "C" : "F"}, ${context.weather.description}`
    : "Weather unavailable";

  // Format headlines
  const headlinesSummary = context.headlines.length > 0
    ? context.headlines.slice(0, 3).map((h) => `- ${h.title}`).join("\n")
    : "No headlines available";

  // Build prompt
  const prompt = `Generate a friendly, concise morning briefing for today. Keep it warm but professional, about 2-3 sentences for the summary, then bullet points for highlights.

Today's date: ${now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
${context.userName ? `User's name: ${context.userName}` : ""}

CALENDAR:
${eventsSummary}
Total meetings/events today: ${todayEvents.length}
${todayEvents.length > 0 ? `First event: ${todayEvents[0]!.title} at ${new Date(todayEvents[0]!.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : ""}

TASKS:
- Tasks due today: ${dueTodayTasks.length}
- Overdue tasks: ${overdueTasks.length}
- Total incomplete tasks: ${upcomingTasks.length}

WEATHER:
${weatherSummary}

TOP NEWS:
${headlinesSummary}

Generate a JSON response with this exact format:
{
  "summary": "A friendly 2-3 sentence morning greeting summarizing the day ahead",
  "highlights": ["bullet point 1", "bullet point 2", "bullet point 3"]
}

Keep highlights to 3-5 items max. Focus on what's most important for the day.`;

  try {
    const response = await client.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Extract text content
    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Claude");
    }

    // Parse JSON from response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse JSON from response");
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      summary: string;
      highlights: string[];
    };

    const briefing: DailyBriefing = {
      summary: parsed.summary,
      highlights: parsed.highlights,
      generatedAt: new Date().toISOString(),
    };

    // Cache the result for 30 minutes
    briefingCache.set(cacheKey, {
      briefing,
      expiresAt: Date.now() + 30 * 60 * 1000,
    });

    return briefing;
  } catch (error: any) {
    console.error("Failed to generate briefing:", error);
    throw new Error(`Failed to generate briefing: ${error.message}`);
  }
}

/**
 * Checks if the Anthropic API key is configured and valid.
 */
export async function checkBriefingStatus(apiKey: string | null): Promise<{
  configured: boolean;
  error?: string;
}> {
  if (!apiKey) {
    return {
      configured: false,
      error: "Anthropic API key not configured. Add it in Settings.",
    };
  }

  try {
    // Try a minimal API call to verify the key
    const client = new Anthropic({ apiKey });
    await client.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 10,
      messages: [{ role: "user", content: "test" }],
    });
    return { configured: true };
  } catch (error: any) {
    if (error.status === 401) {
      return {
        configured: false,
        error: "Invalid Anthropic API key",
      };
    }
    // Key is valid but other error - still consider it configured
    return { configured: true };
  }
}
