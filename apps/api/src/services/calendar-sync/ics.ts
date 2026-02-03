import { eq, and } from "drizzle-orm";
import { events } from "@openframe/database/schema";
import type { Database } from "@openframe/database";

interface ICSEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  dtstart: Date;
  dtend: Date;
  isAllDay: boolean;
  rrule?: string;
  status?: string;
}

/**
 * Parse an ICS file and extract events
 */
function parseICS(icsContent: string): ICSEvent[] {
  const events: ICSEvent[] = [];
  const lines = icsContent.replace(/\r\n /g, "").replace(/\r\n\t/g, "").split(/\r?\n/);

  let currentEvent: Partial<ICSEvent> | null = null;
  let inEvent = false;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      currentEvent = {};
      continue;
    }

    if (line === "END:VEVENT") {
      inEvent = false;
      if (currentEvent?.uid && currentEvent.summary && currentEvent.dtstart && currentEvent.dtend) {
        events.push(currentEvent as ICSEvent);
      }
      currentEvent = null;
      continue;
    }

    if (!inEvent || !currentEvent) continue;

    // Parse property:value pairs
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const propertyPart = line.substring(0, colonIndex);
    const value = line.substring(colonIndex + 1);

    // Handle properties with parameters (e.g., DTSTART;VALUE=DATE:20240101)
    const [property] = propertyPart.split(";");
    const params = propertyPart.includes(";") ? propertyPart.substring(propertyPart.indexOf(";") + 1) : "";

    switch (property) {
      case "UID":
        currentEvent.uid = value;
        break;
      case "SUMMARY":
        currentEvent.summary = unescapeICS(value);
        break;
      case "DESCRIPTION":
        currentEvent.description = unescapeICS(value);
        break;
      case "LOCATION":
        currentEvent.location = unescapeICS(value);
        break;
      case "DTSTART":
        currentEvent.dtstart = parseICSDate(value, params);
        currentEvent.isAllDay = params.includes("VALUE=DATE") && !params.includes("VALUE=DATE-TIME");
        break;
      case "DTEND":
        currentEvent.dtend = parseICSDate(value, params);
        break;
      case "RRULE":
        currentEvent.rrule = value;
        break;
      case "STATUS":
        currentEvent.status = value.toLowerCase();
        break;
    }
  }

  return events;
}

/**
 * Parse an ICS date/datetime string
 */
function parseICSDate(value: string, params: string): Date {
  // All-day date format: YYYYMMDD
  if (params.includes("VALUE=DATE") && !params.includes("VALUE=DATE-TIME")) {
    const year = parseInt(value.substring(0, 4));
    const month = parseInt(value.substring(4, 6)) - 1;
    const day = parseInt(value.substring(6, 8));
    return new Date(year, month, day);
  }

  // DateTime format: YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
  const year = parseInt(value.substring(0, 4));
  const month = parseInt(value.substring(4, 6)) - 1;
  const day = parseInt(value.substring(6, 8));
  const hour = parseInt(value.substring(9, 11)) || 0;
  const minute = parseInt(value.substring(11, 13)) || 0;
  const second = parseInt(value.substring(13, 15)) || 0;

  // If UTC (ends with Z)
  if (value.endsWith("Z")) {
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }

  // Otherwise treat as local time
  return new Date(year, month, day, hour, minute, second);
}

/**
 * Unescape ICS special characters
 */
function unescapeICS(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

/**
 * Map ICS status to our event status
 */
function mapStatus(icsStatus?: string): "confirmed" | "tentative" | "cancelled" {
  switch (icsStatus) {
    case "tentative":
      return "tentative";
    case "cancelled":
      return "cancelled";
    default:
      return "confirmed";
  }
}

/**
 * Sync events from an ICS calendar feed
 */
export async function syncICSCalendar(
  db: Database,
  calendarId: string,
  sourceUrl: string
): Promise<void> {
  // Fetch the ICS file
  const response = await fetch(sourceUrl, {
    headers: {
      "User-Agent": "OpenFrame/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ICS calendar: ${response.statusText}`);
  }

  const icsContent = await response.text();
  const icsEvents = parseICS(icsContent);

  // Get existing events for this calendar
  const existingEvents = await db
    .select()
    .from(events)
    .where(eq(events.calendarId, calendarId));

  const existingByExternalId = new Map(
    existingEvents.map((e) => [e.externalId, e])
  );

  const processedIds = new Set<string>();

  // Upsert events
  for (const icsEvent of icsEvents) {
    processedIds.add(icsEvent.uid);
    const existing = existingByExternalId.get(icsEvent.uid);

    const eventData = {
      calendarId,
      externalId: icsEvent.uid,
      title: icsEvent.summary,
      description: icsEvent.description || null,
      location: icsEvent.location || null,
      startTime: icsEvent.dtstart,
      endTime: icsEvent.dtend,
      isAllDay: icsEvent.isAllDay,
      status: mapStatus(icsEvent.status),
      recurrenceRule: icsEvent.rrule || null,
      updatedAt: new Date(),
    };

    if (existing) {
      // Update existing event
      await db
        .update(events)
        .set(eventData)
        .where(eq(events.id, existing.id));
    } else {
      // Insert new event
      await db.insert(events).values(eventData);
    }
  }

  // Delete events that no longer exist in the feed
  for (const existing of existingEvents) {
    if (!processedIds.has(existing.externalId)) {
      await db.delete(events).where(eq(events.id, existing.id));
    }
  }
}
