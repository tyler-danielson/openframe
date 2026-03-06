ALTER TABLE "calendars" ADD COLUMN IF NOT EXISTS "kiosk_enabled" boolean NOT NULL DEFAULT true;
