import rrule from "rrule";
const { RRule } = rrule;
import { and, eq, inArray, isNull, notInArray, or } from "drizzle-orm";
import { calendars, events, oauthTokens } from "@openframe/database/schema";
import type { Database } from "@openframe/database";
import { SHOWN_CALENDAR_VISIBILITY } from "../../lib/calendar-visibility.js";
import { decryptEventFields } from "../../lib/encryption.js";
import {
  WINDOWS_TIME_ZONE_IDS,
  addUtcDays,
  formatUtcDate,
  getZonedParts,
  normalizeTimeZone,
  parseDateOnlyUtc,
  resolveTimeZone,
  zonedTimeToUtc,
} from "../../lib/timezone.js";
import { allDayDateSpan } from "./all-day.js";
import { CalendarNotFoundError, CalendarSyncError, SyncStateExpiredError, describeSyncError } from "./errors.js";
import {
  deleteEventsByExternalId,
  deleteEventsMissingFromListing,
  getExistingEvents,
  upsertSyncedEvents,
  type SyncedEvent,
} from "./event-store.js";
import type { CalendarOutcome, PushResult } from "./google.js";
import { FULL_SYNC_INTERVAL_MS } from "./google.js";
import { providerFetch } from "./http.js";
import { getValidAccessToken, type OAuthToken } from "./oauth.js";
import { extractRRuleValue } from "./recurrence.js";

interface MSCalendar {
  id: string;
  name: string;
  color?: string;
  hexColor?: string;
  isDefaultCalendar?: boolean;
  canEdit?: boolean;
  owner?: { name?: string; address?: string };
}

interface MSDateTime {
  dateTime: string;
  timeZone?: string;
}

interface MSEmailAddress {
  address?: string;
  name?: string;
}

export interface MSEvent {
  id: string;
  type?: "singleInstance" | "occurrence" | "exception" | "seriesMaster";
  subject?: string;
  body?: { contentType?: string; content?: string };
  bodyPreview?: string;
  location?: { displayName?: string } | null;
  start?: MSDateTime;
  end?: MSDateTime;
  isAllDay?: boolean;
  isCancelled?: boolean;
  seriesMasterId?: string | null;
  originalStart?: string | null;
  attendees?: Array<{
    emailAddress?: MSEmailAddress;
    status?: { response?: string };
    type?: string;
  }>;
  organizer?: { emailAddress?: MSEmailAddress };
  "@odata.etag"?: string;
  "@removed"?: { reason?: string };
}

interface MSCollection<T> {
  value?: T[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
}

type CalendarRecord = typeof calendars.$inferSelect;
type EventRecord = typeof events.$inferSelect;

const GRAPH = "https://graph.microsoft.com/v1.0";
const WINDOW_PAST_DAYS = 90;
const WINDOW_FUTURE_DAYS = 400;
const DAY_MS = 24 * 60 * 60 * 1000;

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const MS_COLOR_MAP: Record<string, string> = {
  auto: "#3B82F6",
  lightBlue: "#60A5FA",
  lightGreen: "#4ADE80",
  lightOrange: "#FB923C",
  lightGray: "#9CA3AF",
  lightYellow: "#FACC15",
  lightTeal: "#2DD4BF",
  lightPink: "#F472B6",
  lightBrown: "#A16207",
  lightRed: "#F87171",
  maxColor: "#3B82F6",
};

function calendarColor(mcal: MSCalendar): string {
  if (mcal.hexColor && /^#[0-9a-f]{6}$/i.test(mcal.hexColor)) return mcal.hexColor;
  return MS_COLOR_MAP[mcal.color ?? "auto"] ?? "#3B82F6";
}

/** Parse Graph's zone-less dateTime ("2026-02-17T09:00:00.0000000") in its zone. */
export function parseGraphDateTime(value: MSDateTime): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/.exec(value.dateTime);
  if (!match) return new Date(value.dateTime);
  const wall = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6]),
    millisecond: Number((match[7] ?? "0").slice(0, 3).padEnd(3, "0")),
  };
  const zone = normalizeTimeZone(value.timeZone) ?? "UTC";
  return zonedTimeToUtc(wall, zone);
}

