import { useMemo, useRef, useCallback, useEffect } from "react";
import { format, addDays, isToday } from "date-fns";
import type { CalendarEvent } from "@openframe/shared";
import { useCalendarStore } from "../../stores/calendar";

// For all-day events, we need to parse the date as a local date (ignoring timezone)
// because all-day events are conceptually "date-only" and stored as midnight UTC
function getEventStartDate(event: CalendarEvent): Date {
  if (event.isAllDay) {
    const isoString = typeof event.startTime === 'string'
      ? event.startTime
      : event.startTime.toISOString();
    const datePart = isoString.slice(0, 10);
    const parts = datePart.split('-').map(Number);
    const year = parts[0] ?? 1970;
    const month = parts[1] ?? 1;
    const day = parts[2] ?? 1;
    return new Date(year, month - 1, day);
  }
  return new Date(event.startTime);
}

function getEventEndDate(event: CalendarEvent): Date {
  if (event.isAllDay) {
    const isoString = typeof event.endTime === 'string'
      ? event.endTime
      : event.endTime.toISOString();
    const datePart = isoString.slice(0, 10);
    const parts = datePart.split('-').map(Number);
    const year = parts[0] ?? 1970;
    const month = parts[1] ?? 1;
    const day = parts[2] ?? 1;
    return new Date(year, month - 1, day);
  }
  return new Date(event.endTime);
}

const LONG_PRESS_DURATION = 500; // ms

