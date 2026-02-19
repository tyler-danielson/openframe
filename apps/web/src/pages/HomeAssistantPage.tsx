import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Home,
  Settings,
  Loader2,
  AlertCircle,
  Menu,
  X,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { RoomSidebar } from "../components/homeassistant/RoomSidebar";
import { RoomHero } from "../components/homeassistant/RoomHero";
import { HomioEntityCard } from "../components/homeassistant/HomioEntityCard";
import { SportsTicker } from "../components/SportsTicker";
import { AssistChat } from "../components/homeassistant/AssistChat";
import { api, type HAEntityTimer } from "../services/api";
import { cn } from "../lib/utils";
import { useCalendarStore } from "../stores/calendar";
import type { HomeAssistantEntityState } from "@openframe/shared";

// Weather icon helper
function getWeatherIcon(iconCode: string): string {
  const iconMap: Record<string, string> = {
    "01d": "\u2600\uFE0F", // sun
    "01n": "\uD83C\uDF19", // moon
    "02d": "\u26C5", // partly cloudy
    "02n": "\u26C5",
    "03d": "\u2601\uFE0F", // cloudy
    "03n": "\u2601\uFE0F",
    "04d": "\u2601\uFE0F", // broken clouds
    "04n": "\u2601\uFE0F",
    "09d": "\uD83C\uDF27\uFE0F", // rain
    "09n": "\uD83C\uDF27\uFE0F",
    "10d": "\uD83C\uDF26\uFE0F", // sun rain
    "10n": "\uD83C\uDF27\uFE0F",
    "11d": "\u26C8\uFE0F", // thunder
    "11n": "\u26C8\uFE0F",
    "13d": "\uD83C\uDF28\uFE0F", // snow
    "13n": "\uD83C\uDF28\uFE0F",
    "50d": "\uD83C\uDF2B\uFE0F", // mist
    "50n": "\uD83C\uDF2B\uFE0F",
  };
  return iconMap[iconCode] || "\u2600\uFE0F";
}

// Domains to exclude from the smart home dashboard (cameras have their own page)
const EXCLUDED_DOMAINS = ["camera"];

