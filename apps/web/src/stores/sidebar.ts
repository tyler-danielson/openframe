import { create } from "zustand";
import { persist, type PersistOptions } from "zustand/middleware";

export type SidebarFeature =
  | "calendar"
  | "tasks"
  | "routines"
  | "dashboard"
  | "cardview"
  | "photos"
  | "spotify"
  | "iptv"
  | "cameras"
  | "multiview"
  | "homeassistant"
  | "matter"
  | "map"
  | "kitchen"
  | "chat"
  | "screensaver";

export const SIDEBAR_FEATURES: SidebarFeature[] = [
  "calendar",
  "tasks",
  "routines",
  "dashboard",
  "cardview",
  "photos",
  "spotify",
  "iptv",
  "cameras",
  "multiview",
  "homeassistant",
  "matter",
  "map",
  "kitchen",
  "chat",
  "screensaver",
];

// New users get only these pinned by default
const DEFAULT_PINNED: SidebarFeature[] = ["calendar", "photos", "tasks"];

export interface FeatureState {
  enabled: boolean;
  pinned: boolean;
}

interface SidebarState {
  features: Record<SidebarFeature, FeatureState>;
  // Ordered list of screen IDs: built-in feature keys + custom screen UUIDs
  order: string[];
  // Custom screen enable/pin state (keyed by UUID)
  customScreens: Record<string, FeatureState>;
  toggleEnabled: (feature: SidebarFeature) => void;
  togglePinned: (feature: SidebarFeature) => void;
  setFeatureState: (feature: SidebarFeature, state: Partial<FeatureState>) => void;
  reorder: (newOrder: string[]) => void;
  addCustomScreen: (id: string) => void;
  removeCustomScreen: (id: string) => void;
  setCustomScreenState: (id: string, state: Partial<FeatureState>) => void;
  resetAll: () => void;
}

const defaultFeatures: Record<SidebarFeature, FeatureState> = Object.fromEntries(
  SIDEBAR_FEATURES.map((f) => [
    f,
    { enabled: true, pinned: DEFAULT_PINNED.includes(f) },
  ])
) as Record<SidebarFeature, FeatureState>;

const defaultOrder: string[] = [...SIDEBAR_FEATURES];

type SidebarPersisted = Pick<SidebarState, "features" | "order" | "customScreens">;

const persistConfig: PersistOptions<SidebarState, SidebarPersisted> = {
  name: "sidebar-settings",
  version: 2,
  partialize: (state) => ({
    features: state.features,
    order: state.order,
    customScreens: state.customScreens,
  }),
  migrate: (persistedState: unknown, version: number) => {
    const state = persistedState as Record<string, unknown>;

    if (version < 2) {
      // Migrating from version 0/1: existing users keep all features pinned
      // Add `order` from default SIDEBAR_FEATURES, add empty customScreens
      const existingFeatures = (state.features ?? {}) as Record<string, FeatureState>;
      // Preserve existing pin state (all pinned in v1)
      const features = { ...defaultFeatures };
      for (const key of SIDEBAR_FEATURES) {
        if (existingFeatures[key]) {
          features[key] = existingFeatures[key]!;
        }
      }
      return {
        ...state,
        features,
        order: [...SIDEBAR_FEATURES],
        customScreens: {},
      } as SidebarPersisted;
    }

    return state as SidebarPersisted;
  },
};

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      features: { ...defaultFeatures },
      order: [...defaultOrder],
      customScreens: {},
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
      setFeatureState: (feature, partial) =>
        set((state) => ({
          features: {
            ...state.features,
            [feature]: { ...state.features[feature], ...partial },
          },
        })),
      reorder: (newOrder) => set({ order: newOrder }),
      addCustomScreen: (id) =>
        set((state) => ({
          order: [...state.order, id],
          customScreens: {
            ...state.customScreens,
            [id]: { enabled: true, pinned: true },
          },
        })),
      removeCustomScreen: (id) =>
        set((state) => {
          const { [id]: _, ...rest } = state.customScreens;
          return {
            order: state.order.filter((k) => k !== id),
            customScreens: rest,
          };
        }),
      setCustomScreenState: (id, partial) =>
        set((state) => ({
          customScreens: {
            ...state.customScreens,
            [id]: { ...(state.customScreens[id] ?? { enabled: true, pinned: true }), ...partial },
          },
        })),
      resetAll: () =>
        set({
          features: { ...defaultFeatures },
          order: [...defaultOrder],
          customScreens: {},
        }),
    }),
    persistConfig
  )
);
