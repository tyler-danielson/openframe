/**
 * Calendar sync orchestration: one entry point per use case (manual calendar
 * sync, "sync all", the background scheduler) on top of the provider modules.
 *
 * - Syncs of the same account/calendar never overlap: they are serialized in
 *   process, so the scheduler and a manual "sync now" can't race each other
 *   into duplicate events.
 * - Every attempt records its outcome on the calendar (`lastSyncError`), which
 *   the UI shows, instead of failing silently in the server log.
 * - Failing calendars back off exponentially instead of being retried every
 *   minute.
 */
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { calendars, homeAssistantConfig, oauthTokens } from "@openframe/database/schema";
import type { Database } from "@openframe/database";
import { getScopesForFeature, hasRequiredScopes } from "../../utils/oauth-scopes.js";
import { CalendarSyncError, describeSyncError } from "./errors.js";
import { syncGoogleAccount, type CalendarOutcome } from "./google.js";
import { syncHomeAssistantEvents } from "./home-assistant.js";
import { syncIcsCalendar } from "./ics.js";
import { syncMicrosoftAccount } from "./microsoft.js";
import { getCalendarOAuthToken, type OAuthToken } from "./oauth.js";

export type { CalendarOutcome } from "./google.js";

type CalendarRecord = typeof calendars.$inferSelect;

interface Logger {
  info: (msg: string) => void;
  error: (obj: unknown, msg?: string) => void;
}

// Default sync intervals (used when calendar.syncInterval is null)
export const DEFAULT_SYNC_MINUTES = {
  oauth: 2, // Google/Microsoft use cheap incremental syncs
  ics: 15,
  homeassistant: 15,
} as const;
const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000;

const locks = new Map<string, Promise<void>>();

/** Run `fn` after any in-flight run with the same key has finished. */
function exclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  const run = previous.then(fn);
  const settled = run.then(
    () => undefined,
    () => undefined
  );
  locks.set(key, settled);
  void settled.then(() => {
    if (locks.get(key) === settled) locks.delete(key);
  });
  return run;
}

// Consecutive failures per calendar, for backoff (reset on success/restart)
const failureCounts = new Map<string, number>();

async function recordOutcomes(db: Database, outcomes: CalendarOutcome[]): Promise<void> {
  const now = new Date();
  for (const outcome of outcomes) {
    if (outcome.error) {
      failureCounts.set(outcome.calendarId, (failureCounts.get(outcome.calendarId) ?? 0) + 1);
      await db
        .update(calendars)
        .set({ lastSyncError: outcome.error.slice(0, 500), lastSyncErrorAt: now })
        .where(eq(calendars.id, outcome.calendarId));
    } else {
      failureCounts.delete(outcome.calendarId);
      await db
        .update(calendars)
        .set({ lastSyncError: null, lastSyncErrorAt: null })
        .where(eq(calendars.id, outcome.calendarId));
    }
  }
}

function isOAuthProvider(provider: string): provider is "google" | "microsoft" {
  return provider === "google" || provider === "microsoft";
}

/**
 * Sync a Google/Microsoft account (all of its enabled calendars, or just
 * `calendarId`) and record each calendar's outcome.
 */
export function syncOAuthAccount(
  db: Database,
  token: OAuthToken,
  options: { calendarId?: string; calendarIds?: string[]; fullSync?: boolean } = {}
): Promise<CalendarOutcome[]> {
  const provider = token.provider;
  if (!isOAuthProvider(provider)) return Promise.resolve([]);

  return exclusive(`oauth:${token.id}`, async () => {
    let outcomes: CalendarOutcome[];
    try {
      outcomes =
        provider === "google"
          ? await syncGoogleAccount(db, token, options)
          : await syncMicrosoftAccount(db, token, options);
    } catch (err) {
      // Account-level failure (e.g. revoked access): every calendar is affected
      const error = describeSyncError(err);
      const affected = await db
        .select({ id: calendars.id })
        .from(calendars)
        .where(
          and(
            eq(calendars.userId, token.userId),
            eq(calendars.provider, provider),
            or(eq(calendars.oauthTokenId, token.id), isNull(calendars.oauthTokenId)),
            options.calendarId
              ? eq(calendars.id, options.calendarId)
              : and(
                  eq(calendars.syncEnabled, true),
                  options.calendarIds ? inArray(calendars.id, options.calendarIds) : undefined
                )
          )
        );
      outcomes = affected.map((c) => ({ calendarId: c.id, error }));
    }
    await recordOutcomes(db, outcomes);
    return outcomes;
  });
}

