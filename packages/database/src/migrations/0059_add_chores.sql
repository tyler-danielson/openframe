-- Chores
DO $$ BEGIN
  CREATE TYPE "chore_frequency" AS ENUM ('daily', 'weekly', 'biweekly', 'monthly');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "chores" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "household_id" uuid NOT NULL REFERENCES "households"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "icon" text,
  "frequency" "chore_frequency" NOT NULL DEFAULT 'weekly',
  "rotate_day" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "chores_household_idx" ON "chores"("household_id");

CREATE TABLE IF NOT EXISTS "chore_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "chore_id" uuid NOT NULL REFERENCES "chores"("id") ON DELETE CASCADE,
  "profile_id" uuid NOT NULL REFERENCES "family_profiles"("id") ON DELETE CASCADE,
  "assigned_at" timestamptz DEFAULT now() NOT NULL,
  "completed_at" timestamptz,
  "due_date" date NOT NULL,
  "auto_assigned" boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS "chore_assignments_chore_idx" ON "chore_assignments"("chore_id");
CREATE INDEX IF NOT EXISTS "chore_assignments_profile_idx" ON "chore_assignments"("profile_id");

CREATE TABLE IF NOT EXISTS "chore_rotation_order" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "chore_id" uuid NOT NULL REFERENCES "chores"("id") ON DELETE CASCADE,
  "profile_id" uuid NOT NULL REFERENCES "family_profiles"("id") ON DELETE CASCADE,
  "position" integer NOT NULL
);

CREATE INDEX IF NOT EXISTS "chore_rotation_chore_idx" ON "chore_rotation_order"("chore_id");
