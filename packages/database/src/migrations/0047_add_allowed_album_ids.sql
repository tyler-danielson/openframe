-- Add allowed_album_ids column to companion_access table
DO $$ BEGIN
  ALTER TABLE companion_access ADD COLUMN allowed_album_ids jsonb DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
