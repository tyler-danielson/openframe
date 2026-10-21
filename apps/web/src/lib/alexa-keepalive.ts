/**
 * Keeps an OpenFrame kiosk on screen when launched by the Alexa skill
 * ("Alexa, open web frame") on an Echo Show. The skill loads the kiosk with
 * ?alexa=1. Alexa closes an HTML skill after timeoutInSeconds (max 300) idle,
 * so we ping the skill every 60s; it acks silently and the session stays open
 * until "Alexa, stop". Outside Alexa nothing loads.
 */
const FLAG_KEY = "openframe.alexa";
const ALEXA_SCRIPT = "https://cdn.html.games.alexa.a2z.com/alexa-html/latest/alexa-html.js";
const HEARTBEAT_MS = 60_000;

interface AlexaClient {
  skill: {
    sendMessage(message: unknown, callback?: (result: unknown) => void): void;
    onMessage(callback: (message: any) => void): void;
  };
}
declare global {
  interface Window {
    Alexa?: { create(options: { version: string }): Promise<{ alexa: AlexaClient; message: unknown }> };
  }
}

function launchedByAlexa(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get("alexa") === "1") {
      sessionStorage.setItem(FLAG_KEY, "1"); // kiosk redirects drop the query string
      return true;
    }
    return sessionStorage.getItem(FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

export async function startAlexaKeepAlive(): Promise<void> {
  if (!launchedByAlexa()) return;
  try {
    await loadScript(ALEXA_SCRIPT);
    if (!window.Alexa) return;
    const { alexa } = await window.Alexa.create({ version: "1.1" });
    document.documentElement.classList.add("on-alexa");
    alexa.skill.onMessage((msg) => {
      if (msg?.type === "reload") window.location.reload();
    });
    const ping = () => alexa.skill.sendMessage({ type: "heartbeat" });
    ping();
    setInterval(ping, HEARTBEAT_MS);
  } catch (err) {
    console.warn("[alexa] keep-alive unavailable:", err);
  }
}
