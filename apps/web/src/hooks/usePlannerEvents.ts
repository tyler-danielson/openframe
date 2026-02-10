import { useQuery } from "@tanstack/react-query";
import { startOfDay, endOfDay } from "date-fns";
import { api } from "../services/api";
import type { CalendarEvent } from "@openframe/shared";

/**
 * Hook to fetch calendar events for the planner widgets.
 * Returns events for the specified calendars and date.
 */
export function usePlannerEvents(calendarIds: string[], date: Date) {
  return useQuery({
    queryKey: ["planner-events", calendarIds, date.toISOString().split("T")[0]],
    queryFn: async () => {
      const start = startOfDay(date);
      const end = endOfDay(date);
      return api.getEvents(start, end, calendarIds);
    },
    enabled: calendarIds.length > 0,
    staleTime: 60 * 1000, // Consider fresh for 1 minute
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

/**
 * Helper to get events grouped by hour for schedule display
 */
export function groupEventsByHour(events: CalendarEvent[], startHour: number, endHour: number) {
  const hourMap: Map<number, CalendarEvent[]> = new Map();

  // Initialize all hours
  for (let h = startHour; h <= endHour; h++) {
    hourMap.set(h, []);
  }

  for (const event of events) {
    const eventStart = new Date(event.startTime);
    const eventEnd = new Date(event.endTime);
    const eventStartHour = eventStart.getHours();
    const eventEndHour = eventEnd.getHours();

    // Add event to each hour it spans
    for (let h = Math.max(eventStartHour, startHour); h <= Math.min(eventEndHour, endHour); h++) {
      const existing = hourMap.get(h) || [];
      // Only add if not already present (avoid duplicates)
      if (!existing.some((e) => e.id === event.id)) {
        existing.push(event);
        hourMap.set(h, existing);
      }
    }
  }

  return hourMap;
}

/**
 * Format event time for display
 */
export function formatEventTime(event: CalendarEvent): string {
  if (event.isAllDay) {
    return "All day";
  }

  const start = new Date(event.startTime);
  const hours = start.getHours();
  const minutes = start.getMinutes();
  const ampm = hours >= 12 ? "pm" : "am";
  const displayHours = hours % 12 || 12;

  if (minutes === 0) {
    return `${displayHours}${ampm}`;
  }
  return `${displayHours}:${minutes.toString().padStart(2, "0")}${ampm}`;
}
