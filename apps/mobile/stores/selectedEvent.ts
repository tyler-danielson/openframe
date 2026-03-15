import { create } from "zustand";
import type { CalendarEvent } from "@openframe/shared";

interface SelectedEventState {
  event: CalendarEvent | null;
  setEvent: (event: CalendarEvent) => void;
  clear: () => void;
}

export const useSelectedEventStore = create<SelectedEventState>((set) => ({
  event: null,
  setEvent: (event) => set({ event }),
  clear: () => set({ event: null }),
}));
