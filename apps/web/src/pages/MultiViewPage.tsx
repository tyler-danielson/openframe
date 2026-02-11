import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { LayoutGrid, RefreshCw } from "lucide-react";
import { api, type HACamera } from "../services/api";
import { Button } from "../components/ui/Button";
import { ViewThumbnail } from "../components/multiview/ViewThumbnail";
import { MultiViewItem } from "../components/multiview/MultiViewItem";
import { SportsTicker } from "../components/SportsTicker";
import { useScreensaverStore } from "../stores/screensaver";
import { useCalendarStore } from "../stores/calendar";
import { useRemoteControlStore } from "../stores/remote-control";
import { cn } from "../lib/utils";
import {
  type MultiViewItem as MultiViewItemType,
  type AvailableItem,
  type ViewType,
  VIEW_TYPE_TABS,
  MULTIVIEW_STORAGE_KEY,
} from "../components/multiview/types";
import type { Camera as CameraType, PhotoAlbum } from "@openframe/shared";
import { REDDIT_PRESETS } from "../components/widgets/PhotoAlbumWidget";

// Weather icon helper
function getWeatherIcon(iconCode: string): string {
  const iconMap: Record<string, string> = {
    "01d": "\u2600\uFE0F",
    "01n": "\uD83C\uDF19",
    "02d": "\u26C5",
    "02n": "\u26C5",
    "03d": "\u2601\uFE0F",
    "03n": "\u2601\uFE0F",
    "04d": "\u2601\uFE0F",
    "04n": "\u2601\uFE0F",
    "09d": "\uD83C\uDF27\uFE0F",
    "09n": "\uD83C\uDF27\uFE0F",
    "10d": "\uD83C\uDF26\uFE0F",
    "10n": "\uD83C\uDF27\uFE0F",
    "11d": "\u26C8\uFE0F",
    "11n": "\u26C8\uFE0F",
    "13d": "\uD83C\uDF28\uFE0F",
    "13n": "\uD83C\uDF28\uFE0F",
    "50d": "\uD83C\uDF2B\uFE0F",
    "50n": "\uD83C\uDF2B\uFE0F",
  };
  return iconMap[iconCode] || "\u2600\uFE0F";
}

