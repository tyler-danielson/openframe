import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, isToday, isTomorrow, differenceInMinutes, differenceInHours, differenceInDays } from "date-fns";
import { MapPin } from "lucide-react";
import { api } from "../../services/api";
import type { WidgetStyle, FontSizePreset } from "../../stores/screensaver";
import { getFontSizeConfig } from "../../lib/font-size";
import type { CalendarEvent, Calendar } from "@openframe/shared";
import { cn } from "../../lib/utils";

interface UpNextWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
}

const FONT_SIZE_CLASSES: Record<Exclude<FontSizePreset, "custom">, { title: string; detail: string; label: string; countdown: string }> = {
  xs: { title: "text-sm", detail: "text-[10px]", label: "text-[8px]", countdown: "text-xs" },
  sm: { title: "text-base", detail: "text-xs", label: "text-[10px]", countdown: "text-sm" },
  md: { title: "text-lg", detail: "text-sm", label: "text-xs", countdown: "text-base" },
  lg: { title: "text-xl", detail: "text-base", label: "text-sm", countdown: "text-lg" },
  xl: { title: "text-2xl", detail: "text-lg", label: "text-base", countdown: "text-xl" },
};

const CUSTOM_SCALE = {
  title: 1.2,
  detail: 0.85,
  label: 0.7,
  countdown: 1,
};

