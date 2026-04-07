import type { CalendarEvent } from "@openframe/shared";

/**
 * Parse an event's start/end time as a local date, correctly handling all-day events.
 *
 * All-day events are stored as UTC midnight (e.g. "2026-04-07T00:00:00Z").
 * Using `new Date()` directly would shift the date by the local timezone offset
 * (e.g. MDT = UTC-6 → April 6 at 6pm instead of April 7).
 *
 * For all-day events, we extract the YYYY-MM-DD date part from the ISO string
 * and construct a local Date, ignoring timezone entirely.
 */
function parseLocalDateFromValue(dateValue: Date | string): Date {
  const isoString =
    typeof dateValue === "string" ? dateValue : dateValue.toISOString();
  const datePart = isoString.slice(0, 10);
  const parts = datePart.split("-").map(Number);
  const year = parts[0] ?? 1970;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  return new Date(year, month - 1, day);
}

/** Get the display start date for an event, handling all-day timezone issues */
export function getEventStart(event: CalendarEvent): Date {
  if (event.isAllDay) {
    return parseLocalDateFromValue(event.startTime);
  }
  return new Date(event.startTime);
}

/**
 * Get the display end date for an event, handling all-day timezone issues.
 * For all-day events, returns end-of-day (23:59:59.999) so that overlap
 * checks like `eventEnd > dayStart` work correctly with inclusive end dates.
 */
export function getEventEnd(event: CalendarEvent): Date {
  if (event.isAllDay) {
    const d = parseLocalDateFromValue(event.endTime);
    d.setHours(23, 59, 59, 999);
    return d;
  }
  return new Date(event.endTime);
}

/**
 * Check if an event falls on a given day.
 * Handles all-day events correctly by parsing dates as local.
 */
export function eventFallsOnDay(event: CalendarEvent, day: Date): boolean {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);

  const eventStart = getEventStart(event);
  const eventEnd = getEventEnd(event);

  return eventStart <= dayEnd && eventEnd > dayStart;
}
