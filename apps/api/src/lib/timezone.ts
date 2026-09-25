/**
 * Timezone helpers built on Intl — no extra dependencies.
 *
 * Calendar data mixes three kinds of time:
 *  - instants (UTC timestamps, what Postgres stores),
 *  - wall-clock times in a named zone (what Google/ICS recurrence rules are
 *    defined in — "every Monday at 9:00 America/Denver"),
 *  - floating dates (all-day events), which this codebase stores as UTC
 *    midnight of the calendar date with an inclusive end date.
 *
 * The helpers below convert between them. "Floating" Date objects are Dates
 * whose UTC fields hold a wall-clock time; they are only used internally for
 * recurrence math and never persisted.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

const validityCache = new Map<string, boolean>();

/** True when `timeZone` is an IANA zone name the runtime understands. */
export function isValidTimeZone(timeZone: string | null | undefined): boolean {
  if (!timeZone) return false;
  const cached = validityCache.get(timeZone);
  if (cached !== undefined) return cached;
  let valid = false;
  try {
    getFormatter(timeZone);
    valid = true;
  } catch {
    valid = false;
  }
  validityCache.set(timeZone, valid);
  return valid;
}

export interface WallClock {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond?: number;
}

/** `timeZone` if it is a usable IANA zone, otherwise `fallback`. */
export function resolveTimeZone(timeZone: string | null | undefined, fallback = "UTC"): string {
  return timeZone && isValidTimeZone(timeZone) ? timeZone : fallback;
}

/** Wall-clock fields of `instant` as seen in `timeZone`. */
export function getZonedParts(instant: Date | number, timeZone: string): WallClock {
  const ms = typeof instant === "number" ? instant : instant.getTime();
  const parts = getFormatter(timeZone).formatToParts(new Date(ms));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
    millisecond: ((ms % 1000) + 1000) % 1000,
  };
}

/** Offset of `timeZone` from UTC at `instant`, in ms (local = utc + offset). */
export function getTimeZoneOffsetMs(timeZone: string, instant: Date | number): number {
  const ms = typeof instant === "number" ? instant : instant.getTime();
  const p = getZonedParts(ms, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/**
 * Convert a wall-clock time in `timeZone` to an instant.
 *
 * Follows RFC 5545 §3.3.5 for DST edges: a time inside a spring-forward gap
 * is interpreted with the offset in effect before the gap (02:30 → 03:30),
 * and an ambiguous fall-back time resolves to its first occurrence.
 */
export function zonedTimeToUtc(wall: WallClock, timeZone: string): Date {
  const wallAsUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
    wall.millisecond ?? 0
  );
  const offsetBefore = getTimeZoneOffsetMs(timeZone, wallAsUtc - DAY_MS);
  const offsetAfter = getTimeZoneOffsetMs(timeZone, wallAsUtc + DAY_MS);
  const offsetAt = getTimeZoneOffsetMs(timeZone, wallAsUtc);

  const valid: number[] = [];
  for (const offset of new Set([offsetBefore, offsetAt, offsetAfter])) {
    const candidate = wallAsUtc - offset;
    if (getTimeZoneOffsetMs(timeZone, candidate) === offset) valid.push(candidate);
  }

  if (valid.length > 0) return new Date(Math.min(...valid));
  // Nonexistent local time (spring-forward gap)
  return new Date(wallAsUtc - offsetBefore);
}

/** Wall-clock time of `instant` in `timeZone`, encoded in a Date's UTC fields. */
export function toFloating(instant: Date, timeZone: string): Date {
  const p = getZonedParts(instant, timeZone);
  return new Date(
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, p.millisecond ?? 0)
  );
}

/** Inverse of {@link toFloating}. */
export function fromFloating(floating: Date, timeZone: string): Date {
  return zonedTimeToUtc(
    {
      year: floating.getUTCFullYear(),
      month: floating.getUTCMonth() + 1,
      day: floating.getUTCDate(),
      hour: floating.getUTCHours(),
      minute: floating.getUTCMinutes(),
      second: floating.getUTCSeconds(),
      millisecond: floating.getUTCMilliseconds(),
    },
    timeZone
  );
}

/**
 * UTC midnight of the calendar date that `instant` falls on in `timeZone` —
 * the storage form used for all-day events.
 */
export function zonedCalendarDate(instant: Date, timeZone: string): Date {
  const p = getZonedParts(instant, timeZone);
  return new Date(Date.UTC(p.year, p.month - 1, p.day));
}

