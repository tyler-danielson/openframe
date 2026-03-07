-- Make user_id nullable (requests can come from unknown users)
ALTER TABLE join_requests ALTER COLUMN user_id DROP NOT NULL;

-- Add email and name for unauthenticated requests
ALTER TABLE join_requests ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE join_requests ADD COLUMN IF NOT EXISTS name TEXT;
