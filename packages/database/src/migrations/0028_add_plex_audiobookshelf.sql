-- Plex Servers
CREATE TABLE IF NOT EXISTS "plex_servers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "server_url" text NOT NULL,
  "access_token" text NOT NULL,
  "machine_id" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "last_synced_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "plex_servers_user_idx" ON "plex_servers" ("user_id");

-- Audiobookshelf Servers
CREATE TABLE IF NOT EXISTS "audiobookshelf_servers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "server_url" text NOT NULL,
  "access_token" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "last_synced_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "audiobookshelf_servers_user_idx" ON "audiobookshelf_servers" ("user_id");
