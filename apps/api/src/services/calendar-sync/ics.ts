import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { calendars, events, users } from "@openframe/database/schema";
import type { Database } from "@openframe/database";
import { CalendarSyncError } from "./errors.js";
import { deleteEventsMissingFromListing, upsertSyncedEvents, type SyncedEvent } from "./event-store.js";
import { providerFetch, readTextLimited } from "./http.js";
import { parseIcs, type IcsCalendar } from "./ics-parser.js";

type CalendarRecord = typeof calendars.$inferSelect;

const MAX_FEED_BYTES = 20 * 1024 * 1024;

export function normalizeFeedUrl(url: string): string {
  return url.trim().replace(/^webcals?:\/\//i, "https://");
}

/** Download an ICS feed (http/https/webcal), with a timeout and size cap. */
export async function fetchIcsFeed(url: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(normalizeFeedUrl(url));
  } catch {
    throw new CalendarSyncError("Invalid calendar feed URL");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new CalendarSyncError("Calendar feed URL must start with https://, http:// or webcal://");
  }

  const response = await providerFetch(
    parsed.toString(),
    {
      headers: { "User-Agent": "OpenFrame/1.0", Accept: "text/calendar, text/plain;q=0.9, */*;q=0.8" },
      redirect: "follow",
    },
    { timeoutMs: 30_000, retries: 1 }
  );
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new CalendarSyncError(`Calendar feed returned HTTP ${response.status}`, response.status);
  }
  const content = await readTextLimited(response, MAX_FEED_BYTES);
  if (!/BEGIN:VCALENDAR/i.test(content)) {
    throw new CalendarSyncError("URL did not return an iCalendar (.ics) feed");
  }
  return content;
}

function contentHash(value: unknown): string {
  return createHash("sha1").update(JSON.stringify(value)).digest("hex");
}

/**
 * Turn a parsed feed into stored rows. Pure; exported for tests.
 *
 * - A VEVENT's UID is its externalId. Overrides (RECURRENCE-ID) share the
 *   UID, so they get `uid::<original start>` and point at their series.
 * - Cancelled overrides become exception dates on the series.
 * - Feeds that reuse a UID for unrelated events get the start appended.
 * - `etag` carries a hash of the row so unchanged events aren't rewritten.
 */
export function buildIcsRows(feed: IcsCalendar): SyncedEvent[] {
  const standaloneUidCounts = new Map<string, number>();
  for (const event of feed.events) {
    if (!event.recurrenceId && event.uid) {
      standaloneUidCounts.set(event.uid, (standaloneUidCounts.get(event.uid) ?? 0) + 1);
    }
  }

  const cancelledByUid = new Map<string, string[]>();
  for (const event of feed.events) {
    if (event.recurrenceId && event.uid && event.status === "cancelled") {
      const list = cancelledByUid.get(event.uid) ?? [];
      list.push(event.recurrenceId.toISOString());
      cancelledByUid.set(event.uid, list);
    }
  }

  const rows = new Map<string, SyncedEvent>();
  const seriesIdByUid = new Map<string, string>();

  // Series and standalone events first, so overrides can find their series
  for (const event of feed.events) {
    if (event.recurrenceId || event.status === "cancelled") continue;
    let externalId: string;
    if (!event.uid) {
      externalId = `nouid::${contentHash([event.summary, event.start.toISOString()]).slice(0, 16)}`;
    } else if ((standaloneUidCounts.get(event.uid) ?? 0) > 1) {
      externalId = `${event.uid}::${event.start.toISOString()}`;
    } else {
      externalId = event.uid;
    }
    if (event.uid && event.rrule && !seriesIdByUid.has(event.uid)) seriesIdByUid.set(event.uid, externalId);

    const exdates = event.rrule
      ? [...new Set([...event.exdates.map((d) => d.toISOString()), ...(event.uid ? (cancelledByUid.get(event.uid) ?? []) : [])])].sort()
      : null;
    const row: SyncedEvent = {
      externalId,
      title: event.summary,
      description: event.description,
      location: event.location,
      startTime: event.start,
      endTime: event.end,
      isAllDay: event.isAllDay,
      status: event.status === "tentative" ? "tentative" : "confirmed",
      recurrenceRule: event.rrule,
      timeZone: event.timeZone,
      exdates,
      recurringEventId: null,
      originalStartTime: null,
    };
    rows.set(externalId, { ...row, etag: `ics:${contentHash(row)}` });
  }

  for (const event of feed.events) {
    if (!event.recurrenceId || !event.uid || event.status === "cancelled") continue;
    const externalId = `${event.uid}::${event.recurrenceId.toISOString()}`;
    const row: SyncedEvent = {
      externalId,
      title: event.summary,
      description: event.description,
      location: event.location,
      startTime: event.start,
      endTime: event.end,
      isAllDay: event.isAllDay,
      status: event.status === "tentative" ? "tentative" : "confirmed",
      recurrenceRule: null,
      timeZone: event.timeZone,
      exdates: null,
      recurringEventId: seriesIdByUid.get(event.uid) ?? event.uid,
      originalStartTime: event.recurrenceId,
    };
    rows.set(externalId, { ...row, etag: `ics:${contentHash(row)}` });
  }

  return [...rows.values()];
}

/**
 * Sync a subscribed ICS feed. The feed is the source of truth: events it no
 * longer contains are removed. Only new or changed events are written.
 */
export async function syncIcsCalendar(
  db: Database,
  calendar: CalendarRecord,
  { force = false }: { force?: boolean } = {}
): Promise<void> {
  if (!calendar.sourceUrl) throw new CalendarSyncError("This calendar has no feed URL");
  const content = await fetchIcsFeed(calendar.sourceUrl);

  const [owner] = await db
    .select({ timezone: users.timezone })
    .from(users)
    .where(eq(users.id, calendar.userId))
    .limit(1);
  const rows = buildIcsRows(parseIcs(content, { defaultTimeZone: owner?.timezone }));

  const stored = await db
    .select({ externalId: events.externalId, etag: events.etag })
    .from(events)
    .where(eq(events.calendarId, calendar.id));
  const storedEtags = new Map(stored.map((row) => [row.externalId, row.etag]));
  const changed = force ? rows : rows.filter((row) => storedEtags.get(row.externalId) !== row.etag);

  await upsertSyncedEvents(db, calendar.id, changed);
  await deleteEventsMissingFromListing(db, calendar.id, new Set(rows.map((row) => row.externalId)), {
    providerRowsOnly: false,
  });

  const now = new Date();
  await db
    .update(calendars)
    .set({ lastSyncAt: now, fullSyncAt: now, updatedAt: now })
    .where(eq(calendars.id, calendar.id));
}
