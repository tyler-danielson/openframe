import { useMemo, useCallback, useRef, useEffect } from "react";
import { Calendar, dateFnsLocalizer, type Event, type DateHeaderProps } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, isSameDay, startOfMonth, endOfMonth, addDays } from "date-fns";
import { enUS } from "date-fns/locale";
import { useCalendarStore } from "../../stores/calendar";
import { WeekGridView } from "./WeekGridView";
import { RollingMonthView } from "./RollingMonthView";
import { ScheduleView } from "./ScheduleView";
import type { CalendarEvent } from "@openframe/shared";
import "react-big-calendar/lib/css/react-big-calendar.css";

// For all-day events, we need to parse the date as a local date (ignoring timezone)
// because all-day events are conceptually "date-only" and stored as midnight UTC
function getEventDate(dateValue: Date | string, isAllDay: boolean): Date {
  if (isAllDay) {
    const isoString = typeof dateValue === 'string'
      ? dateValue
      : dateValue.toISOString();
    const datePart = isoString.slice(0, 10);
    const parts = datePart.split('-').map(Number);
    const year = parts[0] ?? 1970;
    const month = parts[1] ?? 1;
    const day = parts[2] ?? 1;
    return new Date(year, month - 1, day);
  }
  return new Date(dateValue);
}

const locales = { "en-US": enUS };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

