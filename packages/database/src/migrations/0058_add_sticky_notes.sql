-- Sticky Notes
CREATE TABLE IF NOT EXISTS "sticky_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "household_id" uuid NOT NULL REFERENCES "households"("id") ON DELETE CASCADE,
  "author_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "content" text NOT NULL DEFAULT '',
  "color" text NOT NULL DEFAULT '#FEF3C7',
  "pinned" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "sticky_notes_household_idx" ON "sticky_notes"("household_id");
