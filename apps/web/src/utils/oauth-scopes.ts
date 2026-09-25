// Frontend OAuth scope utilities — mirrors backend scope bundles

import { api } from "../services/api";
import { appUrl } from "../lib/cloud";

export type OAuthFeature = "base" | "calendar" | "tasks" | "photos" | "gmail";

const GOOGLE_SCOPE_BUNDLES: Record<OAuthFeature, string[]> = {
  base: ["openid", "email", "profile"],
  calendar: [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events",
  ],
  tasks: [
    "https://www.googleapis.com/auth/tasks.readonly",
    "https://www.googleapis.com/auth/tasks",
  ],
  photos: [
    "https://www.googleapis.com/auth/photospicker.mediaitems.readonly",
  ],
  gmail: [
    "https://www.googleapis.com/auth/gmail.readonly",
  ],
};

const MICROSOFT_SCOPE_BUNDLES: Record<OAuthFeature, string[]> = {
  base: ["openid", "email", "profile", "offline_access", "User.Read"],
  calendar: ["Calendars.ReadWrite"],
  tasks: ["Tasks.ReadWrite"],
  photos: [],
  gmail: [],
};

/**
 * Check if a granted scope string contains all required scopes for a feature.
 */
export function hasGrantedScope(
  grantedString: string | undefined,
  requiredScopes: string[]
): boolean {
  if (!grantedString) return requiredScopes.length === 0;
  if (requiredScopes.length === 0) return true;
  const granted = new Set(grantedString.split(/\s+/));
  return requiredScopes.every((s) => granted.has(s));
}

/**
 * Check if a user has authorized a specific feature for a provider.
 */
export function hasFeatureScope(
  grantedScopes: Record<string, string> | undefined,
  provider: "google" | "microsoft",
  feature: OAuthFeature
): boolean {
  if (!grantedScopes) return false;
  const granted = grantedScopes[provider];
  const bundles = provider === "google" ? GOOGLE_SCOPE_BUNDLES : MICROSOFT_SCOPE_BUNDLES;
  const required = bundles[feature];
  if (!required || required.length === 0) return true;
  return hasGrantedScope(granted, required);
}

/**
 * Send the browser to start connecting an account to the signed-in user.
 * The session's token never goes in the URL (URLs end up in history, logs and
 * Referer headers): the start URL carries a one-time link ticket instead,
 * which only works in this browser for 2 minutes.
 */
async function goToLinkStart(path: string, params: Record<string, string>): Promise<void> {
  let linkTicket: string;
  try {
    linkTicket = await api.getOAuthLinkTicket();
  } catch (err) {
    window.alert(`Couldn't start connecting the account: ${err instanceof Error ? err.message : "unknown error"}`);
    return;
  }
  window.location.href = `${path}?${new URLSearchParams({ linkTicket, ...params }).toString()}`;
}

/** Connect a Google or Microsoft account (or grant it more scopes) for the signed-in user. */
export function startOAuthLink(
  provider: "google" | "microsoft",
  feature: OAuthFeature,
  returnUrl: string
): Promise<void> {
  return goToLinkStart(`/api/v1/auth/oauth/${provider}`, { feature, returnUrl });
}

/** Connect a Spotify account for the signed-in user. */
export function startSpotifyLink(returnUrl: string = appUrl("/spotify")): Promise<void> {
  return goToLinkStart("/api/v1/spotify/auth", { returnUrl });
}
