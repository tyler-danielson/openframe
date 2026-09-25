import { and, eq, inArray, isNull, notInArray, or } from "drizzle-orm";
import { calendars, events, oauthTokens } from "@openframe/database/schema";
import type { Database } from "@openframe/database";
import { decryptEventFields } from "../../lib/encryption.js";
import { addUtcDays, getZonedParts, normalizeTimeZone, parseDateOnlyUtc, resolveTimeZone } from "../../lib/timezone.js";
import { allDayDateSpan } from "./all-day.js";
import { CalendarNotFoundError, CalendarSyncError, SyncStateExpiredError, describeSyncError } from "./errors.js";
import {
  deleteEventsByExternalId,
  deleteEventsMissingFromListing,
  getExistingEvents,
  upsertSyncedEvents,
  type SyncedEvent,
} from "./event-store.js";
import { providerFetch } from "./http.js";
import { parseDatePropertyLine } from "./ics-parser.js";
import { getValidAccessToken, type OAuthToken } from "./oauth.js";
import { extractRRuleValue } from "./recurrence.js";
import { SHOWN_CALENDAR_VISIBILITY } from "../../lib/calendar-visibility.js";

interface GoogleCalendar {
  id: string;
  summary: string;
  summaryOverride?: string;
  description?: string;
  backgroundColor?: string;
  primary?: boolean;
  accessRole: string;
}

interface GoogleDateTime {
  dateTime?: string;
  date?: string;
  timeZone?: string;
}

export interface GoogleEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: GoogleDateTime;
  end?: GoogleDateTime;
  status?: string;
  recurrence?: string[];
  recurringEventId?: string;
  originalStartTime?: GoogleDateTime;
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
    organizer?: boolean;
  }>;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{ method: string; minutes: number }>;
  };
  etag?: string;
}

interface GoogleCalendarListResponse {
  items?: GoogleCalendar[];
  nextPageToken?: string;
}

interface GoogleEventsResponse {
  items?: GoogleEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

type CalendarRecord = typeof calendars.$inferSelect;
type EventRecord = typeof events.$inferSelect;

export interface CalendarOutcome {
  calendarId: string;
  error: string | null;
}

export interface PushResult {
  ok: boolean;
  error?: string;
}

const API = "https://www.googleapis.com/calendar/v3";
/** Full syncs re-baseline the window and catch deletions missed while offline */
export const FULL_SYNC_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const WINDOW_PAST_DAYS = 90;
const WINDOW_FUTURE_DAYS = 400;

function syncWindow(now = new Date()) {
  return {
    start: new Date(now.getTime() - WINDOW_PAST_DAYS * 24 * 60 * 60 * 1000),
    end: new Date(now.getTime() + WINDOW_FUTURE_DAYS * 24 * 60 * 60 * 1000),
  };
}

function parseGoogleTime(value: GoogleDateTime | undefined): Date | null {
  if (value?.dateTime) return new Date(value.dateTime);
  if (value?.date) return parseDateOnlyUtc(value.date);
  return null;
}

/** Map a Google event resource to the stored form. Pure; exported for tests. */
export function mapGoogleEvent(gevent: GoogleEvent): SyncedEvent | null {
  const start = parseGoogleTime(gevent.start);
  if (!start || !gevent.end) return null;
  const isAllDay = !gevent.start?.dateTime;

  let end: Date;
  if (isAllDay) {
    // Google's all-day end date is exclusive; store the inclusive last day
    const exclusiveEnd = gevent.end.date ? parseDateOnlyUtc(gevent.end.date) : addUtcDays(start, 1);
    end = addUtcDays(exclusiveEnd, -1);
  } else {
    end = parseGoogleTime(gevent.end) ?? start;
  }
  if (end < start) end = start;

  const timeZone = isAllDay ? null : normalizeTimeZone(gevent.start?.timeZone);
  let recurrenceRule: string | null = null;
  const exdates: string[] = [];
  for (const line of gevent.recurrence ?? []) {
    if (/^RRULE:/i.test(line)) {
      recurrenceRule = extractRRuleValue(line);
    } else if (/^EXDATE[;:]/i.test(line)) {
      for (const date of parseDatePropertyLine(line, timeZone ?? "UTC")) exdates.push(date.toISOString());
    }
  }

  return {
    externalId: gevent.id,
    title: gevent.summary || "(No title)",
    description: gevent.description ?? null,
    location: gevent.location ?? null,
    startTime: start,
    endTime: end,
    isAllDay,
    status: gevent.status === "tentative" ? "tentative" : "confirmed",
    recurrenceRule,
    timeZone,
    exdates: recurrenceRule ? exdates : null,
    recurringEventId: gevent.recurringEventId ?? null,
    originalStartTime: parseGoogleTime(gevent.originalStartTime),
    attendees:
      gevent.attendees?.map((a) => ({
        email: a.email,
        name: a.displayName,
        responseStatus: a.responseStatus as "needsAction" | "accepted" | "declined" | "tentative" | undefined,
        organizer: a.organizer,
      })) ?? [],
    reminders:
      gevent.reminders?.overrides?.map((r) => ({
        method: r.method === "email" ? ("email" as const) : ("popup" as const),
        minutes: r.minutes,
      })) ?? [],
    etag: gevent.etag ?? null,
  };
}

/**
 * For a cancelled item, the recurring series and occurrence it removes.
 * Incremental results may carry only the id, whose `<master>_<start>` form
 * still identifies the occurrence.
 */
export function cancelledInstanceRef(gevent: GoogleEvent): { masterId: string; originalStart: Date } | null {
  const originalStart = parseGoogleTime(gevent.originalStartTime);
  if (gevent.recurringEventId && originalStart) {
    return { masterId: gevent.recurringEventId, originalStart };
  }
  const match = /^(.+)_(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z)?$/.exec(gevent.id);
  if (!match) return null;
  const [, masterId, y, mo, d, h, mi, s] = match;
  return {
    masterId: masterId!,
    originalStart: new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h ?? 0), Number(mi ?? 0), Number(s ?? 0))),
  };
}

