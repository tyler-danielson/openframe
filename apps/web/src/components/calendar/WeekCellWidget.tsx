import { useMemo, useState, useEffect, useRef, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, isSameMonth } from "date-fns";
import {
  Camera,
  MapPin,
  Music,
  Home,
  Pause,
  Play,
  Loader2,
} from "lucide-react";
import type { CalendarEvent, HomeAssistantEntity } from "@openframe/shared";
import { cn } from "../../lib/utils";
import { api, type HACamera } from "../../services/api";
import { useHAWebSocket, useHALocations } from "../../stores/homeassistant-ws";
import { useAuthStore } from "../../stores/auth";
import type { WeekCellWidget as WeekCellWidgetType } from "../../stores/calendar";

// Lazy load the LocationMap component
const LocationMap = lazy(() =>
  import("../homeassistant/LocationMap").then((m) => ({ default: m.LocationMap }))
);

interface NextWeekData {
  start: Date;
  end: Date;
  events: CalendarEvent[];
}

interface WeekCellWidgetProps {
  mode: WeekCellWidgetType;
  nextWeekData: NextWeekData;
  calendarMap: Map<string, { id: string; color: string; icon?: string }>;
  onSelectEvent?: (event: CalendarEvent) => void;
}

// Format time, removing :00 for top-of-hour times
function formatTime(date: Date): string {
  const minutes = date.getMinutes();
  return minutes === 0
    ? format(date, "h a")
    : format(date, "h:mm a");
}

// Next Week Widget - extracted from WeekGridView
function NextWeekWidget({
  nextWeekData,
  calendarMap,
  onSelectEvent,
}: {
  nextWeekData: NextWeekData;
  calendarMap: Map<string, { id: string; color: string; icon?: string }>;
  onSelectEvent?: (event: CalendarEvent) => void;
}) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-2 border-b border-white bg-muted h-16 flex flex-col justify-center shrink-0">
        <p className="text-2xl font-bold text-foreground">Next Week</p>
        <p className="text-xs text-muted-foreground">
          {isSameMonth(nextWeekData.start, nextWeekData.end)
            ? `${format(nextWeekData.start, "MMMM d")} - ${format(nextWeekData.end, "d")}`
            : `${format(nextWeekData.start, "MMMM d")} - ${format(nextWeekData.end, "MMMM d")}`}
        </p>
      </div>
      <div className="flex-1 p-2 space-y-1 overflow-y-auto min-h-0">
        {nextWeekData.events.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No events
          </p>
        ) : (
          nextWeekData.events.map((event) => {
            const cal = calendarMap.get(event.calendarId);
            return (
              <button
                key={event.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEvent?.(event);
                }}
                className="w-full text-left rounded-md px-2 py-2 text-xs hover:bg-muted/80 transition-colors bg-muted/50 border border-border/50"
              >
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-foreground">{event.title}</p>
                    <p className="text-muted-foreground">
                      {format(new Date(event.startTime), "EEE, MMM d")}
                      {!event.isAllDay && (
                        <> · {formatTime(new Date(event.startTime))}</>
                      )}
                    </p>
                  </div>
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] flex-shrink-0"
                    style={{ backgroundColor: cal?.color ?? "#3B82F6" }}
                  >
                    {cal?.icon ?? "📅"}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// Camera Widget - shows first available camera feed
function CameraWidget() {
  const { accessToken, apiKey } = useAuthStore();
  const authToken = accessToken || apiKey;
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval>>();

  // Fetch standalone cameras
  const { data: cameras = [] } = useQuery({
    queryKey: ["cameras"],
    queryFn: () => api.getCameras(),
    staleTime: 60000,
  });

  // Fetch HA cameras
  const { data: haCameras = [] } = useQuery({
    queryKey: ["homeassistant", "cameras"],
    queryFn: () => api.getHomeAssistantCameras(),
    staleTime: 60000,
  });

  // Get first available camera
  const camera = useMemo(() => {
    if (cameras.length > 0) {
      return { type: "standalone" as const, camera: cameras[0]! };
    }
    if (haCameras.length > 0) {
      return { type: "ha" as const, camera: haCameras[0]! };
    }
    return null;
  }, [cameras, haCameras]);

  const getSnapshotUrl = () => {
    if (!camera) return null;
    if (camera.type === "standalone") {
      return `${api.getCameraSnapshotUrl(camera.camera.id)}?token=${authToken}&t=${Date.now()}`;
    }
    return `${api.getHACameraSnapshotUrl(camera.camera.entityId)}?token=${authToken}&t=${Date.now()}`;
  };

  // Refresh snapshot periodically
  useEffect(() => {
    if (!camera) return;

    const loadImage = () => {
      const url = getSnapshotUrl();
      if (url && imgRef.current) {
        imgRef.current.src = url;
      }
    };

    loadImage();
    refreshIntervalRef.current = setInterval(loadImage, 5000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [camera, accessToken]);

  if (!camera) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b border-white bg-muted h-16 flex items-center gap-2">
          <Camera className="h-5 w-5 text-muted-foreground" />
          <p className="text-2xl font-bold text-foreground">Camera</p>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-muted-foreground text-center">
            No cameras configured
          </p>
        </div>
      </div>
    );
  }

  const cameraName = camera.type === "standalone" ? camera.camera.name : camera.camera.name;

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-white bg-muted h-16 flex items-center gap-2">
        <Camera className="h-5 w-5 text-muted-foreground" />
        <p className="text-lg font-bold text-foreground truncate">{cameraName}</p>
      </div>
      <div className="flex-1 relative bg-black overflow-hidden">
        <img
          ref={imgRef}
          alt={cameraName}
          className={cn(
            "absolute inset-0 w-full h-full object-cover",
            !imageLoaded && "hidden"
          )}
          onLoad={() => {
            setImageLoaded(true);
            setHasError(false);
          }}
          onError={() => {
            setImageLoaded(false);
            setHasError(true);
          }}
        />
        {!imageLoaded && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Camera className="h-8 w-8 text-muted-foreground/50" />
          </div>
        )}
      </div>
    </div>
  );
}