/**
 * The instants spanning `days` calendar days in `timeZone`, starting with the
 * day that contains `instant` (end inclusive, millisecond precision).
 */
export function zonedDayRange(instant: Date, timeZone: string, days = 1): { start: Date; end: Date } {
  const p = getZonedParts(instant, timeZone);
  const midnight = (date: Date) =>
    zonedTimeToUtc(
      { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour: 0, minute: 0, second: 0 },
      timeZone
    );
  const start = midnight(new Date(Date.UTC(p.year, p.month - 1, p.day)));
  const next = midnight(new Date(Date.UTC(p.year, p.month - 1, p.day + days)));
  return { start, end: new Date(next.getTime() - 1) };
}

/**
 * The instants spanning the 7-day week (in `timeZone`) that contains `instant`,
 * starting on `weekStartsOn` (0 = Sunday).
 */
export function zonedWeekRange(
  instant: Date,
  timeZone: string,
  weekStartsOn = 1
): { start: Date; end: Date } {
  const p = getZonedParts(instant, timeZone);
  const dow = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  const back = (dow - weekStartsOn + 7) % 7;
  const first = new Date(Date.UTC(p.year, p.month - 1, p.day - back));
  const noon = zonedTimeToUtc(
    { year: first.getUTCFullYear(), month: first.getUTCMonth() + 1, day: first.getUTCDate(), hour: 12, minute: 0, second: 0 },
    timeZone
  );
  return zonedDayRange(noon, timeZone, 7);
}

/**
 * A Date whose *local* fields show `instant`'s wall-clock time in `timeZone`,
 * for formatting with date-fns regardless of the server's own zone.
 */