/** Map a Graph event to the stored form. Pure; exported for tests. */
export function mapMicrosoftEvent(mevent: MSEvent, fallback?: Partial<SyncedEvent>): SyncedEvent | null {
  if (!mevent.start || !mevent.end) return null;
  const isAllDay = mevent.isAllDay ?? false;

  let start: Date;
  let end: Date;
  if (isAllDay) {
    // All-day values are midnights; the end is exclusive
    start = parseDateOnlyUtc(mevent.start.dateTime.slice(0, 10));
    end = addUtcDays(parseDateOnlyUtc(mevent.end.dateTime.slice(0, 10)), -1);
  } else {
    start = parseGraphDateTime(mevent.start);
    end = parseGraphDateTime(mevent.end);
  }
  if (end < start) end = start;

  const organizer = mevent.organizer?.emailAddress?.address?.toLowerCase();
  const description =
    mevent.body !== undefined
      ? mevent.body?.content
        ? stripHtml(mevent.body.content)
        : (mevent.bodyPreview ?? null)
      : (fallback?.description ?? null);

  return {
    externalId: mevent.id,
    title: mevent.subject !== undefined ? mevent.subject || "(No title)" : (fallback?.title ?? "(No title)"),
    description: description || null,
    location:
      mevent.location !== undefined ? mevent.location?.displayName || null : (fallback?.location ?? null),
    startTime: start,
    endTime: end,
    isAllDay,
    status: "confirmed",
    // Graph expands series into occurrences for calendarView; nothing to expand locally
    recurrenceRule: null,
    timeZone: null,
    exdates: null,
    recurringEventId: mevent.seriesMasterId ?? null,
    originalStartTime: mevent.originalStart ? new Date(mevent.originalStart) : null,
    attendees:
      mevent.attendees !== undefined
        ? mevent.attendees
            .filter((a) => a.emailAddress?.address)
            .map((a) => ({
              email: a.emailAddress!.address!,
              name: a.emailAddress?.name,
              responseStatus: (a.status?.response === "none" ? "needsAction" : a.status?.response === "tentativelyAccepted" ? "tentative" : a.status?.response) as
                | "needsAction"
                | "accepted"
                | "declined"
                | "tentative"
                | undefined,
              organizer: !!organizer && a.emailAddress!.address!.toLowerCase() === organizer,
            }))
        : (fallback?.attendees ?? []),
    reminders: [],
    etag: mevent["@odata.etag"] ?? null,
  };
}

function preferHeader(): string {
  return 'outlook.timezone="UTC", outlook.body-content-type="text", odata.maxpagesize=200';
}

async function graphGet<T>(url: string, accessToken: string): Promise<T> {
  // Only ever send the bearer token to Graph (delta links are stored in the DB)
  if (!url.startsWith(`${GRAPH}/`)) throw new CalendarSyncError("Unexpected Microsoft Graph URL");
  const response = await providerFetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Prefer: preferHeader() },
  });
  if (response.ok) return (await response.json()) as T;
  const text = await response.text().catch(() => "");
  const code = /"code"\s*:\s*"([^"]+)"/.exec(text)?.[1] ?? "";
  if (response.status === 410 || /syncstate|resync/i.test(code)) throw new SyncStateExpiredError();
  if (response.status === 404) throw new CalendarNotFoundError("Microsoft");
  if (response.status === 401) throw new CalendarSyncError("Microsoft rejected the access token", 401);
  throw new CalendarSyncError(`Microsoft Graph returned HTTP ${response.status}${code ? ` (${code})` : ""}`, response.status);
}

// --- Calendar list ---------------------------------------------------------

