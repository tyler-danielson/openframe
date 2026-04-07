import { eq, and, desc, sql, gte } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  habitCompletions,
  gamificationPoints,
  gamificationBadges,
  customBadges,
  familyProfiles,
} from "@openframe/database/schema";
import type { BadgeDefinition } from "@openframe/shared";

// ==================== Point Values ====================

export const POINT_VALUES = {
  habit_completion: 10,
  streak_3_day: 15,
  streak_7_day: 50,
  streak_14_day: 100,
  streak_30_day: 250,
  streak_100_day: 1000,
  perfect_day: 25,
  goal_progress: 5,
  goal_milestone: 50,
  goal_complete: 200,
  task_complete: 5,
  task_complete_on_time: 10,
  badge_earned: 25,
};

// ==================== Level Thresholds ====================

export const LEVEL_THRESHOLDS = [
  { level: 1, name: "Starter", minPoints: 0 },
  { level: 2, name: "Getting Going", minPoints: 100 },
  { level: 3, name: "On a Roll", minPoints: 300 },
  { level: 4, name: "Habit Builder", minPoints: 600 },
  { level: 5, name: "Consistent", minPoints: 1000 },
  { level: 6, name: "Dedicated", minPoints: 2000 },
  { level: 7, name: "Unstoppable", minPoints: 4000 },
  { level: 8, name: "Champion", minPoints: 7000 },
  { level: 9, name: "Legend", minPoints: 12000 },
  { level: 10, name: "Grandmaster", minPoints: 20000 },
];

export function getLevel(totalPoints: number): {
  level: number;
  name: string;
  progress: number;
} {
  let currentLevel = { level: 1, name: "Starter", minPoints: 0 };
  let nextLevel: { level: number; name: string; minPoints: number } | null =
    LEVEL_THRESHOLDS[1] ?? null;

  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    const threshold = LEVEL_THRESHOLDS[i];
    if (threshold && totalPoints >= threshold.minPoints) {
      currentLevel = threshold;
      nextLevel = LEVEL_THRESHOLDS[i + 1] ?? null;
      break;
    }
  }

  const progress = nextLevel
    ? (totalPoints - currentLevel.minPoints) /
      (nextLevel.minPoints - currentLevel.minPoints)
    : 1;

  return { level: currentLevel.level, name: currentLevel.name, progress };
}

// ==================== Built-in Badges ====================

export const BUILTIN_BADGES: BadgeDefinition[] = [
  // Streak badges
  { id: "streak_3", name: "Hat Trick", icon: "🎯", description: "3-day habit streak" },
  { id: "streak_7", name: "Week Warrior", icon: "⚔️", description: "7-day habit streak" },
  { id: "streak_14", name: "Fortnight Force", icon: "🛡️", description: "14-day habit streak" },
  { id: "streak_30", name: "Monthly Master", icon: "🏆", description: "30-day habit streak" },
  { id: "streak_100", name: "Centurion", icon: "👑", description: "100-day habit streak" },
  { id: "streak_365", name: "Year of You", icon: "🌟", description: "365-day habit streak" },

  // Completion badges
  { id: "first_habit", name: "First Step", icon: "👣", description: "Complete your first habit" },
  { id: "first_goal", name: "Dream Big", icon: "🎯", description: "Create your first goal" },
  { id: "goal_complete", name: "Goal Crusher", icon: "💪", description: "Complete a goal" },
  { id: "five_goals", name: "Overachiever", icon: "🚀", description: "Complete 5 goals" },
  { id: "perfect_week", name: "Perfect Week", icon: "✨", description: "All habits completed every day for a week" },
  { id: "perfect_month", name: "Flawless", icon: "💎", description: "All habits completed every day for a month" },

  // Volume badges
  { id: "habits_50", name: "Half Century", icon: "🎖️", description: "50 total habit completions" },
  { id: "habits_100", name: "Century Club", icon: "💯", description: "100 total habit completions" },
  { id: "habits_500", name: "High Five Hundred", icon: "🖐️", description: "500 total habit completions" },
  { id: "habits_1000", name: "Thousandaire", icon: "🏅", description: "1,000 total habit completions" },

  // Level badges
  { id: "level_5", name: "Consistent", icon: "⭐", description: "Reach Level 5" },
  { id: "level_10", name: "Grandmaster", icon: "🌟", description: "Reach Level 10" },

  // Family badges
  { id: "family_streak", name: "Family Streak", icon: "👨‍👩‍👧‍👦", description: "Every family member completes a habit on the same day" },
  { id: "team_goal", name: "Team Effort", icon: "🤝", description: "Complete a shared family goal" },
];

// ==================== Streak Calculation ====================

export async function calculateStreak(
  db: NodePgDatabase<any>,
  habitId: string,
  profileId: string
): Promise<{ current: number; longest: number }> {
  const completions = await db
    .select({ date: habitCompletions.completedDate })
    .from(habitCompletions)
    .where(
      and(
        eq(habitCompletions.habitId, habitId),
        eq(habitCompletions.profileId, profileId)
      )
    )
    .orderBy(desc(habitCompletions.completedDate));

  if (completions.length === 0) return { current: 0, longest: 0 };

  const dates = completions.map((c) => String(c.date));
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // Current streak
  let current = 0;
  if (dates[0] === today || dates[0] === yesterday) {
    current = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(String(dates[i - 1]));
      const curr = new Date(String(dates[i]));
      const diff = (prev.getTime() - curr.getTime()) / 86400000;
      if (diff === 1) {
        current++;
      } else {
        break;
      }
    }
  }

  // Longest streak
  let longest = 1;
  let run = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(String(dates[i - 1]));
    const curr = new Date(String(dates[i]));
    const diff = (prev.getTime() - curr.getTime()) / 86400000;
    if (diff === 1) {
      run++;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }

  return { current, longest: Math.max(longest, current) };
}

