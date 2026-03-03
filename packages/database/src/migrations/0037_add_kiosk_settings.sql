-- Add per-kiosk settings JSONB column
ALTER TABLE kiosks ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}';
