/**
 * Editing and deleting single occurrences of recurring events, through the
 * events routes against a real Postgres with Google's API faked. Skipped
 * unless TEST_DATABASE_URL points at a disposable database — its schema is
 * dropped and re-migrated.
 */
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import sensible from "@fastify/sensible";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "@openframe/database/schema";
import type { Database } from "@openframe/database";
import { eventRoutes } from "./index.js";

const DATABASE_URL = process.env.TEST_DATABASE_URL;
const { calendars, events, oauthTokens, users } = schema;
process.env.ENCRYPTION_KEY ??= "0".repeat(64);

let client: ReturnType<typeof postgres>;
let db: Database;
let app: FastifyInstance;
let userId: string;

// --- fake Google API ---------------------------------------------------------

const realFetch = globalThis.fetch;
const calls: Array<{ method: string; path: string; body: unknown }> = [];
let googleStatus = 200;

function installFakeFetch() {
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = (init.method ?? "GET").toUpperCase();
    const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({ method, path: decodeURIComponent(url.pathname), body });
    if (googleStatus >= 400) return new Response(JSON.stringify({ error: { message: "boom" } }), { status: googleStatus });
    if (method === "DELETE") return new Response(null, { status: 204 });
    const id = decodeURIComponent(url.pathname.split("/").pop() ?? "");
    return new Response(JSON.stringify({ id, etag: `"etag-${calls.length}"` }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

// --- helpers -------------------------------------------------------------------

async function resetDatabase() {
  await client.unsafe("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
  const migrationsFolder = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../../packages/database/src/migrations"
  );
  await migrate(db, { migrationsFolder });
}

async function createCalendar(values: Partial<typeof calendars.$inferInsert>) {
  const [calendar] = await db
    .insert(calendars)
    .values({ userId, provider: "local", externalId: `cal-${Math.random()}`, name: "Family", syncEnabled: true, ...values })
    .returning();
  return calendar!;
}

async function listEvents(calendarId: string) {
  const res = await app.inject({
    method: "GET",
    url: `/events?start=2026-01-01T00:00:00Z&end=2026-02-15T00:00:00Z&tz=America/Denver&calendarIds=${calendarId}`,
  });
  assert.equal(res.statusCode, 200, res.body);
  return (res.json().data as Array<Record<string, unknown>>).map((e) => ({
    id: e.id as string,
    title: e.title as string,
    startTime: e.startTime as string,
    isRecurrenceInstance: !!e.isRecurrenceInstance,
    originalEventId: e.originalEventId as string | undefined,
  }));
}

const occurrenceUrl = (seriesId: string, start: string) => `/events/${seriesId}/occurrences/${encodeURIComponent(start)}`;

// Mondays 18:00 in Denver (01:00Z the next day in winter), four times
const WEEKLY = {
  title: "Practice",
  startTime: "2026-01-06T01:00:00.000Z",
  endTime: "2026-01-06T02:00:00.000Z",
  timeZone: "America/Denver",
  recurrenceRule: "FREQ=WEEKLY;COUNT=4",
};
const SLOTS = ["2026-01-06T01:00:00.000Z", "2026-01-13T01:00:00.000Z", "2026-01-20T01:00:00.000Z", "2026-01-27T01:00:00.000Z"];

// --- tests -----------------------------------------------------------------------

describe("recurring event occurrences (integration)", { skip: !DATABASE_URL && "set TEST_DATABASE_URL to run" }, () => {
  before(async () => {
    client = postgres(DATABASE_URL!, { onnotice: () => {} });
    db = drizzle(client, { schema }) as unknown as Database;
    await resetDatabase();
    installFakeFetch();

    app = Fastify();
    await app.register(sensible);
    app.decorate("db", db);
    app.decorate("authenticateKioskOrAny", async (request: FastifyRequest) => {
      request.user = { userId };
    });
    await app.register(eventRoutes, { prefix: "/events" });
    await app.ready();
  });

  after(async () => {
    globalThis.fetch = realFetch;
    await app?.close();
    await client?.end();
  });

  beforeEach(async () => {
    calls.length = 0;
    googleStatus = 200;
    await client.unsafe("TRUNCATE users CASCADE");
    const [user] = await db.insert(users).values({ email: "occurrences@example.com", timezone: "America/Denver" }).returning();
    userId = user!.id;
  });

  test("local calendar: change one occurrence, then delete occurrences and the series", async () => {
    const calendar = await createCalendar({ provider: "local", syncEnabled: false });
    const created = await app.inject({ method: "POST", url: "/events", payload: { ...WEEKLY, calendarId: calendar.id } });
    assert.equal(created.statusCode, 201, created.body);
    const seriesId = created.json().data.id as string;

    let listed = await listEvents(calendar.id);
    assert.deepEqual(listed.map((e) => e.startTime), SLOTS);
    assert.ok(listed.every((e) => e.isRecurrenceInstance && e.originalEventId === seriesId));

    // Move the second occurrence an hour later and rename it
    const moved = await app.inject({
      method: "PATCH",
      url: occurrenceUrl(seriesId, SLOTS[1]!),
      payload: { title: "Practice (late)", startTime: "2026-01-13T02:00:00.000Z", endTime: "2026-01-13T03:00:00.000Z" },
    });
    assert.equal(moved.statusCode, 200, moved.body);
    const overrideId = moved.json().data.id as string;

    listed = await listEvents(calendar.id);
    assert.deepEqual(
      listed.map((e) => [e.startTime, e.title]),
      [
        [SLOTS[0], "Practice"],
        ["2026-01-13T02:00:00.000Z", "Practice (late)"],
        [SLOTS[2], "Practice"],
        [SLOTS[3], "Practice"],
      ]
    );

    // A client still showing the old occurrence edits the same override
    const again = await app.inject({ method: "PATCH", url: occurrenceUrl(seriesId, SLOTS[1]!), payload: { title: "Practice (later)" } });
    assert.equal(again.statusCode, 200, again.body);
    assert.equal(again.json().data.id, overrideId);
    assert.equal((await listEvents(calendar.id)).length, 4);

    // Delete the third occurrence
    const deleted = await app.inject({ method: "DELETE", url: occurrenceUrl(seriesId, SLOTS[2]!) });
    assert.equal(deleted.statusCode, 200, deleted.body);
    listed = await listEvents(calendar.id);
    assert.deepEqual(listed.map((e) => e.startTime), [SLOTS[0], "2026-01-13T02:00:00.000Z", SLOTS[3]]);

    // Deleting the changed occurrence must not bring the original slot back
    const deletedOverride = await app.inject({ method: "DELETE", url: `/events/${overrideId}` });
    assert.equal(deletedOverride.statusCode, 200, deletedOverride.body);
    assert.deepEqual((await listEvents(calendar.id)).map((e) => e.startTime), [SLOTS[0], SLOTS[3]]);

    // Deleting the series removes it and anything left of its changed occurrences
    await app.inject({ method: "PATCH", url: occurrenceUrl(seriesId, SLOTS[3]!), payload: { title: "Last one" } });
    const deletedSeries = await app.inject({ method: "DELETE", url: `/events/${seriesId}` });
    assert.equal(deletedSeries.statusCode, 200, deletedSeries.body);
    assert.deepEqual(await listEvents(calendar.id), []);
    assert.deepEqual(await db.select().from(events).where(eq(events.calendarId, calendar.id)), []);
  });

  test("Google calendar: occurrence changes go to that instance, series edits keep exclusions", async () => {
    const [token] = await db
      .insert(oauthTokens)
      .values({
        userId,
        provider: "google",
        accessToken: "access-token",
        refreshToken: "refresh-token",
        expiresAt: new Date(Date.now() + 3600_000),
        scope: "https://www.googleapis.com/auth/calendar.events",
      })
      .returning();
    const calendar = await createCalendar({ provider: "google", externalId: "family@group.calendar.google.com", oauthTokenId: token!.id });
    const [series] = await db
      .insert(events)
      .values({
        calendarId: calendar.id,
        externalId: "gseries1",
        etag: '"etag-series"',
        title: "Practice",
        startTime: new Date(WEEKLY.startTime),
        endTime: new Date(WEEKLY.endTime),
        timeZone: "America/Denver",
        recurrenceRule: WEEKLY.recurrenceRule,
      })
      .returning();
    const base = "/calendar/v3/calendars/family@group.calendar.google.com/events";

    // Change one occurrence: PATCH that instance on Google
    const moved = await app.inject({ method: "PATCH", url: occurrenceUrl(series!.id, SLOTS[1]!), payload: { title: "Practice (late)" } });
    assert.equal(moved.statusCode, 200, moved.body);
    assert.deepEqual(calls.map((c) => `${c.method} ${c.path}`), [`PATCH ${base}/gseries1_20260113T010000Z`]);
    const [override] = await db.select().from(events).where(eq(events.id, moved.json().data.id));
    assert.equal(override!.externalId, "gseries1_20260113T010000Z");
    assert.equal(override!.recurringEventId, "gseries1");

    // Delete one occurrence: DELETE that instance on Google, EXDATE here
    calls.length = 0;
    const deleted = await app.inject({ method: "DELETE", url: occurrenceUrl(series!.id, SLOTS[2]!) });
    assert.equal(deleted.statusCode, 200, deleted.body);
    assert.deepEqual(calls.map((c) => `${c.method} ${c.path}`), [`DELETE ${base}/gseries1_20260120T010000Z`]);
    const [afterDelete] = await db.select().from(events).where(eq(events.id, series!.id));
    assert.deepEqual(afterDelete!.exdates, [SLOTS[2]]);

    // Renaming the series resends the exclusion with the rule
    calls.length = 0;
    const renamed = await app.inject({ method: "PATCH", url: `/events/${series!.id}`, payload: { title: "Team practice" } });
    assert.equal(renamed.statusCode, 200, renamed.body);
    assert.deepEqual((calls[0]!.body as { recurrence: string[] }).recurrence, [
      "RRULE:FREQ=WEEKLY;COUNT=4",
      "EXDATE;TZID=America/Denver:20260119T180000",
    ]);

    // When Google rejects an occurrence change, nothing is kept
    calls.length = 0;
    googleStatus = 500;
    const rejected = await app.inject({ method: "PATCH", url: occurrenceUrl(series!.id, SLOTS[3]!), payload: { title: "Nope" } });
    assert.equal(rejected.statusCode, 502, rejected.body);
    const overrides = await db.select().from(events).where(eq(events.recurringEventId, "gseries1"));
    assert.deepEqual(overrides.map((o) => o.externalId), ["gseries1_20260113T010000Z"]);
  });
});
