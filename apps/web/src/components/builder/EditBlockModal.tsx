import { useState, useRef, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import type { Calendar as CalendarType, CalendarEvent } from "@openframe/shared";
import {
  X,
  Settings,
  Palette,
  Clock,
  Timer,
  Cloud,
  CloudSun,
  Calendar,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  Trophy,
  Music,
  Zap,
  Gauge,
  LineChart,
  Camera,
  Map,
  Type,
  Image,
  Images,
  Shapes,
  Maximize,
  Newspaper,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { type FontSizePreset } from "../../stores/screensaver";
import { getWidgetDefinition } from "../../lib/widgets/registry";
import { useBuilder } from "../../hooks/useBuilder";
import { HAEntityBrowser } from "./HAEntityBrowser";
import { AlbumPicker } from "./AlbumPicker";
import { REDDIT_PRESETS } from "../widgets/PhotoAlbumWidget";

interface EditBlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  widgetId: string;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Clock,
  Timer,
  Cloud,
  CloudSun,
  Calendar,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  Trophy,
  Music,
  Zap,
  Gauge,
  LineChart,
  Camera,
  Map,
  Type,
  Image,
  Images,
  Shapes,
  Maximize,
  Newspaper,
};

type TabId = "setup" | "style" | "advanced";

// Header settings component - reusable for widgets with headers
function HeaderSettings({
  config,
  handleConfigChange,
  defaultHeaderText,
}: {
  config: Record<string, unknown>;
  handleConfigChange: (key: string, value: unknown) => void;
  defaultHeaderText: string;
}) {
  const headerMode = (config.headerMode as string) ?? "default";

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="text-sm">Header</span>
        <select
          value={headerMode}
          onChange={(e) => handleConfigChange("headerMode", e.target.value)}
          className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="default">Default ({defaultHeaderText})</option>
          <option value="custom">Custom</option>
          <option value="hidden">Hidden</option>
        </select>
      </label>
      {headerMode === "custom" && (
        <label className="block">
          <span className="text-sm">Custom Header Text</span>
          <input
            type="text"
            value={config.customHeader as string ?? ""}
            onChange={(e) => handleConfigChange("customHeader", e.target.value)}
            className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
            placeholder="Enter custom header..."
          />
        </label>
      )}
    </div>
  );
}

// Calendar config fields component (needs useQuery for calendar list)
function CalendarConfigFields({
  config,
  handleConfigChange,
}: {
  config: Record<string, unknown>;
  handleConfigChange: (key: string, value: unknown) => void;
}) {
  const { data: calendars = [] } = useQuery({
    queryKey: ["calendars-for-widget"],
    queryFn: () => api.getCalendars(),
    staleTime: 5 * 60 * 1000,
  });

  const selectedCalendarIds = (config.calendarIds as string[]) ?? [];
  const showUpcomingOnly = config.showUpcomingOnly as boolean ?? true;
  const hasInitialized = useRef(false);

  // Sort calendars: favorites first, then alphabetically
  const sortedCalendars = useMemo(() => {
    return [...calendars].sort((a: CalendarType, b: CalendarType) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [calendars]);

  // Auto-select favorites on first load when no calendars are selected
  useEffect(() => {
    if (!hasInitialized.current && calendars.length > 0 && selectedCalendarIds.length === 0) {
      const favoriteIds = calendars
        .filter((cal: CalendarType) => cal.isFavorite)
        .map((cal: CalendarType) => cal.id);
      if (favoriteIds.length > 0) {
        handleConfigChange("calendarIds", favoriteIds);
      }
      hasInitialized.current = true;
    }
  }, [calendars, selectedCalendarIds.length, handleConfigChange]);

  const toggleCalendar = (calendarId: string) => {
    const current = selectedCalendarIds;
    if (current.includes(calendarId)) {
      handleConfigChange("calendarIds", current.filter((id) => id !== calendarId));
    } else {
      handleConfigChange("calendarIds", [...current, calendarId]);
    }
  };

  return (
    <>
      {/* Header Settings */}
      <HeaderSettings
        config={config}
        handleConfigChange={handleConfigChange}
        defaultHeaderText={showUpcomingOnly ? "Upcoming Events" : "Events"}
      />

      {/* Max Items */}
      <label className="block">
        <span className="text-sm">Max Items</span>
        <input
          type="number"
          min={1}
          max={20}
          value={config.maxItems as number ?? 5}
          onChange={(e) => handleConfigChange("maxItems", parseInt(e.target.value) || 5)}
          className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
        />
      </label>

      {/* Show Upcoming Only */}
      <label className="flex items-center justify-between">
        <span className="text-sm">Show Upcoming Only</span>
        <input
          type="checkbox"
          checked={config.showUpcomingOnly as boolean ?? true}
          onChange={(e) => handleConfigChange("showUpcomingOnly", e.target.checked)}
          className="rounded"
        />
      </label>

      {/* Hide Blank Events */}
      <label className="flex items-center justify-between">
        <span className="text-sm">Hide Blank Events</span>
        <input
          type="checkbox"
          checked={config.hideBlankEvents as boolean ?? false}
          onChange={(e) => handleConfigChange("hideBlankEvents", e.target.checked)}
          className="rounded"
        />
      </label>

      {/* Hide Duplicates */}
      <label className="flex items-center justify-between">
        <span className="text-sm">Hide Duplicates</span>
        <input
          type="checkbox"
          checked={config.hideDuplicates as boolean ?? false}
          onChange={(e) => handleConfigChange("hideDuplicates", e.target.checked)}
          className="rounded"
        />
      </label>

      {/* Calendar Selection */}
      <div className="block">
        <span className="text-sm">Calendars</span>
        <span className="text-xs text-muted-foreground ml-2">
          {selectedCalendarIds.length === 0 ? "(all visible)" : `(${selectedCalendarIds.length} selected)`}
        </span>
        <div className="mt-2 space-y-1 max-h-40 overflow-y-auto rounded border border-border bg-background p-2">
          {sortedCalendars.length === 0 ? (
            <span className="text-xs text-muted-foreground">No calendars found</span>
          ) : (
            sortedCalendars.map((cal: CalendarType) => (
              <label key={cal.id} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-muted/50 rounded px-1">
                <input
                  type="checkbox"
                  checked={selectedCalendarIds.includes(cal.id)}
                  onChange={() => toggleCalendar(cal.id)}
                  className="rounded"
                />
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cal.color }}
                />
                <span className="text-sm truncate flex-1">{cal.name}</span>
                {cal.isFavorite && (
                  <span className="text-yellow-500 text-xs">★</span>
                )}
              </label>
            ))
          )}
        </div>
      </div>
    </>
  );
}

