import { test } from "node:test";
import assert from "node:assert/strict";
import { parseContentLine, parseDuration, parseIcs, unescapeText } from "./ics-parser.js";

const crlf = (lines: string[]) => lines.join("\r\n") + "\r\n";

// Shaped like Google Calendar's "secret address in iCal format" export
const GOOGLE_FEED = crlf([
  "BEGIN:VCALENDAR",
  "PRODID:-//Google Inc//Google Calendar 70.9054//EN",
  "VERSION:2.0",
  "X-WR-CALNAME:Family\\, Shared",
  "X-WR-TIMEZONE:America/Denver",
  "BEGIN:VTIMEZONE",
  "TZID:America/Denver",
  "X-LIC-LOCATION:America/Denver",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:-0700",
  "TZOFFSETTO:-0600",
  "TZNAME:MDT",
  "DTSTART:19700308T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0600",
  "TZOFFSETTO:-0700",
  "TZNAME:MST",
  "DTSTART:19701101T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
  "BEGIN:VEVENT",
  "DTSTART;TZID=America/Denver:20260105T180000",
  "DTEND;TZID=America/Denver:20260105T190000",
  "RRULE:FREQ=WEEKLY;BYDAY=MO",
  "EXDATE;TZID=America/Denver:20260112T180000",
  "DTSTAMP:20260101T000000Z",
  "UID:weekly-1@google.com",
  "SUMMARY:Soccer practice",
  "DESCRIPTION:Bring water\\, cleats and shin guards.\\nField 3; north side.",
  "LOCATION:Central Park\\, Field 3",
  "STATUS:CONFIRMED",
  "BEGIN:VALARM",
  "ACTION:DISPLAY",
  "DESCRIPTION:This is an event reminder",
  "TRIGGER:-P0DT0H30M0S",
  "END:VALARM",
  "BEGIN:VALARM",
  "ACTION:EMAIL",
  "SUMMARY:Alarm notification",
  "DESCRIPTION:This is an event reminder",
  "TRIGGER:-P0DT1H0M0S",
  "END:VALARM",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART;TZID=America/Denver:20260120T190000",
  "DTEND;TZID=America/Denver:20260120T200000",
  "RECURRENCE-ID;TZID=America/Denver:20260119T180000",
  "UID:weekly-1@google.com",
  "SUMMARY:Soccer practice (moved)",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "RECURRENCE-ID;TZID=America/Denver:20260126T180000",
  "DTSTART;TZID=America/Denver:20260126T180000",
  "UID:weekly-1@google.com",
  "STATUS:CANCELLED",
  "SUMMARY:Soccer practice",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART;VALUE=DATE:20260405",
  "DTEND;VALUE=DATE:20260406",
  "UID:birthday-1@google.com",
  "SUMMARY:Mom's birthday",
  "RRULE:FREQ=YEARLY",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART:20260210T150000Z",
  "DTEND:20260210T160000Z",
  "UID:utc-1@google.com",
  "SUMMARY:A very long title that the exporter folded across",
  "  two lines",
  "END:VEVENT",
  "END:VCALENDAR",
]);

test("Google-style feed: VALARM text does not leak into the event", () => {
  const cal = parseIcs(GOOGLE_FEED);
  const weekly = cal.events.find((e) => e.uid === "weekly-1@google.com" && !e.recurrenceId)!;
  assert.equal(weekly.summary, "Soccer practice");
  assert.equal(weekly.description, "Bring water, cleats and shin guards.\nField 3; north side.");
  assert.equal(weekly.location, "Central Park, Field 3");
});

test("Google-style feed: TZID times, rules, EXDATE and overrides", () => {
  const cal = parseIcs(GOOGLE_FEED);
  assert.equal(cal.name, "Family, Shared");
  assert.equal(cal.timeZone, "America/Denver");

  const weekly = cal.events.find((e) => e.uid === "weekly-1@google.com" && !e.recurrenceId)!;
  assert.equal(weekly.start.toISOString(), "2026-01-06T01:00:00.000Z"); // 18:00 MST
  assert.equal(weekly.end.toISOString(), "2026-01-06T02:00:00.000Z");
  assert.equal(weekly.timeZone, "America/Denver");
  assert.equal(weekly.rrule, "FREQ=WEEKLY;BYDAY=MO");
  assert.deepEqual(weekly.exdates.map((d) => d.toISOString()), ["2026-01-13T01:00:00.000Z"]);

  const overrides = cal.events.filter((e) => e.recurrenceId);
  assert.equal(overrides.length, 2);
  const moved = overrides.find((e) => e.status !== "cancelled")!;
  assert.equal(moved.recurrenceId!.toISOString(), "2026-01-20T01:00:00.000Z");
  assert.equal(moved.start.toISOString(), "2026-01-21T02:00:00.000Z");
  assert.equal(moved.summary, "Soccer practice (moved)");
  const cancelled = overrides.find((e) => e.status === "cancelled")!;
  assert.equal(cancelled.recurrenceId!.toISOString(), "2026-01-27T01:00:00.000Z");
});

