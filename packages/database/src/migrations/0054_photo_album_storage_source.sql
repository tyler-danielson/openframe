-- Add storage server reference to photo albums
DO $$ BEGIN
  ALTER TABLE photo_albums ADD COLUMN storage_server_id UUID REFERENCES storage_servers(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE photo_albums ADD COLUMN storage_path TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;
