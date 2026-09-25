/**
 * Links and frames built from data the app doesn't control (calendar events,
 * news feeds, notes, shopping items, kiosk commands) must never run script:
 * a "javascript:" (or "data:", "vbscript:", ...) URL there would execute in
 * OpenFrame's origin, with the signed-in user's or the kiosk's credentials.
 * Parsing with the URL constructor also defeats the tricks (leading spaces,
 * tabs or newlines inside the scheme, odd casing) that simple prefix checks
 * miss.
 */

const LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);
const WEB_PROTOCOLS = new Set(["http:", "https:"]);

function parseWithProtocol(url: unknown, allowed: Set<string>): string | undefined {
  if (typeof url !== "string") return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    return allowed.has(parsed.protocol) ? parsed.href : undefined;
  } catch {
    // Not an absolute URL
    return undefined;
  }
}

/**
 * An href for a link: the URL when it's an absolute http(s), mailto or tel
 * URL, otherwise undefined (render the text without a link).
 */
export function safeHref(url: unknown): string | undefined {
  return parseWithProtocol(url, LINK_PROTOCOLS);
}

/**
 * A web page address for an iframe or a navigation: the URL when it's an
 * absolute http(s) URL, otherwise undefined.
 */
export function safeWebUrl(url: unknown): string | undefined {
  return parseWithProtocol(url, WEB_PROTOCOLS);
}
