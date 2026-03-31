import { create } from "zustand";

interface CastWebpageState {
  url: string | null;
  display: (url: string) => void;
  dismiss: () => void;
}

export const useCastWebpageStore = create<CastWebpageState>((set) => ({
  url: null,
  display: (url) => set({ url }),
  dismiss: () => set({ url: null }),
}));
