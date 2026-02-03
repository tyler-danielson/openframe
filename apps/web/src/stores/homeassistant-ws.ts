import { create } from "zustand";
import { api } from "../services/api";

interface HAEntityState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

interface HAWebSocketState {
  // Connection state
  connected: boolean;
  connecting: boolean;
  error: string | null;

  // Entity states (real-time)
  entityStates: Map<string, HAEntityState>;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  getEntityState: (entityId: string) => HAEntityState | undefined;
  callService: (domain: string, service: string, data?: Record<string, unknown>) => Promise<void>;

  // Internal
  _ws: WebSocket | null;
  _messageId: number;
  _pendingPromises: Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>;
  _subscriptionId: number | null;
}

export const useHAWebSocket = create<HAWebSocketState>((set, get) => ({
  connected: false,
  connecting: false,
  error: null,
  entityStates: new Map(),
  _ws: null,
  _messageId: 1,
  _pendingPromises: new Map(),
  _subscriptionId: null,

  connect: async () => {
    const state = get();
    if (state.connected || state.connecting) return;

    set({ connecting: true, error: null });

    try {
      // Get HA WebSocket config (includes access token)
      const config = await api.getHomeAssistantWebSocketConfig();
      if (!config?.url || !config?.accessToken) {
        set({ connecting: false, error: "Home Assistant not configured" });
        return;
      }

      // Convert HTTP URL to WebSocket URL
      const wsUrl = config.url
        .replace(/^http:/, "ws:")
        .replace(/^https:/, "wss:")
        .replace(/\/$/, "") + "/api/websocket";

      console.log("Connecting to HA WebSocket:", wsUrl);

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("HA WebSocket connected");
      };

      ws.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        const state = get();

        switch (message.type) {
          case "auth_required":
            // Send authentication
            ws.send(JSON.stringify({
              type: "auth",
              access_token: config.accessToken,
            }));
            break;

          case "auth_ok":
            console.log("HA WebSocket authenticated");
            set({ connected: true, connecting: false, _ws: ws });

            // Subscribe to all state changes
            const subscribeId = state._messageId;
            set({ _messageId: subscribeId + 1 });

            ws.send(JSON.stringify({
              id: subscribeId,
              type: "subscribe_events",
              event_type: "state_changed",
            }));

            // Also fetch all current states
            const fetchId = get()._messageId;
            set({ _messageId: fetchId + 1 });

            ws.send(JSON.stringify({
              id: fetchId,
              type: "get_states",
            }));
            break;

          case "auth_invalid":
            console.error("HA WebSocket auth failed:", message.message);
            set({ connected: false, connecting: false, error: "Authentication failed" });
            ws.close();
            break;

          case "result":
            // Handle responses to our requests
            if (message.success && Array.isArray(message.result)) {
              // This is likely the get_states response
              const entityStates = new Map<string, HAEntityState>();
              for (const entity of message.result) {
                entityStates.set(entity.entity_id, entity);
              }
              set({ entityStates });
              console.log(`HA WebSocket: Loaded ${entityStates.size} entity states`);
            }

            // Resolve pending promise if any
            const pending = state._pendingPromises.get(message.id);
            if (pending) {
              if (message.success) {
                pending.resolve(message.result);
              } else {
                pending.reject(new Error(message.error?.message || "Unknown error"));
              }
              state._pendingPromises.delete(message.id);
            }
            break;

          case "event":
            // Handle state change events
            if (message.event?.event_type === "state_changed") {
              const newState = message.event.data.new_state;
              if (newState) {
                const entityStates = new Map(get().entityStates);
                entityStates.set(newState.entity_id, newState);
                set({ entityStates });
                console.log(`HA WebSocket: ${newState.entity_id} -> ${newState.state}`);
              }
            }
            break;
        }
      };

      ws.onerror = (error) => {
        console.error("HA WebSocket error:", error);
        set({ error: "WebSocket connection error" });
      };

      ws.onclose = () => {
        console.log("HA WebSocket closed");
        set({ connected: false, connecting: false, _ws: null, _subscriptionId: null });

        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          const state = get();
          if (!state.connected && !state.connecting) {
            console.log("HA WebSocket: Attempting to reconnect...");
            get().connect();
          }
        }, 5000);
      };

    } catch (error) {
      console.error("Failed to connect to HA WebSocket:", error);
      set({ connecting: false, error: String(error) });
    }
  },

  disconnect: () => {
    const { _ws } = get();
    if (_ws) {
      _ws.close();
      set({ connected: false, _ws: null, _subscriptionId: null });
    }
  },

  getEntityState: (entityId: string) => {
    return get().entityStates.get(entityId);
  },

  callService: async (domain: string, service: string, data?: Record<string, unknown>) => {
    const { _ws, _messageId, _pendingPromises } = get();
    if (!_ws) {
      throw new Error("Not connected to Home Assistant");
    }

    const id = _messageId;
    set({ _messageId: id + 1 });

    return new Promise<void>((resolve, reject) => {
      _pendingPromises.set(id, {
        resolve: () => resolve(),
        reject
      });

      _ws.send(JSON.stringify({
        id,
        type: "call_service",
        domain,
        service,
        service_data: data,
      }));

      // Timeout after 10 seconds
      setTimeout(() => {
        if (_pendingPromises.has(id)) {
          _pendingPromises.delete(id);
          reject(new Error("Service call timeout"));
        }
      }, 10000);
    });
  },
}));

// Helper hook to get location entities in real-time
export function useHALocations() {
  const entityStates = useHAWebSocket((state) => state.entityStates);
  const connected = useHAWebSocket((state) => state.connected);

  const locations = Array.from(entityStates.values())
    .filter((entity) => {
      const domain = entity.entity_id.split(".")[0];
      return (domain === "person" || domain === "device_tracker") &&
        entity.attributes.latitude !== undefined &&
        entity.attributes.longitude !== undefined;
    })
    .map((entity) => ({
      entityId: entity.entity_id,
      name: (entity.attributes.friendly_name as string) || entity.entity_id,
      state: entity.state,
      latitude: entity.attributes.latitude as number,
      longitude: entity.attributes.longitude as number,
      gpsAccuracy: entity.attributes.gps_accuracy as number | undefined,
      batteryLevel: entity.attributes.battery_level as number | undefined,
      entityPictureUrl: entity.attributes.entity_picture as string | undefined,
      lastUpdated: entity.last_updated,
    }));

  return { locations, connected };
}

// Helper hook to get zone entities
export function useHAZones() {
  const entityStates = useHAWebSocket((state) => state.entityStates);

  const zones = Array.from(entityStates.values())
    .filter((entity) => entity.entity_id.startsWith("zone."))
    .map((entity) => ({
      entityId: entity.entity_id,
      name: (entity.attributes.friendly_name as string) || entity.entity_id,
      latitude: entity.attributes.latitude as number,
      longitude: entity.attributes.longitude as number,
      radius: entity.attributes.radius as number,
      icon: entity.attributes.icon as string | undefined,
    }));

  return zones;
}