// Weather icon mapping
function getWeatherIcon(iconCode: string): string {
  const iconMap: Record<string, string> = {
    "01d": "\u2600\uFE0F", // sunny
    "01n": "\uD83C\uDF19", // clear night
    "02d": "\u26C5", // partly cloudy
    "02n": "\u26C5",
    "03d": "\u2601\uFE0F", // cloudy
    "03n": "\u2601\uFE0F",
    "04d": "\u2601\uFE0F", // broken clouds
    "04n": "\u2601\uFE0F",
    "09d": "\uD83C\uDF27\uFE0F", // rain
    "09n": "\uD83C\uDF27\uFE0F",
    "10d": "\uD83C\uDF26\uFE0F", // sun rain
    "10n": "\uD83C\uDF27\uFE0F",
    "11d": "\u26C8\uFE0F", // thunder
    "11n": "\u26C8\uFE0F",
    "13d": "\uD83C\uDF28\uFE0F", // snow
    "13n": "\uD83C\uDF28\uFE0F",
    "50d": "\uD83C\uDF2B\uFE0F", // mist
    "50n": "\uD83C\uDF2B\uFE0F",
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
  feels_like: number;
  temp_min: number;
  temp_max: number;
  humidity: number;
  description: string;
  icon: string;
  wind_speed: number;
  city: string;
}

interface CalendarViewProps {
  events: CalendarEvent[];
  onSelectEvent?: (event: CalendarEvent) => void;
  onSelectSlot?: (slotInfo: { start: Date; end: Date }) => void;
  onDateLongPress?: (date: Date) => void;
  weatherForecast?: WeatherForecast[];
  currentWeather?: WeatherData;
  onWeatherClick?: (date: Date) => void;
}

interface CalendarDisplayEvent extends Event {
  id: string;
  resource: CalendarEvent;
}

const LONG_PRESS_DURATION = 500; // ms

export function CalendarView({
  events,
  onSelectEvent,
  onSelectSlot,
  onDateLongPress,
  weatherForecast,
  currentWeather,
  onWeatherClick,
}: CalendarViewProps) {
  const { currentDate, view, setCurrentDate, setView, calendars, dayStartHour, dayEndHour, weekStartsOn, monthMode } = useCalendarStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const isLongPressRef = useRef(false);

  // Get date from a point on the calendar using the DOM structure
  const getDateFromPoint = useCallback((x: number, y: number): Date | null => {
    const element = document.elementFromPoint(x, y);
    if (!element) return null;

    // For month view, find the date cell
    const dateCell = element.closest('.rbc-date-cell');
    if (dateCell) {
      // Try to find the date from the row context
      const row = dateCell.closest('.rbc-month-row');
      if (row && containerRef.current) {
        const rows = containerRef.current.querySelectorAll('.rbc-month-row');
        const rowIndex = Array.from(rows).indexOf(row as Element);
        const cells = row.querySelectorAll('.rbc-date-cell');
        const cellIndex = Array.from(cells).indexOf(dateCell as Element);

        if (rowIndex >= 0 && cellIndex >= 0) {
          // Calculate the date based on row and cell position
          const monthStart = startOfMonth(currentDate);
          const calendarStart = startOfWeek(monthStart, { weekStartsOn });
          const dayOffset = rowIndex * 7 + cellIndex;
          return addDays(calendarStart, dayOffset);
        }
      }
    }

    // For day slots
    const daySlot = element.closest('.rbc-day-slot');
    if (daySlot) {
      // In day view, we use the current date
      if (view === 'day') {
        return currentDate;
      }
    }

    // For day background cells
    const dayBg = element.closest('.rbc-day-bg');
    if (dayBg) {
      const parent = dayBg.parentElement;
      if (parent) {
        const cells = parent.querySelectorAll('.rbc-day-bg');
        const cellIndex = Array.from(cells).indexOf(dayBg as Element);
        if (cellIndex >= 0) {
          const weekStart = startOfWeek(currentDate, { weekStartsOn });
          return addDays(weekStart, cellIndex);
        }
      }
    }

    return null;
  }, [currentDate, view, weekStartsOn]);

  // Long-press handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!onDateLongPress) return;

    // Only handle primary button (left click / touch)
    if (e.button !== 0) return;

    longPressStartPosRef.current = { x: e.clientX, y: e.clientY };
    isLongPressRef.current = false;

    longPressTimerRef.current = setTimeout(() => {
      const date = getDateFromPoint(e.clientX, e.clientY);
      if (date) {
        isLongPressRef.current = true;
        onDateLongPress(date);
      }
    }, LONG_PRESS_DURATION);
  }, [onDateLongPress, getDateFromPoint]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (longPressTimerRef.current && longPressStartPosRef.current) {
      // Cancel if moved more than 10px
      const dx = e.clientX - longPressStartPosRef.current.x;
      const dy = e.clientY - longPressStartPosRef.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > 10) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
        longPressStartPosRef.current = null;
      }
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartPosRef.current = null;
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartPosRef.current = null;
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  // Modified slot selection to prevent triggering after long-press
  const handleSelectSlotWithLongPressCheck = useCallback(
    (slotInfo: { start: Date; end: Date }) => {
      if (isLongPressRef.current) {
        isLongPressRef.current = false;
        return;
      }
      onSelectSlot?.(slotInfo);
    },
    [onSelectSlot]
  );

  // Custom event component for month view
  const MonthEvent = useCallback(({ event }: { event: CalendarDisplayEvent }) => {
    const isHoliday = event.resource.calendarId === "federal-holidays";
    const calendar = calendars.find(c => c.id === event.resource.calendarId);
    const calendarColor = isHoliday ? "#9333EA" : (calendar?.color ?? "#3B82F6");
    const calendarIcon = isHoliday ? "🇺🇸" : (calendar?.icon ?? "📅");

    return (
      <div className={`flex items-center gap-1 w-full overflow-hidden ${isHoliday ? "font-medium" : ""}`}>
        <span className="truncate flex-1 text-xs">{event.title}</span>
        <div
          className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] flex-shrink-0"
          style={{ backgroundColor: calendarColor }}
        >
          {calendarIcon}
        </div>
      </div>
    );
  }, [calendars]);

  // Create custom date header with weather
  const customComponents = useMemo(() => {
    const DateHeader = ({ date, label }: DateHeaderProps) => {
      const isTodayDate = isSameDay(date, new Date());

      // Get weather for this day
      let dayWeather: { icon: string; temp: number } | null = null;

      if (isTodayDate && currentWeather) {
        // For today, show current temp
        dayWeather = {
          icon: currentWeather.icon,
          temp: currentWeather.temp,
        };
      } else if (weatherForecast) {
        const dayName = format(date, "EEE");
        const forecast = weatherForecast.find(f => f.date === dayName);
        if (forecast) {
          // For forecast days, show high temp
          dayWeather = {
            icon: forecast.icon,
            temp: forecast.temp_max,
          };
        }
      }

      return (
        <div className="flex items-center justify-between w-full px-1">
          <span
            className={
              isTodayDate
                ? "inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground font-bold"
                : ""
            }
          >
            {label}
          </span>
          {dayWeather && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onWeatherClick?.(date);
              }}
              className="text-xs flex items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>{getWeatherIcon(dayWeather.icon)}</span>
              <span>{dayWeather.temp}°</span>
            </button>
          )}
        </div>
      );
    };

    // Day header for day/agenda views
    const DayHeader = ({ date, label }: { date: Date; label: string }) => {
      const isTodayDate = isSameDay(date, new Date());
      let dayWeather: { icon: string; temp: number } | null = null;

      if (isTodayDate && currentWeather) {
        dayWeather = { icon: currentWeather.icon, temp: currentWeather.temp };
      } else if (weatherForecast) {
        const dayName = format(date, "EEE");
        const forecast = weatherForecast.find(f => f.date === dayName);
        if (forecast) {
          dayWeather = { icon: forecast.icon, temp: forecast.temp_max };
        }
      }

      return (
        <div className="flex items-center gap-2">
          <span>{label}</span>
          {dayWeather && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onWeatherClick?.(date);
              }}
              className="text-sm flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>{getWeatherIcon(dayWeather.icon)}</span>
              <span>{dayWeather.temp}°</span>
            </button>
          )}
        </div>
      );
    };

    return {
      month: {
        dateHeader: DateHeader,
        event: MonthEvent,
      },
      day: {
        header: DayHeader,
      },
      agenda: {
        date: ({ day, label }: { day: Date; label: string }) => {
          let dayWeather: { icon: string; temp: number } | null = null;
          if (isSameDay(day, new Date()) && currentWeather) {
            dayWeather = { icon: currentWeather.icon, temp: currentWeather.temp };
          } else if (weatherForecast) {
            const dayName = format(day, "EEE");
            const forecast = weatherForecast.find(f => f.date === dayName);
            if (forecast) dayWeather = { icon: forecast.icon, temp: forecast.temp_max };
          }
          return (
            <span className="flex items-center gap-2">
              {label}
              {dayWeather && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onWeatherClick?.(day);
                  }}
                  className="text-xs hover:text-foreground transition-colors"
                >
                  {getWeatherIcon(dayWeather.icon)} {dayWeather.temp}°
                </button>
              )}
            </span>
          );
        },
      },
    };
  }, [weatherForecast, currentWeather, onWeatherClick, MonthEvent]);

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
      start: getEventDate(event.startTime, event.isAllDay),
      end: getEventDate(event.endTime, event.isAllDay),
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

  const handleNavigate = useCallback(
    (date: Date) => {
      setCurrentDate(date);
    },
    [setCurrentDate]
  );

  const handleViewChange = useCallback(
    (newView: string) => {
      setView(newView as "month" | "week" | "day" | "agenda" | "schedule");
    },
    [setView]
  );

  const eventStyleGetter = useCallback(
    (event: CalendarDisplayEvent) => {
      const isHoliday = event.resource.calendarId === "federal-holidays";
      const holidayColor = "#9333EA"; // Purple for federal holidays
      const calendarColor = isHoliday
        ? holidayColor
        : ((event.resource as CalendarEvent & { calendar?: { color: string } }).calendar?.color ?? "#3B82F6");

      // Use subtle styling for month view
      if (view === "month") {
        return {
          style: {
            backgroundColor: isHoliday ? "rgba(147, 51, 234, 0.15)" : "hsl(var(--muted) / 0.5)",
            border: isHoliday ? "1px solid rgba(147, 51, 234, 0.4)" : "1px solid hsl(var(--border) / 0.5)",
            borderLeft: `3px solid ${calendarColor}`,
            color: isHoliday ? "#9333EA" : "hsl(var(--foreground))",
            borderRadius: "4px",
            fontWeight: isHoliday ? 500 : undefined,
          },
        };
      }

      return {
        style: {
          backgroundColor: calendarColor,
          borderColor: calendarColor,
          color: "#fff",
        },
      };
    },
    [view]
  );

  // Use custom schedule view (5-day view)
  if (view === "schedule") {
    return (
      <div ref={containerRef} className="h-full">
        <ScheduleView
          events={events}
          currentDate={currentDate}
          onSelectEvent={onSelectEvent}
          onDayClick={(date) => onSelectSlot?.({ start: date, end: date })}
          onDateLongPress={onDateLongPress}
          calendars={calendars.map(c => ({
            id: c.id,
            color: c.color,
            icon: c.icon ?? undefined
          }))}
          weatherForecast={weatherForecast}
          currentWeather={currentWeather}
          onWeatherClick={onWeatherClick}
        />
      </div>
    );
  }

  // Use custom week grid view
  if (view === "week") {
    return (
      <div ref={containerRef} className="h-full">
        <WeekGridView
          events={events}
          currentDate={currentDate}
          onSelectEvent={onSelectEvent}
          onDayClick={(date) => onSelectSlot?.({ start: date, end: date })}
          onDateLongPress={onDateLongPress}
          calendars={calendars.map(c => ({
            id: c.id,
            color: c.color,
            icon: c.icon ?? undefined
          }))}
          weatherForecast={weatherForecast}
          currentWeather={currentWeather}
          onWeatherClick={onWeatherClick}
        />
      </div>
    );
  }

  // Use custom rolling month view (4 weeks starting from today)
  if (view === "month" && monthMode === "rolling") {
    return (
      <div ref={containerRef} className="h-full">
        <RollingMonthView
          events={events}
          currentDate={currentDate}
          onSelectEvent={onSelectEvent}
          onDayClick={(date) => onSelectSlot?.({ start: date, end: date })}
          onDateLongPress={onDateLongPress}
          calendars={calendars.map(c => ({
            id: c.id,
            color: c.color,
            icon: c.icon ?? undefined
          }))}
          weatherForecast={weatherForecast}
          currentWeather={currentWeather}
          onWeatherClick={onWeatherClick}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={handlePointerUp}
    >
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
        onSelectSlot={handleSelectSlotWithLongPressCheck}
        onDrillDown={(date) => onSelectSlot?.({ start: date, end: date })}
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
        components={customComponents}
        drilldownView={null}
      />
    </div>
  );
}
