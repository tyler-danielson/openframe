import { test } from "node:test";
import assert from "node:assert/strict";
import type { events } from "@openframe/database/schema";
import { allDayDateSpan } from "./all-day.js";
import { buildGoogleEventBody, cancelledInstanceRef, mapGoogleEvent } from "./google.js";
import { mapHomeAssistantEvents } from "./home-assistant.js";
import { buildIcsRows } from "./ics.js";
import { parseIcs } from "./ics-parser.js";
import { graphTimeZoneName, mapMicrosoftEvent, parseGraphDateTime, rruleToGraphRecurrence } from "./microsoft.js";
import { isCalendarDue } from "./index.js";
import { parseQuickEvent } from "../quick-event.js";

type EventRecord = typeof events.$inferSelect;

function eventRecord(overrides: Partial<EventRecord>): EventRecord {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    calendarId: "cal",
    externalId: "local_x",
    title: "Title",
    description: null,
    location: null,
    startTime: new Date("2026-04-05T15:00:00Z"),
    endTime: new Date("2026-04-05T16:00:00Z"),
    isAllDay: false,
    status: "confirmed",
    recurrenceRule: null,
    timeZone: null,
    exdates: null,
    recurringEventId: null,
    originalStartTime: null,
    attendees: [],
    reminders: [],
    metadata: {},
    etag: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// --- Google ------------------------------------------------------------------

test("mapGoogleEvent: all-day events get UTC-midnight dates with an inclusive end", () => {
  const mapped = mapGoogleEvent({
    id: "a1",
    summary: "Vacation",
    start: { date: "2026-07-01" },
    end: { date: "2026-07-04" }, // exclusive: Jul 1–3
    status: "confirmed",
    etag: '"1"',
  })!;
  assert.equal(mapped.isAllDay, true);
  assert.equal(mapped.startTime.toISOString(), "2026-07-01T00:00:00.000Z");
  assert.equal(mapped.endTime.toISOString(), "2026-07-03T00:00:00.000Z");
  assert.equal(mapped.timeZone, null);
});

test("mapGoogleEvent: recurring timed events keep their zone and EXDATEs", () => {
  const mapped = mapGoogleEvent({
    id: "r1",
    summary: "Standup",
    start: { dateTime: "2026-03-02T09:00:00-05:00", timeZone: "America/New_York" },
    end: { dateTime: "2026-03-02T09:15:00-05:00", timeZone: "America/New_York" },
    recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO", "EXDATE;TZID=America/New_York:20260309T090000"],
    status: "confirmed",
  })!;
  assert.equal(mapped.recurrenceRule, "FREQ=WEEKLY;BYDAY=MO");
  assert.equal(mapped.timeZone, "America/New_York");
  assert.deepEqual(mapped.exdates, ["2026-03-09T13:00:00.000Z"]); // 09:00 EDT
  assert.equal(mapped.title, "Standup");
});

test("mapGoogleEvent: untitled events and modified instances", () => {
  const mapped = mapGoogleEvent({
    id: "r1_20260309T140000Z",
    start: { dateTime: "2026-03-10T15:00:00Z" },
    end: { dateTime: "2026-03-10T16:00:00Z" },
    recurringEventId: "r1",
    originalStartTime: { dateTime: "2026-03-09T14:00:00Z" },
    status: "confirmed",
  })!;
  assert.equal(mapped.title, "(No title)");
  assert.equal(mapped.recurringEventId, "r1");
  assert.equal(mapped.originalStartTime?.toISOString(), "2026-03-09T14:00:00.000Z");
  assert.equal(mapped.exdates, null);
});

test("cancelledInstanceRef identifies deleted occurrences, even from the id alone", () => {
  assert.deepEqual(
    cancelledInstanceRef({ id: "x", status: "cancelled", recurringEventId: "m", originalStartTime: { dateTime: "2026-03-09T14:00:00Z" } }),
    { masterId: "m", originalStart: new Date("2026-03-09T14:00:00Z") }
  );
  assert.deepEqual(cancelledInstanceRef({ id: "abc123_20260309T140000Z", status: "cancelled" }), {
    masterId: "abc123",
    originalStart: new Date("2026-03-09T14:00:00Z"),
  });
  assert.deepEqual(cancelledInstanceRef({ id: "abc123_20260309", status: "cancelled" }), {
    masterId: "abc123",
    originalStart: new Date("2026-03-09T00:00:00Z"),
  });
  // A deleted single event, and the id of a split ("this and following") series
  assert.equal(cancelledInstanceRef({ id: "abc123", status: "cancelled" }), null);
  assert.equal(cancelledInstanceRef({ id: "abc123_R20260309T140000", status: "cancelled" }), null);
});

test("buildGoogleEventBody: timed events always carry a zone (required for recurring events)", () => {
  const body = buildGoogleEventBody(eventRecord({ recurrenceRule: "FREQ=WEEKLY" }), "America/Denver");
  assert.deepEqual(body.start, { dateTime: "2026-04-05T15:00:00.000Z", timeZone: "America/Denver" });
  assert.deepEqual(body.recurrence, ["RRULE:FREQ=WEEKLY"]);
  const own = buildGoogleEventBody(eventRecord({ timeZone: "Europe/Paris" }), "America/Denver");
  assert.equal((own.start as { timeZone: string }).timeZone, "Europe/Paris");
});

test("buildGoogleEventBody: all-day events send exclusive end dates", () => {
  const body = buildGoogleEventBody(
    eventRecord({ isAllDay: true, startTime: new Date("2026-04-05T00:00:00Z"), endTime: new Date("2026-04-05T00:00:00Z") })
  );
  assert.deepEqual(body.start, { date: "2026-04-05" });
  assert.deepEqual(body.end, { date: "2026-04-06" });
});

// --- All-day spans -----------------------------------------------------------

test("allDayDateSpan handles canonical and legacy browser-local rows", () => {
  assert.deepEqual(allDayDateSpan(new Date("2026-04-05T00:00:00Z"), new Date("2026-04-06T00:00:00Z")), {
    start: "2026-04-05",
    endExclusive: "2026-04-07",
  });
  // Written by a browser in Denver: local midnight … local 23:59:59.999
  assert.deepEqual(allDayDateSpan(new Date("2026-04-05T06:00:00Z"), new Date("2026-04-06T05:59:59.999Z")), {
    start: "2026-04-05",
    endExclusive: "2026-04-06",
  });
  // Written by a browser in Berlin (UTC+2)
  assert.deepEqual(allDayDateSpan(new Date("2026-04-04T22:00:00Z"), new Date("2026-04-05T21:59:59.999Z")), {
    start: "2026-04-05",
    endExclusive: "2026-04-06",
  });
});

// --- Microsoft ---------------------------------------------------------------

test("parseGraphDateTime reads 7-digit fractions and non-UTC zones", () => {
  assert.equal(
    parseGraphDateTime({ dateTime: "2026-02-17T09:00:00.0000000", timeZone: "UTC" }).toISOString(),
    "2026-02-17T09:00:00.000Z"
  );
  assert.equal(
    parseGraphDateTime({ dateTime: "2026-07-17T09:00:00.0000000", timeZone: "Pacific Standard Time" }).toISOString(),
    "2026-07-17T16:00:00.000Z"
  );
});

test("mapMicrosoftEvent: all-day, organizer and response mapping", () => {
  const mapped = mapMicrosoftEvent({
    id: "ms1",
    subject: "Offsite",
    isAllDay: true,
    start: { dateTime: "2026-07-20T00:00:00.0000000", timeZone: "UTC" },
    end: { dateTime: "2026-07-23T00:00:00.0000000", timeZone: "UTC" },
    organizer: { emailAddress: { address: "Boss@Example.com" } },
    attendees: [
      { emailAddress: { address: "boss@example.com", name: "Boss" }, type: "required", status: { response: "organizer" } },
      { emailAddress: { address: "me@example.com" }, type: "optional", status: { response: "tentativelyAccepted" } },
    ],
    "@odata.etag": 'W/"x"',
  })!;
  assert.equal(mapped.startTime.toISOString(), "2026-07-20T00:00:00.000Z");
  assert.equal(mapped.endTime.toISOString(), "2026-07-22T00:00:00.000Z");
  assert.equal(mapped.attendees?.[0]?.organizer, true);
  assert.equal(mapped.attendees?.[1]?.organizer, false);
  assert.equal(mapped.attendees?.[1]?.responseStatus, "tentative");
  assert.equal(mapped.etag, 'W/"x"');
});

test("mapMicrosoftEvent: occurrences without a subject fall back to the series", () => {
  const mapped = mapMicrosoftEvent(
    {
      id: "occ1",
      seriesMasterId: "series1",
      start: { dateTime: "2026-02-17T09:00:00.0000000", timeZone: "UTC" },
      end: { dateTime: "2026-02-17T10:00:00.0000000", timeZone: "UTC" },
    },
    { title: "Weekly sync", location: "Room 4" }
  )!;
  assert.equal(mapped.title, "Weekly sync");
  assert.equal(mapped.location, "Room 4");
  assert.equal(mapped.recurringEventId, "series1");
});

test("rruleToGraphRecurrence converts common rules", () => {
  const start = new Date("2026-03-02T14:00:00Z"); // Monday 09:00 in New York
  assert.deepEqual(rruleToGraphRecurrence("FREQ=WEEKLY;BYDAY=MO,WE;COUNT=10", start, "America/New_York", false), {
    pattern: { type: "weekly", interval: 1, daysOfWeek: ["monday", "wednesday"], firstDayOfWeek: "sunday" },
    range: { type: "numbered", startDate: "2026-03-02", numberOfOccurrences: 10, recurrenceTimeZone: "Eastern Standard Time" },
  });
  assert.deepEqual(rruleToGraphRecurrence("RRULE:FREQ=MONTHLY;BYDAY=2TU", start, "America/New_York", false)?.pattern, {
    type: "relativeMonthly",
    interval: 1,
    daysOfWeek: ["tuesday"],
    index: "second",
  });
  assert.deepEqual(rruleToGraphRecurrence("FREQ=MONTHLY;BYDAY=FR;BYSETPOS=-1", start, "America/New_York", false)?.pattern, {
    type: "relativeMonthly",
    interval: 1,
    daysOfWeek: ["friday"],
    index: "last",
  });
  assert.deepEqual(
    rruleToGraphRecurrence("FREQ=YEARLY;UNTIL=20300101T000000Z", new Date("2026-04-05T00:00:00Z"), "UTC", true),
    {
      pattern: { type: "absoluteYearly", interval: 1, dayOfMonth: 5, month: 4 },
      range: { type: "endDate", startDate: "2026-04-05", endDate: "2030-01-01" },
    }
  );
  assert.deepEqual(rruleToGraphRecurrence("FREQ=DAILY;INTERVAL=2", start, "UTC", false)?.pattern, { type: "daily", interval: 2 });
  // Not representable in Outlook
  assert.equal(rruleToGraphRecurrence("FREQ=DAILY;BYHOUR=9,17", start, "UTC", false), null);
  assert.equal(rruleToGraphRecurrence("FREQ=MONTHLY;BYMONTHDAY=1,15", start, "UTC", false), null);
});

test("graphTimeZoneName prefers Windows ids", () => {
  assert.equal(graphTimeZoneName("America/Los_Angeles"), "Pacific Standard Time");
  assert.equal(graphTimeZoneName("UTC"), "UTC");
  assert.equal(graphTimeZoneName("America/Boise"), "America/Boise");
});

// --- ICS rows ------------------------------------------------------------------

test("buildIcsRows: overrides get their own ids and cancelled ones become exdates", () => {
  const feed = parseIcs(
    [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:s1",
      "SUMMARY:Series",
      "DTSTART:20260105T150000Z",
      "RRULE:FREQ=DAILY;COUNT=5",
      "EXDATE:20260106T150000Z",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:s1",
      "RECURRENCE-ID:20260107T150000Z",
      "SUMMARY:Series (moved)",
      "DTSTART:20260107T170000Z",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:s1",
      "RECURRENCE-ID:20260108T150000Z",
      "STATUS:CANCELLED",
      "DTSTART:20260108T150000Z",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:dup",
      "SUMMARY:Game 1",
      "DTSTART:20260201T180000Z",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:dup",
      "SUMMARY:Game 2",
      "DTSTART:20260208T180000Z",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "SUMMARY:No UID",
      "DTSTART:20260301T180000Z",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n")
  );
  const rows = buildIcsRows(feed);
  const byId = new Map(rows.map((r) => [r.externalId, r]));

  const series = byId.get("s1")!;
  assert.deepEqual(series.exdates, ["2026-01-06T15:00:00.000Z", "2026-01-08T15:00:00.000Z"]);
  const moved = byId.get("s1::2026-01-07T15:00:00.000Z")!;
  assert.equal(moved.recurringEventId, "s1");
  assert.equal(moved.originalStartTime?.toISOString(), "2026-01-07T15:00:00.000Z");
  assert.ok(byId.has("dup::2026-02-01T18:00:00.000Z") && byId.has("dup::2026-02-08T18:00:00.000Z"));
  assert.ok(rows.some((r) => r.externalId.startsWith("nouid::") && r.title === "No UID"));
  assert.equal(rows.length, 5);
  // Content hashes: stable across parses, different per row
  const again = new Map(buildIcsRows(feed).map((r) => [r.externalId, r.etag]));
  for (const row of rows) assert.equal(again.get(row.externalId), row.etag);
  assert.equal(new Set(rows.map((r) => r.etag)).size, rows.length);
});

// --- Home Assistant ------------------------------------------------------------

test("mapHomeAssistantEvents: exclusive all-day ends, per-occurrence ids, no collisions", () => {
  const rows = mapHomeAssistantEvents([
    { uid: "u1", summary: "Trash day", start: { date: "2026-04-06" }, end: { date: "2026-04-07" }, rrule: "FREQ=WEEKLY" },
    { uid: "u1", summary: "Trash day", start: { date: "2026-04-13" }, end: { date: "2026-04-14" }, rrule: "FREQ=WEEKLY" },
    { summary: "Practice", start: { dateTime: "2026-04-06T17:00:00-06:00" }, end: { dateTime: "2026-04-06T18:00:00-06:00" } },
    { summary: "Practice", start: { dateTime: "2026-04-06T17:00:00-06:00" }, end: { dateTime: "2026-04-06T18:00:00-06:00" } },
  ]);
  assert.equal(rows[0]!.endTime.toISOString(), "2026-04-06T00:00:00.000Z"); // single day
  assert.deepEqual(
    rows.map((r) => r.externalId),
    ["u1|2026-04-06", "u1|2026-04-13", "Practice-2026-04-06T17:00:00-06:00", "Practice-2026-04-06T17:00:00-06:00#2"]
  );
  assert.equal(rows[2]!.startTime.toISOString(), "2026-04-06T23:00:00.000Z");
});

// --- Scheduling ------------------------------------------------------------------

test("isCalendarDue honours intervals and backs off failing calendars", () => {
  const now = Date.parse("2026-06-01T12:00:00Z");
  const minutesAgo = (m: number) => new Date(now - m * 60_000);
  const base = { id: "c", provider: "google", syncInterval: null, lastSyncError: null, lastSyncErrorAt: null } as const;

  assert.equal(isCalendarDue({ ...base, lastSyncAt: null }, now), true);
  assert.equal(isCalendarDue({ ...base, lastSyncAt: minutesAgo(1) }, now), false); // default 2 min
  assert.equal(isCalendarDue({ ...base, lastSyncAt: minutesAgo(3) }, now), true);
  assert.equal(isCalendarDue({ ...base, provider: "ics", lastSyncAt: minutesAgo(10) }, now), false); // 15 min

  const failing = { ...base, lastSyncAt: minutesAgo(600), lastSyncError: "boom" };
  // 1 failure: 2 min × 2¹ = 4 min; 5 failures: 2 × 2⁵ = 64 min
  assert.equal(isCalendarDue({ ...failing, lastSyncErrorAt: minutesAgo(3) }, now, 1), false);
  assert.equal(isCalendarDue({ ...failing, lastSyncErrorAt: minutesAgo(5) }, now, 1), true);
  assert.equal(isCalendarDue({ ...failing, lastSyncErrorAt: minutesAgo(60) }, now, 5), false);
  assert.equal(isCalendarDue({ ...failing, lastSyncErrorAt: minutesAgo(65) }, now, 5), true);
  // Capped at 6 hours
  assert.equal(isCalendarDue({ ...failing, lastSyncErrorAt: minutesAgo(361) }, now, 30), true);
});

// --- Quick add ---------------------------------------------------------------------

test("parseQuickEvent interprets times in the user's zone", () => {
  const now = new Date("2026-04-05T20:00:00Z"); // 14:00 in Denver
  const parsed = parseQuickEvent("Dentist tomorrow at 2:30pm", "America/Denver", now)!;
  assert.equal(parsed.title, "Dentist");
  assert.equal(parsed.isAllDay, false);
  assert.equal(parsed.startTime.toISOString(), "2026-04-06T20:30:00.000Z");
  assert.equal(parsed.endTime.toISOString(), "2026-04-06T21:30:00.000Z");

  const allDay = parseQuickEvent("Call 3 people tomorrow", "America/Denver", now)!;
  assert.equal(allDay.isAllDay, true); // "3" is not a time
  assert.equal(allDay.title, "Call 3 people");
  assert.equal(allDay.startTime.toISOString(), "2026-04-06T00:00:00.000Z");

  // Late evening in Denver is already tomorrow in UTC; "today" is still local today
  const lateNight = parseQuickEvent("Wrap presents today at 9pm", "America/Denver", new Date("2026-04-06T04:30:00Z"))!;
  assert.equal(lateNight.startTime.toISOString(), "2026-04-06T03:00:00.000Z");
  assert.equal(parseQuickEvent("at 9pm", "UTC", now), null);
});
