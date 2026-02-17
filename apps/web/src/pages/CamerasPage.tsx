import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Camera, RefreshCw, Home, Video } from "lucide-react";
import { api, type HACamera } from "../services/api";
import { CastButton } from "../components/cast/CastButton";
import { Button } from "../components/ui/Button";
import { CameraThumbnail } from "../components/cameras/CameraThumbnail";
import { CameraViewer } from "../components/cameras/CameraViewer";
import { CameraFeed } from "../components/cameras/CameraFeed";
import { HACameraFeed } from "../components/cameras/HACameraFeed";
import { AddCameraModal } from "../components/cameras/AddCameraModal";
import { SportsTicker } from "../components/SportsTicker";
import { useScreensaverStore } from "../stores/screensaver";
import { useCalendarStore } from "../stores/calendar";
import { useRemoteControlStore } from "../stores/remote-control";
import { cn } from "../lib/utils";
import type { Camera as CameraType } from "@openframe/shared";

// Weather icon helper
function getWeatherIcon(iconCode: string): string {
  const iconMap: Record<string, string> = {
    "01d": "\u2600\uFE0F", "01n": "\uD83C\uDF19",
    "02d": "\u26C5", "02n": "\u26C5",
    "03d": "\u2601\uFE0F", "03n": "\u2601\uFE0F",
    "04d": "\u2601\uFE0F", "04n": "\u2601\uFE0F",
    "09d": "\uD83C\uDF27\uFE0F", "09n": "\uD83C\uDF27\uFE0F",
    "10d": "\uD83C\uDF26\uFE0F", "10n": "\uD83C\uDF27\uFE0F",
    "11d": "\u26C8\uFE0F", "11n": "\u26C8\uFE0F",
    "13d": "\uD83C\uDF28\uFE0F", "13n": "\uD83C\uDF28\uFE0F",
    "50d": "\uD83C\uDF2B\uFE0F", "50n": "\uD83C\uDF2B\uFE0F",
  };
  return iconMap[iconCode] || "\u2600\uFE0F";
}

// Storage key for persisting selected cameras
const STORAGE_KEY = "camera-view-selection";

interface SelectedCamera {
  id: string;
  type: "standalone" | "ha";
}

