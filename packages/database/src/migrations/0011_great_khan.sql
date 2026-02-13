DO $$ BEGIN
    CREATE TYPE "public"."automation_action_type" AS ENUM('service_call', 'notification');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "public"."automation_trigger_type" AS ENUM('time', 'state', 'duration');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "public"."game_status" AS ENUM('scheduled', 'in_progress', 'halftime', 'final', 'postponed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "public"."ha_timer_action" AS ENUM('turn_on', 'turn_off');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "public"."sports_provider" AS ENUM('espn');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TYPE "public"."calendar_provider" ADD VALUE 'ics';--> statement-breakpoint
ALTER TYPE "public"."calendar_provider" ADD VALUE 'sports';--> statement-breakpoint
ALTER TYPE "public"."calendar_provider" ADD VALUE 'homeassistant';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "capacities_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"api_token" text NOT NULL,
	"default_space_id" text,
	"is_connected" boolean DEFAULT true NOT NULL,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capacities_config_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "capacities_spaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"space_id" text NOT NULL,
	"title" text NOT NULL,
	"icon" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "favorite_sports_teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "sports_provider" DEFAULT 'espn' NOT NULL,
	"sport" text NOT NULL,
	"league" text NOT NULL,
	"team_id" text NOT NULL,
	"team_name" text NOT NULL,
	"team_abbreviation" text NOT NULL,
	"team_logo" text,
	"team_color" text,
	"is_visible" boolean DEFAULT true NOT NULL,
	"show_on_dashboard" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ha_automations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"trigger_type" "automation_trigger_type" NOT NULL,
	"trigger_config" jsonb NOT NULL,
	"action_type" "automation_action_type" NOT NULL,
	"action_config" jsonb NOT NULL,
	"last_triggered_at" timestamp with time zone,
	"trigger_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ha_entity_timers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entity_id" text NOT NULL,
	"action" "ha_timer_action" NOT NULL,
	"trigger_at" timestamp with time zone NOT NULL,
	"fade_enabled" boolean DEFAULT false NOT NULL,
	"fade_duration" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kiosks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"name" text DEFAULT 'My Kiosk' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"color_scheme" "color_scheme" DEFAULT 'default' NOT NULL,
	"screensaver_enabled" boolean DEFAULT true NOT NULL,
	"screensaver_timeout" integer DEFAULT 300 NOT NULL,
	"screensaver_interval" integer DEFAULT 15 NOT NULL,
	"screensaver_layout" "screensaver_layout" DEFAULT 'builder' NOT NULL,
	"screensaver_transition" "screensaver_transition" DEFAULT 'fade' NOT NULL,
	"screensaver_layout_config" jsonb,
	"last_accessed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kiosks_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "news_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feed_id" uuid NOT NULL,
	"guid" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"link" text NOT NULL,
	"image_url" text,
	"author" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "news_feeds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"feed_url" text NOT NULL,
	"category" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "remarkable_agenda_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"push_time" text DEFAULT '06:00' NOT NULL,
	"folder_path" text DEFAULT '/Calendar/Daily Agenda' NOT NULL,
	"include_calendar_ids" text[],
	"template_style" text DEFAULT 'default' NOT NULL,
	"show_location" boolean DEFAULT true NOT NULL,
	"show_description" boolean DEFAULT false NOT NULL,
	"notes_lines" integer DEFAULT 20 NOT NULL,
	"last_push_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "remarkable_agenda_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "remarkable_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_token" text NOT NULL,
	"user_token" text,
	"user_token_expires_at" timestamp with time zone,
	"is_connected" boolean DEFAULT true NOT NULL,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "remarkable_config_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "remarkable_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"document_id" text NOT NULL,
	"document_version" integer NOT NULL,
	"document_name" text NOT NULL,
	"document_type" text NOT NULL,
	"folder_path" text,
	"content_hash" text,
	"is_agenda" boolean DEFAULT false NOT NULL,
	"is_processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp with time zone,
	"recognized_text" text,
	"last_modified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "remarkable_event_source" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"extracted_text" text NOT NULL,
	"confidence" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sports_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"provider" "sports_provider" DEFAULT 'espn' NOT NULL,
	"sport" text NOT NULL,
	"league" text NOT NULL,
	"home_team_id" text NOT NULL,
	"home_team_name" text NOT NULL,
	"home_team_abbreviation" text NOT NULL,
	"home_team_logo" text,
	"home_team_color" text,
	"home_team_score" integer,
	"away_team_id" text NOT NULL,
	"away_team_name" text NOT NULL,
	"away_team_abbreviation" text NOT NULL,
	"away_team_logo" text,
	"away_team_color" text,
	"away_team_score" integer,
	"start_time" timestamp with time zone NOT NULL,
	"status" "game_status" DEFAULT 'scheduled' NOT NULL,
	"status_detail" text,
	"period" integer,
	"clock" text,
	"venue" text,
	"broadcast" text,
	"last_updated" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "telegram_chats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"chat_id" text NOT NULL,
	"chat_type" text DEFAULT 'private' NOT NULL,
	"chat_title" text,
	"first_name" text,
	"last_name" text,
	"username" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "telegram_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"bot_token" text NOT NULL,
	"bot_username" text,
	"webhook_secret" text,
	"is_connected" boolean DEFAULT true NOT NULL,
	"daily_agenda_enabled" boolean DEFAULT true NOT NULL,
	"daily_agenda_time" text DEFAULT '07:00' NOT NULL,
	"event_reminders_enabled" boolean DEFAULT true NOT NULL,
	"event_reminder_minutes" integer DEFAULT 15 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_config_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "calendars" ALTER COLUMN "visibility" SET DEFAULT '{"week":false,"month":false,"day":false,"popup":true,"screensaver":false}'::jsonb;--> statement-breakpoint
ALTER TABLE "calendars" ADD COLUMN IF NOT EXISTS "is_favorite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "calendars" ADD COLUMN IF NOT EXISTS "source_url" text;--> statement-breakpoint
ALTER TABLE "kiosk_config" ADD COLUMN IF NOT EXISTS "screensaver_layout_config" jsonb;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacities_config" ADD CONSTRAINT "capacities_config_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacities_spaces" ADD CONSTRAINT "capacities_spaces_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "favorite_sports_teams" ADD CONSTRAINT "favorite_sports_teams_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ha_automations" ADD CONSTRAINT "ha_automations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ha_entity_timers" ADD CONSTRAINT "ha_entity_timers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kiosks" ADD CONSTRAINT "kiosks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "news_articles" ADD CONSTRAINT "news_articles_feed_id_news_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."news_feeds"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "news_feeds" ADD CONSTRAINT "news_feeds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "remarkable_agenda_settings" ADD CONSTRAINT "remarkable_agenda_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "remarkable_config" ADD CONSTRAINT "remarkable_config_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "remarkable_documents" ADD CONSTRAINT "remarkable_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "remarkable_event_source" ADD CONSTRAINT "remarkable_event_source_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "remarkable_event_source" ADD CONSTRAINT "remarkable_event_source_document_id_remarkable_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."remarkable_documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "telegram_chats" ADD CONSTRAINT "telegram_chats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "telegram_config" ADD CONSTRAINT "telegram_config_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capacities_spaces_user_idx" ON "capacities_spaces" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capacities_spaces_space_idx" ON "capacities_spaces" USING btree ("user_id","space_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "favorite_sports_teams_user_idx" ON "favorite_sports_teams" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "favorite_sports_teams_team_idx" ON "favorite_sports_teams" USING btree ("user_id","league","team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ha_automations_user_idx" ON "ha_automations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ha_automations_enabled_idx" ON "ha_automations" USING btree ("user_id","enabled");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ha_automations_trigger_type_idx" ON "ha_automations" USING btree ("trigger_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ha_entity_timers_user_idx" ON "ha_entity_timers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ha_entity_timers_trigger_idx" ON "ha_entity_timers" USING btree ("trigger_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ha_entity_timers_entity_idx" ON "ha_entity_timers" USING btree ("user_id","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kiosks_user_idx" ON "kiosks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kiosks_token_idx" ON "kiosks" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "news_articles_feed_idx" ON "news_articles" USING btree ("feed_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "news_articles_published_idx" ON "news_articles" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "news_feeds_user_idx" ON "news_feeds" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "remarkable_documents_user_idx" ON "remarkable_documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "remarkable_documents_document_idx" ON "remarkable_documents" USING btree ("user_id","document_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "remarkable_documents_processed_idx" ON "remarkable_documents" USING btree ("user_id","is_processed");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "remarkable_event_source_event_idx" ON "remarkable_event_source" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "remarkable_event_source_document_idx" ON "remarkable_event_source" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sports_games_external_idx" ON "sports_games" USING btree ("provider","external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sports_games_time_idx" ON "sports_games" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sports_games_status_idx" ON "sports_games" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sports_games_teams_idx" ON "sports_games" USING btree ("home_team_id","away_team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "telegram_chats_user_idx" ON "telegram_chats" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "telegram_chats_chat_idx" ON "telegram_chats" USING btree ("chat_id");--> statement-breakpoint
ALTER TABLE "public"."kiosk_config" ALTER COLUMN "screensaver_layout" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "public"."kiosks" ALTER COLUMN "screensaver_layout" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."screensaver_layout";--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "public"."screensaver_layout" AS ENUM('fullscreen', 'informational', 'quad', 'scatter', 'builder');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "public"."kiosk_config" ALTER COLUMN "screensaver_layout" SET DATA TYPE "public"."screensaver_layout" USING "screensaver_layout"::"public"."screensaver_layout";--> statement-breakpoint
ALTER TABLE "public"."kiosks" ALTER COLUMN "screensaver_layout" SET DATA TYPE "public"."screensaver_layout" USING "screensaver_layout"::"public"."screensaver_layout";