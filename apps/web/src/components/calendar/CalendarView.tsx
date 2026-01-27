import { useMemo, useCallback } from "react";
import { Calendar, dateFnsLocalizer, type Event } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import { useCalendarStore } from "../../stores/calendar";
import { WeekGridView } from "./WeekGridView";
import type { CalendarEvent } from "@openframe/shared";
import "react-big-calendar/lib/css/react-big-calendar.css";

const locales = { "en-US": enUS };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface CalendarViewProps {
  events: CalendarEvent[];
  onSelectEvent?: (event: CalendarEvent) => void;
  onSelectSlot?: (slotInfo: { start: Date; end: Date }) => void;
}

interface CalendarDisplayEvent extends Event {
  id: string;
  resource: CalendarEvent;
}

export function CalendarView({
  events,
  onSelectEvent,
  onSelectSlot,
}: CalendarViewProps) {
  const { currentDate, view, setCurrentDate, setView, calendars, dayStartHour, dayEndHour } = useCalendarStore();

  // Create min/max times for day view
  const minTime = useMemo(() => {
    const date = new Date();
    date.setHours(dayStartHour, 0, 0, 0);
    return date;
  }, [dayStartHour]);

  const maxTime = useMemo(() => {
    const date = new Date();
    date.setHours(dayEndHour, 0, 0, 0);
    return date;
  }, [dayEndHour]);

  const displayEvents: CalendarDisplayEvent[] = useMemo(() => {
    return events.map((event) => ({
      id: event.id,
      title: event.title,
      start: new Date(event.startTime),
      end: new Date(event.endTime),
      allDay: event.isAllDay,
      resource: event,
    }));
  }, [events]);

  const handleSelectEvent = useCallback(
    (event: CalendarDisplayEvent) => {
      onSelectEvent?.(event.resource);
    },
    [onSelectEvent]
  );

  const handleSelectSlot = useCallback(
    (slotInfo: { start: Date; end: Date }) => {
      onSelectSlot?.(slotInfo);
    },
    [onSelectSlot]
  );

  const handleNavigate = useCallback(
    (date: Date) => {
      setCurrentDate(date);
    },
    [setCurrentDate]
  );

  const handleViewChange = useCallback(
    (newView: string) => {
      setView(newView as "month" | "week" | "day" | "agenda");
    },
    [setView]
  );

  const eventStyleGetter = useCallback(
    (event: CalendarDisplayEvent) => {
      const calendarColor = (event.resource as CalendarEvent & { calendar?: { color: string } })
        .calendar?.color ?? "#3B82F6";

      return {
        style: {
          backgroundColor: calendarColor,
          borderColor: calendarColor,
          color: "#fff",
        },
      };
    },
    []
  );

  // Use custom week grid view
  if (view === "week") {
    return (
      <div className="h-full">
        <WeekGridView
          events={events}
          currentDate={currentDate}
          onSelectEvent={onSelectEvent}
          calendars={calendars.map(c => ({
            id: c.id,
            color: c.color,
            icon: c.icon ?? undefined
          }))}
        />
      </div>
    );
  }

  return (
    <div className="h-full">
      <Calendar
        localizer={localizer}
        events={displayEvents}
        startAccessor="start"
        endAccessor="end"
        date={currentDate}
        view={view}
        onNavigate={handleNavigate}
        onView={handleViewChange}
        onSelectEvent={handleSelectEvent}
        onSelectSlot={handleSelectSlot}
        selectable
        popup
        toolbar={false}
        eventPropGetter={eventStyleGetter}
        views={["month", "week", "day", "agenda"]}
        step={30}
        timeslots={2}
        showMultiDayTimes
        min={minTime}
        max={maxTime}
        className="h-full"
      />
    </div>
  );
}
