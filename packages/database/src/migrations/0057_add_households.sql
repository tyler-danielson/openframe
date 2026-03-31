-- Households table and membership
DO $$ BEGIN
  CREATE TYPE "household_role" AS ENUM ('owner', 'admin', 'member');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "households" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "household_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "household_id" uuid NOT NULL REFERENCES "households"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" "household_role" NOT NULL DEFAULT 'member',
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "household_members_household_idx" ON "household_members"("household_id");
CREATE INDEX IF NOT EXISTS "household_members_user_idx" ON "household_members"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "household_members_unique" ON "household_members"("household_id", "user_id");

-- Auto-create a household for each existing user
INSERT INTO "households" ("id", "name", "created_at")
SELECT u.id, COALESCE(u.name, u.email) || '''s Home', now()
FROM "users" u
WHERE NOT EXISTS (
  SELECT 1 FROM "household_members" hm WHERE hm.user_id = u.id
);

INSERT INTO "household_members" ("household_id", "user_id", "role")
SELECT h.id, u.id, 'owner'
FROM "users" u
JOIN "households" h ON h.id = u.id
WHERE NOT EXISTS (
  SELECT 1 FROM "household_members" hm WHERE hm.user_id = u.id
);