async function syncCalendarList(db: Database, token: OAuthToken, accessToken: string): Promise<void> {
  const listed: MSCalendar[] = [];
  let url: string | undefined =
    `${GRAPH}/me/calendars?$top=100&$select=id,name,color,hexColor,isDefaultCalendar,canEdit,owner`;
  while (url) {
    const page: MSCollection<MSCalendar> = await graphGet<MSCollection<MSCalendar>>(url, accessToken);
    listed.push(...(page.value ?? []));
    url = page["@odata.nextLink"];
  }

  // Disambiguate same-named calendars from different mailboxes
  const nameCounts = new Map<string, number>();
  for (const mcal of listed) nameCounts.set(mcal.name, (nameCounts.get(mcal.name) ?? 0) + 1);

  for (const mcal of listed) {
    const ownerLabel = mcal.owner?.name || mcal.owner?.address;
    const name = (nameCounts.get(mcal.name) ?? 0) > 1 && ownerLabel ? `${mcal.name} (${ownerLabel})` : mcal.name;
    await db
      .insert(calendars)
      .values({
        userId: token.userId,
        provider: "microsoft",
        externalId: mcal.id,
        name,
        color: calendarColor(mcal),
        isPrimary: mcal.isDefaultCalendar ?? false,
        isReadOnly: !(mcal.canEdit ?? true),
        oauthTokenId: token.id,
        ...(mcal.isDefaultCalendar ? { visibility: SHOWN_CALENDAR_VISIBILITY } : {}),
      })
      .onConflictDoUpdate({
        target: [calendars.userId, calendars.provider, calendars.externalId],
        set: {
          name,
          color: calendarColor(mcal),
          isReadOnly: !(mcal.canEdit ?? true),
          oauthTokenId: token.id,
          updatedAt: new Date(),
        },
      });
  }

  // Remove calendars this account no longer lists — never another account's
  if (listed.length === 0) return;
  const msTokens = await db
    .select({ id: oauthTokens.id })
    .from(oauthTokens)
    .where(and(eq(oauthTokens.userId, token.userId), eq(oauthTokens.provider, "microsoft")));
  const ownership =
    msTokens.length === 1
      ? or(eq(calendars.oauthTokenId, token.id), isNull(calendars.oauthTokenId))
      : eq(calendars.oauthTokenId, token.id);
  await db
    .delete(calendars)
    .where(
      and(
        eq(calendars.userId, token.userId),
        eq(calendars.provider, "microsoft"),
        ownership,
        notInArray(
          calendars.externalId,
          listed.map((c) => c.id)
        )
      )
    );
}

// --- Events ----------------------------------------------------------------

async function syncCalendarEvents(
  db: Database,
  calendar: CalendarRecord,
  accessToken: string,
  full: boolean
): Promise<void> {
  const now = new Date();
  const window = {
    start: new Date(now.getTime() - WINDOW_PAST_DAYS * DAY_MS),
    end: new Date(now.getTime() + WINDOW_FUTURE_DAYS * DAY_MS),
  };

  // The delta link encodes the window it was created with, so a full sync
  // (fresh window) is also how the window moves forward over time.
  let url: string | undefined = full
    ? `${GRAPH}/me/calendars/${encodeURIComponent(calendar.externalId)}/calendarView/delta?${new URLSearchParams({
        startDateTime: window.start.toISOString(),
        endDateTime: window.end.toISOString(),
      })}`
    : calendar.syncToken!;

  const seen = new Set<string>();
  const seriesMasters = new Map<string, MSEvent | null>();
  let deltaLink: string | undefined;

  while (url) {
    const page: MSCollection<MSEvent> = await graphGet<MSCollection<MSEvent>>(url, accessToken);
    const items = page.value ?? [];

    const removed = items.filter((e) => e["@removed"] || e.isCancelled).map((e) => e.id);
    const live = items.filter((e) => !e["@removed"] && !e.isCancelled && e.type !== "seriesMaster");

    // Occurrences can arrive without their series' subject/body/location
    const existing = await getExistingEvents(
      db,
      calendar.id,
      live.map((e) => e.id)
    );
    const upserts: SyncedEvent[] = [];
    for (const item of live) {
      let fallback: Partial<SyncedEvent> | undefined = existing.get(item.id);
      if (item.subject === undefined && item.seriesMasterId) {
        // Prefer the series' current details over what we stored before
        const master = await getSeriesMaster(calendar, item.seriesMasterId, accessToken, seriesMasters);
        const fromMaster = master ? mapMicrosoftEvent({ ...master, start: item.start, end: item.end, id: item.id }) : null;
        if (fromMaster) fallback = { ...fallback, ...fromMaster };
      }
      const mapped = mapMicrosoftEvent(item, fallback);
      if (!mapped) continue;
      seen.add(mapped.externalId);
      upserts.push(mapped);
    }

    await deleteEventsByExternalId(db, calendar.id, removed);
    await upsertSyncedEvents(db, calendar.id, upserts);

    url = page["@odata.nextLink"];
    deltaLink = page["@odata.deltaLink"] ?? deltaLink;
  }

  if (full) {
    await deleteEventsMissingFromListing(db, calendar.id, seen, { providerRowsOnly: true, window });
  }

  await db
    .update(calendars)
    .set({
      syncToken: deltaLink ?? (full ? null : calendar.syncToken),
      lastSyncAt: now,
      ...(full ? { fullSyncAt: now } : {}),
      updatedAt: now,
    })
    .where(eq(calendars.id, calendar.id));
}