export function toZonedDisplayDate(instant: Date, timeZone: string): Date {
  const p = getZonedParts(instant, timeZone);
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

/**
 * An event's start/end as display dates (see {@link toZonedDisplayDate});
 * all-day events keep their calendar date.
 */
export function eventDisplayTimes(
  event: { startTime: Date; endTime: Date; isAllDay: boolean },
  timeZone: string
): { startTime: Date; endTime: Date } {
  const zone = event.isAllDay ? "UTC" : timeZone;
  return { startTime: toZonedDisplayDate(event.startTime, zone), endTime: toZonedDisplayDate(event.endTime, zone) };
}

/** Inverse of {@link toZonedDisplayDate}. */
export function fromZonedDisplayDate(display: Date, timeZone: string): Date {
  return zonedTimeToUtc(
    {
      year: display.getFullYear(),
      month: display.getMonth() + 1,
      day: display.getDate(),
      hour: display.getHours(),
      minute: display.getMinutes(),
      second: display.getSeconds(),
      millisecond: display.getMilliseconds(),
    },
    timeZone
  );
}

/**
 * An instant inside calendar date `dateStr` ("2026-04-05") in `timeZone`
 * (noon, so DST changes can't push it onto a neighbouring day).
 */
export function zonedDateToInstant(dateStr: string, timeZone: string): Date {
  const date = parseDateOnlyUtc(dateStr.slice(0, 10));
  return zonedTimeToUtc(
    { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour: 12, minute: 0, second: 0 },
    timeZone
  );
}

/** UTC midnight of a date-only string ("2026-04-05" or "20260405"). */
export function parseDateOnlyUtc(value: string): Date {
  const digits = value.replace(/-/g, "");
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  return new Date(Date.UTC(year, month - 1, day));
}

/** Add whole days to a UTC-midnight date. */
export function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** "YYYY-MM-DD" of the date's UTC fields. */
export function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Windows zone IDs (used by Outlook/Exchange ICS feeds) → IANA, from CLDR
// windowsZones.xml (territory 001 defaults).
const WINDOWS_TIME_ZONES: Record<string, string> = {
  "Dateline Standard Time": "Etc/GMT+12",
  "UTC-11": "Etc/GMT+11",
  "Aleutian Standard Time": "America/Adak",
  "Hawaiian Standard Time": "Pacific/Honolulu",
  "Marquesas Standard Time": "Pacific/Marquesas",
  "Alaskan Standard Time": "America/Anchorage",
  "UTC-09": "Etc/GMT+9",
  "Pacific Standard Time (Mexico)": "America/Tijuana",
  "UTC-08": "Etc/GMT+8",
  "Pacific Standard Time": "America/Los_Angeles",
  "US Mountain Standard Time": "America/Phoenix",
  "Mountain Standard Time (Mexico)": "America/Mazatlan",
  "Mountain Standard Time": "America/Denver",
  "Yukon Standard Time": "America/Whitehorse",
  "Central America Standard Time": "America/Guatemala",
  "Central Standard Time": "America/Chicago",
  "Easter Island Standard Time": "Pacific/Easter",
  "Central Standard Time (Mexico)": "America/Mexico_City",
  "Canada Central Standard Time": "America/Regina",
  "SA Pacific Standard Time": "America/Bogota",
  "Eastern Standard Time (Mexico)": "America/Cancun",
  "Eastern Standard Time": "America/New_York",
  "Haiti Standard Time": "America/Port-au-Prince",
  "Cuba Standard Time": "America/Havana",
  "US Eastern Standard Time": "America/Indiana/Indianapolis",
  "Turks And Caicos Standard Time": "America/Grand_Turk",
  "Paraguay Standard Time": "America/Asuncion",
  "Atlantic Standard Time": "America/Halifax",
  "Venezuela Standard Time": "America/Caracas",
  "Central Brazilian Standard Time": "America/Cuiaba",
  "SA Western Standard Time": "America/La_Paz",
  "Pacific SA Standard Time": "America/Santiago",
  "Newfoundland Standard Time": "America/St_Johns",
  "Tocantins Standard Time": "America/Araguaina",
  "E. South America Standard Time": "America/Sao_Paulo",
  "SA Eastern Standard Time": "America/Cayenne",
  "Argentina Standard Time": "America/Argentina/Buenos_Aires",
  "Greenland Standard Time": "America/Nuuk",
  "Montevideo Standard Time": "America/Montevideo",
  "Magallanes Standard Time": "America/Punta_Arenas",
  "Saint Pierre Standard Time": "America/Miquelon",
  "Bahia Standard Time": "America/Bahia",
  "UTC-02": "Etc/GMT+2",
  "Azores Standard Time": "Atlantic/Azores",
  "Cape Verde Standard Time": "Atlantic/Cape_Verde",
  UTC: "Etc/UTC",
  "GMT Standard Time": "Europe/London",
  "Greenwich Standard Time": "Atlantic/Reykjavik",
  "Sao Tome Standard Time": "Africa/Sao_Tome",
  "Morocco Standard Time": "Africa/Casablanca",
  "W. Europe Standard Time": "Europe/Berlin",
  "Central Europe Standard Time": "Europe/Budapest",
  "Romance Standard Time": "Europe/Paris",
  "Central European Standard Time": "Europe/Warsaw",
  "W. Central Africa Standard Time": "Africa/Lagos",
  "Jordan Standard Time": "Asia/Amman",
  "GTB Standard Time": "Europe/Bucharest",
  "Middle East Standard Time": "Asia/Beirut",
  "Egypt Standard Time": "Africa/Cairo",
  "E. Europe Standard Time": "Europe/Chisinau",
  "Syria Standard Time": "Asia/Damascus",
  "West Bank Standard Time": "Asia/Hebron",
  "South Africa Standard Time": "Africa/Johannesburg",
  "FLE Standard Time": "Europe/Kiev",
  "Israel Standard Time": "Asia/Jerusalem",
  "South Sudan Standard Time": "Africa/Juba",
  "Kaliningrad Standard Time": "Europe/Kaliningrad",
  "Sudan Standard Time": "Africa/Khartoum",
  "Libya Standard Time": "Africa/Tripoli",
  "Namibia Standard Time": "Africa/Windhoek",
  "Arabic Standard Time": "Asia/Baghdad",
  "Turkey Standard Time": "Europe/Istanbul",
  "Arab Standard Time": "Asia/Riyadh",
  "Belarus Standard Time": "Europe/Minsk",
  "Russian Standard Time": "Europe/Moscow",
  "E. Africa Standard Time": "Africa/Nairobi",
  "Volgograd Standard Time": "Europe/Volgograd",
  "Iran Standard Time": "Asia/Tehran",
  "Arabian Standard Time": "Asia/Dubai",
  "Astrakhan Standard Time": "Europe/Astrakhan",
  "Azerbaijan Standard Time": "Asia/Baku",
  "Russia Time Zone 3": "Europe/Samara",
  "Mauritius Standard Time": "Indian/Mauritius",
  "Saratov Standard Time": "Europe/Saratov",
  "Georgian Standard Time": "Asia/Tbilisi",
  "Caucasus Standard Time": "Asia/Yerevan",
  "Afghanistan Standard Time": "Asia/Kabul",
  "West Asia Standard Time": "Asia/Tashkent",
  "Ekaterinburg Standard Time": "Asia/Yekaterinburg",
  "Pakistan Standard Time": "Asia/Karachi",
  "Qyzylorda Standard Time": "Asia/Qyzylorda",
  "India Standard Time": "Asia/Kolkata",
  "Sri Lanka Standard Time": "Asia/Colombo",
  "Nepal Standard Time": "Asia/Kathmandu",
  "Central Asia Standard Time": "Asia/Almaty",
  "Bangladesh Standard Time": "Asia/Dhaka",
  "Omsk Standard Time": "Asia/Omsk",
  "Myanmar Standard Time": "Asia/Yangon",
  "SE Asia Standard Time": "Asia/Bangkok",
  "Altai Standard Time": "Asia/Barnaul",
  "W. Mongolia Standard Time": "Asia/Hovd",
  "North Asia Standard Time": "Asia/Krasnoyarsk",
  "N. Central Asia Standard Time": "Asia/Novosibirsk",
  "Tomsk Standard Time": "Asia/Tomsk",
  "China Standard Time": "Asia/Shanghai",
  "North Asia East Standard Time": "Asia/Irkutsk",
  "Singapore Standard Time": "Asia/Singapore",
  "W. Australia Standard Time": "Australia/Perth",
  "Taipei Standard Time": "Asia/Taipei",
  "Ulaanbaatar Standard Time": "Asia/Ulaanbaatar",
  "Aus Central W. Standard Time": "Australia/Eucla",
  "Transbaikal Standard Time": "Asia/Chita",
  "Tokyo Standard Time": "Asia/Tokyo",
  "North Korea Standard Time": "Asia/Pyongyang",
  "Korea Standard Time": "Asia/Seoul",
  "Yakutsk Standard Time": "Asia/Yakutsk",
  "Cen. Australia Standard Time": "Australia/Adelaide",
  "AUS Central Standard Time": "Australia/Darwin",
  "E. Australia Standard Time": "Australia/Brisbane",
  "AUS Eastern Standard Time": "Australia/Sydney",
  "West Pacific Standard Time": "Pacific/Port_Moresby",
  "Tasmania Standard Time": "Australia/Hobart",
  "Vladivostok Standard Time": "Asia/Vladivostok",
  "Lord Howe Standard Time": "Australia/Lord_Howe",
  "Bougainville Standard Time": "Pacific/Bougainville",
  "Russia Time Zone 10": "Asia/Srednekolymsk",
  "Magadan Standard Time": "Asia/Magadan",
  "Norfolk Standard Time": "Pacific/Norfolk",
  "Sakhalin Standard Time": "Asia/Sakhalin",
  "Central Pacific Standard Time": "Pacific/Guadalcanal",
  "Russia Time Zone 11": "Asia/Kamchatka",
  "New Zealand Standard Time": "Pacific/Auckland",
  "UTC+12": "Etc/GMT-12",
  "Fiji Standard Time": "Pacific/Fiji",
  "Chatham Islands Standard Time": "Pacific/Chatham",
  "UTC+13": "Etc/GMT-13",
  "Tonga Standard Time": "Pacific/Tongatapu",
  "Samoa Standard Time": "Pacific/Apia",
  "Line Islands Standard Time": "Pacific/Kiritimati",
};

/** Exposed for tests. */
export const WINDOWS_TIME_ZONE_IDS = Object.freeze({ ...WINDOWS_TIME_ZONES });

/**
 * Resolve a TZID from a provider/ICS feed to an IANA zone, or null.
 *
 * Handles plain IANA names, quoted values, Windows zone IDs, and the
 * "/mozilla.org/20050126_1/America/New_York"-style prefixes some exporters
 * add.
 */
export function normalizeTimeZone(tzid: string | null | undefined): string | null {
  if (!tzid) return null;
  const trimmed = tzid.trim().replace(/^"|"$/g, "");
  if (!trimmed) return null;
  if (/^(z|utc|gmt|etc\/utc|etc\/gmt)$/i.test(trimmed)) return "UTC";
  if (isValidTimeZone(trimmed)) return trimmed;

  const windows = WINDOWS_TIME_ZONES[trimmed];
  if (windows && isValidTimeZone(windows)) return windows;

  // Prefixed paths: try progressively shorter "Area/Location" suffixes.
  const segments = trimmed.split("/").filter(Boolean);
  for (let i = 1; i < segments.length - 1; i++) {
    const candidate = segments.slice(i).join("/");
    if (isValidTimeZone(candidate)) return candidate;
  }
  return null;
}
