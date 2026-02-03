-- Add show_on_dashboard column to calendars table
-- This setting is independent of isVisible and controls whether calendar events appear on the dashboard
ALTER TABLE calendars ADD COLUMN IF NOT EXISTS show_on_dashboard BOOLEAN DEFAULT true NOT NULL;
