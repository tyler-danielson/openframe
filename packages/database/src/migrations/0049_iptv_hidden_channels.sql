-- Add is_hidden column to iptv_channels for hiding unwanted channels
ALTER TABLE iptv_channels ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

-- Index for efficient filtering of hidden channels
CREATE INDEX IF NOT EXISTS iptv_channels_hidden_idx ON iptv_channels (is_hidden) WHERE is_hidden = true;
