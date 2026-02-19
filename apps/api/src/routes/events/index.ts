import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "crypto";
import { eq, and, or, gte, lte, inArray, isNotNull } from "drizzle-orm";
import { calendars, events, oauthTokens } from "@openframe/database/schema";
import { eventQuerySchema, createEventSchema, quickEventSchema } from "@openframe/shared/validators";
import { getCurrentUser } from "../../plugins/auth.js";
import { expandRecurringEvents } from "../../services/calendar-sync/recurrence.js";
import { pushEventToGoogle, updateEventInGoogle, deleteEventFromGoogle } from "../../services/calendar-sync/google.js";
import { pushEventToMicrosoft, updateEventInMicrosoft, deleteEventFromMicrosoft } from "../../services/calendar-sync/microsoft.js";

export const eventRoutes: FastifyPluginAsync = async (fastify) => {
  // Get events
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get calendar events within a date range",
        tags: ["Events"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        querystring: {
          type: "object",
          properties: {
            start: { type: "string", format: "date-time" },
            end: { type: "string", format: "date-time" },
            calendarIds: { type: "string" },
            includeAllDay: { type: "boolean" },
          },
          required: ["start", "end"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const query = eventQuerySchema.parse(request.query);

      // Get user's calendars (all of them, filtering will be done by calendarIds param)
      const userCalendars = await fastify.db
        .select()
        .from(calendars)
        .where(eq(calendars.userId, user.id));

      // If calendarIds provided, use those (filtered to only user's calendars for security)
      // Otherwise fall back to visible calendars
      const calendarIds = query.calendarIds?.length
        ? query.calendarIds.filter((id) =>
            userCalendars.some((c) => c.id === id)
          )
        : userCalendars.filter((c) => c.isVisible).map((c) => c.id);

      if (calendarIds.length === 0) {
        return {
          success: true,
          data: [],
        };
      }

      // Get events in range, plus recurring master events that may have
      // occurrences in range (their endTime is the first occurrence only)
      const eventResults = await fastify.db
        .select()
        .from(events)
        .where(
          and(
            inArray(events.calendarId, calendarIds),
            or(
              // Normal events: fall within the queried range
              and(
                lte(events.startTime, query.end),
                gte(events.endTime, query.start)
              ),
              // Recurring master events: started before range end (may have future occurrences)
              and(
                isNotNull(events.recurrenceRule),
                lte(events.startTime, query.end)
              )
            )
          )
        );

      // Expand recurring events
      const expandedEvents = expandRecurringEvents(
        eventResults,
        query.start,
        query.end
      );

      // Include all events by default (no filtering)
      const filteredEvents = expandedEvents;

      // Add calendar info
      const calendarMap = new Map(userCalendars.map((c) => [c.id, c]));
      const eventsWithCalendar = filteredEvents.map((event) => ({
        ...event,
        calendar: {
          id: event.calendarId,
          name: calendarMap.get(event.calendarId)?.name,
          color: calendarMap.get(event.calendarId)?.color,
        },
      }));

      return {
        success: true,
        data: eventsWithCalendar,
      };
    }
  );

  // Get single event
  fastify.get(
    "/:id",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get a single event",
        tags: ["Events"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id } = request.params as { id: string };

      const [event] = await fastify.db
        .select()
        .from(events)
        .where(eq(events.id, id))
        .limit(1);

      if (!event) {
        return reply.notFound("Event not found");
      }

      // Verify user owns the calendar
      const [calendar] = await fastify.db
        .select()
        .from(calendars)
        .where(
          and(eq(calendars.id, event.calendarId), eq(calendars.userId, user.id))
        )
        .limit(1);

      if (!calendar) {
        return reply.notFound("Event not found");
      }

      return {
        success: true,
        data: {
          ...event,
          calendar: {
            id: calendar.id,
            name: calendar.name,
            color: calendar.color,
          },
        },
      };
    }
  );

  // Create event
  fastify.post(
    "/",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Create a new event",
        tags: ["Events"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        body: {
          type: "object",
          properties: {
            calendarId: { type: "string", format: "uuid" },
            title: { type: "string" },
            description: { type: "string" },
            location: { type: "string" },
            startTime: { type: "string", format: "date-time" },
            endTime: { type: "string", format: "date-time" },
            isAllDay: { type: "boolean" },
            recurrenceRule: { type: "string" },
          },
          required: ["calendarId", "title", "startTime", "endTime"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const input = createEventSchema.parse(request.body);

      // Verify user owns the calendar
      const [calendar] = await fastify.db
        .select()
        .from(calendars)
        .where(
          and(
            eq(calendars.id, input.calendarId),
            eq(calendars.userId, user.id)
          )
        )
        .limit(1);

      if (!calendar) {
        return reply.notFound("Calendar not found");
      }

      if (calendar.isReadOnly) {
        return reply.badRequest("Calendar is read-only");
      }

      // Create event in database
      const [event] = await fastify.db
        .insert(events)
        .values({
          calendarId: input.calendarId,
          externalId: `local_${randomUUID()}`,
          title: input.title,
          description: input.description,
          location: input.location,
          startTime: input.startTime,
          endTime: input.endTime,
          isAllDay: input.isAllDay,
          recurrenceRule: input.recurrenceRule,
          attendees: input.attendees,
          reminders: input.reminders,
        })
        .returning();

      // Sync to external calendar provider
      if ((calendar.provider === "google" || calendar.provider === "microsoft") && event) {
        const [token] = await fastify.db
          .select()
          .from(oauthTokens)
          .where(
            and(
              eq(oauthTokens.userId, user.id),
              eq(oauthTokens.provider, calendar.provider as "google" | "microsoft")
            )
          )
          .limit(1);

        if (token) {
          if (calendar.provider === "google") {
            await pushEventToGoogle(fastify.db, user.id, calendar, event, token);
          } else {
            await pushEventToMicrosoft(fastify.db, user.id, calendar, event, token);
          }
          // Re-fetch so response includes the updated externalId
          const [updated] = await fastify.db
            .select()
            .from(events)
            .where(eq(events.id, event.id))
            .limit(1);
          if (updated) {
            return reply.status(201).send({ success: true, data: updated });
          }
        }
      }

      return reply.status(201).send({
        success: true,
        data: event,
      });
    }
  );

  // Quick event (natural language)
  fastify.post(
    "/quick",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Create event from natural language",
        tags: ["Events"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        body: {
          type: "object",
          properties: {
            text: { type: "string" },
            calendarId: { type: "string", format: "uuid" },
          },
          required: ["text"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const input = quickEventSchema.parse(request.body);

      // Get default calendar if not specified
      let calendarId = input.calendarId;
      if (!calendarId) {
        const [primaryCalendar] = await fastify.db
          .select()
          .from(calendars)
          .where(
            and(eq(calendars.userId, user.id), eq(calendars.isPrimary, true))
          )
          .limit(1);

        if (!primaryCalendar) {
          return reply.badRequest("No default calendar found");
        }
        calendarId = primaryCalendar.id;
      }

      // Simple natural language parsing
      const parsed = parseQuickEvent(input.text);

      if (!parsed) {
        return reply.badRequest(
          "Could not parse event. Try format: 'Meeting with John tomorrow at 2pm'"
        );
      }

      const [event] = await fastify.db
        .insert(events)
        .values({
          calendarId,
          externalId: `local_${randomUUID()}`,
          title: parsed.title,
          startTime: parsed.startTime,
          endTime: parsed.endTime,
          isAllDay: parsed.isAllDay,
        })
        .returning();

      // Sync to external calendar provider
      if (event) {
        const [cal] = await fastify.db
          .select()
          .from(calendars)
          .where(eq(calendars.id, calendarId))
          .limit(1);

        if (cal?.provider === "google" || cal?.provider === "microsoft") {
          const [token] = await fastify.db
            .select()
            .from(oauthTokens)
            .where(
              and(
                eq(oauthTokens.userId, user.id),
                eq(oauthTokens.provider, cal.provider as "google" | "microsoft")
              )
            )
            .limit(1);

          if (token) {
            if (cal.provider === "google") {
              await pushEventToGoogle(fastify.db, user.id, cal, event, token);
            } else {
              await pushEventToMicrosoft(fastify.db, user.id, cal, event, token);
            }
            const [updated] = await fastify.db
              .select()
              .from(events)
              .where(eq(events.id, event.id))
              .limit(1);
            if (updated) {
              return reply.status(201).send({ success: true, data: updated });
            }
          }
        }
      }

      return reply.status(201).send({
        success: true,
        data: event,
      });
    }
  );

  // Update event
  fastify.patch(
    "/:id",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Update an event",
        tags: ["Events"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id } = request.params as { id: string };
      const body = request.body as Partial<{
        title: string;
        description: string;
        location: string;
        startTime: string | Date;
        endTime: string | Date;
        isAllDay: boolean;
      }>;

      // Parse date strings into Date objects
      const updates: Partial<{
        title: string;
        description: string;
        location: string;
        startTime: Date;
        endTime: Date;
        isAllDay: boolean;
      }> = {
        ...body,
        startTime: body.startTime ? new Date(body.startTime) : undefined,
        endTime: body.endTime ? new Date(body.endTime) : undefined,
      };

      // Get event and verify ownership
      const [existingEvent] = await fastify.db
        .select()
        .from(events)
        .where(eq(events.id, id))
        .limit(1);

      if (!existingEvent) {
        return reply.notFound("Event not found");
      }

      const [calendar] = await fastify.db
        .select()
        .from(calendars)
        .where(
          and(
            eq(calendars.id, existingEvent.calendarId),
            eq(calendars.userId, user.id)
          )
        )
        .limit(1);

      if (!calendar) {
        return reply.notFound("Event not found");
      }

      if (calendar.isReadOnly) {
        return reply.badRequest("Calendar is read-only");
      }

      const [event] = await fastify.db
        .update(events)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(events.id, id))
        .returning();

      // Sync update to external calendar provider
      if ((calendar.provider === "google" || calendar.provider === "microsoft") && event && !event.externalId.startsWith("local_")) {
        const [token] = await fastify.db
          .select()
          .from(oauthTokens)
          .where(
            and(
              eq(oauthTokens.userId, user.id),
              eq(oauthTokens.provider, calendar.provider as "google" | "microsoft")
            )
          )
          .limit(1);

        if (token) {
          if (calendar.provider === "google") {
            await updateEventInGoogle(fastify.db, calendar, event, token);
          } else {
            await updateEventInMicrosoft(fastify.db, calendar, event, token);
          }
        }
      }

      return {
        success: true,
        data: event,
      };
    }
  );

  // Delete event
  fastify.delete(
    "/:id",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Delete an event",
        tags: ["Events"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id } = request.params as { id: string };

      const [event] = await fastify.db
        .select()
        .from(events)
        .where(eq(events.id, id))
        .limit(1);

      if (!event) {
        return reply.notFound("Event not found");
      }

      const [calendar] = await fastify.db
        .select()
        .from(calendars)
        .where(
          and(
            eq(calendars.id, event.calendarId),
            eq(calendars.userId, user.id)
          )
        )
        .limit(1);

      if (!calendar) {
        return reply.notFound("Event not found");
      }

      if (calendar.isReadOnly) {
        return reply.badRequest("Calendar is read-only");
      }

      // Sync delete to external calendar before removing locally
      if ((calendar.provider === "google" || calendar.provider === "microsoft") && !event.externalId.startsWith("local_")) {
        const [token] = await fastify.db
          .select()
          .from(oauthTokens)
          .where(
            and(
              eq(oauthTokens.userId, user.id),
              eq(oauthTokens.provider, calendar.provider as "google" | "microsoft")
            )
          )
          .limit(1);

        if (token) {
          if (calendar.provider === "google") {
            await deleteEventFromGoogle(fastify.db, calendar, event, token);
          } else {
            await deleteEventFromMicrosoft(fastify.db, calendar, event, token);
          }
        }
      }

      await fastify.db.delete(events).where(eq(events.id, id));

      return { success: true };
    }
  );
};

// Simple natural language parsing
function parseQuickEvent(text: string): {
  title: string;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
} | null {
  const now = new Date();
  const lowerText = text.toLowerCase();

  // Extract time patterns
  const timeMatch = lowerText.match(
    /(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i
  );

  // Extract relative date patterns
  let date = new Date(now);
  if (lowerText.includes("tomorrow")) {
    date.setDate(date.getDate() + 1);
  } else if (lowerText.includes("next week")) {
    date.setDate(date.getDate() + 7);
  }

  // Set time
  let isAllDay = !timeMatch;
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]!, 10);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const period = timeMatch[3]?.toLowerCase();

    if (period === "pm" && hours < 12) {
      hours += 12;
    } else if (period === "am" && hours === 12) {
      hours = 0;
    }

    date.setHours(hours, minutes, 0, 0);
  } else {
    date.setHours(0, 0, 0, 0);
  }

  // Extract title (remove time/date phrases)
  let title = text
    .replace(
      /\b(at\s+)?\d{1,2}(:\d{2})?\s*(am|pm)?\b/gi,
      ""
    )
    .replace(/\b(tomorrow|today|next week)\b/gi, "")
    .trim();

  if (!title) {
    return null;
  }

  // Default duration: 1 hour for timed events, full day for all-day
  const endTime = new Date(date);
  if (isAllDay) {
    endTime.setHours(23, 59, 59, 999);
  } else {
    endTime.setHours(endTime.getHours() + 1);
  }

  return {
    title,
    startTime: date,
    endTime,
    isAllDay,
  };
}