async function googleGet<T>(url: string, accessToken: string): Promise<T> {
  const response = await providerFetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (response.ok) return (await response.json()) as T;
  const text = await response.text().catch(() => "");
  if (response.status === 410) throw new SyncStateExpiredError();
  if (response.status === 404) throw new CalendarNotFoundError("Google");
  if (response.status === 401) throw new CalendarSyncError("Google rejected the access token", 401);
  const reason = /"reason"\s*:\s*"([^"]+)"/.exec(text)?.[1];
  throw new CalendarSyncError(`Google Calendar returned HTTP ${response.status}${reason ? ` (${reason})` : ""}`, response.status);
}

// --- Calendar list ---------------------------------------------------------

async function syncCalendarList(db: Database, token: OAuthToken, accessToken: string): Promise<void> {
  const listed: GoogleCalendar[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(`${API}/users/me/calendarList`);
    url.searchParams.set("showHidden", "true"); // hidden in Google's UI ≠ removed
    url.searchParams.set("maxResults", "250");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const page = await googleGet<GoogleCalendarListResponse>(url.toString(), accessToken);
    listed.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);

  for (const gcal of listed) {
    const name = gcal.summaryOverride || gcal.summary || gcal.id;
    const isReadOnly = gcal.accessRole === "reader" || gcal.accessRole === "freeBusyReader";
    // isPrimary is user-controlled in OpenFrame, so it's only set on insert
    await db
      .insert(calendars)
      .values({
        userId: token.userId,
        provider: "google",
        externalId: gcal.id,
        name,
        description: gcal.description,
        color: gcal.backgroundColor ?? "#3B82F6",
        isPrimary: gcal.primary ?? false,
        isReadOnly,
        oauthTokenId: token.id,
        ...(gcal.primary ? { visibility: SHOWN_CALENDAR_VISIBILITY } : {}),
      })
      .onConflictDoUpdate({
        target: [calendars.userId, calendars.provider, calendars.externalId],
        set: {
          name,
          description: gcal.description,
          color: gcal.backgroundColor ?? "#3B82F6",
          isReadOnly,
          oauthTokenId: token.id,
          updatedAt: new Date(),
        },
      });
  }

  // Calendars this account no longer lists were deleted or unsubscribed
  // upstream. Only touch this account's calendars (and legacy rows without an
  // account, when this is the user's only Google account).
  if (listed.length === 0) return;
  const googleTokens = await db
    .select({ id: oauthTokens.id })
    .from(oauthTokens)
    .where(and(eq(oauthTokens.userId, token.userId), eq(oauthTokens.provider, "google")));
  const ownership =
    googleTokens.length === 1
      ? or(eq(calendars.oauthTokenId, token.id), isNull(calendars.oauthTokenId))
      : eq(calendars.oauthTokenId, token.id);
  await db
    .delete(calendars)
    .where(
      and(
        eq(calendars.userId, token.userId),
        eq(calendars.provider, "google"),
        ownership,
        notInArray(
          calendars.externalId,
          listed.map((c) => c.id)
        )
      )
    );
}

