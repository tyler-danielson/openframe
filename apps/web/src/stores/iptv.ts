import { create } from "zustand";
import type { IptvChannel, IptvCategory } from "@openframe/shared";

interface IptvState {
  currentChannel: IptvChannel | null;
  selectedCategoryId: string | null;
  searchQuery: string;
  isFullscreen: boolean;
  volume: number;
  isMuted: boolean;

  setCurrentChannel: (channel: IptvChannel | null) => void;
  setSelectedCategoryId: (categoryId: string | null) => void;
  setSearchQuery: (query: string) => void;
  setIsFullscreen: (isFullscreen: boolean) => void;
  setVolume: (volume: number) => void;
  setIsMuted: (isMuted: boolean) => void;
  toggleMute: () => void;
}

export const useIptvStore = create<IptvState>()((set, get) => ({
  currentChannel: null,
  selectedCategoryId: null,
  searchQuery: "",
  isFullscreen: false,
  volume: 1,
  isMuted: false,

  setCurrentChannel: (channel) => set({ currentChannel: channel }),
  setSelectedCategoryId: (categoryId) => set({ selectedCategoryId: categoryId }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setIsFullscreen: (isFullscreen) => set({ isFullscreen }),
  setVolume: (volume) => set({ volume, isMuted: volume === 0 }),
  setIsMuted: (isMuted) => set({ isMuted }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
}));
