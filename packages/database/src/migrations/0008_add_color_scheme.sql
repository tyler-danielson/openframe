-- Add color scheme enum
DO $$ BEGIN
  CREATE TYPE "color_scheme" AS ENUM ('default', 'homio', 'ocean', 'forest', 'sunset', 'lavender');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add color_scheme column to kiosk_config
ALTER TABLE "kiosk_config" ADD COLUMN IF NOT EXISTS "color_scheme" "color_scheme" DEFAULT 'default' NOT NULL;
