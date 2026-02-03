import { eq, and } from "drizzle-orm";
import { calendars, events, type oauthTokens } from "@openframe/database/schema";
import type { Database } from "@openframe/database";

interface GoogleCalendar {
  id: string;
  summary: string;
  description?: string;
  backgroundColor?: string;
  primary?: boolean;
  accessRole: string;
}

interface GoogleEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  status: string;
  recurrence?: string[];
  recurringEventId?: string;
  originalStartTime?: { dateTime?: string; date?: string };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
    organizer?: boolean;
  }>;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{ method: string; minutes: number }>;
  };
  etag?: string;
}

interface GoogleCalendarListResponse {
  items: GoogleCalendar[];
  nextPageToken?: string;
}

interface GoogleEventsResponse {
  items: GoogleEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

type OAuthToken = typeof oauthTokens.$inferSelect;

/**
 * Parse a date-only string (YYYY-MM-DD) as local midnight.
 * This is needed for all-day events because:
 * - Google sends date-only strings like "2026-02-02" for all-day events
 * - new Date("2026-02-02") parses this as UTC midnight, causing timezone issues
 * - All-day events should be treated as "floating" dates (the same date everywhere)
 */
function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split("-").map(Number);
  const year = parts[0] ?? 0;
  const month = (parts[1] ?? 1) - 1;
  const day = parts[2] ?? 1;
  return new Date(year, month, day, 0, 0, 0, 0);
}

async function refreshGoogleToken(token: OAuthToken): Promise<string> {
  if (!token.refreshToken) {
    throw new Error("No refresh token available");
  }

  if (token.expiresAt && token.expiresAt > new Date()) {
    return token.accessToken;
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: token.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh Google token");
  }

  const data = await response.json() as { access_token: string };
  return data.access_token;
}

export async function syncGoogleCalendars(
  db: Database,
  userId: string,
  token: OAuthToken,
  syncToken?: string,
  calendarId?: string
): Promise<void> {
  const accessToken = await refreshGoogleToken(token);

  // If no specific calendar, sync the calendar list first
  if (!calendarId) {
    await syncCalendarList(db, userId, accessToken);
  }

  // Get calendars to sync
  const calendarsToSync = calendarId
    ? await db
        .select()
        .from(calendars)
        .where(
          and(
            eq(calendars.id, calendarId),
            eq(calendars.userId, userId),
            eq(calendars.provider, "google")
          )
        )
    : await db
        .select()
        .from(calendars)
        .where(
          and(
            eq(calendars.userId, userId),
            eq(calendars.provider, "google"),
            eq(calendars.syncEnabled, true)
          )
        );

  // Sync events for each calendar
  for (const calendar of calendarsToSync) {
    await syncCalendarEvents(
      db,
      calendar.id,
      calendar.externalId,
      accessToken,
      syncToken ?? calendar.syncToken ?? undefined
    );
  }
}

async function syncCalendarList(
  db: Database,
  userId: string,
  accessToken: string
): Promise<void> {
  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch Google calendars");
  }

  const data = (await response.json()) as GoogleCalendarListResponse;

  for (const gcal of data.items) {
    const [existing] = await db
      .select()
      .from(calendars)
      .where(
        and(
          eq(calendars.userId, userId),
          eq(calendars.provider, "google"),
          eq(calendars.externalId, gcal.id)
        )
      )
      .limit(1);

    if (existing) {
      await db
        .update(calendars)
        .set({
          name: gcal.summary,
          description: gcal.description,
          color: gcal.backgroundColor ?? "#3B82F6",
          isPrimary: gcal.primary ?? false,
          isReadOnly: gcal.accessRole === "reader",
          updatedAt: new Date(),
        })
        .where(eq(calendars.id, existing.id));
    } else {
      await db.insert(calendars).values({
        userId,
        provider: "google",
        externalId: gcal.id,
        name: gcal.summary,
        description: gcal.description,
        color: gcal.backgroundColor ?? "#3B82F6",
        isPrimary: gcal.primary ?? false,
        isReadOnly: gcal.accessRole === "reader",
      });
    }
  }
}

