import { eq, and } from "drizzle-orm";
import { calendars, events, type oauthTokens } from "@openframe/database/schema";
import type { Database } from "@openframe/database";

// --- Interfaces ---

interface MSCalendar {
  id: string;
  name: string;
  color: string;
  isDefaultCalendar: boolean;
  canEdit: boolean;
}

interface MSEvent {
  id: string;
  subject?: string;
  bodyPreview?: string;
  location?: { displayName?: string };
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isAllDay: boolean;
  isCancelled: boolean;
  seriesMasterId?: string;
  recurrence?: {
    pattern: {
      type: string;
      interval: number;
      daysOfWeek?: string[];
      dayOfMonth?: number;
      month?: number;
      index?: string;
    };
    range: {
      type: string;
      endDate?: string;
      numberOfOccurrences?: number;
    };
  };
  attendees?: Array<{
    emailAddress: { address: string; name?: string };
    status?: { response?: string };
    type?: string;
  }>;
  "@odata.etag"?: string;
}

interface MSCalendarListResponse {
  value: MSCalendar[];
}

interface MSDeltaResponse {
  value: MSEvent[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
}

type OAuthToken = typeof oauthTokens.$inferSelect;

export interface MicrosoftCalendarCredentials {
  clientId?: string;
  clientSecret?: string;
  tenantId?: string;
}

// Module-level credentials that can be set by the route layer
let _calendarCredentials: MicrosoftCalendarCredentials = {};

export function setMicrosoftCalendarCredentials(creds: MicrosoftCalendarCredentials) {
  _calendarCredentials = creds;
}

// --- Color mapping ---

const MS_COLOR_MAP: Record<string, string> = {
  auto: "#3B82F6",
  lightBlue: "#60A5FA",
  lightGreen: "#4ADE80",
  lightOrange: "#FB923C",
  lightGray: "#9CA3AF",
  lightYellow: "#FACC15",
  lightTeal: "#2DD4BF",
  lightPink: "#F472B6",
  lightBrown: "#A16207",
  lightRed: "#F87171",
  maxColor: "#3B82F6",
};

function msColorToHex(color: string): string {
  return MS_COLOR_MAP[color] ?? "#3B82F6";
}

// --- Date helpers ---

/**
 * Parse a date-only string (YYYY-MM-DD) as local midnight.
 * Needed for all-day events to avoid UTC timezone issues.
 */
function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split("-").map(Number);
  const year = parts[0] ?? 0;
  const month = (parts[1] ?? 1) - 1;
  const day = parts[2] ?? 1;
  return new Date(year, month, day, 0, 0, 0, 0);
}

/**
 * Parse MS Graph datetime. MS sends "dateTime": "2026-02-17T09:00:00.0000000"
 * with a separate "timeZone" field. For all-day events, extract just the date part.
 */
function parseMSDateTime(dt: { dateTime: string; timeZone: string }, isAllDay: boolean): Date {
  if (isAllDay) {
    // Extract date portion only
    const datePart = dt.dateTime.split("T")[0]!;
    return parseLocalDate(datePart);
  }
  // For timed events, the dateTime is already in the specified timezone
  // MS Graph sends datetime without offset - treat as UTC-like and parse directly
  // The dateTime string is like "2026-02-17T09:00:00.0000000"
  return new Date(dt.dateTime + "Z");
}

// --- Recurrence conversion ---

const MS_DAY_MAP: Record<string, string> = {
  sunday: "SU",
  monday: "MO",
  tuesday: "TU",
  wednesday: "WE",
  thursday: "TH",
  friday: "FR",
  saturday: "SA",
};

const MS_INDEX_MAP: Record<string, string> = {
  first: "1",
  second: "2",
  third: "3",
  fourth: "4",
  last: "-1",
};

