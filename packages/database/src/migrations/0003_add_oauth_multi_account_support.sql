-- Add multi-account support fields to oauth_tokens table
-- This enables multiple Spotify accounts (e.g., for family members) to be connected

-- Add accountName column for user-provided display name (e.g., "Dad's Spotify")
ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS account_name TEXT;

-- Add externalAccountId column for provider's user ID (e.g., Spotify user ID)
ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS external_account_id TEXT;

-- Add isPrimary column to mark the default account for each provider
ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE;

-- Create index for efficient lookups by external account ID
CREATE INDEX IF NOT EXISTS oauth_tokens_external_account_idx ON oauth_tokens (user_id, provider, external_account_id);

-- Set the first/only account of each provider as primary if none are set
UPDATE oauth_tokens t1
SET is_primary = TRUE
WHERE t1.id = (
    SELECT t2.id
    FROM oauth_tokens t2
    WHERE t2.user_id = t1.user_id
      AND t2.provider = t1.provider
    ORDER BY t2.created_at ASC
    LIMIT 1
)
AND NOT EXISTS (
    SELECT 1 FROM oauth_tokens t3
    WHERE t3.user_id = t1.user_id
      AND t3.provider = t1.provider
      AND t3.is_primary = TRUE
);
