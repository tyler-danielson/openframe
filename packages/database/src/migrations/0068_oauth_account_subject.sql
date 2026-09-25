-- The provider's permanent ID for a connected account (for Microsoft
-- "<tenant id>:<object id>"), so signing in with it finds the account it was
-- connected to without trusting the email address the provider reports.
ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS provider_subject text;
CREATE INDEX IF NOT EXISTS oauth_tokens_provider_subject_idx ON oauth_tokens (provider, provider_subject);
