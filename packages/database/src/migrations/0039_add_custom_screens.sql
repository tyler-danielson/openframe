-- Custom screens table for user-created dashboard screens
CREATE TABLE IF NOT EXISTS custom_screens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'LayoutDashboard',
  slug TEXT NOT NULL,
  layout_config JSONB NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS custom_screens_user_idx ON custom_screens(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS custom_screens_user_slug_idx ON custom_screens(user_id, slug);
