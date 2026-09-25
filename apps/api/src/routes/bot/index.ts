import type { FastifyPluginAsync } from "fastify";
import { eq, and } from "drizzle-orm";
import { calendars, events } from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";
import { decryptEventFields, encryptEventFields } from "../../lib/encryption.js";
import {
  addUtcDays,
  formatUtcDate,
  getZonedParts,
  parseDateOnlyUtc,
  resolveTimeZone,
  zonedDayRange,
  zonedTimeToUtc,
} from "../../lib/timezone.js";
import { queryEventsInRange } from "../../services/calendar-events.js";
import { pushEventChange } from "../../services/calendar-sync/push.js";

// Bot replies are read by people, so format in the user's time zone
function formatLongDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(date);
}

function dayKey(date: Date, timeZone: string): string {
  const p = getZonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export const botRoutes: FastifyPluginAsync = async (fastify) => {
  // Get today's events summary
  fastify.get(
    "/today",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Get today's events summary for bot",
        tags: ["Bot"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const timeZone = resolveTimeZone(user.timezone);
      const today = new Date();
      const { start, end } = zonedDayRange(today, timeZone);

      const userCalendars = await fastify.db
        .select()
        .from(calendars)
        .where(and(eq(calendars.userId, user.id), eq(calendars.isVisible, true)));

      const calendarIds = userCalendars.map((c) => c.id);

      if (calendarIds.length === 0) {
        return {
          success: true,
          data: {
            date: formatLongDate(today, timeZone),
            events: [],
            summary: "No calendars configured.",
          },
        };
      }

      const todayEvents = await queryEventsInRange(fastify.db, { calendarIds, start, end, timeZone });
      const calendarMap = new Map(userCalendars.map((c) => [c.id, c]));

      const formattedEvents = todayEvents.map((event) => ({
        title: event.title,
        time: event.isAllDay
          ? "All day"
          : `${formatTime(event.startTime, timeZone)} - ${formatTime(event.endTime, timeZone)}`,
        calendar: calendarMap.get(event.calendarId)?.name ?? "Unknown",
        location: event.location,
      }));

      let summary: string;
      if (formattedEvents.length === 0) {
        summary = "Your calendar is clear today.";
      } else if (formattedEvents.length === 1) {
        summary = `You have 1 event today: ${formattedEvents[0]!.title}`;
      } else {
        summary = `You have ${formattedEvents.length} events today.`;
      }

      return {
        success: true,
        data: {
          date: formatLongDate(today, timeZone),
          events: formattedEvents,
          summary,
        },
      };
    }
  );

  // Get upcoming events (next 7 days)
  fastify.get(
    "/upcoming",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Get events for the next 7 days",
        tags: ["Bot"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        querystring: {
          type: "object",
          properties: {
            days: { type: "number", minimum: 1, maximum: 30 },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { days = 7 } = request.query as { days?: number };
      const timeZone = resolveTimeZone(user.timezone);
      const today = new Date();
      const { start, end } = zonedDayRange(today, timeZone, days + 1);

      const userCalendars = await fastify.db
        .select()
        .from(calendars)
        .where(and(eq(calendars.userId, user.id), eq(calendars.isVisible, true)));

      const calendarIds = userCalendars.map((c) => c.id);

      if (calendarIds.length === 0) {
        return {
          success: true,
          data: {
            startDate: dayKey(start, timeZone),
            endDate: dayKey(end, timeZone),
            days: [],
          },
        };
      }

      const upcomingEvents = await queryEventsInRange(fastify.db, { calendarIds, start, end, timeZone });

      // Group by day (all-day events are stored as UTC-midnight dates)
      const eventsByDay = new Map<string, typeof upcomingEvents>();
      for (const event of upcomingEvents) {
        const key = event.isAllDay ? formatUtcDate(event.startTime) : dayKey(event.startTime, timeZone);
        const list = eventsByDay.get(key) ?? [];
        list.push(event);
        eventsByDay.set(key, list);
      }

      const calendarMap = new Map(userCalendars.map((c) => [c.id, c]));
      const todayParts = getZonedParts(today, timeZone);
      const firstDay = new Date(Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day));

      const daysData = [];
      for (let i = 0; i <= days; i++) {
        const date = addUtcDays(firstDay, i);
        const key = formatUtcDate(date);
        const dayEvents = eventsByDay.get(key) ?? [];

        daysData.push({
          date: key,
          dayName: new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long" }).format(date),
          events: dayEvents.map((event) => ({
            title: event.title,
            time: event.isAllDay ? "All day" : formatTime(event.startTime, timeZone),
            calendar: calendarMap.get(event.calendarId)?.name ?? "Unknown",
            location: event.location,
          })),
        });
      }

      return {
        success: true,
        data: {
          startDate: dayKey(start, timeZone),
          endDate: dayKey(end, timeZone),
          days: daysData.filter((d) => d.events.length > 0),
        },
      };
    }
  );

  // Add event from bot
  fastify.post(
    "/add-event",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Add event via bot command",
        tags: ["Bot"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        body: {
          type: "object",
          properties: {
            title: { type: "string" },
            date: { type: "string", format: "date" },
            time: { type: "string" },
            duration: { type: "number" },
            calendarId: { type: "string", format: "uuid" },
          },
          required: ["title", "date"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const body = request.body as {
        title: string;
        date: string;
        time?: string;
        duration?: number;
        calendarId?: string;
      };

      // Get calendar (always verify ownership)
      let calendar: typeof calendars.$inferSelect | undefined;
      if (body.calendarId) {
        [calendar] = await fastify.db
          .select()
          .from(calendars)
          .where(and(eq(calendars.id, body.calendarId), eq(calendars.userId, user.id)))
          .limit(1);
        if (!calendar) {
          return reply.forbidden("Calendar not found or not owned by you");
        }
      } else {
        const owned = await fastify.db.select().from(calendars).where(eq(calendars.userId, user.id));
        const writable = owned.filter((c) => !c.isReadOnly);
        calendar = writable.find((c) => c.isPrimary) ?? writable[0];
        if (!calendar) {
          return reply.badRequest("No calendars available");
        }
      }
      if (calendar.isReadOnly) {
        return reply.badRequest("Calendar is read-only");
      }

      const timeZone = resolveTimeZone(user.timezone);
      const eventDate = parseDateOnlyUtc(body.date);
      let startTime: Date;
      let endTime: Date;
      let isAllDay = false;

      if (body.time) {
        // Parse time like "14:00" or "2:00 PM"
        const timeMatch = body.time.trim().match(/^(\d{1,2}):?(\d{2})?\s*(am|pm)?$/i);
        if (!timeMatch) {
          return reply.badRequest("Invalid time format");
        }
        let hours = parseInt(timeMatch[1]!, 10);
        const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
        const period = timeMatch[3]?.toLowerCase();
        if (period === "pm" && hours < 12) hours += 12;
        if (period === "am" && hours === 12) hours = 0;
        if (hours > 23 || minutes > 59) {
          return reply.badRequest("Invalid time format");
        }

        startTime = zonedTimeToUtc(
          {
            year: eventDate.getUTCFullYear(),
            month: eventDate.getUTCMonth() + 1,
            day: eventDate.getUTCDate(),
            hour: hours,
            minute: minutes,
            second: 0,
          },
          timeZone
        );
        const durationMinutes = body.duration ?? 60;
        endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
      } else {
        // All-day events are stored as UTC midnight of the (inclusive) date
        isAllDay = true;
        startTime = eventDate;
        endTime = eventDate;
      }

      const [event] = await fastify.db
        .insert(events)
        .values(
          encryptEventFields({
            calendarId: calendar.id,
            externalId: `bot_${crypto.randomUUID()}`,
            title: body.title,
            startTime,
            endTime,
            isAllDay,
            timeZone: isAllDay ? null : timeZone,
          })
        )
        .returning();

      if (!event) {
        return reply.internalServerError("Failed to create event");
      }

      const push = await pushEventChange(fastify.db, calendar, event, "create", timeZone);
      const created = decryptEventFields(event);

      return reply.status(201).send({
        success: true,
        data: {
          id: created.id,
          title: created.title,
          date: isAllDay ? formatLongDate(startTime, "UTC") : formatLongDate(startTime, timeZone),
          time: isAllDay ? "All day" : formatTime(startTime, timeZone),
          calendar: calendar.displayName || calendar.name,
        },
        message: `Event "${body.title}" added to ${calendar.displayName || calendar.name}`,
        ...(push && !push.ok ? { syncWarning: push.error } : {}),
      });
    }
  );

  // Telegram webhook endpoint
  fastify.post(
    "/webhooks/telegram",
    {
      schema: {
        description: "Telegram webhook for bot updates",
        tags: ["Bot"],
      },
    },
    async (request, reply) => {
      // This would be handled by the separate bot service
      // Just acknowledge the webhook here
      fastify.log.info("Telegram webhook received");
      return reply.status(200).send({ ok: true });
    }
  );
};
