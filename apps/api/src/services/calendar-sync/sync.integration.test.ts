/**
 * End-to-end tests of calendar sync against a real Postgres, with provider
 * HTTP APIs faked. Skipped unless TEST_DATABASE_URL points at a disposable
 * database — its schema is dropped and re-migrated:
 *
 *   TEST_DATABASE_URL=postgres://localhost/openframe_test pnpm --filter @openframe/api test
 */
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "@openframe/database/schema";
import type { Database } from "@openframe/database";

const DATABASE_URL = process.env.TEST_DATABASE_URL;
const { calendars, events, oauthTokens, users } = schema;

process.env.ENCRYPTION_KEY ??= "0".repeat(64);
process.env.GOOGLE_CLIENT_ID ??= "test-client";
process.env.GOOGLE_CLIENT_SECRET ??= "test-secret";
process.env.MICROSOFT_CLIENT_ID ??= "test-client";
process.env.MICROSOFT_CLIENT_SECRET ??= "test-secret";

// --- fake provider APIs ------------------------------------------------------

type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>;
let routes: Array<{ method: string; match: (url: URL) => boolean; handler: Handler }> = [];
const calls: string[] = [];
const realFetch = globalThis.fetch;

function route(method: string, match: (url: URL) => boolean, handler: Handler) {
  routes.unshift({ method, match, handler }); // later registrations win
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function installFakeFetch() {
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = (init.method ?? "GET").toUpperCase();
    calls.push(`${method} ${url.origin}${url.pathname}`);
    const hit = routes.find((r) => r.method === method && r.match(url));
    if (!hit) return json({ error: `no fake for ${method} ${url.href}` }, 599);
    return hit.handler(url, init);
  }) as typeof fetch;
}

// --- helpers -------------------------------------------------------------------

let client: ReturnType<typeof postgres>;
let db: Database;
let userId: string;

async function resetDatabase() {
  await client.unsafe("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
  const migrationsFolder = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../../packages/database/src/migrations"
  );
  await migrate(db, { migrationsFolder });
}

async function createToken(provider: "google" | "microsoft", overrides: Partial<typeof oauthTokens.$inferInsert> = {}) {
  const scope =
    provider === "google"
      ? "openid email https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events"
      : "openid offline_access User.Read Calendars.ReadWrite";
  const [token] = await db
    .insert(oauthTokens)
    .values({
      userId,
      provider,
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: new Date(Date.now() + 3600_000),
      scope,
      ...overrides,
    })
    .returning();
  return token!;
}

async function eventRows(calendarId: string) {
  const { decryptEventFields } = await import("../../lib/encryption.js");
  const rows = await db.select().from(events).where(eq(events.calendarId, calendarId));
  return rows.map(decryptEventFields).sort((a, b) => a.externalId.localeCompare(b.externalId));
}

async function calendarByExternalId(externalId: string) {
  const [calendar] = await db
    .select()
    .from(calendars)
    .where(and(eq(calendars.userId, userId), eq(calendars.externalId, externalId)))
    .limit(1);
  return calendar;
}

