import type { FastifyPluginAsync } from "fastify";
import { eq, and, gte, lte } from "drizzle-orm";
import { calendars, events } from "@openframe/database/schema";
import { format, startOfDay, endOfDay, addDays } from "date-fns";
import { getCurrentUser } from "../../plugins/auth.js";

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
      const today = new Date();
      const start = startOfDay(today);
      const end = endOfDay(today);

      const userCalendars = await fastify.db
        .select()
        .from(calendars)
        .where(
          and(eq(calendars.userId, user.id), eq(calendars.isVisible, true))
        );

      const calendarIds = userCalendars.map((c) => c.id);

      if (calendarIds.length === 0) {
        return {
          success: true,
          data: {
            date: format(today, "EEEE, MMMM d, yyyy"),
            events: [],
            summary: "No calendars configured.",
          },
        };
      }

      // Get events for today
      const todayEvents = [];
      for (const calId of calendarIds) {
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
        todayEvents.push(...calEvents);
      }

      // Sort by start time
      todayEvents.sort(
        (a, b) => a.startTime.getTime() - b.startTime.getTime()
      );

      const calendarMap = new Map(userCalendars.map((c) => [c.id, c]));

      const formattedEvents = todayEvents.map((event) => ({
        title: event.title,
        time: event.isAllDay
          ? "All day"
          : `${format(event.startTime, "h:mm a")} - ${format(event.endTime, "h:mm a")}`,
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
          date: format(today, "EEEE, MMMM d, yyyy"),
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

      const today = new Date();
      const start = startOfDay(today);
      const end = endOfDay(addDays(today, days));

      const userCalendars = await fastify.db
        .select()
        .from(calendars)
        .where(
          and(eq(calendars.userId, user.id), eq(calendars.isVisible, true))
        );

      const calendarIds = userCalendars.map((c) => c.id);

      if (calendarIds.length === 0) {
        return {
          success: true,
          data: {
            startDate: format(start, "yyyy-MM-dd"),
            endDate: format(end, "yyyy-MM-dd"),
            days: [],
          },
        };
      }

      // Get events
      const upcomingEvents = [];
      for (const calId of calendarIds) {
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
        upcomingEvents.push(...calEvents);
      }

      // Group by day
      const eventsByDay = new Map<string, typeof upcomingEvents>();
      for (const event of upcomingEvents) {
        const dayKey = format(event.startTime, "yyyy-MM-dd");
        if (!eventsByDay.has(dayKey)) {
          eventsByDay.set(dayKey, []);
        }
        eventsByDay.get(dayKey)!.push(event);
      }

      const calendarMap = new Map(userCalendars.map((c) => [c.id, c]));

      // Format by day
      const daysData = [];
      for (let i = 0; i <= days; i++) {
        const date = addDays(today, i);
        const dayKey = format(date, "yyyy-MM-dd");
        const dayEvents = eventsByDay.get(dayKey) ?? [];

        // Sort events by start time
        dayEvents.sort(
          (a, b) => a.startTime.getTime() - b.startTime.getTime()
        );

        daysData.push({
          date: dayKey,
          dayName: format(date, "EEEE"),
          events: dayEvents.map((event) => ({
            title: event.title,
            time: event.isAllDay
              ? "All day"
              : format(event.startTime, "h:mm a"),
            calendar: calendarMap.get(event.calendarId)?.name ?? "Unknown",
            location: event.location,
          })),
        });
      }

      return {
        success: true,
        data: {
          startDate: format(start, "yyyy-MM-dd"),
          endDate: format(end, "yyyy-MM-dd"),
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

      // Get calendar
      let calendarId = body.calendarId;
      if (!calendarId) {
        const [primaryCalendar] = await fastify.db
          .select()
          .from(calendars)
          .where(
            and(eq(calendars.userId, user.id), eq(calendars.isPrimary, true))
          )
          .limit(1);

        if (!primaryCalendar) {
          const [anyCalendar] = await fastify.db
            .select()
            .from(calendars)
            .where(eq(calendars.userId, user.id))
            .limit(1);

          if (!anyCalendar) {
            return reply.badRequest("No calendars available");
          }
          calendarId = anyCalendar.id;
        } else {
          calendarId = primaryCalendar.id;
        }
      }

      // Parse date and time
      const eventDate = new Date(body.date);
      let startTime: Date;
      let endTime: Date;
      let isAllDay = false;

      if (body.time) {
        // Parse time like "14:00" or "2:00 PM"
        const timeMatch = body.time.match(
          /^(\d{1,2}):?(\d{2})?\s*(am|pm)?$/i
        );
        if (timeMatch) {
          let hours = parseInt(timeMatch[1]!, 10);
          const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
          const period = timeMatch[3]?.toLowerCase();

          if (period === "pm" && hours < 12) hours += 12;
          if (period === "am" && hours === 12) hours = 0;

          startTime = new Date(eventDate);
          startTime.setHours(hours, minutes, 0, 0);

          // Default duration: 1 hour
          const durationMinutes = body.duration ?? 60;
          endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
        } else {
          return reply.badRequest("Invalid time format");
        }
      } else {
        // All-day event
        isAllDay = true;
        startTime = startOfDay(eventDate);
        endTime = endOfDay(eventDate);
      }

      const [event] = await fastify.db
        .insert(events)
        .values({
          calendarId,
          externalId: `bot_${crypto.randomUUID()}`,
          title: body.title,
          startTime,
          endTime,
          isAllDay,
        })
        .returning();

      const [calendar] = await fastify.db
        .select()
        .from(calendars)
        .where(eq(calendars.id, calendarId))
        .limit(1);

      return reply.status(201).send({
        success: true,
        data: {
          id: event!.id,
          title: event!.title,
          date: format(startTime, "EEEE, MMMM d, yyyy"),
          time: isAllDay ? "All day" : format(startTime, "h:mm a"),
          calendar: calendar?.name ?? "Unknown",
        },
        message: `Event "${body.title}" added to ${calendar?.name ?? "calendar"}`,
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
