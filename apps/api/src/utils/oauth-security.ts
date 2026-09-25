import { randomBytes, timingSafeEqual } from "crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { getRequestOrigin } from "./oauth-helpers.js";

/** Cookie that ties an OAuth flow to the browser that started it. */
const BROWSER_COOKIE = "of_oauth_browser";

/**
 * A random value this browser keeps in a cookie and that's recorded with
 * every OAuth flow (sign-in, connecting an account) it starts. A callback only
 * finishes a flow in the browser that started it. Otherwise someone could
 * start "connect Google" on their own account and get another person to
 * finish it, connecting that person's Google account (calendar, mail, photos)
 * to theirs.
 */
export function oauthBrowserBinding(request: FastifyRequest, reply: FastifyReply): string {
  const existing = request.cookies?.[BROWSER_COOKIE];
  if (existing && /^[0-9a-f]{32}$/.test(existing)) return existing;

  const value = randomBytes(16).toString("hex");
  reply.setCookie(BROWSER_COOKIE, value, {
    path: "/",
    httpOnly: true,
    sameSite: "lax", // sent on the provider's redirect back, a top-level GET
    secure: getRequestOrigin(request).startsWith("https:"),
    maxAge: 60 * 60,
  });
  return value;
}

/** Whether this callback request comes from the browser that started the flow. */
export function isOAuthBrowser(request: FastifyRequest, binding: string | undefined): boolean {
  const cookie = request.cookies?.[BROWSER_COOKIE];
  if (!binding || !cookie || cookie.length !== binding.length) return false;
  return timingSafeEqual(Buffer.from(cookie), Buffer.from(binding));
}

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/**
 * Whether a sign-in may send the browser, with the new session's tokens, to
 * `target`: this server's own site, the configured web app (FRONTEND_URL, the
 * server's external URL, CORS_ORIGINS) or the OpenFrame mobile app. Anywhere
 * else would hand the session to another site.
 */
export function isAllowedSignInRedirect(
  target: string,
  requestOrigin: string,
  externalUrl?: string | null
): boolean {
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return false;
  }

  if (url.protocol === "openframe:") return true; // the mobile app
  // Expo Go, while developing the mobile app
  if ((url.protocol === "exp:" || url.protocol === "exps:") && process.env.NODE_ENV !== "production") return true;
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.username || url.password) return false;

  const trusted = [requestOrigin, process.env.FRONTEND_URL, externalUrl, ...(process.env.CORS_ORIGINS ?? "").split(",")];
  for (const candidate of trusted) {
    if (!candidate?.trim()) continue;
    try {
      if (new URL(candidate.trim()).origin === url.origin) return true;
    } catch {
      // not a URL
    }
  }

  // Local development: the web app and the API on different localhost ports
  try {
    return isLocalHost(new URL(requestOrigin).hostname) && isLocalHost(url.hostname);
  } catch {
    return false;
  }
}

/**
 * The claims of an ID token the provider's token endpoint returned. Read
 * without checking the signature: it came straight from the provider over
 * TLS, which OpenID Connect accepts instead.
 */
export function readIdTokenClaims(idToken: unknown): Record<string, unknown> | null {
  if (typeof idToken !== "string") return null;
  const payload = idToken.split(".")[1];
  if (!payload) return null;
  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return claims && typeof claims === "object" ? (claims as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Microsoft's tenant for personal accounts (Outlook.com, Hotmail, Live). */
const MICROSOFT_CONSUMER_TENANT = "9188040d-6c67-4c5b-b112-36a304b66dad";

/** Microsoft's permanent ID for the account that signed in: its object ID within its tenant. */
export function microsoftAccountSubject(claims: Record<string, unknown> | null): string | null {
  const tenant = claims?.tid;
  const objectId = claims?.oid;
  if (typeof tenant !== "string" || typeof objectId !== "string" || !tenant || !objectId) return null;
  return `${tenant}:${objectId}`;
}

/**
 * Whether Microsoft vouches for the email address of the account that signed
 * in. Personal accounts sign in with an address Microsoft verified. A work or
 * school account's address is whatever its organization's administrator set
 * (any organization can give an account anyone's address), unless Microsoft
 * says the organization owns the address's domain (the xms_edov claim).
 */
export function microsoftEmailVerified(claims: Record<string, unknown> | null): boolean {
  if (!claims) return false;
  if (claims.tid === MICROSOFT_CONSUMER_TENANT) return true;
  const domainOwnerVerified = claims.xms_edov;
  return domainOwnerVerified === true || domainOwnerVerified === 1 || domainOwnerVerified === "1" || domainOwnerVerified === "true";
}

interface LinkTicket {
  userId: string;
  browser: string;
  expiresAt: number;
}
const linkTickets = new Map<string, LinkTicket>();

/**
 * Connecting an account (Google, Microsoft, Spotify) to the signed-in user
 * starts with this ticket, issued to a request that carries the session in a
 * header, and redeemable once, shortly, by the same browser. A link can't
 * carry the session itself: whoever sent it could have someone else's browser
 * connect that person's account to the sender's.
 */
export function issueOAuthLinkTicket(request: FastifyRequest, reply: FastifyReply, userId: string): string {
  const now = Date.now();
  for (const [ticket, entry] of linkTickets) {
    if (entry.expiresAt < now) linkTickets.delete(ticket);
  }
  const ticket = randomBytes(24).toString("base64url");
  linkTickets.set(ticket, { userId, browser: oauthBrowserBinding(request, reply), expiresAt: now + 2 * 60 * 1000 });
  return ticket;
}

/** The user a link ticket was issued to, if it's valid and this is the browser it was issued to. */
export function redeemOAuthLinkTicket(request: FastifyRequest, ticket: string | undefined): string | null {
  if (!ticket) return null;
  const entry = linkTickets.get(ticket);
  if (!entry) return null;
  linkTickets.delete(ticket);
  if (entry.expiresAt < Date.now() || !isOAuthBrowser(request, entry.browser)) return null;
  return entry.userId;
}