const googleEventsPath = (calendarId: string) => (url: URL) =>
  url.hostname === "www.googleapis.com" && url.pathname === `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

// --- tests -----------------------------------------------------------------------

describe("calendar sync (integration)", { skip: !DATABASE_URL && "set TEST_DATABASE_URL to run" }, () => {
  before(async () => {
    client = postgres(DATABASE_URL!, { onnotice: () => {} });
    db = drizzle(client, { schema }) as unknown as Database;
    await resetDatabase();
    installFakeFetch();
  });

  after(async () => {
    globalThis.fetch = realFetch;
    await client?.end();
  });

  beforeEach(async () => {
    routes = [];
    calls.length = 0;
    await client.unsafe("TRUNCATE users CASCADE");
    const [user] = await db.insert(users).values({ email: "sync@example.com", timezone: "America/Denver" }).returning();
    userId = user!.id;
  });

  test("Google: full sync, incremental changes to a series, 410 recovery and calendar removal", async (t) => {
    // Fixtures are in Jan–Feb 2026; full syncs reconcile a window around "now"
    t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-01-20T12:00:00Z") });
    const { syncOAuthAccount } = await import("./index.js");
    const { queryEventsInRange } = await import("../calendar-events.js");
    const token = await createToken("google");

    route("GET", (u) => u.pathname === "/calendar/v3/users/me/calendarList", () =>
      json({
        items: [
          { id: "family@group.calendar.google.com", summary: "Family", accessRole: "owner", backgroundColor: "#ff0000" },
          { id: "holidays@group.v.calendar.google.com", summary: "Holidays", accessRole: "reader" },
        ],
      })
    );
    // Series: Mondays 18:00 Denver from Jan 5, one occurrence moved, one cancelled
    const series = {
      id: "series1",
      summary: "Soccer",
      start: { dateTime: "2026-01-05T18:00:00-07:00", timeZone: "America/Denver" },
      end: { dateTime: "2026-01-05T19:00:00-07:00", timeZone: "America/Denver" },
      recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=6"],
      status: "confirmed",
      etag: '"s1"',
    };
    route("GET", googleEventsPath("family@group.calendar.google.com"), (url) => {
      assert.equal(url.searchParams.get("singleEvents"), "false");
      assert.ok(url.searchParams.get("timeMin"));
      return json({
        items: [
          series,
          {
            id: "series1_20260113T010000Z",
            summary: "Soccer (moved)",
            recurringEventId: "series1",
            originalStartTime: { dateTime: "2026-01-12T18:00:00-07:00" },
            start: { dateTime: "2026-01-14T18:00:00-07:00" },
            end: { dateTime: "2026-01-14T19:00:00-07:00" },
            status: "confirmed",
            etag: '"m1"',
          },
          { id: "series1_20260120T010000Z", recurringEventId: "series1", originalStartTime: { dateTime: "2026-01-19T18:00:00-07:00" }, status: "cancelled" },
          { id: "single1", summary: "Dentist", start: { dateTime: "2026-01-07T09:00:00-07:00" }, end: { dateTime: "2026-01-07T10:00:00-07:00" }, status: "confirmed", etag: '"d1"' },
          { id: "allday1", summary: "Trip", start: { date: "2026-01-10" }, end: { date: "2026-01-12" }, status: "confirmed", etag: '"t1"' },
        ],
        nextSyncToken: "sync-1",
      });
    });
    // The Holidays calendar is gone for this account
    route("GET", googleEventsPath("holidays@group.v.calendar.google.com"), () => json({ error: { code: 404 } }, 404));

    const outcomes = await syncOAuthAccount(db, token);
    const family = (await calendarByExternalId("family@group.calendar.google.com"))!;
    const holidays = (await calendarByExternalId("holidays@group.v.calendar.google.com"))!;
    assert.deepEqual(outcomes.find((o) => o.calendarId === family.id), { calendarId: family.id, error: null });
    assert.match(outcomes.find((o) => o.calendarId === holidays.id)!.error!, /no longer returns this calendar/);
    assert.equal(holidays.lastSyncError?.includes("no longer returns"), true);
    assert.equal(family.lastSyncError, null);
    assert.equal(family.syncToken, "sync-1");
    assert.ok(family.fullSyncAt);
    assert.equal(family.oauthTokenId, token.id);
    // Other calendars of a connected account stay off the views until turned on
    assert.equal(family.visibility.month, false);

    let rows = await eventRows(family.id);
    assert.deepEqual(rows.map((r) => r.externalId), ["allday1", "series1", "series1_20260113T010000Z", "single1"]);
    const master = rows.find((r) => r.externalId === "series1")!;
    assert.equal(master.timeZone, "America/Denver");
    assert.deepEqual(master.exdates, ["2026-01-20T01:00:00.000Z"]);
    const trip = rows.find((r) => r.externalId === "allday1")!;
    assert.equal(trip.startTime.toISOString(), "2026-01-10T00:00:00.000Z");
    assert.equal(trip.endTime.toISOString(), "2026-01-11T00:00:00.000Z");

    // Occurrences as the calendar shows them: moved one replaced, cancelled one gone
    const occurrences = await queryEventsInRange(db, {
      calendarIds: [family.id],
      start: new Date("2026-01-01T07:00:00Z"),
      end: new Date("2026-02-15T06:59:59Z"),
      timeZone: "America/Denver",
    });
    const soccer = occurrences.filter((e) => e.title.startsWith("Soccer")).map((e) => e.startTime.toISOString());
    assert.deepEqual(soccer, [
      "2026-01-06T01:00:00.000Z", // Mon Jan 5
      "2026-01-15T01:00:00.000Z", // moved from Jan 12 to Wed Jan 14
      "2026-01-27T01:00:00.000Z", // Jan 19 cancelled
      "2026-02-03T01:00:00.000Z",
      "2026-02-10T01:00:00.000Z",
    ]);

    // Incremental: series renamed (exdates must survive), another occurrence
    // cancelled, the cancelled one restored, the single event deleted
    route("GET", googleEventsPath("family@group.calendar.google.com"), (url) => {
      assert.equal(url.searchParams.get("syncToken"), "sync-1");
      return json({
        items: [
          { ...series, summary: "Soccer practice", etag: '"s2"' },
          { id: "series1_20260203T010000Z", status: "cancelled" },
          {
            id: "series1_20260120T010000Z",
            summary: "Soccer practice",
            recurringEventId: "series1",
            originalStartTime: { dateTime: "2026-01-19T18:00:00-07:00" },
            start: { dateTime: "2026-01-19T18:00:00-07:00" },
            end: { dateTime: "2026-01-19T19:00:00-07:00" },
            status: "confirmed",
            etag: '"r1"',
          },
          { id: "single1", status: "cancelled" },
        ],
        nextSyncToken: "sync-2",
      });
    });
    await syncOAuthAccount(db, token, { calendarId: family.id });
    rows = await eventRows(family.id);
    assert.deepEqual(rows.map((r) => r.externalId), ["allday1", "series1", "series1_20260113T010000Z", "series1_20260120T010000Z"]);
    const renamed = rows.find((r) => r.externalId === "series1")!;
    assert.equal(renamed.title, "Soccer practice");
    assert.deepEqual(renamed.exdates, ["2026-02-03T01:00:00.000Z"]);

    // Sync token rejected → full resync, which also drops events Google no longer has
    let fullSyncs = 0;
    route("GET", googleEventsPath("family@group.calendar.google.com"), (url) => {
      if (url.searchParams.get("syncToken")) return json({ error: { code: 410 } }, 410);
      fullSyncs++;
      return json({ items: [{ ...series, summary: "Soccer practice", etag: '"s3"' }], nextSyncToken: "sync-3" });
    });
    await syncOAuthAccount(db, token, { calendarId: family.id });
    assert.equal(fullSyncs, 1);
    rows = await eventRows(family.id);
    assert.deepEqual(rows.map((r) => r.externalId), ["series1"]);
    assert.equal((await calendarByExternalId("family@group.calendar.google.com"))!.syncToken, "sync-3");

    // A calendar that disappears from the account's list is removed
    route("GET", (u) => u.pathname === "/calendar/v3/users/me/calendarList", () =>
      json({ items: [{ id: "family@group.calendar.google.com", summary: "Family", accessRole: "owner" }] })
    );
    await syncOAuthAccount(db, token);
    assert.equal(await calendarByExternalId("holidays@group.v.calendar.google.com"), undefined);
  });

  test("Google: events created locally and not yet pushed survive a full sync", async () => {
    const { syncOAuthAccount } = await import("./index.js");
    const token = await createToken("google");
    route("GET", (u) => u.pathname === "/calendar/v3/users/me/calendarList", () =>
      json({ items: [{ id: "primary", summary: "Me", accessRole: "owner", primary: true }] })
    );
    route("GET", googleEventsPath("primary"), () => json({ items: [], nextSyncToken: "t" }));
    await syncOAuthAccount(db, token);
    const calendar = (await calendarByExternalId("primary"))!;
    // The account's main calendar shows on the calendar views right away
    assert.deepEqual(calendar.visibility, { week: true, month: true, day: true, popup: true, screensaver: false });
    await db.insert(events).values({
      calendarId: calendar.id,
      externalId: "local_pending",
      title: "Not pushed yet",
      startTime: new Date(),
      endTime: new Date(),
    });
    await syncOAuthAccount(db, token, { calendarId: calendar.id, fullSync: true });
    assert.deepEqual((await eventRows(calendar.id)).map((r) => r.externalId), ["local_pending"]);
  });

  test("Google: expired tokens are refreshed and revoked access is reported per calendar", async () => {
    const { syncOAuthAccount } = await import("./index.js");
    const { decryptField } = await import("../../lib/encryption.js");
    const token = await createToken("google", { expiresAt: new Date(Date.now() - 1000) });
    let refreshes = 0;
    route("POST", (u) => u.hostname === "oauth2.googleapis.com", async (_url, init) => {
      refreshes++;
      assert.match(String(init.body), /grant_type=refresh_token/);
      assert.match(String(init.body), /client_id=test-client/);
      return json({ access_token: "fresh-token", expires_in: 3600 });
    });
    route("GET", (u) => u.pathname === "/calendar/v3/users/me/calendarList", (_url, init) => {
      assert.equal((init.headers as Record<string, string>).Authorization, "Bearer fresh-token");
      return json({ items: [{ id: "primary", summary: "Me", accessRole: "owner" }] });
    });
    route("GET", googleEventsPath("primary"), () => json({ items: [], nextSyncToken: "t" }));

    await syncOAuthAccount(db, token);
    assert.equal(refreshes, 1);
    const [stored] = await db.select().from(oauthTokens).where(eq(oauthTokens.id, token.id));
    assert.notEqual(stored!.accessToken, "fresh-token"); // encrypted at rest
    assert.equal(decryptField(stored!.accessToken), "fresh-token");
    assert.ok(stored!.expiresAt! > new Date());

    // Access revoked by the user
    await db.update(oauthTokens).set({ expiresAt: new Date(0) }).where(eq(oauthTokens.id, token.id));
    route("POST", (u) => u.hostname === "oauth2.googleapis.com", () =>
      json({ error: "invalid_grant", error_description: "Token has been expired or revoked." }, 400)
    );
    const [fresh] = await db.select().from(oauthTokens).where(eq(oauthTokens.id, token.id));
    const outcomes = await syncOAuthAccount(db, fresh!);
    assert.equal(outcomes.length, 1);
    assert.match(outcomes[0]!.error!, /reconnect the account/);
    assert.match((await calendarByExternalId("primary"))!.lastSyncError!, /reconnect the account/);
  });

  test("Microsoft: delta sync, removals, series details and account-scoped cleanup", async () => {
    const { syncOAuthAccount } = await import("./index.js");
    const token = await createToken("microsoft");
    route("GET", (u) => u.hostname === "graph.microsoft.com" && u.pathname === "/v1.0/me/calendars", () =>
      json({ value: [{ id: "cal-A", name: "Calendar", color: "lightBlue", isDefaultCalendar: true, canEdit: true }] })
    );
    route("GET", (u) => u.pathname === "/v1.0/me/calendars/cal-A/calendarView/delta", (url, init) => {
      assert.equal(url.searchParams.get("$select"), null); // unsupported by calendarView delta
      assert.match(String((init.headers as Record<string, string>).Prefer), /outlook\.timezone="UTC"/);
      return json({
        value: [
          { id: "e1", type: "singleInstance", subject: "Review", start: { dateTime: "2026-02-17T16:00:00.0000000", timeZone: "UTC" }, end: { dateTime: "2026-02-17T17:00:00.0000000", timeZone: "UTC" }, "@odata.etag": "a" },
          { id: "occ1", type: "occurrence", seriesMasterId: "master1", start: { dateTime: "2026-02-18T16:00:00.0000000", timeZone: "UTC" }, end: { dateTime: "2026-02-18T17:00:00.0000000", timeZone: "UTC" }, "@odata.etag": "b" },
          { id: "master1", type: "seriesMaster", subject: "Weekly", start: { dateTime: "2026-02-11T16:00:00.0000000", timeZone: "UTC" }, end: { dateTime: "2026-02-11T17:00:00.0000000", timeZone: "UTC" } },
        ],
        "@odata.deltaLink": "https://graph.microsoft.com/v1.0/me/calendars/cal-A/calendarView/delta?$deltatoken=d1",
      });
    });
    let masterFetches = 0;
    route("GET", (u) => u.pathname === "/v1.0/me/calendars/cal-A/events/master1", () => {
      masterFetches++;
      return json({ subject: "Weekly sync", location: { displayName: "Room 4" } });
    });

    await syncOAuthAccount(db, token);
    const cal = (await calendarByExternalId("cal-A"))!;
    assert.equal(cal.visibility.week, true); // the default calendar shows right away
    let rows = await eventRows(cal.id);
    assert.deepEqual(rows.map((r) => [r.externalId, r.title]), [["e1", "Review"], ["occ1", "Weekly sync"]]);
    assert.equal(rows[1]!.location, "Room 4");
    assert.equal(masterFetches, 1);
    assert.equal(cal.syncToken, "https://graph.microsoft.com/v1.0/me/calendars/cal-A/calendarView/delta?$deltatoken=d1");

    // Incremental round removes e1
    route("GET", (u) => u.searchParams.get("$deltatoken") === "d1", () =>
      json({ value: [{ id: "e1", "@removed": { reason: "deleted" } }], "@odata.deltaLink": "https://graph.microsoft.com/v1.0/me/calendars/cal-A/calendarView/delta?$deltatoken=d2" })
    );
    await syncOAuthAccount(db, token, { calendarId: cal.id });
    rows = await eventRows(cal.id);
    assert.deepEqual(rows.map((r) => r.externalId), ["occ1"]);

    // Another Microsoft account's calendars are never removed by this one
    const other = await createToken("microsoft");
    await db.insert(calendars).values({ userId, provider: "microsoft", externalId: "cal-B", name: "Other", oauthTokenId: other.id });
    await syncOAuthAccount(db, token);
    assert.ok(await calendarByExternalId("cal-B"));
  });

  test("ICS: feed changes are applied, unchanged events aren't rewritten", async () => {
    const { syncCalendarNow } = await import("./index.js");
    const feedUrl = "https://feeds.example.com/school.ics";
    let feed = [
      "BEGIN:VCALENDAR",
      "X-WR-TIMEZONE:America/Chicago",
      "BEGIN:VEVENT",
      "UID:e1",
      "SUMMARY:Early release",
      "DTSTART;VALUE=DATE:20260303",
      "BEGIN:VALARM",
      "DESCRIPTION:This is an event reminder",
      "END:VALARM",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:e2",
      "SUMMARY:Concert",
      "DTSTART:20260305T190000",
      "DURATION:PT2H",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    route("GET", (u) => u.href === feedUrl, () => new Response(feed, { status: 200 }));
    const [calendar] = await db
      .insert(calendars)
      .values({ userId, provider: "ics", externalId: feedUrl, name: "School", sourceUrl: feedUrl, isReadOnly: true })
      .returning();

    assert.equal((await syncCalendarNow(db, calendar!)).error, null);
    let rows = await eventRows(calendar!.id);
    assert.deepEqual(rows.map((r) => [r.externalId, r.title, r.description]), [["e1", "Early release", null], ["e2", "Concert", null]]);
    assert.equal(rows[1]!.startTime.toISOString(), "2026-03-06T01:00:00.000Z"); // 19:00 Chicago
    const firstWrite = rows.map((r) => r.updatedAt.getTime());

    await syncCalendarNow(db, calendar!);
    rows = await eventRows(calendar!.id);
    assert.deepEqual(rows.map((r) => r.updatedAt.getTime()), firstWrite);

    feed = feed.replace(/BEGIN:VEVENT\r\nUID:e2[\s\S]*?END:VEVENT\r\n/, "");
    await syncCalendarNow(db, calendar!);
    assert.deepEqual((await eventRows(calendar!.id)).map((r) => r.externalId), ["e1"]);

    route("GET", (u) => u.href === feedUrl, () => new Response("<html>moved</html>", { status: 200 }));
    const failed = await syncCalendarNow(db, calendar!);
    assert.match(failed.error!, /did not return an iCalendar/);
    assert.deepEqual((await eventRows(calendar!.id)).map((r) => r.externalId), ["e1"]); // kept on failure
  });

  test("scheduled runs skip calendars in backoff and don't overlap", async () => {
    const { runScheduledCalendarSync } = await import("./index.js");
    const feedUrl = "https://feeds.example.com/broken.ics";
    let fetches = 0;
    route("GET", (u) => u.href === feedUrl, () => {
      fetches++;
      return new Response("nope", { status: 500 });
    });
    await db.insert(calendars).values({ userId, provider: "ics", externalId: feedUrl, name: "Broken", sourceUrl: feedUrl });
    const log = { info: () => {}, error: () => {} };

    await Promise.all([runScheduledCalendarSync(db, log), runScheduledCalendarSync(db, log)]);
    const afterFirst = fetches; // 1 request + 1 retry, from a single pass
    assert.equal(afterFirst, 2);
    await runScheduledCalendarSync(db, log);
    assert.equal(fetches, afterFirst); // backing off
  });
});
