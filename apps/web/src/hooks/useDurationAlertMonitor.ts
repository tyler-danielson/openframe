import { useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useHAWebSocket } from "../stores/homeassistant-ws";
import { useDurationAlertStore } from "../stores/duration-alerts";
import { useToast } from "../components/ui/Toaster";
import { api } from "../services/api";
import type { HomeAssistantEntity, HomeAssistantEntitySettings } from "@openframe/shared";

// Active states for each domain
const DEFAULT_ACTIVE_STATES: Record<string, string[]> = {
  light: ["on"],
  switch: ["on"],
  cover: ["open", "opening"],
  lock: ["unlocked", "unlocking"],
  fan: ["on"],
  binary_sensor: ["on", "open"],
  input_boolean: ["on"],
};

// Domains that support duration alerts
const SUPPORTED_DOMAINS = Object.keys(DEFAULT_ACTIVE_STATES);

const CHECK_INTERVAL_MS = 30 * 1000; // 30 seconds
const DEFAULT_REPEAT_INTERVAL_MINUTES = 15;

export function useDurationAlertMonitor() {
  const { toast } = useToast();
  const entityStates = useHAWebSocket((state) => state.entityStates);
  const connected = useHAWebSocket((state) => state.connected);
  const { addAlert, clearAlert, updateLastNotified, alerts } = useDurationAlertStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch entities with duration alert settings
  const { data: entities = [] } = useQuery({
    queryKey: ["homeassistant", "entities"],
    queryFn: () => api.getHomeAssistantEntities(),
    enabled: connected,
    staleTime: 60 * 1000,
  });

  // Filter to entities with duration alerts enabled
  const alertEnabledEntities = entities.filter((entity: HomeAssistantEntity) => {
    const settings = entity.settings as HomeAssistantEntitySettings;
    return settings?.durationAlert?.enabled && settings.durationAlert.thresholdMinutes > 0;
  });

  const checkAlerts = useCallback(() => {
    const now = new Date();

    for (const entity of alertEnabledEntities) {
      const entityId = entity.entityId;
      const domainParts = entityId.split(".");
      const domain = domainParts[0] || "unknown";
      const settings = entity.settings as HomeAssistantEntitySettings;
      const alertConfig = settings.durationAlert!;
      const thresholdMinutes = alertConfig.thresholdMinutes;
      const repeatIntervalMinutes = alertConfig.repeatIntervalMinutes ?? DEFAULT_REPEAT_INTERVAL_MINUTES;

      // Get current state from WebSocket
      const state = entityStates.get(entityId);
      if (!state) continue;

      const activeStates = DEFAULT_ACTIVE_STATES[domain] || ["on"];
      const isActive = activeStates.includes(state.state.toLowerCase());

      if (!isActive) {
        // Device is off/closed - clear any existing alert
        if (alerts[entityId]) {
          clearAlert(entityId);
        }
        continue;
      }

      // Device is active - check if threshold exceeded
      const lastChanged = new Date(state.last_changed);
      const minutesActive = (now.getTime() - lastChanged.getTime()) / (1000 * 60);

      if (minutesActive < thresholdMinutes) {
        // Not yet exceeded threshold
        continue;
      }

      // Threshold exceeded - check if we need to create/update alert
      const existingAlert = alerts[entityId];
      const entityName = entity.displayName || (state.attributes.friendly_name as string) || entityId;

      if (!existingAlert) {
        // Create new alert
        const newAlert = {
          entityId,
          entityName,
          domain,
          thresholdMinutes,
          stateChangedAt: state.last_changed,
          triggeredAt: now.toISOString(),
          lastNotifiedAt: now.toISOString(),
        };
        addAlert(newAlert);

        // Show toast notification
        toast({
          title: `${entityName} Alert`,
          description: `Has been ${getActiveStateDescription(domain)} for ${Math.floor(minutesActive)} minutes`,
          type: "default",
        });
      } else {
        // Check if we need to re-notify based on repeat interval
        const lastNotified = new Date(existingAlert.lastNotifiedAt);
        const minutesSinceNotification = (now.getTime() - lastNotified.getTime()) / (1000 * 60);

        // Check if not snoozed and repeat interval has passed
        const isSnoozed = existingAlert.snoozedUntil && new Date(existingAlert.snoozedUntil) > now;

        if (!isSnoozed && minutesSinceNotification >= repeatIntervalMinutes) {
          updateLastNotified(entityId);

          // Show repeat toast notification
          toast({
            title: `${entityName} Still Active`,
            description: `Has been ${getActiveStateDescription(domain)} for ${Math.floor(minutesActive)} minutes`,
            type: "default",
          });
        }
      }
    }
  }, [alertEnabledEntities, entityStates, alerts, addAlert, clearAlert, updateLastNotified, toast]);

  // Set up interval for checking alerts
  useEffect(() => {
    if (!connected || alertEnabledEntities.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initial check
    checkAlerts();

    // Set up interval
    intervalRef.current = setInterval(checkAlerts, CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [connected, alertEnabledEntities.length, checkAlerts]);

  // Also check immediately when entity states change
  useEffect(() => {
    if (connected && alertEnabledEntities.length > 0) {
      checkAlerts();
    }
  }, [entityStates, connected, alertEnabledEntities.length, checkAlerts]);
}

function getActiveStateDescription(domain: string): string {
  switch (domain) {
    case "light":
    case "switch":
    case "fan":
    case "input_boolean":
      return "on";
    case "cover":
      return "open";
    case "lock":
      return "unlocked";
    case "binary_sensor":
      return "active";
    default:
      return "on";
  }
}
