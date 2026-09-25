/**
 * When the Telegram/WhatsApp bots' scheduled notifications are due. Pure, so
 * the scheduler's decisions can be tested with fixed clocks and zones.
 */
import { getZonedParts } from "./timezone.js";

const MINUTE_MS = 60 * 1000;

/**
 * How late a missed daily agenda (server restarting, WhatsApp reconnecting)
 * may still go out. Later than this a morning agenda is noise, and it keeps
 * enabling the agenda in the evening from sending one right away.
 */
export const AGENDA_CATCH_UP_MINUTES = 120;

/** The furthest ahead a reminder can be (the settings route's maximum). */
export const MAX_REMINDER_MINUTES = 1440;

/** Minutes after local midnight for "HH:mm" ("H:mm" and "HH:mm:ss" too), or null. */
export function parseTimeOfDay(value: string | null | undefined): number | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value?.trim() ?? "");
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
}

/**
 * Whether the daily agenda should go out at `now`: the user's local clock is
 * at `agendaTime` or up to AGENDA_CATCH_UP_MINUTES past it, and no agenda
 * went out earlier on this local day. Wall-clock comparison, so a time in a
 * spring-forward gap goes out right after the gap, and a time repeated at
 * fall-back goes out once.
 */
export function isDailyAgendaDue(opts: {
  now: Date;
  timeZone: string;
  agendaTime: string;
  lastSentAt: Date | null;
}): boolean {
  const target = parseTimeOfDay(opts.agendaTime);
  if (target === null) return false;
  const local = getZonedParts(opts.now, opts.timeZone);
  const minutesLate = local.hour * 60 + local.minute - target;
  if (minutesLate < 0 || minutesLate > AGENDA_CATCH_UP_MINUTES) return false;
  if (!opts.lastSentAt) return true;
  const last = getZonedParts(opts.lastSentAt, opts.timeZone);
  return !(last.year === local.year && last.month === local.month && last.day === local.day);
}

export interface ReminderEvent {
  id: string;
  /** Set on generated occurrences of a recurring event: the series' id */
  originalEventId?: string;
  startTime: Date;
  isAllDay: boolean;
}

/**
 * One occurrence: the calendar event (the series, for a generated recurring
 * occurrence, whose id is synthetic) plus its start. A moved event gets a new
 * key, so it's reminded again for its new time.
 */
export function reminderKey(event: ReminderEvent): string {
  return `${event.originalEventId ?? event.id}@${event.startTime.toISOString()}`;
}

/**
 * Timed occurrences to remind about at `now`: they start within the next
 * `leadMinutes` (so events that show up late, e.g. from a sync, still get
 * one) and aren't in `sent`. All-day events get no time-based reminder.
 */
export function dueReminders<T extends ReminderEvent>(
  events: T[],
  opts: { now: Date; leadMinutes: number; sent: readonly string[] }
): T[] {
  const now = opts.now.getTime();
  const leadMs = opts.leadMinutes * MINUTE_MS;
  const seen = new Set(opts.sent);
  return events.filter((event) => {
    if (event.isAllDay) return false;
    const start = event.startTime.getTime();
    if (!(start > now && start - leadMs <= now)) return false;
    const key = reminderKey(event);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** The sent keys worth keeping: occurrences that haven't started (the rest can't be due again). */
export function pendingReminderKeys(keys: readonly string[], now: Date): string[] {
  return keys.filter((key) => Date.parse(key.slice(key.lastIndexOf("@") + 1)) > now.getTime());
}

/** "in 15 minutes", "in 1 hour", "in 1 hour 30 minutes" until `start` (rounded up). */
export function describeTimeUntil(start: Date, now: Date): string {
  const total = Math.max(1, Math.ceil((start.getTime() - now.getTime()) / MINUTE_MS));
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `in ${plural(minutes, "minute")}`;
  return `in ${plural(hours, "hour")}${minutes ? ` ${plural(minutes, "minute")}` : ""}`;
}
