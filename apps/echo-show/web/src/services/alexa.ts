/**
 * Alexa HTML SDK wrapper.
 *
 * Provides a unified interface for communicating with the Alexa skill backend.
 * Falls back gracefully when running outside the Alexa context (e.g. Silk browser).
 */

export interface AlexaStartData {
  serverUrl?: string;
  kioskToken?: string;
  needsSetup?: boolean;
}

export type AlexaMessageHandler = (message: Record<string, unknown>) => void;

interface AlexaClient {
  sendMessage(message: unknown): void;
  onMessage(handler: (message: unknown) => void): void;
  performance?: { getInitArguments(): { data?: AlexaStartData } };
}

let alexaClient: AlexaClient | null = null;
let isAlexaMode = false;
let initPromise: Promise<boolean> | null = null;

/**
 * Initialize the Alexa HTML SDK. Call once at app startup.
 * Returns true if running in Alexa context, false if Silk/other browser.
 */
export function initAlexa(): Promise<boolean> {
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve) => {
    const win = window as unknown as {
      Alexa?: { create(opts: { version: string }): Promise<AlexaClient> };
    };

    if (!win.Alexa?.create) {
      console.log("[Alexa] SDK not available — running in Silk/browser mode");
      isAlexaMode = false;
      resolve(false);
      return;
    }

    win.Alexa.create({ version: "1.1" })
      .then((client) => {
        alexaClient = client;
        isAlexaMode = true;
        console.log("[Alexa] SDK initialized successfully");
        resolve(true);
      })
      .catch((err) => {
        console.warn("[Alexa] SDK init failed — running in browser mode:", err);
        isAlexaMode = false;
        resolve(false);
      });
  });

  return initPromise;
}

export function isRunningInAlexa(): boolean {
  return isAlexaMode;
}

export function getStartData(): AlexaStartData | null {
  if (!alexaClient?.performance) return null;
  try {
    const args = alexaClient.performance.getInitArguments();
    return (args?.data as AlexaStartData) || null;
  } catch {
    return null;
  }
}

export function sendMessage(message: Record<string, unknown>): void {
  if (!alexaClient) return;
  try {
    alexaClient.sendMessage(message);
  } catch (err) {
    console.error("[Alexa] Failed to send message:", err);
  }
}

export function onMessage(handler: AlexaMessageHandler): void {
  if (!alexaClient) return;
  alexaClient.onMessage((msg) => {
    handler(msg as Record<string, unknown>);
  });
}

export function isSilkBrowser(): boolean {
  return /\bSilk\b/i.test(navigator.userAgent);
}
