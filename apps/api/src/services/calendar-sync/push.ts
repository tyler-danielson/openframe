import type { calendars, events } from "@openframe/database/schema";
import type { Database } from "@openframe/database";
import { deleteEventFromGoogle, pushEventToGoogle, updateEventInGoogle, type PushResult } from "./google.js";
import { deleteEventFromMicrosoft, pushEventToMicrosoft, updateEventInMicrosoft } from "./microsoft.js";
import { getCalendarOAuthToken } from "./oauth.js";

type CalendarRecord = typeof calendars.$inferSelect;
type EventRecord = typeof events.$inferSelect;

/**
 * Mirror a local create/update/delete to the calendar's provider, through the
 * account the calendar belongs to. Returns null when there's nothing to push
 * to (local/ICS calendars, or no connected account).
 */
export async function pushEventChange(
  db: Database,
  calendar: CalendarRecord,
  event: EventRecord,
  action: "create" | "update" | "delete",
  fallbackTimeZone?: string | null
): Promise<PushResult | null> {
  if (calendar.provider !== "google" && calendar.provider !== "microsoft") return null;
  const token = await getCalendarOAuthToken(db, calendar);
  if (!token) return null;
  const timeZone = fallbackTimeZone ?? undefined;

  if (calendar.provider === "google") {
    if (action === "create") return pushEventToGoogle(db, calendar, event, token, timeZone);
    if (action === "update") return updateEventInGoogle(db, calendar, event, token, timeZone);
    return deleteEventFromGoogle(db, calendar, event, token);
  }
  if (action === "create") return pushEventToMicrosoft(db, calendar, event, token, timeZone);
  if (action === "update") return updateEventInMicrosoft(db, calendar, event, token, timeZone);
  return deleteEventFromMicrosoft(db, calendar, event, token);
}