async function syncCalendarEvents(
  db: Database,
  calendarDbId: string,
  googleCalendarId: string,
  accessToken: string,
  syncToken?: string
): Promise<void> {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(googleCalendarId)}/events`
  );

  if (syncToken) {
    url.searchParams.set("syncToken", syncToken);
  } else {
    // Initial sync: get events from 3 months ago to 1 year ahead
    const timeMin = new Date();
    timeMin.setMonth(timeMin.getMonth() - 3);
    const timeMax = new Date();
    timeMax.setFullYear(timeMax.getFullYear() + 1);

    url.searchParams.set("timeMin", timeMin.toISOString());
    url.searchParams.set("timeMax", timeMax.toISOString());
    url.searchParams.set("singleEvents", "false"); // Get recurring event masters
  }

  url.searchParams.set("maxResults", "2500");

  let pageToken: string | undefined;
  let newSyncToken: string | undefined;

  do {
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      if (response.status === 410) {
        // Sync token expired, do full sync
        await syncCalendarEvents(db, calendarDbId, googleCalendarId, accessToken);
        return;
      }
      throw new Error(`Failed to fetch events: ${response.status}`);
    }

    const data = (await response.json()) as GoogleEventsResponse;

    for (const gevent of data.items ?? []) {
      await upsertEvent(db, calendarDbId, gevent);
    }

    pageToken = data.nextPageToken;
    newSyncToken = data.nextSyncToken;
  } while (pageToken);

  // Save new sync token
  if (newSyncToken) {
    await db
      .update(calendars)
      .set({
        syncToken: newSyncToken,
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(calendars.id, calendarDbId));
  }
}

async function upsertEvent(
  db: Database,
  calendarId: string,
  gevent: GoogleEvent
): Promise<void> {
  // Handle cancelled events
  if (gevent.status === "cancelled") {
    await db
      .delete(events)
      .where(
        and(
          eq(events.calendarId, calendarId),
          eq(events.externalId, gevent.id)
        )
      );
    return;
  }

  // For all-day events, use parseLocalDate to avoid UTC timezone issues
  const startTime = gevent.start.dateTime
    ? new Date(gevent.start.dateTime)
    : parseLocalDate(gevent.start.date!);

  const endTime = gevent.end.dateTime
    ? new Date(gevent.end.dateTime)
    : parseLocalDate(gevent.end.date!);

  const isAllDay = !gevent.start.dateTime;

  // Parse recurrence rule
  let recurrenceRule: string | null = null;
  if (gevent.recurrence?.length) {
    const rrule = gevent.recurrence.find((r) => r.startsWith("RRULE:"));
    recurrenceRule = rrule?.replace("RRULE:", "") ?? null;
  }

  // Parse attendees
  const attendees =
    gevent.attendees?.map((a) => ({
      email: a.email,
      name: a.displayName,
      responseStatus: a.responseStatus as
        | "needsAction"
        | "accepted"
        | "declined"
        | "tentative"
        | undefined,
      organizer: a.organizer,
    })) ?? [];

  // Parse reminders
  const reminders =
    gevent.reminders?.overrides?.map((r) => ({
      method: r.method as "email" | "popup",
      minutes: r.minutes,
    })) ?? [];

  const eventData = {
    calendarId,
    externalId: gevent.id,
    title: gevent.summary ?? "(No title)",
    description: gevent.description ?? null,
    location: gevent.location ?? null,
    startTime,
    endTime,
    isAllDay,
    status: gevent.status as "confirmed" | "tentative" | "cancelled",
    recurrenceRule,
    recurringEventId: gevent.recurringEventId ?? null,
    originalStartTime: gevent.originalStartTime?.dateTime
      ? new Date(gevent.originalStartTime.dateTime)
      : gevent.originalStartTime?.date
        ? parseLocalDate(gevent.originalStartTime.date)
        : null,
    attendees,
    reminders,
    etag: gevent.etag ?? null,
    updatedAt: new Date(),
  };

  const [existing] = await db
    .select()
    .from(events)
    .where(
      and(eq(events.calendarId, calendarId), eq(events.externalId, gevent.id))
    )
    .limit(1);

  if (existing) {
    await db.update(events).set(eventData).where(eq(events.id, existing.id));
  } else {
    await db.insert(events).values(eventData);
  }
}
