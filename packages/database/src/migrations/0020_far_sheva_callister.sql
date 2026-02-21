CREATE TYPE "public"."matter_device_type" AS ENUM('onOffLight', 'dimmableLight', 'colorTemperatureLight', 'thermostat', 'doorLock', 'contactSensor', 'occupancySensor', 'temperatureSensor', 'humiditySensor', 'onOffSwitch', 'windowCovering', 'fan', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."routine_frequency" AS ENUM('daily', 'weekly', 'custom');--> statement-breakpoint
CREATE TYPE "public"."ticket_category" AS ENUM('billing', 'bug', 'feature_request', 'account', 'general');--> statement-breakpoint
CREATE TYPE "public"."ticket_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'in_progress', 'waiting_on_user', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."youtube_bookmark_type" AS ENUM('video', 'live', 'playlist', 'channel');--> statement-breakpoint
ALTER TYPE "public"."screensaver_layout" ADD VALUE 'skylight';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audiobookshelf_servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"server_url" text NOT NULL,
	"access_token" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"provider" text,
	"model" text,
	"token_usage" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "companion_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text,
	"access_calendar" text DEFAULT 'view' NOT NULL,
	"access_tasks" text DEFAULT 'view' NOT NULL,
	"access_kiosks" boolean DEFAULT false NOT NULL,
	"access_photos" boolean DEFAULT false NOT NULL,
	"access_iptv" boolean DEFAULT false NOT NULL,
	"access_home_assistant" boolean DEFAULT false NOT NULL,
	"access_news" boolean DEFAULT true NOT NULL,
	"access_weather" boolean DEFAULT true NOT NULL,
	"access_recipes" boolean DEFAULT true NOT NULL,
	"allowed_calendar_ids" jsonb DEFAULT 'null'::jsonb,
	"allowed_task_list_ids" jsonb DEFAULT 'null'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "matter_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"node_id" text NOT NULL,
	"vendor_name" text,
	"product_name" text,
	"device_type" "matter_device_type" DEFAULT 'unknown' NOT NULL,
	"display_name" text NOT NULL,
	"room_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_reachable" boolean DEFAULT false NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plex_servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"server_url" text NOT NULL,
	"access_token" text NOT NULL,
	"machine_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "routine_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"routine_id" uuid NOT NULL,
	"completed_date" date NOT NULL,
	"completed_by_profile_id" uuid,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "routines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"icon" text,
	"category" text,
	"frequency" "routine_frequency" DEFAULT 'daily' NOT NULL,
	"days_of_week" integer[],
	"assigned_profile_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"content" text NOT NULL,
	"is_admin_reply" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"priority" "ticket_priority" DEFAULT 'normal' NOT NULL,
	"category" "ticket_category" DEFAULT 'general' NOT NULL,
	"assigned_admin_id" uuid,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" text DEFAULT 'free' NOT NULL,
	"plan_name" text DEFAULT 'Free' NOT NULL,
	"limits" jsonb NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_plans_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "youtube_bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"youtube_id" text NOT NULL,
	"type" "youtube_bookmark_type" DEFAULT 'video' NOT NULL,
	"title" text NOT NULL,
	"thumbnail_url" text,
	"channel_title" text,
	"channel_id" text,
	"duration" text,
	"is_live" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "youtube_watch_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"youtube_id" text NOT NULL,
	"type" "youtube_bookmark_type" DEFAULT 'video' NOT NULL,
	"title" text NOT NULL,
	"thumbnail_url" text,
	"channel_title" text,
	"watched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX IF EXISTS "calendars_external_idx";--> statement-breakpoint
ALTER TABLE "calendars" ADD COLUMN "oauth_token_id" uuid;--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN "user_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audiobookshelf_servers" ADD CONSTRAINT "audiobookshelf_servers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "companion_access" ADD CONSTRAINT "companion_access_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "companion_access" ADD CONSTRAINT "companion_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "matter_devices" ADD CONSTRAINT "matter_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "matter_devices" ADD CONSTRAINT "matter_devices_room_id_home_assistant_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."home_assistant_rooms"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "plex_servers" ADD CONSTRAINT "plex_servers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "routine_completions" ADD CONSTRAINT "routine_completions_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "routine_completions" ADD CONSTRAINT "routine_completions_completed_by_profile_id_family_profiles_id_fk" FOREIGN KEY ("completed_by_profile_id") REFERENCES "public"."family_profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "routines" ADD CONSTRAINT "routines_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "routines" ADD CONSTRAINT "routines_assigned_profile_id_family_profiles_id_fk" FOREIGN KEY ("assigned_profile_id") REFERENCES "public"."family_profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_admin_id_users_id_fk" FOREIGN KEY ("assigned_admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_plans" ADD CONSTRAINT "user_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "youtube_bookmarks" ADD CONSTRAINT "youtube_bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "youtube_watch_history" ADD CONSTRAINT "youtube_watch_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audiobookshelf_servers_user_idx" ON "audiobookshelf_servers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_conversations_user_idx" ON "chat_conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_messages_conversation_idx" ON "chat_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_messages_created_idx" ON "chat_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "companion_access_owner_idx" ON "companion_access" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "companion_access_user_idx" ON "companion_access" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "matter_devices_user_idx" ON "matter_devices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "matter_devices_node_idx" ON "matter_devices" USING btree ("node_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plex_servers_user_idx" ON "plex_servers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "routine_completions_routine_date_idx" ON "routine_completions" USING btree ("routine_id","completed_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "routine_completions_date_idx" ON "routine_completions" USING btree ("completed_date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "routine_completions_unique_idx" ON "routine_completions" USING btree ("routine_id","completed_date",COALESCE("completed_by_profile_id", '00000000-0000-0000-0000-000000000000'));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "routines_user_idx" ON "routines" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_messages_ticket_idx" ON "support_messages" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_messages_created_idx" ON "support_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_tickets_user_idx" ON "support_tickets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_tickets_status_idx" ON "support_tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_tickets_assigned_idx" ON "support_tickets" USING btree ("assigned_admin_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_tickets_created_idx" ON "support_tickets" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "youtube_bookmarks_user_idx" ON "youtube_bookmarks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "youtube_bookmarks_user_youtube_idx" ON "youtube_bookmarks" USING btree ("user_id","youtube_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "youtube_watch_history_user_idx" ON "youtube_watch_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "youtube_watch_history_user_youtube_idx" ON "youtube_watch_history" USING btree ("user_id","youtube_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "youtube_watch_history_watched_idx" ON "youtube_watch_history" USING btree ("watched_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendars" ADD CONSTRAINT "calendars_oauth_token_id_oauth_tokens_id_fk" FOREIGN KEY ("oauth_token_id") REFERENCES "public"."oauth_tokens"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "calendars_user_provider_external_idx" ON "calendars" USING btree ("user_id","provider","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "system_settings_user_category_key_idx" ON "system_settings" USING btree ("user_id","category","key");