// Map Widget - shows HA locations
function MapWidget() {
  const { locations, connected } = useHALocations();
  const wsConnecting = useHAWebSocket((state) => state.connecting);

  // Check if HA is configured
  const { data: config, isLoading: isLoadingConfig } = useQuery({
    queryKey: ["homeassistant", "config"],
    queryFn: () => api.getHomeAssistantConfig(),
    staleTime: 60000,
  });

  const isConfigured = !!(config && config.url);

  if (isLoadingConfig || wsConnecting) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b border-white bg-muted h-16 flex items-center gap-2">
          <MapPin className="h-5 w-5 text-muted-foreground" />
          <p className="text-2xl font-bold text-foreground">Map</p>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b border-white bg-muted h-16 flex items-center gap-2">
          <MapPin className="h-5 w-5 text-muted-foreground" />
          <p className="text-2xl font-bold text-foreground">Map</p>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-muted-foreground text-center">
            Home Assistant not connected
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-white bg-muted h-16 flex items-center gap-2">
        <MapPin className="h-5 w-5 text-muted-foreground" />
        <p className="text-lg font-bold text-foreground">
          Locations
          {locations.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({locations.length})
            </span>
          )}
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <Suspense
          fallback={
            <div className="h-full flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          }
        >
          <LocationMap height="100%" className="rounded-none border-0" />
        </Suspense>
      </div>
    </div>
  );
}

