-- Add kiosk display mode enum
DO $$ BEGIN
    CREATE TYPE "kiosk_display_mode" AS ENUM('full', 'screensaver-only', 'calendar-only', 'dashboard-only');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new columns to kiosks table
ALTER TABLE "kiosks" ADD COLUMN IF NOT EXISTS "display_mode" "kiosk_display_mode" NOT NULL DEFAULT 'full';
ALTER TABLE "kiosks" ADD COLUMN IF NOT EXISTS "home_page" text DEFAULT 'calendar';
ALTER TABLE "kiosks" ADD COLUMN IF NOT EXISTS "selected_calendar_ids" text[];
ALTER TABLE "kiosks" ADD COLUMN IF NOT EXISTS "enabled_features" jsonb;