function msRecurrenceToRRule(recurrence: MSEvent["recurrence"]): string | null {
  if (!recurrence) return null;

  const { pattern, range } = recurrence;
  const parts: string[] = [];

  switch (pattern.type) {
    case "daily":
      parts.push(`FREQ=DAILY;INTERVAL=${pattern.interval}`);
      break;
    case "weekly":
      parts.push(`FREQ=WEEKLY;INTERVAL=${pattern.interval}`);
      if (pattern.daysOfWeek?.length) {
        const days = pattern.daysOfWeek.map((d) => MS_DAY_MAP[d] ?? d.substring(0, 2).toUpperCase()).join(",");
        parts.push(`BYDAY=${days}`);
      }
      break;
    case "absoluteMonthly":
      parts.push(`FREQ=MONTHLY;INTERVAL=${pattern.interval}`);
      if (pattern.dayOfMonth) {
        parts.push(`BYMONTHDAY=${pattern.dayOfMonth}`);
      }
      break;
    case "relativeMonthly": {
      parts.push(`FREQ=MONTHLY;INTERVAL=${pattern.interval}`);
      const idx = pattern.index ? MS_INDEX_MAP[pattern.index] ?? "1" : "1";
      if (pattern.daysOfWeek?.length) {
        const day = MS_DAY_MAP[pattern.daysOfWeek[0]!] ?? "MO";
        parts.push(`BYDAY=${idx}${day}`);
      }
      break;
    }
    case "absoluteYearly":
      parts.push(`FREQ=YEARLY;INTERVAL=${pattern.interval}`);
      if (pattern.month) {
        parts.push(`BYMONTH=${pattern.month}`);
      }
      if (pattern.dayOfMonth) {
        parts.push(`BYMONTHDAY=${pattern.dayOfMonth}`);
      }
      break;
    default:
      return null;
  }

  // Range
  if (range.type === "endDate" && range.endDate) {
    const until = range.endDate.replace(/-/g, "");
    parts.push(`UNTIL=${until}T235959Z`);
  } else if (range.type === "numbered" && range.numberOfOccurrences) {
    parts.push(`COUNT=${range.numberOfOccurrences}`);
  }
  // "noEnd" → omit, which means infinite

  return parts.join(";");
}

// --- Token refresh ---

async function refreshMicrosoftToken(token: OAuthToken): Promise<string> {
  if (!token.refreshToken) {
    throw new Error("No refresh token available");
  }

  if (token.expiresAt && token.expiresAt > new Date()) {
    return token.accessToken;
  }

  const clientId = _calendarCredentials.clientId || process.env.MICROSOFT_CLIENT_ID!;
  const clientSecret = _calendarCredentials.clientSecret || process.env.MICROSOFT_CLIENT_SECRET!;
  const tenantId = _calendarCredentials.tenantId || process.env.MICROSOFT_TENANT_ID || "common";

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: token.refreshToken,
        grant_type: "refresh_token",
        scope: "offline_access Calendars.ReadWrite",
      }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to refresh Microsoft token");
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

// --- Main sync entry point ---

