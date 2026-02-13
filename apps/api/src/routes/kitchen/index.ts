import type { FastifyPluginAsync } from "fastify";
import { eq, and, desc, inArray } from "drizzle-orm";
import {
  kitchenTimerPresets,
  kitchenActiveTimers,
} from "@openframe/database/schema";

export const kitchenRoutes: FastifyPluginAsync = async (fastify) => {
  // ============ Timer Presets ============

  // GET /timers/presets - List user's saved presets
  fastify.get(
    "/timers/presets",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const user = (request as any).user;
      if (!user?.id) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const presets = await fastify.db
        .select()
        .from(kitchenTimerPresets)
        .where(eq(kitchenTimerPresets.userId, user.id))
        .orderBy(desc(kitchenTimerPresets.createdAt));

      return presets;
    }
  );

  // POST /timers/presets - Create a preset
  fastify.post(
    "/timers/presets",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const user = (request as any).user;
      if (!user?.id) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const { name, durationSeconds, recipeId } = request.body as {
        name: string;
        durationSeconds: number;
        recipeId?: string | null;
      };

      if (!name || !durationSeconds || durationSeconds <= 0) {
        throw fastify.httpErrors.badRequest(
          "name and durationSeconds (> 0) are required"
        );
      }

      const [preset] = await fastify.db
        .insert(kitchenTimerPresets)
        .values({
          userId: user.id,
          name,
          durationSeconds,
          recipeId: recipeId || null,
        })
        .returning();

      return preset;
    }
  );

  // DELETE /timers/presets/:id - Delete a preset
  fastify.delete(
    "/timers/presets/:id",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const user = (request as any).user;
      if (!user?.id) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const { id } = request.params as { id: string };

      const deleted = await fastify.db
        .delete(kitchenTimerPresets)
        .where(
          and(
            eq(kitchenTimerPresets.id, id),
            eq(kitchenTimerPresets.userId, user.id)
          )
        )
        .returning();

      if (deleted.length === 0) {
        throw fastify.httpErrors.notFound("Preset not found");
      }

      reply.status(204).send();
    }
  );

  // ============ Active Timers ============

  // Helper: compute real remaining seconds for a running timer
  function computeRemaining(timer: {
    status: string;
    durationSeconds: number;
    remainingSeconds: number;
    startedAt: Date;
    pausedAt: Date | null;
  }): number {
    if (timer.status === "paused" || timer.status === "completed" || timer.status === "cancelled") {
      return timer.remainingSeconds;
    }
    // Running: calculate based on elapsed time since last resume
    const now = Date.now();
    const startTime = new Date(timer.startedAt).getTime();
    const elapsed = Math.floor((now - startTime) / 1000);
    return Math.max(0, timer.durationSeconds - elapsed);
  }

  // GET /timers/active - List active timers with computed remaining
  fastify.get(
    "/timers/active",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const user = (request as any).user;
      if (!user?.id) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const timers = await fastify.db
        .select()
        .from(kitchenActiveTimers)
        .where(eq(kitchenActiveTimers.userId, user.id))
        .orderBy(desc(kitchenActiveTimers.createdAt));

      // Compute real remaining for running timers, auto-complete expired ones
      const completedIds: string[] = [];
      const result = timers.map((timer) => {
        const remaining = computeRemaining(timer);
        if (timer.status === "running" && remaining <= 0) {
          completedIds.push(timer.id);
          return {
            ...timer,
            remainingSeconds: 0,
            status: "completed" as const,
            completedAt: new Date(),
          };
        }
        return { ...timer, remainingSeconds: remaining };
      });

      // Batch-update any auto-completed timers
      if (completedIds.length > 0) {
        await fastify.db
          .update(kitchenActiveTimers)
          .set({
            status: "completed",
            remainingSeconds: 0,
            completedAt: new Date(),
          })
          .where(inArray(kitchenActiveTimers.id, completedIds));
      }

      return result;
    }
  );

  // POST /timers/active - Start a new timer
  fastify.post(
    "/timers/active",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const user = (request as any).user;
      if (!user?.id) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const { name, durationSeconds, presetId } = request.body as {
        name: string;
        durationSeconds: number;
        presetId?: string | null;
      };

      if (!name || !durationSeconds || durationSeconds <= 0) {
        throw fastify.httpErrors.badRequest(
          "name and durationSeconds (> 0) are required"
        );
      }

      const [timer] = await fastify.db
        .insert(kitchenActiveTimers)
        .values({
          userId: user.id,
          presetId: presetId || null,
          name,
          durationSeconds,
          remainingSeconds: durationSeconds,
          status: "running",
          startedAt: new Date(),
        })
        .returning();

      return timer;
    }
  );

  // PATCH /timers/active/:id - Pause / Resume / Cancel
  fastify.patch(
    "/timers/active/:id",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const user = (request as any).user;
      if (!user?.id) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const { id } = request.params as { id: string };
      const { action } = request.body as {
        action: "pause" | "resume" | "cancel";
      };

      // Fetch current timer
      const [timer] = await fastify.db
        .select()
        .from(kitchenActiveTimers)
        .where(
          and(
            eq(kitchenActiveTimers.id, id),
            eq(kitchenActiveTimers.userId, user.id)
          )
        );

      if (!timer) {
        throw fastify.httpErrors.notFound("Timer not found");
      }

      if (action === "pause" && timer.status === "running") {
        const remaining = computeRemaining(timer);
        const [updated] = await fastify.db
          .update(kitchenActiveTimers)
          .set({
            status: "paused",
            remainingSeconds: remaining,
            pausedAt: new Date(),
          })
          .where(eq(kitchenActiveTimers.id, id))
          .returning();
        return updated;
      }

      if (action === "resume" && timer.status === "paused") {
        // Set startedAt to now offset by already-elapsed time so computeRemaining works
        const now = new Date();
        const elapsedBeforePause = timer.durationSeconds - timer.remainingSeconds;
        const newStartedAt = new Date(now.getTime() - elapsedBeforePause * 1000);

        const [updated] = await fastify.db
          .update(kitchenActiveTimers)
          .set({
            status: "running",
            startedAt: newStartedAt,
            pausedAt: null,
          })
          .where(eq(kitchenActiveTimers.id, id))
          .returning();
        return updated;
      }

      if (action === "cancel") {
        const remaining = computeRemaining(timer);
        const [updated] = await fastify.db
          .update(kitchenActiveTimers)
          .set({
            status: "cancelled",
            remainingSeconds: remaining,
            completedAt: new Date(),
          })
          .where(eq(kitchenActiveTimers.id, id))
          .returning();
        return updated;
      }

      throw fastify.httpErrors.badRequest(
        `Cannot ${action} a timer with status "${timer.status}"`
      );
    }
  );

  // POST /timers/active/:id/complete - Mark completed (client calls when countdown hits 0)
  fastify.post(
    "/timers/active/:id/complete",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const user = (request as any).user;
      if (!user?.id) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const { id } = request.params as { id: string };

      const [updated] = await fastify.db
        .update(kitchenActiveTimers)
        .set({
          status: "completed",
          remainingSeconds: 0,
          completedAt: new Date(),
        })
        .where(
          and(
            eq(kitchenActiveTimers.id, id),
            eq(kitchenActiveTimers.userId, user.id)
          )
        )
        .returning();

      if (!updated) {
        throw fastify.httpErrors.notFound("Timer not found");
      }

      return updated;
    }
  );

  // DELETE /timers/active/:id - Dismiss a timer
  fastify.delete(
    "/timers/active/:id",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const user = (request as any).user;
      if (!user?.id) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const { id } = request.params as { id: string };

      const deleted = await fastify.db
        .delete(kitchenActiveTimers)
        .where(
          and(
            eq(kitchenActiveTimers.id, id),
            eq(kitchenActiveTimers.userId, user.id)
          )
        )
        .returning();

      if (deleted.length === 0) {
        throw fastify.httpErrors.notFound("Timer not found");
      }

      reply.status(204).send();
    }
  );
};
