import type { FastifyPluginAsync } from "fastify";
import { eq, and, desc, asc, gte, lte } from "drizzle-orm";
import {
  habits,
  habitCompletions,
  familyProfiles,
} from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";
import {
  calculateStreak,
  awardPoints,
  awardStreakBonus,
  evaluateBadges,
  POINT_VALUES,
} from "../../services/gamification.js";

export const habitRoutes: FastifyPluginAsync = async (fastify) => {
  // List habits
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "List habits for user",
        tags: ["Habits"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const { profileId, shared } = request.query as {
        profileId?: string;
        shared?: string;
      };

      const conditions = [eq(habits.userId, user.id), eq(habits.isActive, true)];
      if (profileId) conditions.push(eq(habits.profileId, profileId));

      const allHabits = await fastify.db
        .select()
        .from(habits)
        .where(and(...conditions))
        .orderBy(asc(habits.sortOrder), asc(habits.name));

      // Get completions for the last 7 days
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString().slice(0, 10);

      const recentCompletions = await fastify.db
        .select()
        .from(habitCompletions)
        .where(
          and(
            gte(habitCompletions.completedDate, weekAgoStr),
            eq(habitCompletions.habitId, allHabits[0]?.id ?? "00000000-0000-0000-0000-000000000000")
          )
        );

      // Fetch completions for all habits in one go
      const habitIds = allHabits.map((h) => h.id);
      let allCompletions: typeof recentCompletions = [];
      if (habitIds.length > 0) {
        allCompletions = await fastify.db
          .select()
          .from(habitCompletions)
          .where(gte(habitCompletions.completedDate, weekAgoStr));

        // Filter to only our habits
        allCompletions = allCompletions.filter((c) =>
          habitIds.includes(c.habitId)
        );
      }

      // Calculate streaks for each habit
      const habitsWithData = await Promise.all(
        allHabits.map(async (habit) => {
          const completions = allCompletions.filter(
            (c) => c.habitId === habit.id
          );
          const effectiveProfileId =
            habit.profileId ?? user.id; // Use userId as fallback

          // For streak, we need the actual profile associated with the habit
          let streak = { current: 0, longest: 0 };
          if (habit.profileId) {
            streak = await calculateStreak(
              fastify.db,
              habit.id,
              habit.profileId
            );
          }

          return {
            ...habit,
            completions,
            streak,
          };
        })
      );

      return { success: true, data: habitsWithData };
    }
  );

  // Create habit
  fastify.post(
    "/",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Create a new habit",
        tags: ["Habits"],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const body = request.body as {
        name: string;
        icon?: string;
        color?: string;
        frequency?: string;
        targetDays?: number[];
        targetCount?: number;
        profileId?: string;
        isShared?: boolean;
      };

      const [habit] = await fastify.db
        .insert(habits)
        .values({
          userId: user.id,
          name: body.name,
          icon: body.icon ?? null,
          color: body.color ?? null,
          frequency: (body.frequency as any) ?? "daily",
          targetDays: body.targetDays ?? [],
          targetCount: body.targetCount ?? 1,
          profileId: body.profileId ?? null,
          isShared: body.isShared ?? false,
        })
        .returning();

      return reply.status(201).send({ success: true, data: habit });
    }
  );

  // Update habit
  fastify.patch(
    "/:id",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Update a habit",
        tags: ["Habits"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const { id } = request.params as { id: string };
      const body = request.body as Partial<{
        name: string;
        icon: string;
        color: string;
        frequency: string;
        targetDays: number[];
        targetCount: number;
        profileId: string;
        isShared: boolean;
        isActive: boolean;
        sortOrder: number;
      }>;

      const updates: Record<string, any> = { updatedAt: new Date() };
      if (body.name !== undefined) updates.name = body.name;
      if (body.icon !== undefined) updates.icon = body.icon;
      if (body.color !== undefined) updates.color = body.color;
      if (body.frequency !== undefined) updates.frequency = body.frequency;
      if (body.targetDays !== undefined) updates.targetDays = body.targetDays;
      if (body.targetCount !== undefined) updates.targetCount = body.targetCount;
      if (body.profileId !== undefined) updates.profileId = body.profileId;
      if (body.isShared !== undefined) updates.isShared = body.isShared;
      if (body.isActive !== undefined) updates.isActive = body.isActive;
      if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;

      const [updated] = await fastify.db
        .update(habits)
        .set(updates)
        .where(and(eq(habits.id, id), eq(habits.userId, user.id)))
        .returning();

      if (!updated) throw fastify.httpErrors.notFound("Habit not found");
      return { success: true, data: updated };
    }
  );

  // Delete habit
  fastify.delete(
    "/:id",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Delete a habit",
        tags: ["Habits"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const { id } = request.params as { id: string };

      await fastify.db
        .delete(habits)
        .where(and(eq(habits.id, id), eq(habits.userId, user.id)));

      return { success: true };
    }
  );

  // Complete habit for today
  fastify.post(
    "/:id/complete",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Mark habit complete for a day",
        tags: ["Habits"],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const { id } = request.params as { id: string };
      const body = request.body as {
        profileId?: string;
        date?: string;
        value?: string;
        notes?: string;
      };

      // Verify habit belongs to user
      const [habit] = await fastify.db
        .select()
        .from(habits)
        .where(and(eq(habits.id, id), eq(habits.userId, user.id)));

      if (!habit) throw fastify.httpErrors.notFound("Habit not found");

      const profileId = body.profileId ?? habit.profileId;
      if (!profileId)
        throw fastify.httpErrors.badRequest(
          "profileId required for habits without a default profile"
        );

      const completedDate = body.date ?? new Date().toISOString().slice(0, 10);

      const [completion] = await fastify.db
        .insert(habitCompletions)
        .values({
          habitId: id,
          profileId,
          completedDate,
          value: body.value ?? null,
          notes: body.notes ?? null,
        })
        .onConflictDoNothing()
        .returning();

      if (!completion) {
        // Already completed today
        return { success: true, data: { alreadyCompleted: true } };
      }

      // Award points
      let pointsEarned = POINT_VALUES.habit_completion;
      await awardPoints(
        fastify.db,
        user.id,
        profileId,
        POINT_VALUES.habit_completion,
        "habit_completion",
        id
      );

      // Check streak and award bonus
      const streak = await calculateStreak(fastify.db, id, profileId);
      const streakBonus = await awardStreakBonus(
        fastify.db,
        user.id,
        profileId,
        streak.current,
        id
      );
      pointsEarned += streakBonus;

      // Evaluate badges
      const newBadges = await evaluateBadges(fastify.db, user.id, profileId, {
        currentMaxStreak: streak.current,
      });

      return reply.status(201).send({
        success: true,
        data: {
          completion,
          streak,
          newBadges,
          pointsEarned,
        },
      });
    }
  );

  // Undo completion
  fastify.delete(
    "/:id/complete/:date",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Undo a habit completion for a date",
        tags: ["Habits"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const { id, date } = request.params as { id: string; date: string };
      const { profileId } = request.query as { profileId?: string };

      // Verify habit belongs to user
      const [habit] = await fastify.db
        .select()
        .from(habits)
        .where(and(eq(habits.id, id), eq(habits.userId, user.id)));

      if (!habit) throw fastify.httpErrors.notFound("Habit not found");

      const conditions = [
        eq(habitCompletions.habitId, id),
        eq(habitCompletions.completedDate, date),
      ];
      if (profileId) {
        conditions.push(eq(habitCompletions.profileId, profileId));
      }

      await fastify.db
        .delete(habitCompletions)
        .where(and(...conditions));

      return { success: true };
    }
  );

  // Get habit history
  fastify.get(
    "/:id/history",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get completion history for a habit",
        tags: ["Habits"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const { id } = request.params as { id: string };
      const { startDate, endDate } = request.query as {
        startDate?: string;
        endDate?: string;
      };

      const conditions = [eq(habitCompletions.habitId, id)];
      if (startDate)
        conditions.push(gte(habitCompletions.completedDate, startDate));
      if (endDate)
        conditions.push(lte(habitCompletions.completedDate, endDate));

      const completions = await fastify.db
        .select()
        .from(habitCompletions)
        .where(and(...conditions))
        .orderBy(desc(habitCompletions.completedDate));

      return { success: true, data: completions };
    }
  );

  // Get streaks for all habits
  fastify.get(
    "/streaks",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get current streaks for all habits",
        tags: ["Habits"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const { profileId } = request.query as { profileId?: string };

      const userHabits = await fastify.db
        .select()
        .from(habits)
        .where(and(eq(habits.userId, user.id), eq(habits.isActive, true)));

      const streaks = await Promise.all(
        userHabits.map(async (habit) => {
          const effectiveProfileId = profileId ?? habit.profileId;
          if (!effectiveProfileId) return { habitId: habit.id, current: 0, longest: 0 };

          const streak = await calculateStreak(
            fastify.db,
            habit.id,
            effectiveProfileId
          );
          return { habitId: habit.id, ...streak };
        })
      );

      return { success: true, data: streaks };
    }
  );
};
