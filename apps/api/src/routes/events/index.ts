import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import { calendars, events } from "@openframe/database/schema";
import type { Database } from "@openframe/database";
import {
  eventQuerySchema,
  createEventSchema,
  quickEventSchema,
  updateEventSchema,
} from "@openframe/shared/validators";
import { getCurrentUser } from "../../plugins/auth.js";
import { queryEventsInRange } from "../../services/calendar-events.js";
import { googleInstanceId } from "../../services/calendar-sync/google.js";
import { pushEventChange, pushOccurrenceChange } from "../../services/calendar-sync/push.js";
import { encryptEventFields, decryptEventFields } from "../../lib/encryption.js";
import { isValidTimeZone, resolveTimeZone } from "../../lib/timezone.js";
import { parseQuickEvent } from "../../services/quick-event.js";

type CalendarRecord = typeof calendars.$inferSelect;

/** Client-supplied zone if valid, else the user's configured one, else UTC. */
function pickTimeZone(requested: string | null | undefined, userTimeZone: string | null | undefined): string {
  if (requested && isValidTimeZone(requested)) return requested;
  return resolveTimeZone(userTimeZone);
}

async function getOwnedCalendar(db: Database, calendarId: string, userId: string): Promise<CalendarRecord | undefined> {
  const [calendar] = await db
    .select()
    .from(calendars)
    .where(and(eq(calendars.id, calendarId), eq(calendars.userId, userId)))
    .limit(1);
  return calendar;
}

type EventRecord = typeof events.$inferSelect;

/** An event with the calendar it's on, if both exist and belong to the user. */
async function getOwnedEvent(
  db: Database,
  eventId: string,
  userId: string
): Promise<{ event: EventRecord; calendar: CalendarRecord } | null> {
  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) return null;
  const calendar = await getOwnedCalendar(db, event.calendarId, userId);
  return calendar ? { event, calendar } : null;
}

/** Rows that change single occurrences of `series` (all of them, or the one at `originalStart`). */
function overridesOf(series: EventRecord, originalStart?: Date) {
  return and(
    eq(events.calendarId, series.calendarId),
    eq(events.recurringEventId, series.externalId),
    ...(originalStart ? [eq(events.originalStartTime, originalStart)] : [])
  );
}