// --- Events ----------------------------------------------------------------

interface ExdateChange {
  add: Set<string>;
  remove: Set<string>;
}

async function applyExdateChanges(db: Database, calendarId: string, changes: Map<string, ExdateChange>): Promise<void> {
  if (changes.size === 0) return;
  const masters = await getExistingEvents(db, calendarId, [...changes.keys()]);
  for (const [masterId, change] of changes) {
    const master = masters.get(masterId);
    if (!master?.recurrenceRule) continue;
    const next = new Set(master.exdates ?? []);
    for (const iso of change.add) next.add(iso);
    for (const iso of change.remove) next.delete(iso);
    const before = [...(master.exdates ?? [])].sort().join();
    const after = [...next].sort();
    if (after.join() === before) continue;
    await db
      .update(events)
      .set({ exdates: after, updatedAt: new Date() })
      .where(eq(events.id, master.id));
  }
}

async function syncCalendarEvents(
  db: Database,
  calendar: CalendarRecord,
  accessToken: string,
  full: boolean
): Promise<void> {
  const now = new Date();
  const window = syncWindow(now);
  const params = new URLSearchParams({ maxResults: "2500" });
  if (full) {
    params.set("timeMin", window.start.toISOString());
    params.set("timeMax", window.end.toISOString());
    params.set("singleEvents", "false"); // recurring masters, expanded locally
  } else {
    params.set("syncToken", calendar.syncToken!);
  }

  const seen = new Set<string>();
  const exdateChanges = new Map<string, ExdateChange>();
  const changeFor = (masterId: string) => {
    let change = exdateChanges.get(masterId);
    if (!change) {
      change = { add: new Set(), remove: new Set() };
      exdateChanges.set(masterId, change);
    }
    return change;
  };

  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;
  do {
    const url = new URL(`${API}/calendars/${encodeURIComponent(calendar.externalId)}/events`);
    url.search = params.toString();
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const page = await googleGet<GoogleEventsResponse>(url.toString(), accessToken);

    const upserts: SyncedEvent[] = [];
    const deletedInstances: string[] = [];
    const deletedSeries: string[] = [];
    for (const item of page.items ?? []) {
      if (item.status === "cancelled") {
        const instance = cancelledInstanceRef(item);
        if (instance) {
          // A deleted occurrence of a series: record it as an exception date
          const iso = instance.originalStart.toISOString();
          changeFor(instance.masterId).add.add(iso);
          changeFor(instance.masterId).remove.delete(iso);
          deletedInstances.push(item.id);
        } else {
          deletedSeries.push(item.id);
        }
        continue;
      }
      const mapped = mapGoogleEvent(item);
      if (!mapped) continue;
      seen.add(mapped.externalId);
      if (mapped.recurringEventId && mapped.originalStartTime) {
        // A restored/modified occurrence is no longer an exception date
        const iso = mapped.originalStartTime.toISOString();
        changeFor(mapped.recurringEventId).remove.add(iso);
        changeFor(mapped.recurringEventId).add.delete(iso);
      }
      upserts.push(mapped);
    }

    if (!full) {
      // Master updates don't list cancelled occurrences; keep the ones we know
      const masters = upserts.filter((e) => e.recurrenceRule);
      if (masters.length > 0) {
        const existing = await getExistingEvents(
          db,
          calendar.id,
          masters.map((m) => m.externalId)
        );
        for (const master of masters) {
          const known = existing.get(master.externalId)?.exdates ?? [];
          master.exdates = [...new Set([...known, ...(master.exdates ?? [])])];
        }
      }
    }

    await deleteEventsByExternalId(db, calendar.id, deletedInstances);
    await deleteEventsByExternalId(db, calendar.id, deletedSeries, { includeInstances: true });
    await upsertSyncedEvents(db, calendar.id, upserts);

    pageToken = page.nextPageToken;
    nextSyncToken = page.nextSyncToken ?? nextSyncToken;
  } while (pageToken);

  await applyExdateChanges(db, calendar.id, exdateChanges);
  if (full) {
    await deleteEventsMissingFromListing(db, calendar.id, seen, { providerRowsOnly: true, window });
  }

  await db
    .update(calendars)
    .set({
      syncToken: nextSyncToken ?? (full ? null : calendar.syncToken),
      lastSyncAt: now,
      ...(full ? { fullSyncAt: now } : {}),
      updatedAt: now,
    })
    .where(eq(calendars.id, calendar.id));
}

