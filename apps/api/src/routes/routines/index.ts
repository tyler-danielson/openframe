import type { FastifyPluginAsync } from "fastify";
import { eq, and, asc } from "drizzle-orm";
import { routines, routineCompletions } from "@openframe/database/schema";

interface CreateRoutineBody {
  title: string;
  icon?: string | null;
  category?: string | null;
  frequency?: "daily" | "weekly" | "custom";
  daysOfWeek?: number[] | null;
  assignedProfileId?: string | null;
}

interface UpdateRoutineBody {
  title?: string;
  icon?: string | null;
  category?: string | null;
  frequency?: "daily" | "weekly" | "custom";
  daysOfWeek?: number[] | null;
  assignedProfileId?: string | null;
  isActive?: boolean;
}

interface ToggleCompleteBody {
  date: string;
  profileId?: string | null;
}

interface ReorderBody {
  routineIds: string[];
}

export const routineRoutes: FastifyPluginAsync = async (fastify) => {
  const { authenticateAny } = fastify;

  // GET /api/v1/routines - List routines with completions for a date
  fastify.get(
    "/",
    {
      preHandler: [authenticateAny],
      schema: {
        description: "List all routines with completions for a given date",
        tags: ["Routines"],
        querystring: {
          type: "object",
          properties: {
            date: { type: "string", description: "YYYY-MM-DD format, defaults to today" },
          },
        },
      },
    },
    async (request) => {
      const user = (request as any).user;
      if (!user?.userId) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const query = request.query as { date?: string };
      const dateStr: string = query.date || new Date().toISOString().split("T")[0]!;

      // Get all active routines for the user
      const userRoutines = await fastify.db
        .select()
        .from(routines)
        .where(and(eq(routines.userId, user.userId), eq(routines.isActive, true)))
        .orderBy(asc(routines.sortOrder), asc(routines.createdAt));

      // Get completions for the given date
      const completions = await fastify.db
        .select()
        .from(routineCompletions)
        .where(eq(routineCompletions.completedDate, dateStr));

      // Build routine IDs set for filtering completions
      const routineIds = new Set(userRoutines.map((r) => r.id));

      // Map completions to routines
      const routineCompletionMap = new Map<string, typeof completions>();
      for (const c of completions) {
        if (!routineIds.has(c.routineId)) continue;
        const existing = routineCompletionMap.get(c.routineId) || [];
        existing.push(c);
        routineCompletionMap.set(c.routineId, existing);
      }

      const data = userRoutines.map((routine) => {
        const routineCompls = routineCompletionMap.get(routine.id) || [];
        return {
          ...routine,
          completions: routineCompls,
          isCompletedToday: routineCompls.length > 0,
        };
      });

      return { success: true, data };
    }
  );

  // POST /api/v1/routines - Create routine
  fastify.post<{ Body: CreateRoutineBody }>(
    "/",
    {
      preHandler: [authenticateAny],
      schema: {
        description: "Create a new routine",
        tags: ["Routines"],
        body: {
          type: "object",
          properties: {
            title: { type: "string" },
            icon: { type: ["string", "null"] },
            category: { type: ["string", "null"] },
            frequency: { type: "string", enum: ["daily", "weekly", "custom"] },
            daysOfWeek: { type: ["array", "null"], items: { type: "number" } },
            assignedProfileId: { type: ["string", "null"] },
          },
          required: ["title"],
        },
      },
    },
    async (request) => {
      const user = (request as any).user;
      if (!user?.userId) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const body = request.body;

      // Get max sort order
      const existing = await fastify.db
        .select({ sortOrder: routines.sortOrder })
        .from(routines)
        .where(eq(routines.userId, user.userId))
        .orderBy(asc(routines.sortOrder));

      const maxSort = existing.length > 0
        ? Math.max(...existing.map((r) => r.sortOrder))
        : -1;

      const [routine] = await fastify.db
        .insert(routines)
        .values({
          userId: user.userId,
          title: body.title,
          icon: body.icon ?? null,
          category: body.category ?? null,
          frequency: body.frequency ?? "daily",
          daysOfWeek: body.daysOfWeek ?? null,
          assignedProfileId: body.assignedProfileId ?? null,
          sortOrder: maxSort + 1,
        })
        .returning();

      return { success: true, data: routine };
    }
  );

  // PATCH /api/v1/routines/reorder - Reorder routines (must be before /:id)
  fastify.patch<{ Body: ReorderBody }>(
    "/reorder",
    {
      preHandler: [authenticateAny],
      schema: {
        description: "Reorder routines",
        tags: ["Routines"],
        body: {
          type: "object",
          properties: {
            routineIds: { type: "array", items: { type: "string" } },
          },
          required: ["routineIds"],
        },
      },
    },
    async (request) => {
      const user = (request as any).user;
      if (!user?.userId) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const { routineIds } = request.body;

      // Update sort orders
      for (let i = 0; i < routineIds.length; i++) {
        const routineId = routineIds[i]!;
        await fastify.db
          .update(routines)
          .set({ sortOrder: i, updatedAt: new Date() })
          .where(and(eq(routines.id, routineId), eq(routines.userId, user.userId)));
      }

      return { success: true };
    }
  );

  // PATCH /api/v1/routines/:id - Update routine
  fastify.patch<{ Params: { id: string }; Body: UpdateRoutineBody }>(
    "/:id",
    {
      preHandler: [authenticateAny],
      schema: {
        description: "Update a routine",
        tags: ["Routines"],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            title: { type: "string" },
            icon: { type: ["string", "null"] },
            category: { type: ["string", "null"] },
            frequency: { type: "string", enum: ["daily", "weekly", "custom"] },
            daysOfWeek: { type: ["array", "null"], items: { type: "number" } },
            assignedProfileId: { type: ["string", "null"] },
            isActive: { type: "boolean" },
          },
        },
      },
    },
    async (request) => {
      const user = (request as any).user;
      if (!user?.userId) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const { id } = request.params;
      const body = request.body;

      // Check ownership
      const [existing] = await fastify.db
        .select()
        .from(routines)
        .where(and(eq(routines.id, id), eq(routines.userId, user.userId)))
        .limit(1);

      if (!existing) {
        throw fastify.httpErrors.notFound("Routine not found");
      }

      const [updated] = await fastify.db
        .update(routines)
        .set({
          ...body,
          updatedAt: new Date(),
        })
        .where(eq(routines.id, id))
        .returning();

      return { success: true, data: updated };
    }
  );

  // DELETE /api/v1/routines/:id - Delete routine
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    {
      preHandler: [authenticateAny],
      schema: {
        description: "Delete a routine",
        tags: ["Routines"],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
      },
    },
    async (request) => {
      const user = (request as any).user;
      if (!user?.userId) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const { id } = request.params;

      const [existing] = await fastify.db
        .select()
        .from(routines)
        .where(and(eq(routines.id, id), eq(routines.userId, user.userId)))
        .limit(1);

      if (!existing) {
        throw fastify.httpErrors.notFound("Routine not found");
      }

      await fastify.db.delete(routines).where(eq(routines.id, id));

      return { success: true, message: "Routine deleted" };
    }
  );

  // POST /api/v1/routines/:id/complete - Toggle completion
  fastify.post<{ Params: { id: string }; Body: ToggleCompleteBody }>(
    "/:id/complete",
    {
      preHandler: [authenticateAny],
      schema: {
        description: "Toggle routine completion for a date",
        tags: ["Routines"],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            date: { type: "string" },
            profileId: { type: ["string", "null"] },
          },
          required: ["date"],
        },
      },
    },
    async (request) => {
      const user = (request as any).user;
      if (!user?.userId) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const { id } = request.params;
      const { date, profileId } = request.body;

      // Check ownership
      const [routine] = await fastify.db
        .select()
        .from(routines)
        .where(and(eq(routines.id, id), eq(routines.userId, user.userId)))
        .limit(1);

      if (!routine) {
        throw fastify.httpErrors.notFound("Routine not found");
      }

      // Check if completion exists
      const conditions = [
        eq(routineCompletions.routineId, id),
        eq(routineCompletions.completedDate, date),
      ];

      if (profileId) {
        conditions.push(eq(routineCompletions.completedByProfileId, profileId));
      }

      const existing = await fastify.db
        .select()
        .from(routineCompletions)
        .where(and(...conditions))
        .limit(1);

      if (existing.length > 0) {
        // Remove completion (toggle off)
        await fastify.db
          .delete(routineCompletions)
          .where(eq(routineCompletions.id, existing[0]!.id));

        return { success: true, data: { completed: false } };
      } else {
        // Add completion (toggle on)
        await fastify.db.insert(routineCompletions).values({
          routineId: id,
          completedDate: date,
          completedByProfileId: profileId ?? null,
        });

        return { success: true, data: { completed: true } };
      }
    }
  );
};
