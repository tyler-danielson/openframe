-- SiriusXM accounts (user credentials)
CREATE TABLE IF NOT EXISTS siriusxm_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_authenticated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS siriusxm_accounts_user_idx ON siriusxm_accounts USING btree (user_id);

-- SiriusXM favorites
CREATE TABLE IF NOT EXISTS siriusxm_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS siriusxm_favorites_user_idx ON siriusxm_favorites USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS siriusxm_favorites_user_channel_idx ON siriusxm_favorites USING btree (user_id, channel_id);

-- SiriusXM listen history
CREATE TABLE IF NOT EXISTS siriusxm_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  listened_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS siriusxm_history_user_idx ON siriusxm_history USING btree (user_id);
CREATE INDEX IF NOT EXISTS siriusxm_history_listened_idx ON siriusxm_history USING btree (listened_at);
