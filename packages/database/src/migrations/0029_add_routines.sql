-- Routine frequency enum
DO $$ BEGIN
  CREATE TYPE "routine_frequency" AS ENUM ('daily', 'weekly', 'custom');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Routines table
CREATE TABLE IF NOT EXISTS "routines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "icon" text,
  "category" text,
  "frequency" "routine_frequency" NOT NULL DEFAULT 'daily',
  "days_of_week" integer[],
  "assigned_profile_id" uuid REFERENCES "family_profiles"("id") ON DELETE SET NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "routines_user_idx" ON "routines" ("user_id");

-- Routine completions table
CREATE TABLE IF NOT EXISTS "routine_completions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "routine_id" uuid NOT NULL REFERENCES "routines"("id") ON DELETE CASCADE,
  "completed_date" date NOT NULL,
  "completed_by_profile_id" uuid REFERENCES "family_profiles"("id") ON DELETE SET NULL,
  "completed_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "routine_completions_routine_date_idx" ON "routine_completions" ("routine_id", "completed_date");
CREATE INDEX IF NOT EXISTS "routine_completions_date_idx" ON "routine_completions" ("completed_date");

-- Unique constraint to prevent duplicate completions per routine/date/profile
CREATE UNIQUE INDEX IF NOT EXISTS "routine_completions_unique_idx"
  ON "routine_completions" ("routine_id", "completed_date", COALESCE("completed_by_profile_id", '00000000-0000-0000-0000-000000000000'));
