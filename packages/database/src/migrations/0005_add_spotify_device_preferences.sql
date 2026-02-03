-- Add Spotify device preference fields to oauth_tokens
ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS default_device_id TEXT;
ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS favorite_device_ids TEXT[];
