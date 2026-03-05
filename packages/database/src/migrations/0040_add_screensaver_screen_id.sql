-- Add screensaver_screen_id to kiosks table
-- Allows a kiosk to use a custom screen as its screensaver
ALTER TABLE "kiosks" ADD COLUMN IF NOT EXISTS "screensaver_screen_id" uuid REFERENCES "custom_screens"("id") ON DELETE SET NULL;
