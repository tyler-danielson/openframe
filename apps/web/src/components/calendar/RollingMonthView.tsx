import { useMemo, useRef, useCallback } from "react";
import { format, addDays, isSameDay, isToday, startOfWeek } from "date-fns";
import type { CalendarEvent } from "@openframe/shared";
import { cn } from "../../lib/utils";
import { useCalendarStore } from "../../stores/calendar";

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

interface RollingMonthViewProps {
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

export function RollingMonthView({
  events,
  currentDate,
  onSelectEvent,
  onDayClick,
  onDateLongPress,
  calendars,
  weatherForecast,
  currentWeather,
  onWeatherClick,
}: RollingMonthViewProps) {
  const weekStartsOn = useCalendarStore((state) => state.weekStartsOn);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const didLongPressRef = useRef(false);

  // Long-press handlers for day cells
  const handleDayPointerDown = useCallback((date: Date, e: React.PointerEvent) => {
    if (e.button !== 0) return;

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

  const handleDayClick = useCallback((date: Date) => {
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
      return { icon: currentWeather.icon, temp: currentWeather.temp };
    }
    if (weatherForecast) {
      const dayName = format(day, "EEE");
      const forecast = weatherForecast.find(f => f.date === dayName);
      if (forecast) {
        return { icon: forecast.icon, temp: forecast.temp_max };
      }
    }
    return null;
  };

  const calendarMap = useMemo(
    () => new Map(calendars.map((c) => [c.id, c])),
    [calendars]
  );

  // Generate 28 days (4 weeks) starting from the beginning of the week containing currentDate
  const days = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn });
    return Array.from({ length: 28 }, (_, i) => addDays(weekStart, i));
  }, [currentDate, weekStartsOn]);

  // Split into 4 weeks
  const weeks = useMemo(() => {
    return [
      days.slice(0, 7),
      days.slice(7, 14),
      days.slice(14, 21),
      days.slice(21, 28),
    ];
  }, [days]);

  const eventsByDay = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    days.forEach((day) => {
      grouped.set(format(day, "yyyy-MM-dd"), []);
    });

    events.forEach((event) => {
      const eventStart = getEventStartDate(event);
      const eventEnd = getEventEndDate(event);

      // For multi-day events (especially all-day events), show on each day
      days.forEach((day) => {
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
  }, [events, days]);

  // Find the next upcoming event
  const nextEventId = useMemo(() => {
    const now = new Date();
    let nextEvent: CalendarEvent | null = null;

    for (const dayEvents of eventsByDay.values()) {
      for (const event of dayEvents) {
        const eventStart = new Date(event.startTime);
        if (eventStart > now) {
          if (!nextEvent || eventStart < new Date(nextEvent.startTime)) {
            nextEvent = event;
          }
        }
      }
    }

    return nextEvent?.id ?? null;
  }, [eventsByDay]);

  const renderDay = (day: Date) => {
    const dateKey = format(day, "yyyy-MM-dd");
    const dayEvents = eventsByDay.get(dateKey) ?? [];
    const isCurrentDay = isToday(day);
    const dayWeather = getWeatherForDay(day);

    return (
      <div
        key={dateKey}
        className="flex flex-col border-r border-b border-border overflow-hidden bg-card cursor-pointer"
        onClick={() => handleDayClick(day)}
        onPointerDown={(e) => handleDayPointerDown(day, e)}
        onPointerMove={handleDayPointerMove}
        onPointerUp={handleDayPointerUp}
        onPointerLeave={handleDayPointerUp}
        onPointerCancel={handleDayPointerUp}
      >
        {/* Day header */}
        <div className="px-2 py-1 border-b border-border bg-muted/50 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">{format(day, "EEE")}</span>
            <span
              className={cn(
                "text-sm font-semibold inline-flex items-center justify-center",
                isCurrentDay && "bg-primary text-primary-foreground rounded-full w-6 h-6"
              )}
            >
              {format(day, "d")}
            </span>
            {format(day, "d") === "1" && (
              <span className="text-xs text-muted-foreground">{format(day, "MMM")}</span>
            )}
          </div>
          {dayWeather && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onWeatherClick?.(day);
              }}
              className="text-xs flex items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>{getWeatherIcon(dayWeather.icon)}</span>
              <span>{dayWeather.temp}°</span>
            </button>
          )}
        </div>

        {/* Events */}
        <div className="flex-1 p-1 space-y-0.5 overflow-auto">
          {dayEvents.length === 0 ? (
            <p className="text-[10px] text-muted-foreground text-center py-2">
              No events
            </p>
          ) : (
            dayEvents.map((event) => {
              const cal = calendarMap.get(event.calendarId);
              const isNextEvent = event.id === nextEventId;
              return (
                <div key={event.id}>
                  {isNextEvent && (
                    <p className="text-[9px] text-muted-foreground italic mb-0.5 ml-0.5">up next</p>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEvent?.(event);
                    }}
                    className={cn(
                      "w-full text-left rounded px-1.5 py-1 text-[11px] hover:bg-muted/80 transition-colors bg-muted/50",
                      isNextEvent
                        ? "border-2 border-primary/60"
                        : "border border-border/50"
                    )}
                  >
                    <div className="flex items-center gap-1">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-foreground">{event.title}</p>
                        {!event.isAllDay && (
                          <p className="text-muted-foreground text-[10px]">
                            {formatTime(new Date(event.startTime))}
                          </p>
                        )}
                      </div>
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] flex-shrink-0"
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
    <div className="h-full flex flex-col border-t border-l border-border">
      {/* Week rows */}
      {weeks.map((week, weekIndex) => (
        <div key={weekIndex} className="flex-1 grid grid-cols-7">
          {week.map(renderDay)}
        </div>
      ))}
    </div>
  );
}
