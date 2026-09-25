/**
 * iCalendar (RFC 5545) parser for subscribed ICS feeds.
 *
 * Only what OpenFrame displays is extracted, but the structure is parsed
 * properly: folded lines, nested components (VALARM properties must not
 * leak into their VEVENT), quoted parameters, TZID/UTC/floating times,
 * DURATION, EXDATE and RECURRENCE-ID overrides.
 */
import rrule from "rrule";
const { RRule } = rrule;
import {
  addUtcDays,
  normalizeTimeZone,
  parseDateOnlyUtc,
  resolveTimeZone,
  zonedTimeToUtc,
} from "../../lib/timezone.js";

export interface IcsEvent {
  uid: string | null;
  /** Start of the occurrence this VEVENT overrides (RECURRENCE-ID), if any */
  recurrenceId: Date | null;
  summary: string;
  description: string | null;
  location: string | null;
  start: Date;
  /** Timed: end instant. All-day: UTC midnight of the last day (inclusive). */
  end: Date;
  isAllDay: boolean;
  /** IANA zone of DTSTART, used to expand the recurrence rule */
  timeZone: string | null;
  rrule: string | null;
  exdates: Date[];
  status: "confirmed" | "tentative" | "cancelled";
}

export interface IcsCalendar {
  name: string | null;
  timeZone: string | null;
  events: IcsEvent[];
}

export interface ParseIcsOptions {
  /** Zone for floating times when the feed has no X-WR-TIMEZONE */
  defaultTimeZone?: string;
}

interface ContentLine {
  name: string;
  params: Record<string, string>;
  value: string;
}

interface RawComponent {
  type: string;
  props: ContentLine[];
  children: RawComponent[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_LIST = /^\d{8}(T\d{6}Z?)?(,\d{8}(T\d{6}Z?)?)*$/i;

/** Split "NAME;P1=a;P2="b:c":value" respecting quoted parameter values. */
export function parseContentLine(line: string): ContentLine | null {
  let inQuotes = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ":" && !inQuotes) {
      colon = i;
      break;
    }
  }
  if (colon <= 0) return null;

  // Some Exchange exports leave "(UTC-05:00) ..." TZIDs unquoted, putting a
  // colon inside a parameter. For date properties, prefer the split whose
  // value actually looks like a date list.
  if (/^(DTSTART|DTEND|DUE|EXDATE|RDATE|RECURRENCE-ID)[;:]/i.test(line) && !DATE_LIST.test(line.slice(colon + 1).trim())) {
    const last = line.lastIndexOf(":");
    if (last > colon && DATE_LIST.test(line.slice(last + 1).trim())) colon = last;
  }

  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const segments: string[] = [];
  let current = "";
  inQuotes = false;
  for (const ch of head) {
    if (ch === '"') inQuotes = !inQuotes;
    if (ch === ";" && !inQuotes) {
      segments.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  segments.push(current);

  const name = (segments.shift() ?? "").trim().toUpperCase();
  if (!name) return null;
  const params: Record<string, string> = {};
  for (const segment of segments) {
    const eq = segment.indexOf("=");
    if (eq === -1) continue;
    const key = segment.slice(0, eq).trim().toUpperCase();
    params[key] = segment.slice(eq + 1).trim().replace(/^"|"$/g, "");
  }
  return { name, params, value };
}

/** RFC 5545 §3.3.11 TEXT unescaping, in a single pass. */
export function unescapeText(value: string): string {
  return value.replace(/\\([\\;,nN])/g, (_match, ch: string) => (ch === "n" || ch === "N" ? "\n" : ch));
}

function parseComponents(content: string): RawComponent {
  const unfolded = content.replace(/^\uFEFF/, "").replace(/\r?\n[ \t]/g, "");
  const root: RawComponent = { type: "ROOT", props: [], children: [] };
  const stack: RawComponent[] = [root];

  for (const rawLine of unfolded.split(/\r?\n/)) {
    if (!rawLine.trim()) continue;
    const line = parseContentLine(rawLine);
    if (!line) continue;
    const top = stack[stack.length - 1]!;
    if (line.name === "BEGIN") {
      const child: RawComponent = { type: line.value.trim().toUpperCase(), props: [], children: [] };
      top.children.push(child);
      stack.push(child);
    } else if (line.name === "END") {
      const type = line.value.trim().toUpperCase();
      // Pop to the matching component; tolerate unbalanced feeds
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i]!.type === type) {
          stack.length = i;
          break;
        }
      }
    } else {
      top.props.push(line);
    }
  }
  return root;
}

