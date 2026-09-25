import { test } from "node:test";
import assert from "node:assert/strict";
import {
  describeTimeUntil,
  dueReminders,
  isDailyAgendaDue,
  parseTimeOfDay,
  pendingReminderKeys,
  reminderKey,
} from "./notification-timing.js";

const at = (iso: string) => new Date(iso);
const agendaDue = (now: string, timeZone: string, agendaTime: string, lastSentAt: string | null = null) =>
  isDailyAgendaDue({ now: at(now), timeZone, agendaTime, lastSentAt: lastSentAt ? at(lastSentAt) : null });

test("parseTimeOfDay accepts times of day only", () => {
  assert.equal(parseTimeOfDay("07:00"), 420);
  assert.equal(parseTimeOfDay("7:05"), 425);
  assert.equal(parseTimeOfDay("23:59:30"), 1439);
  for (const bad of ["", "24:00", "07:60", "7am", "0700", null, undefined]) {
    assert.equal(parseTimeOfDay(bad), null, String(bad));
  }
});

test("the daily agenda is due at the agenda time on the user's clock", () => {
  // 07:00 in Denver (MDT, UTC-6) is 13:00Z
  assert.equal(agendaDue("2026-09-25T12:59:00Z", "America/Denver", "07:00"), false);
  assert.equal(agendaDue("2026-09-25T13:00:00Z", "America/Denver", "07:00"), true);
  assert.equal(agendaDue("2026-09-25T13:00:00Z", "UTC", "07:00"), false); // 13:00 in UTC: too late
  assert.equal(agendaDue("2026-09-25T07:00:00Z", "UTC", "07:00"), true);
});

test("the daily agenda goes out once per local day", () => {
  const sent = "2026-09-25T13:00:00Z"; // 07:00 Denver
  assert.equal(agendaDue("2026-09-25T13:01:00Z", "America/Denver", "07:00", sent), false);
  // Changing the time later that day doesn't send a second one
  assert.equal(agendaDue("2026-09-25T15:00:00Z", "America/Denver", "09:00", sent), false);
  // Next local day
  assert.equal(agendaDue("2026-09-26T13:00:00Z", "America/Denver", "07:00", sent), true);
  // Local days, not UTC days: sent 18:00 Denver (00:00Z next UTC day), still the
  // same local day at 19:00 Denver
  assert.equal(agendaDue("2026-09-26T01:00:00Z", "America/Denver", "18:00", "2026-09-26T00:00:00Z"), false);
});

test("a missed daily agenda is caught up for two hours, then skipped", () => {
  assert.equal(agendaDue("2026-09-25T15:00:00Z", "America/Denver", "07:00"), true); // 09:00
  assert.equal(agendaDue("2026-09-25T15:01:00Z", "America/Denver", "07:00"), false); // 09:01
});

test("the daily agenda follows DST: spring-forward gap and repeated fall-back hour", () => {
  // New York springs forward 2026-03-08 02:00 EST → 03:00 EDT; 02:30 doesn't exist
  assert.equal(agendaDue("2026-03-08T06:59:00Z", "America/New_York", "02:30"), false); // 01:59 EST
  assert.equal(agendaDue("2026-03-08T07:00:00Z", "America/New_York", "02:30"), true); // 03:00 EDT
  // Falls back 2026-11-01 02:00 EDT → 01:00 EST; 01:30 happens twice
  const first = "2026-11-01T05:30:00Z"; // 01:30 EDT
  assert.equal(agendaDue(first, "America/New_York", "01:30"), true);
  assert.equal(agendaDue("2026-11-01T06:30:00Z", "America/New_York", "01:30", first), false); // 01:30 EST
  // 07:00 after fall-back is 12:00Z, not 11:00Z
  assert.equal(agendaDue("2026-11-01T11:00:00Z", "America/New_York", "07:00"), false);
  assert.equal(agendaDue("2026-11-01T12:00:00Z", "America/New_York", "07:00"), true);
  // Southern hemisphere: Sydney springs forward 2026-10-04 02:00 → 03:00 (UTC+11)
  assert.equal(agendaDue("2026-10-03T20:00:00Z", "Australia/Sydney", "07:00"), true);
  assert.equal(agendaDue("2026-10-03T19:59:00Z", "Australia/Sydney", "07:00"), false);
});

test("an invalid agenda time never sends", () => {
  assert.equal(agendaDue("2026-09-25T13:00:00Z", "America/Denver", ""), false);
  assert.equal(agendaDue("2026-09-25T13:00:00Z", "America/Denver", "25:00"), false);
});

