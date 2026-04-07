import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  format,
  startOfDay,
  endOfDay,
  addDays,
  startOfWeek,
  differenceInMinutes,
  subMinutes,
  addHours,
  isSameDay,
} from "date-fns";
import { CalendarDays } from "lucide-react";
import { api } from "../../services/api";
import type { WidgetStyle, FontSizePreset } from "../../stores/screensaver";
import { getFontSizeConfig } from "../../lib/font-size";
import type { CalendarEvent, Calendar } from "@openframe/shared";
import { cn } from "../../lib/utils";
import { useDataFreshness } from "../../hooks/useDataFreshness";
import { STALE_THRESHOLDS } from "../../lib/stale-thresholds";
import { StaleDataOverlay } from "./StaleDataOverlay";
import { getEventStart as getEventStartDate, getEventEnd as getEventEndDate } from "../../lib/event-dates";

interface WeekScheduleWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
  widgetId?: string;
}

const FONT_SIZE_CLASSES: Record<Exclude<FontSizePreset, "custom">, { hour: string; event: string; header: string }> = {
  xs: { hour: "text-[7px]", event: "text-[8px]", header: "text-[8px]" },
  sm: { hour: "text-[8px]", event: "text-[9px]", header: "text-[9px]" },
  md: { hour: "text-[9px]", event: "text-[10px]", header: "text-[10px]" },
  lg: { hour: "text-[10px]", event: "text-xs", header: "text-xs" },
  xl: { hour: "text-xs", event: "text-sm", header: "text-sm" },
};

const CUSTOM_SCALE = {
  hour: 0.7,
  event: 0.85,
  header: 0.85,
};

// Multi-day timed events should be treated like all-day events (banner at top)
function isBannerEvent(event: CalendarEvent): boolean {
  if (event.isAllDay) return true;
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  return !isSameDay(start, end);
}