// --- Time zone resolution -------------------------------------------------

interface Observance {
  onsetFloating: Date;
  offsetFrom: number;
  offsetTo: number;
  rule: InstanceType<typeof RRule> | null;
  rdates: Date[];
}

interface ZoneDefinition {
  iana: string | null;
  observances: Observance[];
}

function parseUtcOffset(value: string | undefined): number | null {
  const match = /^([+-])(\d{2})(\d{2})(\d{2})?$/.exec((value ?? "").trim());
  if (!match) return null;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * ((Number(match[2]) * 60 + Number(match[3])) * 60 + Number(match[4] ?? 0)) * 1000;
}

function parseFloatingDateTime(value: string): Date | null {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?/.exec(value.trim());
  if (!match) return null;
  return new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4] ?? 0),
      Number(match[5] ?? 0),
      Number(match[6] ?? 0)
    )
  );
}

function buildZoneDefinition(component: RawComponent): ZoneDefinition {
  const location = component.props.find((p) => p.name === "X-LIC-LOCATION")?.value;
  const tzid = component.props.find((p) => p.name === "TZID")?.value;
  const iana = normalizeTimeZone(location) ?? normalizeTimeZone(tzid);
  const observances: Observance[] = [];
  for (const child of component.children) {
    if (child.type !== "STANDARD" && child.type !== "DAYLIGHT") continue;
    const get = (name: string) => child.props.find((p) => p.name === name)?.value;
    const onsetFloating = parseFloatingDateTime(get("DTSTART") ?? "");
    const offsetFrom = parseUtcOffset(get("TZOFFSETFROM"));
    const offsetTo = parseUtcOffset(get("TZOFFSETTO"));
    if (!onsetFloating || offsetFrom === null || offsetTo === null) continue;
    let rule: InstanceType<typeof RRule> | null = null;
    const rruleValue = get("RRULE");
    if (rruleValue) {
      try {
        rule = new RRule({ ...RRule.parseString(rruleValue), dtstart: onsetFloating, tzid: null });
      } catch {
        rule = null;
      }
    }
    const rdates = child.props
      .filter((p) => p.name === "RDATE")
      .flatMap((p) => p.value.split(","))
      .map(parseFloatingDateTime)
      .filter((d): d is Date => d !== null);
    observances.push({ onsetFloating, offsetFrom, offsetTo, rule, rdates });
  }
  return { iana, observances };
}

/** Offset in effect at a floating wall-clock time, from VTIMEZONE observances. */
function offsetFromObservances(observances: Observance[], wall: Date): number | null {
  let best: { onset: number; offset: number } | null = null;
  let earliest: Observance | null = null;
  for (const obs of observances) {
    if (!earliest || obs.onsetFloating < earliest.onsetFloating) earliest = obs;
    const onsets: Date[] = [];
    if (obs.rule) {
      const last = obs.rule.before(wall, true);
      if (last) onsets.push(last);
    } else if (obs.onsetFloating <= wall) {
      onsets.push(obs.onsetFloating);
    }
    for (const rdate of obs.rdates) if (rdate <= wall) onsets.push(rdate);
    for (const onset of onsets) {
      if (!best || onset.getTime() > best.onset) best = { onset: onset.getTime(), offset: obs.offsetTo };
    }
  }
  if (best) return best.offset;
  return earliest ? earliest.offsetFrom : null;
}