// Spotify Widget - compact now playing
function SpotifyWidget() {
  // Fetch playback state
  const { data: playback, isLoading } = useQuery({
    queryKey: ["spotify", "playback", "week-widget"],
    queryFn: () => api.getSpotifyPlayback(),
    refetchInterval: 5000,
    staleTime: 3000,
  });

  // Check if Spotify is connected
  const { data: spotifyStatus } = useQuery({
    queryKey: ["spotify", "status"],
    queryFn: () => api.getSpotifyStatus(),
    staleTime: 60000,
  });

  const isConnected = spotifyStatus?.accounts && spotifyStatus.accounts.length > 0;

  const handlePlayPause = async () => {
    if (!playback) return;
    if (playback.is_playing) {
      await api.spotifyPause();
    } else {
      await api.spotifyPlay();
    }
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b border-white bg-muted h-16 flex items-center gap-2">
          <Music className="h-5 w-5 text-muted-foreground" />
          <p className="text-2xl font-bold text-foreground">Spotify</p>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-muted-foreground text-center">
            Spotify not connected
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b border-white bg-muted h-16 flex items-center gap-2">
          <Music className="h-5 w-5 text-muted-foreground" />
          <p className="text-2xl font-bold text-foreground">Spotify</p>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!playback || !playback.item) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b border-white bg-muted h-16 flex items-center gap-2">
          <Music className="h-5 w-5 text-muted-foreground" />
          <p className="text-2xl font-bold text-foreground">Spotify</p>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-muted-foreground text-center">
            Not playing
          </p>
        </div>
      </div>
    );
  }

  const { item, is_playing, progress_ms } = playback;
  const albumArt = item.album.images[0]?.url;
  const artistNames = item.artists.map((a) => a.name).join(", ");
  const progressPercent = (progress_ms / item.duration_ms) * 100;

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-white bg-muted h-16 flex items-center gap-2">
        <Music className="h-5 w-5 text-green-500" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground truncate">{item.name}</p>
          <p className="text-xs text-muted-foreground truncate">{artistNames}</p>
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        {/* Album art */}
        <div className="flex-1 relative overflow-hidden">
          {albumArt ? (
            <img
              src={albumArt}
              alt={item.album.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <Music className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
          {/* Play/Pause overlay */}
          <button
            onClick={handlePlayPause}
            className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity"
          >
            {is_playing ? (
              <Pause className="h-12 w-12 text-white" />
            ) : (
              <Play className="h-12 w-12 text-white" />
            )}
          </button>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-green-500 transition-all duration-1000 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// Home Control Widget - shows HA entity toggles
function HomeControlWidget() {
  const entityStates = useHAWebSocket((state) => state.entityStates);
  const wsConnected = useHAWebSocket((state) => state.connected);
  const callService = useHAWebSocket((state) => state.callService);

  // Fetch dashboard entities
  const { data: entities = [], isLoading } = useQuery({
    queryKey: ["homeassistant", "entities"],
    queryFn: () => api.getHomeAssistantEntities(),
    staleTime: 30000,
  });

  // Check if HA is configured
  const { data: config, isLoading: isLoadingConfig } = useQuery({
    queryKey: ["homeassistant", "config"],
    queryFn: () => api.getHomeAssistantConfig(),
    staleTime: 60000,
  });

  const isConfigured = !!(config && config.url);

  // Filter to dashboard-enabled entities and get first 4
  const dashboardEntities = useMemo(() => {
    return entities
      .filter((e) => e.showInDashboard)
      .slice(0, 4);
  }, [entities]);

  const handleToggle = async (entity: HomeAssistantEntity) => {
    const domain = entity.entityId.split(".")[0];
    if (!domain) return;

    try {
      if (domain === "lock") {
        const state = entityStates.get(entity.entityId);
        const isLocked = state?.state === "locked";
        await callService("lock", isLocked ? "unlock" : "lock", { entity_id: entity.entityId });
      } else {
        await callService(domain, "toggle", { entity_id: entity.entityId });
      }
    } catch (error) {
      console.error("Failed to toggle entity:", error);
    }
  };

  if (isLoadingConfig || isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b border-white bg-muted h-16 flex items-center gap-2">
          <Home className="h-5 w-5 text-muted-foreground" />
          <p className="text-2xl font-bold text-foreground">Home</p>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b border-white bg-muted h-16 flex items-center gap-2">
          <Home className="h-5 w-5 text-muted-foreground" />
          <p className="text-2xl font-bold text-foreground">Home</p>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-muted-foreground text-center">
            Home Assistant not connected
          </p>
        </div>
      </div>
    );
  }

  if (dashboardEntities.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b border-white bg-muted h-16 flex items-center gap-2">
          <Home className="h-5 w-5 text-muted-foreground" />
          <p className="text-2xl font-bold text-foreground">Home</p>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-muted-foreground text-center">
            No Home Assistant entities
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-white bg-muted h-16 flex items-center gap-2">
        <Home className="h-5 w-5 text-muted-foreground" />
        <p className="text-2xl font-bold text-foreground">Home</p>
        {!wsConnected && (
          <span className="text-xs text-yellow-500">(offline)</span>
        )}
      </div>
      <div className="flex-1 p-2 grid grid-cols-2 gap-2">
        {dashboardEntities.map((entity) => {
          const state = entityStates.get(entity.entityId);
          const isOn = state?.state === "on" || state?.state === "unlocked" || state?.state === "open";
          const domain = entity.entityId.split(".")[0];
          const isControllable = ["light", "switch", "fan", "input_boolean", "lock", "cover"].includes(domain || "");
          const displayName = entity.displayName || (state?.attributes?.friendly_name as string) || entity.entityId;

          return (
            <button
              key={entity.id}
              onClick={() => isControllable && handleToggle(entity)}
              disabled={!isControllable}
              className={cn(
                "rounded-lg p-3 text-left transition-all",
                isOn
                  ? "bg-primary/20 border-2 border-primary"
                  : "bg-muted/50 border border-border/50",
                isControllable && "hover:bg-muted cursor-pointer"
              )}
            >
              <p className="text-xs font-medium truncate">{displayName}</p>
              <p className={cn(
                "text-[10px] uppercase",
                isOn ? "text-primary" : "text-muted-foreground"
              )}>
                {state?.state || "unknown"}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WeekCellWidget({
  mode,
  nextWeekData,
  calendarMap,
  onSelectEvent,
}: WeekCellWidgetProps) {
  return (
    <div className="flex flex-col border-r border-b border-white bg-card min-h-0">
      {mode === "next-week" && (
        <NextWeekWidget
          nextWeekData={nextWeekData}
          calendarMap={calendarMap}
          onSelectEvent={onSelectEvent}
        />
      )}
      {mode === "camera" && <CameraWidget />}
      {mode === "map" && <MapWidget />}
      {mode === "spotify" && <SpotifyWidget />}
      {mode === "home-control" && <HomeControlWidget />}
    </div>
  );
}
