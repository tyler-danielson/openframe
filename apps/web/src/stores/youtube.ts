import { create } from "zustand";

export type YouTubeSubTab = "trending" | "search" | "bookmarks" | "history";

interface YouTubeState {
  currentVideoId: string | null;
  currentVideoTitle: string | null;
  searchQuery: string;
  activeSubTab: YouTubeSubTab;
  setCurrentVideo: (videoId: string | null, title?: string | null) => void;
  setSearchQuery: (query: string) => void;
  setActiveSubTab: (tab: YouTubeSubTab) => void;
}

export const useYouTubeStore = create<YouTubeState>()((set) => ({
  currentVideoId: null,
  currentVideoTitle: null,
  searchQuery: "",
  activeSubTab: "trending",
  setCurrentVideo: (videoId, title = null) =>
    set({ currentVideoId: videoId, currentVideoTitle: title }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setActiveSubTab: (activeSubTab) => set({ activeSubTab }),
}));
