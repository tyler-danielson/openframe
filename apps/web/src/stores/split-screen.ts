import { create } from "zustand";

export interface SplitScreenConfig {
  position: "left" | "right"; // where the secondary panel goes
  ratio: "half" | "third"; // secondary gets 50% or 33%
  sourceType: "dashboard" | "url" | "text" | "widget";
  // Source-specific fields
  dashboardPath?: string;
  url?: string;
  text?: string;
  widgetType?: string;
  widgetConfig?: Record<string, unknown>;
}

interface SplitScreenState {
  isActive: boolean;
  config: SplitScreenConfig | null;
  activate: (config: SplitScreenConfig) => void;
  deactivate: () => void;
}

export const useSplitScreenStore = create<SplitScreenState>((set) => ({
  isActive: false,
  config: null,
  activate: (config) => set({ isActive: true, config }),
  deactivate: () => set({ isActive: false, config: null }),
}));