// Up Next config fields component
function UpNextConfigFields({
  config,
  handleConfigChange,
}: {
  config: Record<string, unknown>;
  handleConfigChange: (key: string, value: unknown) => void;
}) {
  const { data: calendars = [] } = useQuery({
    queryKey: ["calendars-for-widget"],
    queryFn: () => api.getCalendars(),
    staleTime: 5 * 60 * 1000,
  });

  const selectedCalendarIds = (config.calendarIds as string[]) ?? [];
  const hasInitialized = useRef(false);

  // Sort calendars: favorites first, then alphabetically
  const sortedCalendars = useMemo(() => {
    return [...calendars].sort((a: CalendarType, b: CalendarType) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [calendars]);

  // Auto-select favorites on first load when no calendars are selected
  useEffect(() => {
    if (!hasInitialized.current && calendars.length > 0 && selectedCalendarIds.length === 0) {
      const favoriteIds = calendars
        .filter((cal: CalendarType) => cal.isFavorite)
        .map((cal: CalendarType) => cal.id);
      if (favoriteIds.length > 0) {
        handleConfigChange("calendarIds", favoriteIds);
      }
      hasInitialized.current = true;
    }
  }, [calendars, selectedCalendarIds.length, handleConfigChange]);

  const toggleCalendar = (calendarId: string) => {
    const current = selectedCalendarIds;
    if (current.includes(calendarId)) {
      handleConfigChange("calendarIds", current.filter((id) => id !== calendarId));
    } else {
      handleConfigChange("calendarIds", [...current, calendarId]);
    }
  };

  return (
    <>
      {/* Header Settings */}
      <HeaderSettings
        config={config}
        handleConfigChange={handleConfigChange}
        defaultHeaderText="Up Next"
      />

      {/* Show Countdown */}
      <label className="flex items-center justify-between">
        <span className="text-sm">Show Countdown</span>
        <input
          type="checkbox"
          checked={config.showCountdown as boolean ?? true}
          onChange={(e) => handleConfigChange("showCountdown", e.target.checked)}
          className="rounded"
        />
      </label>

      {/* Show Location */}
      <label className="flex items-center justify-between">
        <span className="text-sm">Show Location</span>
        <input
          type="checkbox"
          checked={config.showLocation as boolean ?? true}
          onChange={(e) => handleConfigChange("showLocation", e.target.checked)}
          className="rounded"
        />
      </label>

      {/* Show Calendar Name */}
      <label className="flex items-center justify-between">
        <span className="text-sm">Show Calendar Name</span>
        <input
          type="checkbox"
          checked={config.showCalendarName as boolean ?? true}
          onChange={(e) => handleConfigChange("showCalendarName", e.target.checked)}
          className="rounded"
        />
      </label>

      {/* Show Description */}
      <label className="flex items-center justify-between">
        <span className="text-sm">Show Description</span>
        <input
          type="checkbox"
          checked={config.showDescription as boolean ?? false}
          onChange={(e) => handleConfigChange("showDescription", e.target.checked)}
          className="rounded"
        />
      </label>

      {/* Hide Blank Events */}
      <label className="flex items-center justify-between">
        <span className="text-sm">Hide Blank Events</span>
        <input
          type="checkbox"
          checked={config.hideBlankEvents as boolean ?? false}
          onChange={(e) => handleConfigChange("hideBlankEvents", e.target.checked)}
          className="rounded"
        />
      </label>

      {/* Hide Duplicates */}
      <label className="flex items-center justify-between">
        <span className="text-sm">Hide Duplicates</span>
        <input
          type="checkbox"
          checked={config.hideDuplicates as boolean ?? false}
          onChange={(e) => handleConfigChange("hideDuplicates", e.target.checked)}
          className="rounded"
        />
      </label>

      {/* Hide All Day Events */}
      <label className="flex items-center justify-between">
        <span className="text-sm">Hide All Day Events</span>
        <input
          type="checkbox"
          checked={config.hideAllDayEvents as boolean ?? false}
          onChange={(e) => handleConfigChange("hideAllDayEvents", e.target.checked)}
          className="rounded"
        />
      </label>

      {/* Calendar Selection */}
      <div className="block">
        <span className="text-sm">Calendars</span>
        <span className="text-xs text-muted-foreground ml-2">
          {selectedCalendarIds.length === 0 ? "(all visible)" : `(${selectedCalendarIds.length} selected)`}
        </span>
        <div className="mt-2 space-y-1 max-h-40 overflow-y-auto rounded border border-border bg-background p-2">
          {sortedCalendars.length === 0 ? (
            <span className="text-xs text-muted-foreground">No calendars found</span>
          ) : (
            sortedCalendars.map((cal: CalendarType) => (
              <label key={cal.id} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-muted/50 rounded px-1">
                <input
                  type="checkbox"
                  checked={selectedCalendarIds.includes(cal.id)}
                  onChange={() => toggleCalendar(cal.id)}
                  className="rounded"
                />
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cal.color }}
                />
                <span className="text-sm truncate flex-1">{cal.name}</span>
                {cal.isFavorite && (
                  <span className="text-yellow-500 text-xs">★</span>
                )}
              </label>
            ))
          )}
        </div>
      </div>
    </>
  );
}

