import { createHmac, timingSafeEqual } from "node:crypto";

export type ChatLinkProvider = "telegram" | "whatsapp";

/**
 * The code a chat must send (`/start <code>`) to link itself to a user's
 * Telegram bot or WhatsApp number. Derived from the server's secret key, so
 * it's stable and unguessable without being stored.
 */
export function chatLinkCode(provider: ChatLinkProvider, userId: string): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY not set");
  return createHmac("sha256", key).update(`chat-link:${provider}:${userId}`).digest("base64url").slice(0, 16);
}

export function isValidChatLinkCode(provider: ChatLinkProvider, userId: string, candidate: string | undefined): boolean {
  if (!candidate) return false;
  const given = Buffer.from(candidate.trim());
  const expected = Buffer.from(chatLinkCode(provider, userId));
  return given.length === expected.length && timingSafeEqual(given, expected);
}
