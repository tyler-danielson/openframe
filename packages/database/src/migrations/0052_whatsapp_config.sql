-- WhatsApp Bot Configuration
CREATE TABLE IF NOT EXISTS whatsapp_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  phone_number TEXT, -- Connected WhatsApp phone number
  display_name TEXT, -- WhatsApp display name
  is_connected BOOLEAN NOT NULL DEFAULT false,
  session_dir TEXT, -- Path to Baileys auth state directory
  -- Notification settings
  daily_agenda_enabled BOOLEAN NOT NULL DEFAULT true,
  daily_agenda_time TEXT NOT NULL DEFAULT '07:00', -- HH:mm format
  event_reminders_enabled BOOLEAN NOT NULL DEFAULT true,
  event_reminder_minutes INTEGER NOT NULL DEFAULT 15,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- WhatsApp Chat Links
CREATE TABLE IF NOT EXISTS whatsapp_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jid TEXT NOT NULL, -- WhatsApp JID (e.g., 1234567890@s.whatsapp.net)
  chat_type TEXT NOT NULL DEFAULT 'private', -- private, group
  chat_name TEXT, -- Contact or group name
  is_active BOOLEAN NOT NULL DEFAULT true,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS whatsapp_chats_user_idx ON whatsapp_chats(user_id);
CREATE INDEX IF NOT EXISTS whatsapp_chats_jid_idx ON whatsapp_chats(jid);
