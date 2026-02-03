import { useMemo, useRef, useCallback } from "react";
import { format, startOfWeek, endOfWeek, addDays, addWeeks, isToday } from "date-fns";
import type { CalendarEvent } from "@openframe/shared";
import { cn } from "../../lib/utils";
import { useCalendarStore } from "../../stores/calendar";
import { WeekCellWidget } from "./WeekCellWidget";

// For all-day events, we need to parse the date as a local date (ignoring timezone)
// because all-day events are conceptually "date-only" and stored as midnight UTC
function getEventStartDate(event: CalendarEvent): Date {
  if (event.isAllDay) {
    // Parse the ISO string and extract just the date part
    const isoString = typeof event.startTime === 'string'
      ? event.startTime
      : event.startTime.toISOString();
    // Extract YYYY-MM-DD and create a local midnight date
    const datePart = isoString.slice(0, 10);
    const [year, month, day] = datePart.split('-').map(Number);
    return new Date(year, month - 1, day); // Local midnight
  }
  return new Date(event.startTime);
}

function getEventEndDate(event: CalendarEvent): Date {
  if (event.isAllDay) {
    const isoString = typeof event.endTime === 'string'
      ? event.endTime
      : event.endTime.toISOString();
    const datePart = isoString.slice(0, 10);
    const [year, month, day] = datePart.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(event.endTime);
}

const LONG_PRESS_DURATION = 500; // ms

// Weather icon mapping
function getWeatherIcon(iconCode: string): string {
  const iconMap: Record<string, string> = {
    "01d": "\u2600\uFE0F", "01n": "\uD83C\uDF19",
    "02d": "\u26C5", "02n": "\u26C5",
    "03d": "\u2601\uFE0F", "03n": "\u2601\uFE0F",
    "04d": "\u2601\uFE0F", "04n": "\u2601\uFE0F",
    "09d": "\uD83C\uDF27\uFE0F", "09n": "\uD83C\uDF27\uFE0F",
    "10d": "\uD83C\uDF26\uFE0F", "10n": "\uD83C\uDF27\uFE0F",
    "11d": "\u26C8\uFE0F", "11n": "\u26C8\uFE0F",
    "13d": "\uD83C\uDF28\uFE0F", "13n": "\uD83C\uDF28\uFE0F",
    "50d": "\uD83C\uDF2B\uFE0F", "50n": "\uD83C\uDF2B\uFE0F",
  };
  return iconMap[iconCode] || "\u2600\uFE0F";
}

interface WeatherForecast {
  date: string;
  temp_min: number;
  temp_max: number;
  description: string;
  icon: string;
}

interface WeatherData {
  temp: number;
  temp_min: number;
  temp_max: number;
  icon: string;
}

interface WeekGridViewProps {
  events: CalendarEvent[];
  currentDate: Date;
  onSelectEvent?: (event: CalendarEvent) => void;
  onDayClick?: (date: Date) => void;
  onDateLongPress?: (date: Date) => void;
  calendars: Array<{ id: string; color: string; icon?: string }>;
  weatherForecast?: WeatherForecast[];
  currentWeather?: WeatherData;
  onWeatherClick?: (date: Date) => void;
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
  onDayClick,
  onDateLongPress,
  calendars,
  weatherForecast,
  currentWeather,
  onWeatherClick,
}: WeekGridViewProps) {
  const weekStartsOn = useCalendarStore((state) => state.weekStartsOn);
  const weekMode = useCalendarStore((state) => state.weekMode);
  const weekCellWidget = useCalendarStore((state) => state.weekCellWidget);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const didLongPressRef = useRef(false);

  // Long-press handlers for day cells
  const handleDayPointerDown = useCallback((date: Date, e: React.PointerEvent) => {
    if (e.button !== 0) return; // Only primary button

    longPressStartPosRef.current = { x: e.clientX, y: e.clientY };
    didLongPressRef.current = false;

    if (onDateLongPress) {
      longPressTimerRef.current = setTimeout(() => {
        didLongPressRef.current = true;
        onDateLongPress(date);
        longPressTimerRef.current = null;
      }, LONG_PRESS_DURATION);
    }
  }, [onDateLongPress]);

  const handleDayPointerMove = useCallback((e: React.PointerEvent) => {
    if (longPressTimerRef.current && longPressStartPosRef.current) {
      const dx = e.clientX - longPressStartPosRef.current.x;
      const dy = e.clientY - longPressStartPosRef.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > 10) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
        longPressStartPosRef.current = null;
      }
    }
  }, []);

  const handleDayPointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartPosRef.current = null;
  }, []);

  // Click handler for day cells (when not a long-press)
  const handleDayClick = useCallback((date: Date) => {
    // Don't trigger click if it was a long-press
    if (didLongPressRef.current) {
      didLongPressRef.current = false;
      return;
    }
    onDayClick?.(date);
  }, [onDayClick]);

  // Get weather for a specific day
  const getWeatherForDay = (day: Date) => {
    const isCurrentDay = isToday(day);
    if (isCurrentDay && currentWeather) {
      // For today, show current temp
      return { icon: currentWeather.icon, temp: currentWeather.temp };
    }
    if (weatherForecast) {
      const dayName = format(day, "EEE");
      const forecast = weatherForecast.find(f => f.date === dayName);
      if (forecast) {
        // For forecast days, show high temp
        return { icon: forecast.icon, temp: forecast.temp_max };
      }
    }
    return null;
  };

  const calendarMap = useMemo(
    () => new Map(calendars.map((c) => [c.id, c])),
    [calendars]
  );

  const weekDays = useMemo(() => {
    // Rolling week: start from today
    // Current week: start from week beginning based on weekStartsOn
    const start = weekMode === "rolling"
      ? currentDate
      : startOfWeek(currentDate, { weekStartsOn });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate, weekStartsOn, weekMode]);

  const eventsByDay = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    weekDays.forEach((day) => {
      grouped.set(format(day, "yyyy-MM-dd"), []);
    });

    events.forEach((event) => {
      const eventStart = getEventStartDate(event);
      const eventEnd = getEventEndDate(event);

      // For multi-day events (especially all-day events), show on each day
      weekDays.forEach((day) => {
        // Check if this day falls within the event's span
        const dayStart = new Date(day);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(day);
        dayEnd.setHours(23, 59, 59, 999);

        // Event overlaps with this day if:
        // eventStart <= dayEnd AND eventEnd > dayStart
        if (eventStart <= dayEnd && eventEnd > dayStart) {
          const dayKey = format(day, "yyyy-MM-dd");
          const dayEvents = grouped.get(dayKey);
          if (dayEvents) {
            dayEvents.push(event);
          }
        }
      });
    });

    // Sort events by time (all-day events first, then by start time)
    grouped.forEach((dayEvents) => {
      dayEvents.sort((a, b) => {
        // All-day events come first
        if (a.isAllDay && !b.isAllDay) return -1;
        if (!a.isAllDay && b.isAllDay) return 1;
        // Then sort by start time
        return getEventStartDate(a).getTime() - getEventStartDate(b).getTime();
      });
    });

    return grouped;
  }, [events, weekDays]);

  const topRow = weekDays.slice(0, 4); // Sun, Mon, Tue, Wed
  const bottomRow = weekDays.slice(4); // Thu, Fri, Sat

  // Find the next upcoming event (first event that starts after now)
  const nextEventId = useMemo(() => {
    const now = new Date();
    let nextEvent: CalendarEvent | null = null;

    for (const dayEvents of eventsByDay.values()) {
      for (const event of dayEvents) {
        const eventStart = getEventStartDate(event);
        if (eventStart > now) {
          if (!nextEvent || eventStart < getEventStartDate(nextEvent)) {
            nextEvent = event;
          }
        }
      }
    }

    return nextEvent?.id ?? null;
  }, [eventsByDay]);

  // Calculate next week's date range and events
  const nextWeekData = useMemo(() => {
    // For rolling week, next week starts 7 days after current date
    // For current week, next week starts at the beginning of the next calendar week
    const nextWeekStart = weekMode === "rolling"
      ? addDays(currentDate, 7)
      : addWeeks(startOfWeek(currentDate, { weekStartsOn }), 1);
    const nextWeekEnd = weekMode === "rolling"
      ? addDays(nextWeekStart, 6)
      : endOfWeek(nextWeekStart, { weekStartsOn });

    const nextWeekEvents = events
      .filter((event) => {
        const eventStart = getEventStartDate(event);
        const eventEnd = getEventEndDate(event);
        // Event overlaps with next week if it starts before week ends and ends after week starts
        return eventStart <= nextWeekEnd && eventEnd > nextWeekStart;
      })
      .sort((a, b) => getEventStartDate(a).getTime() - getEventStartDate(b).getTime());

    return {
      start: nextWeekStart,
      end: nextWeekEnd,
      events: nextWeekEvents,
    };
  }, [events, currentDate, weekStartsOn, weekMode]);

  const renderDay = (day: Date) => {
    const dateKey = format(day, "yyyy-MM-dd");
    const dayEvents = eventsByDay.get(dateKey) ?? [];
    const isCurrentDay = isToday(day);
    const dayWeather = getWeatherForDay(day);

    return (
      <div
        key={dateKey}
        className="flex flex-col border-r border-b border-white overflow-hidden bg-card cursor-pointer"
        onClick={() => handleDayClick(day)}
        onPointerDown={(e) => handleDayPointerDown(day, e)}
        onPointerMove={handleDayPointerMove}
        onPointerUp={handleDayPointerUp}
        onPointerLeave={handleDayPointerUp}
        onPointerCancel={handleDayPointerUp}
      >
        {/* Day header */}
        <div className="px-3 py-2 border-b border-white bg-muted h-16 flex flex-col justify-center">
          <div className="flex items-center justify-between">
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
            {dayWeather && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onWeatherClick?.(day);
                }}
                className="text-lg flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>{getWeatherIcon(dayWeather.icon)}</span>
                <span className="font-semibold">{dayWeather.temp}°</span>
              </button>
            )}
          </div>
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
              const isNextEvent = event.id === nextEventId;
              return (
                <div key={event.id}>
                  {isNextEvent && (
                    <p className="text-[10px] text-muted-foreground italic mb-0.5 ml-1">up next</p>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEvent?.(event);
                    }}
                    className={cn(
                      "w-full text-left rounded-md px-2 py-2 text-xs hover:bg-muted/80 transition-colors bg-muted/50",
                      isNextEvent
                        ? "border-2 border-primary/60"
                        : "border border-border/50"
                    )}
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
                </div>
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

      {/* Bottom row - 3 days + Configurable Widget */}
      <div className="flex-1 grid grid-cols-4">
        {bottomRow.map(renderDay)}
        <WeekCellWidget
          mode={weekCellWidget}
          nextWeekData={nextWeekData}
          calendarMap={calendarMap}
          onSelectEvent={onSelectEvent}
        />
      </div>
    </div>
  );
}
