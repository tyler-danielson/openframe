/**
 * Migration script: encrypt existing plaintext data at rest.
 *
 * Encrypts:
 *   - oauth_tokens: accessToken, refreshToken
 *   - events: title, description, location
 *
 * Idempotent — already-encrypted values are skipped.
 *
 * Usage:
 *   npx tsx apps/api/src/scripts/encrypt-existing-data.ts
 *
 * Requires DATABASE_URL and ENCRYPTION_KEY env vars.
 */

import { createDatabase } from "@openframe/database";
import { oauthTokens, events } from "@openframe/database/schema";
import { eq } from "drizzle-orm";
import { isEncrypted, encryptField } from "../lib/encryption.js";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

if (!process.env.ENCRYPTION_KEY) {
  console.error("ENCRYPTION_KEY not set");
  process.exit(1);
}

const db = createDatabase(DATABASE_URL);

async function encryptOAuthTokens() {
  console.log("\n=== Encrypting OAuth tokens ===");

  const allTokens = await db.select().from(oauthTokens);
  console.log(`Found ${allTokens.length} OAuth token rows`);

  let encrypted = 0;
  let skipped = 0;

  // Process in batches of 50
  for (let i = 0; i < allTokens.length; i += 50) {
    const batch = allTokens.slice(i, i + 50);

    for (const token of batch) {
      const needsEncrypt =
        (token.accessToken && !isEncrypted(token.accessToken)) ||
        (token.refreshToken && !isEncrypted(token.refreshToken));

      if (!needsEncrypt) {
        skipped++;
        continue;
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };

      if (token.accessToken && !isEncrypted(token.accessToken)) {
        updates.accessToken = encryptField(token.accessToken);
      }
      if (token.refreshToken && !isEncrypted(token.refreshToken)) {
        updates.refreshToken = encryptField(token.refreshToken);
      }

      await db
        .update(oauthTokens)
        .set(updates)
        .where(eq(oauthTokens.id, token.id));

      encrypted++;
    }

    console.log(`  Processed ${Math.min(i + 50, allTokens.length)}/${allTokens.length} tokens`);
  }

  console.log(`Done: ${encrypted} encrypted, ${skipped} already encrypted`);
}

async function encryptEvents() {
  console.log("\n=== Encrypting event fields ===");

  const allEvents = await db.select().from(events);
  console.log(`Found ${allEvents.length} event rows`);

  let encrypted = 0;
  let skipped = 0;

  // Process in batches of 100
  for (let i = 0; i < allEvents.length; i += 100) {
    const batch = allEvents.slice(i, i + 100);

    for (const event of batch) {
      const titleNeedsEncrypt = event.title && !isEncrypted(event.title);
      const descNeedsEncrypt = event.description && !isEncrypted(event.description);
      const locNeedsEncrypt = event.location && !isEncrypted(event.location);

      if (!titleNeedsEncrypt && !descNeedsEncrypt && !locNeedsEncrypt) {
        skipped++;
        continue;
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };

      if (titleNeedsEncrypt) {
        updates.title = encryptField(event.title);
      }
      if (descNeedsEncrypt) {
        updates.description = encryptField(event.description);
      }
      if (locNeedsEncrypt) {
        updates.location = encryptField(event.location);
      }

      await db
        .update(events)
        .set(updates)
        .where(eq(events.id, event.id));

      encrypted++;
    }

    console.log(`  Processed ${Math.min(i + 100, allEvents.length)}/${allEvents.length} events`);
  }

  console.log(`Done: ${encrypted} encrypted, ${skipped} already encrypted`);
}

async function main() {
  console.log("Starting encryption migration...");

  try {
    await encryptOAuthTokens();
    await encryptEvents();
    console.log("\nEncryption migration complete!");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }

  process.exit(0);
}

main();