export async function syncMicrosoftCalendars(
  db: Database,
  userId: string,
  token: OAuthToken,
  syncToken?: string,
  calendarId?: string
): Promise<void> {
  const accessToken = await refreshMicrosoftToken(token);

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
            eq(calendars.provider, "microsoft")
          )
        )
    : await db
        .select()
        .from(calendars)
        .where(
          and(
            eq(calendars.userId, userId),
            eq(calendars.provider, "microsoft"),
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

// --- Calendar list sync ---

async function syncCalendarList(
  db: Database,
  userId: string,
  accessToken: string
): Promise<void> {
  const response = await fetch("https://graph.microsoft.com/v1.0/me/calendars", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Microsoft calendars");
  }

  const data = (await response.json()) as MSCalendarListResponse;

  for (const mcal of data.value) {
    const [existing] = await db
      .select()
      .from(calendars)
      .where(
        and(
          eq(calendars.userId, userId),
          eq(calendars.provider, "microsoft"),
          eq(calendars.externalId, mcal.id)
        )
      )
      .limit(1);

    if (existing) {
      await db
        .update(calendars)
        .set({
          name: mcal.name,
          color: msColorToHex(mcal.color),
          isReadOnly: !mcal.canEdit,
          updatedAt: new Date(),
        })
        .where(eq(calendars.id, existing.id));
    } else {
      await db.insert(calendars).values({
        userId,
        provider: "microsoft",
        externalId: mcal.id,
        name: mcal.name,
        color: msColorToHex(mcal.color),
        isPrimary: mcal.isDefaultCalendar,
        isReadOnly: !mcal.canEdit,
      });
    }
  }
}

// --- Event sync ---

async function syncCalendarEvents(
  db: Database,
  calendarDbId: string,
  msCalendarId: string,
  accessToken: string,
  syncToken?: string
): Promise<void> {
  let url: string;

  if (syncToken) {
    // Incremental sync: use the stored deltaLink directly
    url = syncToken;
  } else {
    // Initial sync: get events from 3 months ago to 1 year ahead
    const startDateTime = new Date();
    startDateTime.setMonth(startDateTime.getMonth() - 3);
    const endDateTime = new Date();
    endDateTime.setFullYear(endDateTime.getFullYear() + 1);

    const params = new URLSearchParams({
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString(),
    });
    url = `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(msCalendarId)}/calendarView/delta?${params.toString()}`;
  }

  let nextLink: string | undefined;
  let deltaLink: string | undefined;

  do {
    const fetchUrl = nextLink ?? url;

    const response = await fetch(fetchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      if (response.status === 410) {
        // Delta token expired, do full sync
        await syncCalendarEvents(db, calendarDbId, msCalendarId, accessToken);
        return;
      }
      throw new Error(`Failed to fetch Microsoft events: ${response.status}`);
    }

    const data = (await response.json()) as MSDeltaResponse;

    for (const mevent of data.value ?? []) {
      await upsertEvent(db, calendarDbId, mevent);
    }

    nextLink = data["@odata.nextLink"];
    deltaLink = data["@odata.deltaLink"];
  } while (nextLink);

  // Save delta link as syncToken for incremental sync
  if (deltaLink) {
    await db
      .update(calendars)
      .set({
        syncToken: deltaLink,
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(calendars.id, calendarDbId));
  }
}

// --- Upsert event ---

async function upsertEvent(
  db: Database,
  calendarId: string,
  mevent: MSEvent
): Promise<void> {
  // Handle cancelled events
  if (mevent.isCancelled) {
    await db
      .delete(events)
      .where(
        and(
          eq(events.calendarId, calendarId),
          eq(events.externalId, mevent.id)
        )
      );
    return;
  }

  const startTime = parseMSDateTime(mevent.start, mevent.isAllDay);
  const endTime = parseMSDateTime(mevent.end, mevent.isAllDay);

  // Parse recurrence rule
  const recurrenceRule = msRecurrenceToRRule(mevent.recurrence);

  // Parse attendees
  const attendees =
    mevent.attendees?.map((a) => ({
      email: a.emailAddress.address,
      name: a.emailAddress.name,
      responseStatus: a.status?.response as
        | "needsAction"
        | "accepted"
        | "declined"
        | "tentative"
        | undefined,
      organizer: a.type === "required",
    })) ?? [];

  const eventData = {
    calendarId,
    externalId: mevent.id,
    title: mevent.subject ?? "(No title)",
    description: mevent.bodyPreview ?? null,
    location: mevent.location?.displayName ?? null,
    startTime,
    endTime,
    isAllDay: mevent.isAllDay,
    status: "confirmed" as const,
    recurrenceRule,
    recurringEventId: mevent.seriesMasterId ?? null,
    attendees,
    reminders: [] as Array<{ method: "email" | "popup"; minutes: number }>,
    etag: mevent["@odata.etag"] ?? null,
    updatedAt: new Date(),
  };

  const [existing] = await db
    .select()
    .from(events)
    .where(
      and(eq(events.calendarId, calendarId), eq(events.externalId, mevent.id))
    )
    .limit(1);

  if (existing) {
    await db.update(events).set(eventData).where(eq(events.id, existing.id));
  } else {
    await db.insert(events).values(eventData);
  }
}

// --- Outgoing sync: local → Microsoft Calendar ---

type CalendarRecord = typeof calendars.$inferSelect;
type EventRecord = typeof events.$inferSelect;

function buildMSEventBody(event: EventRecord): Record<string, unknown> {
  const body: Record<string, unknown> = {
    subject: event.title,
    body: event.description ? { contentType: "text", content: event.description } : undefined,
  };

  if (event.location) {
    body.location = { displayName: event.location };
  }

  if (event.isAllDay) {
    const startDate = event.startTime.toISOString().slice(0, 10);
    const endDate = new Date(event.endTime);
    endDate.setDate(endDate.getDate() + 1);
    body.start = { dateTime: `${startDate}T00:00:00.0000000`, timeZone: "UTC" };
    body.end = { dateTime: `${endDate.toISOString().slice(0, 10)}T00:00:00.0000000`, timeZone: "UTC" };
    body.isAllDay = true;
  } else {
    body.start = { dateTime: event.startTime.toISOString().replace("Z", ""), timeZone: "UTC" };
    body.end = { dateTime: event.endTime.toISOString().replace("Z", ""), timeZone: "UTC" };
  }

  if (Array.isArray(event.attendees) && event.attendees.length > 0) {
    body.attendees = (event.attendees as Array<{ email: string; name?: string }>).map((a) => ({
      emailAddress: { address: a.email, name: a.name },
      type: "required",
    }));
  }

  return body;
}

export async function pushEventToMicrosoft(
  db: Database,
  userId: string,
  calendar: CalendarRecord,
  event: EventRecord,
  token: OAuthToken
): Promise<void> {
  try {
    const accessToken = await refreshMicrosoftToken(token);
    const body = buildMSEventBody(event);

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calendar.externalId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error(`[Microsoft Sync] Failed to push event: ${response.status} ${text}`);
      return;
    }

    const created = (await response.json()) as MSEvent;

    // Update local event with Microsoft's ID and etag
    await db
      .update(events)
      .set({
        externalId: created.id,
        etag: created["@odata.etag"] ?? null,
        updatedAt: new Date(),
      })
      .where(eq(events.id, event.id));
  } catch (err) {
    console.error("[Microsoft Sync] Error pushing event:", err);
  }
}

export async function updateEventInMicrosoft(
  db: Database,
  calendar: CalendarRecord,
  event: EventRecord,
  token: OAuthToken
): Promise<void> {
  // Never synced to Microsoft — nothing to update
  if (event.externalId.startsWith("local_")) return;

  try {
    const accessToken = await refreshMicrosoftToken(token);
    const body = buildMSEventBody(event);

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(event.externalId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error(`[Microsoft Sync] Failed to update event: ${response.status} ${text}`);
      return;
    }

    const updated = (await response.json()) as MSEvent;

    await db
      .update(events)
      .set({
        etag: updated["@odata.etag"] ?? null,
        updatedAt: new Date(),
      })
      .where(eq(events.id, event.id));
  } catch (err) {
    console.error("[Microsoft Sync] Error updating event:", err);
  }
}

export async function deleteEventFromMicrosoft(
  calendar: CalendarRecord,
  event: EventRecord,
  token: OAuthToken
): Promise<void> {
  // Never synced to Microsoft — nothing to delete
  if (event.externalId.startsWith("local_")) return;

  try {
    const accessToken = await refreshMicrosoftToken(token);

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(event.externalId)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok && response.status !== 404) {
      const text = await response.text();
      console.error(`[Microsoft Sync] Failed to delete event: ${response.status} ${text}`);
    }
  } catch (err) {
    console.error("[Microsoft Sync] Error deleting event:", err);
  }
}
