-- YouTube bookmark type enum
DO $$ BEGIN
  CREATE TYPE youtube_bookmark_type AS ENUM ('video', 'live', 'playlist', 'channel');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- YouTube bookmarks
CREATE TABLE IF NOT EXISTS youtube_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  youtube_id TEXT NOT NULL,
  type youtube_bookmark_type NOT NULL DEFAULT 'video',
  title TEXT NOT NULL,
  thumbnail_url TEXT,
  channel_title TEXT,
  channel_id TEXT,
  duration TEXT,
  is_live BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS youtube_bookmarks_user_idx ON youtube_bookmarks(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS youtube_bookmarks_user_youtube_idx ON youtube_bookmarks(user_id, youtube_id);

-- YouTube watch history
CREATE TABLE IF NOT EXISTS youtube_watch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  youtube_id TEXT NOT NULL,
  type youtube_bookmark_type NOT NULL DEFAULT 'video',
  title TEXT NOT NULL,
  thumbnail_url TEXT,
  channel_title TEXT,
  watched_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS youtube_watch_history_user_idx ON youtube_watch_history(user_id);
CREATE INDEX IF NOT EXISTS youtube_watch_history_user_youtube_idx ON youtube_watch_history(user_id, youtube_id);
CREATE INDEX IF NOT EXISTS youtube_watch_history_watched_idx ON youtube_watch_history(watched_at);