export function CamerasPage() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [fullscreenCamera, setFullscreenCamera] = useState<SelectedCamera | null>(null);
  const updateActivity = useScreensaverStore((state) => state.updateActivity);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timeFade, setTimeFade] = useState(true);

  const { familyName, timeFormat, cycleTimeFormat } = useCalendarStore();

  // Fetch weather data
  const { data: weather } = useQuery({
    queryKey: ["weather-current"],
    queryFn: () => api.getCurrentWeather(),
    refetchInterval: 10 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Fetch hourly forecast for header
  const { data: hourlyForecast } = useQuery({
    queryKey: ["weather-hourly"],
    queryFn: () => api.getHourlyForecast(),
    refetchInterval: 30 * 60 * 1000,
    staleTime: 15 * 60 * 1000,
    retry: false,
  });

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

  // Load persisted selection from localStorage
  const [selectedCameras, setSelectedCameras] = useState<SelectedCamera[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Persist selection to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedCameras));
  }, [selectedCameras]);

  // Disable screensaver while cameras are being viewed
  useEffect(() => {
    if (selectedCameras.length > 0) {
      // Update activity periodically to prevent screensaver
      const interval = setInterval(() => {
        updateActivity();
      }, 30000); // Every 30 seconds

      // Initial activity update
      updateActivity();

      return () => clearInterval(interval);
    }
  }, [selectedCameras.length, updateActivity]);

  // Fetch standalone cameras
  const { data: cameras = [], isLoading: isLoadingCameras } = useQuery({
    queryKey: ["cameras"],
    queryFn: () => api.getCameras(),
  });

  // Fetch HA cameras
  const { data: haCameras = [], isLoading: isLoadingHA } = useQuery({
    queryKey: ["ha-cameras"],
    queryFn: () => api.getHomeAssistantCameras(),
    retry: false,
  });

  // Check if HA is configured
  const { data: haConfig } = useQuery({
    queryKey: ["ha-config"],
    queryFn: () => api.getHomeAssistantConfig(),
  });

  const isLoading = isLoadingCameras || isLoadingHA;
  const haConfigured = !!haConfig;

  // Add camera mutation
  const addCameraMutation = useMutation({
    mutationFn: api.createCamera.bind(api),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cameras"] });
    },
  });

  // Get enabled standalone cameras
  const enabledCameras = useMemo(() => {
    return cameras.filter((c) => c.isEnabled).sort((a, b) => a.sortOrder - b.sortOrder);
  }, [cameras]);

  // Combined cameras for thumbnail strip
  const allCameras = useMemo(() => {
    const standalone = enabledCameras.map((c) => ({
      camera: c,
      type: "standalone" as const,
      id: c.id,
    }));
    const ha = haCameras.map((c) => ({
      camera: c,
      type: "ha" as const,
      id: c.entityId,
    }));
    return [...standalone, ...ha];
  }, [enabledCameras, haCameras]);

  // Clean up selected cameras that no longer exist
  useEffect(() => {
    const validIds = new Set(allCameras.map((c) => `${c.type}-${c.id}`));
    setSelectedCameras((prev) => {
      const filtered = prev.filter((s) => validIds.has(`${s.type}-${s.id}`));
      return filtered.length !== prev.length ? filtered : prev;
    });
  }, [allCameras]);

  // Check if a camera is selected
  const isSelected = useCallback(
    (id: string, type: "standalone" | "ha") => {
      return selectedCameras.some((c) => c.id === id && c.type === type);
    },
    [selectedCameras]
  );

  // Toggle camera selection
  const toggleCamera = useCallback((id: string, type: "standalone" | "ha") => {
    setSelectedCameras((prev) => {
      const exists = prev.find((c) => c.id === id && c.type === type);
      if (exists) {
        return prev.filter((c) => !(c.id === id && c.type === type));
      } else {
        return [...prev, { id, type }];
      }
    });
  }, []);

  // Remove camera from view
  const removeCamera = useCallback((id: string, type: "standalone" | "ha") => {
    setSelectedCameras((prev) => prev.filter((c) => !(c.id === id && c.type === type)));
  }, []);

  // Get camera by id
  const getCameraById = useCallback(
    (id: string, type: "standalone" | "ha"): CameraType | HACamera | undefined => {
      if (type === "standalone") {
        return cameras.find((c) => c.id === id);
      } else {
        return haCameras.find((c) => c.entityId === id);
      }
    },
    [cameras, haCameras]
  );

  // Consume camera-view commands from remote control (cast to kiosk)
  const consumeCommand = useRemoteControlStore((s) => s.consumeCommand);
  const pendingCount = useRemoteControlStore((s) => s.pendingCommands.length);

  useEffect(() => {
    if (pendingCount === 0) return;
    const cmd = consumeCommand();
    if (!cmd || cmd.type !== "camera-view") return;
    const cameraId = cmd.payload?.cameraId as string;
    const cameraType = (cmd.payload?.cameraType as "standalone" | "ha") || "standalone";
    if (cameraId) {
      setFullscreenCamera({ id: cameraId, type: cameraType });
    }
  }, [pendingCount]);

  // Calculate grid layout based on selected count
  const getGridClass = (count: number): string => {
    if (count === 0) return "";
    if (count === 1) return "grid-cols-1";
    if (count === 2) return "grid-cols-1 md:grid-cols-2";
    if (count <= 4) return "grid-cols-2";
    if (count <= 6) return "grid-cols-2 md:grid-cols-3";
    return "grid-cols-3";
  };

  // No cameras state
  if (cameras.length === 0 && haCameras.length === 0 && !isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <Camera className="h-10 w-10 text-primary" />
        </div>
        <h2 className="mt-6 text-2xl font-semibold">No Cameras</h2>
        <p className="mt-2 text-center text-muted-foreground max-w-md">
          Add IP cameras directly or connect to Home Assistant to view your cameras.
        </p>
        <div className="flex gap-3 mt-6">
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Camera
          </Button>
          {!haConfigured && (
            <Button variant="outline" onClick={() => window.location.href = "/settings?tab=homeassistant"}>
              <Home className="mr-2 h-4 w-4" />
              Connect Home Assistant
            </Button>
          )}
        </div>
        <AddCameraModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSubmit={async (data) => { await addCameraMutation.mutateAsync(data); }}
        />
      </div>
    );
  }

  // Fullscreen camera view
  if (fullscreenCamera) {
    const camera = getCameraById(fullscreenCamera.id, fullscreenCamera.type);
    if (camera) {
      const castOverlay = (
        <div className="absolute top-4 right-14 z-20">
          <CastButton
            contentType="camera"
            cameraId={fullscreenCamera.type === "standalone" ? fullscreenCamera.id : undefined}
            cameraEntityId={fullscreenCamera.type === "ha" ? fullscreenCamera.id : undefined}
            variant="overlay"
          />
        </div>
      );
      if (fullscreenCamera.type === "standalone") {
        return (
          <div className="relative">
            {castOverlay}
            <CameraFeed
              camera={camera as CameraType}
              isFullscreen
              onToggleFullscreen={() => setFullscreenCamera(null)}
            />
          </div>
        );
      } else {
        return (
          <div className="relative">
            {castOverlay}
            <HACameraFeed
              camera={camera as HACamera}
              isFullscreen
              onToggleFullscreen={() => setFullscreenCamera(null)}
            />
          </div>
        );
      }
    }
    // Camera not found, exit fullscreen
    setFullscreenCamera(null);
  }

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
            <div className="flex items-center gap-[clamp(0.25rem,0.5vw,0.5rem)] text-muted-foreground" title={weather.description}>
              <span className="text-[clamp(1rem,2.5vw,1.75rem)]">{getWeatherIcon(weather.icon)}</span>
              <span className="text-[clamp(0.875rem,2vw,1.5rem)] font-semibold">{weather.temp}°</span>
            </div>
          )}
          {hourlyForecast && hourlyForecast.length > 0 && (
            <div className="flex items-center gap-[clamp(0.5rem,1vw,1rem)] text-muted-foreground">
              {hourlyForecast.slice(0, 4).map((hour, i) => (
                <div key={i} className="flex flex-col items-center text-[clamp(0.5rem,1vw,0.75rem)] leading-tight">
                  <div className="flex items-center gap-0.5">
                    <span className="text-[clamp(0.625rem,1.25vw,1rem)]">{getWeatherIcon(hour.icon)}</span>
                    <span>{hour.temp}°</span>
                  </div>
                  <span className="-mt-0.5">{hour.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <h2 className="text-[clamp(0.75rem,1.5vw,1.125rem)] font-semibold">Cameras</h2>
        </div>
      </div>

      {/* Sports Ticker */}
      <SportsTicker className="border-b border-border" />

      {/* Camera Controls Header with thumbnail strip */}
      <header className="flex-shrink-0 border-b border-border bg-card">
        {/* Top bar with title and actions */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">Cameras</h1>
            {selectedCameras.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {selectedCameras.length} viewing
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Clear selection */}
            {selectedCameras.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCameras([])}
              >
                Clear Selection
              </Button>
            )}

            {/* Refresh all */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["cameras"] });
                queryClient.invalidateQueries({ queryKey: ["ha-cameras"] });
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>

            {/* Add camera */}
            <Button size="sm" onClick={() => setShowAddModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Camera
            </Button>
          </div>
        </div>

        {/* Thumbnail strip */}
        <div className="px-4 py-3 overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : allCameras.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              No cameras available
            </div>
          ) : (
            <div className="flex gap-2">
              {allCameras.map(({ camera, type, id }) => (
                <CameraThumbnail
                  key={`${type}-${id}`}
                  camera={camera}
                  type={type}
                  isSelected={isSelected(id, type)}
                  onClick={() => toggleCamera(id, type)}
                />
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Main viewing area */}
      <div className="flex-1 p-4 overflow-auto bg-background">
        {selectedCameras.length === 0 ? (
          /* Empty state */
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
            <Video className="h-16 w-16 mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Cameras Selected</h3>
            <p className="text-sm text-center max-w-sm">
              Click on camera thumbnails above to add them to your viewing area.
              <br />
              Click again to remove them.
            </p>
          </div>
        ) : (
          /* Camera grid */
          <div
            className={cn(
              "grid gap-4 h-full auto-rows-fr",
              getGridClass(selectedCameras.length)
            )}
          >
            {selectedCameras.map(({ id, type }) => {
              const camera = getCameraById(id, type);
              if (!camera) return null;

              return (
                <CameraViewer
                  key={`${type}-${id}`}
                  camera={camera}
                  type={type}
                  onRemove={() => removeCamera(id, type)}
                  onFullscreen={() => setFullscreenCamera({ id, type })}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Add camera modal */}
      <AddCameraModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={async (data) => { await addCameraMutation.mutateAsync(data); }}
      />
    </div>
  );
}
