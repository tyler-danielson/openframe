-- Migration: Add family profiles for per-member planner configurations

-- Family profiles table
CREATE TABLE "family_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "icon" text,
  "color" text,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "family_profiles_user_idx" ON "family_profiles"("user_id");

-- Per-profile calendar visibility
CREATE TABLE "profile_calendars" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "profile_id" uuid NOT NULL REFERENCES "family_profiles"("id") ON DELETE CASCADE,
  "calendar_id" uuid NOT NULL REFERENCES "calendars"("id") ON DELETE CASCADE,
  "is_visible" boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS "profile_calendars_profile_idx" ON "profile_calendars"("profile_id");
CREATE INDEX IF NOT EXISTS "profile_calendars_calendar_idx" ON "profile_calendars"("calendar_id");

-- Per-profile news feed selection
CREATE TABLE "profile_news_feeds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "profile_id" uuid NOT NULL REFERENCES "family_profiles"("id") ON DELETE CASCADE,
  "news_feed_id" uuid NOT NULL REFERENCES "news_feeds"("id") ON DELETE CASCADE,
  "is_visible" boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS "profile_news_feeds_profile_idx" ON "profile_news_feeds"("profile_id");
CREATE INDEX IF NOT EXISTS "profile_news_feeds_feed_idx" ON "profile_news_feeds"("news_feed_id");

-- Per-profile planner layout configuration (widget-based)
CREATE TABLE "profile_planner_config" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "profile_id" uuid NOT NULL UNIQUE REFERENCES "family_profiles"("id") ON DELETE CASCADE,
  "layout_config" jsonb DEFAULT '{}',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Per-profile reMarkable delivery settings
CREATE TABLE "profile_remarkable_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "profile_id" uuid NOT NULL UNIQUE REFERENCES "family_profiles"("id") ON DELETE CASCADE,
  "enabled" boolean NOT NULL DEFAULT true,
  "folder_path" text DEFAULT '/Calendar',
  "schedule_type" "remarkable_schedule_type" DEFAULT 'daily',
  "push_time" text DEFAULT '06:00',
  "push_day" integer,
  "timezone" text DEFAULT 'America/New_York',
  "last_push_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