export function UpNextWidget({ config, style, isBuilder }: UpNextWidgetProps) {
  const showCountdown = config.showCountdown as boolean ?? true;
  const showLocation = config.showLocation as boolean ?? true;
  const showCalendarName = config.showCalendarName as boolean ?? true;
  const showDescription = config.showDescription as boolean ?? false;
  const configCalendarIds = config.calendarIds as string[] ?? [];
  const hideBlankEvents = config.hideBlankEvents as boolean ?? false;
  const hideDuplicates = config.hideDuplicates as boolean ?? false;
  const hideAllDayEvents = config.hideAllDayEvents as boolean ?? false;
  const headerMode = config.headerMode as string ?? "default";
  const customHeader = config.customHeader as string ?? "";

  const getHeaderText = () => {
    if (headerMode === "hidden") return null;
    if (headerMode === "custom") return customHeader || null;
    return "Up Next";
  };
  const headerText = getHeaderText();

  const { data: calendars = [] } = useQuery({
    queryKey: ["widget-calendars"],
    queryFn: () => api.getCalendars(),
    staleTime: 5 * 60 * 1000,
    enabled: !isBuilder,
  });

  const activeCalendarIds = useMemo(() => {
    if (configCalendarIds.length > 0) {
      return configCalendarIds;
    }
    return calendars
      .filter((cal: Calendar) => cal.isVisible && (cal.visibility?.screensaver ?? false))
      .map((cal: Calendar) => cal.id);
  }, [calendars, configCalendarIds]);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["widget-events-upnext", activeCalendarIds],
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
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  const nextEvent = useMemo(() => {
    const now = new Date();
    let filtered = [...events]
      .filter((event) => new Date(event.endTime) > now)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    if (hideBlankEvents) {
      filtered = filtered.filter((event) => event.title && event.title.trim() !== "");
    }

    if (hideAllDayEvents) {
      filtered = filtered.filter((event) => !event.isAllDay);
    }

    if (hideDuplicates) {
      const seen = new Set<string>();
      filtered = filtered.filter((event) => {
        const key = `${event.title?.toLowerCase().trim()}|${event.startTime}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    return filtered[0] || null;
  }, [events, hideBlankEvents, hideAllDayEvents, hideDuplicates]);

  const { preset, isCustom, customValue } = getFontSizeConfig(style);
  const sizeClasses = isCustom ? null : FONT_SIZE_CLASSES[preset];

  const getCustomFontSize = (scale: number) => {
    if (!customValue) return undefined;
    const value = parseFloat(customValue);
    const unit = customValue.replace(/[\d.]/g, "") || "px";
    return `${value * scale}${unit}`;
  };

  const getCountdownText = (event: CalendarEvent) => {
    const now = new Date();
    const startTime = new Date(event.startTime);
    const endTime = new Date(event.endTime);

    // Check if event is currently happening
    if (startTime <= now && endTime > now) {
      return "Now";
    }

    const minutes = differenceInMinutes(startTime, now);
    const hours = differenceInHours(startTime, now);
    const days = differenceInDays(startTime, now);

    if (minutes < 1) return "Starting now";
    if (minutes < 60) return `in ${minutes}m`;
    if (hours < 24) return `in ${hours}h ${minutes % 60}m`;
    if (days === 1) return "Tomorrow";
    return `in ${days} days`;
  };

  const getTimeDisplay = (event: CalendarEvent) => {
    const startTime = new Date(event.startTime);
    const eventIsToday = isToday(startTime);
    const eventIsTomorrow = isTomorrow(startTime);

    if (event.isAllDay) {
      if (eventIsToday) return "All day today";
      if (eventIsTomorrow) return "All day tomorrow";
      return `All day ${format(startTime, "EEEE")}`;
    }

    const timeStr = format(startTime, "h:mm a");
    if (eventIsToday) return `Today at ${timeStr}`;
    if (eventIsTomorrow) return `Tomorrow at ${timeStr}`;
    return `${format(startTime, "EEEE")} at ${timeStr}`;
  };

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
            className={cn(sizeClasses?.label, "opacity-50 uppercase tracking-wide mb-2")}
            style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.label) } : undefined}
          >
            {headerText}
          </div>
        )}
        <div className="flex-1 flex flex-col justify-center">
          <div className="flex items-start gap-3">
            <div
              className="w-1 self-stretch rounded-full flex-shrink-0"
              style={{ backgroundColor: "#3B82F6" }}
            />
            <div className="flex-1 min-w-0">
              <div
                className={cn(sizeClasses?.title, "font-semibold truncate")}
                style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.title) } : undefined}
              >
                Team Standup Meeting
              </div>
              <div
                className={cn(sizeClasses?.detail, "opacity-70 mt-0.5")}
                style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.detail) } : undefined}
              >
                Today at 10:00 AM
              </div>
              {showLocation && (
                <div
                  className={cn(sizeClasses?.detail, "opacity-50 mt-1 flex items-center gap-1")}
                  style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.detail) } : undefined}
                >
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">Conference Room A</span>
                </div>
              )}
              {showCalendarName && (
                <div
                  className={cn(sizeClasses?.label, "opacity-40 mt-1")}
                  style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.label) } : undefined}
                >
                  Work Calendar
                </div>
              )}
            </div>
            {showCountdown && (
              <div
                className={cn(sizeClasses?.countdown, "font-medium text-primary flex-shrink-0")}
                style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.countdown) } : undefined}
              >
                in 45m
              </div>
            )}
          </div>
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
        <span className="text-sm opacity-50">Loading...</span>
      </div>
    );
  }

  if (!nextEvent) {
    return (
      <div
        className="flex h-full items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <span className="text-sm opacity-50">No upcoming events</span>
      </div>
    );
  }

  const calendar = calendars.find((c: Calendar) => c.id === nextEvent.calendarId);

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
          className={cn(sizeClasses?.label, "opacity-50 uppercase tracking-wide mb-2")}
          style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.label) } : undefined}
        >
          {headerText}
        </div>
      )}
      <div className="flex-1 flex flex-col justify-center">
        <div className="flex items-start gap-3">
          <div
            className="w-1 self-stretch rounded-full flex-shrink-0"
            style={{ backgroundColor: calendar?.color ?? "#3B82F6" }}
          />
          <div className="flex-1 min-w-0">
            <div
              className={cn(sizeClasses?.title, "font-semibold truncate")}
              style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.title) } : undefined}
            >
              {nextEvent.title}
            </div>
            <div
              className={cn(sizeClasses?.detail, "opacity-70 mt-0.5")}
              style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.detail) } : undefined}
            >
              {getTimeDisplay(nextEvent)}
            </div>
            {showLocation && nextEvent.location && (
              <div
                className={cn(sizeClasses?.detail, "opacity-50 mt-1 flex items-center gap-1")}
                style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.detail) } : undefined}
              >
                <MapPin className="h-3 w-3" />
                <span className="truncate">{nextEvent.location}</span>
              </div>
            )}
            {showDescription && nextEvent.description && (
              <div
                className={cn(sizeClasses?.detail, "opacity-50 mt-1 line-clamp-2")}
                style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.detail) } : undefined}
              >
                {nextEvent.description}
              </div>
            )}
            {showCalendarName && calendar && (
              <div
                className={cn(sizeClasses?.label, "opacity-40 mt-1")}
                style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.label) } : undefined}
              >
                {calendar.name}
              </div>
            )}
          </div>
          {showCountdown && (
            <div
              className={cn(sizeClasses?.countdown, "font-medium text-primary flex-shrink-0")}
              style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.countdown) } : undefined}
            >
              {getCountdownText(nextEvent)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
