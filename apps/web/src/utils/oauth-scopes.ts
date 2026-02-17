// Frontend OAuth scope utilities — mirrors backend scope bundles

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
 * Build an OAuth URL with feature and authentication params.
 */
export function buildOAuthUrl(
  provider: "google" | "microsoft",
  feature: OAuthFeature,
  authToken: string | null,
  returnUrl: string
): string {
  const params = new URLSearchParams();
  if (authToken) params.set("token", authToken);
  params.set("feature", feature);
  params.set("returnUrl", returnUrl);
  return `/api/v1/auth/oauth/${provider}?${params.toString()}`;
}
