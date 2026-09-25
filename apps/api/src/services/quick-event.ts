import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { calendars, events } from "@openframe/database/schema";
import type { Database } from "@openframe/database";
import { decryptEventFields, encryptEventFields } from "../lib/encryption.js";
import { addUtcDays, getZonedParts, isValidTimeZone, resolveTimeZone, zonedTimeToUtc } from "../lib/timezone.js";
import { pushEventChange } from "./calendar-sync/push.js";

type CalendarRecord = typeof calendars.$inferSelect;
type EventRecord = typeof events.$inferSelect;

/**
 * Minimal natural-language parsing: "Dentist tomorrow at 2:30pm". Times are
 * interpreted in `timeZone`. Exported for tests.
 */
export function parseQuickEvent(
  text: string,
  timeZone: string,
  now: Date = new Date()
): { title: string; startTime: Date; endTime: Date; isAllDay: boolean } | null {
  // Require am/pm, "at", or hh:mm so numbers in titles ("Call 3 people")
  // aren't mistaken for times
  const timeMatch =
    /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i.exec(text) ??
    /\bat\s+(\d{1,2})(?::(\d{2}))?\b/i.exec(text) ??
    /\b(\d{1,2}):(\d{2})\b/.exec(text);

  let dayOffset = 0;
  if (/\btomorrow\b/i.test(text)) dayOffset = 1;
  else if (/\bnext week\b/i.test(text)) dayOffset = 7;

  const title = text
    .replace(timeMatch?.[0] ?? "", "")
    .replace(/\b(tomorrow|today|next week)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!title) return null;

  const today = getZonedParts(now, timeZone);
  const date = addUtcDays(new Date(Date.UTC(today.year, today.month - 1, today.day)), dayOffset);

  if (!timeMatch) {
    // All-day events are stored as UTC midnight of the (inclusive) date
    return { title, startTime: date, endTime: date, isAllDay: true };
  }

  let hours = Number(timeMatch[1]);
  const minutes = timeMatch[2] ? Number(timeMatch[2]) : 0;
  const period = timeMatch[3]?.toLowerCase();
  if (period === "pm" && hours < 12) hours += 12;
  else if (period === "am" && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return null;

  const startTime = zonedTimeToUtc(
    {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: hours,
      minute: minutes,
      second: 0,
    },
    timeZone
  );
  return { title, startTime, endTime: new Date(startTime.getTime() + 60 * 60 * 1000), isAllDay: false };
}

export type QuickEventResult =
  | { ok: true; event: EventRecord; calendar: CalendarRecord; timeZone: string; syncWarning?: string }
  | { ok: false; status: 400 | 404; message: string };

/**
 * Create an event from text like "Dentist tomorrow at 2:30pm" for the web
 * app's quick add and the chat bots. Without a calendar, uses the same
 * default as the web app: the primary writable calendar, else the first one.
 */
export async function createQuickEvent(
  db: Database,
  user: { id: string; timezone: string | null },
  text: string,
  options: { calendarId?: string; timeZone?: string | null } = {}
): Promise<QuickEventResult> {
  const userCalendars = await db.select().from(calendars).where(eq(calendars.userId, user.id));
  let calendar: CalendarRecord | undefined;
  if (options.calendarId) {
    calendar = userCalendars.find((c) => c.id === options.calendarId);
    if (!calendar) return { ok: false, status: 404, message: "Calendar not found" };
    if (calendar.isReadOnly) return { ok: false, status: 400, message: "Calendar is read-only" };
  } else {
    const writable = userCalendars.filter((c) => !c.isReadOnly && (c.syncEnabled || c.provider === "local"));
    calendar = writable.find((c) => c.isPrimary) ?? writable[0];
    if (!calendar) return { ok: false, status: 400, message: "No calendar to add events to" };
  }

  const timeZone =
    options.timeZone && isValidTimeZone(options.timeZone) ? options.timeZone : resolveTimeZone(user.timezone);
  const parsed = parseQuickEvent(text, timeZone);
  if (!parsed) {
    return { ok: false, status: 400, message: "Could not parse event. Try format: 'Meeting with John tomorrow at 2pm'" };
  }

  const [created] = await db
    .insert(events)
    .values(
      encryptEventFields({
        calendarId: calendar.id,
        externalId: `local_${randomUUID()}`,
        title: parsed.title,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        isAllDay: parsed.isAllDay,
        timeZone: parsed.isAllDay ? null : timeZone,
      })
    )
    .returning();
  if (!created) return { ok: false, status: 400, message: "Failed to create event" };

  // Send to Google/Microsoft; a failure keeps the event and is reported
  const push = await pushEventChange(db, calendar, created, "create", timeZone);
  const [current] = await db.select().from(events).where(eq(events.id, created.id)).limit(1);
  return {
    ok: true,
    event: decryptEventFields(current ?? created),
    calendar,
    timeZone,
    ...(push && !push.ok ? { syncWarning: push.error } : {}),
  };
}

/** "Thu, Sep 24, 3:00 PM" or "Thu, Sep 24 (all day)", for chat replies. */
export function describeEventTime(event: Pick<EventRecord, "startTime" | "isAllDay">, timeZone: string): string {
  const date = new Intl.DateTimeFormat("en-US", {
    // All-day events are UTC-midnight dates
    timeZone: event.isAllDay ? "UTC" : timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(event.isAllDay ? {} : { hour: "numeric", minute: "2-digit" }),
  }).format(event.startTime);
  return event.isAllDay ? `${date} (all day)` : date;
}