// Countdown config fields component
function CountdownConfigFields({
  config,
  handleConfigChange,
}: {
  config: Record<string, unknown>;
  handleConfigChange: (key: string, value: unknown) => void;
}) {
  const eventId = config.eventId as string ?? "";
  const displayMode = config.displayMode as "full" | "days" ?? "full";
  const hasEventOrDate = eventId || config.targetDate;
  const sourceMode = eventId ? "event" : "manual";

  // Fetch upcoming events for the dropdown
  const { data: events = [] } = useQuery({
    queryKey: ["upcoming-events-for-countdown"],
    queryFn: async () => {
      const start = new Date();
      const end = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      return api.getEvents(start, end);
    },
    staleTime: 60 * 1000,
  });

  // Filter to future events only and sort by date
  const futureEvents = useMemo(() => {
    return events
      .filter(e => new Date(e.startTime) > new Date())
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [events]);

  // Format date for display
  const formatEventDate = (dateInput: Date | string) => {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleSourceChange = (newSource: "manual" | "event") => {
    if (newSource === "manual") {
      handleConfigChange("eventId", "");
    } else {
      // When switching to event mode, clear manual fields
      handleConfigChange("targetDate", "");
    }
  };

  return (
    <>
      {/* Source Selection */}
      <div className="block">
        <span className="text-sm">Source</span>
        <div className="flex gap-4 mt-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="countdownSource"
              checked={sourceMode === "manual"}
              onChange={() => handleSourceChange("manual")}
              className="rounded"
            />
            <span className="text-sm">Manual Date</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="countdownSource"
              checked={sourceMode === "event"}
              onChange={() => handleSourceChange("event")}
              className="rounded"
            />
            <span className="text-sm">Calendar Event</span>
          </label>
        </div>
      </div>

      {/* Source-specific fields */}
      {sourceMode === "manual" ? (
        <>
          <label className="block">
            <span className="text-sm">Label</span>
            <input
              type="text"
              value={config.label as string ?? ""}
              onChange={(e) => handleConfigChange("label", e.target.value)}
              className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
              placeholder="Countdown to..."
            />
          </label>
          <label className="block">
            <span className="text-sm">Target Date</span>
            <input
              type="datetime-local"
              value={config.targetDate as string ?? ""}
              onChange={(e) => handleConfigChange("targetDate", e.target.value)}
              className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        </>
      ) : (
        <label className="block">
          <span className="text-sm">Select Event</span>
          <select
            value={eventId}
            onChange={(e) => handleConfigChange("eventId", e.target.value)}
            className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Select an event...</option>
            {futureEvents.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title} - {formatEventDate(event.startTime)}
              </option>
            ))}
          </select>
          {futureEvents.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">No upcoming events found</p>
          )}
        </label>
      )}

      {/* Display Mode */}
      <div className="block">
        <span className="text-sm">Display Mode</span>
        <div className="flex gap-4 mt-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="displayMode"
              checked={displayMode === "full"}
              onChange={() => handleConfigChange("displayMode", "full")}
              className="rounded"
            />
            <span className="text-sm">Full Timer</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="displayMode"
              checked={displayMode === "days"}
              onChange={() => handleConfigChange("displayMode", "days")}
              className="rounded"
            />
            <span className="text-sm">Days (Sleeps)</span>
          </label>
        </div>
      </div>

      {/* Timer component toggles - only show for Full Timer mode */}
      {displayMode === "full" && (
        <div className="space-y-2 border-t border-border pt-3 mt-3">
          <span className="text-xs text-muted-foreground">Timer Components</span>
          <label className="flex items-center justify-between">
            <span className="text-sm">Show Days</span>
            <input
              type="checkbox"
              checked={config.showDays as boolean ?? true}
              onChange={(e) => handleConfigChange("showDays", e.target.checked)}
              className="rounded"
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm">Show Hours</span>
            <input
              type="checkbox"
              checked={config.showHours as boolean ?? true}
              onChange={(e) => handleConfigChange("showHours", e.target.checked)}
              className="rounded"
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm">Show Minutes</span>
            <input
              type="checkbox"
              checked={config.showMinutes as boolean ?? true}
              onChange={(e) => handleConfigChange("showMinutes", e.target.checked)}
              className="rounded"
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm">Show Seconds</span>
            <input
              type="checkbox"
              checked={config.showSeconds as boolean ?? false}
              onChange={(e) => handleConfigChange("showSeconds", e.target.checked)}
              className="rounded"
            />
          </label>
        </div>
      )}

      {/* Clear event button - make it a placeholder */}
      {hasEventOrDate && (
        <div className="border-t border-border pt-3 mt-3">
          <button
            onClick={() => {
              handleConfigChange("eventId", "");
              handleConfigChange("targetDate", "");
            }}
            className="w-full px-3 py-2 text-sm text-destructive border border-destructive/30 rounded-md hover:bg-destructive/10 transition-colors"
          >
            Clear event (make placeholder)
          </button>
        </div>
      )}
    </>
  );
}