// ==================== Points ====================

export async function awardPoints(
  db: NodePgDatabase<any>,
  userId: string,
  profileId: string,
  points: number,
  reason: string,
  referenceId?: string
) {
  const [entry] = await db
    .insert(gamificationPoints)
    .values({
      userId,
      profileId,
      points,
      reason,
      referenceId: referenceId ?? null,
    })
    .returning();
  return entry;
}

export async function getProfileTotalPoints(
  db: NodePgDatabase<any>,
  profileId: string,
  since?: Date
): Promise<number> {
  const conditions = [eq(gamificationPoints.profileId, profileId)];
  if (since) {
    conditions.push(gte(gamificationPoints.earnedAt, since));
  }

  const result = await db
    .select({
      total: sql<number>`COALESCE(SUM(${gamificationPoints.points}), 0)`,
    })
    .from(gamificationPoints)
    .where(and(...conditions));

  return Number(result[0]?.total ?? 0);
}

// ==================== Badge Evaluation ====================

interface ProfileStats {
  totalCompletions: number;
  longestStreak: number;
  currentMaxStreak: number;
  totalPoints: number;
  completedGoals: number;
}

async function getProfileStats(
  db: NodePgDatabase<any>,
  profileId: string
): Promise<ProfileStats> {
  const completionCount = await db
    .select({
      count: sql<number>`COUNT(*)`,
    })
    .from(habitCompletions)
    .where(eq(habitCompletions.profileId, profileId));

  const totalPoints = await getProfileTotalPoints(db, profileId);

  return {
    totalCompletions: Number(completionCount[0]?.count ?? 0),
    longestStreak: 0, // Calculated per-habit in evaluateBadges
    currentMaxStreak: 0,
    totalPoints,
    completedGoals: 0, // Will be passed in when needed
  };
}

function shouldAwardBadge(badgeId: string, stats: ProfileStats): boolean {
  switch (badgeId) {
    case "first_habit":
      return stats.totalCompletions >= 1;
    case "habits_50":
      return stats.totalCompletions >= 50;
    case "habits_100":
      return stats.totalCompletions >= 100;
    case "habits_500":
      return stats.totalCompletions >= 500;
    case "habits_1000":
      return stats.totalCompletions >= 1000;
    case "streak_3":
      return stats.currentMaxStreak >= 3;
    case "streak_7":
      return stats.currentMaxStreak >= 7;
    case "streak_14":
      return stats.currentMaxStreak >= 14;
    case "streak_30":
      return stats.currentMaxStreak >= 30;
    case "streak_100":
      return stats.currentMaxStreak >= 100;
    case "streak_365":
      return stats.currentMaxStreak >= 365;
    case "level_5":
      return getLevel(stats.totalPoints).level >= 5;
    case "level_10":
      return getLevel(stats.totalPoints).level >= 10;
    case "goal_complete":
      return stats.completedGoals >= 1;
    case "five_goals":
      return stats.completedGoals >= 5;
    default:
      return false;
  }
}

async function getEarnedBadgeIds(
  db: NodePgDatabase<any>,
  profileId: string
): Promise<string[]> {
  const badges = await db
    .select({ badgeId: gamificationBadges.badgeId })
    .from(gamificationBadges)
    .where(eq(gamificationBadges.profileId, profileId));
  return badges.map((b) => b.badgeId);
}

async function awardBadge(
  db: NodePgDatabase<any>,
  profileId: string,
  badgeId: string
) {
  await db
    .insert(gamificationBadges)
    .values({ profileId, badgeId })
    .onConflictDoNothing();
}

export async function evaluateBadges(
  db: NodePgDatabase<any>,
  userId: string,
  profileId: string,
  extraStats?: { currentMaxStreak?: number; completedGoals?: number }
): Promise<BadgeDefinition[]> {
  const newBadges: BadgeDefinition[] = [];
  const existing = await getEarnedBadgeIds(db, profileId);
  const stats = await getProfileStats(db, profileId);

  if (extraStats?.currentMaxStreak !== undefined) {
    stats.currentMaxStreak = extraStats.currentMaxStreak;
  }
  if (extraStats?.completedGoals !== undefined) {
    stats.completedGoals = extraStats.completedGoals;
  }

  for (const badge of BUILTIN_BADGES) {
    if (existing.includes(badge.id)) continue;

    if (shouldAwardBadge(badge.id, stats)) {
      await awardBadge(db, profileId, badge.id);
      await awardPoints(
        db,
        userId,
        profileId,
        POINT_VALUES.badge_earned,
        "badge_earned",
        badge.id
      );
      newBadges.push(badge);
    }
  }

  return newBadges;
}

// ==================== Streak Bonus Points ====================

export async function awardStreakBonus(
  db: NodePgDatabase<any>,
  userId: string,
  profileId: string,
  currentStreak: number,
  habitId: string
): Promise<number> {
  let bonus = 0;
  const streakBonuses = [
    { threshold: 100, points: POINT_VALUES.streak_100_day },
    { threshold: 30, points: POINT_VALUES.streak_30_day },
    { threshold: 14, points: POINT_VALUES.streak_14_day },
    { threshold: 7, points: POINT_VALUES.streak_7_day },
    { threshold: 3, points: POINT_VALUES.streak_3_day },
  ];

  for (const { threshold, points } of streakBonuses) {
    if (currentStreak === threshold) {
      bonus = points;
      await awardPoints(db, userId, profileId, points, "streak_bonus", habitId);
      break;
    }
  }

  return bonus;
}
