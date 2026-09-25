import { fetchPublic, isBlockedDestination } from "../../lib/outbound.js";
import { CalendarSyncError } from "./errors.js";

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_RETRY_DELAY_MS = 15_000;

export interface ProviderFetchOptions {
  timeoutMs?: number;
  /** Extra attempts after the first for 429/5xx and network errors */
  retries?: number;
  /**
   * The URL came from the user (a feed, their Home Assistant), so on the
   * hosted service it may only reach public addresses
   */
  userSupplied?: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(response: Response | null, attempt: number): number {
  const header = response?.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.min(seconds * 1000, MAX_RETRY_DELAY_MS);
    const date = Date.parse(header);
    if (!Number.isNaN(date)) return Math.min(Math.max(0, date - Date.now()), MAX_RETRY_DELAY_MS);
  }
  return Math.min(1000 * 3 ** attempt, MAX_RETRY_DELAY_MS);
}

/**
 * fetch() for calendar providers: every request gets a timeout (a hung
 * provider must not stall the sync scheduler forever), and throttling or
 * transient 5xx responses are retried a bounded number of times, honoring
 * Retry-After. Other responses are returned for the caller to interpret.
 */
export async function providerFetch(
  url: string,
  init: RequestInit = {},
  { timeoutMs = 30_000, retries = 2, userSupplied = false }: ProviderFetchOptions = {}
): Promise<Response> {
  const send = userSupplied ? fetchPublic : fetch;
  for (let attempt = 0; ; attempt++) {
    let response: Response | null = null;
    try {
      response = await send(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (!RETRYABLE_STATUS.has(response.status) || attempt >= retries) return response;
      await response.body?.cancel().catch(() => undefined);
    } catch (err) {
      // A refused address stays refused, so say why instead of retrying
      if (isBlockedDestination(err)) {
        throw new CalendarSyncError(
          "This address isn't reachable from OpenFrame's servers. It must be a public address, not a local or private network one."
        );
      }
      if (attempt >= retries) throw err;
    }
    await sleep(retryDelayMs(response, attempt));
  }
}

/** Read a response body as text, refusing bodies larger than `maxBytes`. */
export async function readTextLimited(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`Response too large (${Math.round(declared / 1024 / 1024)} MB)`);
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new Error(`Response too large (over ${Math.round(maxBytes / 1024 / 1024)} MB)`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