async function getSeriesMaster(
  calendar: CalendarRecord,
  masterId: string,
  accessToken: string,
  cache: Map<string, MSEvent | null>
): Promise<MSEvent | null> {
  if (cache.has(masterId)) return cache.get(masterId)!;
  let master: MSEvent | null = null;
  try {
    master = await graphGet<MSEvent>(
      `${GRAPH}/me/calendars/${encodeURIComponent(calendar.externalId)}/events/${encodeURIComponent(masterId)}?$select=subject,body,bodyPreview,location,attendees,organizer`,
      accessToken
    );
  } catch (err) {
    console.error(`[Microsoft Sync] Could not load series ${masterId}: ${describeSyncError(err)}`);
  }
  cache.set(masterId, master);
  return master;
}

function needsFullSync(calendar: CalendarRecord, forced: boolean): boolean {
  if (forced || !calendar.syncToken || !calendar.fullSyncAt) return true;
  return Date.now() - calendar.fullSyncAt.getTime() > FULL_SYNC_INTERVAL_MS;
}

/**
 * Sync one Microsoft account: refresh its calendar list, then the events of
 * its enabled calendars (or just `calendarId`). Each calendar gets its own
 * outcome; token errors throw.
 */
export async function syncMicrosoftAccount(
  db: Database,
  token: OAuthToken,
  options: { calendarId?: string; calendarIds?: string[]; fullSync?: boolean } = {}
): Promise<CalendarOutcome[]> {
  const accessToken = await getValidAccessToken(db, token, "microsoft");

  if (!options.calendarId) {
    await syncCalendarList(db, token, accessToken);
  }

  const calendarsToSync = await db
    .select()
    .from(calendars)
    .where(
      and(
        eq(calendars.userId, token.userId),
        eq(calendars.provider, "microsoft"),
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
        await syncCalendarEvents(db, calendar, accessToken, true);
      }
      outcomes.push({ calendarId: calendar.id, error: null });
    } catch (err) {
      console.error(`[Microsoft Sync] Calendar ${calendar.id} failed: ${describeSyncError(err)}`);
      outcomes.push({ calendarId: calendar.id, error: describeSyncError(err) });
    }
  }
  return outcomes;
}

// --- Outgoing sync: OpenFrame → Microsoft ----------------------------------

const WEEKDAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
// rrule.js weekday numbering: MO=0 … SU=6
const RRULE_WEEKDAY_TO_GRAPH = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const INDEX_NAMES: Record<number, string> = { 1: "first", 2: "second", 3: "third", 4: "fourth", [-1]: "last" };

const IANA_TO_WINDOWS = new Map<string, string>();
for (const [windows, iana] of Object.entries(WINDOWS_TIME_ZONE_IDS)) {
  if (!IANA_TO_WINDOWS.has(iana)) IANA_TO_WINDOWS.set(iana, windows);
}

/** Graph time zone name: Windows ID where one maps, else the IANA name. */
export function graphTimeZoneName(timeZone: string): string {
  if (timeZone === "UTC" || timeZone === "Etc/UTC") return "UTC";
  return IANA_TO_WINDOWS.get(timeZone) ?? timeZone;
}

type WeekdaySpec = { weekday: number; n?: number };

function asWeekdays(value: unknown): WeekdaySpec[] {
  const list = Array.isArray(value) ? value : value == null ? [] : [value];
  return list.map((d) => (typeof d === "number" ? { weekday: d } : (d as WeekdaySpec)));
}

function asNumbers(value: unknown): number[] {
  return Array.isArray(value) ? (value as number[]) : typeof value === "number" ? [value] : [];
}

/**
 * Convert an RRULE to a Graph `patternedRecurrence`, or null when the rule
 * uses features Outlook can't represent. `start` is the first occurrence in
 * `timeZone`. Exported for tests.
 */
