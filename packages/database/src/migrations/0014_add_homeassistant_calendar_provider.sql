-- Add homeassistant to calendar_provider enum
ALTER TYPE calendar_provider ADD VALUE IF NOT EXISTS 'homeassistant';
