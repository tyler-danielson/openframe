import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import { useCalendarStore, filterEventsByVisibility } from "../stores/calendar";
import { startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import type { Calendar, CalendarEvent } from "@openframe/shared";

export function useCalendars() {
  const setCalendars = useCalendarStore((s) => s.setCalendars);

  return useQuery({
    queryKey: ["calendars"],
    queryFn: async () => {
      const calendars = await api.getCalendars();
      setCalendars(calendars);
      return calendars;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useEvents(selectedDate: Date) {
  const visibleCalendarIds = useCalendarStore((s) => s.visibleCalendarIds);

  // Fetch events for current month plus buffer
  const start = startOfMonth(subMonths(selectedDate, 1));
  const end = endOfMonth(addMonths(selectedDate, 1));

  const query = useQuery({
    queryKey: ["events", start.toISOString(), end.toISOString()],
    queryFn: () => api.getEvents(start, end),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Filter events by visible calendars
  const filteredEvents = query.data
    ? filterEventsByVisibility(query.data, visibleCalendarIds)
    : [];

  return {
    ...query,
    data: filteredEvents,
  };
}

export function useEvent(id: string) {
  return useQuery({
    queryKey: ["event", id],
    queryFn: () => api.getEvent(id),
    enabled: !!id,
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Parameters<typeof api.createEvent>[0]) =>
      api.createEvent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useCreateQuickEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ text, calendarId }: { text: string; calendarId?: string }) =>
      api.createQuickEvent(text, calendarId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof api.updateEvent>[1];
    }) => api.updateEvent(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["event", id] });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useSyncCalendars() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.syncAllCalendars(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendars"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useUpdateCalendar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof api.updateCalendar>[1];
    }) => api.updateCalendar(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendars"] });
    },
  });
}
