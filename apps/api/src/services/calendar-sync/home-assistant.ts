import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { calendars, events } from "@openframe/database/schema";
import type { Database } from "@openframe/database";
import { addUtcDays, parseDateOnlyUtc } from "../../lib/timezone.js";
import { CalendarNotFoundError, CalendarSyncError } from "./errors.js";
import { deleteEventsMissingFromListing, upsertSyncedEvents, type SyncedEvent } from "./event-store.js";
import { providerFetch } from "./http.js";

export interface HomeAssistantEvent {
  uid?: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  recurrence_id?: string;
  rrule?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_PAST_DAYS = 30;
const WINDOW_FUTURE_DAYS = 180;

/**
 * Map Home Assistant's calendar API events to stored rows. Pure; exported
 * for tests.
 *
 * HA returns recurring events already expanded (with correct DST handling),
 * so each occurrence is stored as its own row and no rule is kept.
 */
export function mapHomeAssistantEvents(haEvents: HomeAssistantEvent[]): SyncedEvent[] {
  const rows: SyncedEvent[] = [];
  const used = new Map<string, number>();

  for (const haEvent of haEvents) {
    const isAllDay = !haEvent.start.dateTime;
    const startTime = haEvent.start.dateTime
      ? new Date(haEvent.start.dateTime)
      : parseDateOnlyUtc(haEvent.start.date ?? "");
    if (Number.isNaN(startTime.getTime())) continue;

    let endTime: Date;
    if (isAllDay) {
      // HA all-day end dates are exclusive; store the inclusive last day
      endTime = haEvent.end.date ? addUtcDays(parseDateOnlyUtc(haEvent.end.date), -1) : startTime;
    } else {
      endTime = haEvent.end.dateTime ? new Date(haEvent.end.dateTime) : startTime;
    }
    if (Number.isNaN(endTime.getTime()) || endTime < startTime) endTime = startTime;

    const dateKey = haEvent.start.dateTime || haEvent.start.date || "";
    const baseId = haEvent.uid
      ? haEvent.rrule || haEvent.recurrence_id
        ? `${haEvent.uid}|${dateKey}`
        : haEvent.uid
      : `${haEvent.summary ?? ""}-${dateKey}`;
    // Keep same-named, same-time events without a UID distinct
    const count = (used.get(baseId) ?? 0) + 1;
    used.set(baseId, count);
    const externalId = count === 1 ? baseId : `${baseId}#${count}`;

    const row: SyncedEvent = {
      externalId,
      title: haEvent.summary || "(No title)",
      description: haEvent.description || null,
      location: haEvent.location || null,
      startTime,
      endTime,
      isAllDay,
      status: "confirmed",
      recurrenceRule: null,
      timeZone: null,
      exdates: null,
      recurringEventId: null,
      originalStartTime: null,
    };
    rows.push({ ...row, etag: `ha:${createHash("sha1").update(JSON.stringify(row)).digest("hex")}` });
  }
  return rows;
}

/** Sync a Home Assistant calendar entity into `calendarId`. */
export async function syncHomeAssistantEvents(
  db: Database,
  { calendarId, entityId, haUrl, haToken }: { calendarId: string; entityId: string; haUrl: string; haToken: string }
): Promise<void> {
  const now = new Date();
  const window = {
    start: new Date(now.getTime() - WINDOW_PAST_DAYS * DAY_MS),
    end: new Date(now.getTime() + WINDOW_FUTURE_DAYS * DAY_MS),
  };

  const url = new URL(`${haUrl.replace(/\/+$/, "")}/api/calendars/${encodeURIComponent(entityId)}`);
  url.searchParams.set("start", window.start.toISOString());
  url.searchParams.set("end", window.end.toISOString());
  const response = await providerFetch(
    url.toString(),
    { headers: { Authorization: `Bearer ${haToken}`, "Content-Type": "application/json" } },
    { userSupplied: true }
  );
  if (response.status === 404) throw new CalendarNotFoundError("Home Assistant");
  if (!response.ok) {
    throw new CalendarSyncError(`Home Assistant returned HTTP ${response.status}`, response.status);
  }

  const rows = mapHomeAssistantEvents((await response.json()) as HomeAssistantEvent[]);
  const stored = await db
    .select({ externalId: events.externalId, etag: events.etag })
    .from(events)
    .where(eq(events.calendarId, calendarId));
  const storedEtags = new Map(stored.map((row) => [row.externalId, row.etag]));

  await upsertSyncedEvents(
    db,
    calendarId,
    rows.filter((row) => storedEtags.get(row.externalId) !== row.etag)
  );
  // Only the fetched window is authoritative; older events are history
  await deleteEventsMissingFromListing(db, calendarId, new Set(rows.map((row) => row.externalId)), {
    providerRowsOnly: false,
    window,
  });

  await db
    .update(calendars)
    .set({ lastSyncAt: now, fullSyncAt: now, updatedAt: now })
    .where(eq(calendars.id, calendarId));
}
