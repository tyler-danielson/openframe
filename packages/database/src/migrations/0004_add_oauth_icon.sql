-- Add icon field to oauth_tokens for custom account icons
ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS icon TEXT;
