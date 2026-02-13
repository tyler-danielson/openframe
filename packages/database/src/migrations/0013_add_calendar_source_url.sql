-- Add source_url column for ICS calendar subscriptions
ALTER TABLE calendars ADD COLUMN IF NOT EXISTS source_url TEXT;

-- Add index for looking up calendars by source URL
CREATE INDEX IF NOT EXISTS calendars_source_url_idx ON calendars(source_url) WHERE source_url IS NOT NULL;
