-- Rename enum value from 'side-by-side' to 'informational' (if not already renamed)
DO $$ 
BEGIN
    -- Only rename if 'side-by-side' exists and 'informational' doesn't
    IF EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'side-by-side' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'screensaver_layout')
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'informational' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'screensaver_layout')
    ) THEN
        ALTER TYPE screensaver_layout RENAME VALUE 'side-by-side' TO 'informational';
    END IF;
END $$;