function needsFullSync(calendar: CalendarRecord, forced: boolean): boolean {
  if (forced || !calendar.syncToken || !calendar.fullSyncAt) return true;
  return Date.now() - calendar.fullSyncAt.getTime() > FULL_SYNC_INTERVAL_MS;
}

/**
 * Sync one Google account: refresh its calendar list, then the events of its
 * enabled calendars (or just `calendarId`). A failing calendar doesn't stop
 * the others; each gets its own outcome. Token errors throw.
 */
export async function syncGoogleAccount(
  db: Database,
  token: OAuthToken,
  options: { calendarId?: string; calendarIds?: string[]; fullSync?: boolean } = {}
): Promise<CalendarOutcome[]> {
  const accessToken = await getValidAccessToken(db, token, "google");

  if (!options.calendarId) {
    await syncCalendarList(db, token, accessToken);
  }

  const calendarsToSync = await db
    .select()
    .from(calendars)
    .where(
      and(
        eq(calendars.userId, token.userId),
        eq(calendars.provider, "google"),
        or(eq(calendars.oauthTokenId, token.id), isNull(calendars.oauthTokenId)),
        options.calendarId
          ? eq(calendars.id, options.calendarId)
          : and(
              eq(calendars.syncEnabled, true),
              options.calendarIds ? inArray(calendars.id, options.calendarIds) : undefined
            )
      )
    );

  const outcomes: CalendarOutcome[] = [];
  for (const calendar of calendarsToSync) {
    try {
      const full = needsFullSync(calendar, options.fullSync ?? false);
      try {
        await syncCalendarEvents(db, calendar, accessToken, full);
      } catch (err) {
        if (!(err instanceof SyncStateExpiredError) || full) throw err;
        // Google invalidated the sync token: start over with a full sync
        await syncCalendarEvents(db, calendar, accessToken, true);
      }
      outcomes.push({ calendarId: calendar.id, error: null });
    } catch (err) {
      console.error(`[Google Sync] Calendar ${calendar.id} failed: ${describeSyncError(err)}`);
      outcomes.push({ calendarId: calendar.id, error: describeSyncError(err) });
    }
  }
  return outcomes;
}

// --- Outgoing sync: OpenFrame → Google Calendar -----------------------------

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

function utcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function dateStamp(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

/** EXDATE lines for a series' excluded occurrences, in the form Google returns them. */
function exdateLines(event: EventRecord, timeZone: string): string[] {
  const dates = [...new Set(event.exdates ?? [])]
    .map((iso) => new Date(iso))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  return dates.map((d) => {
    if (event.isAllDay) return `EXDATE;VALUE=DATE:${dateStamp(d)}`;
    const p = getZonedParts(d, timeZone);
    return `EXDATE;TZID=${timeZone}:${p.year}${pad(p.month)}${pad(p.day)}T${pad(p.hour)}${pad(p.minute)}${pad(p.second)}`;
  });
}

/**
 * Google's id for one occurrence of a recurring event: the series id plus the
 * occurrence's original start (UTC), or its date for all-day events.
 */
export function googleInstanceId(seriesExternalId: string, originalStart: Date, isAllDay: boolean): string {
  return `${seriesExternalId}_${isAllDay ? dateStamp(originalStart) : utcStamp(originalStart)}`;
}

export function buildGoogleEventBody(event: EventRecord, fallbackTimeZone?: string): Record<string, unknown> {
  const decrypted = decryptEventFields(event);
  const body: Record<string, unknown> = {
    summary: decrypted.title,
    description: decrypted.description ?? undefined,
    location: decrypted.location ?? undefined,
  };

  // Google requires a zone for recurring events; it also controls how the
  // event is displayed, so prefer the zone it was created in
  const timeZone = resolveTimeZone(event.timeZone, resolveTimeZone(fallbackTimeZone));
  if (event.isAllDay) {
    const span = allDayDateSpan(event.startTime, event.endTime);
    body.start = { date: span.start };
    body.end = { date: span.endExclusive };
  } else {
    body.start = { dateTime: event.startTime.toISOString(), timeZone };
    body.end = { dateTime: event.endTime.toISOString(), timeZone };
  }

  if (event.recurrenceRule) {
    const rule = extractRRuleValue(event.recurrenceRule);
    // Sending `recurrence` replaces it, so include the excluded occurrences:
    // leaving them out would bring deleted occurrences back
    if (rule) body.recurrence = [`RRULE:${rule}`, ...exdateLines(event, timeZone)];
  }

  if (Array.isArray(event.attendees) && event.attendees.length > 0) {
    body.attendees = event.attendees.map((a) => ({ email: a.email, displayName: a.name }));
  }

  if (Array.isArray(event.reminders) && event.reminders.length > 0) {
    body.reminders = {
      useDefault: false,
      overrides: event.reminders.map((r) => ({ method: r.method, minutes: r.minutes })),
    };
  }

  return body;
}

async function describeFailure(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  const message = /"message"\s*:\s*"([^"]+)"/.exec(text)?.[1];
  return `Google Calendar rejected the change (HTTP ${response.status}${message ? `: ${message}` : ""})`;
}

