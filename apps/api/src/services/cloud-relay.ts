import WebSocket from "ws";
import { eq } from "drizzle-orm";
import { kiosks } from "@openframe/database/schema";
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
  private state: ConnectionState = "disconnected";
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 60000;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  private commandHandlers = new Map<string, (kioskId: string, commandType: string, data?: Record<string, unknown>) => void>();
  private logger: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void; warn: (...args: unknown[]) => void };

  constructor(db: Database, logger?: typeof console) {
    this.db = db;
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

      this.send({
        type: "kiosk-sync",
        payload: { kiosks: syncItems },
      });

      this.logger.info(`[cloud-relay] Synced ${syncItems.length} kiosks`);
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
