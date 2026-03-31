-- Kiosk saved files: photos and PDFs that can be recalled and cast to kiosk displays
CREATE TABLE IF NOT EXISTS kiosk_saved_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kiosk_id UUID NOT NULL REFERENCES kiosks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('image', 'pdf')),
    mime_type TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    page_count INTEGER,
    file_size INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX kiosk_saved_files_kiosk_idx ON kiosk_saved_files(kiosk_id);
