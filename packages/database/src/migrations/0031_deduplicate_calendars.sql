-- Remove duplicate calendar rows, keeping the one with the most recent updatedAt
-- (or the lowest id as tiebreaker)
DELETE FROM calendars c1
USING calendars c2
WHERE c1.user_id = c2.user_id
  AND c1.provider = c2.provider
  AND c1.external_id = c2.external_id
  AND c1.id <> c2.id
  AND (
    c1.updated_at < c2.updated_at
    OR (c1.updated_at = c2.updated_at AND c1.id > c2.id)
  );

-- Drop the old non-unique index (replaced by the unique one below)
DROP INDEX IF EXISTS calendars_external_idx;

-- Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS calendars_user_provider_external_idx
ON calendars (user_id, provider, external_id);