const event = (id: string, start: string, extra: { isAllDay?: boolean; originalEventId?: string } = {}) => ({
  id,
  startTime: at(start),
  isAllDay: extra.isAllDay ?? false,
  originalEventId: extra.originalEventId,
});
const due = (events: ReturnType<typeof event>[], now: string, leadMinutes = 15, sent: string[] = []) =>
  dueReminders(events, { now: at(now), leadMinutes, sent }).map((e) => e.id);

test("a reminder is due from lead minutes before the start until the start", () => {
  const dentist = [event("dentist", "2026-09-25T21:00:00Z")];
  assert.deepEqual(due(dentist, "2026-09-25T20:44:59Z"), []);
  assert.deepEqual(due(dentist, "2026-09-25T20:45:00Z"), ["dentist"]);
  // Showed up late (created or synced after its reminder time): still reminded
  assert.deepEqual(due(dentist, "2026-09-25T20:58:00Z"), ["dentist"]);
  assert.deepEqual(due(dentist, "2026-09-25T21:00:00Z"), []);
  assert.deepEqual(due(dentist, "2026-09-25T19:59:00Z", 60), []);
  assert.deepEqual(due(dentist, "2026-09-25T20:00:00Z", 60), ["dentist"]);
});

test("all-day events get no time-based reminder", () => {
  assert.deepEqual(due([event("holiday", "2026-09-26T00:00:00Z", { isAllDay: true })], "2026-09-25T23:50:00Z"), []);
});

test("one reminder per occurrence: keyed on the event (series) and start", () => {
  const first = event("series_2026-09-25T21:00:00.000Z", "2026-09-25T21:00:00Z", { originalEventId: "series" });
  const second = event("series_2026-09-26T21:00:00.000Z", "2026-09-26T21:00:00Z", { originalEventId: "series" });
  assert.equal(reminderKey(first), "series@2026-09-25T21:00:00.000Z");
  const sent = [reminderKey(first)];
  assert.deepEqual(due([first], "2026-09-25T20:50:00Z", 15, sent), []);
  assert.deepEqual(due([second], "2026-09-26T20:50:00Z", 15, sent), [second.id]);
  // Listed twice → reminded once
  assert.deepEqual(due([first, first], "2026-09-25T20:50:00Z"), [first.id]);
  // A plain event moved to a new time is reminded for the new time
  const moved = event("dentist", "2026-09-25T21:30:00Z");
  assert.deepEqual(due([moved], "2026-09-25T21:20:00Z", 15, ["dentist@2026-09-25T21:00:00.000Z"]), ["dentist"]);
});

test("reminders count real minutes across DST changes", () => {
  // 03:10 EDT on 2026-03-08 (07:10Z): 15 minutes before is 01:55 EST
  const afterGap = [event("gap", "2026-03-08T07:10:00Z")];
  assert.deepEqual(due(afterGap, "2026-03-08T06:54:00Z"), []);
  assert.deepEqual(due(afterGap, "2026-03-08T06:55:00Z"), ["gap"]);
  // The second 01:30 on 2026-11-01 (EST, 06:30Z): an hour before is the first 01:30 (EDT)
  const repeated = [event("repeat", "2026-11-01T06:30:00Z")];
  assert.deepEqual(due(repeated, "2026-11-01T05:29:00Z", 60), []);
  assert.deepEqual(due(repeated, "2026-11-01T05:30:00Z", 60), ["repeat"]);
});

test("pendingReminderKeys drops occurrences that have started", () => {
  const keys = ["a@2026-09-25T21:00:00.000Z", "b_2026-09-25T22:00:00.000Z@2026-09-25T22:00:00.000Z"];
  assert.deepEqual(pendingReminderKeys(keys, at("2026-09-25T21:00:00Z")), [keys[1]]);
});

test("describeTimeUntil rounds up to whole minutes", () => {
  assert.equal(describeTimeUntil(at("2026-09-25T21:00:00Z"), at("2026-09-25T20:45:30Z")), "in 15 minutes");
  assert.equal(describeTimeUntil(at("2026-09-25T21:00:00Z"), at("2026-09-25T20:59:30Z")), "in 1 minute");
  assert.equal(describeTimeUntil(at("2026-09-25T21:00:00Z"), at("2026-09-25T20:00:00Z")), "in 1 hour");
  assert.equal(describeTimeUntil(at("2026-09-25T21:00:00Z"), at("2026-09-25T19:30:00Z")), "in 1 hour 30 minutes");
});
