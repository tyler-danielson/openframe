import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "../services/api";

export type ScreensaverLayout = "fullscreen" | "side-by-side" | "quad" | "scatter";
export type ScreensaverTransition = "fade" | "slide-left" | "slide-right" | "slide-up" | "slide-down" | "zoom";

interface ScreensaverState {
  // Settings
  enabled: boolean;
  idleTimeout: number; // seconds before screensaver starts
  slideInterval: number; // seconds between slides
  layout: ScreensaverLayout;
  transition: ScreensaverTransition;
  synced: boolean; // whether settings have been synced from server

  // Runtime state
  isActive: boolean;
  lastActivity: number;

  // Actions
  setEnabled: (enabled: boolean) => void;
  setIdleTimeout: (timeout: number) => void;
  setSlideInterval: (interval: number) => void;
  setLayout: (layout: ScreensaverLayout) => void;
  setTransition: (transition: ScreensaverTransition) => void;
  setActive: (active: boolean) => void;
  updateActivity: () => void;
  syncFromServer: () => Promise<void>;
  saveToServer: () => Promise<void>;
}

export const useScreensaverStore = create<ScreensaverState>()(
  persist(
    (set, get) => ({
      // Settings (persisted)
      enabled: true,
      idleTimeout: 300, // 5 minutes default
      slideInterval: 15, // 15 seconds default
      layout: "fullscreen",
      transition: "fade",
      synced: false,

      // Runtime state (not persisted)
      isActive: false,
      lastActivity: Date.now(),

      setEnabled: (enabled) => {
        set({ enabled });
        get().saveToServer();
      },
      setIdleTimeout: (idleTimeout) => {
        set({ idleTimeout });
        get().saveToServer();
      },
      setSlideInterval: (slideInterval) => {
        set({ slideInterval });
        get().saveToServer();
      },
      setLayout: (layout) => {
        set({ layout });
        get().saveToServer();
      },
      setTransition: (transition) => {
        set({ transition });
        get().saveToServer();
      },
      setActive: (isActive) => set({ isActive }),
      updateActivity: () => set({ lastActivity: Date.now(), isActive: false }),

      syncFromServer: async () => {
        try {
          const settings = await api.getScreensaverSettings();
          set({
            enabled: settings.enabled,
            idleTimeout: settings.timeout,
            slideInterval: settings.interval,
            layout: settings.layout,
            transition: settings.transition,
            synced: true,
          });
        } catch (error) {
          console.error("Failed to sync screensaver settings:", error);
        }
      },

      saveToServer: async () => {
        const state = get();
        try {
          await api.updateScreensaverSettings({
            enabled: state.enabled,
            timeout: state.idleTimeout,
            interval: state.slideInterval,
            layout: state.layout,
            transition: state.transition,
          });
        } catch (error) {
          console.error("Failed to save screensaver settings:", error);
        }
      },
    }),
    {
      name: "screensaver-store",
      partialize: (state) => ({
        enabled: state.enabled,
        idleTimeout: state.idleTimeout,
        slideInterval: state.slideInterval,
        layout: state.layout,
        transition: state.transition,
      }),
    }
  )
);
