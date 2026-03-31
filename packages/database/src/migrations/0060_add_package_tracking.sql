-- Package Tracking
DO $$ BEGIN
  CREATE TYPE "carrier" AS ENUM ('usps', 'ups', 'fedex', 'amazon', 'dhl', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "package_status" AS ENUM ('pre_transit', 'in_transit', 'out_for_delivery', 'delivered', 'exception', 'unknown');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "tracked_packages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "household_id" uuid NOT NULL REFERENCES "households"("id") ON DELETE CASCADE,
  "carrier" "carrier" NOT NULL DEFAULT 'other',
  "tracking_number" text NOT NULL,
  "label" text,
  "status" "package_status" NOT NULL DEFAULT 'unknown',
  "status_detail" text,
  "expected_delivery" date,
  "delivered_at" timestamptz,
  "source" text NOT NULL DEFAULT 'manual',
  "raw_data" jsonb,
  "is_archived" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "tracked_packages_household_idx" ON "tracked_packages"("household_id");
CREATE INDEX IF NOT EXISTS "tracked_packages_status_idx" ON "tracked_packages"("status");

CREATE TABLE IF NOT EXISTS "usps_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "household_id" uuid NOT NULL REFERENCES "households"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "last_synced_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "usps_connections_household_idx" ON "usps_connections"("household_id");
