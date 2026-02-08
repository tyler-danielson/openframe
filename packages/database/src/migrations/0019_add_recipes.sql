-- Add recipes table for recipe hosting feature
CREATE TABLE IF NOT EXISTS "recipes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "description" text,
  "servings" integer,
  "prep_time" integer,
  "cook_time" integer,
  "ingredients" jsonb DEFAULT '[]'::jsonb,
  "instructions" jsonb DEFAULT '[]'::jsonb,
  "tags" text[] DEFAULT ARRAY[]::text[],
  "notes" text,
  "source_image_path" text,
  "thumbnail_path" text,
  "is_favorite" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS "recipes_user_idx" ON "recipes" ("user_id");
CREATE INDEX IF NOT EXISTS "recipes_favorite_idx" ON "recipes" ("user_id", "is_favorite");
CREATE INDEX IF NOT EXISTS "recipes_created_idx" ON "recipes" ("user_id", "created_at" DESC);

-- Add recipe upload tokens table for QR code mobile uploads
CREATE TABLE IF NOT EXISTS "recipe_upload_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token" text NOT NULL UNIQUE,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "recipe_upload_tokens_token_idx" ON "recipe_upload_tokens" ("token");
CREATE INDEX IF NOT EXISTS "recipe_upload_tokens_expires_idx" ON "recipe_upload_tokens" ("expires_at");