function eventUrl(calendar: CalendarRecord, eventId?: string): string {
  const base = `${API}/calendars/${encodeURIComponent(calendar.externalId)}/events`;
  return eventId ? `${base}/${encodeURIComponent(eventId)}` : base;
}

/** Created in OpenFrame and not (yet) on Google. */
export function isLocalOnly(event: Pick<EventRecord, "etag" | "externalId">): boolean {
  return !event.etag && /^(local_|companion-|remarkable_|bot_)/.test(event.externalId);
}

export async function pushEventToGoogle(
  db: Database,
  calendar: CalendarRecord,
  event: EventRecord,
  token: OAuthToken,
  fallbackTimeZone?: string
): Promise<PushResult> {
  try {
    const accessToken = await getValidAccessToken(db, token, "google");
    const response = await providerFetch(eventUrl(calendar), {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildGoogleEventBody(event, fallbackTimeZone)),
    });
    if (!response.ok) {
      const error = await describeFailure(response);
      console.error(`[Google Sync] Failed to create event ${event.id}: ${error}`);
      return { ok: false, error };
    }
    const created = (await response.json()) as GoogleEvent;
    await db
      .update(events)
      .set({ externalId: created.id, etag: created.etag ?? null, updatedAt: new Date() })
      .where(eq(events.id, event.id));
    return { ok: true };
  } catch (err) {
    console.error(`[Google Sync] Error creating event ${event.id}: ${describeSyncError(err)}`);
    return { ok: false, error: describeSyncError(err) };
  }
}

export async function updateEventInGoogle(
  db: Database,
  calendar: CalendarRecord,
  event: EventRecord,
  token: OAuthToken,
  fallbackTimeZone?: string
): Promise<PushResult> {
  // Never reached Google: create it now instead
  if (isLocalOnly(event)) return pushEventToGoogle(db, calendar, event, token, fallbackTimeZone);
  try {
    const accessToken = await getValidAccessToken(db, token, "google");
    const response = await providerFetch(eventUrl(calendar, event.externalId), {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildGoogleEventBody(event, fallbackTimeZone)),
    });
    if (!response.ok) {
      const error = await describeFailure(response);
      console.error(`[Google Sync] Failed to update event ${event.id}: ${error}`);
      return { ok: false, error };
    }
    const updated = (await response.json()) as GoogleEvent;
    await db
      .update(events)
      .set({ etag: updated.etag ?? null, updatedAt: new Date() })
      .where(eq(events.id, event.id));
    return { ok: true };
  } catch (err) {
    console.error(`[Google Sync] Error updating event ${event.id}: ${describeSyncError(err)}`);
    return { ok: false, error: describeSyncError(err) };
  }
}

export async function deleteEventFromGoogle(
  db: Database,
  calendar: CalendarRecord,
  event: EventRecord,
  token: OAuthToken
): Promise<PushResult> {
  if (isLocalOnly(event)) return { ok: true };
  try {
    const accessToken = await getValidAccessToken(db, token, "google");
    const response = await providerFetch(eventUrl(calendar, event.externalId), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // Already gone is fine
    if (response.ok || response.status === 404 || response.status === 410) return { ok: true };
    const error = await describeFailure(response);
    console.error(`[Google Sync] Failed to delete event ${event.id}: ${error}`);
    return { ok: false, error };
  } catch (err) {
    console.error(`[Google Sync] Error deleting event ${event.id}: ${describeSyncError(err)}`);
    return { ok: false, error: describeSyncError(err) };
  }
}
