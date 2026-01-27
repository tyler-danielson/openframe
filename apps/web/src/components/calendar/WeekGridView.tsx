import { useMemo } from "react";
import { format, startOfWeek, endOfWeek, addDays, addWeeks, isSameDay, isSameMonth, isToday, isWithinInterval } from "date-fns";
import type { CalendarEvent } from "@openframe/shared";
import { cn } from "../../lib/utils";
import { useCalendarStore } from "../../stores/calendar";

interface WeekGridViewProps {
  events: CalendarEvent[];
  currentDate: Date;
  onSelectEvent?: (event: CalendarEvent) => void;
  calendars: Array<{ id: string; color: string; icon?: string }>;
}

// Format time, removing :00 for top-of-hour times
function formatTime(date: Date): string {
  const minutes = date.getMinutes();
  return minutes === 0
    ? format(date, "h a")
    : format(date, "h:mm a");
}

export function WeekGridView({
  events,
  currentDate,
  onSelectEvent,
  calendars,
}: WeekGridViewProps) {
  const weekStartsOn = useCalendarStore((state) => state.weekStartsOn);

  const calendarMap = useMemo(
    () => new Map(calendars.map((c) => [c.id, c])),
    [calendars]
  );

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate, weekStartsOn]);

  const eventsByDay = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    weekDays.forEach((day) => {
      grouped.set(format(day, "yyyy-MM-dd"), []);
    });

    events.forEach((event) => {
      const eventStart = new Date(event.startTime);
      // Find which day this event belongs to using isSameDay for proper timezone handling
      weekDays.forEach((day) => {
        if (isSameDay(eventStart, day)) {
          const dayKey = format(day, "yyyy-MM-dd");
          const dayEvents = grouped.get(dayKey);
          if (dayEvents) {
            dayEvents.push(event);
          }
        }
      });
    });

    // Sort events by time
    grouped.forEach((dayEvents) => {
      dayEvents.sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
    });

    return grouped;
  }, [events, weekDays]);

  const topRow = weekDays.slice(0, 4); // Sun, Mon, Tue, Wed
  const bottomRow = weekDays.slice(4); // Thu, Fri, Sat

  // Calculate next week's date range and events
  const nextWeekData = useMemo(() => {
    const nextWeekStart = addWeeks(startOfWeek(currentDate, { weekStartsOn }), 1);
    const nextWeekEnd = endOfWeek(nextWeekStart, { weekStartsOn });

    const nextWeekEvents = events
      .filter((event) => {
        const eventStart = new Date(event.startTime);
        return isWithinInterval(eventStart, { start: nextWeekStart, end: nextWeekEnd });
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    return {
      start: nextWeekStart,
      end: nextWeekEnd,
      events: nextWeekEvents,
    };
  }, [events, currentDate, weekStartsOn]);

  const renderDay = (day: Date) => {
    const dateKey = format(day, "yyyy-MM-dd");
    const dayEvents = eventsByDay.get(dateKey) ?? [];
    const isCurrentDay = isToday(day);

    return (
      <div
        key={dateKey}
        className="flex flex-col border-r border-b border-white overflow-hidden bg-card"
      >
        {/* Day header */}
        <div className="px-3 py-2 border-b border-white bg-muted h-16 flex flex-col justify-center">
          <p className="text-2xl font-bold text-foreground flex items-center gap-2">
            <span>{format(day, "EEE")}</span>
            <span
              className={cn(
                "inline-flex items-center justify-center",
                isCurrentDay && "bg-primary text-white rounded-full w-10 h-10"
              )}
            >
              {format(day, "d")}
            </span>
          </p>
        </div>

        {/* Events */}
        <div className="flex-1 p-2 space-y-1 overflow-auto min-h-[120px]">
          {dayEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No events
            </p>
          ) : (
            dayEvents.map((event) => {
              const cal = calendarMap.get(event.calendarId);
              return (
                <button
                  key={event.id}
                  onClick={() => onSelectEvent?.(event)}
                  className="w-full text-left rounded-md px-2 py-2 text-xs hover:bg-muted/80 transition-colors bg-muted/50 border border-border/50"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-foreground">{event.title}</p>
                      {!event.isAllDay && (
                        <p className="text-muted-foreground">
                          {formatTime(new Date(event.startTime))} - {formatTime(new Date(event.endTime))}
                        </p>
                      )}
                    </div>
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] flex-shrink-0"
                      style={{ backgroundColor: cal?.color ?? "#3B82F6" }}
                    >
                      {cal?.icon ?? "📅"}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col border-t border-l border-white">
      {/* Top row - 4 days */}
      <div className="flex-1 grid grid-cols-4">
        {topRow.map(renderDay)}
      </div>

      {/* Bottom row - 3 days + Next Week */}
      <div className="flex-1 grid grid-cols-4">
        {bottomRow.map(renderDay)}
        {/* Next Week cell */}
        <div className="flex flex-col border-r border-b border-white overflow-hidden bg-card">
          <div className="px-3 py-2 border-b border-white bg-muted h-16 flex flex-col justify-center">
            <p className="text-2xl font-bold text-foreground">Next Week</p>
            <p className="text-xs text-muted-foreground">
              {isSameMonth(nextWeekData.start, nextWeekData.end)
                ? `${format(nextWeekData.start, "MMMM d")} - ${format(nextWeekData.end, "d")}`
                : `${format(nextWeekData.start, "MMMM d")} - ${format(nextWeekData.end, "MMMM d")}`}
            </p>
          </div>
          <div className="flex-1 p-2 space-y-1 overflow-auto min-h-[120px]">
            {nextWeekData.events.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No events
              </p>
            ) : (
              nextWeekData.events.map((event) => {
                const cal = calendarMap.get(event.calendarId);
                return (
                  <button
                    key={event.id}
                    onClick={() => onSelectEvent?.(event)}
                    className="w-full text-left rounded-md px-2 py-2 text-xs hover:bg-muted/80 transition-colors bg-muted/50 border border-border/50"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-foreground">{event.title}</p>
                        <p className="text-muted-foreground">
                          {format(new Date(event.startTime), "EEE, MMM d")}
                          {!event.isAllDay && (
                            <> · {formatTime(new Date(event.startTime))}</>
                          )}
                        </p>
                      </div>
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] flex-shrink-0"
                        style={{ backgroundColor: cal?.color ?? "#3B82F6" }}
                      >
                        {cal?.icon ?? "📅"}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
