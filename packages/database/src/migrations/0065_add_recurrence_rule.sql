-- Add monthly and yearly to routine_frequency enum
ALTER TYPE routine_frequency ADD VALUE IF NOT EXISTS 'monthly';
ALTER TYPE routine_frequency ADD VALUE IF NOT EXISTS 'yearly';

-- Add recurrence_rule JSONB column
DO $$ BEGIN
  ALTER TABLE routines ADD COLUMN recurrence_rule JSONB;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- Backfill existing routines with recurrence_rule from frequency + days_of_week
UPDATE routines
SET recurrence_rule = jsonb_build_object(
  'frequency', CASE WHEN frequency = 'custom' THEN 'weekly' ELSE frequency::text END,
  'interval', 1,
  'daysOfWeek', COALESCE(days_of_week, ARRAY[]::integer[]),
  'endType', 'never'
)
WHERE recurrence_rule IS NULL;
