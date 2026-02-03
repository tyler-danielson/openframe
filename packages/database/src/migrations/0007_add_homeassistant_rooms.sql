-- Add Home Assistant rooms table for HOMIO-style organization
CREATE TABLE IF NOT EXISTS "home_assistant_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"temperature_sensor_id" text,
	"humidity_sensor_id" text,
	"window_sensor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "home_assistant_rooms_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Create index for user lookup
CREATE INDEX IF NOT EXISTS "ha_rooms_user_idx" ON "home_assistant_rooms" ("user_id");

-- Add room_id column to home_assistant_entities table
ALTER TABLE "home_assistant_entities" ADD COLUMN IF NOT EXISTS "room_id" uuid;

-- Add foreign key constraint for room_id
ALTER TABLE "home_assistant_entities"
ADD CONSTRAINT "ha_entities_room_id_fk"
FOREIGN KEY ("room_id") REFERENCES "home_assistant_rooms"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Create index for room lookup
CREATE INDEX IF NOT EXISTS "ha_entities_room_idx" ON "home_assistant_entities" ("room_id");
