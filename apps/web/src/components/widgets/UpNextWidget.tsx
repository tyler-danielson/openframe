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
  widgetId?: string;
}

const FONT_SIZE_CLASSES: Record<Exclude<FontSizePreset, "custom">, { title: string; detail: string; label: string; countdown: string; dayHeader: string }> = {
  xs: { title: "text-sm", detail: "text-[10px]", label: "text-[8px]", countdown: "text-xs", dayHeader: "text-[9px]" },
  sm: { title: "text-base", detail: "text-xs", label: "text-[10px]", countdown: "text-sm", dayHeader: "text-[11px]" },
  md: { title: "text-lg", detail: "text-sm", label: "text-xs", countdown: "text-base", dayHeader: "text-xs" },
  lg: { title: "text-xl", detail: "text-base", label: "text-sm", countdown: "text-lg", dayHeader: "text-sm" },
  xl: { title: "text-2xl", detail: "text-lg", label: "text-base", countdown: "text-xl", dayHeader: "text-base" },
};

const CUSTOM_SCALE = {
  title: 1.2,
  detail: 0.85,
  label: 0.7,
  countdown: 1,
  dayHeader: 0.75,
};

function getDayLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEEE M/d");
}

export function UpNextWidget({ config, style, isBuilder }: UpNextWidgetProps) {
  const showCountdown = config.showCountdown as boolean ?? true;
  const showLocation = config.showLocation as boolean ?? true;
  const showCalendarName = config.showCalendarName as boolean ?? true;
  const showDescription = config.showDescription as boolean ?? false;
  const maxItems = config.maxItems as number ?? 10;
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

  const upcomingEvents = useMemo(() => {
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

    return filtered.slice(0, maxItems);
  }, [events, hideBlankEvents, hideAllDayEvents, hideDuplicates, maxItems]);

  const groupedEvents = useMemo(() => {
    const groups = new Map<string, CalendarEvent[]>();
    for (const event of upcomingEvents) {
      const dayKey = format(new Date(event.startTime), "yyyy-MM-dd");
      if (!groups.has(dayKey)) {
        groups.set(dayKey, []);
      }
      groups.get(dayKey)!.push(event);
    }
    return groups;
  }, [upcomingEvents]);

  const { preset, isCustom, customValue } = getFontSizeConfig(style);
  const sizeClasses = isCustom ? null : FONT_SIZE_CLASSES[preset as Exclude<FontSizePreset, "custom">];

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

  const getTimeRange = (event: CalendarEvent) => {
    if (event.isAllDay) return "All day";
    const start = new Date(event.startTime);
    const end = new Date(event.endTime);
    return `${format(start, "h:mm a")} – ${format(end, "h:mm a")}`;
  };

  const renderEventRow = (event: CalendarEvent, calendar: Calendar | undefined, isFirst: boolean) => (
    <div key={event.id} className="flex items-start gap-3">
      <div
        className="w-0.5 self-stretch rounded-full flex-shrink-0 mt-0.5"
        style={{ backgroundColor: calendar?.color ?? "#3B82F6" }}
      />
      <div className="flex-1 min-w-0">
        <div
          className={cn(sizeClasses?.title, "font-semibold truncate")}
          style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.title) } : undefined}
        >
          {event.title}
        </div>
        <div
          className={cn(sizeClasses?.detail, "opacity-70 mt-0.5")}
          style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.detail) } : undefined}
        >
          {getTimeRange(event)}
        </div>
        {showLocation && event.location && (
          <div
            className={cn(sizeClasses?.detail, "opacity-50 mt-0.5 flex items-center gap-1")}
            style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.detail) } : undefined}
          >
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{event.location}</span>
          </div>
        )}
        {showDescription && event.description && (
          <div
            className={cn(sizeClasses?.detail, "opacity-50 mt-0.5 line-clamp-2")}
            style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.detail) } : undefined}
          >
            {event.description}
          </div>
        )}
        {showCalendarName && calendar && (
          <div
            className={cn(sizeClasses?.label, "opacity-40 mt-0.5")}
            style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.label) } : undefined}
          >
            {calendar.name}
          </div>
        )}
      </div>
      {showCountdown && isFirst && (
        <div
          className={cn(sizeClasses?.countdown, "font-medium text-primary flex-shrink-0")}
          style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.countdown) } : undefined}
        >
          {getCountdownText(event)}
        </div>
      )}
    </div>
  );

  if (isBuilder) {
    const mockGroups = [
      {
        label: "Today",
        events: [
          { id: "1", title: "Team Standup Meeting", time: "10:00 AM – 10:30 AM", location: "Conference Room A", description: "Daily sync with team", calendar: "Work Calendar", color: "#3B82F6", isFirst: true },
          { id: "2", title: "Design Review", time: "2:00 PM – 3:00 PM", location: null, description: null, calendar: "Work Calendar", color: "#3B82F6", isFirst: false },
        ],
      },
      {
        label: "Tomorrow",
        events: [
          { id: "3", title: "Sprint Planning", time: "9:00 AM – 11:00 AM", location: null, description: null, calendar: "Work Calendar", color: "#10B981", isFirst: false },
        ],
      },
    ];

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
        <div className="flex-1 overflow-y-auto space-y-3">
          {mockGroups.map((group) => (
            <div key={group.label}>
              <div
                className={cn(sizeClasses?.dayHeader, "uppercase tracking-wider opacity-50 mb-1.5 font-medium")}
                style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.dayHeader) } : undefined}
              >
                {group.label}
              </div>
              <div className="space-y-2">
                {group.events.map((event) => (
                  <div key={event.id} className="flex items-start gap-3">
                    <div
                      className="w-0.5 self-stretch rounded-full flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: event.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div
                        className={cn(sizeClasses?.title, "font-semibold truncate")}
                        style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.title) } : undefined}
                      >
                        {event.title}
                      </div>
                      <div
                        className={cn(sizeClasses?.detail, "opacity-70 mt-0.5")}
                        style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.detail) } : undefined}
                      >
                        {event.time}
                      </div>
                      {showLocation && event.location && (
                        <div
                          className={cn(sizeClasses?.detail, "opacity-50 mt-0.5 flex items-center gap-1")}
                          style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.detail) } : undefined}
                        >
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{event.location}</span>
                        </div>
                      )}
                      {showDescription && event.description && (
                        <div
                          className={cn(sizeClasses?.detail, "opacity-50 mt-0.5 line-clamp-2")}
                          style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.detail) } : undefined}
                        >
                          {event.description}
                        </div>
                      )}
                      {showCalendarName && (
                        <div
                          className={cn(sizeClasses?.label, "opacity-40 mt-0.5")}
                          style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.label) } : undefined}
                        >
                          {event.calendar}
                        </div>
                      )}
                    </div>
                    {showCountdown && event.isFirst && (
                      <div
                        className={cn(sizeClasses?.countdown, "font-medium text-primary flex-shrink-0")}
                        style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.countdown) } : undefined}
                      >
                        in 45m
                      </div>
                    )}
                  </div>
                ))}
              </div>
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
        <span className="text-sm opacity-50">Loading...</span>
      </div>
    );
  }

  if (upcomingEvents.length === 0) {
    return (
      <div
        className="flex h-full items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <span className="text-sm opacity-50">No upcoming events</span>
      </div>
    );
  }

  let isFirstEvent = true;

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
      <div className="flex-1 overflow-y-auto space-y-3">
        {Array.from(groupedEvents.entries()).map(([dayKey, dayEvents]) => {
          const dayDate = new Date(dayKey + "T00:00:00");
          return (
            <div key={dayKey}>
              <div
                className={cn(sizeClasses?.dayHeader, "uppercase tracking-wider opacity-50 mb-1.5 font-medium")}
                style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.dayHeader) } : undefined}
              >
                {getDayLabel(dayDate)}
              </div>
              <div className="space-y-2">
                {dayEvents.map((event) => {
                  const calendar = calendars.find((c: Calendar) => c.id === event.calendarId);
                  const isFirst = isFirstEvent;
                  if (isFirstEvent) isFirstEvent = false;
                  return renderEventRow(event, calendar, isFirst);
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
