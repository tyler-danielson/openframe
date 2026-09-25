import type { FastifyRequest } from "fastify";

export function isPrivateIp(hostname: string): boolean {
  return /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(hostname);
}

export function getRequestOrigin(request: FastifyRequest): string {
  const forwardedHost = request.headers["x-forwarded-host"];
  const host =
    (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) ||
    request.headers.host ||
    "localhost:3000";
  const forwardedProto = request.headers["x-forwarded-proto"];
  const rawProto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  const hostname: string = host.split(":")[0]!;
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || isPrivateIp(hostname);
  // Non-local hosts always use https (reverse proxies often misreport proto)
  const protocol = isLocal ? (rawProto || "http") : "https";
  return `${protocol}://${host}`.replace(/\/+$/, "");
}

export type OAuthProvider = "google" | "microsoft";

/**
 * The first non-blank of the given settings, trimmed: a client ID or secret
 * pasted with a trailing space or newline would otherwise be rejected.
 */
export function credentialValue(...candidates: Array<string | null | undefined>): string | undefined {
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value) return value;
  }
  return undefined;
}

interface OAuthErrorDetails {
  /** HTTP status of the provider's response, when there was one */
  status?: number;
  /** OAuth error code, e.g. "invalid_client" */
  error?: string;
  /** error_description, which for Microsoft starts with "AADSTS<code>: ..." */
  description?: string;
  /** Microsoft's error_codes */
  codes?: number[];
}

const SETTINGS_CREDENTIALS = "Settings → Connections → Provider Credentials";

/** The Microsoft (AADSTS) errors people hit when setting up an app registration. */
const MICROSOFT_HINTS: Record<number, string> = {
  7000215: `The client secret is wrong. In Azure (App registrations → Certificates & secrets), copy the secret's Value, not its Secret ID, and save it in ${SETTINGS_CREDENTIALS}.`,
  7000222: `The client secret has expired. Create a new one in Azure (App registrations → Certificates & secrets) and save its Value in ${SETTINGS_CREDENTIALS}.`,
  9002327: "The redirect URI is registered as a single-page application. In Azure (App registrations → Authentication), remove it there and add it under the Web platform instead.",
  50011: "The redirect URI isn't registered for this app. In Azure (App registrations → Authentication), add it under the Web platform.",
  700016: `Azure can't find an app with this client ID. Check the client ID and tenant ID in ${SETTINGS_CREDENTIALS}.`,
  90002: `The tenant wasn't found. Use "common" as the tenant ID to allow personal Outlook.com accounts, or your directory (tenant) ID, in ${SETTINGS_CREDENTIALS}.`,
  50194: `The app only accepts accounts from its own directory. Put your directory (tenant) ID in ${SETTINGS_CREDENTIALS}, or allow other accounts under Supported account types in Azure.`,
  50020: "This account isn't allowed to use the app. In Azure (App registrations → Authentication), allow accounts in any directory and personal Microsoft accounts under Supported account types.",
  65004: "Access was declined on Microsoft's consent screen.",
  54005: "This sign-in code was already used. Try connecting again.",
  70008: "The sign-in code expired. Try connecting again.",
};

/** Sent without an AADSTS code when a personal account signs in to an app that only accepts work or school accounts. */
const MICROSOFT_CONSUMERS_HINT =
  "The app doesn't accept personal Microsoft accounts (Outlook.com, Hotmail, Live). In Azure (App registrations → Authentication), allow personal Microsoft accounts under Supported account types.";

const GOOGLE_HINTS: Record<string, string> = {
  invalid_client: `The client ID or secret is wrong. Check them in ${SETTINGS_CREDENTIALS}.`,
  unauthorized_client: 'This OAuth client can\'t use this sign-in flow. In Google Cloud Console, use a client of type "Web application".',
  redirect_uri_mismatch: "The redirect URI isn't registered. In Google Cloud Console (APIs & Services → Credentials), add it to the client's Authorized redirect URIs.",
  invalid_grant: "The sign-in code expired or was already used. Try connecting again.",
};

/** First line of a provider's error description, without Microsoft's trace and correlation ids. */
function firstLine(description: string | undefined): string | undefined {
  const line = description?.split(/\r?\n/)[0]?.replace(/\s*Trace ID:.*$/, "").trim();
  return line || undefined;
}

/**
 * What went wrong in an OAuth sign-in or account connection, in words the
 * person connecting can act on. The Settings page shows it verbatim.
 */
export function describeOAuthError(provider: OAuthProvider, details: OAuthErrorDetails): string {
  const name = provider === "microsoft" ? "Microsoft" : "Google";
  if (details.error === "access_denied") return `${name} sign-in was cancelled or access was denied.`;

  let hint: string | undefined;
  let code: string | undefined;
  if (provider === "microsoft") {
    const aadsts = details.codes?.[0] ?? Number(/AADSTS(\d+)/.exec(details.description ?? "")?.[1] ?? NaN);
    if (Number.isFinite(aadsts)) {
      code = `AADSTS${aadsts}`;
      hint = MICROSOFT_HINTS[aadsts];
    } else if (/not enabled for consumers/i.test(details.description ?? "")) {
      code = details.error ?? "unauthorized_client";
      hint = MICROSOFT_CONSUMERS_HINT;
    }
  } else if (details.error) {
    code = details.error;
    hint = GOOGLE_HINTS[details.error];
  }

  // Web builds before this change decode the message a second time, which throws on a stray '%'
  const clean = (text: string) => text.replace(/%/g, " percent");
  if (hint) return clean(`${name} rejected the connection (${code}). ${hint}`);
  const detail = firstLine(details.description) ?? details.error ?? (details.status ? `HTTP ${details.status}` : "unknown error");
  return clean(`${name} rejected the connection: ${detail}`);
}

/** describeOAuthError for a failed token request's response body. */
export function describeOAuthTokenError(provider: OAuthProvider, status: number, body: string): string {
  let parsed: { error?: unknown; error_description?: unknown; error_codes?: unknown } = {};
  try {
    parsed = JSON.parse(body) as typeof parsed;
  } catch {
    // not JSON
  }
  return describeOAuthError(provider, {
    status,
    error: typeof parsed.error === "string" ? parsed.error : undefined,
    description: typeof parsed.error_description === "string" ? parsed.error_description : undefined,
    codes: Array.isArray(parsed.error_codes)
      ? parsed.error_codes.filter((c): c is number => typeof c === "number")
      : undefined,
  });
}

/** The message when an OAuth client isn't fully set up (checked before sending anyone to the provider). */
export function oauthNotConfiguredMessage(provider: OAuthProvider, missing: string[]): string {
  const name = provider === "microsoft" ? "Microsoft" : "Google";
  return `${name} sign-in isn't fully set up: the ${missing.join(" and ")} ${missing.length > 1 ? "are" : "is"} missing. Add ${missing.length > 1 ? "them" : "it"} in ${SETTINGS_CREDENTIALS}.`;
}

/** The message when the saved client secret exists but can't be decrypted. */
export function oauthSecretUnreadableMessage(provider: OAuthProvider): string {
  const name = provider === "microsoft" ? "Microsoft" : "Google";
  return `${name} sign-in can't use the saved client secret: it was saved with a different encryption key (the server's ENCRYPTION_KEY changed, or its data folder wasn't kept across an update). Enter the secret again in ${SETTINGS_CREDENTIALS}.`;
}
