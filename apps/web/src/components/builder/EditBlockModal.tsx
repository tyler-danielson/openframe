import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { useHAWebSocket, useHALocations as useHALocationsWS, useHAZones as useHAZonesWS } from "../../stores/homeassistant-ws";
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
  Tv,
  LayoutGrid,
  Navigation,
  Loader2,
  User,
  MapPin,
  ChevronRight,
  Search,
  Home,
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
  LayoutGrid,
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

      {/* Max Events */}
      <label className="block">
        <span className="text-sm">Max Events</span>
        <input
          type="number"
          min={1}
          max={50}
          value={config.maxItems as number ?? 10}
          onChange={(e) => handleConfigChange("maxItems", parseInt(e.target.value) || 10)}
          className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
        />
      </label>

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

function IptvConfigFields({
  config,
  handleConfigChange,
}: {
  config: Record<string, unknown>;
  handleConfigChange: (key: string, value: unknown) => void;
}) {
  const { data: favorites = [] } = useQuery({
    queryKey: ["iptv-favorites"],
    queryFn: () => api.getIptvFavorites(),
    staleTime: 60_000,
  });

  const { data: channels = [] } = useQuery({
    queryKey: ["iptv-channels-all"],
    queryFn: () => api.getIptvChannels(),
    staleTime: 60_000,
  });

  const currentChannelId = config.channelId as string ?? "";
  const favoriteIds = new Set(favorites.map((f) => f.id));
  const nonFavoriteChannels = channels.filter((ch) => !favoriteIds.has(ch.id));

  return (
    <>
      <label className="block">
        <span className="text-sm">Channel</span>
        <select
          value={currentChannelId}
          onChange={(e) => handleConfigChange("channelId", e.target.value)}
          className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">Select a channel...</option>
          {favorites.length > 0 && (
            <optgroup label="Favorites">
              {favorites.map((ch) => (
                <option key={ch.id} value={ch.id}>{ch.name}</option>
              ))}
            </optgroup>
          )}
          {nonFavoriteChannels.length > 0 && (
            <optgroup label="All Channels">
              {nonFavoriteChannels.map((ch) => (
                <option key={ch.id} value={ch.id}>{ch.name}</option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      <label className="flex items-center justify-between">
        <span className="text-sm">Show Controls</span>
        <input
          type="checkbox"
          checked={config.showControls as boolean ?? true}
          onChange={(e) => handleConfigChange("showControls", e.target.checked)}
          className="rounded"
        />
      </label>
      <label className="flex items-center justify-between">
        <span className="text-sm">Auto Play</span>
        <input
          type="checkbox"
          checked={config.autoPlay as boolean ?? true}
          onChange={(e) => handleConfigChange("autoPlay", e.target.checked)}
          className="rounded"
        />
      </label>
      <label className="flex items-center justify-between">
        <span className="text-sm">Muted</span>
        <input
          type="checkbox"
          checked={config.muted as boolean ?? true}
          onChange={(e) => handleConfigChange("muted", e.target.checked)}
          className="rounded"
        />
      </label>
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

      case "iptv":
        return <IptvConfigFields config={config} handleConfigChange={handleConfigChange} />;

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

      case "week-schedule":
        const weekViewMode = (config.viewMode as string) ?? "fixed";
        return (
          <>
            <CalendarConfigFields config={config} handleConfigChange={handleConfigChange} />

            {/* Number of Days */}
            <label className="block">
              <span className="text-sm">Number of Days</span>
              <select
                value={config.numberOfDays as number ?? 5}
                onChange={(e) => handleConfigChange("numberOfDays", parseInt(e.target.value))}
                className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
              >
                <option value={3}>3 days</option>
                <option value={4}>4 days</option>
                <option value={5}>5 days</option>
                <option value={6}>6 days</option>
                <option value={7}>7 days</option>
              </select>
            </label>

            {/* Start From */}
            <label className="block">
              <span className="text-sm">Start From</span>
              <select
                value={config.startDay as string ?? "today"}
                onChange={(e) => handleConfigChange("startDay", e.target.value)}
                className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="today">Today</option>
                <option value="weekStart">Week Start (Monday)</option>
              </select>
            </label>

            {/* View Mode */}
            <label className="block">
              <span className="text-sm">View Mode</span>
              <select
                value={weekViewMode}
                onChange={(e) => handleConfigChange("viewMode", e.target.value)}
                className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="fixed">Fixed Hours</option>
                <option value="rolling">Rolling Window</option>
              </select>
            </label>

            {/* Fixed mode options */}
            {weekViewMode === "fixed" && (
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
            {weekViewMode === "rolling" && (
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
              <span className="text-sm">Show All-Day Events</span>
              <input
                type="checkbox"
                checked={config.showAllDayEvents as boolean ?? true}
                onChange={(e) => handleConfigChange("showAllDayEvents", e.target.checked)}
                className="rounded"
              />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm">Show Day Headers</span>
              <input
                type="checkbox"
                checked={config.showDayHeaders as boolean ?? true}
                onChange={(e) => handleConfigChange("showDayHeaders", e.target.checked)}
                className="rounded"
              />
            </label>
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

      case "photo-feed":
        return (
          <>
            {/* Source Selection */}
            <label className="block">
              <span className="text-sm">Source</span>
              <select
                value={config.source as string ?? "reddit"}
                onChange={(e) => handleConfigChange("source", e.target.value)}
                className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="album">Local Album</option>
                <option value="reddit">Reddit</option>
                <option value="custom-urls">Custom URLs</option>
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

            {(config.source === "reddit" || config.source === undefined) && (
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

            {config.source === "custom-urls" && (
              <label className="block">
                <span className="text-sm">Image URLs (one per line)</span>
                <textarea
                  value={((config.customUrls as string[]) ?? []).join("\n")}
                  onChange={(e) => handleConfigChange("customUrls", e.target.value.split("\n").filter((u) => u.trim()))}
                  className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm resize-none"
                  rows={4}
                  placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
                />
              </label>
            )}

            {/* Layout */}
            <label className="block">
              <span className="text-sm">Layout</span>
              <select
                value={config.layout as string ?? "grid"}
                onChange={(e) => handleConfigChange("layout", e.target.value)}
                className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="grid">Grid</option>
                <option value="single">Single (Rotating)</option>
              </select>
            </label>

            {/* Number of images - grid only */}
            {(config.layout as string ?? "grid") === "grid" && (
              <label className="block">
                <span className="text-sm">Number of Images</span>
                <input
                  type="number"
                  min={2}
                  max={20}
                  value={config.numberOfImages as number ?? 6}
                  onChange={(e) => handleConfigChange("numberOfImages", parseInt(e.target.value) || 6)}
                  className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
            )}

            {/* Refresh Interval */}
            <label className="block">
              <span className="text-sm">Refresh Interval (seconds)</span>
              <input
                type="number"
                min={10}
                max={3600}
                value={config.refreshInterval as number ?? 300}
                onChange={(e) => handleConfigChange("refreshInterval", parseInt(e.target.value) || 300)}
                className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
              />
            </label>

            {/* Orientation filter */}
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

            {/* Gap - grid only */}
            {(config.layout as string ?? "grid") === "grid" && (
              <label className="block">
                <span className="text-sm">Gap (px)</span>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={config.gap as number ?? 4}
                  onChange={(e) => handleConfigChange("gap", parseInt(e.target.value) || 0)}
                  className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
            )}

            {/* Toggles */}
            <label className="flex items-center justify-between">
              <span className="text-sm">Shuffle Photos</span>
              <input
                type="checkbox"
                checked={config.shuffle as boolean ?? true}
                onChange={(e) => handleConfigChange("shuffle", e.target.checked)}
                className="rounded"
              />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm">Show Titles</span>
              <input
                type="checkbox"
                checked={config.showTitles as boolean ?? false}
                onChange={(e) => handleConfigChange("showTitles", e.target.checked)}
                className="rounded"
              />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm">Rounded Corners</span>
              <input
                type="checkbox"
                checked={config.roundedCorners as boolean ?? true}
                onChange={(e) => handleConfigChange("roundedCorners", e.target.checked)}
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
          <HAMapConfig config={config} onConfigChange={handleConfigChange} />
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

// Extracted HA Map config component with device and zone picker popups
function HAMapConfig({
  config,
  onConfigChange,
}: {
  config: Record<string, unknown>;
  onConfigChange: (key: string, value: unknown) => void;
}) {
  const selectedDevices = (config.selectedDevices as string[]) ?? [];
  const selectedZones = (config.selectedZones as string[]) ?? [];
  const deviceIcons = (config.deviceIcons as Record<string, string>) ?? {};
  const [showDevicePicker, setShowDevicePicker] = useState(false);
  const [showZonePicker, setShowZonePicker] = useState(false);
  const [zoneSearch, setZoneSearch] = useState("");
  const [deviceSearch, setDeviceSearch] = useState("");
  const [iconPickerFor, setIconPickerFor] = useState<string | null>(null);

  // Fetch available location entities
  const { locations: wsLocations, connected: wsConnected } = useHALocationsWS();
  const wsZones = useHAZonesWS();
  const wsConnecting = useHAWebSocket((s) => s.connecting);

  const { data: restLocations = [] } = useQuery({
    queryKey: ["ha-locations-rest-config"],
    queryFn: () => api.getHomeAssistantLocations(),
    enabled: !wsConnected && !wsConnecting,
    staleTime: 60 * 1000,
  });

  const { data: restZones = [] } = useQuery({
    queryKey: ["ha-zones-rest-config"],
    queryFn: () => api.getHomeAssistantZones(),
    enabled: !wsConnected && !wsConnecting,
    staleTime: 60 * 1000,
  });

  const availableDevices = wsConnected && wsLocations.length > 0
    ? wsLocations
    : restLocations;

  const availableZones = wsConnected && wsZones.length > 0
    ? wsZones
    : restZones;

  const filteredDevices = useMemo(() => {
    if (!deviceSearch.trim()) return availableDevices;
    const q = deviceSearch.toLowerCase();
    return availableDevices.filter(
      (d) => d.name.toLowerCase().includes(q) || d.entityId.toLowerCase().includes(q),
    );
  }, [availableDevices, deviceSearch]);

  const filteredZones = useMemo(() => {
    if (!zoneSearch.trim()) return availableZones;
    const q = zoneSearch.toLowerCase();
    return availableZones.filter(
      (z) => z.name.toLowerCase().includes(q) || z.entityId.toLowerCase().includes(q),
    );
  }, [availableZones, zoneSearch]);

  const toggleDevice = useCallback((entityId: string) => {
    const current = (config.selectedDevices as string[]) ?? [];
    if (current.includes(entityId)) {
      onConfigChange("selectedDevices", current.filter((id: string) => id !== entityId));
    } else {
      onConfigChange("selectedDevices", [...current, entityId]);
    }
  }, [config.selectedDevices, onConfigChange]);

  const toggleZone = useCallback((entityId: string) => {
    const current = (config.selectedZones as string[]) ?? [];
    if (current.includes(entityId)) {
      onConfigChange("selectedZones", current.filter((id: string) => id !== entityId));
    } else {
      onConfigChange("selectedZones", [...current, entityId]);
    }
  }, [config.selectedZones, onConfigChange]);

  const PERSON_EMOJIS = [
    "👨", "👩", "🧑", "👦", "👧", "👶", "🧓",
    "🚗", "🚙", "🏍", "🚲", "🛴", "🚎", "✈️",
    "🏃", "🚶", "🐕", "🐈", "⭐", "❤️", "💼",
    "🏫", "🏢", "🎯", "📍", "🔵", "🟢", "🟡",
  ];

  const setDeviceIcon = useCallback((entityId: string, emoji: string | null) => {
    const current = { ...deviceIcons };
    if (emoji) {
      current[entityId] = emoji;
    } else {
      delete current[entityId];
    }
    onConfigChange("deviceIcons", current);
  }, [deviceIcons, onConfigChange]);

  // Device names summary
  const deviceSummary = selectedDevices.length === 0
    ? "All devices"
    : selectedDevices.length === 1
      ? availableDevices.find((d) => d.entityId === selectedDevices[0])?.name ?? "1 device"
      : `${selectedDevices.length} devices`;

  // Zone names summary
  const zoneSummary = selectedZones.length === 0
    ? "None"
    : selectedZones.length === 1
      ? availableZones.find((z) => z.entityId === selectedZones[0])?.name ?? "1 zone"
      : `${selectedZones.length} zones`;

  return (
    <>
      <label className="flex items-center justify-between">
        <span className="text-sm">Show Device Names</span>
        <input
          type="checkbox"
          checked={config.showDeviceNames as boolean ?? true}
          onChange={(e) => onConfigChange("showDeviceNames", e.target.checked)}
          className="rounded"
        />
      </label>
      <label className="flex items-center justify-between">
        <span className="text-sm">Dark Mode</span>
        <input
          type="checkbox"
          checked={config.darkMode as boolean ?? true}
          onChange={(e) => onConfigChange("darkMode", e.target.checked)}
          className="rounded"
        />
      </label>
      <label className="flex items-center justify-between">
        <span className="text-sm">Auto Fit Bounds</span>
        <input
          type="checkbox"
          checked={config.autoFitBounds as boolean ?? true}
          onChange={(e) => onConfigChange("autoFitBounds", e.target.checked)}
          className="rounded"
        />
      </label>
      <label className="flex items-center justify-between">
        <span className="text-sm">Show Last Updated</span>
        <input
          type="checkbox"
          checked={config.showLastUpdated as boolean ?? false}
          onChange={(e) => onConfigChange("showLastUpdated", e.target.checked)}
          className="rounded"
        />
      </label>
      <label className="flex items-center justify-between">
        <div>
          <span className="text-sm">Show ETA to Home</span>
          <p className="text-xs text-muted-foreground">Driving time for away devices</p>
        </div>
        <input
          type="checkbox"
          checked={config.showEta as boolean ?? false}
          onChange={(e) => onConfigChange("showEta", e.target.checked)}
          className="rounded"
        />
      </label>

      {/* People on Map - trigger button */}
      <div className="pt-2 border-t border-border">
        <button
          type="button"
          onClick={() => { setShowDevicePicker(true); setDeviceSearch(""); }}
          className="w-full flex items-center justify-between p-2.5 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <User className="h-4 w-4 text-primary" />
            <div className="text-left">
              <span className="text-sm font-medium block">People on Map</span>
              <span className="text-xs text-muted-foreground">{deviceSummary}</span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Zones on Map - trigger button */}
      <div>
        <button
          type="button"
          onClick={() => { setShowZonePicker(true); setZoneSearch(""); }}
          className="w-full flex items-center justify-between p-2.5 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <MapPin className="h-4 w-4 text-primary" />
            <div className="text-left">
              <span className="text-sm font-medium block">Zones on Map</span>
              <span className="text-xs text-muted-foreground">{zoneSummary}</span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Device picker popup */}
      {showDevicePicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setShowDevicePicker(false)}>
          <div
            className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm mx-4 max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-sm font-semibold">People on Map</h3>
              <div className="flex items-center gap-2">
                {selectedDevices.length > 0 && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => onConfigChange("selectedDevices", [])}
                  >
                    Show all
                  </button>
                )}
                <button type="button" onClick={() => setShowDevicePicker(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            {availableDevices.length > 4 && (
              <div className="px-4 pt-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={deviceSearch}
                    onChange={(e) => setDeviceSearch(e.target.value)}
                    placeholder="Search people..."
                    className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
                    autoFocus
                  />
                </div>
              </div>
            )}
            <div className="p-3 flex-1 overflow-y-auto">
              <p className="text-xs text-muted-foreground mb-2 px-1">
                {selectedDevices.length === 0
                  ? "All people visible. Uncheck to hide."
                  : `${selectedDevices.length} of ${availableDevices.length} selected`}
              </p>
              {wsConnecting && availableDevices.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Connecting...</span>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {filteredDevices.map((device) => {
                    const isSelected = selectedDevices.length === 0 || selectedDevices.includes(device.entityId);
                    const currentIcon = deviceIcons[device.entityId];
                    const showingIconPicker = iconPickerFor === device.entityId;
                    return (
                      <div key={device.entityId}>
                        <label
                          className={cn(
                            "flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors",
                            isSelected ? "bg-primary/10" : "hover:bg-muted/50 opacity-50",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              if (selectedDevices.length === 0) {
                                const allExcept = availableDevices
                                  .map((d) => d.entityId)
                                  .filter((id) => id !== device.entityId);
                                onConfigChange("selectedDevices", allExcept);
                              } else {
                                toggleDevice(device.entityId);
                              }
                            }}
                            className="rounded"
                          />
                          {currentIcon ? (
                            <span className="text-lg leading-none w-6 h-6 flex items-center justify-center shrink-0">{currentIcon}</span>
                          ) : device.entityPictureUrl ? (
                            <img src={device.entityPictureUrl} alt={device.name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                          ) : (
                            <User className="h-5 w-5 text-muted-foreground shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <span className="text-sm block truncate">{device.name}</span>
                            <span className="text-[10px] text-muted-foreground block truncate">{device.entityId}</span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setIconPickerFor(showingIconPicker ? null : device.entityId);
                            }}
                            className={cn(
                              "shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-xs transition-colors",
                              currentIcon
                                ? "bg-primary/10 hover:bg-primary/20"
                                : "bg-muted/50 hover:bg-muted text-muted-foreground",
                            )}
                            title="Change icon"
                          >
                            {currentIcon || "😀"}
                          </button>
                        </label>
                        {showingIconPicker && (
                          <div className="ml-8 mr-2 mb-1 p-2 rounded-lg bg-muted/30 border border-border">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Map Icon</span>
                              {currentIcon && (
                                <button
                                  type="button"
                                  className="text-[10px] text-destructive hover:underline"
                                  onClick={() => { setDeviceIcon(device.entityId, null); setIconPickerFor(null); }}
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {PERSON_EMOJIS.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => { setDeviceIcon(device.entityId, emoji); setIconPickerFor(null); }}
                                  className={cn(
                                    "w-8 h-8 rounded-md flex items-center justify-center text-base hover:bg-primary/10 transition-colors",
                                    currentIcon === emoji && "bg-primary/20 ring-1 ring-primary/50",
                                  )}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {filteredDevices.length === 0 && deviceSearch && (
                    <p className="text-xs text-muted-foreground py-3 text-center">No match for "{deviceSearch}"</p>
                  )}
                </div>
              )}
            </div>
            <div className="p-3 border-t border-border">
              <button
                type="button"
                onClick={() => setShowDevicePicker(false)}
                className="w-full py-1.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zone picker popup */}
      {showZonePicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setShowZonePicker(false)}>
          <div
            className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm mx-4 max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-sm font-semibold">Zones on Map</h3>
              <div className="flex items-center gap-2">
                {selectedZones.length > 0 && (
                  <button
                    type="button"
                    className="text-xs text-destructive hover:underline"
                    onClick={() => onConfigChange("selectedZones", [])}
                  >
                    Clear all
                  </button>
                )}
                <button type="button" onClick={() => setShowZonePicker(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="px-4 pt-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={zoneSearch}
                  onChange={(e) => setZoneSearch(e.target.value)}
                  placeholder="Search zones..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
                  autoFocus
                />
              </div>
            </div>
            <div className="p-3 flex-1 overflow-y-auto">
              <p className="text-xs text-muted-foreground mb-2 px-1">
                {selectedZones.length === 0
                  ? "No zones shown. Check zones to add them."
                  : `${selectedZones.length} zone${selectedZones.length === 1 ? "" : "s"} on map`}
              </p>
              {wsConnecting && availableZones.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Connecting...</span>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {filteredZones.map((zone) => {
                    const isHome = zone.entityId === "zone.home";
                    const isSelected = selectedZones.includes(zone.entityId);
                    return (
                      <label
                        key={zone.entityId}
                        className={cn(
                          "flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors",
                          isSelected ? "bg-primary/10" : "hover:bg-muted/50",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleZone(zone.entityId)}
                          className="rounded"
                        />
                        <div className={cn(
                          "w-6 h-6 rounded-md flex items-center justify-center shrink-0",
                          isHome ? "bg-green-500/20" : "bg-indigo-500/20",
                        )}>
                          {isHome ? (
                            <Home className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <MapPin className="h-3.5 w-3.5 text-indigo-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-sm block truncate">{zone.name}</span>
                          <span className="text-[10px] text-muted-foreground block truncate">{zone.entityId}</span>
                        </div>
                      </label>
                    );
                  })}
                  {filteredZones.length === 0 && zoneSearch && (
                    <p className="text-xs text-muted-foreground py-3 text-center">No match for "{zoneSearch}"</p>
                  )}
                  {availableZones.length === 0 && !wsConnecting && (
                    <p className="text-xs text-muted-foreground py-3 text-center">No zones found in Home Assistant</p>
                  )}
                </div>
              )}
            </div>
            <div className="p-3 border-t border-border">
              <button
                type="button"
                onClick={() => setShowZonePicker(false)}
                className="w-full py-1.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
