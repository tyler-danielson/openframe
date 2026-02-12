DO $$ BEGIN
  CREATE TYPE "kiosk_display_type" AS ENUM ('touch', 'tv', 'display');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "kiosks" ADD COLUMN IF NOT EXISTS "display_type" "kiosk_display_type" NOT NULL DEFAULT 'touch';