test("all-day events use UTC-midnight dates with an inclusive end", () => {
  const birthday = parseIcs(GOOGLE_FEED).events.find((e) => e.uid === "birthday-1@google.com")!;
  assert.equal(birthday.isAllDay, true);
  assert.equal(birthday.start.toISOString(), "2026-04-05T00:00:00.000Z");
  assert.equal(birthday.end.toISOString(), "2026-04-05T00:00:00.000Z");
  assert.equal(birthday.timeZone, null);
  assert.equal(birthday.rrule, "FREQ=YEARLY");
});

test("folded lines are unfolded (CRLF and bare LF)", () => {
  const utc = parseIcs(GOOGLE_FEED).events.find((e) => e.uid === "utc-1@google.com")!;
  assert.equal(utc.summary, "A very long title that the exporter folded across two lines");
  const lfOnly = parseIcs(GOOGLE_FEED.replace(/\r\n/g, "\n")).events.find((e) => e.uid === "utc-1@google.com")!;
  assert.equal(lfOnly.summary, utc.summary);
  assert.equal(lfOnly.start.toISOString(), "2026-02-10T15:00:00.000Z");
});

// Shaped like an Outlook.com / Exchange published calendar
const OUTLOOK_FEED = crlf([
  "BEGIN:VCALENDAR",
  "METHOD:PUBLISH",
  "PRODID:Microsoft Exchange Server 2010",
  "VERSION:2.0",
  "X-WR-CALNAME:Work",
  "BEGIN:VTIMEZONE",
  "TZID:Eastern Standard Time",
  "BEGIN:STANDARD",
  "DTSTART:16010101T020000",
  "TZOFFSETFROM:-0400",
  "TZOFFSETTO:-0500",
  "RRULE:FREQ=YEARLY;INTERVAL=1;BYDAY=1SU;BYMONTH=11",
  "END:STANDARD",
  "BEGIN:DAYLIGHT",
  "DTSTART:16010101T020000",
  "TZOFFSETFROM:-0500",
  "TZOFFSETTO:-0400",
  "RRULE:FREQ=YEARLY;INTERVAL=1;BYDAY=2SU;BYMONTH=3",
  "END:DAYLIGHT",
  "END:VTIMEZONE",
  "BEGIN:VEVENT",
  "UID:040000008200E00074C5B7101A82E00800000000",
  "SUMMARY:Quarterly review",
  "DTSTART;TZID=Eastern Standard Time:20260715T100000",
  "DTEND;TZID=Eastern Standard Time:20260715T113000",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:allday-outlook",
  "SUMMARY:Offsite",
  "DTSTART;VALUE=DATE:20260720",
  "DTEND;VALUE=DATE:20260723",
  "END:VEVENT",
  "END:VCALENDAR",
]);

test("Outlook-style feed: Windows TZIDs and multi-day all-day events", () => {
  const cal = parseIcs(OUTLOOK_FEED);
  const review = cal.events.find((e) => e.summary === "Quarterly review")!;
  assert.equal(review.start.toISOString(), "2026-07-15T14:00:00.000Z"); // 10:00 EDT
  assert.equal(review.end.toISOString(), "2026-07-15T15:30:00.000Z");
  assert.equal(review.timeZone, "America/New_York");
  const offsite = cal.events.find((e) => e.summary === "Offsite")!;
  assert.equal(offsite.start.toISOString(), "2026-07-20T00:00:00.000Z");
  assert.equal(offsite.end.toISOString(), "2026-07-22T00:00:00.000Z"); // Jul 20–22 inclusive
});

test("unknown TZIDs fall back to the feed's VTIMEZONE rules", () => {
  // RFC-compliant (quoted) and Exchange-style unquoted display-name TZIDs
  const quoted = OUTLOOK_FEED.replace(/TZID=Eastern Standard Time/g, 'TZID="(UTC-05:00) Custom Eastern"').replace(
    "TZID:Eastern Standard Time",
    "TZID:(UTC-05:00) Custom Eastern"
  );
  const unquoted = OUTLOOK_FEED.replace(/Eastern Standard Time/g, "(UTC-05:00) Custom Eastern");
  for (const feed of [quoted, unquoted]) {
    const review = parseIcs(feed).events.find((e) => e.summary === "Quarterly review")!;
    assert.equal(review.start.toISOString(), "2026-07-15T14:00:00.000Z"); // DST rule applied
    assert.equal(review.end.toISOString(), "2026-07-15T15:30:00.000Z");
    assert.equal(review.timeZone, null);
    const winter = parseIcs(feed.replace("20260715T100000", "20260115T100000").replace("20260715T113000", "20260115T113000"));
    assert.equal(winter.events.find((e) => e.summary === "Quarterly review")!.start.toISOString(), "2026-01-15T15:00:00.000Z");
  }
});

