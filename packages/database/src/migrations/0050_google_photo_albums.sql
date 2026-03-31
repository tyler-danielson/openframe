-- Add Google Photos album linking and sync tracking to photo_albums
ALTER TABLE photo_albums ADD COLUMN IF NOT EXISTS google_album_id TEXT;
ALTER TABLE photo_albums ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
ALTER TABLE photo_albums ADD COLUMN IF NOT EXISTS auto_sync BOOLEAN DEFAULT false NOT NULL;
ALTER TABLE photo_albums ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'local' NOT NULL;

-- Index for finding linked Google albums
CREATE INDEX IF NOT EXISTS photo_albums_google_album_idx ON photo_albums (google_album_id) WHERE google_album_id IS NOT NULL;
