-- Add showOnCalendar to routines (default off — opt-in)
ALTER TABLE routines ADD COLUMN IF NOT EXISTS show_on_calendar BOOLEAN NOT NULL DEFAULT false;

-- Add showOnCalendar to tasks (default off — opt-in)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS show_on_calendar BOOLEAN NOT NULL DEFAULT false;
