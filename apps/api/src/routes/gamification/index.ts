import type { FastifyPluginAsync } from "fastify";
import { eq, and, desc, asc, gte, sql } from "drizzle-orm";
import {
  gamificationPoints,
  gamificationBadges,
  customBadges,
  familyProfiles,
  habits,
  habitCompletions,
  households,
  householdMembers,
} from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";
import { requireUserHouseholdId } from "../../lib/household.js";
import {
  getLevel,
  getProfileTotalPoints,
  BUILTIN_BADGES,
  POINT_VALUES,
} from "../../services/gamification.js";
import type { BadgeDefinition, LeaderboardEntry } from "@openframe/shared";

export const gamificationRoutes: FastifyPluginAsync = async (fastify) => {
  // Get profile gamification summary
  fastify.get(
    "/profile/:profileId",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get gamification profile (points, level, badges)",
        tags: ["Gamification"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const { profileId } = request.params as { profileId: string };

      const totalPoints = await getProfileTotalPoints(fastify.db, profileId);
      const level = getLevel(totalPoints);

      const earnedBadges = await fastify.db
        .select()
        .from(gamificationBadges)
        .where(eq(gamificationBadges.profileId, profileId))
        .orderBy(desc(gamificationBadges.earnedAt));

      const badges = earnedBadges.map((eb) => {
        const def =
          BUILTIN_BADGES.find((b) => b.id === eb.badgeId) ?? {
            id: eb.badgeId,
            name: eb.badgeId,
            icon: "🏅",
            description: "",
          };
        return {
          id: eb.id,
          badgeId: eb.badgeId,
          name: def.name,
          icon: def.icon,
          description: def.description,
          earnedAt: eb.earnedAt,
        };
      });

      const [profile] = await fastify.db
        .select()
        .from(familyProfiles)
        .where(eq(familyProfiles.id, profileId));

      return {
        success: true,
        data: {
          profileId,
          profileName: profile?.name ?? "Unknown",
          profileIcon: profile?.icon ?? null,
          profileColor: profile?.color ?? null,
          totalPoints,
          level: level.level,
          levelName: level.name,
          levelProgress: level.progress,
          badges,
        },
      };
    }
  );

  // Leaderboard
  fastify.get(
    "/leaderboard",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get family leaderboard",
        tags: ["Gamification"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const { period } = request.query as {
        period?: "weekly" | "monthly" | "alltime";
      };

      const householdId = await requireUserHouseholdId(fastify.db, user.id);

      // Get all profiles in household
      const profiles = await fastify.db
        .select()
        .from(familyProfiles)
        .where(eq(familyProfiles.userId, user.id));

      // Also get profiles from household members
      const members = await fastify.db
        .select({ userId: householdMembers.userId })
        .from(householdMembers)
        .where(eq(householdMembers.householdId, householdId));

      const memberUserIds = members.map((m) => m.userId);
      let allProfiles = [...profiles];

      for (const memberId of memberUserIds) {
        if (memberId === user.id) continue;
        const memberProfiles = await fastify.db
          .select()
          .from(familyProfiles)
          .where(eq(familyProfiles.userId, memberId));
        allProfiles.push(...memberProfiles);
      }

      // Determine time filter
      let since: Date | undefined;
      if (period === "weekly") {
        since = new Date();
        since.setDate(since.getDate() - since.getDay() + 1); // Monday
        since.setHours(0, 0, 0, 0);
      } else if (period === "monthly") {
        since = new Date();
        since.setDate(1);
        since.setHours(0, 0, 0, 0);
      }

      // Build leaderboard entries
      const entries: LeaderboardEntry[] = await Promise.all(
        allProfiles.map(async (profile) => {
          const points = await getProfileTotalPoints(
            fastify.db,
            profile.id,
            since
          );
          const totalPoints = await getProfileTotalPoints(
            fastify.db,
            profile.id
          );
          const level = getLevel(totalPoints);

          const earnedBadges = await fastify.db
            .select()
            .from(gamificationBadges)
            .where(eq(gamificationBadges.profileId, profile.id))
            .orderBy(desc(gamificationBadges.earnedAt));

          const badges = earnedBadges.slice(0, 5).map((eb) => {
            const def =
              BUILTIN_BADGES.find((b) => b.id === eb.badgeId) ?? {
                id: eb.badgeId,
                name: eb.badgeId,
                icon: "🏅",
                description: "",
              };
            return {
              id: eb.id,
              badgeId: eb.badgeId,
              name: def.name,
              icon: def.icon,
              description: def.description,
              earnedAt: eb.earnedAt,
            };
          });

          return {
            rank: 0, // Set after sorting
            profileId: profile.id,
            profileName: profile.name,
            profileIcon: profile.icon,
            profileColor: profile.color,
            points,
            level: level.level,
            levelName: level.name,
            levelProgress: level.progress,
            badges,
            longestStreak: 0,
          };
        })
      );

      // Sort by points descending, assign ranks
      entries.sort((a, b) => b.points - a.points);
      entries.forEach((e, i) => (e.rank = i + 1));

      return { success: true, data: entries };
    }
  );

  // List all badges (built-in + custom)
  fastify.get(
    "/badges",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "List all available badges",
        tags: ["Gamification"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const custom = await fastify.db
        .select()
        .from(customBadges)
        .where(eq(customBadges.userId, user.id));

      const allBadges: BadgeDefinition[] = [
        ...BUILTIN_BADGES,
        ...custom.map((c) => ({
          id: c.id,
          name: c.name,
          icon: c.icon,
          description: c.description ?? "",
          isCustom: true,
          color: c.color ?? undefined,
          criteria: c.criteria ?? undefined,
        })),
      ];

      return { success: true, data: allBadges };
    }
  );

  // Manually award badge (owner only)
  fastify.post(
    "/badges/award",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Manually award a badge to a profile",
        tags: ["Gamification"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const { profileId, badgeId } = request.body as {
        profileId: string;
        badgeId: string;
      };

      await fastify.db
        .insert(gamificationBadges)
        .values({ profileId, badgeId })
        .onConflictDoNothing();

      // Award bonus points
      await fastify.db.insert(gamificationPoints).values({
        userId: user.id,
        profileId,
        points: POINT_VALUES.badge_earned,
        reason: "badge_earned",
        referenceId: null,
      });

      return { success: true };
    }
  );

  // Scoreboard data (for display mode)
  fastify.get(
    "/scoreboard",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get full scoreboard data for display mode",
        tags: ["Gamification"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const householdId = await requireUserHouseholdId(fastify.db, user.id);

      // Get household info
      const [household] = await fastify.db
        .select()
        .from(households)
        .where(eq(households.id, householdId));

      // Get all profiles
      const profiles = await fastify.db
        .select()
        .from(familyProfiles)
        .where(eq(familyProfiles.userId, user.id));

      // Weekly period
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
      weekStart.setHours(0, 0, 0, 0);

      // Build profile entries with points
      const profileEntries: LeaderboardEntry[] = await Promise.all(
        profiles.map(async (profile) => {
          const points = await getProfileTotalPoints(
            fastify.db,
            profile.id,
            weekStart
          );
          const totalPoints = await getProfileTotalPoints(
            fastify.db,
            profile.id
          );
          const level = getLevel(totalPoints);

          return {
            rank: 0,
            profileId: profile.id,
            profileName: profile.name,
            profileIcon: profile.icon,
            profileColor: profile.color,
            points,
            level: level.level,
            levelName: level.name,
            levelProgress: level.progress,
            badges: [],
            longestStreak: 0,
          };
        })
      );

      profileEntries.sort((a, b) => b.points - a.points);
      profileEntries.forEach((e, i) => (e.rank = i + 1));

      // Today's shared habits
      const today = new Date().toISOString().slice(0, 10);
      const sharedHabits = await fastify.db
        .select()
        .from(habits)
        .where(
          and(eq(habits.userId, user.id), eq(habits.isShared, true), eq(habits.isActive, true))
        );

      const todayCompletions = await fastify.db
        .select()
        .from(habitCompletions)
        .where(eq(habitCompletions.completedDate, today));

      const todayHabits = sharedHabits.map((habit) => ({
        habitId: habit.id,
        habitName: habit.name,
        habitIcon: habit.icon,
        completions: profiles.map((profile) => ({
          profileId: profile.id,
          completed: todayCompletions.some(
            (c) => c.habitId === habit.id && c.profileId === profile.id
          ),
        })),
      }));

      // Recent badges (last 7 days)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const recentBadgeRows = await fastify.db
        .select()
        .from(gamificationBadges)
        .where(gte(gamificationBadges.earnedAt, weekAgo))
        .orderBy(desc(gamificationBadges.earnedAt));

      const recentBadges = recentBadgeRows
        .map((eb) => {
          const profile = profiles.find((p) => p.id === eb.profileId);
          const def = BUILTIN_BADGES.find((b) => b.id === eb.badgeId);
          if (!profile || !def) return null;
          return {
            profileId: profile.id,
            profileName: profile.name,
            badge: def,
            earnedAt: eb.earnedAt,
          };
        })
        .filter(Boolean);

      // Week label
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const weekLabel = `Week of ${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

      return {
        success: true,
        data: {
          familyName: household?.name ?? "Family",
          weekLabel,
          profiles: profileEntries,
          todayHabits,
          recentBadges,
        },
      };
    }
  );

  // ==================== Custom Badges ====================

  fastify.post(
    "/badges/custom",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Create a custom badge",
        tags: ["Gamification"],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const body = request.body as {
        name: string;
        icon: string;
        description?: string;
        color?: string;
        criteria?: string;
      };

      const [badge] = await fastify.db
        .insert(customBadges)
        .values({
          userId: user.id,
          name: body.name,
          icon: body.icon,
          description: body.description ?? null,
          color: body.color ?? null,
          criteria: body.criteria ?? null,
        })
        .returning();

      return reply.status(201).send({ success: true, data: badge });
    }
  );

  fastify.patch(
    "/badges/custom/:id",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Update a custom badge",
        tags: ["Gamification"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const { id } = request.params as { id: string };
      const body = request.body as Partial<{
        name: string;
        icon: string;
        description: string;
        color: string;
        criteria: string;
      }>;

      const updates: Record<string, any> = {};
      for (const [key, val] of Object.entries(body)) {
        if (val !== undefined) updates[key] = val;
      }

      const [updated] = await fastify.db
        .update(customBadges)
        .set(updates)
        .where(and(eq(customBadges.id, id), eq(customBadges.userId, user.id)))
        .returning();

      if (!updated) throw fastify.httpErrors.notFound("Badge not found");
      return { success: true, data: updated };
    }
  );

  fastify.delete(
    "/badges/custom/:id",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Delete a custom badge",
        tags: ["Gamification"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const { id } = request.params as { id: string };

      await fastify.db
        .delete(customBadges)
        .where(and(eq(customBadges.id, id), eq(customBadges.userId, user.id)));

      return { success: true };
    }
  );
};