test("missing DTEND and DURATION are handled per RFC 5545", () => {
  const cal = parseIcs(
    crlf([
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:a",
      "SUMMARY:Timed with duration",
      "DTSTART:20260301T100000Z",
      "DURATION:PT1H30M",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:b",
      "SUMMARY:All-day without end",
      "DTSTART;VALUE=DATE:20260302",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:c",
      "SUMMARY:All-day with duration",
      "DTSTART;VALUE=DATE:20260303",
      "DURATION:P2D",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:d",
      "DTSTART:20260304T120000Z",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:no-start",
      "SUMMARY:Skipped",
      "END:VEVENT",
      "END:VCALENDAR",
    ])
  );
  const byUid = new Map(cal.events.map((e) => [e.uid, e]));
  assert.equal(byUid.get("a")!.end.toISOString(), "2026-03-01T11:30:00.000Z");
  assert.equal(byUid.get("b")!.end.toISOString(), "2026-03-02T00:00:00.000Z");
  assert.equal(byUid.get("c")!.end.toISOString(), "2026-03-04T00:00:00.000Z");
  assert.equal(byUid.get("d")!.summary, "(No title)");
  assert.equal(byUid.get("d")!.end.toISOString(), "2026-03-04T12:00:00.000Z");
  assert.equal(byUid.has("no-start"), false);
});

test("floating times use X-WR-TIMEZONE, then the provided default", () => {
  const body = ["BEGIN:VEVENT", "UID:f", "SUMMARY:Floating", "DTSTART:20260601T090000", "DTEND:20260601T100000", "END:VEVENT"];
  const withCalendarZone = parseIcs(crlf(["BEGIN:VCALENDAR", "X-WR-TIMEZONE:Europe/Berlin", ...body, "END:VCALENDAR"]));
  assert.equal(withCalendarZone.events[0]!.start.toISOString(), "2026-06-01T07:00:00.000Z");
  const withDefault = parseIcs(crlf(["BEGIN:VCALENDAR", ...body, "END:VCALENDAR"]), { defaultTimeZone: "America/Chicago" });
  assert.equal(withDefault.events[0]!.start.toISOString(), "2026-06-01T14:00:00.000Z");
  const utcFallback = parseIcs(crlf(["BEGIN:VCALENDAR", ...body, "END:VCALENDAR"]));
  assert.equal(utcFallback.events[0]!.start.toISOString(), "2026-06-01T09:00:00.000Z");
});

test("comma-separated EXDATE lists and all-day EXDATEs", () => {
  const cal = parseIcs(
    crlf([
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:r",
      "SUMMARY:Daily",
      "DTSTART;VALUE=DATE:20260101",
      "RRULE:FREQ=DAILY;COUNT=10",
      "EXDATE;VALUE=DATE:20260103,20260105",
      "EXDATE;VALUE=DATE:20260107",
      "END:VEVENT",
      "END:VCALENDAR",
    ])
  );
  assert.deepEqual(
    cal.events[0]!.exdates.map((d) => d.toISOString().slice(0, 10)),
    ["2026-01-03", "2026-01-05", "2026-01-07"]
  );
});

test("content lines with quoted parameters split on the right colon", () => {
  const line = parseContentLine('ATTENDEE;CN="Doe, John: Esq.";ROLE=REQ-PARTICIPANT:mailto:john@example.com')!;
  assert.equal(line.name, "ATTENDEE");
  assert.equal(line.params.CN, "Doe, John: Esq.");
  assert.equal(line.params.ROLE, "REQ-PARTICIPANT");
  assert.equal(line.value, "mailto:john@example.com");
  const quotedTz = parseContentLine('DTSTART;TZID="America/New_York":20260310T090000')!;
  assert.equal(quotedTz.params.TZID, "America/New_York");
});

test("text unescaping is single-pass", () => {
  assert.equal(unescapeText("a\\\\nb"), "a\\nb"); // escaped backslash followed by n
  assert.equal(unescapeText("line1\\Nline2\\;x\\,y"), "line1\nline2;x,y");
});

test("durations", () => {
  assert.equal(parseDuration("PT15M"), 15 * 60 * 1000);
  assert.equal(parseDuration("P1W"), 7 * 24 * 60 * 60 * 1000);
  assert.equal(parseDuration("-P1DT2H"), -(26 * 60 * 60 * 1000));
  assert.equal(parseDuration("P"), null);
  assert.equal(parseDuration("PT"), null);
  assert.equal(parseDuration("garbage"), null);
});
