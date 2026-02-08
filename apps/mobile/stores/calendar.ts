import { create } from "zustand";
import type { Calendar, CalendarEvent } from "@openframe/shared";

interface CalendarState {
  calendars: Calendar[];
  selectedDate: Date;
  visibleCalendarIds: Set<string>;
  setCalendars: (calendars: Calendar[]) => void;
  setSelectedDate: (date: Date) => void;
  toggleCalendarVisibility: (calendarId: string) => void;
  setVisibleCalendarIds: (ids: string[]) => void;
}

export const useCalendarStore = create<CalendarState>((set) => ({
  calendars: [],
  selectedDate: new Date(),
  visibleCalendarIds: new Set<string>(),

  setCalendars: (calendars) => {
    set({
      calendars,
      // Initialize visibility with all visible calendars
      visibleCalendarIds: new Set(
        calendars.filter(c => c.isVisible).map(c => c.id)
      ),
    });
  },

  setSelectedDate: (date) => {
    set({ selectedDate: date });
  },

  toggleCalendarVisibility: (calendarId) => {
    set((state) => {
      const newVisibleIds = new Set(state.visibleCalendarIds);
      if (newVisibleIds.has(calendarId)) {
        newVisibleIds.delete(calendarId);
      } else {
        newVisibleIds.add(calendarId);
      }
      return { visibleCalendarIds: newVisibleIds };
    });
  },

  setVisibleCalendarIds: (ids) => {
    set({ visibleCalendarIds: new Set(ids) });
  },
}));

// Helper hook to get filtered events based on visible calendars
export const filterEventsByVisibility = (
  events: CalendarEvent[],
  visibleCalendarIds: Set<string>
): CalendarEvent[] => {
  return events.filter((event) => visibleCalendarIds.has(event.calendarId));
};
