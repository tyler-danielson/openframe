import { test } from "node:test";
import assert from "node:assert/strict";
import {
  zonedWeekRange,
  WINDOWS_TIME_ZONE_IDS,
  fromFloating,
  getTimeZoneOffsetMs,
  getZonedParts,
  isValidTimeZone,
  normalizeTimeZone,
  parseDateOnlyUtc,
  resolveTimeZone,
  toFloating,
  zonedCalendarDate,
  zonedTimeToUtc,
} from "./timezone.js";

const HOUR = 60 * 60 * 1000;

test("getZonedParts reads wall-clock fields in the target zone", () => {
  const parts = getZonedParts(new Date("2026-07-04T01:30:00Z"), "America/Denver");
  assert.deepEqual(
    { ...parts, millisecond: undefined },
    { year: 2026, month: 7, day: 3, hour: 19, minute: 30, second: 0, millisecond: undefined }
  );
});

test("getTimeZoneOffsetMs follows DST", () => {
  assert.equal(getTimeZoneOffsetMs("America/New_York", new Date("2026-01-15T12:00:00Z")), -5 * HOUR);
  assert.equal(getTimeZoneOffsetMs("America/New_York", new Date("2026-07-15T12:00:00Z")), -4 * HOUR);
  assert.equal(getTimeZoneOffsetMs("Asia/Kolkata", new Date("2026-07-15T12:00:00Z")), 5.5 * HOUR);
});

test("zonedTimeToUtc converts ordinary wall-clock times", () => {
  const wall = { year: 2026, month: 4, day: 5, hour: 9, minute: 0, second: 0 };
  assert.equal(zonedTimeToUtc(wall, "America/Denver").toISOString(), "2026-04-05T15:00:00.000Z");
  assert.equal(zonedTimeToUtc(wall, "Europe/Berlin").toISOString(), "2026-04-05T07:00:00.000Z");
  assert.equal(zonedTimeToUtc(wall, "UTC").toISOString(), "2026-04-05T09:00:00.000Z");
});

test("zonedTimeToUtc shifts times in a spring-forward gap forward (RFC 5545)", () => {
  // 02:30 does not exist on 2026-03-08 in New York; it means 03:30 EDT.
  const ny = zonedTimeToUtc({ year: 2026, month: 3, day: 8, hour: 2, minute: 30, second: 0 }, "America/New_York");
  assert.equal(ny.toISOString(), "2026-03-08T07:30:00.000Z");
  // Southern hemisphere: Sydney springs forward 2026-10-04 02:00 → 03:00.
  const syd = zonedTimeToUtc({ year: 2026, month: 10, day: 4, hour: 2, minute: 30, second: 0 }, "Australia/Sydney");
  assert.equal(syd.toISOString(), "2026-10-03T16:30:00.000Z");
});

test("zonedTimeToUtc picks the first of two ambiguous fall-back times (RFC 5545)", () => {
  const ny = zonedTimeToUtc({ year: 2026, month: 11, day: 1, hour: 1, minute: 30, second: 0 }, "America/New_York");
  assert.equal(ny.toISOString(), "2026-11-01T05:30:00.000Z"); // 01:30 EDT, not EST
  const berlin = zonedTimeToUtc({ year: 2026, month: 10, day: 25, hour: 2, minute: 30, second: 0 }, "Europe/Berlin");
  assert.equal(berlin.toISOString(), "2026-10-25T00:30:00.000Z"); // 02:30 CEST, not CET
});

test("toFloating and fromFloating round-trip", () => {
  const instants = ["2026-01-10T15:45:00Z", "2026-03-08T12:00:00Z", "2026-07-01T23:59:00Z", "2026-11-01T06:30:00Z"];
  for (const iso of instants) {
    for (const zone of ["America/Los_Angeles", "Europe/London", "Asia/Tokyo", "Australia/Lord_Howe"]) {
      const instant = new Date(iso);
      assert.equal(fromFloating(toFloating(instant, zone), zone).toISOString(), instant.toISOString(), `${iso} in ${zone}`);
    }
  }
});

test("zonedCalendarDate returns UTC midnight of the local calendar date", () => {
  // 03:00Z on Apr 6 is still Apr 5 (21:00) in Denver.
  assert.equal(zonedCalendarDate(new Date("2026-04-06T03:00:00Z"), "America/Denver").toISOString(), "2026-04-05T00:00:00.000Z");
  assert.equal(zonedCalendarDate(new Date("2026-04-05T20:00:00Z"), "Asia/Tokyo").toISOString(), "2026-04-06T00:00:00.000Z");
});

test("parseDateOnlyUtc accepts both date forms", () => {
  assert.equal(parseDateOnlyUtc("2026-02-02").toISOString(), "2026-02-02T00:00:00.000Z");
  assert.equal(parseDateOnlyUtc("20260202").toISOString(), "2026-02-02T00:00:00.000Z");
});

test("normalizeTimeZone resolves IANA, Windows and prefixed TZIDs", () => {
  assert.equal(normalizeTimeZone("America/Denver"), "America/Denver");
  assert.equal(normalizeTimeZone('"Europe/Paris"'), "Europe/Paris");
  assert.equal(normalizeTimeZone("Eastern Standard Time"), "America/New_York");
  assert.equal(normalizeTimeZone("W. Europe Standard Time"), "Europe/Berlin");
  assert.equal(normalizeTimeZone("/mozilla.org/20050126_1/America/New_York"), "America/New_York");
  assert.equal(normalizeTimeZone("/citadel.org/20190914_1/America/Argentina/Buenos_Aires"), "America/Argentina/Buenos_Aires");
  assert.equal(normalizeTimeZone("Z"), "UTC");
  assert.equal(normalizeTimeZone("Not/AZone"), null);
  assert.equal(normalizeTimeZone(""), null);
  assert.equal(normalizeTimeZone(null), null);
});

test("every Windows zone mapping resolves in this runtime", () => {
  for (const [windows, iana] of Object.entries(WINDOWS_TIME_ZONE_IDS)) {
    assert.ok(isValidTimeZone(iana), `${windows} → ${iana}`);
  }
});

test("resolveTimeZone falls back for unknown zones", () => {
  assert.equal(resolveTimeZone("America/Chicago"), "America/Chicago");
  assert.equal(resolveTimeZone("Mars/Olympus_Mons"), "UTC");
  assert.equal(resolveTimeZone(undefined, "Europe/Oslo"), "Europe/Oslo");
});

test("zonedWeekRange spans the user's local Monday-to-Sunday week", () => {
  // Sunday 2026-03-08 23:30 in New York is already Monday in UTC.
  const { start, end } = zonedWeekRange(new Date("2026-03-09T03:30:00Z"), "America/New_York", 1);
  assert.equal(start.toISOString(), "2026-03-02T05:00:00.000Z");
  // DST starts 2026-03-08, so the week ends at EDT midnight.
  assert.equal(end.toISOString(), "2026-03-09T03:59:59.999Z");
});

test("zonedWeekRange honours a Sunday week start", () => {
  const { start } = zonedWeekRange(new Date("2026-03-11T12:00:00Z"), "UTC", 0);
  assert.equal(start.toISOString(), "2026-03-08T00:00:00.000Z");
});
