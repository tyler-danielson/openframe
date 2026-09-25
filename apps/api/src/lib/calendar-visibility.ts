import type { calendars } from "@openframe/database/schema";

type CalendarVisibility = NonNullable<(typeof calendars.$inferInsert)["visibility"]>;

/**
 * New calendars are hidden from the day, week and month views until the user
 * turns them on (the column default), so connecting an account with many shared
 * calendars doesn't flood the calendar. Calendars the user adds themselves, and
 * the main calendar of a newly connected account, start out shown instead.
 */
export const SHOWN_CALENDAR_VISIBILITY: CalendarVisibility = {
  week: true,
  month: true,
  day: true,
  popup: true,
  screensaver: false,
};
