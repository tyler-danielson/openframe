import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AutomationNotification } from "@openframe/shared";

interface AutomationNotificationStore {
  notifications: AutomationNotification[];
  addNotification: (notification: AutomationNotification) => void;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;
  setNotifications: (notifications: AutomationNotification[]) => void;
  getActiveNotifications: () => AutomationNotification[];
}

export const useAutomationNotificationStore = create<AutomationNotificationStore>()(
  persist(
    (set, get) => ({
      notifications: [],

      addNotification: (notification: AutomationNotification) => {
        set((state) => ({
          notifications: [...state.notifications, notification],
        }));
      },

      dismissNotification: (id: string) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, dismissed: true } : n
          ),
        }));
      },

      clearNotifications: () => {
        set({ notifications: [] });
      },

      setNotifications: (notifications: AutomationNotification[]) => {
        set({ notifications });
      },

      getActiveNotifications: () => {
        return get().notifications.filter((n) => !n.dismissed);
      },
    }),
    {
      name: "automation-notifications-storage",
      partialize: (state) => ({
        notifications: state.notifications,
      }),
    }
  )
);
