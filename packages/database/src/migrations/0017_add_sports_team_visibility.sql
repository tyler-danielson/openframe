-- Add visibility column to favorite_sports_teams table
ALTER TABLE "favorite_sports_teams" ADD COLUMN IF NOT EXISTS "visibility" jsonb DEFAULT '{"week":false,"month":false,"day":false,"popup":true,"screensaver":false}'::jsonb NOT NULL;
