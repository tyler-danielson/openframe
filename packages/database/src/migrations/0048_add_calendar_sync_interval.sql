-- Add configurable sync interval (in minutes) per calendar
-- NULL means use the system default
ALTER TABLE calendars ADD COLUMN IF NOT EXISTS sync_interval integer;
