CREATE TYPE "public"."photo_source" AS ENUM('local', 'google', 'facebook');--> statement-breakpoint
CREATE TYPE "public"."screensaver_layout" AS ENUM('fullscreen', 'side-by-side', 'quad', 'scatter');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "iptv_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "iptv_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"category_id" uuid,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"stream_url" text NOT NULL,
	"logo_url" text,
	"epg_channel_id" text,
	"stream_icon" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "iptv_epg" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "iptv_favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "iptv_servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"server_url" text NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "iptv_watch_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"watched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kiosk_config" ADD COLUMN "screensaver_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "kiosk_config" ADD COLUMN "screensaver_timeout" integer DEFAULT 300 NOT NULL;--> statement-breakpoint
ALTER TABLE "kiosk_config" ADD COLUMN "screensaver_interval" integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "kiosk_config" ADD COLUMN "screensaver_layout" "screensaver_layout" DEFAULT 'fullscreen' NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "source_type" "photo_source";--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "external_id" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "iptv_categories" ADD CONSTRAINT "iptv_categories_server_id_iptv_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."iptv_servers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "iptv_channels" ADD CONSTRAINT "iptv_channels_server_id_iptv_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."iptv_servers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "iptv_channels" ADD CONSTRAINT "iptv_channels_category_id_iptv_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."iptv_categories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "iptv_epg" ADD CONSTRAINT "iptv_epg_channel_id_iptv_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."iptv_channels"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "iptv_favorites" ADD CONSTRAINT "iptv_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "iptv_favorites" ADD CONSTRAINT "iptv_favorites_channel_id_iptv_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."iptv_channels"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "iptv_servers" ADD CONSTRAINT "iptv_servers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "iptv_watch_history" ADD CONSTRAINT "iptv_watch_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "iptv_watch_history" ADD CONSTRAINT "iptv_watch_history_channel_id_iptv_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."iptv_channels"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iptv_categories_server_idx" ON "iptv_categories" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iptv_categories_external_idx" ON "iptv_categories" USING btree ("server_id","external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iptv_channels_server_idx" ON "iptv_channels" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iptv_channels_category_idx" ON "iptv_channels" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iptv_channels_external_idx" ON "iptv_channels" USING btree ("server_id","external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iptv_epg_channel_idx" ON "iptv_epg" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iptv_epg_time_idx" ON "iptv_epg" USING btree ("start_time","end_time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iptv_favorites_user_idx" ON "iptv_favorites" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iptv_favorites_channel_idx" ON "iptv_favorites" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iptv_servers_user_idx" ON "iptv_servers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iptv_watch_history_user_idx" ON "iptv_watch_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iptv_watch_history_watched_idx" ON "iptv_watch_history" USING btree ("watched_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "photos_external_idx" ON "photos" USING btree ("source_type","external_id");