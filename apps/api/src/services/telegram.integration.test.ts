/**
 * The Telegram bot against a real Postgres, with Telegram's API faked.
 * Skipped unless TEST_DATABASE_URL points at a disposable database — its
 * schema is dropped and re-migrated.
 */
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "@openframe/database/schema";
import type { Database } from "@openframe/database";
import { chatLinkCode } from "../lib/chat-link.js";
import { decryptEventFields } from "../lib/encryption.js";
import { TelegramService } from "./telegram.js";

const DATABASE_URL = process.env.TEST_DATABASE_URL;
const { calendars, events, telegramChats, telegramConfig, users } = schema;
process.env.ENCRYPTION_KEY ??= "0".repeat(64);

let client: ReturnType<typeof postgres>;
let db: Database;
let userId: string;
let calendarId: string;

const realFetch = globalThis.fetch;
const sent: Array<{ chatId: string; text: string }> = [];

function installFakeTelegram() {
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    assert.match(url, /^https:\/\/api\.telegram\.org\/bot123:test-token\/sendMessage$/);
    const body = JSON.parse(String(init.body)) as { chat_id: string; text: string };
    sent.push({ chatId: String(body.chat_id), text: body.text });
    return new Response(JSON.stringify({ ok: true, result: { message_id: sent.length, chat: { id: 1 }, date: 0 } }), {
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

async function resetDatabase() {
  await client.unsafe("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
  const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../packages/database/src/migrations");
  await migrate(db, { migrationsFolder });
}

function bot() {
  const fastify = { db, log: { error() {}, warn() {}, info() {} } } as unknown as FastifyInstance;
  return new TelegramService(fastify, userId);
}

/** Send `text` from a private chat and return the bot's replies. */
async function message(text: string, chatId = 4242): Promise<string[]> {
  const before = sent.length;
  await bot().handleUpdate({
    update_id: 1,
    message: { message_id: 1, chat: { id: chatId, type: "private", first_name: "Sam" }, date: 0, text },
  });
  return sent.slice(before).map((m) => m.text);
}

describe("telegram bot (integration)", { skip: !DATABASE_URL && "set TEST_DATABASE_URL to run" }, () => {
  before(async () => {
    client = postgres(DATABASE_URL!, { onnotice: () => {} });
    db = drizzle(client, { schema }) as unknown as Database;
    await resetDatabase();
    installFakeTelegram();
  });

  after(async () => {
    globalThis.fetch = realFetch;
    await client?.end();
  });

  beforeEach(async () => {
    sent.length = 0;
    await client.unsafe("TRUNCATE users CASCADE");
    const [user] = await db.insert(users).values({ email: "bot@example.com", timezone: "America/Denver" }).returning();
    userId = user!.id;
    await db.insert(telegramConfig).values({ userId, botToken: "123:test-token", botUsername: "family_bot" });
    const [calendar] = await db
      .insert(calendars)
      .values({ userId, provider: "local", externalId: "local-family", name: "Family" })
      .returning();
    calendarId = calendar!.id;
  });

  test("chats that aren't linked can't read or add events, and /start needs the code", async () => {
    const notLinked = /isn't linked to OpenFrame/;
    assert.match((await message("/today"))[0]!, notLinked);
    assert.match((await message("/quick Dentist tomorrow at 3pm"))[0]!, notLinked);
    assert.deepEqual(await db.select().from(events).where(eq(events.calendarId, calendarId)), []);

    for (const attempt of ["/start", `/start ${userId}`, "/start not-the-code"]) {
      assert.match((await message(attempt))[0]!, notLinked, attempt);
    }
    assert.deepEqual(await db.select().from(telegramChats), []);

    assert.match((await message(`/start ${chatLinkCode("telegram", userId)}`))[0]!, /linked successfully/);
    const linked = await db.select().from(telegramChats);
    assert.deepEqual(linked.map((c) => c.chatId), ["4242"]);

    // Another chat is still not linked
    assert.match((await message("/today", 777))[0]!, notLinked);
  });

  test("/quick adds the event in the user's time zone", async (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-01-20T12:00:00Z") }); // 5am in Denver
    await message(`/start ${chatLinkCode("telegram", userId)}`);

    const [reply] = await message("/quick Dentist tomorrow at 3pm");
    assert.match(reply!, /Added <b>Dentist<\/b>/);
    assert.match(reply!, /Wed, Jan 21, 3:00 PM/);
    assert.match(reply!, /Family/);

    const rows = (await db.select().from(events).where(eq(events.calendarId, calendarId))).map(decryptEventFields);
    assert.deepEqual(
      rows.map((e) => [e.title, e.startTime.toISOString(), e.endTime.toISOString(), e.timeZone]),
      [["Dentist", "2026-01-21T22:00:00.000Z", "2026-01-21T23:00:00.000Z", "America/Denver"]]
    );

    // Replies escape event text for Telegram's HTML mode
    const [escaped] = await message("/quick Tom & Jerry <3 tomorrow");
    assert.match(escaped!, /Tom &amp; Jerry &lt;3/);
  });
});
