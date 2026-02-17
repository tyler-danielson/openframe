import { create } from "zustand";
import { persist } from "zustand/middleware";

export type EntertainmentFeature = "sports" | "spotify" | "iptv" | "plex" | "audiobookshelf" | "news";

export const ENTERTAINMENT_FEATURES: EntertainmentFeature[] = [
  "sports",
  "spotify",
  "iptv",
  "plex",
  "audiobookshelf",
  "news",
];

interface EntertainmentState {
  enabled: Record<EntertainmentFeature, boolean>;
  toggleEnabled: (feature: EntertainmentFeature) => void;
}

const defaultEnabled: Record<EntertainmentFeature, boolean> = Object.fromEntries(
  ENTERTAINMENT_FEATURES.map((f) => [f, true])
) as Record<EntertainmentFeature, boolean>;

export const useEntertainmentStore = create<EntertainmentState>()(
  persist(
    (set) => ({
      enabled: { ...defaultEnabled },
      toggleEnabled: (feature) =>
        set((state) => ({
          enabled: {
            ...state.enabled,
            [feature]: !state.enabled[feature],
          },
        })),
    }),
    {
      name: "entertainment-settings",
    }
  )
);
