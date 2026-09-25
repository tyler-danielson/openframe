import { test } from "node:test";
import assert from "node:assert/strict";
import type { events } from "@openframe/database/schema";
import { expandRecurringEvents, extractRRuleValue } from "./recurrence.js";

type Event = typeof events.$inferSelect;

let nextId = 1;
function makeEvent(overrides: Partial<Event>): Event {
  const id = `00000000-0000-0000-0000-${String(nextId++).padStart(12, "0")}`;
  return {
    id,
    calendarId: "cal-1",
    externalId: `ext-${id}`,
    title: "Event",
    description: null,
    location: null,
    startTime: new Date("2026-01-01T00:00:00Z"),
    endTime: new Date("2026-01-01T01:00:00Z"),
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
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

const starts = (list: Event[]) => list.map((e) => e.startTime.toISOString());

test("extractRRuleValue handles prefixed, bare and multi-line rules", () => {
  assert.equal(extractRRuleValue("RRULE:FREQ=WEEKLY;BYDAY=MO"), "FREQ=WEEKLY;BYDAY=MO");
  assert.equal(extractRRuleValue("FREQ=DAILY"), "FREQ=DAILY");
  assert.equal(extractRRuleValue("EXDATE:20260101T000000Z\nRRULE:FREQ=DAILY"), "FREQ=DAILY");
  assert.equal(extractRRuleValue("EXDATE:20260101T000000Z"), null);
});

test("weekly evening events stay on their local weekday west of UTC", () => {
  // Monday 18:00 in Denver is Tuesday 00:00/01:00 UTC. Expanding the rule in
  // UTC used to produce Mondays at 00:00 UTC, i.e. Sunday evenings locally.
  const master = makeEvent({
    startTime: new Date("2026-01-06T01:00:00Z"), // Mon Jan 5, 18:00 MST
    endTime: new Date("2026-01-06T02:00:00Z"),
    recurrenceRule: "FREQ=WEEKLY;BYDAY=MO",
    timeZone: "America/Denver",
  });
  const result = expandRecurringEvents([master], new Date("2026-01-01T00:00:00Z"), new Date("2026-01-31T00:00:00Z"));
  assert.deepEqual(starts(result), [
    "2026-01-06T01:00:00.000Z",
    "2026-01-13T01:00:00.000Z",
    "2026-01-20T01:00:00.000Z",
    "2026-01-27T01:00:00.000Z",
  ]);
});

test("recurrences keep their wall-clock time across DST changes", () => {
  const master = makeEvent({
    startTime: new Date("2026-03-02T14:00:00Z"), // Mon 09:00 EST
    endTime: new Date("2026-03-02T15:00:00Z"),
    recurrenceRule: "FREQ=WEEKLY;BYDAY=MO",
    timeZone: "America/New_York",
  });
  const result = expandRecurringEvents([master], new Date("2026-03-01T00:00:00Z"), new Date("2026-03-17T00:00:00Z"));
  // DST starts Mar 8: 09:00 is 14:00Z before and 13:00Z after
  assert.deepEqual(starts(result), ["2026-03-02T14:00:00.000Z", "2026-03-09T13:00:00.000Z", "2026-03-16T13:00:00.000Z"]);
  assert.equal(result[1]!.endTime.getTime() - result[1]!.startTime.getTime(), 60 * 60 * 1000);
});

test("masters without their own zone expand in the default zone", () => {
  const master = makeEvent({
    startTime: new Date("2026-03-02T14:00:00Z"),
    endTime: new Date("2026-03-02T15:00:00Z"),
    recurrenceRule: "FREQ=WEEKLY",
  });
  const range: [Date, Date] = [new Date("2026-03-08T00:00:00Z"), new Date("2026-03-10T00:00:00Z")];
  assert.deepEqual(starts(expandRecurringEvents([master], ...range)), ["2026-03-09T14:00:00.000Z"]);
  assert.deepEqual(
    starts(expandRecurringEvents([master], ...range, { defaultTimeZone: "America/New_York" })),
    ["2026-03-09T13:00:00.000Z"]
  );
});

test("exdates remove individual occurrences", () => {
  const master = makeEvent({
    startTime: new Date("2026-05-04T16:00:00Z"),
    endTime: new Date("2026-05-04T17:00:00Z"),
    recurrenceRule: "FREQ=DAILY;COUNT=4",
    timeZone: "UTC",
    exdates: ["2026-05-05T16:00:00.000Z"],
  });
  const result = expandRecurringEvents([master], new Date("2026-05-01T00:00:00Z"), new Date("2026-05-31T00:00:00Z"));
  assert.deepEqual(starts(result), ["2026-05-04T16:00:00.000Z", "2026-05-06T16:00:00.000Z", "2026-05-07T16:00:00.000Z"]);
});

test("a modified instance replaces its original slot, even when moved to another day", () => {
  const master = makeEvent({
    externalId: "series-1",
    startTime: new Date("2026-06-01T15:00:00Z"),
    endTime: new Date("2026-06-01T16:00:00Z"),
    recurrenceRule: "FREQ=DAILY;COUNT=3",
    timeZone: "UTC",
  });
  const moved = makeEvent({
    externalId: "series-1_20260602T150000Z",
    recurringEventId: "series-1",
    originalStartTime: new Date("2026-06-02T15:00:00Z"),
    startTime: new Date("2026-06-05T18:00:00Z"),
    endTime: new Date("2026-06-05T19:00:00Z"),
    title: "Moved",
  });
  const result = expandRecurringEvents([master, moved], new Date("2026-06-01T00:00:00Z"), new Date("2026-06-30T00:00:00Z"));
  assert.deepEqual(starts(result), ["2026-06-01T15:00:00.000Z", "2026-06-03T15:00:00.000Z", "2026-06-05T18:00:00.000Z"]);
  assert.equal(result[2]!.title, "Moved");
});

test("cancelled rows are never returned", () => {
  const cancelled = makeEvent({ status: "cancelled", startTime: new Date("2026-06-01T10:00:00Z"), endTime: new Date("2026-06-01T11:00:00Z") });
  assert.equal(expandRecurringEvents([cancelled], new Date("2026-06-01T00:00:00Z"), new Date("2026-06-02T00:00:00Z")).length, 0);
});

test("UNTIL given as a UTC instant includes the final occurrence", () => {
  const master = makeEvent({
    startTime: new Date("2026-03-02T14:00:00Z"), // 09:00 EST
    endTime: new Date("2026-03-02T14:30:00Z"),
    recurrenceRule: "FREQ=WEEKLY;UNTIL=20260316T130000Z", // 09:00 EDT on Mar 16
    timeZone: "America/New_York",
  });
  const result = expandRecurringEvents([master], new Date("2026-03-01T00:00:00Z"), new Date("2026-04-30T00:00:00Z"));
  assert.deepEqual(starts(result), ["2026-03-02T14:00:00.000Z", "2026-03-09T13:00:00.000Z", "2026-03-16T13:00:00.000Z"]);
});

test("all-day recurrences are matched against the viewer's calendar dates", () => {
  const birthday = makeEvent({
    isAllDay: true,
    startTime: new Date("2020-04-05T00:00:00Z"),
    endTime: new Date("2020-04-05T00:00:00Z"), // inclusive end: single day
    recurrenceRule: "FREQ=YEARLY",
  });
  // A Denver viewer's "Apr 5, 2026" is 06:00Z Apr 5 → 05:59Z Apr 6.
  const rangeStart = new Date("2026-04-05T06:00:00Z");
  const rangeEnd = new Date("2026-04-06T05:59:59Z");
  const allDayRange = { start: new Date("2026-04-05T00:00:00Z"), end: new Date("2026-04-05T00:00:00Z") };
  assert.deepEqual(starts(expandRecurringEvents([birthday], rangeStart, rangeEnd, { allDayRange })), ["2026-04-05T00:00:00.000Z"]);
  // ...and not on the neighbouring day
  const nextDay = { start: new Date("2026-04-06T00:00:00Z"), end: new Date("2026-04-06T00:00:00Z") };
  assert.equal(expandRecurringEvents([birthday], rangeStart, rangeEnd, { allDayRange: nextDay }).length, 0);
});

test("multi-day occurrences that begin before the range are included", () => {
  const trip = makeEvent({
    isAllDay: true,
    startTime: new Date("2026-01-30T00:00:00Z"),
    endTime: new Date("2026-02-02T00:00:00Z"), // Jan 30 – Feb 2 inclusive
    recurrenceRule: "FREQ=MONTHLY;COUNT=2",
  });
  const allDayRange = { start: new Date("2026-02-01T00:00:00Z"), end: new Date("2026-02-01T00:00:00Z") };
  const result = expandRecurringEvents([trip], new Date("2026-02-01T00:00:00Z"), new Date("2026-02-01T23:59:59Z"), { allDayRange });
  assert.deepEqual(starts(result), ["2026-01-30T00:00:00.000Z"]);
});

test("unparseable rules fall back to the stored event", () => {
  const master = makeEvent({
    startTime: new Date("2026-06-01T10:00:00Z"),
    endTime: new Date("2026-06-01T11:00:00Z"),
    recurrenceRule: "FREQ=NONSENSE",
  });
  const originalError = console.error;
  console.error = () => {};
  try {
    const result = expandRecurringEvents([master], new Date("2026-06-01T00:00:00Z"), new Date("2026-06-02T00:00:00Z"));
    assert.deepEqual(starts(result), ["2026-06-01T10:00:00.000Z"]);
  } finally {
    console.error = originalError;
  }
});

test("duplicate rows of the same provider event are collapsed", () => {
  const a = makeEvent({ externalId: "dup", startTime: new Date("2026-06-01T10:00:00Z"), endTime: new Date("2026-06-01T11:00:00Z") });
  const b = { ...a, id: "another-row" };
  assert.equal(expandRecurringEvents([a, b], new Date("2026-06-01T00:00:00Z"), new Date("2026-06-02T00:00:00Z")).length, 1);
});

test("occurrence generation is capped", () => {
  const master = makeEvent({
    startTime: new Date("2026-01-01T00:00:00Z"),
    endTime: new Date("2026-01-01T00:00:01Z"),
    recurrenceRule: "FREQ=MINUTELY",
    timeZone: "UTC",
  });
  const result = expandRecurringEvents([master], new Date("2026-01-01T00:00:00Z"), new Date("2026-02-01T00:00:00Z"), {
    maxOccurrencesPerEvent: 50,
  });
  assert.ok(result.length <= 50);
});
