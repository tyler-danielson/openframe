import { addDays, addMonths, getDay, getDate, isAfter, isBefore, startOfDay, format } from "date-fns";
import type { RecurrenceRule } from "@openframe/shared";

/**
 * Get which occurrence of a weekday this is in the month.
 * e.g., April 7 (Monday) in first week → 1 (first Monday)
 */
function getNthWeekdayOfMonth(date: Date): number {
  return Math.ceil(getDate(date) / 7);
}

/**
 * Given a recurrence rule and date range, return all dates the routine applies to.
 */
export function expandRecurrence(
  rule: RecurrenceRule,
  rangeStart: Date,
  rangeEnd: Date,
  routineCreatedAt: Date
): Date[] {
  const dates: Date[] = [];
  const start = startOfDay(routineCreatedAt);
  let current = new Date(start);
  let occurrenceCount = 0;
  const maxIterations = 3000;
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;

    if (rule.endType === "after" && rule.endAfterCount && occurrenceCount >= rule.endAfterCount) break;
    if (rule.endType === "onDate" && rule.endDate && isAfter(current, new Date(rule.endDate))) break;
    if (isAfter(current, rangeEnd)) break;

    let matches = false;

    switch (rule.frequency) {
      case "daily":
        matches = true;
        break;

      case "weekly":
        if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
          matches = rule.daysOfWeek.includes(getDay(current));
        } else {
          matches = getDay(current) === getDay(start);
        }
        break;

      case "monthly":
        if (rule.monthlyMode === "dayOfMonth") {
          const targetDay = rule.dayOfMonth ?? getDate(start);
          matches = getDate(current) === targetDay;
        } else if (rule.monthlyMode === "dayOfWeek") {
          const targetWeek = rule.weekOfMonth ?? 1;
          const targetDay = rule.dayOfWeekForMonth ?? getDay(start);
          matches = getDay(current) === targetDay && getNthWeekdayOfMonth(current) === targetWeek;
        } else {
          matches = getDate(current) === getDate(start);
        }
        break;

      case "yearly":
        matches =
          current.getMonth() === start.getMonth() &&
          getDate(current) === getDate(start);
        break;
    }

    if (matches) {
      occurrenceCount++;
      if (!isBefore(current, rangeStart)) {
        dates.push(new Date(current));
      }
    }

    // Advance based on frequency and interval
    if (rule.frequency === "daily") {
      current = addDays(current, rule.interval);
    } else if (rule.frequency === "weekly") {
      // For weekly with specific days, advance day-by-day within the week
      // then skip by interval when wrapping around
      if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
        const nextDay = addDays(current, 1);
        // If we wrapped past Saturday back to Sunday and interval > 1, skip weeks
        if (getDay(nextDay) === 0 && rule.interval > 1) {
          current = addDays(nextDay, (rule.interval - 1) * 7);
        } else {
          current = nextDay;
        }
      } else {
        current = addDays(current, 7 * rule.interval);
      }
    } else if (rule.frequency === "monthly") {
      const nextDay = addDays(current, 1);
      // When we cross into a new month, skip by interval
      if (nextDay.getMonth() !== current.getMonth() && rule.interval > 1) {
        current = addMonths(nextDay, rule.interval - 1);
        // Reset to day 1 of that month
        current = new Date(current.getFullYear(), current.getMonth(), 1);
      } else {
        current = nextDay;
      }
    } else if (rule.frequency === "yearly") {
      // Jump to next year efficiently
      if (matches) {
        const nextYear = new Date(current.getFullYear() + rule.interval, start.getMonth(), getDate(start));
        current = nextYear;
      } else {
        current = addDays(current, 1);
      }
    }
  }

  return dates;
}

/**
 * Synthesize a RecurrenceRule from legacy frequency + daysOfWeek fields.
 */
export function getEffectiveRecurrenceRule(routine: {
  frequency: string;
  daysOfWeek: number[] | null;
  recurrenceRule: RecurrenceRule | null;
}): RecurrenceRule {
  if (routine.recurrenceRule) return routine.recurrenceRule;

  return {
    frequency: routine.frequency === "custom" ? "weekly" : (routine.frequency as RecurrenceRule["frequency"]),
    interval: 1,
    daysOfWeek: routine.daysOfWeek ?? [],
    endType: "never",
  };
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_ABBREVS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ORDINALS = ["first", "second", "third", "fourth", "last"];

/**
 * Generate a human-readable description of a recurrence rule.
 */
export function describeRecurrence(rule: RecurrenceRule): string {
  const { frequency, interval } = rule;

  let base = "";
  if (interval === 1) {
    base = frequency === "daily" ? "Every day"
      : frequency === "weekly" ? "Every week"
      : frequency === "monthly" ? "Every month"
      : "Every year";
  } else {
    const unitLabel = frequency === "daily" ? "days"
      : frequency === "weekly" ? "weeks"
      : frequency === "monthly" ? "months"
      : "years";
    base = `Every ${interval} ${unitLabel}`;
  }

  if (frequency === "weekly" && rule.daysOfWeek?.length) {
    const sorted = [...rule.daysOfWeek].sort((a, b) => a - b);
    const dayNames = sorted.map(d => DAY_ABBREVS[d]);
    base += ` on ${dayNames.join(", ")}`;
  }

  if (frequency === "monthly") {
    if (rule.monthlyMode === "dayOfMonth" && rule.dayOfMonth) {
      base += ` on day ${rule.dayOfMonth}`;
    } else if (rule.monthlyMode === "dayOfWeek" && rule.weekOfMonth != null && rule.dayOfWeekForMonth != null) {
      const ordinal = ORDINALS[rule.weekOfMonth - 1] ?? `${rule.weekOfMonth}th`;
      const dayName = DAY_NAMES[rule.dayOfWeekForMonth];
      base += ` on the ${ordinal} ${dayName}`;
    }
  }

  if (rule.endType === "after" && rule.endAfterCount) {
    base += `, ${rule.endAfterCount} times`;
  } else if (rule.endType === "onDate" && rule.endDate) {
    base += `, until ${format(new Date(rule.endDate), "MMM d, yyyy")}`;
  }

  return base;
}
