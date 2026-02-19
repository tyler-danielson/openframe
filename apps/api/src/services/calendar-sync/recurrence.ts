import rrule from "rrule";
const { RRule } = rrule;
import type { events } from "@openframe/database/schema";

type Event = typeof events.$inferSelect;

interface ExpandedEvent extends Event {
  isRecurrenceInstance?: boolean;
  originalEventId?: string;
}

export function expandRecurringEvents(
  eventList: Event[],
  rangeStart: Date,
  rangeEnd: Date
): ExpandedEvent[] {
  const result: ExpandedEvent[] = [];

  // Collect all instances (events with recurringEventId) indexed by their
  // master's externalId for fast lookup during expansion
  const instancesByMaster = new Map<string, Event[]>();
  for (const event of eventList) {
    if (event.recurringEventId) {
      const existing = instancesByMaster.get(event.recurringEventId) ?? [];
      existing.push(event);
      instancesByMaster.set(event.recurringEventId, existing);
    }
  }

  for (const event of eventList) {
    if (!event.recurrenceRule) {
      // Non-recurring event (including instances) - check if it falls in range
      if (event.startTime <= rangeEnd && event.endTime >= rangeStart) {
        result.push(event);
      }
      continue;
    }

    // Skip instances that also have a recurrenceRule (shouldn't happen, but defensive)
    if (event.recurringEventId) {
      if (event.startTime <= rangeEnd && event.endTime >= rangeStart) {
        result.push(event);
      }
      continue;
    }

    // Expand recurring event master
    try {
      const rule = RRule.fromString(
        `DTSTART:${formatDateForRRule(event.startTime)}\nRRULE:${event.recurrenceRule}`
      );

      const duration = event.endTime.getTime() - event.startTime.getTime();
      const occurrences = rule.between(rangeStart, rangeEnd, true);
      const instances = instancesByMaster.get(event.externalId!) ?? [];

      for (const occurrence of occurrences) {
        // Check if this occurrence has a stored instance (override or synced instance)
        const hasInstance = instances.some(
          (e) =>
            // Match by originalStartTime (modified instances)
            (e.originalStartTime && isSameDay(e.originalStartTime, occurrence)) ||
            // Match by actual startTime (unmodified instances synced individually)
            isSameDay(e.startTime, occurrence)
        );

        if (hasInstance) {
          // Instance already in results from the non-recurring branch above
          continue;
        }

        const endTime = new Date(occurrence.getTime() + duration);

        result.push({
          ...event,
          id: `${event.id}_${occurrence.toISOString()}`,
          startTime: occurrence,
          endTime,
          isRecurrenceInstance: true,
          originalEventId: event.id,
        });
      }
    } catch (error) {
      // If RRULE parsing fails, just include the event as-is
      console.error(`Failed to parse RRULE for event ${event.id}:`, error);
      if (event.startTime <= rangeEnd && event.endTime >= rangeStart) {
        result.push(event);
      }
    }
  }

  // Deduplicate by title + startTime (catches edge cases from sync overlaps)
  const seen = new Set<string>();
  const deduplicated = result.filter((event) => {
    const key = `${event.calendarId}|${event.title}|${event.startTime.getTime()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by start time
  deduplicated.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  return deduplicated;
}

function formatDateForRRule(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
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