async function syncStandaloneCalendar(
  db: Database,
  calendar: CalendarRecord,
  { fullSync = false }: { fullSync?: boolean }
): Promise<CalendarOutcome> {
  return exclusive(`calendar:${calendar.id}`, async () => {
    let outcome: CalendarOutcome;
    try {
      if (calendar.provider === "ics") {
        await syncIcsCalendar(db, calendar, { force: fullSync });
      } else if (calendar.provider === "homeassistant") {
        const [config] = await db
          .select()
          .from(homeAssistantConfig)
          .where(eq(homeAssistantConfig.userId, calendar.userId))
          .limit(1);
        if (!config) throw new CalendarSyncError("Home Assistant isn't configured");
        await syncHomeAssistantEvents(db, {
          calendarId: calendar.id,
          entityId: calendar.externalId,
          haUrl: config.url,
          haToken: config.accessToken,
        });
      } else {
        throw new CalendarSyncError("This calendar type doesn't sync");
      }
      outcome = { calendarId: calendar.id, error: null };
    } catch (err) {
      outcome = { calendarId: calendar.id, error: describeSyncError(err) };
    }
    await recordOutcomes(db, [outcome]);
    return outcome;
  });
}

export class MissingCalendarScopeError extends CalendarSyncError {
  constructor(readonly provider: "google" | "microsoft") {
    super("Calendar access not yet authorized. Please grant calendar permissions.", 403);
    this.name = "MissingCalendarScopeError";
  }
}

/**
 * Sync one calendar now (the "sync" button). Throws for calendars that can't
 * sync (no account, missing scope); provider failures come back as the
 * outcome's `error`.
 */
export async function syncCalendarNow(
  db: Database,
  calendar: CalendarRecord,
  options: { fullSync?: boolean } = {}
): Promise<CalendarOutcome> {
  if (isOAuthProvider(calendar.provider)) {
    const token = await getCalendarOAuthToken(db, calendar);
    if (!token) throw new CalendarSyncError(`No connected ${calendar.provider} account for this calendar`, 400);
    if (!hasRequiredScopes(token.scope, getScopesForFeature(calendar.provider, "calendar"))) {
      throw new MissingCalendarScopeError(calendar.provider);
    }
    const outcomes = await syncOAuthAccount(db, token, { calendarId: calendar.id, fullSync: options.fullSync });
    return (
      outcomes.find((o) => o.calendarId === calendar.id) ?? {
        calendarId: calendar.id,
        error: "This calendar isn't linked to the connected account",
      }
    );
  }
  if (calendar.provider === "ics" || calendar.provider === "homeassistant") {
    return syncStandaloneCalendar(db, calendar, options);
  }
  throw new CalendarSyncError("This calendar type doesn't sync", 400);
}

/** Sync every account and feed of a user ("sync all"). */
export async function syncAllForUser(db: Database, userId: string): Promise<CalendarOutcome[]> {
  const outcomes: CalendarOutcome[] = [];
  const tokens = await db.select().from(oauthTokens).where(eq(oauthTokens.userId, userId));
  for (const token of tokens) {
    if (!isOAuthProvider(token.provider)) continue;
    if (!hasRequiredScopes(token.scope, getScopesForFeature(token.provider, "calendar"))) continue;
    outcomes.push(...(await syncOAuthAccount(db, token)));
  }
  const feeds = await db
    .select()
    .from(calendars)
    .where(
      and(
        eq(calendars.userId, userId),
        eq(calendars.syncEnabled, true),
        inArray(calendars.provider, ["ics", "homeassistant"])
      )
    );
  for (const calendar of feeds) {
    outcomes.push(await syncStandaloneCalendar(db, calendar, {}));
  }
  return outcomes;
}