export function rruleToGraphRecurrence(
  ruleText: string,
  start: Date,
  timeZone: string,
  isAllDay: boolean
): Record<string, unknown> | null {
  const rule = extractRRuleValue(ruleText);
  if (!rule) return null;
  let options: ReturnType<typeof RRule.parseString>;
  try {
    options = RRule.parseString(rule);
  } catch {
    return null;
  }
  if (options.byhour != null || options.byminute != null || options.bysecond != null || options.byweekno != null || options.byyearday != null) {
    return null;
  }

  const zone = isAllDay ? "UTC" : timeZone;
  const local = getZonedParts(start, zone);
  const interval = options.interval ?? 1;
  const days = asWeekdays(options.byweekday);
  const monthDays = asNumbers(options.bymonthday);
  const months = asNumbers(options.bymonth);
  const setPos = asNumbers(options.bysetpos);
  const startWeekday = WEEKDAY_NAMES[new Date(Date.UTC(local.year, local.month - 1, local.day)).getUTCDay()]!;

  let pattern: Record<string, unknown>;
  switch (options.freq) {
    case RRule.DAILY:
      if (days.length || monthDays.length || months.length) return null;
      pattern = { type: "daily", interval };
      break;
    case RRule.WEEKLY:
      if (monthDays.length || months.length) return null;
      pattern = {
        type: "weekly",
        interval,
        daysOfWeek: days.length ? days.map((d) => RRULE_WEEKDAY_TO_GRAPH[d.weekday]) : [startWeekday],
        firstDayOfWeek:
          options.wkst != null
            ? RRULE_WEEKDAY_TO_GRAPH[typeof options.wkst === "number" ? options.wkst : options.wkst.weekday]
            : "sunday",
      };
      break;
    case RRule.MONTHLY:
    case RRule.YEARLY: {
      const yearly = options.freq === RRule.YEARLY;
      if (months.length > 1 || (!yearly && months.length)) return null;
      const month = months[0] ?? local.month;
      const relative = days.length === 1 ? (days[0]!.n ?? (setPos.length === 1 ? setPos[0] : undefined)) : undefined;
      if (days.length === 1 && relative !== undefined && INDEX_NAMES[relative]) {
        pattern = {
          type: yearly ? "relativeYearly" : "relativeMonthly",
          interval,
          daysOfWeek: [RRULE_WEEKDAY_TO_GRAPH[days[0]!.weekday]],
          index: INDEX_NAMES[relative],
          ...(yearly ? { month } : {}),
        };
      } else if (!days.length && monthDays.length <= 1) {
        pattern = {
          type: yearly ? "absoluteYearly" : "absoluteMonthly",
          interval,
          dayOfMonth: monthDays[0] ?? local.day,
          ...(yearly ? { month } : {}),
        };
      } else {
        return null;
      }
      break;
    }
    default:
      return null;
  }

  const startDate = formatUtcDate(new Date(Date.UTC(local.year, local.month - 1, local.day)));
  let range: Record<string, unknown>;
  if (options.count) {
    range = { type: "numbered", startDate, numberOfOccurrences: options.count };
  } else if (options.until) {
    const untilLocal = getZonedParts(options.until, zone);
    range = {
      type: "endDate",
      startDate,
      endDate: formatUtcDate(new Date(Date.UTC(untilLocal.year, untilLocal.month - 1, untilLocal.day))),
    };
  } else {
    range = { type: "noEnd", startDate };
  }
  if (!isAllDay) range.recurrenceTimeZone = graphTimeZoneName(zone);

  return { pattern, range };
}

