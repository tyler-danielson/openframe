import { create } from "zustand";
import type { SiriusXMChannel } from "@openframe/shared";

interface SiriusXMState {
  currentChannel: SiriusXMChannel | null;
  selectedCategory: string | null;
  searchQuery: string;
  volume: number;
  isMuted: boolean;
  isPlaying: boolean;

  setCurrentChannel: (channel: SiriusXMChannel | null) => void;
  setSelectedCategory: (category: string | null) => void;
  setSearchQuery: (query: string) => void;
  setVolume: (volume: number) => void;
  setIsMuted: (isMuted: boolean) => void;
  toggleMute: () => void;
  setIsPlaying: (isPlaying: boolean) => void;
}

export const useSiriusXMStore = create<SiriusXMState>()((set) => ({
  currentChannel: null,
  selectedCategory: null,
  searchQuery: "",
  volume: 1,
  isMuted: false,
  isPlaying: false,

  setCurrentChannel: (channel) => set({ currentChannel: channel }),
  setSelectedCategory: (category) => set({ selectedCategory: category }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setVolume: (volume) => set({ volume, isMuted: volume === 0 }),
  setIsMuted: (isMuted) => set({ isMuted }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
}));
