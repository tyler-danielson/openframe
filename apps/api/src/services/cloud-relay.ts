import WebSocket from "ws";
import { eq } from "drizzle-orm";
import { kiosks, calendars } from "@openframe/database/schema";
import type { Database } from "@openframe/database";

// ─── Protocol Types (mirrors openframe-cloud protocol) ──────────

interface RelayMessage<T = unknown> {
  type: string;
  id?: string;
  payload: T;
}

interface KioskSyncItem {
  id: string;
  name: string;
  isActive: boolean;
  enabledFeatures: string[];
}

interface CalendarSyncItem {
  id: string;
  name: string;
  provider: string;
  color: string | null;
}

// ─── Cloud Relay Client ─────────────────────────────────────────

interface CloudRelayConfig {
  instanceId: string;
  relaySecret: string;
  wsEndpoint: string;
  version?: string;
}

type ConnectionState = "disconnected" | "connecting" | "connected" | "authenticated";

export class CloudRelay {
  private ws: WebSocket | null = null;
  private config: CloudRelayConfig | null = null;
  private db: Database;
  private port: number;
  private state: ConnectionState = "disconnected";
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 60000;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  private commandHandlers = new Map<string, (kioskId: string, commandType: string, data?: Record<string, unknown>) => void>();
  private logger: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void; warn: (...args: unknown[]) => void };

  constructor(db: Database, logger?: typeof console, port = 3001) {
    this.db = db;
    this.port = port;
    this.logger = logger || console;
  }

  get isConnected(): boolean {
    return this.state === "authenticated";
  }

  get connectionState(): ConnectionState {
    return this.state;
  }

  configure(config: CloudRelayConfig) {
    this.config = config;
  }

  onCommand(handler: (kioskId: string, commandType: string, data?: Record<string, unknown>) => void) {
    const id = crypto.randomUUID();
    this.commandHandlers.set(id, handler);
    return () => {
      this.commandHandlers.delete(id);
    };
  }

  connect() {
    if (!this.config) {
      this.logger.warn("[cloud-relay] No configuration set, cannot connect");
      return;
    }

    if (this.state === "connecting" || this.state === "authenticated") {
      return;
    }

    this.state = "connecting";
    this.logger.info(`[cloud-relay] Connecting to ${this.config.wsEndpoint}...`);

    try {
      this.ws = new WebSocket(this.config.wsEndpoint);
    } catch (err) {
      this.logger.error("[cloud-relay] Failed to create WebSocket:", err);
      this.scheduleReconnect();
      return;
    }

    this.ws.on("open", () => {
      this.logger.info("[cloud-relay] Connected, authenticating...");
      this.state = "connected";
      this.send({
        type: "auth",
        payload: {
          instanceId: this.config!.instanceId,
          relaySecret: this.config!.relaySecret,
          version: this.config!.version,
        },
      });
    });

    this.ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString()) as RelayMessage;
        this.handleMessage(msg);
      } catch {
        this.logger.error("[cloud-relay] Failed to parse message");
      }
    });

    this.ws.on("close", (code, reason) => {
      this.logger.info(`[cloud-relay] Disconnected (${code}: ${reason})`);
      this.cleanup();
      this.scheduleReconnect();
    });

    this.ws.on("error", (err) => {
      this.logger.error("[cloud-relay] WebSocket error:", err.message);
    });
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
    }
    this.cleanup();
    this.state = "disconnected";
  }

  async syncKiosks() {
    if (!this.isConnected) return;

    try {
      const allKiosks = await this.db
        .select()
        .from(kiosks);

      const syncItems: KioskSyncItem[] = allKiosks.map((k) => ({
        id: k.id,
        name: k.name,
        isActive: k.isActive,
        enabledFeatures: k.enabledFeatures
          ? Object.entries(k.enabledFeatures)
              .filter(([, v]) => v)
              .map(([key]) => key)
          : [],
      }));

      // Also sync calendars
      const allCalendars = await this.db
        .select()
        .from(calendars);

      const calendarItems: CalendarSyncItem[] = allCalendars.map((c) => ({
        id: c.id,
        name: c.name,
        provider: c.provider,
        color: c.color,
      }));

      this.send({
        type: "kiosk-sync",
        payload: { kiosks: syncItems, calendars: calendarItems },
      });

      this.logger.info(`[cloud-relay] Synced ${syncItems.length} kiosks, ${calendarItems.length} calendars`);
    } catch (err) {
      this.logger.error("[cloud-relay] Failed to sync kiosks:", err);
    }
  }

  // ─── Private Methods ──────────────────────────────────────────

  private handleMessage(msg: RelayMessage) {
    switch (msg.type) {
      case "auth-result":
        this.handleAuthResult(msg.payload as { success: boolean; error?: string });
        break;

      case "heartbeat":
        this.handleHeartbeat();
        break;

      case "command":
        this.handleCommand(msg);
        break;

      case "http-proxy":
        this.handleHttpProxy(msg);
        break;

      case "kiosk-sync-ack":
        this.logger.info("[cloud-relay] Kiosk sync acknowledged");
        break;

      case "error":
        this.logger.error("[cloud-relay] Server error:", msg.payload);
        break;
    }
  }

  private handleAuthResult(payload: { success: boolean; error?: string }) {
    if (payload.success) {
      this.state = "authenticated";
      this.reconnectDelay = 1000; // Reset backoff on successful auth
      this.logger.info("[cloud-relay] Authenticated successfully");

      // Sync kiosks immediately after auth
      this.syncKiosks();
    } else {
      this.logger.error(`[cloud-relay] Auth failed: ${payload.error}`);
      this.ws?.close(4003, "Auth failed");
    }
  }

  private handleHeartbeat() {
    this.send({
      type: "heartbeat-ack",
      payload: { timestamp: Date.now() },
    });

    // Reset heartbeat timeout
    if (this.heartbeatTimeout) clearTimeout(this.heartbeatTimeout);
    this.heartbeatTimeout = setTimeout(() => {
      this.logger.warn("[cloud-relay] Heartbeat timeout, reconnecting...");
      this.ws?.close(4002, "Heartbeat timeout");
    }, 120000); // 2 minutes without heartbeat = timeout
  }

  private handleCommand(msg: RelayMessage) {
    const payload = msg.payload as {
      kioskId: string;
      commandType: string;
      data?: Record<string, unknown>;
    };

    this.logger.info(
      `[cloud-relay] Command received: ${payload.commandType} for kiosk ${payload.kioskId}`
    );

    // Notify all command handlers
    for (const handler of this.commandHandlers.values()) {
      try {
        handler(payload.kioskId, payload.commandType, payload.data);
      } catch (err) {
        this.logger.error("[cloud-relay] Command handler error:", err);
      }
    }

    // Send result back
    this.send({
      type: "command-result",
      id: msg.id,
      payload: {
        commandId: msg.id || "",
        success: true,
      },
    });
  }

  private async handleHttpProxy(msg: RelayMessage) {
    const payload = msg.payload as {
      method: string;
      path: string;
      headers?: Record<string, string>;
      body?: string;
      userId?: string;
    };

    this.logger.info(
      `[cloud-relay] HTTP proxy: ${payload.method} ${payload.path}${payload.userId ? ` (user: ${payload.userId})` : ""}`
    );

    try {
      const url = `http://127.0.0.1:${this.port}${payload.path}`;
      const headers: Record<string, string> = {
        ...payload.headers,
        "x-relay-secret": this.config?.relaySecret || "",
      };

      // Inject user context from cloud proxy so the API authenticates as the correct user
      if (payload.userId) {
        headers["x-relay-user-id"] = payload.userId;
      }

      if (payload.body) {
        headers["content-type"] = headers["content-type"] || "application/json";
      }

      const response = await fetch(url, {
        method: payload.method,
        headers,
        body: payload.method !== "GET" && payload.method !== "HEAD"
          ? payload.body
          : undefined,
      });

      const responseBody = await response.text();
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      this.send({
        type: "http-proxy-result",
        id: msg.id,
        payload: {
          requestId: msg.id || "",
          status: response.status,
          headers: responseHeaders,
          body: responseBody,
        },
      });
    } catch (err) {
      this.logger.error("[cloud-relay] HTTP proxy error:", err);
      this.send({
        type: "http-proxy-result",
        id: msg.id,
        payload: {
          requestId: msg.id || "",
          status: 502,
          body: JSON.stringify({ error: "Failed to reach local API" }),
        },
      });
    }
  }

  private send(msg: RelayMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private cleanup() {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
    this.ws = null;
    if (this.state !== "disconnected") {
      this.state = "disconnected";
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;

    this.logger.info(
      `[cloud-relay] Reconnecting in ${this.reconnectDelay / 1000}s...`
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 2,
        this.maxReconnectDelay
      );
      this.connect();
    }, this.reconnectDelay);
  }
}