export function buildMSEventBody(event: EventRecord, fallbackTimeZone?: string): Record<string, unknown> {
  const decrypted = decryptEventFields(event);
  const body: Record<string, unknown> = {
    subject: decrypted.title,
    body: { contentType: "text", content: decrypted.description ?? "" },
    location: { displayName: decrypted.location ?? "" },
  };

  const timeZone = resolveTimeZone(event.timeZone, resolveTimeZone(fallbackTimeZone));
  if (event.isAllDay) {
    const span = allDayDateSpan(event.startTime, event.endTime);
    body.start = { dateTime: `${span.start}T00:00:00.0000000`, timeZone: "UTC" };
    body.end = { dateTime: `${span.endExclusive}T00:00:00.0000000`, timeZone: "UTC" };
    body.isAllDay = true;
  } else if (event.recurrenceRule) {
    // Recurring events need wall-clock times in their zone to survive DST
    const wallClock = (date: Date) => {
      const p = getZonedParts(date, timeZone);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}.0000000`;
    };
    body.start = { dateTime: wallClock(event.startTime), timeZone: graphTimeZoneName(timeZone) };
    body.end = { dateTime: wallClock(event.endTime), timeZone: graphTimeZoneName(timeZone) };
    body.isAllDay = false;
  } else {
    body.start = { dateTime: event.startTime.toISOString().replace("Z", ""), timeZone: "UTC" };
    body.end = { dateTime: event.endTime.toISOString().replace("Z", ""), timeZone: "UTC" };
    body.isAllDay = false;
  }

  if (event.recurrenceRule) {
    const recurrence = rruleToGraphRecurrence(event.recurrenceRule, event.startTime, timeZone, event.isAllDay);
    if (recurrence) body.recurrence = recurrence;
  }

  if (Array.isArray(event.attendees) && event.attendees.length > 0) {
    body.attendees = event.attendees.map((a) => ({
      emailAddress: { address: a.email, name: a.name },
      type: "required",
    }));
  }

  return body;
}

async function describeFailure(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  const message = /"message"\s*:\s*"([^"]+)"/.exec(text)?.[1];
  return `Outlook rejected the change (HTTP ${response.status}${message ? `: ${message}` : ""})`;
}

function eventUrl(calendar: CalendarRecord, eventId?: string): string {
  const base = `${GRAPH}/me/calendars/${encodeURIComponent(calendar.externalId)}/events`;
  return eventId ? `${base}/${encodeURIComponent(eventId)}` : base;
}

function isLocalOnly(event: EventRecord): boolean {
  return !event.etag && /^(local_|companion-|remarkable_|bot_)/.test(event.externalId);
}

export async function pushEventToMicrosoft(
  db: Database,
  calendar: CalendarRecord,
  event: EventRecord,
  token: OAuthToken,
  fallbackTimeZone?: string
): Promise<PushResult> {
  try {
    const accessToken = await getValidAccessToken(db, token, "microsoft");
    const response = await providerFetch(eventUrl(calendar), {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildMSEventBody(event, fallbackTimeZone)),
    });
    if (!response.ok) {
      const error = await describeFailure(response);
      console.error(`[Microsoft Sync] Failed to create event ${event.id}: ${error}`);
      return { ok: false, error };
    }
    const created = (await response.json()) as MSEvent;
    await db
      .update(events)
      .set({ externalId: created.id, etag: created["@odata.etag"] ?? null, updatedAt: new Date() })
      .where(eq(events.id, event.id));
    return { ok: true };
  } catch (err) {
    console.error(`[Microsoft Sync] Error creating event ${event.id}: ${describeSyncError(err)}`);
    return { ok: false, error: describeSyncError(err) };
  }
}

export async function updateEventInMicrosoft(
  db: Database,
  calendar: CalendarRecord,
  event: EventRecord,
  token: OAuthToken,
  fallbackTimeZone?: string
): Promise<PushResult> {
  if (isLocalOnly(event)) return pushEventToMicrosoft(db, calendar, event, token, fallbackTimeZone);
  try {
    const accessToken = await getValidAccessToken(db, token, "microsoft");
    const response = await providerFetch(eventUrl(calendar, event.externalId), {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildMSEventBody(event, fallbackTimeZone)),
    });
    if (!response.ok) {
      const error = await describeFailure(response);
      console.error(`[Microsoft Sync] Failed to update event ${event.id}: ${error}`);
      return { ok: false, error };
    }
    const updated = (await response.json()) as MSEvent;
    await db
      .update(events)
      .set({ etag: updated["@odata.etag"] ?? null, updatedAt: new Date() })
      .where(eq(events.id, event.id));
    return { ok: true };
  } catch (err) {
    console.error(`[Microsoft Sync] Error updating event ${event.id}: ${describeSyncError(err)}`);
    return { ok: false, error: describeSyncError(err) };
  }
}

export async function deleteEventFromMicrosoft(
  db: Database,
  calendar: CalendarRecord,
  event: EventRecord,
  token: OAuthToken
): Promise<PushResult> {
  if (isLocalOnly(event)) return { ok: true };
  try {
    const accessToken = await getValidAccessToken(db, token, "microsoft");
    const response = await providerFetch(eventUrl(calendar, event.externalId), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (response.ok || response.status === 404 || response.status === 410) return { ok: true };
    const error = await describeFailure(response);
    console.error(`[Microsoft Sync] Failed to delete event ${event.id}: ${error}`);
    return { ok: false, error };
  } catch (err) {
    console.error(`[Microsoft Sync] Error deleting event ${event.id}: ${describeSyncError(err)}`);
    return { ok: false, error: describeSyncError(err) };
  }
}