type SchedulableCalendar = Pick<
  CalendarRecord,
  "id" | "provider" | "syncInterval" | "lastSyncAt" | "lastSyncError" | "lastSyncErrorAt"
>;

/**
 * Whether a calendar should sync now: its interval has passed since the last
 * success — or, while failing, an exponentially growing backoff has passed
 * since the last failure. Exported for tests.
 */
export function isCalendarDue(calendar: SchedulableCalendar, now = Date.now(), failures = failureCounts.get(calendar.id)): boolean {
  const defaultMinutes =
    calendar.provider === "ics"
      ? DEFAULT_SYNC_MINUTES.ics
      : calendar.provider === "homeassistant"
        ? DEFAULT_SYNC_MINUTES.homeassistant
        : DEFAULT_SYNC_MINUTES.oauth;
  const intervalMs = (calendar.syncInterval ?? defaultMinutes) * 60 * 1000;

  if (calendar.lastSyncError && calendar.lastSyncErrorAt) {
    const attempts = Math.max(1, failures ?? 1);
    const backoff = Math.min(intervalMs * 2 ** attempts, MAX_BACKOFF_MS);
    return now - calendar.lastSyncErrorAt.getTime() >= backoff;
  }
  if (!calendar.lastSyncAt) return true;
  return now - calendar.lastSyncAt.getTime() >= intervalMs;
}

let scheduledRunInProgress = false;

/**
 * One pass of the background scheduler: sync every account/feed that has a
 * calendar due. Overlapping passes are skipped.
 */
export async function runScheduledCalendarSync(db: Database, log: Logger): Promise<void> {
  if (scheduledRunInProgress) return;
  scheduledRunInProgress = true;
  try {
    const due = await db
      .select()
      .from(calendars)
      .where(
        and(
          eq(calendars.syncEnabled, true),
          inArray(calendars.provider, ["google", "microsoft", "ics", "homeassistant"])
        )
      );
    const dueCalendars = due.filter((calendar) => isCalendarDue(calendar));
    if (dueCalendars.length === 0) return;

    // Group due OAuth calendars by the account they sync through
    const tokens = await db.select().from(oauthTokens);
    const dueByToken = new Map<string, string[]>();
    for (const calendar of dueCalendars) {
      if (!isOAuthProvider(calendar.provider)) continue;
      const owners = calendar.oauthTokenId
        ? tokens.filter((t) => t.id === calendar.oauthTokenId)
        : tokens.filter((t) => t.userId === calendar.userId && t.provider === calendar.provider);
      for (const token of owners) {
        const list = dueByToken.get(token.id) ?? [];
        list.push(calendar.id);
        dueByToken.set(token.id, list);
      }
    }

    for (const token of tokens) {
      const calendarIds = dueByToken.get(token.id);
      if (!calendarIds || !isOAuthProvider(token.provider)) continue;
      if (!hasRequiredScopes(token.scope, getScopesForFeature(token.provider, "calendar"))) continue;
      try {
        const outcomes = await syncOAuthAccount(db, token, { calendarIds });
        const failed = outcomes.filter((o) => o.error);
        if (failed.length > 0) {
          log.error({ tokenId: token.id, failed }, `Calendar sync: ${failed.length} ${token.provider} calendar(s) failed`);
        }
      } catch (err) {
        log.error({ err, tokenId: token.id }, `Calendar sync failed for ${token.provider} account`);
      }
    }

    for (const calendar of dueCalendars) {
      if (calendar.provider !== "ics" && calendar.provider !== "homeassistant") continue;
      const outcome = await syncStandaloneCalendar(db, calendar, {});
      if (outcome.error) {
        log.error({ calendarId: calendar.id, error: outcome.error }, `Calendar sync failed for ${calendar.provider} calendar`);
      }
    }
  } finally {
    scheduledRunInProgress = false;
  }
}
