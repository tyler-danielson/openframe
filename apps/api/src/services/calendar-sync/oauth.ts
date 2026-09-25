import { and, asc, eq } from "drizzle-orm";
import { oauthTokens } from "@openframe/database/schema";
import type { calendars } from "@openframe/database/schema";
import type { Database } from "@openframe/database";
import { decryptField, encryptField } from "../../lib/encryption.js";
import { credentialValue } from "../../utils/oauth-helpers.js";
import { providerFetch } from "./http.js";
import { CalendarSyncError, ReauthRequiredError } from "./errors.js";

export type OAuthToken = typeof oauthTokens.$inferSelect;
type CalendarRecord = typeof calendars.$inferSelect;
export type OAuthCalendarProvider = "google" | "microsoft";

/** Refresh this long before expiry so a token can't lapse mid-request. */
const EXPIRY_SKEW_MS = 2 * 60 * 1000;
const CREDENTIALS_TTL_MS = 60 * 1000;

export const PROVIDER_LABEL: Record<OAuthCalendarProvider, string> = {
  google: "Google",
  microsoft: "Microsoft",
};

interface ClientCredentials {
  clientId?: string;
  clientSecret?: string;
  tenantId: string;
}

const credentialsCache = new Map<OAuthCalendarProvider, { value: ClientCredentials; expiresAt: number }>();

/**
 * OAuth app credentials, read from the same global settings the sign-in flow
 * uses (with env fallbacks). Read at refresh time — not captured at startup —
 * so credentials entered in the setup wizard or rotated in Settings take
 * effect without a restart.
 */
export async function getOAuthClientCredentials(
  db: Database,
  provider: OAuthCalendarProvider
): Promise<ClientCredentials> {
  const cached = credentialsCache.get(provider);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  // Lazy import keeps this module (and its tests) free of the route graph
  const { getCategorySettings } = await import("../../routes/settings/index.js");
  const settings = await getCategorySettings(db, provider);
  const value: ClientCredentials =
    provider === "google"
      ? {
          clientId: credentialValue(settings.client_id, process.env.GOOGLE_CLIENT_ID),
          clientSecret: credentialValue(settings.client_secret, process.env.GOOGLE_CLIENT_SECRET),
          tenantId: "common",
        }
      : {
          clientId: credentialValue(settings.client_id, process.env.MICROSOFT_CLIENT_ID),
          clientSecret: credentialValue(settings.client_secret, process.env.MICROSOFT_CLIENT_SECRET),
          tenantId: credentialValue(settings.tenant_id, process.env.MICROSOFT_TENANT_ID) ?? "common",
        };
  credentialsCache.set(provider, { value, expiresAt: Date.now() + CREDENTIALS_TTL_MS });
  return value;
}

export function clearOAuthClientCredentialsCache(): void {
  credentialsCache.clear();
}

function isFresh(token: OAuthToken): boolean {
  return !!token.expiresAt && token.expiresAt.getTime() - EXPIRY_SKEW_MS > Date.now();
}

const inflightRefreshes = new Map<string, Promise<string>>();

/**
 * A usable access token for `token`, refreshing (and persisting) it when it
 * is about to expire. Concurrent callers share one refresh per token.
 */
export async function getValidAccessToken(
  db: Database,
  token: OAuthToken,
  provider: OAuthCalendarProvider
): Promise<string> {
  if (isFresh(token)) return decryptField(token.accessToken) ?? token.accessToken;

  let pending = inflightRefreshes.get(token.id);
  if (!pending) {
    pending = refreshAccessToken(db, token.id, provider).finally(() => inflightRefreshes.delete(token.id));
    inflightRefreshes.set(token.id, pending);
  }
  return pending;
}

async function refreshAccessToken(db: Database, tokenId: string, provider: OAuthCalendarProvider): Promise<string> {
  const label = PROVIDER_LABEL[provider];

  // Re-read: another request or process may already have refreshed it
  const [current] = await db.select().from(oauthTokens).where(eq(oauthTokens.id, tokenId)).limit(1);
  if (!current) throw new ReauthRequiredError(label, "account disconnected");
  if (isFresh(current)) return decryptField(current.accessToken) ?? current.accessToken;

  const refreshToken = decryptField(current.refreshToken) ?? current.refreshToken;
  if (!refreshToken) throw new ReauthRequiredError(label, "no refresh token stored");

  const credentials = await getOAuthClientCredentials(db, provider);
  if (!credentials.clientId || !credentials.clientSecret) {
    throw new CalendarSyncError(`${label} OAuth isn't configured — add the client ID and secret in Settings`);
  }

  const body = new URLSearchParams({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  if (provider === "microsoft") {
    // Ask for everything already granted: a narrower scope here would mint an
    // access token that breaks other features sharing this account (tasks).
    body.set("scope", current.scope?.trim() || "offline_access Calendars.ReadWrite");
  }

  const url =
    provider === "google"
      ? "https://oauth2.googleapis.com/token"
      : `https://login.microsoftonline.com/${encodeURIComponent(credentials.tenantId)}/oauth2/v2.0/token`;
  const response = await providerFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    let error: string | undefined;
    let description: string | undefined;
    try {
      const payload = (await response.json()) as { error?: string; error_description?: string };
      error = payload.error;
      description = payload.error_description;
    } catch {
      // non-JSON error body
    }
    console.error(`[${label} Sync] Token refresh failed (${response.status}): ${error ?? "unknown"} ${description ?? ""}`.trim());
    if (error === "invalid_grant") throw new ReauthRequiredError(label);
    if (error === "invalid_client" || error === "unauthorized_client") {
      throw new CalendarSyncError(`${label} rejected the OAuth client credentials — check them in Settings`, response.status);
    }
    throw new CalendarSyncError(`Could not refresh ${label} access (HTTP ${response.status})`, response.status);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in?: number;
    refresh_token?: string;
  };

  const updates: Partial<OAuthToken> = {
    accessToken: encryptField(data.access_token) ?? data.access_token,
    // Without expires_in, assume the common 1h lifetime rather than "never
    // expires", which would make every later call reuse a dead token.
    expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
    updatedAt: new Date(),
  };
  // Microsoft rotates refresh tokens; Google occasionally issues a new one
  if (data.refresh_token) {
    updates.refreshToken = encryptField(data.refresh_token) ?? data.refresh_token;
  }
  await db.update(oauthTokens).set(updates).where(eq(oauthTokens.id, current.id));

  return data.access_token;
}

/**
 * The OAuth token a calendar syncs through: its own account when recorded,
 * otherwise (calendars created before multi-account support) the user's
 * oldest token for the provider.
 */
export async function getCalendarOAuthToken(
  db: Database,
  calendar: Pick<CalendarRecord, "userId" | "provider" | "oauthTokenId">
): Promise<OAuthToken | null> {
  if (calendar.provider !== "google" && calendar.provider !== "microsoft") return null;
  if (calendar.oauthTokenId) {
    const [token] = await db
      .select()
      .from(oauthTokens)
      .where(and(eq(oauthTokens.id, calendar.oauthTokenId), eq(oauthTokens.userId, calendar.userId)))
      .limit(1);
    if (token) return token;
  }
  const [fallback] = await db
    .select()
    .from(oauthTokens)
    .where(and(eq(oauthTokens.userId, calendar.userId), eq(oauthTokens.provider, calendar.provider)))
    .orderBy(asc(oauthTokens.createdAt))
    .limit(1);
  return fallback ?? null;
}
