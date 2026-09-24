/**
 * Errors raised by calendar sync. `message` is shown to users on the calendar
 * settings screen, so keep it actionable and free of tokens/PII.
 */
export class CalendarSyncError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "CalendarSyncError";
  }
}

/** The provider rejected our refresh token; the user must reconnect. */
export class ReauthRequiredError extends CalendarSyncError {
  constructor(provider: string, detail?: string) {
    super(
      `${provider} access was revoked or expired — reconnect the account in Settings${detail ? ` (${detail})` : ""}`,
      401
    );
    this.name = "ReauthRequiredError";
  }
}

/** The calendar no longer exists upstream or is no longer shared with us. */
export class CalendarNotFoundError extends CalendarSyncError {
  constructor(provider: string) {
    super(`${provider} no longer returns this calendar (it may have been deleted or unshared)`, 404);
    this.name = "CalendarNotFoundError";
  }
}

/** Stored incremental-sync state was rejected; a full sync is required. */
export class SyncStateExpiredError extends CalendarSyncError {
  constructor() {
    super("Sync token expired", 410);
    this.name = "SyncStateExpiredError";
  }
}

export function describeSyncError(err: unknown): string {
  if (err instanceof CalendarSyncError) return err.message;
  if (err instanceof Error) {
    if (err.name === "TimeoutError" || err.name === "AbortError") return "Timed out contacting the calendar provider";
    return err.message || "Calendar sync failed";
  }
  return "Calendar sync failed";
}
