import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import {
  users,
  companionAccess,
  calendars,
  events,
  taskLists,
  tasks,
} from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";

interface CompanionContext {
  ownerId: string;
  permissions: {
    accessCalendar: string;
    accessTasks: string;
    allowedCalendarIds: string[] | null;
    allowedTaskListIds: string[] | null;
  } | null; // null = full access (owner)
}

async function resolveCompanionContext(
  request: FastifyRequest,
  db: any
): Promise<CompanionContext | null> {
  const user = await getCurrentUser(request);
  if (!user) return null;

  // Owner (admin) gets full access to their own data
  if (user.role === "admin") {
    return { ownerId: user.id, permissions: null };
  }

  // Look up companion_access for this user
  const [access] = await db
    .select()
    .from(companionAccess)
    .where(
      and(
        eq(companionAccess.userId, user.id),
        eq(companionAccess.isActive, true)
      )
    )
    .limit(1);

  if (!access) return null;

  return {
    ownerId: access.ownerId,
    permissions: {
      accessCalendar: access.accessCalendar,
      accessTasks: access.accessTasks,
      allowedCalendarIds: access.allowedCalendarIds,
      allowedTaskListIds: access.allowedTaskListIds,
    },
  };
}

export const companionDataRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /calendars — Owner's calendars, filtered by allowedCalendarIds
  fastify.get(
    "/calendars",
    { onRequest: [fastify.authenticateAny] },
    async (request, reply) => {
      const ctx = await resolveCompanionContext(request, fastify.db);
      if (!ctx) return reply.forbidden("No companion access");

      if (ctx.permissions && ctx.permissions.accessCalendar === "none") {
        return { success: true, data: [] };
      }

      let result = await fastify.db
        .select()
        .from(calendars)
        .where(eq(calendars.userId, ctx.ownerId));

      // Filter by allowed calendars if scoped
      if (ctx.permissions?.allowedCalendarIds) {
        const allowed = new Set(ctx.permissions.allowedCalendarIds);
        result = result.filter((c) => allowed.has(c.id));
      }

      return { success: true, data: result };
    }
  );

  // GET /events — Owner's events, filtered
  fastify.get(
    "/events",
    { onRequest: [fastify.authenticateAny] },
    async (request, reply) => {
      const ctx = await resolveCompanionContext(request, fastify.db);
      if (!ctx) return reply.forbidden("No companion access");

      if (ctx.permissions && ctx.permissions.accessCalendar === "none") {
        return { success: true, data: [] };
      }

      const query = request.query as { start?: string; end?: string };
      if (!query.start || !query.end) {
        return reply.badRequest("start and end query params required");
      }

      const start = new Date(query.start);
      const end = new Date(query.end);

      // Get owner's calendar IDs (filtered by allowed)
      let ownerCalendars = await fastify.db
        .select({ id: calendars.id, color: calendars.color, name: calendars.name })
        .from(calendars)
        .where(eq(calendars.userId, ctx.ownerId));

      if (ctx.permissions?.allowedCalendarIds) {
        const allowed = new Set(ctx.permissions.allowedCalendarIds);
        ownerCalendars = ownerCalendars.filter((c) => allowed.has(c.id));
      }

      if (ownerCalendars.length === 0) {
        return { success: true, data: [] };
      }

      const calendarIds = ownerCalendars.map((c) => c.id);
      const calendarMap = new Map(ownerCalendars.map((c) => [c.id, c]));

      const result = await fastify.db
        .select()
        .from(events)
        .where(
          and(
            inArray(events.calendarId, calendarIds),
            lte(events.startTime, end),
            gte(events.endTime, start)
          )
        );

      // Add calendar color/name to each event
      const enriched = result.map((e) => ({
        ...e,
        calendarColor: calendarMap.get(e.calendarId)?.color || null,
        calendarName: calendarMap.get(e.calendarId)?.name || null,
      }));

      return { success: true, data: enriched };
    }
  );

  // POST /events — Create event (requires edit)
  fastify.post(
    "/events",
    { onRequest: [fastify.authenticateAny] },
    async (request, reply) => {
      const ctx = await resolveCompanionContext(request, fastify.db);
      if (!ctx) return reply.forbidden("No companion access");

      if (ctx.permissions && ctx.permissions.accessCalendar !== "edit") {
        return reply.forbidden("Calendar edit access required");
      }

      const body = request.body as {
        calendarId: string;
        title: string;
        startTime: string;
        endTime: string;
        isAllDay?: boolean;
        location?: string;
        description?: string;
      };

      // Verify calendar belongs to owner
      const [cal] = await fastify.db
        .select()
        .from(calendars)
        .where(
          and(eq(calendars.id, body.calendarId), eq(calendars.userId, ctx.ownerId))
        )
        .limit(1);

      if (!cal) {
        return reply.notFound("Calendar not found");
      }

      // Check allowed calendars
      if (ctx.permissions?.allowedCalendarIds && !ctx.permissions.allowedCalendarIds.includes(body.calendarId)) {
        return reply.forbidden("Access to this calendar is not allowed");
      }

      const [created] = await fastify.db
        .insert(events)
        .values({
          calendarId: body.calendarId,
          externalId: `companion-${Date.now()}`,
          title: body.title,
          startTime: new Date(body.startTime),
          endTime: new Date(body.endTime),
          isAllDay: body.isAllDay ?? false,
          location: body.location || null,
          description: body.description || null,
        })
        .returning();

      return reply.status(201).send({ success: true, data: created });
    }
  );

  // PATCH /events/:id — Update event (requires edit)
  fastify.patch(
    "/events/:id",
    { onRequest: [fastify.authenticateAny] },
    async (request, reply) => {
      const ctx = await resolveCompanionContext(request, fastify.db);
      if (!ctx) return reply.forbidden("No companion access");

      if (ctx.permissions && ctx.permissions.accessCalendar !== "edit") {
        return reply.forbidden("Calendar edit access required");
      }

      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;

      // Verify event belongs to owner's calendars
      const [event] = await fastify.db
        .select()
        .from(events)
        .where(eq(events.id, id))
        .limit(1);

      if (!event) return reply.notFound("Event not found");

      const [cal] = await fastify.db
        .select()
        .from(calendars)
        .where(
          and(eq(calendars.id, event.calendarId), eq(calendars.userId, ctx.ownerId))
        )
        .limit(1);

      if (!cal) return reply.notFound("Event not found");

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (body.title !== undefined) updates.title = body.title;
      if (body.startTime !== undefined) updates.startTime = new Date(body.startTime as string);
      if (body.endTime !== undefined) updates.endTime = new Date(body.endTime as string);
      if (body.isAllDay !== undefined) updates.isAllDay = body.isAllDay;
      if (body.location !== undefined) updates.location = body.location;
      if (body.description !== undefined) updates.description = body.description;

      const [updated] = await fastify.db
        .update(events)
        .set(updates)
        .where(eq(events.id, id))
        .returning();

      return { success: true, data: updated };
    }
  );

  // DELETE /events/:id — Delete event (requires edit)
  fastify.delete(
    "/events/:id",
    { onRequest: [fastify.authenticateAny] },
    async (request, reply) => {
      const ctx = await resolveCompanionContext(request, fastify.db);
      if (!ctx) return reply.forbidden("No companion access");

      if (ctx.permissions && ctx.permissions.accessCalendar !== "edit") {
        return reply.forbidden("Calendar edit access required");
      }

      const { id } = request.params as { id: string };

      // Verify event belongs to owner
      const [event] = await fastify.db
        .select()
        .from(events)
        .where(eq(events.id, id))
        .limit(1);

      if (!event) return reply.notFound("Event not found");

      const [cal] = await fastify.db
        .select()
        .from(calendars)
        .where(
          and(eq(calendars.id, event.calendarId), eq(calendars.userId, ctx.ownerId))
        )
        .limit(1);

      if (!cal) return reply.notFound("Event not found");

      await fastify.db.delete(events).where(eq(events.id, id));

      return { success: true };
    }
  );

  // GET /task-lists — Owner's task lists, filtered
  fastify.get(
    "/task-lists",
    { onRequest: [fastify.authenticateAny] },
    async (request, reply) => {
      const ctx = await resolveCompanionContext(request, fastify.db);
      if (!ctx) return reply.forbidden("No companion access");

      if (ctx.permissions && ctx.permissions.accessTasks === "none") {
        return { success: true, data: [] };
      }

      let result = await fastify.db
        .select()
        .from(taskLists)
        .where(eq(taskLists.userId, ctx.ownerId));

      if (ctx.permissions?.allowedTaskListIds) {
        const allowed = new Set(ctx.permissions.allowedTaskListIds);
        result = result.filter((tl) => allowed.has(tl.id));
      }

      return { success: true, data: result };
    }
  );

  // GET /tasks — Owner's tasks, filtered
  fastify.get(
    "/tasks",
    { onRequest: [fastify.authenticateAny] },
    async (request, reply) => {
      const ctx = await resolveCompanionContext(request, fastify.db);
      if (!ctx) return reply.forbidden("No companion access");

      if (ctx.permissions && ctx.permissions.accessTasks === "none") {
        return { success: true, data: [] };
      }

      const query = request.query as { listId?: string; status?: string };

      // Get owner's task lists (filtered)
      let ownerLists = await fastify.db
        .select()
        .from(taskLists)
        .where(eq(taskLists.userId, ctx.ownerId));

      if (ctx.permissions?.allowedTaskListIds) {
        const allowed = new Set(ctx.permissions.allowedTaskListIds);
        ownerLists = ownerLists.filter((tl) => allowed.has(tl.id));
      }

      if (ownerLists.length === 0) {
        return { success: true, data: [] };
      }

      let listIds = ownerLists.map((l) => l.id);

      // If a specific listId is requested, filter further
      if (query.listId) {
        if (!listIds.includes(query.listId)) {
          return { success: true, data: [] };
        }
        listIds = [query.listId];
      }

      const conditions = [inArray(tasks.taskListId, listIds)];

      if (query.status === "needsAction") {
        conditions.push(eq(tasks.status, "needsAction"));
      } else if (query.status === "completed") {
        conditions.push(eq(tasks.status, "completed"));
      }

      const result = await fastify.db
        .select()
        .from(tasks)
        .where(and(...conditions));

      return { success: true, data: result };
    }
  );

  // POST /tasks — Create task (requires edit)
  fastify.post(
    "/tasks",
    { onRequest: [fastify.authenticateAny] },
    async (request, reply) => {
      const ctx = await resolveCompanionContext(request, fastify.db);
      if (!ctx) return reply.forbidden("No companion access");

      if (ctx.permissions && ctx.permissions.accessTasks !== "edit") {
        return reply.forbidden("Task edit access required");
      }

      const body = request.body as {
        taskListId: string;
        title: string;
        notes?: string;
        dueDate?: string;
      };

      // Verify task list belongs to owner
      const [list] = await fastify.db
        .select()
        .from(taskLists)
        .where(
          and(eq(taskLists.id, body.taskListId), eq(taskLists.userId, ctx.ownerId))
        )
        .limit(1);

      if (!list) return reply.notFound("Task list not found");

      if (ctx.permissions?.allowedTaskListIds && !ctx.permissions.allowedTaskListIds.includes(body.taskListId)) {
        return reply.forbidden("Access to this task list is not allowed");
      }

      const [created] = await fastify.db
        .insert(tasks)
        .values({
          taskListId: body.taskListId,
          externalId: `companion-${Date.now()}`,
          title: body.title,
          notes: body.notes || null,
          dueDate: body.dueDate ? new Date(body.dueDate) : null,
        })
        .returning();

      return reply.status(201).send({ success: true, data: created });
    }
  );

  // PATCH /tasks/:id — Update task (requires edit)
  fastify.patch(
    "/tasks/:id",
    { onRequest: [fastify.authenticateAny] },
    async (request, reply) => {
      const ctx = await resolveCompanionContext(request, fastify.db);
      if (!ctx) return reply.forbidden("No companion access");

      if (ctx.permissions && ctx.permissions.accessTasks !== "edit") {
        return reply.forbidden("Task edit access required");
      }

      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;

      // Verify task belongs to owner's task lists
      const [task] = await fastify.db
        .select()
        .from(tasks)
        .where(eq(tasks.id, id))
        .limit(1);

      if (!task) return reply.notFound("Task not found");

      const [list] = await fastify.db
        .select()
        .from(taskLists)
        .where(
          and(eq(taskLists.id, task.taskListId), eq(taskLists.userId, ctx.ownerId))
        )
        .limit(1);

      if (!list) return reply.notFound("Task not found");

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (body.title !== undefined) updates.title = body.title;
      if (body.notes !== undefined) updates.notes = body.notes;
      if (body.status !== undefined) {
        updates.status = body.status;
        if (body.status === "completed") {
          updates.completedAt = new Date();
        } else {
          updates.completedAt = null;
        }
      }
      if (body.dueDate !== undefined) {
        updates.dueDate = body.dueDate ? new Date(body.dueDate as string) : null;
      }

      const [updated] = await fastify.db
        .update(tasks)
        .set(updates)
        .where(eq(tasks.id, id))
        .returning();

      return { success: true, data: updated };
    }
  );

  // DELETE /tasks/:id — Delete task (requires edit)
  fastify.delete(
    "/tasks/:id",
    { onRequest: [fastify.authenticateAny] },
    async (request, reply) => {
      const ctx = await resolveCompanionContext(request, fastify.db);
      if (!ctx) return reply.forbidden("No companion access");

      if (ctx.permissions && ctx.permissions.accessTasks !== "edit") {
        return reply.forbidden("Task edit access required");
      }

      const { id } = request.params as { id: string };

      // Verify task belongs to owner
      const [task] = await fastify.db
        .select()
        .from(tasks)
        .where(eq(tasks.id, id))
        .limit(1);

      if (!task) return reply.notFound("Task not found");

      const [list] = await fastify.db
        .select()
        .from(taskLists)
        .where(
          and(eq(taskLists.id, task.taskListId), eq(taskLists.userId, ctx.ownerId))
        )
        .limit(1);

      if (!list) return reply.notFound("Task not found");

      await fastify.db.delete(tasks).where(eq(tasks.id, id));

      return { success: true };
    }
  );
};