const occurrenceParams = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid", description: "The recurring event (series)" },
    start: { type: "string", format: "date-time", description: "The occurrence's original start" },
  },
  required: ["id", "start"],
} as const;

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
            tz: { type: "string", description: "Viewer's IANA time zone (defaults to the user's)" },
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

      const userCalendars = await fastify.db
        .select()
        .from(calendars)
        .where(eq(calendars.userId, user.id));

      // Disabled calendars never show. With explicit calendarIds, use those
      // (limited to the user's enabled calendars); otherwise, visible ones.
      const enabledCalendars = userCalendars.filter((c) => c.syncEnabled || c.provider === "local");
      const calendarIds = query.calendarIds?.length
        ? query.calendarIds.filter((id) => enabledCalendars.some((c) => c.id === id))
        : enabledCalendars.filter((c) => c.isVisible).map((c) => c.id);

      const expandedEvents = await queryEventsInRange(fastify.db, {
        calendarIds,
        start: query.start,
        end: query.end,
        timeZone: pickTimeZone(query.tz, user.timezone),
      });

      const calendarMap = new Map(userCalendars.map((c) => [c.id, c]));
      return {
        success: true,
        data: expandedEvents.map((event) => {
          const calendar = calendarMap.get(event.calendarId);
          return {
            ...event,
            calendar: {
              id: event.calendarId,
              name: calendar ? calendar.displayName || calendar.name : undefined,
              color: calendar?.color,
            },
          };
        }),
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

      const [event] = await fastify.db.select().from(events).where(eq(events.id, id)).limit(1);
      if (!event) {
        return reply.notFound("Event not found");
      }

      const calendar = await getOwnedCalendar(fastify.db, event.calendarId, user.id);
      if (!calendar) {
        return reply.notFound("Event not found");
      }

      return {
        success: true,
        data: {
          ...decryptEventFields(event),
          calendar: {
            id: calendar.id,
            name: calendar.displayName || calendar.name,
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
            timeZone: { type: "string" },
            metadata: { type: "object" },
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

      const calendar = await getOwnedCalendar(fastify.db, input.calendarId, user.id);
      if (!calendar) {
        return reply.notFound("Calendar not found");
      }
      if (calendar.isReadOnly) {
        return reply.badRequest("Calendar is read-only");
      }
      if (input.endTime < input.startTime) {
        return reply.badRequest("Event can't end before it starts");
      }

      const [event] = await fastify.db
        .insert(events)
        .values(
          encryptEventFields({
            calendarId: input.calendarId,
            externalId: `local_${randomUUID()}`,
            title: input.title,
            description: input.description,
            location: input.location,
            startTime: input.startTime,
            endTime: input.endTime,
            isAllDay: input.isAllDay,
            recurrenceRule: input.recurrenceRule,
            timeZone: input.isAllDay ? null : pickTimeZone(input.timeZone, user.timezone),
            attendees: input.attendees,
            reminders: input.reminders,
            metadata: input.metadata ?? {},
          })
        )
        .returning();

      if (!event) {
        return reply.internalServerError("Failed to create event");
      }

      // Send to Google/Microsoft; a failure keeps the event locally and is
      // retried on the next edit
      const push = await pushEventChange(fastify.db, calendar, event, "create", user.timezone);
      const [current] = await fastify.db.select().from(events).where(eq(events.id, event.id)).limit(1);

      return reply.status(201).send({
        success: true,
        data: decryptEventFields(current ?? event),
        ...(push && !push.ok ? { syncWarning: push.error } : {}),
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
            timeZone: { type: "string" },
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

      let calendar: CalendarRecord | undefined;
      if (input.calendarId) {
        calendar = await getOwnedCalendar(fastify.db, input.calendarId, user.id);
        if (!calendar) return reply.notFound("Calendar not found");
      } else {
        [calendar] = await fastify.db
          .select()
          .from(calendars)
          .where(and(eq(calendars.userId, user.id), eq(calendars.isPrimary, true)))
          .limit(1);
        if (!calendar) return reply.badRequest("No default calendar found");
      }
      if (calendar.isReadOnly) {
        return reply.badRequest("Calendar is read-only");
      }

      const timeZone = pickTimeZone(input.timeZone, user.timezone);
      const parsed = parseQuickEvent(input.text, timeZone);
      if (!parsed) {
        return reply.badRequest("Could not parse event. Try format: 'Meeting with John tomorrow at 2pm'");
      }

      const [event] = await fastify.db
        .insert(events)
        .values(
          encryptEventFields({
            calendarId: calendar.id,
            externalId: `local_${randomUUID()}`,
            title: parsed.title,
            startTime: parsed.startTime,
            endTime: parsed.endTime,
            isAllDay: parsed.isAllDay,
            timeZone: parsed.isAllDay ? null : timeZone,
          })
        )
        .returning();

      if (!event) {
        return reply.internalServerError("Failed to create event");
      }

      const push = await pushEventChange(fastify.db, calendar, event, "create", timeZone);
      const [current] = await fastify.db.select().from(events).where(eq(events.id, event.id)).limit(1);

      return reply.status(201).send({
        success: true,
        data: decryptEventFields(current ?? event),
        ...(push && !push.ok ? { syncWarning: push.error } : {}),
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
      const parsedBody = updateEventSchema.safeParse(request.body ?? {});
      if (!parsedBody.success) {
        return reply.badRequest(parsedBody.error.issues[0]?.message ?? "Invalid event update");
      }
      const body = parsedBody.data;

      const [existingEvent] = await fastify.db.select().from(events).where(eq(events.id, id)).limit(1);
      if (!existingEvent) {
        return reply.notFound("Event not found");
      }

      const calendar = await getOwnedCalendar(fastify.db, existingEvent.calendarId, user.id);
      if (!calendar) {
        return reply.notFound("Event not found");
      }
      if (body.calendarId && body.calendarId !== existingEvent.calendarId) {
        return reply.badRequest("Moving events between calendars isn't supported");
      }

      // Metadata holds OpenFrame-only settings (countdowns): shallow-merge it
      const metadata =
        body.metadata !== undefined
          ? { ...((existingEvent.metadata as Record<string, unknown>) ?? {}), ...body.metadata }
          : undefined;

      const updates = {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description || null } : {}),
        ...(body.location !== undefined ? { location: body.location || null } : {}),
        ...(body.startTime !== undefined ? { startTime: body.startTime } : {}),
        ...(body.endTime !== undefined ? { endTime: body.endTime } : {}),
        ...(body.isAllDay !== undefined ? { isAllDay: body.isAllDay } : {}),
        ...(body.recurrenceRule !== undefined ? { recurrenceRule: body.recurrenceRule || null } : {}),
        ...(body.timeZone !== undefined ? { timeZone: body.timeZone && isValidTimeZone(body.timeZone) ? body.timeZone : null } : {}),
      };
      const changesEventFields = Object.keys(updates).length > 0;

      // Read-only calendars only allow metadata updates (e.g. countdown settings)
      if (calendar.isReadOnly && changesEventFields) {
        return reply.badRequest("Calendar is read-only");
      }

      const startTime = updates.startTime ?? existingEvent.startTime;
      const endTime = updates.endTime ?? existingEvent.endTime;
      if (endTime < startTime) {
        return reply.badRequest("Event can't end before it starts");
      }

      const [event] = await fastify.db
        .update(events)
        .set({
          ...encryptEventFields(updates),
          ...(metadata !== undefined ? { metadata } : {}),
          updatedAt: new Date(),
        })
        .where(eq(events.id, id))
        .returning();

      if (!event) {
        return reply.notFound("Event not found");
      }

      if (changesEventFields) {
        const push = await pushEventChange(fastify.db, calendar, event, "update", user.timezone);
        if (push && !push.ok) {
          // Keep OpenFrame and the provider consistent: undo the local edit
          await fastify.db
            .update(events)
            .set({
              title: existingEvent.title,
              description: existingEvent.description,
              location: existingEvent.location,
              startTime: existingEvent.startTime,
              endTime: existingEvent.endTime,
              isAllDay: existingEvent.isAllDay,
              recurrenceRule: existingEvent.recurrenceRule,
              timeZone: existingEvent.timeZone,
              updatedAt: existingEvent.updatedAt,
            })
            .where(eq(events.id, id));
          return reply.code(502).send({ success: false, error: "sync_failed", message: push.error });
        }
      }

      const [current] = await fastify.db.select().from(events).where(eq(events.id, id)).limit(1);
      return {
        success: true,
        data: decryptEventFields(current ?? event),
      };
    }
  );

  // Change one occurrence of a recurring event. Stored as an override row
  // (like Google's modified instances) that replaces the generated occurrence.
  fastify.patch(
    "/:id/occurrences/:start",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Update one occurrence of a recurring event",
        tags: ["Events"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: occurrenceParams,
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id, start } = request.params as { id: string; start: string };
      const parsedBody = updateEventSchema.safeParse(request.body ?? {});
      if (!parsedBody.success) {
        return reply.badRequest(parsedBody.error.issues[0]?.message ?? "Invalid event update");
      }
      const body = parsedBody.data;
      if (body.recurrenceRule || body.calendarId) {
        return reply.badRequest("A single occurrence can't change its repeat rule or calendar");
      }

      const owned = await getOwnedEvent(fastify.db, id, user.id);
      if (!owned) {
        return reply.notFound("Event not found");
      }
      const { event: series, calendar } = owned;
      if (!series.recurrenceRule) {
        return reply.badRequest("Event isn't recurring");
      }
      if (calendar.isReadOnly) {
        return reply.badRequest("Calendar is read-only");
      }

      const originalStart = new Date(start);
      const [previous] = await fastify.db.select().from(events).where(overridesOf(series, originalStart)).limit(1);
      const duration = series.endTime.getTime() - series.startTime.getTime();
      const currentStart = previous?.startTime ?? originalStart;
      const currentEnd = previous?.endTime ?? new Date(originalStart.getTime() + duration);
      const startTime = body.startTime ?? currentStart;
      const endTime = body.endTime ?? currentEnd;
      if (endTime < startTime) {
        return reply.badRequest("Event can't end before it starts");
      }

      const changes = encryptEventFields({
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description || null } : {}),
        ...(body.location !== undefined ? { location: body.location || null } : {}),
        ...(body.isAllDay !== undefined ? { isAllDay: body.isAllDay } : {}),
        ...(body.timeZone !== undefined ? { timeZone: body.timeZone && isValidTimeZone(body.timeZone) ? body.timeZone : null } : {}),
        startTime,
        endTime,
      });
      const metadata = {
        ...(((previous ?? series).metadata as Record<string, unknown>) ?? {}),
        ...(body.metadata ?? {}),
      };

      const [override] = previous
        ? await fastify.db
            .update(events)
            .set({ ...changes, metadata, updatedAt: new Date() })
            .where(eq(events.id, previous.id))
            .returning()
        : await fastify.db
            .insert(events)
            .values({
              // The occurrence as generated from the series (fields stay encrypted)...
              calendarId: series.calendarId,
              externalId: googleInstanceId(series.externalId, originalStart, series.isAllDay),
              title: series.title,
              description: series.description,
              location: series.location,
              isAllDay: series.isAllDay,
              status: series.status,
              timeZone: series.timeZone,
              attendees: series.attendees,
              reminders: series.reminders,
              recurringEventId: series.externalId,
              originalStartTime: originalStart,
              // ...with the requested changes
              ...changes,
              metadata,
            })
            .returning();
      if (!override) {
        return reply.internalServerError("Failed to update occurrence");
      }

      const push = await pushOccurrenceChange(fastify.db, calendar, series, originalStart, override, user.timezone);
      if (push && !push.ok) {
        // Keep OpenFrame and the provider consistent: undo the local change
        if (previous) {
          await fastify.db.update(events).set(previous).where(eq(events.id, previous.id));
        } else {
          await fastify.db.delete(events).where(eq(events.id, override.id));
        }
        return reply.code(502).send({ success: false, error: "sync_failed", message: push.error });
      }

      const [current] = await fastify.db.select().from(events).where(eq(events.id, override.id)).limit(1);
      return {
        success: true,
        data: decryptEventFields(current ?? override),
      };
    }
  );

  // Delete one occurrence of a recurring event (an EXDATE on the series)
  fastify.delete(
    "/:id/occurrences/:start",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Delete one occurrence of a recurring event",
        tags: ["Events"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: occurrenceParams,
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id, start } = request.params as { id: string; start: string };

      const owned = await getOwnedEvent(fastify.db, id, user.id);
      if (!owned) {
        return reply.notFound("Event not found");
      }
      const { event: series, calendar } = owned;
      if (!series.recurrenceRule) {
        return reply.badRequest("Event isn't recurring");
      }
      if (calendar.isReadOnly) {
        return reply.badRequest("Calendar is read-only");
      }

      // Cancel it upstream first: if that fails, nothing changes here
      const originalStart = new Date(start);
      const push = await pushOccurrenceChange(fastify.db, calendar, series, originalStart, null, user.timezone);
      if (push && !push.ok) {
        return reply.code(502).send({ success: false, error: "sync_failed", message: push.error });
      }

      const exdates = [...new Set([...(series.exdates ?? []), originalStart.toISOString()])].sort();
      await fastify.db.update(events).set({ exdates, updatedAt: new Date() }).where(eq(events.id, series.id));
      await fastify.db.delete(events).where(overridesOf(series, originalStart));

      return { success: true };
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

      const [event] = await fastify.db.select().from(events).where(eq(events.id, id)).limit(1);
      if (!event) {
        return reply.notFound("Event not found");
      }

      const calendar = await getOwnedCalendar(fastify.db, event.calendarId, user.id);
      if (!calendar) {
        return reply.notFound("Event not found");
      }
      if (calendar.isReadOnly) {
        return reply.badRequest("Calendar is read-only");
      }

      // Delete upstream first: if that fails, keep the event rather than have
      // it silently reappear on the next full sync
      const push = await pushEventChange(fastify.db, calendar, event, "delete", user.timezone);
      if (push && !push.ok) {
        return reply.code(502).send({ success: false, error: "sync_failed", message: push.error });
      }

      await fastify.db.delete(events).where(eq(events.id, id));
      if (event.recurrenceRule) {
        // The series' changed occurrences go with it
        await fastify.db.delete(events).where(overridesOf(event));
      } else if (event.recurringEventId && event.originalStartTime) {
        // A changed occurrence: without an EXDATE the series would put the
        // original occurrence back
        const [series] = await fastify.db
          .select()
          .from(events)
          .where(and(eq(events.calendarId, event.calendarId), eq(events.externalId, event.recurringEventId)))
          .limit(1);
        if (series?.recurrenceRule) {
          const exdates = [...new Set([...(series.exdates ?? []), event.originalStartTime.toISOString()])].sort();
          await fastify.db.update(events).set({ exdates, updatedAt: new Date() }).where(eq(events.id, series.id));
        }
      }

      return { success: true };
    }
  );
};
