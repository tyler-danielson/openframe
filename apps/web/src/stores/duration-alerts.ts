import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AutomationNotification } from "@openframe/shared";

export interface DurationAlert {
  entityId: string;
  entityName: string;
  domain: string;
  thresholdMinutes: number;
  stateChangedAt: string;    // When entity turned on
  triggeredAt: string;       // When threshold was exceeded
  lastNotifiedAt: string;    // Last toast shown
  snoozedUntil?: string;     // Snooze timestamp
}

interface DurationAlertStore {
  alerts: Record<string, DurationAlert>;
  automationNotifications: AutomationNotification[];
  addAlert: (alert: DurationAlert) => void;
  snoozeAlert: (entityId: string, minutes: number) => void;
  dismissAlert: (entityId: string) => void;
  clearAlert: (entityId: string) => void;
  updateLastNotified: (entityId: string) => void;
  getActiveAlerts: () => DurationAlert[];
  // Automation notification methods
  setAutomationNotifications: (notifications: AutomationNotification[]) => void;
  addAutomationNotification: (notification: AutomationNotification) => void;
  dismissAutomationNotification: (id: string) => void;
  clearAutomationNotifications: () => void;
  getActiveAutomationNotifications: () => AutomationNotification[];
}

export const useDurationAlertStore = create<DurationAlertStore>()(
  persist(
    (set, get) => ({
      alerts: {},
      automationNotifications: [],

      addAlert: (alert: DurationAlert) => {
        set((state) => ({
          alerts: {
            ...state.alerts,
            [alert.entityId]: alert,
          },
        }));
      },

      snoozeAlert: (entityId: string, minutes: number) => {
        const snoozedUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
        set((state) => {
          const existingAlert = state.alerts[entityId];
          if (!existingAlert) return state;
          return {
            alerts: {
              ...state.alerts,
              [entityId]: { ...existingAlert, snoozedUntil },
            },
          };
        });
      },

      dismissAlert: (entityId: string) => {
        // Dismiss removes from banner but keeps tracking for repeat notifications
        set((state) => {
          const alert = state.alerts[entityId];
          if (!alert) return state;
          return {
            alerts: {
              ...state.alerts,
              [entityId]: {
                ...alert,
                snoozedUntil: undefined, // Clear snooze when dismissed
              },
            },
          };
        });
      },

      clearAlert: (entityId: string) => {
        // Clear completely removes the alert (when device turns off)
        set((state) => {
          const newAlerts = { ...state.alerts };
          delete newAlerts[entityId];
          return { alerts: newAlerts };
        });
      },

      updateLastNotified: (entityId: string) => {
        set((state) => {
          const existingAlert = state.alerts[entityId];
          if (!existingAlert) return state;
          return {
            alerts: {
              ...state.alerts,
              [entityId]: { ...existingAlert, lastNotifiedAt: new Date().toISOString() },
            },
          };
        });
      },

      getActiveAlerts: () => {
        const now = new Date();
        return Object.values(get().alerts).filter((alert) => {
          // Filter out snoozed alerts
          if (alert.snoozedUntil && new Date(alert.snoozedUntil) > now) {
            return false;
          }
          return true;
        });
      },

      // Automation notification methods
      setAutomationNotifications: (notifications: AutomationNotification[]) => {
        set({ automationNotifications: notifications });
      },

      addAutomationNotification: (notification: AutomationNotification) => {
        set((state) => ({
          automationNotifications: [...state.automationNotifications, notification],
        }));
      },

      dismissAutomationNotification: (id: string) => {
        set((state) => ({
          automationNotifications: state.automationNotifications.filter((n) => n.id !== id),
        }));
      },

      clearAutomationNotifications: () => {
        set({ automationNotifications: [] });
      },

      getActiveAutomationNotifications: () => {
        return get().automationNotifications.filter((n) => !n.dismissed);
      },
    }),
    {
      name: "duration-alerts-storage",
    }
  )
);
