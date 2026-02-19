import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, endOfDay, differenceInMinutes, subMinutes, addHours } from "date-fns";
import { api } from "../../services/api";
import type { WidgetStyle, FontSizePreset } from "../../stores/screensaver";
import { getFontSizeConfig } from "../../lib/font-size";
import type { CalendarEvent, Calendar } from "@openframe/shared";
import { cn } from "../../lib/utils";
import { useDataFreshness } from "../../hooks/useDataFreshness";
import { STALE_THRESHOLDS } from "../../lib/stale-thresholds";
import { StaleDataOverlay } from "./StaleDataOverlay";

interface DayScheduleWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
  widgetId?: string;
}

const FONT_SIZE_CLASSES: Record<Exclude<FontSizePreset, "custom">, { hour: string; event: string }> = {
  xs: { hour: "text-[8px]", event: "text-[9px]" },
  sm: { hour: "text-[9px]", event: "text-[10px]" },
  md: { hour: "text-[10px]", event: "text-xs" },
  lg: { hour: "text-xs", event: "text-sm" },
  xl: { hour: "text-sm", event: "text-base" },
};

const CUSTOM_SCALE = {
  hour: 0.75,
  event: 1,
};

export function DayScheduleWidget({ config, style, isBuilder }: DayScheduleWidgetProps) {
  const configCalendarIds = (config.calendarIds as string[]) ?? [];
  const viewMode = (config.viewMode as string) ?? "fixed";
  const fixedStartHour = (config.startHour as number) ?? 6;
  const fixedEndHour = (config.endHour as number) ?? 22;
  const rollingOffsetMinutes = (config.rollingOffsetMinutes as number) ?? 60;
  const rollingDurationHours = (config.rollingDurationHours as number) ?? 8;
  const showCurrentTime = (config.showCurrentTime as boolean) ?? true;
  const showHourLabels = (config.showHourLabels as boolean) ?? true;

  // Track current time for rolling mode (updates every minute)
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (viewMode !== "rolling" || isBuilder) return;

    const interval = setInterval(() => {
      setNow(new Date());
    }, 60 * 1000); // Update every minute

    return () => clearInterval(interval);
  }, [viewMode, isBuilder]);

  // Calculate schedule boundaries based on view mode
  const { scheduleStart, scheduleEnd, totalMinutes } = useMemo(() => {
    if (viewMode === "rolling") {
      const start = subMinutes(now, rollingOffsetMinutes);
      const end = addHours(start, rollingDurationHours);
      return {
        scheduleStart: start,
        scheduleEnd: end,
        totalMinutes: rollingDurationHours * 60,
      };
    } else {
      const start = new Date(now);
      start.setHours(fixedStartHour, 0, 0, 0);
      const end = new Date(now);
      end.setHours(fixedEndHour + 1, 0, 0, 0);
      return {
        scheduleStart: start,
        scheduleEnd: end,
        totalMinutes: (fixedEndHour - fixedStartHour + 1) * 60,
      };
    }
  }, [viewMode, now, fixedStartHour, fixedEndHour, rollingOffsetMinutes, rollingDurationHours]);

  // Calculate hour labels for display
  const hourLabels = useMemo(() => {
    const labels: { hour: number; position: number }[] = [];

    if (viewMode === "rolling") {
      // For rolling mode, show hour markers that fall within the visible range
      const startMinutes = scheduleStart.getHours() * 60 + scheduleStart.getMinutes();
      const firstFullHour = Math.ceil(startMinutes / 60);

      for (let h = firstFullHour; h < firstFullHour + rollingDurationHours + 1; h++) {
        const hourTime = new Date(scheduleStart);
        hourTime.setHours(h % 24, 0, 0, 0);
        if (h >= 24) hourTime.setDate(hourTime.getDate() + 1);

        const minutesFromStart = differenceInMinutes(hourTime, scheduleStart);
        if (minutesFromStart >= 0 && minutesFromStart <= totalMinutes) {
          const position = (minutesFromStart / totalMinutes) * 100;
          labels.push({ hour: h % 24, position });
        }
      }
    } else {
      // For fixed mode, show each hour
      for (let h = fixedStartHour; h <= fixedEndHour; h++) {
        const position = ((h - fixedStartHour) / (fixedEndHour - fixedStartHour + 1)) * 100;
        labels.push({ hour: h, position });
      }
    }

    return labels;
  }, [viewMode, scheduleStart, totalMinutes, fixedStartHour, fixedEndHour, rollingDurationHours]);

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

  // Fetch today's events
  const { data: events = [], isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["day-schedule-events", activeCalendarIds],
    queryFn: async () => {
      if (activeCalendarIds.length === 0) return [];
      const today = new Date();
      return api.getEvents(startOfDay(today), endOfDay(today), activeCalendarIds);
    },
    enabled: !isBuilder && activeCalendarIds.length > 0,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });
  const { isStale, ageLabel } = useDataFreshness(dataUpdatedAt, STALE_THRESHOLDS.daySchedule);

  // Calculate current time position
  const currentTimePosition = useMemo(() => {
    const minutesFromStart = differenceInMinutes(now, scheduleStart);
    return Math.max(0, Math.min(100, (minutesFromStart / totalMinutes) * 100));
  }, [now, scheduleStart, totalMinutes]);

  const showCurrentTimeMarker = showCurrentTime && currentTimePosition >= 0 && currentTimePosition <= 100;

  // Process events for display with overlap handling
  const processedEvents = useMemo(() => {
    // First pass: calculate basic positioning
    const baseEvents = events
      .filter((event: CalendarEvent) => !event.isAllDay)
      .map((event: CalendarEvent) => {
        const eventStart = new Date(event.startTime);
        const eventEnd = new Date(event.endTime);

        // Clamp to schedule boundaries
        const clampedStart = eventStart < scheduleStart ? scheduleStart : eventStart;
        const clampedEnd = eventEnd > scheduleEnd ? scheduleEnd : eventEnd;

        // Skip if event is completely outside the visible range
        if (clampedStart >= scheduleEnd || clampedEnd <= scheduleStart) {
          return null;
        }

        const startOffset = differenceInMinutes(clampedStart, scheduleStart);
        const duration = differenceInMinutes(clampedEnd, clampedStart);

        const top = (startOffset / totalMinutes) * 100;
        const height = Math.max(2, (duration / totalMinutes) * 100);
        const endPosition = top + height;

        const calendar = calendars.find((c: Calendar) => c.id === event.calendarId);

        return {
          ...event,
          top,
          height,
          endPosition,
          color: calendar?.color ?? "#3B82F6",
          column: 0,
          totalColumns: 1,
        };
      })
      .filter((event): event is NonNullable<typeof event> => event !== null && event.height > 0)
      .sort((a, b) => a.top - b.top); // Sort by start position

    // Second pass: calculate columns for overlapping events
    // Track which columns are occupied at each event's time slot
    const columns: { endPosition: number }[] = [];

    for (const event of baseEvents) {
      // Find first available column (one that ends before this event starts)
      let columnIndex = columns.findIndex(col => col.endPosition <= event.top);

      if (columnIndex === -1) {
        // No available column, create a new one
        columnIndex = columns.length;
        columns.push({ endPosition: event.endPosition });
      } else {
        // Use this column and update its end position
        columns[columnIndex] = { endPosition: event.endPosition };
      }

      event.column = columnIndex;
    }

    // Third pass: determine total columns for each overlapping group
    // For each event, find all events it overlaps with and get the max column + 1
    for (const event of baseEvents) {
      const overlappingEvents = baseEvents.filter(other =>
        other.top < event.endPosition && other.endPosition > event.top
      );
      const maxColumn = Math.max(...overlappingEvents.map(e => e.column));
      event.totalColumns = maxColumn + 1;
    }

    // Ensure all overlapping events have the same totalColumns
    for (const event of baseEvents) {
      const overlappingEvents = baseEvents.filter(other =>
        other.top < event.endPosition && other.endPosition > event.top
      );
      const maxTotalColumns = Math.max(...overlappingEvents.map(e => e.totalColumns));
      for (const overlapping of overlappingEvents) {
        overlapping.totalColumns = maxTotalColumns;
      }
    }

    return baseEvents;
  }, [events, calendars, scheduleStart, scheduleEnd, totalMinutes]);

  // Mock data for builder (with column info)
  const mockEvents = [
    { id: "1", title: "Team Standup", top: 10, height: 8, color: "#3B82F6", column: 0, totalColumns: 1, endPosition: 18 },
    { id: "2", title: "Design Review", top: 30, height: 15, color: "#10B981", column: 0, totalColumns: 2, endPosition: 45 },
    { id: "3", title: "1:1 Meeting", top: 32, height: 10, color: "#8B5CF6", column: 1, totalColumns: 2, endPosition: 42 },
    { id: "4", title: "Lunch", top: 55, height: 10, color: "#F59E0B", column: 0, totalColumns: 1, endPosition: 65 },
  ];

  const displayEvents = isBuilder ? mockEvents : processedEvents;

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

  return (
    <div
      className={cn(
        "relative flex h-full flex-row p-3 rounded-lg overflow-hidden",
        "bg-black/40 backdrop-blur-sm"
      )}
      style={{ color: style?.textColor || "#ffffff" }}
    >
      {isStale && <StaleDataOverlay ageLabel={ageLabel} textColor={style?.textColor} />}
      {/* Hour labels */}
      {showHourLabels && (
        <div className="relative pr-2 flex-shrink-0" style={{ width: "2.5rem" }}>
          {hourLabels.map(({ hour, position }) => (
            <div
              key={`label-${hour}-${position}`}
              className={cn(sizeClasses?.hour, "absolute opacity-50 tabular-nums whitespace-nowrap")}
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
      )}

      {/* Timeline */}
      <div className="flex-1 relative border-l border-white/20">
        {/* Hour grid lines */}
        {hourLabels.map(({ hour, position }) => (
          <div
            key={`line-${hour}-${position}`}
            className="absolute w-full border-t border-white/10"
            style={{ top: `${position}%` }}
          />
        ))}

        {/* Events */}
        {displayEvents.map((event) => {
          const columnWidth = 100 / event.totalColumns;
          const leftPosition = event.column * columnWidth;

          return (
            <div
              key={event.id}
              className={cn(
                "absolute rounded px-1.5 py-0.5 overflow-hidden",
                "border-l-2"
              )}
              style={{
                top: `${event.top}%`,
                height: `${event.height}%`,
                left: `calc(${leftPosition}% + 4px)`,
                width: `calc(${columnWidth}% - 8px)`,
                backgroundColor: `${event.color}30`,
                borderColor: event.color,
              }}
            >
              <span
                className={cn(sizeClasses?.event, "line-clamp-2 font-medium")}
                style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.event) } : undefined}
              >
                {event.title}
              </span>
            </div>
          );
        })}

        {/* Current time marker */}
        {showCurrentTimeMarker && !isBuilder && (
          <div
            className="absolute left-0 right-0 flex items-center z-10"
            style={{ top: `${currentTimePosition}%` }}
          >
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <div className="flex-1 h-0.5 bg-red-500" />
          </div>
        )}
      </div>
    </div>
  );
}