export function EditBlockModal({ isOpen, onClose, widgetId }: EditBlockModalProps) {
  const { layoutConfig, updateBuilderWidget } = useBuilder();
  const [activeTab, setActiveTab] = useState<TabId>("setup");
  const [showEntityBrowser, setShowEntityBrowser] = useState(false);
  const [entityBrowserTarget, setEntityBrowserTarget] = useState<string | null>(null);
  const [showAlbumPicker, setShowAlbumPicker] = useState(false);

  const widgets = layoutConfig.widgets || [];
  const widget = widgets.find((w) => w.id === widgetId);

  if (!isOpen || !widget) return null;

  const definition = getWidgetDefinition(widget.type);
  const WidgetIcon = ICON_MAP[definition.icon] || Shapes;

  const handleConfigChange = (key: string, value: unknown) => {
    updateBuilderWidget(widgetId, {
      config: { ...widget.config, [key]: value },
    });
  };

  const handleStyleChange = (key: string, value: unknown) => {
    updateBuilderWidget(widgetId, {
      style: { ...widget.style, [key]: value },
    });
  };

  const handleVisibilityChange = (key: string, value: unknown) => {
    updateBuilderWidget(widgetId, {
      visibility: {
        enabled: widget.visibility?.enabled ?? false,
        startTime: widget.visibility?.startTime ?? "00:00",
        endTime: widget.visibility?.endTime ?? "23:59",
        daysOfWeek: widget.visibility?.daysOfWeek ?? [],
        ...widget.visibility,
        [key]: value,
      },
    });
  };

  const toggleDayOfWeek = (day: number) => {
    const currentDays = widget.visibility?.daysOfWeek ?? [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter((d) => d !== day)
      : [...currentDays, day].sort((a, b) => a - b);
    handleVisibilityChange("daysOfWeek", newDays);
  };

  const openEntityBrowser = (configKey: string) => {
    setEntityBrowserTarget(configKey);
    setShowEntityBrowser(true);
  };

  const handleEntitySelect = (entityId: string) => {
    if (entityBrowserTarget) {
      handleConfigChange(entityBrowserTarget, entityId);
    }
    setShowEntityBrowser(false);
    setEntityBrowserTarget(null);
  };

  // Render config fields based on widget type
  const renderConfigFields = () => {
    const config = widget.config;

    switch (widget.type) {
      case "clock":
        return (
          <>
            <label className="flex items-center justify-between">
              <span className="text-sm">Show Seconds</span>
              <input
                type="checkbox"
                checked={config.showSeconds as boolean ?? false}
                onChange={(e) => handleConfigChange("showSeconds", e.target.checked)}
                className="rounded"
              />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm">Show Date</span>
              <input
                type="checkbox"
                checked={config.showDate as boolean ?? true}
                onChange={(e) => handleConfigChange("showDate", e.target.checked)}
                className="rounded"
              />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm">24-Hour Format</span>
              <input
                type="checkbox"
                checked={config.format24h as boolean ?? false}
                onChange={(e) => handleConfigChange("format24h", e.target.checked)}
                className="rounded"
              />
            </label>
          </>
        );

      case "countdown":
        return <CountdownConfigFields config={config} handleConfigChange={handleConfigChange} />;

      case "weather":
        return (
          <>
            <label className="flex items-center justify-between">
              <span className="text-sm">Show Icon</span>
              <input
                type="checkbox"
                checked={config.showIcon as boolean ?? true}
                onChange={(e) => handleConfigChange("showIcon", e.target.checked)}
                className="rounded"
              />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm">Show Description</span>
              <input
                type="checkbox"
                checked={config.showDescription as boolean ?? true}
                onChange={(e) => handleConfigChange("showDescription", e.target.checked)}
                className="rounded"
              />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm">Show Humidity</span>
              <input
                type="checkbox"
                checked={config.showHumidity as boolean ?? true}
                onChange={(e) => handleConfigChange("showHumidity", e.target.checked)}
                className="rounded"
              />
            </label>
          </>
        );

      case "forecast":
        return (
          <label className="block">
            <span className="text-sm">Days to Show</span>
            <input
              type="number"
              min={1}
              max={10}
              value={config.days as number ?? 5}
              onChange={(e) => handleConfigChange("days", parseInt(e.target.value) || 5)}
              className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        );

      case "calendar":
        return <CalendarConfigFields config={config} handleConfigChange={handleConfigChange} />;

      case "up-next":
        return <UpNextConfigFields config={config} handleConfigChange={handleConfigChange} />;

      case "tasks":
        return (
          <>
            <HeaderSettings
              config={config}
              handleConfigChange={handleConfigChange}
              defaultHeaderText="Tasks Due Today"
            />
            <label className="block">
              <span className="text-sm">Max Items</span>
              <input
                type="number"
                min={1}
                max={20}
                value={config.maxItems as number ?? 5}
                onChange={(e) => handleConfigChange("maxItems", parseInt(e.target.value) || 5)}
                className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
          </>
        );

      case "sports":
        return (
          <>
            <HeaderSettings
              config={config}
              handleConfigChange={handleConfigChange}
              defaultHeaderText="Sports Scores"
            />
            <label className="block">
              <span className="text-sm">Max Items</span>
              <input
                type="number"
                min={1}
                max={20}
                value={config.maxItems as number ?? 5}
                onChange={(e) => handleConfigChange("maxItems", parseInt(e.target.value) || 5)}
                className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
          </>
        );

      case "spotify":
        return (
          <>
            <HeaderSettings
              config={config}
              handleConfigChange={handleConfigChange}
              defaultHeaderText="Now Playing"
            />
            <label className="flex items-center justify-between">
              <span className="text-sm">Show Album Art</span>
              <input
                type="checkbox"
                checked={config.showAlbumArt as boolean ?? true}
                onChange={(e) => handleConfigChange("showAlbumArt", e.target.checked)}
                className="rounded"
              />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm">Show Progress</span>
              <input
                type="checkbox"
                checked={config.showProgress as boolean ?? true}
                onChange={(e) => handleConfigChange("showProgress", e.target.checked)}
                className="rounded"
              />
            </label>
          </>
        );

      case "ha-entity":
      case "ha-gauge":
      case "ha-graph":
      case "ha-camera":
        return (
          <>
            <label className="block">
              <span className="text-sm">Entity ID</span>
              <div className="flex gap-2 mt-1">
                <input
                  type="text"
                  value={config.entityId as string ?? ""}
                  onChange={(e) => handleConfigChange("entityId", e.target.value)}
                  className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm"
                  placeholder="sensor.temperature"
                />
                <button
                  onClick={() => openEntityBrowser("entityId")}
                  className="px-3 py-2 rounded border border-border bg-muted hover:bg-muted/80 text-sm"
                >
                  Browse
                </button>
              </div>
            </label>
            {widget.type === "ha-gauge" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-sm">Min</span>
                    <input
                      type="number"
                      value={config.min as number ?? 0}
                      onChange={(e) => handleConfigChange("min", parseFloat(e.target.value) || 0)}
                      className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm">Max</span>
                    <input
                      type="number"
                      value={config.max as number ?? 100}
                      onChange={(e) => handleConfigChange("max", parseFloat(e.target.value) || 100)}
                      className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="text-sm">Unit</span>
                  <input
                    type="text"
                    value={config.unit as string ?? ""}
                    onChange={(e) => handleConfigChange("unit", e.target.value)}
                    className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
                    placeholder="°F"
                  />
                </label>
              </>
            )}
            {widget.type === "ha-graph" && (
              <label className="block">
                <span className="text-sm">Hours to Show</span>
                <input
                  type="number"
                  min={1}
                  max={168}
                  value={config.hours as number ?? 24}
                  onChange={(e) => handleConfigChange("hours", parseInt(e.target.value) || 24)}
                  className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
            )}
          </>
        );

      case "text":
        return (
          <>
            <label className="block">
              <span className="text-sm">Content</span>
              <textarea
                value={config.content as string ?? ""}
                onChange={(e) => handleConfigChange("content", e.target.value)}
                className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm resize-none"
                rows={3}
                placeholder="Enter text..."
              />
            </label>
            <label className="block">
              <span className="text-sm">Text Align</span>
              <select
                value={config.textAlign as string ?? "center"}
                onChange={(e) => handleConfigChange("textAlign", e.target.value)}
                className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </label>
          </>
        );

      case "image":
        return (
          <>
            <label className="block">
              <span className="text-sm">Image URL</span>
              <input
                type="url"
                value={config.url as string ?? ""}
                onChange={(e) => handleConfigChange("url", e.target.value)}
                className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
                placeholder="https://..."
              />
            </label>
            <label className="block">
              <span className="text-sm">Fit</span>
              <select
                value={config.fit as string ?? "contain"}
                onChange={(e) => handleConfigChange("fit", e.target.value)}
                className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="contain">Contain</option>
                <option value="cover">Cover</option>
                <option value="fill">Fill</option>
              </select>
            </label>
          </>
        );

      case "photo-album":
        return (
          <>
            {/* Source Selection */}
            <label className="block">
              <span className="text-sm">Source</span>
              <select
                value={config.source as string ?? "album"}
                onChange={(e) => handleConfigChange("source", e.target.value)}
                className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="album">Local Album</option>
                <option value="ha-camera">HA Camera</option>
                <option value="reddit">Reddit</option>
                <option value="custom-url">Custom URL</option>
              </select>
            </label>

            {/* Source-specific fields */}
            {config.source === "album" && (
              <label className="block">
                <span className="text-sm">Album</span>
                <div className="flex gap-2 mt-1">
                  <input
                    type="text"
                    value={config.albumId as string ?? ""}
                    readOnly
                    className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm"
                    placeholder="Select album..."
                  />
                  <button
                    onClick={() => setShowAlbumPicker(true)}
                    className="px-3 py-2 rounded border border-border bg-muted hover:bg-muted/80 text-sm"
                  >
                    Browse
                  </button>
                </div>
              </label>
            )}

            {config.source === "ha-camera" && (
              <label className="block">
                <span className="text-sm">Camera Entity</span>
                <div className="flex gap-2 mt-1">
                  <input
                    type="text"
                    value={config.entityId as string ?? ""}
                    onChange={(e) => handleConfigChange("entityId", e.target.value)}
                    className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm"
                    placeholder="camera.front_door"
                  />
                  <button
                    onClick={() => openEntityBrowser("entityId")}
                    className="px-3 py-2 rounded border border-border bg-muted hover:bg-muted/80 text-sm"
                  >
                    Browse
                  </button>
                </div>
              </label>
            )}

            {config.source === "reddit" && (
              <label className="block">
                <span className="text-sm">Subreddit</span>
                <select
                  value={config.subreddit as string ?? "EarthPorn"}
                  onChange={(e) => handleConfigChange("subreddit", e.target.value)}
                  className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
                >
                  {REDDIT_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      r/{preset.id} - {preset.description}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {config.source === "custom-url" && (
              <label className="block">
                <span className="text-sm">Image URL</span>
                <input
                  type="url"
                  value={config.customUrl as string ?? ""}
                  onChange={(e) => handleConfigChange("customUrl", e.target.value)}
                  className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
                  placeholder="https://example.com/image.jpg"
                />
              </label>
            )}

            {/* Orientation filter */}
            {config.source !== "ha-camera" && config.source !== "custom-url" && (
              <label className="block">
                <span className="text-sm">Orientation</span>
                <select
                  value={config.orientation as string ?? "all"}
                  onChange={(e) => handleConfigChange("orientation", e.target.value)}
                  className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="all">All Photos</option>
                  <option value="landscape">Landscape Only</option>
                  <option value="portrait">Portrait Only</option>
                </select>
              </label>
            )}

            {/* Interval */}
            <label className="block">
              <span className="text-sm">Interval (seconds)</span>
              <input
                type="number"
                min={5}
                max={300}
                value={config.interval as number ?? 30}
                onChange={(e) => handleConfigChange("interval", parseInt(e.target.value) || 30)}
                className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
              />
            </label>

            {/* Interval Offset - for staggering multiple photo widgets */}
            {config.source !== "ha-camera" && config.source !== "custom-url" && (
              <label className="block">
                <span className="text-sm">Start Delay (seconds)</span>
                <p className="text-xs text-muted-foreground mb-1">
                  Delay before first slide change (use to offset multiple widgets)
                </p>
                <input
                  type="number"
                  min={0}
                  max={300}
                  value={config.intervalOffset as number ?? 0}
                  onChange={(e) => handleConfigChange("intervalOffset", parseInt(e.target.value) || 0)}
                  className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
            )}

            {/* Crop Style */}
            <label className="block">
              <span className="text-sm">Crop Style</span>
              <select
                value={config.cropStyle as string ?? "crop"}
                onChange={(e) => handleConfigChange("cropStyle", e.target.value)}
                className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="fit">Fit (show entire image)</option>
                <option value="crop">Crop (fill frame)</option>
                <option value="zoom">Zoom (crop + scale up)</option>
              </select>
            </label>

            {/* Transition */}
            {config.source !== "ha-camera" && (
              <label className="block">
                <span className="text-sm">Slide Transition</span>
                <select
                  value={config.transition as string ?? "fade"}
                  onChange={(e) => handleConfigChange("transition", e.target.value)}
                  className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="fade">Fade</option>
                  <option value="slide">Slide</option>
                  <option value="zoom">Zoom</option>
                  <option value="none">None</option>
                </select>
              </label>
            )}

            {/* Slide Direction - only show when transition is slide */}
            {config.source !== "ha-camera" && config.transition === "slide" && (
              <label className="block">
                <span className="text-sm">Slide Direction</span>
                <select
                  value={config.slideDirection as string ?? "left"}
                  onChange={(e) => handleConfigChange("slideDirection", e.target.value)}
                  className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                  <option value="up">Up</option>
                  <option value="down">Down</option>
                </select>
              </label>
            )}

            {/* Shuffle */}
            {config.source !== "ha-camera" && config.source !== "custom-url" && (
              <label className="flex items-center justify-between">
                <span className="text-sm">Shuffle Photos</span>
                <input
                  type="checkbox"
                  checked={config.shuffle as boolean ?? true}
                  onChange={(e) => handleConfigChange("shuffle", e.target.checked)}
                  className="rounded"
                />
              </label>
            )}
          </>
        );

      case "fullscreen-toggle":
        return (
          <>
            <label className="block">
              <span className="text-sm">Button Style</span>
              <select
                value={config.buttonStyle as string ?? "icon"}
                onChange={(e) => handleConfigChange("buttonStyle", e.target.value)}
                className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="icon">Icon Only</option>
                <option value="text">Text Only</option>
                <option value="both">Icon and Text</option>
              </select>
            </label>
            {(config.buttonStyle === "text" || config.buttonStyle === "both") && (
              <label className="block">
                <span className="text-sm">Button Label</span>
                <input
                  type="text"
                  value={config.label as string ?? "Fullscreen"}
                  onChange={(e) => handleConfigChange("label", e.target.value)}
                  className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Fullscreen"
                />
              </label>
            )}
            <label className="block">
              <span className="text-sm">Icon Size</span>
              <select
                value={config.iconSize as string ?? "medium"}
                onChange={(e) => handleConfigChange("iconSize", e.target.value)}
                className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </label>
          </>
        );

      case "day-schedule":
        const dayScheduleViewMode = (config.viewMode as string) ?? "fixed";
        return (
          <>
            <CalendarConfigFields config={config} handleConfigChange={handleConfigChange} />

            {/* View Mode */}
            <label className="block">
              <span className="text-sm">View Mode</span>
              <select
                value={dayScheduleViewMode}
                onChange={(e) => handleConfigChange("viewMode", e.target.value)}
                className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="fixed">Fixed Hours</option>
                <option value="rolling">Rolling Window</option>
              </select>
            </label>

            {/* Fixed mode options */}
            {dayScheduleViewMode === "fixed" && (
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm">Start Hour</span>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={config.startHour as number ?? 6}
                    onChange={(e) => handleConfigChange("startHour", parseInt(e.target.value) || 6)}
                    className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-sm">End Hour</span>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={config.endHour as number ?? 22}
                    onChange={(e) => handleConfigChange("endHour", parseInt(e.target.value) || 22)}
                    className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
              </div>
            )}

            {/* Rolling mode options */}
            {dayScheduleViewMode === "rolling" && (
              <>
                <label className="block">
                  <span className="text-sm">Look Back</span>
                  <p className="text-xs text-muted-foreground mb-1">How far before current time to show</p>
                  <select
                    value={config.rollingOffsetMinutes as number ?? 60}
                    onChange={(e) => handleConfigChange("rollingOffsetMinutes", parseInt(e.target.value))}
                    className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value={0}>Current time (no offset)</option>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={120}>2 hours</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm">Window Duration</span>
                  <p className="text-xs text-muted-foreground mb-1">Total hours to display</p>
                  <select
                    value={config.rollingDurationHours as number ?? 8}
                    onChange={(e) => handleConfigChange("rollingDurationHours", parseInt(e.target.value))}
                    className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value={4}>4 hours</option>
                    <option value={6}>6 hours</option>
                    <option value={8}>8 hours</option>
                    <option value={10}>10 hours</option>
                    <option value={12}>12 hours</option>
                  </select>
                </label>
              </>
            )}

            <label className="flex items-center justify-between">
              <span className="text-sm">Show Current Time</span>
              <input
                type="checkbox"
                checked={config.showCurrentTime as boolean ?? true}
                onChange={(e) => handleConfigChange("showCurrentTime", e.target.checked)}
                className="rounded"
              />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm">Show Hour Labels</span>
              <input
                type="checkbox"
                checked={config.showHourLabels as boolean ?? true}
                onChange={(e) => handleConfigChange("showHourLabels", e.target.checked)}
                className="rounded"
              />
            </label>
          </>
        );

      case "news":
        return (
          <>
            <label className="block">
              <span className="text-sm">Max Items</span>
              <input
                type="number"
                min={1}
                max={20}
                value={config.maxItems as number ?? 5}
                onChange={(e) => handleConfigChange("maxItems", parseInt(e.target.value) || 5)}
                className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm">Show Images</span>
              <input
                type="checkbox"
                checked={config.showImages as boolean ?? true}
                onChange={(e) => handleConfigChange("showImages", e.target.checked)}
                className="rounded"
              />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm">Show Source</span>
              <input
                type="checkbox"
                checked={config.showSource as boolean ?? true}
                onChange={(e) => handleConfigChange("showSource", e.target.checked)}
                className="rounded"
              />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm">Show Time</span>
              <input
                type="checkbox"
                checked={config.showTime as boolean ?? true}
                onChange={(e) => handleConfigChange("showTime", e.target.checked)}
                className="rounded"
              />
            </label>
          </>
        );

      case "ha-map":
        return (
          <>
            <label className="flex items-center justify-between">
              <span className="text-sm">Show Zones</span>
              <input
                type="checkbox"
                checked={config.showZones as boolean ?? true}
                onChange={(e) => handleConfigChange("showZones", e.target.checked)}
                className="rounded"
              />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm">Show Device Names</span>
              <input
                type="checkbox"
                checked={config.showDeviceNames as boolean ?? true}
                onChange={(e) => handleConfigChange("showDeviceNames", e.target.checked)}
                className="rounded"
              />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm">Dark Mode</span>
              <input
                type="checkbox"
                checked={config.darkMode as boolean ?? true}
                onChange={(e) => handleConfigChange("darkMode", e.target.checked)}
                className="rounded"
              />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm">Auto Fit Bounds</span>
              <input
                type="checkbox"
                checked={config.autoFitBounds as boolean ?? true}
                onChange={(e) => handleConfigChange("autoFitBounds", e.target.checked)}
                className="rounded"
              />
            </label>
          </>
        );

      default:
        return <p className="text-sm text-muted-foreground">No configuration options</p>;
    }
  };

  // Render Setup tab
  const renderSetupTab = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Settings className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-medium">Configuration</h4>
      </div>
      <div className="space-y-3">{renderConfigFields()}</div>
    </div>
  );

  // Render Style tab
  const renderStyleTab = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Palette className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-medium">Appearance</h4>
      </div>
      <div className="space-y-3">
        <label className="block">
          <span className="text-xs text-muted-foreground">Background Color</span>
          <div className="flex gap-2 mt-1">
            <input
              type="color"
              value={widget.style?.backgroundColor || "#000000"}
              onChange={(e) => handleStyleChange("backgroundColor", e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border border-border"
            />
            <input
              type="text"
              value={widget.style?.backgroundColor || ""}
              onChange={(e) => handleStyleChange("backgroundColor", e.target.value)}
              className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm"
              placeholder="transparent"
            />
          </div>
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">Text Color</span>
          <div className="flex gap-2 mt-1">
            <input
              type="color"
              value={widget.style?.textColor || "#ffffff"}
              onChange={(e) => handleStyleChange("textColor", e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border border-border"
            />
            <input
              type="text"
              value={widget.style?.textColor || ""}
              onChange={(e) => handleStyleChange("textColor", e.target.value)}
              className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm"
              placeholder="#ffffff"
            />
          </div>
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">Font Size</span>
          <select
            value={widget.style?.fontSize || "md"}
            onChange={(e) => {
              const value = e.target.value as FontSizePreset;
              handleStyleChange("fontSize", value);
              if (value !== "custom" && widget.style?.customFontSize) {
                handleStyleChange("customFontSize", undefined);
              }
            }}
            className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="xs">XS (Extra Small)</option>
            <option value="sm">S (Small)</option>
            <option value="md">M (Medium)</option>
            <option value="lg">L (Large)</option>
            <option value="xl">XL (Extra Large)</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        {widget.style?.fontSize === "custom" && (
          <label className="block">
            <span className="text-xs text-muted-foreground">Custom Size (px or %)</span>
            <input
              type="text"
              value={widget.style?.customFontSize || "16px"}
              onChange={(e) => handleStyleChange("customFontSize", e.target.value)}
              className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
              placeholder="24px or 150%"
            />
          </label>
        )}
        <label className="block">
          <span className="text-xs text-muted-foreground">Opacity (%)</span>
          <input
            type="range"
            min={10}
            max={100}
            value={widget.style?.opacity ?? 100}
            onChange={(e) => handleStyleChange("opacity", parseInt(e.target.value))}
            className="mt-1 block w-full"
          />
          <div className="text-xs text-muted-foreground text-right">
            {widget.style?.opacity ?? 100}%
          </div>
        </label>
      </div>
    </div>
  );

  // Render Advanced tab
  const renderAdvancedTab = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-medium">Visibility Schedule</h4>
      </div>
      <div className="space-y-3">
        {/* Enable toggle */}
        <label className="flex items-center justify-between">
          <span className="text-sm">Enable Schedule</span>
          <button
            onClick={() => handleVisibilityChange("enabled", !widget.visibility?.enabled)}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              widget.visibility?.enabled ? "bg-primary" : "bg-muted"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                widget.visibility?.enabled ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </label>

        {widget.visibility?.enabled && (
          <>
            {/* Time range */}
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-muted-foreground">Show from</span>
                <input
                  type="time"
                  value={widget.visibility?.startTime ?? "00:00"}
                  onChange={(e) => handleVisibilityChange("startTime", e.target.value)}
                  className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs text-muted-foreground">to</span>
                <input
                  type="time"
                  value={widget.visibility?.endTime ?? "23:59"}
                  onChange={(e) => handleVisibilityChange("endTime", e.target.value)}
                  className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              Supports overnight ranges (e.g., 7pm to 7am)
            </p>

            {/* Days of week */}
            <div>
              <span className="text-xs text-muted-foreground">Days (none selected = all days)</span>
              <div className="flex gap-1 mt-2">
                {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => {
                  const isSelected = (widget.visibility?.daysOfWeek ?? []).includes(index);
                  return (
                    <button
                      key={index}
                      onClick={() => toggleDayOfWeek(index)}
                      className={cn(
                        "w-8 h-8 rounded text-xs font-medium transition-colors",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                      title={["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][index]}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="relative flex h-[70vh] w-full max-w-2xl flex-col rounded-lg bg-card border border-border shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <WidgetIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Edit {definition.name}</h2>
                <p className="text-sm text-muted-foreground capitalize">{definition.category}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1 text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border bg-muted/30">
            <button
              onClick={() => setActiveTab("setup")}
              className={cn(
                "flex-1 px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2",
                activeTab === "setup"
                  ? "text-primary border-b-2 border-primary bg-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Settings className="h-4 w-4" />
              Setup
            </button>
            <button
              onClick={() => setActiveTab("style")}
              className={cn(
                "flex-1 px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2",
                activeTab === "style"
                  ? "text-primary border-b-2 border-primary bg-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Palette className="h-4 w-4" />
              Style
            </button>
            <button
              onClick={() => setActiveTab("advanced")}
              className={cn(
                "flex-1 px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2",
                activeTab === "advanced"
                  ? "text-primary border-b-2 border-primary bg-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Clock className="h-4 w-4" />
              Advanced
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === "setup" && renderSetupTab()}
            {activeTab === "style" && renderStyleTab()}
            {activeTab === "advanced" && renderAdvancedTab()}
          </div>

          {/* Footer */}
          <div className="border-t border-border p-4 bg-muted/30 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Entity Browser Modal */}
      {showEntityBrowser && (
        <HAEntityBrowser
          isOpen={showEntityBrowser}
          onClose={() => setShowEntityBrowser(false)}
          onSelect={handleEntitySelect}
        />
      )}

      {/* Album Picker Modal */}
      {showAlbumPicker && (
        <AlbumPicker
          isOpen={showAlbumPicker}
          onClose={() => setShowAlbumPicker(false)}
          onSelect={(albumId) => {
            handleConfigChange("albumId", albumId);
            setShowAlbumPicker(false);
          }}
          selectedAlbumId={widget.config.albumId as string}
        />
      )}
    </>
  );
}
