import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, isToday, isTomorrow } from "date-fns";
import { api } from "../../services/api";
import type { WidgetStyle, FontSizePreset } from "../../stores/screensaver";
import { getFontSizeConfig } from "../../lib/font-size";
import type { CalendarEvent, Calendar } from "@openframe/shared";
import { cn } from "../../lib/utils";
import { useDataFreshness } from "../../hooks/useDataFreshness";
import { STALE_THRESHOLDS } from "../../lib/stale-thresholds";
import { StaleDataOverlay } from "./StaleDataOverlay";

interface CalendarWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
  widgetId?: string;
}

const FONT_SIZE_CLASSES: Record<Exclude<FontSizePreset, "custom">, { title: string; item: string; label: string }> = {
  xs: { title: "text-[10px]", item: "text-[10px]", label: "text-[8px]" },
  sm: { title: "text-xs", item: "text-xs", label: "text-[10px]" },
  md: { title: "text-sm", item: "text-sm", label: "text-xs" },
  lg: { title: "text-base", item: "text-base", label: "text-sm" },
  xl: { title: "text-lg", item: "text-lg", label: "text-base" },
};

// Scale factors for custom font sizes
const CUSTOM_SCALE = {
  title: 1,
  item: 1,
  label: 0.75,
};

export function CalendarWidget({ config, style, isBuilder }: CalendarWidgetProps) {
  const maxItems = config.maxItems as number ?? 5;
  const showTime = config.showTime as boolean ?? true;
  const showCalendarName = config.showCalendarName as boolean ?? false;
  const configCalendarIds = config.calendarIds as string[] ?? [];
  const showUpcomingOnly = config.showUpcomingOnly as boolean ?? true;
  const hideBlankEvents = config.hideBlankEvents as boolean ?? false;
  const hideDuplicates = config.hideDuplicates as boolean ?? false;
  const headerMode = config.headerMode as string ?? "default";
  const customHeader = config.customHeader as string ?? "";

  // Determine header text based on mode
  const getHeaderText = () => {
    if (headerMode === "hidden") return null;
    if (headerMode === "custom") return customHeader || null;
    return showUpcomingOnly ? "Upcoming Events" : "Events";
  };
  const headerText = getHeaderText();

  const { data: calendars = [] } = useQuery({
    queryKey: ["widget-calendars"],
    queryFn: () => api.getCalendars(),
    staleTime: 5 * 60 * 1000,
    enabled: !isBuilder,
  });

  // Use config calendar IDs if specified, otherwise fall back to visible calendars
  const activeCalendarIds = useMemo(() => {
    if (configCalendarIds.length > 0) {
      return configCalendarIds;
    }
    // Fall back to: 1) screensaver-visible calendars, 2) favorite calendars, 3) all visible calendars
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
    // Ultimate fallback: all visible calendars
    return calendars
      .filter((cal: Calendar) => cal.isVisible)
      .map((cal: Calendar) => cal.id);
  }, [calendars, configCalendarIds]);

  const { data: events = [], isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["widget-events", activeCalendarIds],
    queryFn: async () => {
      if (activeCalendarIds.length === 0) return [];
      const today = new Date();
      const start = new Date(today);
      start.setHours(0, 0, 0, 0);
      const end = new Date(today);
      end.setDate(end.getDate() + 7);
      end.setHours(23, 59, 59, 999);
      return api.getEvents(start, end, activeCalendarIds);
    },
    enabled: !isBuilder && activeCalendarIds.length > 0,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 60 * 1000, // Refresh every minute
    refetchIntervalInBackground: true,
  });
  const { isStale, ageLabel } = useDataFreshness(dataUpdatedAt, STALE_THRESHOLDS.calendar);

  const filteredEvents = useMemo(() => {
    const now = new Date();
    let filtered = [...events].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    // Filter to upcoming only if enabled
    if (showUpcomingOnly) {
      filtered = filtered.filter((event) => new Date(event.endTime) > now);
    }

    // Filter out blank/empty events if enabled
    if (hideBlankEvents) {
      filtered = filtered.filter((event) => event.title && event.title.trim() !== "");
    }

    // Filter out duplicates (same title and start time) if enabled
    if (hideDuplicates) {
      const seen = new Set<string>();
      filtered = filtered.filter((event) => {
        // Create a key based on title and start time to identify duplicates
        const key = `${event.title?.toLowerCase().trim()}|${event.startTime}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
    }

    return filtered.slice(0, maxItems);
  }, [events, maxItems, showUpcomingOnly, hideBlankEvents, hideDuplicates]);

  const { preset, isCustom, customValue } = getFontSizeConfig(style);
  const sizeClasses = isCustom ? null : FONT_SIZE_CLASSES[preset as Exclude<FontSizePreset, "custom">];

  // Calculate custom font sizes if using custom mode
  const getCustomFontSize = (scale: number) => {
    if (!customValue) return undefined;
    const value = parseFloat(customValue);
    const unit = customValue.replace(/[\d.]/g, "") || "px";
    return `${value * scale}${unit}`;
  };

  // Mock data for builder preview
  const mockEvents = [
    { id: "1", title: "Team Meeting", time: "9:00 AM", color: "#3B82F6" },
    { id: "2", title: "Lunch with Client", time: "12:30 PM", color: "#10B981" },
    { id: "3", title: "Project Review", time: "3:00 PM", color: "#8B5CF6" },
  ];

  if (isBuilder) {
    return (
      <div
        className={cn(
          "flex h-full flex-col p-4 rounded-lg",
          "bg-black/40 backdrop-blur-sm"
        )}
        style={{ color: style?.textColor || "#ffffff" }}
      >
        {headerText && (
          <div
            className={cn(sizeClasses?.label, "opacity-50 uppercase tracking-wide mb-3")}
            style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.label) } : undefined}
          >
            {headerText}
          </div>
        )}
        <div className="flex-1 space-y-2 overflow-hidden">
          {mockEvents.slice(0, maxItems).map((event) => (
            <div key={event.id} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: event.color }}
              />
              <span
                className={cn(sizeClasses?.item, "truncate flex-1")}
                style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.item) } : undefined}
              >
                {event.title}
              </span>
              {showTime && (
                <span
                  className={cn(sizeClasses?.item, "opacity-60 flex-shrink-0")}
                  style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.item) } : undefined}
                >
                  {event.time}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className="flex h-full items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <span className="text-sm opacity-50">Loading events...</span>
      </div>
    );
  }

  if (filteredEvents.length === 0) {
    return (
      <div
        className="flex h-full items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <span className="text-sm opacity-50">{showUpcomingOnly ? "No upcoming events" : "No events"}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex h-full flex-col p-4 rounded-lg",
        "bg-black/40 backdrop-blur-sm"
      )}
      style={{ color: style?.textColor || "#ffffff" }}
    >
      {isStale && <StaleDataOverlay ageLabel={ageLabel} textColor={style?.textColor} />}
      {headerText && (
        <div
          className={cn(sizeClasses?.label, "opacity-50 uppercase tracking-wide mb-3")}
          style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.label) } : undefined}
        >
          {headerText}
        </div>
      )}
      <div className="flex-1 space-y-2 overflow-hidden">
        {filteredEvents.map((event: CalendarEvent) => {
          const startTime = new Date(event.startTime);
          const endTime = new Date(event.endTime);
          const calendar = calendars.find((c: Calendar) => c.id === event.calendarId);
          const now = new Date();

          // For multi-day events, check if the event is ongoing today
          // (started before today but hasn't ended yet)
          const startsToday = isToday(startTime);
          const startsTomorrow = isTomorrow(startTime);
          const isOngoingToday = !startsToday && startTime < now && endTime > now;

          // Treat ongoing multi-day events as "today"
          const eventIsToday = startsToday || isOngoingToday;
          const eventIsTomorrow = startsTomorrow && !isOngoingToday;

          let timeDisplay: string;
          if (event.isAllDay) {
            if (eventIsToday) {
              timeDisplay = "All day";
            } else if (eventIsTomorrow) {
              timeDisplay = "Tomorrow";
            } else {
              timeDisplay = format(startTime, "EEE");
            }
          } else {
            const timeStr = format(startTime, "h:mm a");
            if (eventIsToday) {
              // For ongoing events, don't show the original start time
              timeDisplay = isOngoingToday ? "Now" : timeStr;
            } else if (eventIsTomorrow) {
              timeDisplay = `Tomorrow ${timeStr}`;
            } else {
              timeDisplay = `${format(startTime, "EEE")} ${timeStr}`;
            }
          }

          return (
            <div key={event.id} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: calendar?.color ?? "#3B82F6" }}
              />
              <span
                className={cn(sizeClasses?.item, "truncate flex-1")}
                style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.item) } : undefined}
              >
                {event.title}
              </span>
              {showTime && (
                <span
                  className={cn(sizeClasses?.item, "opacity-60 flex-shrink-0")}
                  style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.item) } : undefined}
                >
                  {timeDisplay}
                </span>
              )}
              {showCalendarName && calendar && (
                <span
                  className={cn(sizeClasses?.label, "opacity-40 flex-shrink-0")}
                  style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.label) } : undefined}
                >
                  ({calendar.name})
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
