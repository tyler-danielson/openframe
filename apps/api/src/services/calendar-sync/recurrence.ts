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

  for (const event of eventList) {
    if (!event.recurrenceRule) {
      // Non-recurring event - check if it falls in range
      if (event.startTime <= rangeEnd && event.endTime >= rangeStart) {
        result.push(event);
      }
      continue;
    }

    // Skip instances - they override the master
    if (event.recurringEventId) {
      result.push(event);
      continue;
    }

    // Expand recurring event
    try {
      const rule = RRule.fromString(
        `DTSTART:${formatDateForRRule(event.startTime)}\nRRULE:${event.recurrenceRule}`
      );

      const duration = event.endTime.getTime() - event.startTime.getTime();
      const occurrences = rule.between(rangeStart, rangeEnd, true);

      for (const occurrence of occurrences) {
        // Check if this occurrence has been overridden
        const override = eventList.find(
          (e) =>
            e.recurringEventId === event.externalId &&
            e.originalStartTime &&
            isSameDay(e.originalStartTime, occurrence)
        );

        if (override) {
          // Use the override instead
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

  // Sort by start time
  result.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  return result;
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
