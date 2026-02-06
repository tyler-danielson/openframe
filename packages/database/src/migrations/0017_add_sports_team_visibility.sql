-- Add visibility column to favorite_sports_teams table
ALTER TABLE "favorite_sports_teams" ADD COLUMN "visibility" jsonb DEFAULT '{"week":false,"month":false,"day":false,"popup":true,"screensaver":false}'::jsonb NOT NULL;
