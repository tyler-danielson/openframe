/**
 * US Federal Holidays calculation module.
 * Works offline - no API calls needed.
 */

export interface FederalHoliday {
  name: string;
  date: Date;
  isObserved: boolean; // True if observed on different day (weekend shift)
  actualDate?: Date; // Original date if isObserved is true
}

/**
 * Get the nth occurrence of a weekday in a month.
 * @param year - The year
 * @param month - The month (0-indexed, January = 0)
 * @param weekday - Day of week (0 = Sunday, 1 = Monday, etc.)
 * @param n - Which occurrence (1 = first, 2 = second, etc.)
 */
function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const firstDay = new Date(year, month, 1);
  let dayOfWeek = firstDay.getDay();

  // Calculate first occurrence of the weekday
  let daysUntilWeekday = (weekday - dayOfWeek + 7) % 7;
  let date = 1 + daysUntilWeekday + (n - 1) * 7;

  return new Date(year, month, date);
}

/**
 * Get the last occurrence of a weekday in a month.
 */
function getLastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  // Start from last day of month
  const lastDay = new Date(year, month + 1, 0);
  let dayOfWeek = lastDay.getDay();

  // Calculate how many days to go back
  let daysBack = (dayOfWeek - weekday + 7) % 7;

  return new Date(year, month + 1, -daysBack);
}

/**
 * Get observed date for a fixed holiday (handles weekend shifts).
 * Federal holidays falling on Saturday are observed Friday,
 * those falling on Sunday are observed Monday.
 */
function getObservedDate(date: Date): { observed: Date; isObserved: boolean } {
  const dayOfWeek = date.getDay();

  if (dayOfWeek === 0) {
    // Sunday -> observe Monday
    return {
      observed: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
      isObserved: true,
    };
  } else if (dayOfWeek === 6) {
    // Saturday -> observe Friday
    return {
      observed: new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1),
      isObserved: true,
    };
  }

  return { observed: date, isObserved: false };
}

/**
 * Get all US federal holidays for a specific year.
 *
 * 10 Federal Holidays:
 * - Fixed: New Year's Day (Jan 1), Juneteenth (Jun 19), Independence Day (Jul 4),
 *          Veterans Day (Nov 11), Christmas Day (Dec 25)
 * - Floating: MLK Day (3rd Mon Jan), Presidents' Day (3rd Mon Feb),
 *             Memorial Day (last Mon May), Labor Day (1st Mon Sep),
 *             Columbus Day (2nd Mon Oct), Thanksgiving (4th Thu Nov)
 */
export function getFederalHolidaysForYear(year: number): FederalHoliday[] {
  const holidays: FederalHoliday[] = [];

  // Fixed holidays with weekend observation rules
  const fixedHolidays = [
    { name: "New Year's Day", month: 0, day: 1 },
    { name: "Juneteenth", month: 5, day: 19 },
    { name: "Independence Day", month: 6, day: 4 },
    { name: "Veterans Day", month: 10, day: 11 },
    { name: "Christmas Day", month: 11, day: 25 },
  ];

  for (const h of fixedHolidays) {
    const actualDate = new Date(year, h.month, h.day);
    const { observed, isObserved } = getObservedDate(actualDate);

    holidays.push({
      name: h.name,
      date: observed,
      isObserved,
      actualDate: isObserved ? actualDate : undefined,
    });
  }

  // Floating holidays (always fall on weekdays, no observation shift needed)

  // MLK Day - 3rd Monday in January
  holidays.push({
    name: "Martin Luther King Jr. Day",
    date: getNthWeekdayOfMonth(year, 0, 1, 3),
    isObserved: false,
  });

  // Presidents' Day - 3rd Monday in February
  holidays.push({
    name: "Presidents' Day",
    date: getNthWeekdayOfMonth(year, 1, 1, 3),
    isObserved: false,
  });

  // Memorial Day - Last Monday in May
  holidays.push({
    name: "Memorial Day",
    date: getLastWeekdayOfMonth(year, 4, 1),
    isObserved: false,
  });

  // Labor Day - 1st Monday in September
  holidays.push({
    name: "Labor Day",
    date: getNthWeekdayOfMonth(year, 8, 1, 1),
    isObserved: false,
  });

  // Columbus Day - 2nd Monday in October
  holidays.push({
    name: "Columbus Day",
    date: getNthWeekdayOfMonth(year, 9, 1, 2),
    isObserved: false,
  });

  // Thanksgiving - 4th Thursday in November
  holidays.push({
    name: "Thanksgiving",
    date: getNthWeekdayOfMonth(year, 10, 4, 4),
    isObserved: false,
  });

  // Sort by date
  holidays.sort((a, b) => a.date.getTime() - b.date.getTime());

  return holidays;
}

/**
 * Get federal holidays within a date range.
 */
export function getFederalHolidaysInRange(start: Date, end: Date): FederalHoliday[] {
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  const allHolidays: FederalHoliday[] = [];

  // Get holidays for each year in range
  for (let year = startYear; year <= endYear; year++) {
    allHolidays.push(...getFederalHolidaysForYear(year));
  }

  // Filter to only those within range
  const startTime = start.getTime();
  const endTime = end.getTime();

  return allHolidays.filter((h) => {
    const time = h.date.getTime();
    return time >= startTime && time <= endTime;
  });
}

/**
 * Check if a specific date is a federal holiday.
 */
export function isFederalHoliday(date: Date): FederalHoliday | null {
  const year = date.getFullYear();
  const holidays = getFederalHolidaysForYear(year);

  const dateStr = date.toDateString();
  return holidays.find((h) => h.date.toDateString() === dateStr) ?? null;
}
