-- Add 'builder' value to screensaver_layout enum (if not already present)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'builder' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'screensaver_layout')
    ) THEN
        ALTER TYPE screensaver_layout ADD VALUE 'builder';
    END IF;
END $$;
