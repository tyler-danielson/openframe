-- Add source_url column for ICS calendar subscriptions
ALTER TABLE calendars ADD COLUMN source_url TEXT;

-- Add index for looking up calendars by source URL
CREATE INDEX calendars_source_url_idx ON calendars(source_url) WHERE source_url IS NOT NULL;
