/**
 * Scheduled bot notifications against a real Postgres, with Telegram's API
 * faked. Skipped unless TEST_DATABASE_URL points at a disposable database —
 * its schema is dropped and re-migrated.
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
import { encryptEventFields } from "../lib/encryption.js";
import { sendDueBotNotifications } from "./bot-notifications.js";
import { TelegramService } from "./telegram.js";

const DATABASE_URL = process.env.TEST_DATABASE_URL;
const { calendars, events, telegramChats, telegramConfig, users, whatsappChats, whatsappConfig } = schema;
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

const noop = () => {};
const log = { error: noop, warn: noop, info: noop, debug: noop, child: () => log };
const fastify = () => ({ db, log }) as unknown as FastifyInstance;

/** One scheduler tick at `iso`; returns what was sent. Stateless between ticks, like a restart. */
async function tick(iso: string): Promise<Array<{ chatId: string; text: string }>> {
  const before = sent.length;
  await sendDueBotNotifications(fastify(), new Date(iso));
  return sent.slice(before);
}

async function addEvent(values: Partial<typeof events.$inferInsert> & { title: string; startTime: Date; endTime: Date }) {
  const [row] = await db
    .insert(events)
    .values(encryptEventFields({ calendarId, externalId: `ext-${Math.random()}`, ...values }))
    .returning();
  return row!;
}

async function settings(values: Partial<typeof telegramConfig.$inferInsert>) {
  await db.update(telegramConfig).set(values).where(eq(telegramConfig.userId, userId));
}

describe("scheduled bot notifications (integration)", { skip: !DATABASE_URL && "set TEST_DATABASE_URL to run" }, () => {
  before(async () => {
    client = postgres(DATABASE_URL!, { onnotice: () => {} });
    db = drizzle(client, { schema }) as unknown as Database;
    await client.unsafe("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
    const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../packages/database/src/migrations");
    await migrate(db, { migrationsFolder });
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
    // Defaults: agenda at 07:00, reminders 15 minutes before
    await db.insert(telegramConfig).values({ userId, botToken: "123:test-token", botUsername: "family_bot" });
    await db.insert(telegramChats).values([
      { userId, chatId: "4242", firstName: "Sam" },
      { userId, chatId: "999", firstName: "Unlinked", isActive: false },
    ]);
    const [calendar] = await db
      .insert(calendars)
      .values({ userId, provider: "local", externalId: "local-family", name: "Family" })
      .returning();
    calendarId = calendar!.id;
  });

  test("the daily agenda goes out once, at 07:00 in the user's zone, as /today", async () => {
    await settings({ eventRemindersEnabled: false });
    await addEvent({ title: "Tom & Jerry <3", startTime: new Date("2026-09-25T15:00:00Z"), endTime: new Date("2026-09-25T16:00:00Z") });

    assert.deepEqual(await tick("2026-09-25T12:59:00Z"), []); // 06:59 Denver
    const agenda = await tick("2026-09-25T13:00:30Z");
    assert.deepEqual(agenda.map((m) => m.chatId), ["4242"]); // linked, active chats only
    const expected = await new TelegramService(fastify(), userId).todayMessage(new Date("2026-09-25T13:00:30Z"), "America/Denver");
    assert.equal(agenda[0]!.text, expected);
    assert.match(expected, /Friday, September 25[\s\S]*9:00 AM - <b>Tom &amp; Jerry &lt;3<\/b>/);

    // Each tick reads the recorded state, so this is also a restart
    assert.deepEqual(await tick("2026-09-25T13:01:00Z"), []);
    assert.deepEqual(await tick("2026-09-25T14:00:00Z"), []);

    // Next day, with no events: the same "no events" reply as /today
    const [nextDay] = await tick("2026-09-26T13:00:00Z");
    assert.match(nextDay!.text, /No events scheduled for today/);
  });

  test("reminders go out once per occurrence, recurring ones included, never for all-day events", async () => {
    await settings({ dailyAgendaEnabled: false });
    const dentist = await addEvent({ title: "Dentist", location: "Main St", startTime: new Date("2026-09-25T16:00:00Z"), endTime: new Date("2026-09-25T17:00:00Z") });
    await addEvent({ title: "Standup", startTime: new Date("2026-09-24T18:00:00Z"), endTime: new Date("2026-09-24T18:15:00Z"), recurrenceRule: "RRULE:FREQ=DAILY", timeZone: "America/Denver" });
    await addEvent({ title: "Holiday", isAllDay: true, startTime: new Date("2026-09-26T00:00:00Z"), endTime: new Date("2026-09-26T00:00:00Z") });

    assert.deepEqual(await tick("2026-09-25T15:44:00Z"), []);
    const [reminder] = await tick("2026-09-25T15:45:10Z");
    assert.equal(reminder!.text, "🔔 <b>Starting in 15 minutes</b>\n\n⏰ 10:00 AM - <b>Dentist</b>\n   📍 Main St");
    assert.deepEqual(await tick("2026-09-25T15:46:00Z"), []);

    assert.deepEqual((await tick("2026-09-25T17:45:00Z")).map((m) => m.text.split("\n").at(-1)), ["⏰ 12:00 PM - <b>Standup</b>"]);
    assert.deepEqual(await tick("2026-09-25T17:50:00Z"), []);
    assert.equal((await tick("2026-09-26T17:45:00Z")).length, 1); // the next occurrence
    assert.deepEqual(await tick("2026-09-25T23:50:00Z"), []); // all-day event tomorrow

    // Moved to a new time: reminded for the new time
    await db.update(events).set({ startTime: new Date("2026-09-26T19:00:00Z"), endTime: new Date("2026-09-26T20:00:00Z") }).where(eq(events.id, dentist.id));
    assert.equal((await tick("2026-09-26T18:50:00Z")).length, 1);

    // Keys of occurrences that have started are dropped
    const [config] = await db.select().from(telegramConfig).where(eq(telegramConfig.userId, userId));
    assert.deepEqual(config!.sentReminders, [`${dentist.id}@2026-09-26T19:00:00.000Z`]);
  });

  test("nothing is sent when disabled, or without a linked chat", async () => {
    await addEvent({ title: "Dentist", startTime: new Date("2026-09-25T16:00:00Z"), endTime: new Date("2026-09-25T17:00:00Z") });
    await settings({ dailyAgendaEnabled: false, eventRemindersEnabled: false });
    assert.deepEqual(await tick("2026-09-25T13:00:00Z"), []);
    assert.deepEqual(await tick("2026-09-25T15:50:00Z"), []);

    await settings({ dailyAgendaEnabled: true, eventRemindersEnabled: true });
    await db.update(telegramChats).set({ isActive: false });
    assert.deepEqual(await tick("2026-09-25T13:00:00Z"), []);
    const [config] = await db.select().from(telegramConfig).where(eq(telegramConfig.userId, userId));
    assert.equal(config!.dailyAgendaSentAt, null); // not used up: goes out once a chat is linked
    await db.update(telegramChats).set({ isActive: true }).where(eq(telegramChats.chatId, "4242"));
    assert.equal((await tick("2026-09-25T13:05:00Z")).length, 1);
  });

  test("WhatsApp sends nothing, and records nothing, while disconnected", async () => {
    await db.delete(telegramConfig);
    await db.insert(whatsappConfig).values({ userId, isConnected: true });
    await db.insert(whatsappChats).values({ userId, jid: "1555@s.whatsapp.net" });
    await tick("2026-09-25T13:00:00Z");
    const [config] = await db.select().from(whatsappConfig).where(eq(whatsappConfig.userId, userId));
    assert.equal(config!.dailyAgendaSentAt, null);
  });
});
