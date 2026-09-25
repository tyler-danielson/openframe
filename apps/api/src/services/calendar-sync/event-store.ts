import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { events } from "@openframe/database/schema";
import type { Database } from "@openframe/database";
import { decryptEventFields, encryptEventFields } from "../../lib/encryption.js";
import { expandRecurringEvents } from "./recurrence.js";

type EventRow = typeof events.$inferSelect;
type EventInsert = typeof events.$inferInsert;

/**
 * The fields a provider sync owns. `metadata` is deliberately absent: it holds
 * per-event user settings (countdowns, etc.) that syncs must never reset.
 */
export type SyncedEvent = Omit<EventInsert, "id" | "calendarId" | "metadata" | "createdAt" | "updatedAt">;

const QUERY_CHUNK = 500;

function chunked<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function deleteRowIds(db: Database, ids: string[]): Promise<void> {
  for (const chunk of chunked(ids, QUERY_CHUNK)) {
    await db.delete(events).where(inArray(events.id, chunk));
  }
}

/** Existing rows for the given externalIds, decrypted, keyed by externalId. */
export async function getExistingEvents(
  db: Database,
  calendarId: string,
  externalIds: string[]
): Promise<Map<string, EventRow>> {
  const result = new Map<string, EventRow>();
  for (const chunk of chunked([...new Set(externalIds)], QUERY_CHUNK)) {
    const rows = await db
      .select()
      .from(events)
      .where(and(eq(events.calendarId, calendarId), inArray(events.externalId, chunk)));
    for (const row of rows) {
      const current = result.get(row.externalId);
      if (!current || row.updatedAt > current.updatedAt) result.set(row.externalId, decryptEventFields(row));
    }
  }
  return result;
}

/**
 * Insert or update events by (calendarId, externalId).
 *
 * Doesn't rely on a unique index, and collapses duplicate rows for the same
 * externalId (left behind by overlapping syncs in older versions) to the most
 * recently updated one.
 */
export async function upsertSyncedEvents(
  db: Database,
  calendarId: string,
  items: SyncedEvent[]
): Promise<{ inserted: number; updated: number }> {
  if (items.length === 0) return { inserted: 0, updated: 0 };

  // Last write wins within a batch (an event can change twice across pages)
  const byExternalId = new Map<string, SyncedEvent>();
  for (const item of items) byExternalId.set(item.externalId, item);

  const existing: Array<{ id: string; externalId: string; updatedAt: Date }> = [];
  for (const chunk of chunked([...byExternalId.keys()], QUERY_CHUNK)) {
    existing.push(
      ...(await db
        .select({ id: events.id, externalId: events.externalId, updatedAt: events.updatedAt })
        .from(events)
        .where(and(eq(events.calendarId, calendarId), inArray(events.externalId, chunk))))
    );
  }

  const rowIdByExternalId = new Map<string, string>();
  const duplicateIds: string[] = [];
  existing.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  for (const row of existing) {
    if (rowIdByExternalId.has(row.externalId)) duplicateIds.push(row.id);
    else rowIdByExternalId.set(row.externalId, row.id);
  }
  if (duplicateIds.length > 0) await deleteRowIds(db, duplicateIds);

  const now = new Date();
  const inserts: EventInsert[] = [];
  let updated = 0;
  for (const [externalId, item] of byExternalId) {
    const values = encryptEventFields({ ...item, calendarId, updatedAt: now });
    const rowId = rowIdByExternalId.get(externalId);
    if (rowId) {
      await db.update(events).set(values).where(eq(events.id, rowId));
      updated++;
    } else {
      inserts.push(values);
    }
  }
  for (const chunk of chunked(inserts, 200)) {
    await db.insert(events).values(chunk);
  }
  return { inserted: inserts.length, updated };
}

/** Delete events by externalId (and, optionally, stored instances of those series). */
export async function deleteEventsByExternalId(
  db: Database,
  calendarId: string,
  externalIds: string[],
  { includeInstances = false }: { includeInstances?: boolean } = {}
): Promise<void> {
  const unique = [...new Set(externalIds)];
  for (const chunk of chunked(unique, QUERY_CHUNK)) {
    await db.delete(events).where(and(eq(events.calendarId, calendarId), inArray(events.externalId, chunk)));
    if (includeInstances) {
      await db
        .delete(events)
        .where(and(eq(events.calendarId, calendarId), inArray(events.recurringEventId, chunk)));
    }
  }
}

/**
 * After a complete listing of a calendar, delete rows the provider no longer
 * returns.
 *
 * - `providerRowsOnly`: only consider rows that came from the provider (they
 *   carry an etag). Events created in OpenFrame that haven't been pushed yet
 *   have none and are kept.
 * - `window`: the listing only covered this range. Rows entirely outside it
 *   are history and are kept — including recurring series that ended before
 *   it; a series is only considered if it still recurs inside the window.
 */
export async function deleteEventsMissingFromListing(
  db: Database,
  calendarId: string,
  seenExternalIds: Set<string>,
  { providerRowsOnly, window }: { providerRowsOnly: boolean; window?: { start: Date; end: Date } }
): Promise<number> {
  const rows = await db
    .select()
    .from(events)
    .where(
      providerRowsOnly
        ? and(eq(events.calendarId, calendarId), isNotNull(events.etag))
        : eq(events.calendarId, calendarId)
    );

  const stale = rows.filter((row) => {
    if (seenExternalIds.has(row.externalId)) return false;
    if (!window) return true;
    if (row.recurrenceRule && !row.recurringEventId) {
      return expandRecurringEvents([row], window.start, window.end, { maxOccurrencesPerEvent: 1 }).length > 0;
    }
    return row.endTime >= window.start && row.startTime <= window.end;
  });
  await deleteRowIds(
    db,
    stale.map((row) => row.id)
  );
  return stale.length;
}
