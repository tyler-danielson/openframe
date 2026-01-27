import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Calendar, CalendarEvent } from "@openframe/shared";

type CalendarView = "month" | "week" | "day" | "agenda";
type WeekStartDay = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 1 = Monday, etc.
type TimeFormat = "12h" | "12h-seconds" | "24h" | "24h-seconds";

interface CalendarState {
  calendars: Calendar[];
  selectedCalendarIds: string[];
  currentDate: Date;
  view: CalendarView;
  selectedEvent: CalendarEvent | null;
  weekStartsOn: WeekStartDay;
  familyName: string;
  homeAddress: string;
  timeFormat: TimeFormat;
  dayStartHour: number;
  dayEndHour: number;

  setCalendars: (calendars: Calendar[]) => void;
  setCurrentDate: (date: Date) => void;
  setView: (view: CalendarView) => void;
  setSelectedEvent: (event: CalendarEvent | null) => void;
  setWeekStartsOn: (day: WeekStartDay) => void;
  setFamilyName: (name: string) => void;
  setHomeAddress: (address: string) => void;
  cycleTimeFormat: () => void;
  setDayStartHour: (hour: number) => void;
  setDayEndHour: (hour: number) => void;
  navigateToday: () => void;
  navigatePrevious: () => void;
  navigateNext: () => void;
}

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set, get) => ({
      calendars: [],
      selectedCalendarIds: [],
      currentDate: new Date(),
      view: "month",
      selectedEvent: null,
      weekStartsOn: 1, // Monday by default
      familyName: "Family Calendar",
      homeAddress: "",
      timeFormat: "12h" as TimeFormat,
      dayStartHour: 6, // 6 AM
      dayEndHour: 22, // 10 PM

  setCalendars: (calendars) => {
    const visibleIds = calendars
      .filter((c) => c.isVisible)
      .map((c) => c.id);
    set({ calendars, selectedCalendarIds: visibleIds });
  },

  setCurrentDate: (date) => set({ currentDate: date }),

  setView: (view) => set({ view }),

  setSelectedEvent: (event) => set({ selectedEvent: event }),

  setWeekStartsOn: (day) => set({ weekStartsOn: day }),

  setFamilyName: (name) => set({ familyName: name }),

  setHomeAddress: (address) => set({ homeAddress: address }),

  cycleTimeFormat: () => {
    const { timeFormat } = get();
    const formats: TimeFormat[] = ["12h", "12h-seconds", "24h", "24h-seconds"];
    const currentIndex = formats.indexOf(timeFormat);
    const nextIndex = (currentIndex + 1) % formats.length;
    set({ timeFormat: formats[nextIndex] });
  },

  setDayStartHour: (hour) => set({ dayStartHour: hour }),
  setDayEndHour: (hour) => set({ dayEndHour: hour }),

  navigateToday: () => set({ currentDate: new Date() }),

  navigatePrevious: () => {
    const { currentDate, view } = get();
    const newDate = new Date(currentDate);

    switch (view) {
      case "month":
        newDate.setMonth(newDate.getMonth() - 1);
        break;
      case "week":
        newDate.setDate(newDate.getDate() - 7);
        break;
      case "day":
        newDate.setDate(newDate.getDate() - 1);
        break;
      case "agenda":
        newDate.setDate(newDate.getDate() - 7);
        break;
    }

    set({ currentDate: newDate });
  },

  navigateNext: () => {
    const { currentDate, view } = get();
    const newDate = new Date(currentDate);

    switch (view) {
      case "month":
        newDate.setMonth(newDate.getMonth() + 1);
        break;
      case "week":
        newDate.setDate(newDate.getDate() + 7);
        break;
      case "day":
        newDate.setDate(newDate.getDate() + 1);
        break;
      case "agenda":
        newDate.setDate(newDate.getDate() + 7);
        break;
    }

    set({ currentDate: newDate });
  },
    }),
    {
      name: "calendar-store",
      partialize: (state) => ({ view: state.view, weekStartsOn: state.weekStartsOn, familyName: state.familyName, homeAddress: state.homeAddress, timeFormat: state.timeFormat, dayStartHour: state.dayStartHour, dayEndHour: state.dayEndHour }),
    }
  )
);
