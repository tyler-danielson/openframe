import rrule from "rrule";
const { RRule } = rrule;
import type { events } from "@openframe/database/schema";
import { fromFloating, getZonedParts, resolveTimeZone, toFloating } from "../../lib/timezone.js";

type Event = typeof events.$inferSelect;

export interface ExpandedEvent extends Event {
  isRecurrenceInstance?: boolean;
  originalEventId?: string;
}

export interface ExpandOptions {
  /**
   * Zone used to expand recurring events that carry no timeZone of their own
   * (e.g. events created in OpenFrame before timeZone was recorded).
   * Defaults to UTC.
   */
  defaultTimeZone?: string;
  /**
   * Inclusive calendar-date range (UTC-midnight dates) used for all-day
   * events. All-day events are floating dates, so they must be matched
   * against the viewer's local dates rather than the instant range.
   * Defaults to the UTC dates of rangeStart/rangeEnd.
   */
  allDayRange?: { start: Date; end: Date };
  /** Safety cap on generated occurrences per recurring event. */
  maxOccurrencesPerEvent?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const DEFAULT_MAX_OCCURRENCES = 1500;

function floorToUtcDay(date: Date): number {
  return Math.floor(date.getTime() / DAY_MS) * DAY_MS;
}

/** Minute-precision key so second-level rounding differences still match. */
function minuteKey(date: Date | number): number {
  const ms = typeof date === "number" ? date : date.getTime();
  return Math.floor(ms / MINUTE_MS);
}

function exdateKeys(event: Event): Set<number> {
  const keys = new Set<number>();
  for (const value of event.exdates ?? []) {
    const ms = new Date(value).getTime();
    if (!Number.isNaN(ms)) keys.add(minuteKey(ms));
  }
  return keys;
}

/** Extract the bare RRULE value from "RRULE:...", multi-line sets, or a bare rule. */
export function extractRRuleValue(rule: string): string | null {
  const lines = rule
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines) {
    if (/^RRULE:/i.test(line)) return line.slice(6).trim() || null;
  }
  const first = lines[0];
  if (!first || /^(EXDATE|RDATE|DTSTART|EXRULE)[;:]/i.test(first)) return null;
  return first;
}

/**
 * Build an RRule that iterates in "floating" wall-clock time, i.e. the
 * occurrences' UTC fields are the local time in `timeZone`. Expanding in wall
 * time keeps "every Monday 9:00" on Monday at 9:00 across DST changes, and
 * keeps BYDAY rules on the right weekday for events near midnight UTC.
 */
function buildFloatingRule(ruleValue: string, dtstartFloating: Date, timeZone: string, isAllDay: boolean) {
  const options = RRule.parseString(ruleValue);
  const untilMatch = /(?:^|;)UNTIL=(\d{8})(T\d{6}(Z)?)?/i.exec(ruleValue);
  if (options.until && untilMatch) {
    const [, , timePart, zulu] = untilMatch;
    if (isAllDay) {
      // Compare dates: any occurrence on the UNTIL date is included.
      options.until = new Date(floorToUtcDay(options.until) + DAY_MS - 1);
    } else if (!timePart) {
      // Date-only UNTIL on a timed event: include the whole day.
      options.until = new Date(floorToUtcDay(options.until) + DAY_MS - 1);
    } else if (zulu) {
      // UTC instant → wall clock of the event's zone.
      options.until = toFloating(options.until, timeZone);
    }
  }
  return new RRule({ ...options, dtstart: dtstartFloating, tzid: null });
}

/**
 * Expand recurring events into concrete occurrences within a range.
 *
 * Input is a mix of recurring masters (recurrenceRule set), their stored
 * modified instances (recurringEventId + originalStartTime) and plain events.
 * Occurrences listed in a master's `exdates`, or replaced by a stored
 * instance, are not generated. Cancelled rows are never returned.
 */
