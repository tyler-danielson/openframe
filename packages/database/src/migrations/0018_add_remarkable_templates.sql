-- Template type enum
CREATE TYPE remarkable_template_type AS ENUM (
    'weekly_planner',
    'habit_tracker',
    'custom_agenda',
    'user_designed'
);

-- Schedule type enum
CREATE TYPE remarkable_schedule_type AS ENUM (
    'daily',
    'weekly',
    'monthly',
    'manual'
);

-- reMarkable Templates - stores template configurations
CREATE TABLE remarkable_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    template_type remarkable_template_type NOT NULL,
    config JSONB DEFAULT '{}' NOT NULL,
    pdf_template BYTEA, -- for user-uploaded PDF templates
    merge_fields JSONB, -- defines merge field positions for user templates
    folder_path TEXT DEFAULT '/Calendar' NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX remarkable_templates_user_idx ON remarkable_templates(user_id);
CREATE INDEX remarkable_templates_type_idx ON remarkable_templates(user_id, template_type);
CREATE INDEX remarkable_templates_active_idx ON remarkable_templates(user_id, is_active);

-- reMarkable Schedules - unified scheduling for templates and default agenda
CREATE TABLE remarkable_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_id UUID REFERENCES remarkable_templates(id) ON DELETE CASCADE, -- null for default agenda
    schedule_type remarkable_schedule_type NOT NULL DEFAULT 'daily',
    enabled BOOLEAN DEFAULT true NOT NULL,
    push_time TEXT DEFAULT '06:00' NOT NULL, -- HH:mm format
    push_day INTEGER, -- 0-6 for weekly (Sunday=0), 1-31 for monthly
    timezone TEXT DEFAULT 'UTC' NOT NULL,
    last_push_at TIMESTAMPTZ,
    next_push_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX remarkable_schedules_user_idx ON remarkable_schedules(user_id);
CREATE INDEX remarkable_schedules_template_idx ON remarkable_schedules(template_id);
CREATE INDEX remarkable_schedules_enabled_idx ON remarkable_schedules(user_id, enabled);
CREATE INDEX remarkable_schedules_next_push_idx ON remarkable_schedules(next_push_at) WHERE enabled = true;

-- reMarkable Processed Confirmations - tracks confirmations sent back after note processing
CREATE TABLE remarkable_processed_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES remarkable_documents(id) ON DELETE CASCADE,
    confirmation_type TEXT NOT NULL DEFAULT 'events_created', -- type of confirmation
    confirmation_document_id TEXT, -- document ID of the pushed confirmation PDF
    events_confirmed JSONB, -- array of event summaries that were confirmed
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX remarkable_processed_confirmations_user_idx ON remarkable_processed_confirmations(user_id);
CREATE INDEX remarkable_processed_confirmations_document_idx ON remarkable_processed_confirmations(document_id);
CREATE INDEX remarkable_processed_confirmations_created_idx ON remarkable_processed_confirmations(user_id, created_at DESC);
