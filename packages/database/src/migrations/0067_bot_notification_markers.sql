-- Scheduled Telegram/WhatsApp notifications (apps/api/src/services/bot-notifications.ts).
-- What has been sent, so a restart doesn't send it again:
-- when the last daily agenda went out (it goes out once per local day)
ALTER TABLE telegram_config ADD COLUMN IF NOT EXISTS daily_agenda_sent_at timestamp with time zone;
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS daily_agenda_sent_at timestamp with time zone;
-- reminded event occurrences ("<event id>@<ISO start>"), kept until they start
ALTER TABLE telegram_config ADD COLUMN IF NOT EXISTS sent_reminders jsonb;
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS sent_reminders jsonb;
