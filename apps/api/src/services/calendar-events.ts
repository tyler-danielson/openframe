import { and, eq, gte, inArray, isNotNull, lt, lte, or } from "drizzle-orm";
import { events } from "@openframe/database/schema";
import type { Database } from "@openframe/database";
import { decryptEventFields } from "../lib/encryption.js";
import { addUtcDays, resolveTimeZone, zonedCalendarDate } from "../lib/timezone.js";
import { expandRecurringEvents, type ExpandedEvent } from "./calendar-sync/recurrence.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface EventRangeQuery {
  calendarIds: string[];
  start: Date;
  end: Date;
  /**
   * The viewer's IANA zone. All-day events are floating dates, so this
   * decides which calendar dates [start, end] covers; it's also the zone for
   * expanding recurring events that don't carry their own. Defaults to UTC.
   */
  timeZone?: string | null;
}

/**
 * Events of the given calendars that occur in [start, end], with recurring
 * events expanded into occurrences, decrypted. The one query every event
 * reader should use so recurring and all-day events behave the same
 * everywhere (web, kiosk, companion apps, bots, planners).
 */
export async function queryEventsInRange(
  db: Database,
  { calendarIds, start, end, timeZone }: EventRangeQuery
): Promise<ExpandedEvent[]> {
  if (calendarIds.length === 0) return [];

  const zone = resolveTimeZone(timeZone);
  const firstDate = zonedCalendarDate(start, zone);
  const lastDate = zonedCalendarDate(end, zone);
  const afterLastDate = addUtcDays(lastDate, 1);

  const rows = await db
    .select()
    .from(events)
    .where(
      and(
        inArray(events.calendarId, calendarIds),
        or(
          // Timed events overlapping the range
          and(eq(events.isAllDay, false), lte(events.startTime, end), gte(events.endTime, start)),
          // All-day events on any calendar date the range covers
          and(eq(events.isAllDay, true), lt(events.startTime, afterLastDate), gte(events.endTime, firstDate)),
          // Recurring series that began before the range ends
          and(
            isNotNull(events.recurrenceRule),
            lte(events.startTime, new Date(Math.max(end.getTime(), afterLastDate.getTime())))
          ),
          // Modified occurrences moved out of the range: needed so their
          // original slot isn't also generated from the series
          and(
            isNotNull(events.recurringEventId),
            gte(events.originalStartTime, new Date(start.getTime() - DAY_MS)),
            lte(events.originalStartTime, new Date(end.getTime() + DAY_MS))
          )
        )
      )
    );

  return expandRecurringEvents(rows.map(decryptEventFields), start, end, {
    defaultTimeZone: zone,
    allDayRange: { start: firstDate, end: lastDate },
  });
}
