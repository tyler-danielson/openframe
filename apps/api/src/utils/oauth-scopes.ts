// OAuth scope bundles for incremental authorization
// Each feature maps to the scopes it requires

export type OAuthFeature = "base" | "calendar" | "tasks" | "photos" | "gmail";

export const GOOGLE_SCOPE_BUNDLES: Record<OAuthFeature, string[]> = {
  base: [
    "openid",
    "email",
    "profile",
  ],
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

export const MICROSOFT_SCOPE_BUNDLES: Record<OAuthFeature, string[]> = {
  base: [
    "openid",
    "email",
    "profile",
    "offline_access",
    "User.Read",
  ],
  calendar: [
    "Calendars.ReadWrite",
  ],
  tasks: [
    "Tasks.ReadWrite",
  ],
  photos: [],
  gmail: [],
};

/**
 * Get the scopes required for a given feature on a given provider.
 */
export function getScopesForFeature(
  provider: "google" | "microsoft",
  feature: OAuthFeature
): string[] {
  const bundles = provider === "google" ? GOOGLE_SCOPE_BUNDLES : MICROSOFT_SCOPE_BUNDLES;
  return bundles[feature] ?? [];
}

/**
 * Check if a granted scope string contains all required scopes.
 * Google returns scopes space-separated; Microsoft may return them space-separated.
 */
export function hasRequiredScopes(
  grantedScopeString: string | null | undefined,
  requiredScopes: string[]
): boolean {
  if (!grantedScopeString) return requiredScopes.length === 0;
  if (requiredScopes.length === 0) return true;

  const granted = new Set(grantedScopeString.split(/\s+/));
  return requiredScopes.every((scope) => granted.has(scope));
}
