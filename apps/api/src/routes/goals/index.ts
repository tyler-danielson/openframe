import type { FastifyPluginAsync } from "fastify";
import { eq, and, desc, asc, isNull, isNotNull, inArray } from "drizzle-orm";
import { goals, goalProgress } from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";
import { profilesOwnedBy } from "../../lib/profile-access.js";
import {
  awardPoints,
  evaluateBadges,
  POINT_VALUES,
} from "../../services/gamification.js";
import { randomUUID } from "crypto";

export const goalRoutes: FastifyPluginAsync = async (fastify) => {
  // Goals belong to one account, so the profiles they're for must too
  async function assertOwnProfile(userId: string, profileId: string | null | undefined) {
    if (profileId && !(await profilesOwnedBy(fastify.db, [profileId], [userId]))) {
      throw fastify.httpErrors.badRequest("Profile not found");
    }
  }

  // List goals
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "List goals for user",
        tags: ["Goals"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const { profileId, active } = request.query as {
        profileId?: string;
        active?: string;
      };

      const conditions = [eq(goals.userId, user.id)];
      if (profileId) conditions.push(eq(goals.profileId, profileId));
      if (active === "true") conditions.push(eq(goals.isActive, true));
      if (active === "false") conditions.push(eq(goals.isActive, false));

      const allGoals = await fastify.db
        .select()
        .from(goals)
        .where(and(...conditions))
        .orderBy(asc(goals.name));

      // Get recent progress for all goals
      const goalIds = allGoals.map((g) => g.id);
      let allProgress: any[] = [];
      if (goalIds.length > 0) {
        allProgress = await fastify.db
          .select()
          .from(goalProgress)
          .where(inArray(goalProgress.goalId, goalIds))
          .orderBy(desc(goalProgress.date));
      }

      const goalsWithProgress = allGoals.map((goal) => ({
        ...goal,
        progress: allProgress.filter((p: any) => p.goalId === goal.id),
      }));

      return { success: true, data: goalsWithProgress };
    }
  );

  // Create goal
  fastify.post(
    "/",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Create a new goal",
        tags: ["Goals"],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const body = request.body as {
        name: string;
        description?: string;
        icon?: string;
        color?: string;
        goalType?: string;
        targetValue?: string;
        targetUnit?: string;
        targetPeriod?: string;
        milestones?: { name: string }[];
        targetDate?: string;
        profileId?: string;
        isShared?: boolean;
      };

      await assertOwnProfile(user.id, body.profileId);

      const milestones = (body.milestones ?? []).map((m) => ({
        id: randomUUID(),
        name: m.name,
        completed: false,
        completedAt: null,
      }));

      const [goal] = await fastify.db
        .insert(goals)
        .values({
          userId: user.id,
          name: body.name,
          description: body.description ?? null,
          icon: body.icon ?? null,
          color: body.color ?? null,
          goalType: (body.goalType as any) ?? "milestone",
          targetValue: body.targetValue ?? null,
          targetUnit: body.targetUnit ?? null,
          targetPeriod: body.targetPeriod ?? null,
          milestones,
          targetDate: body.targetDate ?? null,
          profileId: body.profileId ?? null,
          isShared: body.isShared ?? false,
        })
        .returning();

      return reply.status(201).send({ success: true, data: goal });
    }
  );

  // Update goal
  fastify.patch(
    "/:id",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Update a goal",
        tags: ["Goals"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const { id } = request.params as { id: string };
      const body = request.body as Partial<{
        name: string;
        description: string;
        icon: string;
        color: string;
        goalType: string;
        targetValue: string;
        targetUnit: string;
        targetPeriod: string;
        targetDate: string;
        milestones: { id?: string; name: string }[];
        profileId: string | null;
        isShared: boolean;
        isActive: boolean;
      }>;

      const [goal] = await fastify.db
        .select()
        .from(goals)
        .where(and(eq(goals.id, id), eq(goals.userId, user.id)));

      if (!goal) throw fastify.httpErrors.notFound("Goal not found");
      await assertOwnProfile(user.id, body.profileId);

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (body.name !== undefined) updates.name = body.name;
      if (body.description !== undefined) updates.description = body.description;
      if (body.icon !== undefined) updates.icon = body.icon;
      if (body.color !== undefined) updates.color = body.color;
      if (body.goalType !== undefined) updates.goalType = body.goalType;
      if (body.targetValue !== undefined) updates.targetValue = body.targetValue;
      if (body.targetUnit !== undefined) updates.targetUnit = body.targetUnit;
      if (body.targetPeriod !== undefined) updates.targetPeriod = body.targetPeriod;
      if (body.targetDate !== undefined) updates.targetDate = body.targetDate;
      if (body.profileId !== undefined) updates.profileId = body.profileId;
      if (body.isShared !== undefined) updates.isShared = body.isShared;
      if (body.isActive !== undefined) updates.isActive = body.isActive;
      if (body.milestones !== undefined) {
        // The edit form sends milestone names: keep the id and completion of
        // each milestone that is still there
        const previous = [...(goal.milestones ?? [])];
        updates.milestones = body.milestones.map((m) => {
          const i = previous.findIndex((p) => (m.id ? p.id === m.id : p.name === m.name));
          const kept = i >= 0 ? previous.splice(i, 1)[0] : undefined;
          return kept
            ? { ...kept, name: m.name }
            : { id: randomUUID(), name: m.name, completed: false, completedAt: null };
        });
      }

      const [updated] = await fastify.db
        .update(goals)
        .set(updates)
        .where(and(eq(goals.id, id), eq(goals.userId, user.id)))
        .returning();

      if (!updated) throw fastify.httpErrors.notFound("Goal not found");
      return { success: true, data: updated };
    }
  );

  // Delete goal
  fastify.delete(
    "/:id",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Delete a goal",
        tags: ["Goals"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const { id } = request.params as { id: string };

      await fastify.db
        .delete(goals)
        .where(and(eq(goals.id, id), eq(goals.userId, user.id)));

      return { success: true };
    }
  );

  // Log progress
  fastify.post(
    "/:id/progress",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Log progress on a goal",
        tags: ["Goals"],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const { id } = request.params as { id: string };
      const body = request.body as {
        value: string;
        profileId?: string;
        date?: string;
        notes?: string;
      };

      // Verify goal belongs to user
      const [goal] = await fastify.db
        .select()
        .from(goals)
        .where(and(eq(goals.id, id), eq(goals.userId, user.id)));

      if (!goal) throw fastify.httpErrors.notFound("Goal not found");

      const profileId = body.profileId ?? goal.profileId;
      await assertOwnProfile(user.id, profileId);

      const [entry] = await fastify.db
        .insert(goalProgress)
        .values({
          goalId: id,
          profileId: profileId ?? null,
          date: body.date ?? new Date().toISOString().slice(0, 10),
          value: body.value,
          notes: body.notes ?? null,
        })
        .returning();

      // Update current_value on the goal
      const newValue =
        parseFloat(goal.currentValue ?? "0") + parseFloat(body.value);
      await fastify.db
        .update(goals)
        .set({
          currentValue: String(newValue),
          updatedAt: new Date(),
        })
        .where(eq(goals.id, id));

      // Award points
      let pointsEarned = 0;
      let newBadges: any[] = [];
      if (profileId) {
        await awardPoints(
          fastify.db,
          user.id,
          profileId,
          POINT_VALUES.goal_progress,
          "goal_progress",
          id
        );
        pointsEarned = POINT_VALUES.goal_progress;
      }

      return reply.status(201).send({
        success: true,
        data: { entry, pointsEarned, newBadges },
      });
    }
  );

  // Complete a milestone
  fastify.post(
    "/:id/milestones/:milestoneId/complete",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Complete a milestone within a goal",
        tags: ["Goals"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const { id, milestoneId } = request.params as {
        id: string;
        milestoneId: string;
      };

      const [goal] = await fastify.db
        .select()
        .from(goals)
        .where(and(eq(goals.id, id), eq(goals.userId, user.id)));

      if (!goal) throw fastify.httpErrors.notFound("Goal not found");
      await assertOwnProfile(user.id, goal.profileId);

      const milestones = (goal.milestones ?? []) as any[];
      const milestone = milestones.find((m: any) => m.id === milestoneId);
      if (!milestone)
        throw fastify.httpErrors.notFound("Milestone not found");

      milestone.completed = true;
      milestone.completedAt = new Date().toISOString();

      await fastify.db
        .update(goals)
        .set({
          milestones,
          updatedAt: new Date(),
        })
        .where(eq(goals.id, id));

      // Award points
      const profileId = goal.profileId;
      let pointsEarned = 0;
      if (profileId) {
        await awardPoints(
          fastify.db,
          user.id,
          profileId,
          POINT_VALUES.goal_milestone,
          "goal_milestone",
          id
        );
        pointsEarned = POINT_VALUES.goal_milestone;
      }

      return { success: true, data: { milestones, pointsEarned } };
    }
  );

  // Mark goal as complete
  fastify.post(
    "/:id/complete",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Mark goal as complete",
        tags: ["Goals"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const { id } = request.params as { id: string };

      const [goal] = await fastify.db
        .select()
        .from(goals)
        .where(and(eq(goals.id, id), eq(goals.userId, user.id)));

      if (!goal) throw fastify.httpErrors.notFound("Goal not found");
      await assertOwnProfile(user.id, goal.profileId);

      const [updated] = await fastify.db
        .update(goals)
        .set({
          completedAt: new Date(),
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(goals.id, id))
        .returning();

      // Award points and evaluate badges
      const profileId = goal.profileId;
      let pointsEarned = 0;
      let newBadges: any[] = [];
      if (profileId) {
        await awardPoints(
          fastify.db,
          user.id,
          profileId,
          POINT_VALUES.goal_complete,
          "goal_complete",
          id
        );
        pointsEarned = POINT_VALUES.goal_complete;

        // Count completed goals for badge evaluation
        const completedGoals = await fastify.db
          .select()
          .from(goals)
          .where(
            and(
              eq(goals.userId, user.id),
              isNotNull(goals.completedAt)
            )
          );

        newBadges = await evaluateBadges(fastify.db, user.id, profileId, {
          completedGoals: completedGoals.length,
        });
      }

      return {
        success: true,
        data: { goal: updated, pointsEarned, newBadges },
      };
    }
  );
};
