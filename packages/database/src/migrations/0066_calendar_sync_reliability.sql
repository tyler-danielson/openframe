-- Calendar sync reliability (see apps/api/src/services/calendar-sync)

-- Why the last sync attempt failed (shown in Settings); null after a success
ALTER TABLE calendars ADD COLUMN IF NOT EXISTS last_sync_error text;
ALTER TABLE calendars ADD COLUMN IF NOT EXISTS last_sync_error_at timestamp with time zone;
-- Last full (non-incremental) sync. Periodic full syncs move the provider's
-- sync window forward and remove events deleted while sync state was lost.
ALTER TABLE calendars ADD COLUMN IF NOT EXISTS full_sync_at timestamp with time zone;

-- The IANA zone a recurring event is defined in (occurrences are expanded in
-- that zone so they keep their wall-clock time across DST changes), and the
-- starts of occurrences deleted from the series (EXDATE / cancelled instances)
ALTER TABLE events ADD COLUMN IF NOT EXISTS time_zone text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS exdates jsonb;
