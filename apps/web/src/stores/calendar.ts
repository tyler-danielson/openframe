import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Calendar, CalendarEvent } from "@openframe/shared";

type CalendarView = "month" | "week" | "day" | "agenda" | "schedule";
type WeekStartDay = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 1 = Monday, etc.
type TimeFormat = "12h" | "12h-seconds" | "24h" | "24h-seconds";
type TickerSpeed = "slow" | "normal" | "fast";
type WeekMode = "current" | "rolling";
type MonthMode = "current" | "rolling";
export type WeekCellWidget = "next-week" | "camera" | "map" | "spotify" | "home-control";

interface CalendarState {
  calendars: Calendar[];
  selectedCalendarIds: string[];
  dashboardCalendarIds: string[];
  currentDate: Date;
  view: CalendarView;
  selectedEvent: CalendarEvent | null;
  weekStartsOn: WeekStartDay;
  familyName: string;
  homeAddress: string;
  timeFormat: TimeFormat;
  dayStartHour: number;
  dayEndHour: number;
  tickerSpeed: TickerSpeed;
  weekMode: WeekMode;
  monthMode: MonthMode;
  weekCellWidget: WeekCellWidget;

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
  setTickerSpeed: (speed: TickerSpeed) => void;
  setWeekMode: (mode: WeekMode) => void;
  setMonthMode: (mode: MonthMode) => void;
  setWeekCellWidget: (widget: WeekCellWidget) => void;
  navigateToday: () => void;
  navigatePrevious: () => void;
  navigateNext: () => void;
}

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set, get) => ({
      calendars: [],
      selectedCalendarIds: [],
      dashboardCalendarIds: [],
      currentDate: new Date(),
      view: "month",
      selectedEvent: null,
      weekStartsOn: 1, // Monday by default
      familyName: "Family Calendar",
      homeAddress: "",
      timeFormat: "12h" as TimeFormat,
      dayStartHour: 6, // 6 AM
      dayEndHour: 22, // 10 PM
      tickerSpeed: "normal" as TickerSpeed,
      weekMode: "current" as WeekMode,
      monthMode: "current" as MonthMode,
      weekCellWidget: "next-week" as WeekCellWidget,

  setCalendars: (calendars) => {
    const visibleIds = calendars
      .filter((c) => c.isVisible)
      .map((c) => c.id);
    const dashboardIds = calendars
      .filter((c) => c.showOnDashboard && c.syncEnabled)
      .map((c) => c.id);
    set({ calendars, selectedCalendarIds: visibleIds, dashboardCalendarIds: dashboardIds });
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
  setTickerSpeed: (speed) => set({ tickerSpeed: speed }),
  setWeekMode: (mode) => set({ weekMode: mode }),
  setMonthMode: (mode) => set({ monthMode: mode }),
  setWeekCellWidget: (widget) => set({ weekCellWidget: widget }),

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
      case "schedule":
        newDate.setDate(newDate.getDate() - 1);
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
      case "schedule":
        newDate.setDate(newDate.getDate() + 1);
        break;
    }

    set({ currentDate: newDate });
  },
    }),
    {
      name: "calendar-store",
      partialize: (state) => ({ view: state.view, weekStartsOn: state.weekStartsOn, familyName: state.familyName, homeAddress: state.homeAddress, timeFormat: state.timeFormat, dayStartHour: state.dayStartHour, dayEndHour: state.dayEndHour, tickerSpeed: state.tickerSpeed, weekMode: state.weekMode, monthMode: state.monthMode, weekCellWidget: state.weekCellWidget }),
    }
  )
);
