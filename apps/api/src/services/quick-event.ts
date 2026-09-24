import { addUtcDays, getZonedParts, zonedTimeToUtc } from "../lib/timezone.js";

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
