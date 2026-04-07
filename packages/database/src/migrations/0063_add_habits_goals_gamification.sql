-- Migration: Add habits, goals, and gamification tables

-- Enums
DO $$ BEGIN
  CREATE TYPE "habit_frequency" AS ENUM ('daily', 'weekly', 'custom');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "goal_type" AS ENUM ('quantifiable', 'milestone');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Habits table
CREATE TABLE IF NOT EXISTS "habits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "profile_id" uuid REFERENCES "family_profiles"("id") ON DELETE SET NULL,
  "name" text NOT NULL,
  "icon" text,
  "color" text,
  "frequency" "habit_frequency" NOT NULL DEFAULT 'daily',
  "target_days" jsonb DEFAULT '[]',
  "target_count" integer NOT NULL DEFAULT 1,
  "is_shared" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "habits_user_idx" ON "habits"("user_id");
CREATE INDEX IF NOT EXISTS "habits_profile_idx" ON "habits"("profile_id");

-- Habit completions table
CREATE TABLE IF NOT EXISTS "habit_completions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "habit_id" uuid NOT NULL REFERENCES "habits"("id") ON DELETE CASCADE,
  "profile_id" uuid REFERENCES "family_profiles"("id") ON DELETE SET NULL,
  "completed_date" date NOT NULL,
  "completed_at" timestamptz DEFAULT now() NOT NULL,
  "value" text,
  "notes" text
);

CREATE INDEX IF NOT EXISTS "habit_completions_habit_date_idx" ON "habit_completions"("habit_id", "completed_date");
CREATE INDEX IF NOT EXISTS "habit_completions_profile_idx" ON "habit_completions"("profile_id");
CREATE UNIQUE INDEX IF NOT EXISTS "habit_completions_unique_idx" ON "habit_completions"("habit_id", "profile_id", "completed_date");

-- Goals table
CREATE TABLE IF NOT EXISTS "goals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "profile_id" uuid REFERENCES "family_profiles"("id") ON DELETE SET NULL,
  "name" text NOT NULL,
  "description" text,
  "icon" text,
  "color" text,
  "goal_type" "goal_type" NOT NULL DEFAULT 'milestone',
  "target_value" text,
  "target_unit" text,
  "target_period" text,
  "current_value" text DEFAULT '0',
  "milestones" jsonb DEFAULT '[]',
  "target_date" date,
  "is_shared" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "goals_user_idx" ON "goals"("user_id");
CREATE INDEX IF NOT EXISTS "goals_profile_idx" ON "goals"("profile_id");

-- Goal progress table
CREATE TABLE IF NOT EXISTS "goal_progress" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "goal_id" uuid NOT NULL REFERENCES "goals"("id") ON DELETE CASCADE,
  "profile_id" uuid REFERENCES "family_profiles"("id") ON DELETE SET NULL,
  "date" date NOT NULL,
  "value" text NOT NULL,
  "notes" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "goal_progress_goal_date_idx" ON "goal_progress"("goal_id", "date");

-- Gamification points ledger
CREATE TABLE IF NOT EXISTS "gamification_points" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "profile_id" uuid NOT NULL REFERENCES "family_profiles"("id") ON DELETE CASCADE,
  "points" integer NOT NULL,
  "reason" text NOT NULL,
  "reference_id" uuid,
  "earned_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "gamification_points_profile_idx" ON "gamification_points"("profile_id");
CREATE INDEX IF NOT EXISTS "gamification_points_earned_at_idx" ON "gamification_points"("earned_at");

-- Gamification badges earned
CREATE TABLE IF NOT EXISTS "gamification_badges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "profile_id" uuid NOT NULL REFERENCES "family_profiles"("id") ON DELETE CASCADE,
  "badge_id" text NOT NULL,
  "earned_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "gamification_badges_profile_idx" ON "gamification_badges"("profile_id");
CREATE UNIQUE INDEX IF NOT EXISTS "gamification_badges_unique_idx" ON "gamification_badges"("profile_id", "badge_id");

-- Custom badges
CREATE TABLE IF NOT EXISTS "custom_badges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "icon" text NOT NULL,
  "color" text,
  "criteria" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "custom_badges_user_idx" ON "custom_badges"("user_id");
