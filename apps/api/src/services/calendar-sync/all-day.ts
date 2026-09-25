import { addUtcDays, formatUtcDate } from "../../lib/timezone.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function isUtcMidnight(date: Date): boolean {
  return date.getTime() % DAY_MS === 0;
}

function nearestUtcMidnight(date: Date): Date {
  return new Date(Math.round(date.getTime() / DAY_MS) * DAY_MS);
}

/**
 * Calendar dates covered by a stored all-day event, as provider APIs want
 * them: the first day and the day after the last (exclusive end).
 *
 * The canonical storage form is UTC midnight of the first and last day. Rows
 * written by older clients used the browser's local midnight/23:59:59
 * instead; those are rounded to the nearest UTC midnight, which recovers the
 * intended dates for any zone within ±12h of UTC.
 */
export function allDayDateSpan(startTime: Date, endTime: Date): { start: string; endExclusive: string } {
  const start = isUtcMidnight(startTime) ? startTime : nearestUtcMidnight(startTime);
  let endExclusive = isUtcMidnight(endTime) ? addUtcDays(endTime, 1) : nearestUtcMidnight(endTime);
  if (endExclusive <= start) endExclusive = addUtcDays(start, 1);
  return { start: formatUtcDate(start), endExclusive: formatUtcDate(endExclusive) };
}