interface DateContext {
  zones: Map<string, ZoneDefinition>;
  floatingZone: string;
}

interface ParsedDate {
  date: Date;
  isDate: boolean;
  /** IANA zone the value was expressed in, if known ("UTC" for Z values) */
  zone: string | null;
}

function parseDateValue(value: string, params: Record<string, string>, ctx: DateContext): ParsedDate | null {
  const trimmed = value.trim();
  if (params.VALUE === "DATE" || /^\d{8}$/.test(trimmed)) {
    if (!/^\d{8}/.test(trimmed)) return null;
    return { date: parseDateOnlyUtc(trimmed.slice(0, 8)), isDate: true, zone: null };
  }

  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/i.exec(trimmed);
  if (!match) return null;
  const wall = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
  };

  if (match[7]) {
    return {
      date: new Date(Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second)),
      isDate: false,
      zone: "UTC",
    };
  }

  const tzid = params.TZID;
  if (tzid) {
    const definition = ctx.zones.get(tzid);
    const iana = normalizeTimeZone(tzid) ?? definition?.iana ?? null;
    if (iana) return { date: zonedTimeToUtc(wall, iana), isDate: false, zone: iana };
    if (definition?.observances.length) {
      const floating = new Date(Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second));
      const offset = offsetFromObservances(definition.observances, floating);
      if (offset !== null) return { date: new Date(floating.getTime() - offset), isDate: false, zone: null };
    }
  }

  // Floating time (or an unknown TZID): interpret in the calendar's zone
  return { date: zonedTimeToUtc(wall, ctx.floatingZone), isDate: false, zone: ctx.floatingZone };
}

/**
 * Dates from a standalone property line such as
 * "EXDATE;TZID=Europe/Paris:20260101T090000,20260108T090000" (the form
 * Google uses in an event's `recurrence` array). Floating values are read in
 * `floatingZone`.
 */
export function parseDatePropertyLine(line: string, floatingZone = "UTC"): Date[] {
  const parsed = parseContentLine(line);
  if (!parsed) return [];
  const ctx: DateContext = { zones: new Map(), floatingZone: resolveTimeZone(floatingZone) };
  const dates: Date[] = [];
  for (const part of parsed.value.split(",")) {
    const value = parseDateValue(part, parsed.params, ctx);
    if (value) dates.push(value.date);
  }
  return dates;
}

/** ISO 8601 duration ("P1D", "PT1H30M", "-P1W") in milliseconds. */
export function parseDuration(value: string): number | null {
  const match = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(value.trim());
  if (!match || value.trim().toUpperCase() === "P" || /T$/i.test(value.trim())) return null;
  const [, sign, weeks, days, hours, minutes, seconds] = match;
  const ms =
    (Number(weeks ?? 0) * 7 + Number(days ?? 0)) * DAY_MS +
    ((Number(hours ?? 0) * 60 + Number(minutes ?? 0)) * 60 + Number(seconds ?? 0)) * 1000;
  return sign === "-" ? -ms : ms;
}

function mapStatus(value: string | undefined): IcsEvent["status"] {
  switch (value?.trim().toUpperCase()) {
    case "TENTATIVE":
      return "tentative";
    case "CANCELLED":
      return "cancelled";
    default:
      return "confirmed";
  }
}