export function HomeAssistantPage() {
  const queryClient = useQueryClient();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timeFade, setTimeFade] = useState(true);

  const { familyName, timeFormat, cycleTimeFormat } = useCalendarStore();

  // Fetch HA config
  const { data: config, isLoading: isLoadingConfig } = useQuery({
    queryKey: ["homeassistant", "config"],
    queryFn: api.getHomeAssistantConfig.bind(api),
  });

  // Fetch all HA states
  const {
    data: allStates,
    isLoading: isLoadingStates,
  } = useQuery({
    queryKey: ["homeassistant", "states"],
    queryFn: api.getHomeAssistantStates.bind(api),
    enabled: !!config,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch rooms
  const { data: rooms = [] } = useQuery({
    queryKey: ["homeassistant", "rooms"],
    queryFn: api.getHomeAssistantRooms.bind(api),
    enabled: !!config,
  });

  // Fetch entities for selected room
  const { data: selectedEntities, isLoading: isLoadingEntities } = useQuery({
    queryKey: ["homeassistant", "entities", selectedRoomId],
    queryFn: () => api.getHomeAssistantEntities(
      selectedRoomId ? { roomId: selectedRoomId } : undefined
    ),
    enabled: !!config,
  });

  // Fetch active timers
  const { data: timers = [] } = useQuery({
    queryKey: ["homeassistant", "timers"],
    queryFn: api.getHomeAssistantTimers.bind(api),
    enabled: !!config,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Create a map of entity timers for quick lookup
  const timersByEntity = useMemo(() => {
    const map = new Map<string, HAEntityTimer>();
    for (const timer of timers) {
      map.set(timer.entityId, timer);
    }
    return map;
  }, [timers]);

  // Refresh timers when changed
  const handleTimerChange = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["homeassistant", "timers"] });
  }, [queryClient]);

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

  // Filter out excluded domains (cameras)
  const filteredEntities = useMemo(() => {
    if (!selectedEntities) return [];
    return selectedEntities.filter((entity) => {
      const domain = entity.entityId.split(".")[0];
      return !EXCLUDED_DOMAINS.includes(domain || "");
    });
  }, [selectedEntities]);

  // Call service
  const callServiceMutation = useMutation({
    mutationFn: ({
      domain,
      service,
      data,
    }: {
      domain: string;
      service: string;
      data?: Record<string, unknown>;
    }) => api.callHomeAssistantService(domain, service, data),
    onSuccess: () => {
      // Refresh states after service call
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["homeassistant", "states"] });
      }, 500);
    },
  });

  const handleCallService = async (
    domain: string,
    service: string,
    data?: Record<string, unknown>
  ) => {
    await callServiceMutation.mutateAsync({ domain, service, data });
  };

  // Get state for an entity
  const getEntityState = useCallback(
    (entityId: string): HomeAssistantEntityState | undefined => {
      return allStates?.find((s) => s.entity_id === entityId);
    },
    [allStates]
  );

  // Get selected room object
  const selectedRoom = selectedRoomId
    ? rooms.find((r) => r.id === selectedRoomId) || null
    : null;

  const isLoading = isLoadingConfig || isLoadingStates || isLoadingEntities;

  // Not configured state
  if (!isLoadingConfig && !config) {
    return (
      <div className="homio-page flex h-full flex-col items-center justify-center p-8">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--homio-accent)]/10 mb-6">
          <Home className="h-10 w-10 text-[var(--homio-accent)]" />
        </div>
        <h1 className="text-2xl font-bold mb-2 text-[var(--homio-text-primary)]">Connect Home Assistant</h1>
        <p className="text-[var(--homio-text-secondary)] text-center max-w-md mb-6">
          Control your smart home devices directly from OpenFrame. Connect your Home Assistant
          instance in Settings to get started.
        </p>
        <Button
          onClick={() => window.location.href = "/settings?tab=homeassistant"}
          className="bg-[var(--homio-accent)] hover:bg-[var(--homio-accent-light)] text-black"
        >
          <Settings className="mr-2 h-4 w-4" />
          Go to Settings
        </Button>
      </div>
    );
  }

  return (
    <div className="homio-page flex h-full">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileSidebarOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-3 rounded-lg bg-[var(--homio-bg-secondary)] border border-[var(--homio-card-border)]"
      >
        <Menu className="h-5 w-5 text-[var(--homio-text-primary)]" />
      </button>

      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed lg:relative z-50 lg:z-auto h-full transform transition-transform lg:transform-none",
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Mobile Close Button */}
        <button
          onClick={() => setIsMobileSidebarOpen(false)}
          className="lg:hidden absolute top-4 right-4 p-2 rounded-lg hover:bg-white/5"
        >
          <X className="h-5 w-5 text-[var(--homio-text-primary)]" />
        </button>

        <RoomSidebar
          rooms={rooms}
          selectedRoomId={selectedRoomId}
          onSelectRoom={(roomId) => {
            setSelectedRoomId(roomId);
            setIsMobileSidebarOpen(false);
          }}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Navigation header */}
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
            <h2 className="text-[clamp(0.75rem,1.5vw,1.125rem)] font-semibold">Smart Home</h2>
          </div>
        </div>

        {/* Sports Ticker */}
        <SportsTicker className="border-b border-border" />

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 pt-6">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--homio-accent)]" />
          </div>
        ) : filteredEntities.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center">
            <RoomHero
              room={selectedRoom}
              entityStates={allStates || []}
              totalEntities={0}
            />
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5 mb-4">
              <Home className="h-8 w-8 text-[var(--homio-text-muted)]" />
            </div>
            <h2 className="text-lg font-medium mb-2 text-[var(--homio-text-primary)]">
              {selectedRoomId ? "No devices in this room" : "No devices configured"}
            </h2>
            <p className="text-[var(--homio-text-secondary)] text-center max-w-md mb-4">
              {selectedRoomId
                ? "Add devices to this room in Settings > Home Assistant > Rooms."
                : "Add entities in Settings to control them here."}
            </p>
            <Button
              onClick={() => window.location.href = "/settings?tab=homeassistant"}
              className="bg-[var(--homio-accent)] hover:bg-[var(--homio-accent-light)] text-black"
            >
              <Settings className="mr-2 h-4 w-4" />
              Go to Settings
            </Button>
          </div>
        ) : (
          <>
            {/* Room Hero */}
            <RoomHero
              room={selectedRoom}
              entityStates={allStates || []}
              totalEntities={filteredEntities.length}
            />

            {/* Entity Grid */}
            <div className="homio-grid">
              {filteredEntities.map((entity) => {
                const state = getEntityState(entity.entityId);

                if (!state) {
                  return (
                    <div
                      key={entity.entityId}
                      className="homio-card opacity-50"
                    >
                      <div className="flex flex-col items-center pt-2 pb-3">
                        <div className="flex items-center justify-center w-16 h-16 rounded-full mb-3 bg-white/10">
                          <AlertCircle className="h-8 w-8 text-[var(--homio-text-muted)]" />
                        </div>
                        <div className="text-center px-2">
                          <div className="font-medium text-sm leading-tight mb-1 text-[var(--homio-text-secondary)]">
                            {entity.displayName || entity.entityId}
                          </div>
                          <div className="text-xs uppercase tracking-wider text-[var(--homio-text-muted)]">
                            Unavailable
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <HomioEntityCard
                    key={entity.entityId}
                    state={state}
                    displayName={entity.displayName}
                    onCallService={handleCallService}
                    activeTimer={timersByEntity.get(entity.entityId) || null}
                    onTimerChange={handleTimerChange}
                    allEntities={allStates}
                    entitySettings={entity.settings}
                  />
                );
              })}
            </div>
          </>
        )}
        </div>
      </div>

      {/* Assist Chat Widget */}
      <AssistChat />
    </div>
  );
}