export function MultiViewPage() {
  const [activeTab, setActiveTab] = useState<ViewType>("camera");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timeFade, setTimeFade] = useState(true);
  const updateActivity = useScreensaverStore((state) => state.updateActivity);
  const { familyName, timeFormat, cycleTimeFormat } = useCalendarStore();

  // Load persisted selection from localStorage
  const [selectedItems, setSelectedItems] = useState<MultiViewItemType[]>(
    () => {
      try {
        const saved = localStorage.getItem(MULTIVIEW_STORAGE_KEY);
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
  );

  // Persist selection to localStorage
  useEffect(() => {
    localStorage.setItem(MULTIVIEW_STORAGE_KEY, JSON.stringify(selectedItems));
  }, [selectedItems]);

  // Disable screensaver while items are being viewed
  useEffect(() => {
    if (selectedItems.length > 0) {
      const interval = setInterval(() => {
        updateActivity();
      }, 30000);
      updateActivity();
      return () => clearInterval(interval);
    }
  }, [selectedItems.length, updateActivity]);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Handle time format change with fade effect
  const handleTimeFormatChange = () => {
    setTimeFade(false);
    setTimeout(() => {
      cycleTimeFormat();
      setTimeFade(true);
    }, 300);
  };

  // Format the time based on user preference
  const formattedTime = useMemo(() => {
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const seconds = currentTime.getSeconds();
    switch (timeFormat) {
      case "12h": {
        const h12 = hours % 12 || 12;
        const ampm = hours >= 12 ? "PM" : "AM";
        return `${h12}:${minutes.toString().padStart(2, "0")} ${ampm}`;
      }
      case "12h-seconds": {
        const h12 = hours % 12 || 12;
        const ampm = hours >= 12 ? "PM" : "AM";
        return `${h12}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")} ${ampm}`;
      }
      case "24h":
        return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
      case "24h-seconds":
        return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
      default:
        return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    }
  }, [currentTime, timeFormat]);

  // Fetch weather data
  const { data: weather } = useQuery({
    queryKey: ["weather-current"],
    queryFn: () => api.getCurrentWeather(),
    refetchInterval: 10 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Fetch hourly forecast
  const { data: hourlyForecast } = useQuery({
    queryKey: ["weather-hourly"],
    queryFn: () => api.getHourlyForecast(),
    refetchInterval: 30 * 60 * 1000,
    staleTime: 15 * 60 * 1000,
    retry: false,
  });

  // Fetch all data sources
  const { data: cameras = [] } = useQuery({
    queryKey: ["cameras"],
    queryFn: () => api.getCameras(),
  });

  const { data: haCameras = [] } = useQuery({
    queryKey: ["ha-cameras"],
    queryFn: () => api.getHomeAssistantCameras(),
    retry: false,
  });

  const { data: haConfig } = useQuery({
    queryKey: ["ha-config"],
    queryFn: () => api.getHomeAssistantConfig(),
  });

  const { data: albums = [] } = useQuery({
    queryKey: ["albums"],
    queryFn: () => api.getAlbums(),
  });

  const { data: calendars = [] } = useQuery({
    queryKey: ["calendars"],
    queryFn: () => api.getCalendars(),
  });

  const haConfigured = !!haConfig?.url;

  // Build available items list based on active tab
  const availableItems = useMemo((): AvailableItem[] => {
    const items: AvailableItem[] = [];

    switch (activeTab) {
      case "camera":
        // Standalone cameras
        cameras
          .filter((c) => c.isEnabled)
          .forEach((cam) => {
            items.push({
              id: `cam-standalone-${cam.id}`,
              type: "camera",
              name: cam.name,
              config: {
                cameraId: cam.id,
                cameraType: "standalone",
              },
            });
          });
        // HA cameras
        haCameras.forEach((cam) => {
          items.push({
            id: `cam-ha-${cam.entityId}`,
            type: "camera",
            name: cam.name,
            config: {
              entityId: cam.entityId,
              cameraType: "ha",
            },
          });
        });
        break;

      case "map":
        if (haConfigured) {
          items.push({
            id: "ha-map",
            type: "map",
            name: "Location Map",
            config: {},
            description: "Live family locations",
          });
        }
        break;

      case "media":
        items.push({
          id: "spotify",
          type: "media",
          name: "Spotify",
          config: {},
          description: "Now playing",
        });
        break;

      case "calendar":
        // All calendars view
        items.push({
          id: "calendar-all",
          type: "calendar",
          name: "All Events",
          config: { calendarIds: [] },
          description: "All calendars",
        });
        // Individual calendars
        calendars
          .filter((c) => c.isVisible)
          .forEach((cal) => {
            items.push({
              id: `calendar-${cal.id}`,
              type: "calendar",
              name: cal.name,
              config: { calendarIds: [cal.id] },
            });
          });
        break;

      case "image":
        // Photo albums
        albums.forEach((album: PhotoAlbum) => {
          items.push({
            id: `album-${album.id}`,
            type: "image",
            name: album.name,
            config: {
              source: "album",
              albumId: album.id,
            },
          });
        });
        // Reddit presets
        REDDIT_PRESETS.forEach((preset) => {
          items.push({
            id: `reddit-${preset.id}`,
            type: "image",
            name: preset.name,
            config: {
              source: "reddit",
              subreddit: preset.id,
            },
            description: preset.description,
          });
        });
        break;

      case "weather":
        items.push({
          id: "weather",
          type: "weather",
          name: "Weather",
          config: {},
          description: "Current conditions",
        });
        break;
    }

    return items;
  }, [
    activeTab,
    cameras,
    haCameras,
    albums,
    calendars,
    haConfigured,
  ]);

  // Check if an item is selected
  const isSelected = useCallback(
    (itemId: string) => {
      return selectedItems.some((item) => item.id === itemId);
    },
    [selectedItems]
  );

  // Toggle item selection
  const toggleItem = useCallback((item: AvailableItem) => {
    setSelectedItems((prev) => {
      const exists = prev.find((i) => i.id === item.id);
      if (exists) {
        return prev.filter((i) => i.id !== item.id);
      } else {
        return [
          ...prev,
          {
            id: item.id,
            type: item.type,
            name: item.name,
            config: item.config,
          },
        ];
      }
    });
  }, []);

  // Remove item from selection
  const removeItem = useCallback((itemId: string) => {
    setSelectedItems((prev) => prev.filter((i) => i.id !== itemId));
  }, []);

  // Clear all selections
  const clearAll = useCallback(() => {
    setSelectedItems([]);
  }, []);

  // Subscribe to remote control commands (from kiosk mode)
  const consumeCommand = useRemoteControlStore((s) => s.consumeCommand);
  const pendingCount = useRemoteControlStore((s) => s.pendingCommands.length);

  useEffect(() => {
    if (pendingCount === 0) return;

    const cmd = consumeCommand();
    if (!cmd) return;

    console.log(`[MultiView] Processing remote command: ${cmd.type}`, cmd.payload);

    switch (cmd.type) {
      case "multiview-add":
        if (cmd.payload) {
          const payload = cmd.payload as unknown as AvailableItem;
          // Validate the payload has required fields
          if (payload.id && payload.type && payload.name && payload.config) {
            // Check if item already exists
            if (!selectedItems.some((i) => i.id === payload.id)) {
              setSelectedItems((prev) => [
                ...prev,
                {
                  id: payload.id,
                  type: payload.type,
                  name: payload.name,
                  config: payload.config,
                },
              ]);
            }
          }
        }
        break;

      case "multiview-remove":
        if (cmd.payload?.itemId && typeof cmd.payload.itemId === "string") {
          removeItem(cmd.payload.itemId);
        }
        break;

      case "multiview-clear":
        clearAll();
        break;

      case "multiview-set":
        if (cmd.payload?.items && Array.isArray(cmd.payload.items)) {
          setSelectedItems(cmd.payload.items as unknown as MultiViewItemType[]);
        }
        break;

      default:
        console.warn(`[MultiView] Unknown command type: ${cmd.type}`);
    }
  }, [pendingCount, consumeCommand, selectedItems, removeItem, clearAll]);

  // Get camera data for a camera item
  const getCameraData = useCallback(
    (
      item: MultiViewItemType
    ): { standaloneCamera?: CameraType; haCamera?: HACamera } => {
      if (item.type !== "camera") return {};

      if (item.config.cameraType === "standalone" && item.config.cameraId) {
        return {
          standaloneCamera: cameras.find((c) => c.id === item.config.cameraId),
        };
      }
      if (item.config.cameraType === "ha" && item.config.entityId) {
        return {
          haCamera: haCameras.find((c) => c.entityId === item.config.entityId),
        };
      }
      return {};
    },
    [cameras, haCameras]
  );

  // Calculate grid layout based on selected count
  const getGridClass = (count: number): string => {
    if (count === 0) return "";
    if (count === 1) return "grid-cols-1";
    if (count === 2) return "grid-cols-1 md:grid-cols-2";
    if (count <= 4) return "grid-cols-2";
    if (count <= 6) return "grid-cols-2 md:grid-cols-3";
    return "grid-cols-3";
  };

  return (
    <div className="flex h-full flex-col">
      {/* Main Navigation Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-1.5 shrink-0 overflow-hidden">
        <div className="flex items-center gap-[clamp(0.5rem,1vw,1rem)] min-w-0 flex-1 whitespace-nowrap">
          <button
            onClick={handleTimeFormatChange}
            className={`text-[clamp(0.875rem,2vw,1.5rem)] font-semibold text-muted-foreground hover:text-foreground transition-opacity duration-300 ${
              timeFade ? "opacity-100" : "opacity-0"
            }`}
            title="Click to change time format"
          >
            {formattedTime}
          </button>
          {weather && (
            <div
              className="flex items-center gap-[clamp(0.25rem,0.5vw,0.5rem)] text-muted-foreground"
              title={weather.description}
            >
              <span className="text-[clamp(1rem,2.5vw,1.75rem)]">
                {getWeatherIcon(weather.icon)}
              </span>
              <span className="text-[clamp(0.875rem,2vw,1.5rem)] font-semibold">
                {weather.temp}°
              </span>
            </div>
          )}
          {hourlyForecast && hourlyForecast.length > 0 && (
            <div className="flex items-center gap-[clamp(0.5rem,1vw,1rem)] text-muted-foreground">
              {hourlyForecast.slice(0, 4).map((hour, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center text-[clamp(0.5rem,1vw,0.75rem)] leading-tight"
                >
                  <div className="flex items-center gap-0.5">
                    <span className="text-[clamp(0.625rem,1.25vw,1rem)]">
                      {getWeatherIcon(hour.icon)}
                    </span>
                    <span>{hour.temp}°</span>
                  </div>
                  <span className="-mt-0.5">{hour.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <h2 className="text-[clamp(0.75rem,1.5vw,1.125rem)] font-semibold">
            Multi-View
          </h2>
        </div>
      </div>

      {/* Sports Ticker */}
      <SportsTicker className="border-b border-border" />

      {/* Controls Header */}
      <header className="flex-shrink-0 border-b border-border bg-card">
        {/* View Type Tabs */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
          <div className="flex items-center gap-1">
            {VIEW_TYPE_TABS.map((tab) => (
              <button
                key={tab.type}
                onClick={() => setActiveTab(tab.type)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  activeTab === tab.type
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {selectedItems.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {selectedItems.length} selected
              </span>
            )}
            {selectedItems.length > 0 && (
              <Button variant="outline" size="sm" onClick={clearAll}>
                Clear All
              </Button>
            )}
          </div>
        </div>

        {/* Available Items Thumbnail Strip */}
        <div className="px-4 py-3 overflow-x-auto">
          {availableItems.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              {activeTab === "map" && !haConfigured
                ? "Connect Home Assistant to use maps"
                : `No ${activeTab}s available`}
            </div>
          ) : (
            <div className="flex gap-2">
              {availableItems.map((item) => (
                <ViewThumbnail
                  key={item.id}
                  item={item}
                  isSelected={isSelected(item.id)}
                  onClick={() => toggleItem(item)}
                />
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Main Viewing Area */}
      <div className="flex-1 p-4 overflow-auto bg-background">
        {selectedItems.length === 0 ? (
          /* Empty state */
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
            <LayoutGrid className="h-16 w-16 mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Views Selected</h3>
            <p className="text-sm text-center max-w-sm">
              Select items from the tabs above to add them to your multi-view
              dashboard.
              <br />
              Click again to remove them.
            </p>
          </div>
        ) : (
          /* View Grid */
          <div
            className={cn(
              "grid gap-4 h-full auto-rows-fr",
              getGridClass(selectedItems.length)
            )}
          >
            {selectedItems.map((item) => {
              const cameraData = getCameraData(item);
              return (
                <MultiViewItem
                  key={item.id}
                  item={item}
                  onRemove={() => removeItem(item.id)}
                  standaloneCamera={cameraData.standaloneCamera}
                  haCamera={cameraData.haCamera}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