// Convert hex color to pastel (light) version
function hexToPasstel(hex: string, opacity: number = 0.25): string {
  // Remove # if present
  hex = hex.replace(/^#/, '');

  // Parse hex to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
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

interface ScheduleViewProps {
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

// Format hour for time gutter (lowercase am/pm)
function formatHour(hour: number): string {
  if (hour === 0) return "12 am";
  if (hour === 12) return "12 pm";
  if (hour < 12) return `${hour} am`;
  return `${hour - 12} pm`;
}

// Format time range for events
function formatTimeRange(start: Date, end: Date): string {
  const formatTime = (d: Date) => {
    const h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return m === 0 ? `${hour} ${ampm}` : `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
  };
  return `${formatTime(start)} - ${formatTime(end)}`;
}

export function ScheduleView({
  events,
  currentDate,
  onSelectEvent,
  onDayClick,
  onDateLongPress,
  calendars,
}: ScheduleViewProps) {
  const { dayStartHour, dayEndHour } = useCalendarStore();
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const didLongPressRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to center current time on mount
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;

    // Only scroll if current time is within the day range
    if (currentHour >= dayStartHour && currentHour <= dayEndHour) {
      // Calculate the hour height (same formula as used in the grid)
      const containerHeight = container.clientHeight;
      const hourHeight = containerHeight / 8; // 8 hours visible at a time

      // Calculate position of current time from top
      const currentTimePosition = (currentHour - dayStartHour) * hourHeight;

      // Center it by scrolling to position minus half the container height
      const scrollTo = currentTimePosition - (containerHeight / 2);

      container.scrollTop = Math.max(0, scrollTo);
    }
  }, [dayStartHour, dayEndHour]);

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

  const calendarMap = useMemo(
    () => new Map(calendars.map((c) => [c.id, c])),
    [calendars]
  );

  // Generate 5 days starting from currentDate
  const scheduleDays = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => addDays(currentDate, i));
  }, [currentDate]);

  // Generate hour slots based on settings
  const hours = useMemo(() => {
    const result: number[] = [];
    for (let h = dayStartHour; h < dayEndHour; h++) {
      result.push(h);
    }
    return result;
  }, [dayStartHour, dayEndHour]);

  const totalHours = dayEndHour - dayStartHour;

  // Separate all-day events from timed events and group by day
  const { allDayEventsByDay, timedEventsByDay } = useMemo(() => {
    const allDay = new Map<string, CalendarEvent[]>();
    const timed = new Map<string, CalendarEvent[]>();

    scheduleDays.forEach((day) => {
      const key = format(day, "yyyy-MM-dd");
      allDay.set(key, []);
      timed.set(key, []);
    });

    events.forEach((event) => {
      const eventStart = getEventStartDate(event);
      const eventEnd = getEventEndDate(event);

      // For multi-day events, show on each day they span
      scheduleDays.forEach((day) => {
        const dayStart = new Date(day);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(day);
        dayEnd.setHours(23, 59, 59, 999);

        // Event overlaps with this day if:
        // eventStart <= dayEnd AND eventEnd > dayStart
        if (eventStart <= dayEnd && eventEnd > dayStart) {
          const dayKey = format(day, "yyyy-MM-dd");
          if (event.isAllDay) {
            allDay.get(dayKey)?.push(event);
          } else {
            timed.get(dayKey)?.push(event);
          }
        }
      });
    });

    // Sort timed events by start time
    timed.forEach((dayEvents) => {
      dayEvents.sort((a, b) =>
        getEventStartDate(a).getTime() - getEventStartDate(b).getTime()
      );
    });

    return { allDayEventsByDay: allDay, timedEventsByDay: timed };
  }, [events, scheduleDays]);

  const now = useMemo(() => new Date(), []);

  // Calculate event position and height based on fixed hour height (8 hours visible)
  const getEventStyle = useCallback((event: CalendarEvent) => {
    const start = new Date(event.startTime);
    const end = new Date(event.endTime);

    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;

    // Clamp to visible range
    const clampedStart = Math.max(startHour, dayStartHour);
    const clampedEnd = Math.min(endHour, dayEndHour);

    const topHours = clampedStart - dayStartHour;
    const heightHours = Math.max(clampedEnd - clampedStart, 0.5); // Minimum 0.5 hour height

    return {
      top: `calc(${topHours} * (100vh - 200px) / 8)`,
      height: `calc(${heightHours} * (100vh - 200px) / 8)`,
    };
  }, [dayStartHour, dayEndHour]);

  // Calculate column layout for overlapping events
  const getEventColumns = useCallback((dayEvents: CalendarEvent[]) => {
    if (dayEvents.length === 0) return new Map<string, { column: number; totalColumns: number }>();

    // Sort events by start time, then by duration (longer first)
    const sortedEvents = [...dayEvents].sort((a, b) => {
      const startDiff = new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      if (startDiff !== 0) return startDiff;
      // Longer events first
      const aDuration = new Date(a.endTime).getTime() - new Date(a.startTime).getTime();
      const bDuration = new Date(b.endTime).getTime() - new Date(b.startTime).getTime();
      return bDuration - aDuration;
    });

    const columns: { event: CalendarEvent; column: number; endTime: number }[] = [];
    const result = new Map<string, { column: number; totalColumns: number }>();

    for (const event of sortedEvents) {
      const eventStart = new Date(event.startTime).getTime();
      const eventEnd = new Date(event.endTime).getTime();

      // Find the first available column
      let column = 0;
      while (true) {
        const conflictInColumn = columns.find(
          (c) => c.column === column && c.endTime > eventStart
        );
        if (!conflictInColumn) break;
        column++;
      }

      columns.push({ event, column, endTime: eventEnd });
      result.set(event.id, { column, totalColumns: 1 }); // totalColumns updated later
    }

    // Find overlapping groups and set totalColumns for each event
    for (const event of sortedEvents) {
      const eventStart = new Date(event.startTime).getTime();
      const eventEnd = new Date(event.endTime).getTime();

      // Find all events that overlap with this one
      const overlapping = columns.filter((c) => {
        const cStart = new Date(c.event.startTime).getTime();
        const cEnd = c.endTime;
        return !(cEnd <= eventStart || cStart >= eventEnd);
      });

      const maxColumn = Math.max(...overlapping.map((c) => c.column)) + 1;

      // Update totalColumns for all overlapping events
      for (const o of overlapping) {
        const current = result.get(o.event.id)!;
        result.set(o.event.id, { ...current, totalColumns: Math.max(current.totalColumns, maxColumn) });
      }
    }

    return result;
  }, []);

  return (
    <div className="h-full flex flex-col border-t border-l border-white overflow-hidden">
      {/* Header row with day names */}
      <div className="flex border-b border-white shrink-0">
        {/* Time gutter header */}
        <div className="w-20 shrink-0 bg-muted border-r border-white" />

        {/* Day headers - simple format: "Sun 2" */}
        {scheduleDays.map((day) => {
          const isTodayHeader = isToday(day);
          return (
            <div
              key={format(day, "yyyy-MM-dd")}
              className={`flex-1 px-3 py-3 border-r border-white cursor-pointer ${isTodayHeader ? 'bg-primary/10' : 'bg-muted'}`}
              onClick={() => handleDayClick(day)}
              onPointerDown={(e) => handleDayPointerDown(day, e)}
              onPointerMove={handleDayPointerMove}
              onPointerUp={handleDayPointerUp}
              onPointerLeave={handleDayPointerUp}
              onPointerCancel={handleDayPointerUp}
            >
              <p className={`text-xl font-semibold text-center flex items-center justify-center gap-2 ${isTodayHeader ? 'text-primary' : 'text-foreground'}`}>
                <span>{format(day, "EEE")}</span>
                <span className={`${isTodayHeader ? 'bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center' : ''}`}>
                  {format(day, "d")}
                </span>
              </p>
            </div>
          );
        })}
      </div>

      {/* All-day events row */}
      <div className="flex border-b border-white shrink-0">
        {/* Time gutter - empty */}
        <div className="w-20 shrink-0 bg-muted border-r border-white" />

        {/* All-day events for each day */}
        {scheduleDays.map((day) => {
          const dayKey = format(day, "yyyy-MM-dd");
          const dayAllDayEvents = allDayEventsByDay.get(dayKey) ?? [];
          const isTodayAllDay = isToday(day);

          return (
            <div
              key={dayKey}
              className={`flex-1 border-r border-white p-1 space-y-0.5 min-h-[28px] ${isTodayAllDay ? 'bg-primary/5' : 'bg-card'}`}
            >
              {dayAllDayEvents.map((event) => {
                const isHoliday = event.calendarId === "federal-holidays";
                const cal = calendarMap.get(event.calendarId);
                const eventColor = isHoliday ? "#9333EA" : (cal?.color ?? "#3B82F6");
                const eventIcon = isHoliday ? "🇺🇸" : cal?.icon;
                const bgColor = hexToPasstel(eventColor, 0.3);
                const isPast = getEventEndDate(event) < now;
                return (
                  <button
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEvent?.(event);
                    }}
                    className={`w-full text-left text-xs px-2 py-1 rounded-md hover:opacity-80 transition-opacity ${isPast ? "opacity-40" : ""}`}
                    style={{ backgroundColor: bgColor }}
                  >
                    <span className={`font-medium truncate block ${isHoliday ? "text-purple-600 dark:text-purple-400" : "text-foreground"}`}>
                      {eventIcon && <span className="mr-1">{eventIcon}</span>}
                      {event.title}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Time grid - shows 8 hours at a time, scrollable */}
      <div
        ref={scrollContainerRef}
        className="flex-1 flex overflow-auto schedule-scroll"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <style>{`
          .schedule-scroll::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        {/* Time gutter */}
        <div
          className="w-20 shrink-0 bg-muted border-r border-white"
          style={{ minHeight: `calc(${totalHours} * (100vh - 200px) / 8)` }}
        >
          {hours.map((hour) => (
            <div
              key={hour}
              className="border-b border-white/50 text-lg text-muted-foreground px-2 pt-0.5"
              style={{ height: 'calc((100vh - 200px) / 8)' }}
            >
              {formatHour(hour)}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {scheduleDays.map((day) => {
          const dayKey = format(day, "yyyy-MM-dd");
          const dayTimedEvents = timedEventsByDay.get(dayKey) ?? [];
          const isCurrentDay = isToday(day);
          const eventColumns = getEventColumns(dayTimedEvents);

          return (
            <div
              key={dayKey}
              className={`flex-1 border-r border-white relative ${isCurrentDay ? 'bg-primary/5' : 'bg-card'}`}
              style={{ minHeight: `calc(${totalHours} * (100vh - 200px) / 8)` }}
              onClick={() => handleDayClick(day)}
              onPointerDown={(e) => handleDayPointerDown(day, e)}
              onPointerMove={handleDayPointerMove}
              onPointerUp={handleDayPointerUp}
              onPointerLeave={handleDayPointerUp}
              onPointerCancel={handleDayPointerUp}
            >
              {/* Hour grid lines */}
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="border-b border-white/50"
                  style={{ height: 'calc((100vh - 200px) / 8)' }}
                />
              ))}

              {/* Events */}
              {dayTimedEvents.map((event) => {
                const isHoliday = event.calendarId === "federal-holidays";
                const cal = calendarMap.get(event.calendarId);
                const eventColor = isHoliday ? "#9333EA" : (cal?.color ?? "#3B82F6");
                const eventIcon = isHoliday ? "🇺🇸" : (cal?.icon ?? "📅");
                const style = getEventStyle(event);
                const startTime = new Date(event.startTime);
                const endTime = new Date(event.endTime);
                const bgColor = hexToPasstel(eventColor, 0.3);
                const columnInfo = eventColumns.get(event.id) ?? { column: 0, totalColumns: 1 };
                const columnWidth = 100 / columnInfo.totalColumns;
                const leftOffset = columnInfo.column * columnWidth;
                const isPast = getEventEndDate(event) < now;

                return (
                  <button
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEvent?.(event);
                    }}
                    className="absolute rounded-lg px-2 py-1.5 text-left overflow-hidden hover:opacity-80 transition-opacity"
                    style={{
                      ...style,
                      backgroundColor: bgColor,
                      left: `calc(${leftOffset}% + 2px)`,
                      width: `calc(${columnWidth}% - 4px)`,
                      opacity: isPast ? 0.4 : undefined,
                    }}
                  >
                    <div className="h-full flex flex-col">
                      <p className={`text-xs font-semibold truncate ${isHoliday ? "text-purple-600 dark:text-purple-400" : "text-foreground"}`}>
                        {eventIcon && <span className="mr-1">{eventIcon}</span>}
                        {event.title}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatTimeRange(startTime, endTime)}
                      </p>
                      {/* Badge in bottom right */}
                      <div className="flex-1" />
                      <div className="flex justify-end">
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-medium"
                          style={{ backgroundColor: eventColor }}
                        >
                          {eventIcon}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}

              {/* Current time indicator for today */}
              {isCurrentDay && (() => {
                const now = new Date();
                const nowHour = now.getHours() + now.getMinutes() / 60;
                if (nowHour >= dayStartHour && nowHour <= dayEndHour) {
                  const topHours = nowHour - dayStartHour;
                  return (
                    <div
                      className="absolute left-0 right-0 h-0.5 bg-red-500 z-10 pointer-events-none"
                      style={{ top: `calc(${topHours} * (100vh - 200px) / 8)` }}
                    >
                      <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-red-500" />
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