export function WeekScheduleWidget({ config, style, isBuilder }: WeekScheduleWidgetProps) {
  const configCalendarIds = (config.calendarIds as string[]) ?? [];
  const numberOfDays = (config.numberOfDays as number) ?? 5;
  const startDay = (config.startDay as string) ?? "today";
  const viewMode = (config.viewMode as string) ?? "fixed";
  const fixedStartHour = (config.startHour as number) ?? 6;
  const fixedEndHour = (config.endHour as number) ?? 22;
  const rollingOffsetMinutes = (config.rollingOffsetMinutes as number) ?? 60;
  const rollingDurationHours = (config.rollingDurationHours as number) ?? 8;
  const showCurrentTime = (config.showCurrentTime as boolean) ?? true;
  const showHourLabels = (config.showHourLabels as boolean) ?? true;
  const showAllDayEvents = (config.showAllDayEvents as boolean) ?? true;
  const showDayHeaders = (config.showDayHeaders as boolean) ?? true;

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (isBuilder) return;
    const interval = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(interval);
  }, [isBuilder]);

  // Generate array of days
  const days = useMemo(() => {
    const firstDay = startDay === "weekStart"
      ? startOfWeek(now, { weekStartsOn: 1 })
      : startOfDay(now);
    return Array.from({ length: numberOfDays }, (_, i) => addDays(firstDay, i));
  }, [now, numberOfDays, startDay]);

  // Calculate schedule boundaries based on view mode
  const { scheduleStartOffset, totalMinutes } = useMemo(() => {
    if (viewMode === "rolling") {
      return {
        scheduleStartOffset: null, // rolling uses per-minute calculation
        totalMinutes: rollingDurationHours * 60,
      };
    }
    return {
      scheduleStartOffset: fixedStartHour,
      totalMinutes: (fixedEndHour - fixedStartHour + 1) * 60,
    };
  }, [viewMode, fixedStartHour, fixedEndHour, rollingDurationHours]);

  // Get schedule start/end times for a specific day
  const getScheduleBounds = (day: Date) => {
    if (viewMode === "rolling") {
      const start = subMinutes(now, rollingOffsetMinutes);
      const end = addHours(start, rollingDurationHours);
      return { start, end };
    }
    const start = new Date(day);
    start.setHours(fixedStartHour, 0, 0, 0);
    const end = new Date(day);
    end.setHours(fixedEndHour + 1, 0, 0, 0);
    return { start, end };
  };

  // Calculate hour labels
  const hourLabels = useMemo(() => {
    const labels: { hour: number; position: number }[] = [];

    if (viewMode === "rolling") {
      const rollingStart = subMinutes(now, rollingOffsetMinutes);
      const startMinutes = rollingStart.getHours() * 60 + rollingStart.getMinutes();
      const firstFullHour = Math.ceil(startMinutes / 60);

      for (let h = firstFullHour; h < firstFullHour + rollingDurationHours + 1; h++) {
        const hourTime = new Date(rollingStart);
        hourTime.setHours(h % 24, 0, 0, 0);
        if (h >= 24) hourTime.setDate(hourTime.getDate() + 1);

        const minutesFromStart = differenceInMinutes(hourTime, rollingStart);
        if (minutesFromStart >= 0 && minutesFromStart <= totalMinutes) {
          const position = (minutesFromStart / totalMinutes) * 100;
          labels.push({ hour: h % 24, position });
        }
      }
    } else {
      for (let h = fixedStartHour; h <= fixedEndHour; h++) {
        const position = ((h - fixedStartHour) / (fixedEndHour - fixedStartHour + 1)) * 100;
        labels.push({ hour: h, position });
      }
    }

    return labels;
  }, [viewMode, now, totalMinutes, fixedStartHour, fixedEndHour, rollingOffsetMinutes, rollingDurationHours]);

  const { preset, isCustom, customValue } = getFontSizeConfig(style);
  const sizeClasses = isCustom ? null : FONT_SIZE_CLASSES[preset as Exclude<FontSizePreset, "custom">];

  const getCustomFontSize = (scale: number) => {
    if (!customValue) return undefined;
    const value = parseFloat(customValue);
    const unit = customValue.replace(/[\d.]/g, "") || "px";
    return `${value * scale}${unit}`;
  };

  // Fetch calendars
  const { data: calendars = [] } = useQuery({
    queryKey: ["widget-calendars"],
    queryFn: () => api.getCalendars(),
    staleTime: 5 * 60 * 1000,
    enabled: !isBuilder,
  });

  // Determine which calendar IDs to use
  const activeCalendarIds = useMemo(() => {
    if (configCalendarIds.length > 0) return configCalendarIds;
    const screensaverVisible = calendars.filter(
      (cal: Calendar) => cal.isVisible && cal.visibility?.screensaver
    );
    if (screensaverVisible.length > 0) {
      return screensaverVisible.map((cal: Calendar) => cal.id);
    }
    const favorites = calendars.filter(
      (cal: Calendar) => cal.isVisible && cal.isFavorite
    );
    if (favorites.length > 0) {
      return favorites.map((cal: Calendar) => cal.id);
    }
    return calendars.filter((cal: Calendar) => cal.isVisible).map((cal: Calendar) => cal.id);
  }, [calendars, configCalendarIds]);

  // Fetch events for the entire date range
  const rangeStart = days[0] ? startOfDay(days[0]) : startOfDay(now);
  const rangeEnd = days[days.length - 1] ? endOfDay(days[days.length - 1]!) : endOfDay(now);

  const { data: events = [], isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["week-schedule-events", activeCalendarIds, rangeStart.toISOString(), rangeEnd.toISOString()],
    queryFn: async () => {
      if (activeCalendarIds.length === 0) return [];
      return api.getEvents(rangeStart, rangeEnd, activeCalendarIds);
    },
    enabled: !isBuilder && activeCalendarIds.length > 0,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: true,
  });
  const { isStale, ageLabel } = useDataFreshness(dataUpdatedAt, STALE_THRESHOLDS.weekSchedule);

  // Group all-day and multi-day events by day (rendered as banners at top)
  const allDayEventsByDay = useMemo(() => {
    if (!showAllDayEvents) return new Map<string, CalendarEvent[]>();

    const map = new Map<string, CalendarEvent[]>();
    const bannerEvents = events.filter((e: CalendarEvent) => isBannerEvent(e));

    for (const day of days) {
      const key = format(day, "yyyy-MM-dd");
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);

      const dayEvents = bannerEvents.filter((event: CalendarEvent) => {
        const eStart = event.isAllDay ? getEventStartDate(event) : new Date(event.startTime);
        const eEnd = event.isAllDay ? getEventEndDate(event) : new Date(event.endTime);
        return eStart < dayEnd && eEnd > dayStart;
      });

      const seen = new Set<string>();
      const dedupedEvents = dayEvents.filter((event: CalendarEvent) => {
        const dedupKey = `${event.title?.toLowerCase().trim()}|${format(day, "yyyy-MM-dd")}`;
        if (seen.has(dedupKey)) return false;
        seen.add(dedupKey);
        return true;
      });

      map.set(key, dedupedEvents);
    }

    return map;
  }, [events, days, showAllDayEvents]);

  // Process timed events per day with overlap handling
  const processedEventsByDay = useMemo(() => {
    const map = new Map<string, Array<{
      id: string;
      title: string;
      top: number;
      height: number;
      endPosition: number;
      color: string;
      column: number;
      totalColumns: number;
    }>>();

    const timedEvents = events.filter((e: CalendarEvent) => !isBannerEvent(e));

    for (const day of days) {
      const key = format(day, "yyyy-MM-dd");
      const { start: scheduleStart, end: scheduleEnd } = getScheduleBounds(day);

      const baseEvents = timedEvents
        .map((event: CalendarEvent) => {
          const eventStart = new Date(event.startTime);
          const eventEnd = new Date(event.endTime);

          const clampedStart = eventStart < scheduleStart ? scheduleStart : eventStart;
          const clampedEnd = eventEnd > scheduleEnd ? scheduleEnd : eventEnd;

          if (clampedStart >= scheduleEnd || clampedEnd <= scheduleStart) return null;

          // For fixed mode, also check that the event falls on this day
          if (viewMode === "fixed") {
            if (!isSameDay(eventStart, day) && !isSameDay(eventEnd, day) &&
                !(eventStart < startOfDay(day) && eventEnd > endOfDay(day))) {
              return null;
            }
          }

          const startOffset = differenceInMinutes(clampedStart, scheduleStart);
          const duration = differenceInMinutes(clampedEnd, clampedStart);

          const top = (startOffset / totalMinutes) * 100;
          const height = Math.max(2, (duration / totalMinutes) * 100);
          const endPosition = top + height;

          const calendar = calendars.find((c: Calendar) => c.id === event.calendarId);

          return {
            id: `${event.id}-${key}`,
            title: event.title,
            top,
            height,
            endPosition,
            color: calendar?.color ?? "#3B82F6",
            column: 0,
            totalColumns: 1,
          };
        })
        .filter((e): e is NonNullable<typeof e> => e !== null && e.height > 0)
        .sort((a, b) => a.top - b.top);

      // Column assignment for overlapping events
      const columns: { endPosition: number }[] = [];
      for (const event of baseEvents) {
        let columnIndex = columns.findIndex((col) => col.endPosition <= event.top);
        if (columnIndex === -1) {
          columnIndex = columns.length;
          columns.push({ endPosition: event.endPosition });
        } else {
          columns[columnIndex] = { endPosition: event.endPosition };
        }
        event.column = columnIndex;
      }

      for (const event of baseEvents) {
        const overlapping = baseEvents.filter(
          (other) => other.top < event.endPosition && other.endPosition > event.top
        );
        const maxColumn = Math.max(...overlapping.map((e) => e.column));
        event.totalColumns = maxColumn + 1;
      }

      for (const event of baseEvents) {
        const overlapping = baseEvents.filter(
          (other) => other.top < event.endPosition && other.endPosition > event.top
        );
        const maxTotalColumns = Math.max(...overlapping.map((e) => e.totalColumns));
        for (const o of overlapping) {
          o.totalColumns = maxTotalColumns;
        }
      }

      map.set(key, baseEvents);
    }

    return map;
  }, [events, days, calendars, viewMode, totalMinutes, now, fixedStartHour, fixedEndHour, rollingOffsetMinutes, rollingDurationHours]);

  // Current time position per day
  const getCurrentTimePosition = (day: Date) => {
    const { start: scheduleStart } = getScheduleBounds(day);
    const minutesFromStart = differenceInMinutes(now, scheduleStart);
    return Math.max(0, Math.min(100, (minutesFromStart / totalMinutes) * 100));
  };

  // Mock data for builder
  const mockDays = Array.from({ length: numberOfDays }, (_, i) => addDays(new Date(), i));
  const mockEventsByDay = new Map<string, Array<{
    id: string; title: string; top: number; height: number;
    endPosition: number; color: string; column: number; totalColumns: number;
  }>>();

  if (isBuilder) {
    const mockSets = [
      [
        { id: "m1", title: "Standup", top: 8, height: 6, color: "#3B82F6", column: 0, totalColumns: 1, endPosition: 14 },
        { id: "m2", title: "Design Review", top: 35, height: 12, color: "#10B981", column: 0, totalColumns: 1, endPosition: 47 },
      ],
      [
        { id: "m3", title: "Sprint Planning", top: 15, height: 15, color: "#8B5CF6", column: 0, totalColumns: 2, endPosition: 30 },
        { id: "m4", title: "1:1", top: 18, height: 8, color: "#F59E0B", column: 1, totalColumns: 2, endPosition: 26 },
        { id: "m5", title: "Lunch", top: 50, height: 8, color: "#6B7280", column: 0, totalColumns: 1, endPosition: 58 },
      ],
      [
        { id: "m6", title: "Workshop", top: 20, height: 20, color: "#EC4899", column: 0, totalColumns: 1, endPosition: 40 },
      ],
      [
        { id: "m7", title: "Demo", top: 45, height: 10, color: "#14B8A6", column: 0, totalColumns: 1, endPosition: 55 },
        { id: "m8", title: "Retro", top: 65, height: 8, color: "#F97316", column: 0, totalColumns: 1, endPosition: 73 },
      ],
      [
        { id: "m9", title: "Focus Time", top: 10, height: 25, color: "#6366F1", column: 0, totalColumns: 1, endPosition: 35 },
      ],
    ];

    mockDays.forEach((day, i) => {
      const key = format(day, "yyyy-MM-dd");
      mockEventsByDay.set(key, mockSets[i % mockSets.length] ?? []);
    });
  }

  // hasAllDayEvents check (must be before any early returns to keep hook count stable)
  const hasAllDayEvents = showAllDayEvents && Array.from(allDayEventsByDay.values()).some((arr) => arr.length > 0);

  // Max all-day event count across days (for uniform column height)
  const maxAllDayCount = useMemo(() => {
    if (!hasAllDayEvents) return 0;
    let max = 0;
    for (const events of allDayEventsByDay.values()) {
      max = Math.max(max, events.length);
    }
    return max;
  }, [hasAllDayEvents, allDayEventsByDay]);

  const displayDays = isBuilder ? mockDays : days;
  const displayEventsByDay = isBuilder ? mockEventsByDay : processedEventsByDay;

  if (!isBuilder && isLoading) {
    return (
      <div
        className="flex h-full items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <span className="text-sm opacity-50">Loading schedule...</span>
      </div>
    );
  }

  // Builder preview
  if (isBuilder) {
    return (
      <div
        className={cn(
          "flex h-full flex-col p-2 rounded-lg overflow-hidden",
          "bg-black/40 backdrop-blur-sm"
        )}
        style={{ color: style?.textColor || "#ffffff" }}
      >
        {/* Day headers */}
        {showDayHeaders && (
          <div className="flex mb-1">
            {showHourLabels && (
              <div className="flex-shrink-0 flex items-center justify-center" style={{ width: "2rem" }}>
                <span className={cn(sizeClasses?.header || "text-[10px]", "font-medium opacity-50")}>
                  {format(now, "MMM")}
                </span>
              </div>
            )}
            {displayDays.map((day) => {
              const isToday = isSameDay(day, now);
              return (
                <div key={day.toISOString()} className="flex-1 text-center">
                  <div className={cn(sizeClasses?.header || "text-[10px]", "font-medium flex items-center justify-center gap-0.5", isToday ? "opacity-100" : "opacity-70")}>
                    <span>{format(day, "EEE")}</span>
                    <span className={cn(isToday && "bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px]")}>
                      {format(day, "d")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Time grid */}
        <div className="flex flex-1 min-h-0">
          {/* Hour labels */}
          {showHourLabels && (
            <div className="relative flex-shrink-0" style={{ width: "2rem" }}>
              {hourLabels.map(({ hour, position }) => (
                <div
                  key={`label-${hour}-${position}`}
                  className={cn(sizeClasses?.hour || "text-[9px]", "absolute opacity-50 tabular-nums whitespace-nowrap")}
                  style={{ top: `${position}%`, transform: "translateY(-50%)" }}
                >
                  {format(new Date().setHours(hour, 0), "ha")}
                </div>
              ))}
            </div>
          )}

          {/* Day columns */}
          {displayDays.map((day, dayIdx) => {
            const key = format(day, "yyyy-MM-dd");
            const dayEvents = displayEventsByDay.get(key) ?? [];

            return (
              <div
                key={key}
                className={cn(
                  "flex-1 relative",
                  dayIdx > 0 && "border-l border-white/10"
                )}
              >
                {/* Hour grid lines */}
                {hourLabels.map(({ hour, position }) => (
                  <div
                    key={`line-${hour}-${position}`}
                    className="absolute w-full border-t border-white/5"
                    style={{ top: `${position}%` }}
                  />
                ))}

                {/* Events */}
                {dayEvents.map((event) => {
                  const columnWidth = 100 / event.totalColumns;
                  const leftPosition = event.column * columnWidth;

                  return (
                    <div
                      key={event.id}
                      className="absolute rounded px-0.5 py-0.5 overflow-hidden border-l-2"
                      style={{
                        top: `${event.top}%`,
                        height: `${event.height}%`,
                        left: `calc(${leftPosition}% + 2px)`,
                        width: `calc(${columnWidth}% - 4px)`,
                        backgroundColor: `${event.color}30`,
                        borderColor: event.color,
                      }}
                    >
                      <span className={cn(sizeClasses?.event || "text-[10px]", "line-clamp-2 font-medium leading-tight")}>
                        {event.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex h-full flex-col p-2 rounded-lg overflow-hidden",
        "bg-black/40 backdrop-blur-sm"
      )}
      style={{ color: style?.textColor || "#ffffff" }}
    >
      {isStale && <StaleDataOverlay ageLabel={ageLabel} textColor={style?.textColor} />}
      {/* Day headers */}
      {showDayHeaders && (
        <div className="flex flex-shrink-0">
          {showHourLabels && (
            <div className="flex-shrink-0 flex items-center justify-center" style={{ width: "2rem" }}>
              <span
                className={cn(sizeClasses?.header || "text-[10px]", "font-medium opacity-50")}
                style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.header) } : undefined}
              >
                {format(now, "MMM")}
              </span>
            </div>
          )}
          {displayDays.map((day) => {
            const isToday = isSameDay(day, now);
            return (
              <div key={day.toISOString()} className="flex-1 text-center py-0.5">
                <div
                  className={cn(
                    sizeClasses?.header || "text-[10px]",
                    "font-medium flex items-center justify-center gap-0.5",
                    isToday ? "opacity-100" : "opacity-70"
                  )}
                  style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.header) } : undefined}
                >
                  <span>{format(day, "EEE")}</span>
                  <span className={cn(isToday && "bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px]")}>
                    {format(day, "d")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Time grid area */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Hour labels gutter */}
        {showHourLabels && (
          <div className="flex flex-col flex-shrink-0" style={{ width: "2rem" }}>
            {/* All-day spacer to align with day columns */}
            {hasAllDayEvents && (
              <div
                className="flex-shrink-0 border-b border-white/10"
                style={{ height: `${maxAllDayCount * 20}px` }}
              />
            )}
            <div className="relative flex-1">
              {hourLabels.map(({ hour, position }) => (
                <div
                  key={`label-${hour}-${position}`}
                  className={cn(sizeClasses?.hour || "text-[9px]", "absolute opacity-50 tabular-nums whitespace-nowrap")}
                  style={{
                    top: `${position}%`,
                    transform: "translateY(-50%)",
                    ...(isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.hour) } : {}),
                  }}
                >
                  {format(new Date().setHours(hour, 0), "ha")}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Day columns */}
        {displayDays.map((day, dayIdx) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = displayEventsByDay.get(key) ?? [];
          const dayAllDay = hasAllDayEvents ? (allDayEventsByDay.get(key) ?? []) : [];
          const isToday = isSameDay(day, now);
          const timePos = getCurrentTimePosition(day);
          const showMarker = showCurrentTime && isToday && timePos >= 0 && timePos <= 100;

          return (
            <div
              key={key}
              className={cn(
                "flex-1 flex flex-col min-w-0",
                dayIdx > 0 && "border-l border-white/10"
              )}
            >
              {/* All-day events at top of day */}
              {hasAllDayEvents && (
                <div
                  className="flex-shrink-0 px-0.5 space-y-0.5 overflow-hidden border-b border-white/10"
                  style={{ height: `${maxAllDayCount * 20}px` }}
                >
                  {dayAllDay.map((event: CalendarEvent) => {
                    const calendar = calendars.find((c: Calendar) => c.id === event.calendarId);
                    const color = calendar?.color ?? "#3B82F6";
                    return (
                      <div
                        key={event.id}
                        className="rounded px-1 py-0.5 overflow-hidden"
                        style={{
                          backgroundColor: `${color}30`,
                          borderLeft: `2px solid ${color}`,
                        }}
                      >
                        <span
                          className={cn(sizeClasses?.event || "text-[10px]", "block truncate font-medium leading-tight")}
                          style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.event) } : undefined}
                        >
                          {event.title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Time grid */}
              <div className="flex-1 relative">
                {/* Hour grid lines */}
                {hourLabels.map(({ hour, position }) => (
                  <div
                    key={`line-${hour}-${position}`}
                    className="absolute w-full border-t border-white/5"
                    style={{ top: `${position}%` }}
                  />
                ))}

                {/* Events */}
                {dayEvents.map((event) => {
                  const columnWidth = 100 / event.totalColumns;
                  const leftPosition = event.column * columnWidth;

                  return (
                    <div
                      key={event.id}
                      className="absolute rounded px-0.5 py-0.5 overflow-hidden border-l-2"
                      style={{
                        top: `${event.top}%`,
                        height: `${event.height}%`,
                        left: `calc(${leftPosition}% + 2px)`,
                        width: `calc(${columnWidth}% - 4px)`,
                        backgroundColor: `${event.color}30`,
                        borderColor: event.color,
                      }}
                    >
                      <span
                        className={cn(sizeClasses?.event || "text-[10px]", "line-clamp-2 font-medium leading-tight")}
                        style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.event) } : undefined}
                      >
                        {event.title}
                      </span>
                    </div>
                  );
                })}

              </div>
            </div>
          );
        })}

        {/* Current time indicator - spans full width with time label */}
        {(() => {
          const todayIdx = displayDays.findIndex((d) => isSameDay(d, now));
          if (todayIdx === -1 || !showCurrentTime) return null;
          const timePos = getCurrentTimePosition(displayDays[todayIdx]!);
          if (timePos < 0 || timePos > 100) return null;

          // Calculate top offset to account for all-day events section
          const allDayOffset = hasAllDayEvents ? maxAllDayCount * 20 : 0;

          return (
            <div
              className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
              style={{
                top: `calc(${allDayOffset}px + (100% - ${allDayOffset}px) * ${timePos / 100})`,
              }}
            >
              {showHourLabels && (
                <div className="flex-shrink-0 flex items-center justify-end pr-0.5" style={{ width: "2rem" }}>
                  <span className="bg-red-500 text-white font-bold px-0.5 rounded text-[7px] leading-none py-0.5">
                    {format(now, "HH:mm")}
                  </span>
                </div>
              )}
              <div className="flex-1 h-0.5 bg-red-500" />
            </div>
          );
        })()}
      </div>
    </div>
  );
}