function toEvent(component: RawComponent, ctx: DateContext): IcsEvent | null {
  const first = (name: string) => component.props.find((p) => p.name === name);
  const all = (name: string) => component.props.filter((p) => p.name === name);

  const dtstart = first("DTSTART");
  const start = dtstart ? parseDateValue(dtstart.value, dtstart.params, ctx) : null;
  if (!start) return null;

  const isAllDay = start.isDate;
  let end: Date;
  const dtend = first("DTEND");
  const parsedEnd = dtend ? parseDateValue(dtend.value, dtend.params, ctx) : null;
  const duration = first("DURATION") ? parseDuration(first("DURATION")!.value) : null;

  if (isAllDay) {
    // Exclusive DTEND / duration → inclusive last day
    if (parsedEnd) {
      const endDay = new Date(Math.floor(parsedEnd.date.getTime() / DAY_MS) * DAY_MS);
      end = parsedEnd.isDate ? addUtcDays(endDay, -1) : endDay;
    } else if (duration !== null) {
      end = addUtcDays(start.date, Math.max(1, Math.round(duration / DAY_MS)) - 1);
    } else {
      end = start.date;
    }
    if (end < start.date) end = start.date;
  } else {
    if (parsedEnd) end = parsedEnd.date;
    else if (duration !== null) end = new Date(start.date.getTime() + duration);
    else end = start.date;
    if (end < start.date) end = start.date;
  }

  const recurrenceIdLine = first("RECURRENCE-ID");
  const recurrenceId = recurrenceIdLine ? parseDateValue(recurrenceIdLine.value, recurrenceIdLine.params, ctx) : null;

  const exdates: Date[] = [];
  for (const line of all("EXDATE")) {
    for (const part of line.value.split(",")) {
      const parsed = parseDateValue(part, line.params, ctx);
      if (!parsed) continue;
      exdates.push(isAllDay ? new Date(Math.floor(parsed.date.getTime() / DAY_MS) * DAY_MS) : parsed.date);
    }
  }

  const text = (name: string) => {
    const line = first(name);
    if (!line) return null;
    const value = unescapeText(line.value).trim();
    return value || null;
  };

  const rruleValue = first("RRULE")?.value.trim() || null;

  return {
    uid: first("UID")?.value.trim() || null,
    recurrenceId: recurrenceId
      ? isAllDay
        ? new Date(Math.floor(recurrenceId.date.getTime() / DAY_MS) * DAY_MS)
        : recurrenceId.date
      : null,
    summary: text("SUMMARY") ?? "(No title)",
    description: text("DESCRIPTION"),
    location: text("LOCATION"),
    start: start.date,
    end,
    isAllDay,
    timeZone: isAllDay ? null : start.zone,
    rrule: rruleValue,
    exdates,
    status: mapStatus(first("STATUS")?.value),
  };
}

export function parseIcs(content: string, options: ParseIcsOptions = {}): IcsCalendar {
  const root = parseComponents(content);
  const vcalendars = root.children.filter((c) => c.type === "VCALENDAR");
  // Some feeds concatenate several VCALENDARs; treat them as one
  const calendars = vcalendars.length > 0 ? vcalendars : [root];
  const calendarProp = (name: string) => {
    for (const calendar of calendars) {
      const value = calendar.props.find((p) => p.name === name)?.value.trim();
      if (value) return value;
    }
    return undefined;
  };

  const zones = new Map<string, ZoneDefinition>();
  for (const calendar of calendars) {
    for (const child of calendar.children) {
      if (child.type !== "VTIMEZONE") continue;
      const tzid = child.props.find((p) => p.name === "TZID")?.value;
      if (tzid) zones.set(tzid, buildZoneDefinition(child));
    }
  }

  const calendarZone = normalizeTimeZone(calendarProp("X-WR-TIMEZONE"));
  const ctx: DateContext = {
    zones,
    floatingZone: calendarZone ?? resolveTimeZone(options.defaultTimeZone),
  };

  const events: IcsEvent[] = [];
  for (const calendar of calendars) {
    for (const child of calendar.children) {
      if (child.type !== "VEVENT") continue;
      const event = toEvent(child, ctx);
      if (event) events.push(event);
    }
  }

  const name = calendarProp("X-WR-CALNAME");
  return {
    name: name ? unescapeText(name) : null,
    timeZone: calendarZone,
    events,
  };
}
