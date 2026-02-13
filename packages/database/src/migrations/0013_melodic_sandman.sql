DO $$ BEGIN
    CREATE TYPE "public"."kiosk_display_mode" AS ENUM('full', 'screensaver-only', 'calendar-only', 'dashboard-only');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "public"."kiosk_display_type" AS ENUM('touch', 'tv', 'display');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "public"."kitchen_timer_status" AS ENUM('running', 'paused', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "public"."remarkable_schedule_type" AS ENUM('daily', 'weekly', 'monthly', 'manual');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "public"."remarkable_template_type" AS ENUM('weekly_planner', 'habit_tracker', 'custom_agenda', 'user_designed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "public"."user_role" AS ENUM('admin', 'member', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "family_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"color" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kitchen_active_timers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"preset_id" uuid,
	"name" text NOT NULL,
	"duration_seconds" integer NOT NULL,
	"remaining_seconds" integer NOT NULL,
	"status" "kitchen_timer_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paused_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kitchen_timer_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"duration_seconds" integer NOT NULL,
	"recipe_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profile_calendars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"calendar_id" uuid NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profile_news_feeds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"news_feed_id" uuid NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profile_planner_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"layout_config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_planner_config_profile_id_unique" UNIQUE("profile_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profile_remarkable_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"folder_path" text DEFAULT '/Calendar',
	"schedule_type" "remarkable_schedule_type" DEFAULT 'daily',
	"push_time" text DEFAULT '06:00',
	"push_day" integer,
	"timezone" text DEFAULT 'America/New_York',
	"last_push_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_remarkable_settings_profile_id_unique" UNIQUE("profile_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recipe_upload_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_upload_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"servings" integer,
	"prep_time" integer,
	"cook_time" integer,
	"ingredients" jsonb DEFAULT '[]'::jsonb,
	"instructions" jsonb DEFAULT '[]'::jsonb,
	"tags" text[] DEFAULT '{}',
	"notes" text,
	"source_image_path" text,
	"thumbnail_path" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "remarkable_processed_confirmations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"confirmation_type" text DEFAULT 'events_created' NOT NULL,
	"confirmation_document_id" text,
	"events_confirmed" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "remarkable_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"template_id" uuid,
	"schedule_type" "remarkable_schedule_type" DEFAULT 'daily' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"push_time" text DEFAULT '06:00' NOT NULL,
	"push_day" integer,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"last_push_at" timestamp with time zone,
	"next_push_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "remarkable_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"template_type" "remarkable_template_type" NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"pdf_template" text,
	"merge_fields" jsonb,
	"folder_path" text DEFAULT '/Calendar' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "favorite_sports_teams" ADD COLUMN IF NOT EXISTS "visibility" jsonb DEFAULT '{"week":false,"month":false,"day":false,"popup":true,"screensaver":false}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "kiosks" ADD COLUMN IF NOT EXISTS "display_mode" "kiosk_display_mode" DEFAULT 'full' NOT NULL;--> statement-breakpoint
ALTER TABLE "kiosks" ADD COLUMN IF NOT EXISTS "display_type" "kiosk_display_type" DEFAULT 'touch' NOT NULL;--> statement-breakpoint
ALTER TABLE "kiosks" ADD COLUMN IF NOT EXISTS "home_page" text DEFAULT 'calendar';--> statement-breakpoint
ALTER TABLE "kiosks" ADD COLUMN IF NOT EXISTS "selected_calendar_ids" text[];--> statement-breakpoint
ALTER TABLE "kiosks" ADD COLUMN IF NOT EXISTS "enabled_features" jsonb;--> statement-breakpoint
ALTER TABLE "kiosks" ADD COLUMN IF NOT EXISTS "start_fullscreen" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "user_role" DEFAULT 'member' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "family_profiles" ADD CONSTRAINT "family_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kitchen_active_timers" ADD CONSTRAINT "kitchen_active_timers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kitchen_active_timers" ADD CONSTRAINT "kitchen_active_timers_preset_id_kitchen_timer_presets_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."kitchen_timer_presets"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kitchen_timer_presets" ADD CONSTRAINT "kitchen_timer_presets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kitchen_timer_presets" ADD CONSTRAINT "kitchen_timer_presets_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profile_calendars" ADD CONSTRAINT "profile_calendars_profile_id_family_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."family_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profile_calendars" ADD CONSTRAINT "profile_calendars_calendar_id_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendars"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profile_news_feeds" ADD CONSTRAINT "profile_news_feeds_profile_id_family_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."family_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profile_news_feeds" ADD CONSTRAINT "profile_news_feeds_news_feed_id_news_feeds_id_fk" FOREIGN KEY ("news_feed_id") REFERENCES "public"."news_feeds"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profile_planner_config" ADD CONSTRAINT "profile_planner_config_profile_id_family_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."family_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profile_remarkable_settings" ADD CONSTRAINT "profile_remarkable_settings_profile_id_family_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."family_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recipe_upload_tokens" ADD CONSTRAINT "recipe_upload_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recipes" ADD CONSTRAINT "recipes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "remarkable_processed_confirmations" ADD CONSTRAINT "remarkable_processed_confirmations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "remarkable_processed_confirmations" ADD CONSTRAINT "remarkable_processed_confirmations_document_id_remarkable_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."remarkable_documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "remarkable_schedules" ADD CONSTRAINT "remarkable_schedules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "remarkable_schedules" ADD CONSTRAINT "remarkable_schedules_template_id_remarkable_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."remarkable_templates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "remarkable_templates" ADD CONSTRAINT "remarkable_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "family_profiles_user_idx" ON "family_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kitchen_active_timers_user_idx" ON "kitchen_active_timers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kitchen_active_timers_user_status_idx" ON "kitchen_active_timers" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kitchen_timer_presets_user_idx" ON "kitchen_timer_presets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profile_calendars_profile_idx" ON "profile_calendars" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profile_calendars_calendar_idx" ON "profile_calendars" USING btree ("calendar_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profile_news_feeds_profile_idx" ON "profile_news_feeds" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profile_news_feeds_feed_idx" ON "profile_news_feeds" USING btree ("news_feed_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recipe_upload_tokens_token_idx" ON "recipe_upload_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recipe_upload_tokens_expires_idx" ON "recipe_upload_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recipes_user_idx" ON "recipes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recipes_favorite_idx" ON "recipes" USING btree ("user_id","is_favorite");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recipes_created_idx" ON "recipes" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "remarkable_processed_confirmations_user_idx" ON "remarkable_processed_confirmations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "remarkable_processed_confirmations_document_idx" ON "remarkable_processed_confirmations" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "remarkable_processed_confirmations_created_idx" ON "remarkable_processed_confirmations" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "remarkable_schedules_user_idx" ON "remarkable_schedules" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "remarkable_schedules_template_idx" ON "remarkable_schedules" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "remarkable_schedules_enabled_idx" ON "remarkable_schedules" USING btree ("user_id","enabled");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "remarkable_schedules_next_push_idx" ON "remarkable_schedules" USING btree ("next_push_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "remarkable_templates_user_idx" ON "remarkable_templates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "remarkable_templates_type_idx" ON "remarkable_templates" USING btree ("user_id","template_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "remarkable_templates_active_idx" ON "remarkable_templates" USING btree ("user_id","is_active");