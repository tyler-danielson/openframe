-- Add userId to system_settings for multi-tenant support
-- userId = NULL means global/instance-level setting (self-hosted default)
-- userId = <uuid> means per-user setting (SaaS hosted mode)

ALTER TABLE system_settings
ADD COLUMN user_id uuid REFERENCES users(id) ON DELETE CASCADE;

-- Add unique index for (userId, category, key) to prevent duplicates
-- This replaces the old non-unique index as the primary lookup
CREATE UNIQUE INDEX IF NOT EXISTS system_settings_user_category_key_idx
ON system_settings (user_id, category, key);
