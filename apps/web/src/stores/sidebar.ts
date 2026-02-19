import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SidebarFeature =
  | "calendar"
  | "tasks"
  | "routines"
  | "dashboard"
  | "photos"
  | "spotify"
  | "iptv"
  | "cameras"
  | "multiview"
  | "homeassistant"
  | "map"
  | "kitchen"
  | "chat"
  | "screensaver";

export const SIDEBAR_FEATURES: SidebarFeature[] = [
  "calendar",
  "tasks",
  "routines",
  "dashboard",
  "photos",
  "spotify",
  "iptv",
  "cameras",
  "multiview",
  "homeassistant",
  "map",
  "kitchen",
  "chat",
  "screensaver",
];

interface FeatureState {
  enabled: boolean;
  pinned: boolean;
}

interface SidebarState {
  features: Record<SidebarFeature, FeatureState>;
  toggleEnabled: (feature: SidebarFeature) => void;
  togglePinned: (feature: SidebarFeature) => void;
  resetAll: () => void;
}

const defaultFeatures: Record<SidebarFeature, FeatureState> = Object.fromEntries(
  SIDEBAR_FEATURES.map((f) => [f, { enabled: true, pinned: true }])
) as Record<SidebarFeature, FeatureState>;

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      features: { ...defaultFeatures },
      toggleEnabled: (feature) =>
        set((state) => ({
          features: {
            ...state.features,
            [feature]: {
              ...state.features[feature],
              enabled: !state.features[feature].enabled,
            },
          },
        })),
      togglePinned: (feature) =>
        set((state) => ({
          features: {
            ...state.features,
            [feature]: {
              ...state.features[feature],
              pinned: !state.features[feature].pinned,
            },
          },
        })),
      resetAll: () => set({ features: { ...defaultFeatures } }),
    }),
    {
      name: "sidebar-settings",
    }
  )
);