export function expandRecurringEvents(
  eventList: Event[],
  rangeStart: Date,
  rangeEnd: Date,
  options: ExpandOptions = {}
): ExpandedEvent[] {
  const defaultZone = resolveTimeZone(options.defaultTimeZone);
  const cap = options.maxOccurrencesPerEvent ?? DEFAULT_MAX_OCCURRENCES;
  const allDayStart = floorToUtcDay(options.allDayRange?.start ?? rangeStart);
  const allDayEnd = floorToUtcDay(options.allDayRange?.end ?? rangeEnd);

  const overlaps = (start: Date, end: Date, isAllDay: boolean): boolean => {
    if (isAllDay) {
      // Dates, not instants: an all-day event on D is "on" D for every viewer.
      return floorToUtcDay(start) <= allDayEnd && floorToUtcDay(end) >= allDayStart;
    }
    return start <= rangeEnd && end >= rangeStart;
  };

  // Stored instances of recurring series, grouped by the master's externalId
  const instancesByMaster = new Map<string, Event[]>();
  for (const event of eventList) {
    if (event.recurringEventId) {
      const list = instancesByMaster.get(event.recurringEventId) ?? [];
      list.push(event);
      instancesByMaster.set(event.recurringEventId, list);
    }
  }

  const result: ExpandedEvent[] = [];

  for (const event of eventList) {
    if (event.status === "cancelled") continue;

    const ruleValue = event.recurrenceRule ? extractRRuleValue(event.recurrenceRule) : null;
    if (!ruleValue || event.recurringEventId) {
      if (overlaps(event.startTime, event.endTime, event.isAllDay)) result.push(event);
      continue;
    }

    try {
      const zone = event.isAllDay ? "UTC" : resolveTimeZone(event.timeZone, defaultZone);
      const durationMs = Math.max(0, event.endTime.getTime() - event.startTime.getTime());
      const dtstartFloating = event.isAllDay
        ? new Date(floorToUtcDay(event.startTime))
        : toFloating(event.startTime, zone);
      const rule = buildFloatingRule(ruleValue, dtstartFloating, zone, event.isAllDay);

      // Occurrences starting before the range can still overlap it
      const windowStart = event.isAllDay
        ? new Date(allDayStart - durationMs - DAY_MS)
        : new Date(toFloating(rangeStart, zone).getTime() - durationMs - DAY_MS);
      const windowEnd = event.isAllDay
        ? new Date(allDayEnd + DAY_MS)
        : new Date(toFloating(rangeEnd, zone).getTime() + DAY_MS);

      const excluded = exdateKeys(event);
      const instances = instancesByMaster.get(event.externalId) ?? [];
      const replaced = new Set<number>();
      const instanceStarts = new Set<number>();
      const legacyInstanceDays = new Set<string>();
      for (const instance of instances) {
        instanceStarts.add(minuteKey(instance.startTime));
        if (instance.originalStartTime) {
          replaced.add(minuteKey(instance.originalStartTime));
        } else {
          const p = getZonedParts(instance.startTime, zone);
          legacyInstanceDays.add(`${p.year}-${p.month}-${p.day}`);
        }
      }

      const occurrences = rule.between(windowStart, windowEnd, true, (_date, i) => i < cap);
      for (const occurrence of occurrences) {
        const start = event.isAllDay ? occurrence : fromFloating(occurrence, zone);
        const key = minuteKey(start);
        if (excluded.has(key) || replaced.has(key) || instanceStarts.has(key)) continue;
        if (legacyInstanceDays.size > 0) {
          const p = getZonedParts(start, zone);
          if (legacyInstanceDays.has(`${p.year}-${p.month}-${p.day}`)) continue;
        }

        const end = new Date(start.getTime() + durationMs);
        if (!overlaps(start, end, event.isAllDay)) continue;

        result.push({
          ...event,
          id: `${event.id}_${start.toISOString()}`,
          startTime: start,
          endTime: end,
          isRecurrenceInstance: true,
          originalEventId: event.id,
        });
      }
    } catch (error) {
      // Unparseable rule: fall back to the stored first occurrence
      console.error(`Failed to expand RRULE for event ${event.id}:`, error);
      if (overlaps(event.startTime, event.endTime, event.isAllDay)) result.push(event);
    }
  }

  // Safety net for duplicate rows of the same provider event
  const seen = new Set<string>();
  const deduplicated = result.filter((event) => {
    const key = `${event.calendarId}|${event.externalId}|${event.startTime.getTime()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduplicated.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  return deduplicated;
}

function formatDateForRRule(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

export function generateRRule(options: {
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval?: number;
  until?: Date;
  count?: number;
  byDay?: string[];
  byMonthDay?: number[];
}): string {
  const parts: string[] = [];

  const freqMap = {
    daily: "DAILY",
    weekly: "WEEKLY",
    monthly: "MONTHLY",
    yearly: "YEARLY",
  };

  parts.push(`FREQ=${freqMap[options.frequency]}`);

  if (options.interval && options.interval > 1) {
    parts.push(`INTERVAL=${options.interval}`);
  }

  if (options.until) {
    parts.push(`UNTIL=${formatDateForRRule(options.until)}`);
  } else if (options.count) {
    parts.push(`COUNT=${options.count}`);
  }

  if (options.byDay?.length) {
    parts.push(`BYDAY=${options.byDay.join(",")}`);
  }

  if (options.byMonthDay?.length) {
    parts.push(`BYMONTHDAY=${options.byMonthDay.join(",")}`);
  }

  return parts.join(";");
}
