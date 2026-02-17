-- Chat conversations
CREATE TABLE IF NOT EXISTS "chat_conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Chat messages
CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL REFERENCES "chat_conversations"("id") ON DELETE CASCADE,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "provider" text,
  "model" text,
  "token_usage" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS "chat_conversations_user_idx" ON "chat_conversations" ("user_id");
CREATE INDEX IF NOT EXISTS "chat_messages_conversation_idx" ON "chat_messages" ("conversation_id");
CREATE INDEX IF NOT EXISTS "chat_messages_created_idx" ON "chat_messages" ("conversation_id", "created_at");
