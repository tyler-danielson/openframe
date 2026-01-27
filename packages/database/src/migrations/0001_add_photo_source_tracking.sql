-- Add photo source tracking fields to photos table
-- This enables tracking where photos were imported from (local upload, Google Photos, Facebook, etc.)

-- Create the photo_source enum
DO $$ BEGIN
    CREATE TYPE photo_source AS ENUM ('local', 'google', 'facebook');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add sourceType column to photos table
ALTER TABLE photos ADD COLUMN IF NOT EXISTS source_type photo_source;

-- Add externalId column for deduplication
ALTER TABLE photos ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Create index for efficient duplicate checking
CREATE INDEX IF NOT EXISTS photos_external_idx ON photos (source_type, external_id);

-- Update existing photos to have source_type = 'local'
UPDATE photos SET source_type = 'local' WHERE source_type IS NULL;
