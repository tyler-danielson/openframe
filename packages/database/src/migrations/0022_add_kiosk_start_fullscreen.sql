-- Add start_fullscreen column to kiosks table
ALTER TABLE "kiosks" ADD COLUMN IF NOT EXISTS "start_fullscreen" boolean NOT NULL DEFAULT false;
