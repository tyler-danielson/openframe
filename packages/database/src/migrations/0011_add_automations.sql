-- Add automation trigger and action type enums
DO $$ BEGIN
    CREATE TYPE automation_trigger_type AS ENUM ('time', 'state', 'duration');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE automation_action_type AS ENUM ('service_call', 'notification');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create ha_automations table
CREATE TABLE ha_automations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT true NOT NULL,
    trigger_type automation_trigger_type NOT NULL,
    trigger_config JSONB NOT NULL,
    action_type automation_action_type NOT NULL,
    action_config JSONB NOT NULL,
    last_triggered_at TIMESTAMPTZ,
    trigger_count INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX ha_automations_user_idx ON ha_automations(user_id);
CREATE INDEX ha_automations_enabled_idx ON ha_automations(user_id, enabled);
CREATE INDEX ha_automations_trigger_type_idx ON ha_automations(trigger_type);
