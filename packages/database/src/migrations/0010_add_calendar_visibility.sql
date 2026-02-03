CREATE TYPE "public"."color_scheme" AS ENUM('default', 'homio', 'ocean', 'forest', 'sunset', 'lavender');--> statement-breakpoint
CREATE TYPE "public"."screensaver_transition" AS ENUM('fade', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'zoom');--> statement-breakpoint
ALTER TYPE "public"."oauth_provider" ADD VALUE 'spotify';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cameras" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"rtsp_url" text,
	"mjpeg_url" text,
	"snapshot_url" text,
	"username" text,
	"password" text,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "home_assistant_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"url" text NOT NULL,
	"access_token" text NOT NULL,
	"is_connected" boolean DEFAULT false NOT NULL,
	"last_connected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "home_assistant_config_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "home_assistant_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entity_id" text NOT NULL,
	"display_name" text,
	"room_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"show_in_dashboard" boolean DEFAULT false NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "home_assistant_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"temperature_sensor_id" text,
	"humidity_sensor_id" text,
	"window_sensor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"key" text NOT NULL,
	"value" text,
	"is_secret" boolean DEFAULT false NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendars" ADD COLUMN "show_on_dashboard" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "calendars" ADD COLUMN "visibility" jsonb DEFAULT '{"week":true,"month":true,"day":true,"popup":true}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "kiosk_config" ADD COLUMN "color_scheme" "color_scheme" DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "kiosk_config" ADD COLUMN "screensaver_transition" "screensaver_transition" DEFAULT 'fade' NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD COLUMN "account_name" text;--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD COLUMN "external_account_id" text;--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD COLUMN "is_primary" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD COLUMN "icon" text;--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD COLUMN "default_device_id" text;--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD COLUMN "favorite_device_ids" text[];--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cameras" ADD CONSTRAINT "cameras_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "home_assistant_config" ADD CONSTRAINT "home_assistant_config_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "home_assistant_entities" ADD CONSTRAINT "home_assistant_entities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "home_assistant_entities" ADD CONSTRAINT "home_assistant_entities_room_id_home_assistant_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."home_assistant_rooms"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "home_assistant_rooms" ADD CONSTRAINT "home_assistant_rooms_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cameras_user_idx" ON "cameras" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ha_entities_user_idx" ON "home_assistant_entities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ha_entities_entity_idx" ON "home_assistant_entities" USING btree ("user_id","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ha_entities_room_idx" ON "home_assistant_entities" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ha_rooms_user_idx" ON "home_assistant_rooms" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "system_settings_category_idx" ON "system_settings" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "system_settings_key_idx" ON "system_settings" USING btree ("category","key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_tokens_external_account_idx" ON "oauth_tokens" USING btree ("user_id","provider","external_account_id");