import { useState, useCallback, useMemo } from "react";
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
import { api, type HAEntityTimer } from "../services/api";
import { cn } from "../lib/utils";
import type { HomeAssistantEntityState } from "@openframe/shared";

// Domains to exclude from the smart home dashboard (cameras have their own page)
const EXCLUDED_DOMAINS = ["camera"];

export function HomeAssistantPage() {
  const queryClient = useQueryClient();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

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

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-8 pt-16 lg:pt-8">
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
                  />
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
