-- Storage servers (FTP, SFTP, SMB, WebDAV)
DO $$ BEGIN
  CREATE TYPE storage_protocol AS ENUM ('ftp', 'sftp', 'smb', 'webdav');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS storage_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  protocol storage_protocol NOT NULL,
  host TEXT NOT NULL,
  port INTEGER,
  base_path TEXT DEFAULT '/',
  username TEXT,
  password TEXT,
  share_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS storage_servers_user_idx ON storage_servers(user_id);

-- Auto-backup configuration
CREATE TABLE IF NOT EXISTS auto_backup_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  storage_server_id UUID REFERENCES storage_servers(id) ON DELETE SET NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  interval_hours INTEGER NOT NULL DEFAULT 24,
  last_backup_at TIMESTAMPTZ,
  categories JSONB NOT NULL DEFAULT '["settings"]',
  include_photos BOOLEAN NOT NULL DEFAULT false,
  include_credentials BOOLEAN NOT NULL DEFAULT false,
  backup_path TEXT DEFAULT '/openframe-backups',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auto_backup_config_user_idx ON auto_backup_config(user_id);
