import { useState, useEffect, useMemo, useCallback } from "react";
import {
  X,
  Play,
  Pause,
  Square,
  Home,
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  BatteryWarning,
  AlertCircle,
  Loader2,
  Volume2,
  VolumeX,
  Wind,
  Zap,
  Droplets,
  Sofa,
  Monitor,
  Bath,
  UtensilsCrossed,
  Bed,
  CookingPot,
  DoorOpen,
  Shirt,
  Car,
  Dumbbell,
  Baby,
  Dog,
  Gamepad2,
  BookOpen,
  Warehouse,
  Wrench,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Map,
  Clock,
  type LucideIcon,
} from "lucide-react";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";
import type { HomeAssistantEntityState } from "@openframe/shared";
import { api } from "../../services/api";

// Custom vacuum icon component
function VacuumIcon({ className, isAnimated }: { className?: string; isAnimated?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(className, isAnimated && "animate-pulse")}
    >
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 4v1" />
      <path d="M12 19v1" />
      <path d="M4 12h1" />
      <path d="M19 12h1" />
    </svg>
  );
}

interface VacuumRoom {
  id: number | string;
  name: string;
  icon?: string;
}

// Map MDI icons to Lucide icons
const MDI_TO_LUCIDE: Record<string, LucideIcon> = {
  "mdi:sofa-outline": Sofa,
  "mdi:sofa": Sofa,
  "mdi:monitor-shimmer": Monitor,
  "mdi:monitor": Monitor,
  "mdi:toilet": Bath,
  "mdi:shower": Bath,
  "mdi:room-service-outline": UtensilsCrossed,
  "mdi:room-service": UtensilsCrossed,
  "mdi:silverware-fork-knife": UtensilsCrossed,
  "mdi:bed-king-outline": Bed,
  "mdi:bed-king": Bed,
  "mdi:bed-outline": Bed,
  "mdi:bed": Bed,
  "mdi:chef-hat": CookingPot,
  "mdi:stove": CookingPot,
  "mdi:home-outline": Home,
  "mdi:home": Home,
  "mdi:door": DoorOpen,
  "mdi:door-open": DoorOpen,
  "mdi:hanger": Shirt,
  "mdi:wardrobe-outline": Shirt,
  "mdi:wardrobe": Shirt,
  "mdi:car": Car,
  "mdi:garage": Car,
  "mdi:dumbbell": Dumbbell,
  "mdi:weight-lifter": Dumbbell,
  "mdi:baby-carriage": Baby,
  "mdi:baby": Baby,
  "mdi:dog": Dog,
  "mdi:cat": Dog,
  "mdi:paw": Dog,
  "mdi:gamepad-variant": Gamepad2,
  "mdi:controller": Gamepad2,
  "mdi:book-open-page-variant": BookOpen,
  "mdi:bookshelf": BookOpen,
  "mdi:washing-machine": Warehouse,
  "mdi:tumble-dryer": Warehouse,
};

interface VacuumControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: HomeAssistantEntityState;
  displayName?: string | null;
  onCallService: (domain: string, service: string, data?: Record<string, unknown>) => Promise<void>;
  allEntities?: HomeAssistantEntityState[];
}

// Map HA vacuum states to display info
const VACUUM_STATE_MAP: Record<string, { label: string; color: string; isActive: boolean }> = {
  cleaning: { label: "Cleaning", color: "text-primary", isActive: true },
  docked: { label: "Docked", color: "text-muted-foreground", isActive: false },
  returning: { label: "Returning", color: "text-primary", isActive: true },
  paused: { label: "Paused", color: "text-amber-500", isActive: false },
  idle: { label: "Idle", color: "text-muted-foreground", isActive: false },
  error: { label: "Error", color: "text-destructive", isActive: false },
  unavailable: { label: "Unavailable", color: "text-muted-foreground", isActive: false },
  unknown: { label: "Unknown", color: "text-muted-foreground", isActive: false },
};

// Fan speed display configuration
const FAN_SPEED_OPTIONS = [
  { value: "silent", label: "Silent", icon: VolumeX },
  { value: "standard", label: "Standard", icon: Volume2 },
  { value: "medium", label: "Medium", icon: Wind },
  { value: "turbo", label: "Turbo", icon: Zap },
];

// Cleaning mode options (Dreame vacuums)
const CLEANING_MODE_OPTIONS = [
  { value: "Sweeping", label: "Vacuum Only", icon: Wind },
  { value: "Mopping", label: "Mop Only", icon: Droplets },
  { value: "Sweeping and mopping", label: "Vacuum + Mop", icon: Zap },
];

// Mopping type options (Dreame vacuums)
const MOPPING_TYPE_OPTIONS = [
  { value: "Deep", label: "Deep" },
  { value: "Daily", label: "Daily" },
  { value: "Accurate", label: "Accurate" },
];

// Storage key for remembering room selection
const ROOM_SELECTION_KEY = "vacuum_selected_rooms";

// Consumable configuration
const CONSUMABLE_CONFIG = [
  { key: "main_brush_left", label: "Main Brush", shortLabel: "Brush", alwaysShow: false },
  { key: "side_brush_left", label: "Side Brush", shortLabel: "Side", alwaysShow: false },
  { key: "filter_left", label: "Filter", shortLabel: "Filter", alwaysShow: true },
  { key: "mop_pad_left", label: "Mop Pad", shortLabel: "Pad", alwaysShow: false },
  { key: "detergent_left", label: "Detergent", shortLabel: "Soap", alwaysShow: true },
  { key: "water_left", label: "Water", shortLabel: "Water", alwaysShow: true },
] as const;

// Helper to format shortcut names (replace underscores with spaces)
function formatShortcutName(name: string): string {
  return name.replace(/_/g, " ");
}

// Helper to format numbers with commas
function formatNumber(num: number): string {
  return num.toLocaleString();
}

// Helper to get consumable bar color based on percentage
function getConsumableColor(percentage: number): string {
  if (percentage > 50) return "bg-green-500";
  if (percentage >= 20) return "bg-amber-500";
  return "bg-red-500";
}

// Helper to get consumable text color based on percentage
function getConsumableTextColor(percentage: number): string {
  if (percentage > 50) return "text-green-500";
  if (percentage >= 20) return "text-amber-500";
  return "text-red-500";
}

export function VacuumControlModal({
  isOpen,
  onClose,
  state,
  displayName,
  onCallService,
  allEntities,
}: VacuumControlModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRooms, setSelectedRooms] = useState<Set<number | string>>(new Set());
  const [selectedFanSpeed, setSelectedFanSpeed] = useState<string | null>(null);
  const [selectedCleaningMode, setSelectedCleaningMode] = useState<string | null>(null);
  const [selectedMoppingType, setSelectedMoppingType] = useState<string | null>(null);
  const [consumablesExpanded, setConsumablesExpanded] = useState(false);
  const [mapRefreshKey, setMapRefreshKey] = useState(0);

  const friendlyName = state.attributes.friendly_name;
  const entityName = displayName || (typeof friendlyName === "string" ? friendlyName : null) || state.entity_id;

  const vacuumState = state.state.toLowerCase();
  const stateInfo = VACUUM_STATE_MAP[vacuumState] || VACUUM_STATE_MAP.unknown!;
  const isCleaning = vacuumState === "cleaning";
  const isPaused = vacuumState === "paused";
  const isReturning = vacuumState === "returning";
  const isUnavailable = vacuumState === "unavailable" || vacuumState === "unknown";

  // Detect if vacuum is actively cleaning (includes returning state)
  const isActivelyCleaning = ["cleaning", "returning"].includes(vacuumState);

  // Auto-detect map camera entity
  const mapCameraEntity = useMemo(() => {
    if (!allEntities) return null;

    // Extract vacuum name from entity_id (e.g., "vacuum.dreame_l10s" -> "dreame_l10s")
    const vacuumName = state.entity_id.replace("vacuum.", "");

    // Look for camera entities containing the vacuum name and "map"
    return allEntities.find(e =>
      e.entity_id.startsWith("camera.") &&
      e.entity_id.includes(vacuumName) &&
      e.entity_id.includes("map")
    ) || allEntities.find(e =>
      // Fallback: any camera with the vacuum name
      e.entity_id.startsWith("camera.") &&
      e.entity_id.includes(vacuumName)
    ) || allEntities.find(e =>
      // Fallback: any camera with "map" in the name
      e.entity_id.startsWith("camera.") &&
      e.entity_id.includes("map")
    );
  }, [allEntities, state.entity_id]);

  // Get map snapshot URL
  const getMapSnapshotUrl = useCallback(() => {
    if (!mapCameraEntity) return null;
    return api.getHACameraSnapshotUrl(mapCameraEntity.entity_id);
  }, [mapCameraEntity]);

  // Auto-refresh map when actively cleaning
  useEffect(() => {
    if (!isActivelyCleaning || !mapCameraEntity) return;

    const interval = setInterval(() => {
      setMapRefreshKey(prev => prev + 1);
    }, 4000); // Refresh every 4 seconds

    return () => clearInterval(interval);
  }, [isActivelyCleaning, mapCameraEntity]);

  // Battery level
  const batteryLevel = state.attributes.battery_level as number | undefined;

  // Current fan speed
  const currentFanSpeed = state.attributes.fan_speed as string | undefined;
  const fanSpeedList = state.attributes.fan_speed_list as string[] | undefined;

  // Cleaning mode (Dreame - vacuum, mop, or both)
  const currentCleaningMode = state.attributes.cleaning_mode as string | undefined;
  const cleaningModeList = state.attributes.cleaning_mode_list as string[] | undefined;

  // Mopping type (Dreame - Deep, Daily, Accurate)
  const currentMoppingType = state.attributes.mopping_type as string | undefined;
  const moppingTypeList = state.attributes.mopping_type_list as string[] | undefined;

  // Extract rooms from vacuum attributes (multiple formats supported)
  const rooms = useMemo((): VacuumRoom[] => {
    // Option 1: rooms object keyed by map name (Dreame/Xiaomi Miio format)
    // Format: { "Floor1": [{ id: 1, name: "Living Room", icon: "mdi:sofa" }, ...] }
    const roomsObj = state.attributes.rooms as Record<string, Array<{ id: number; name: string; icon?: string }>> | Array<{ id: number; name: string; icon?: string }> | undefined;
    if (roomsObj && typeof roomsObj === "object" && !Array.isArray(roomsObj)) {
      // It's an object keyed by map name - get rooms for selected map or first available
      const selectedMap = state.attributes.selected_map as string | undefined;
      const mapKeys = Object.keys(roomsObj);
      const mapName = selectedMap && mapKeys.includes(selectedMap) ? selectedMap : mapKeys[0];
      if (mapName && Array.isArray(roomsObj[mapName]) && roomsObj[mapName].length > 0) {
        return roomsObj[mapName].map((r) => ({ id: r.id, name: r.name, icon: r.icon }));
      }
    }

    // Option 2: rooms as flat array (some Dreame integrations)
    if (Array.isArray(roomsObj) && roomsObj.length > 0) {
      return roomsObj.map((r) => ({ id: r.id, name: r.name, icon: r.icon }));
    }

    // Option 3: segment_names object (alternative Dreame format)
    const segmentNames = state.attributes.segment_names as Record<string, string> | undefined;
    if (segmentNames && typeof segmentNames === "object" && Object.keys(segmentNames).length > 0) {
      return Object.entries(segmentNames).map(([id, name]) => ({
        id: parseInt(id, 10),
        name: name as string,
      }));
    }

    // Option 4: segments array (Dreame L10s/L20 format)
    const segments = state.attributes.segments as Array<{ id: number; name: string; icon?: string }> | undefined;
    if (Array.isArray(segments) && segments.length > 0) {
      return segments.map((s) => ({ id: s.id, name: s.name }));
    }

    // Option 5: room_list with IDs and names (some integrations)
    const roomList = state.attributes.room_list as Record<string, string> | undefined;
    if (roomList && typeof roomList === "object" && Object.keys(roomList).length > 0) {
      return Object.entries(roomList).map(([id, name]) => ({
        id: parseInt(id, 10) || id,
        name: name as string,
      }));
    }

    // Option 6: map_rooms array (Dreame via xiaomi_miot)
    const mapRooms = state.attributes.map_rooms as Array<{ id: number | string; name: string }> | undefined;
    if (Array.isArray(mapRooms) && mapRooms.length > 0) {
      return mapRooms.map((r) => ({ id: r.id, name: r.name }));
    }

    // Option 7: room_mapping (Valetudo format)
    const roomMapping = state.attributes.room_mapping as Array<{ id: number; name: string }> | undefined;
    if (Array.isArray(roomMapping) && roomMapping.length > 0) {
      return roomMapping.map((r) => ({ id: r.id, name: r.name }));
    }

    return [];
  }, [state.attributes]);

  // Extract shortcuts from attributes
  const shortcuts = useMemo(() => {
    const shortcutsObj = state.attributes.shortcuts as Record<string, { name: string; map_id?: number; tasks?: unknown[] }> | undefined;
    if (!shortcutsObj || typeof shortcutsObj !== "object") return [];

    return Object.entries(shortcutsObj).map(([id, data]) => ({
      id,
      name: data.name,
    }));
  }, [state.attributes.shortcuts]);

  // Extract consumables from attributes
  const consumables = useMemo(() => {
    const result: { key: string; label: string; shortLabel: string; alwaysShow: boolean; percentage: number }[] = [];
    for (const { key, label, shortLabel, alwaysShow } of CONSUMABLE_CONFIG) {
      const value = state.attributes[key] as number | undefined;
      if (value !== undefined) {
        result.push({ key, label, shortLabel, alwaysShow, percentage: value });
      }
    }
    return result;
  }, [state.attributes]);

  // Extract statistics from attributes
  const statistics = useMemo(() => {
    const totalArea = state.attributes.total_cleaned_area as number | undefined;
    const totalTime = state.attributes.total_cleaning_time as number | undefined;
    const cleaningCount = state.attributes.cleaning_count as number | undefined;

    const stats: { label: string; value: string }[] = [];

    if (totalArea !== undefined) {
      stats.push({ label: "Total Area", value: `${formatNumber(totalArea)} m²` });
    }
    if (totalTime !== undefined) {
      // Convert minutes to hours
      const hours = Math.round(totalTime / 60);
      stats.push({ label: "Total Time", value: `${formatNumber(hours)} hrs` });
    }
    if (cleaningCount !== undefined) {
      stats.push({ label: "Total Cleans", value: formatNumber(cleaningCount) });
    }

    return stats;
  }, [state.attributes]);

  // Extract current cleaning stats (for active cleaning session)
  const currentCleaningStats = useMemo(() => {
    const cleanedArea = state.attributes.cleaned_area as number | undefined;
    const cleaningTime = state.attributes.cleaning_time as number | undefined;
    const currentRoom = state.attributes.current_room as string | undefined;

    return {
      cleanedArea,
      cleaningTime,
      currentRoom,
    };
  }, [state.attributes]);

  // Extract status/error messages from vacuum attributes
  const statusInfo = useMemo(() => {
    // Dreame vacuums expose various status attributes
    const status = state.attributes.status as string | undefined;
    const statusDescription = state.attributes.status_description as string | undefined;
    const error = state.attributes.error as string | undefined;
    const errorDescription = state.attributes.error_description as string | undefined;
    const taskStatus = state.attributes.task_status as string | undefined;
    const lastError = state.attributes.last_error as string | undefined;

    // Check for error conditions
    const hasError = vacuumState === "error" ||
      (error && error.toLowerCase() !== "none" && error.toLowerCase() !== "no_error") ||
      (errorDescription && errorDescription.toLowerCase() !== "none");

    // Get the most relevant message
    let message: string | null = null;
    let isError = false;
    let isWarning = false;

    if (hasError) {
      // Prioritize error messages
      message = errorDescription || error || statusDescription || status || "Error occurred";
      isError = true;
    } else if (statusDescription || taskStatus) {
      // Show status description if available and interesting
      const desc = statusDescription || taskStatus || "";
      // Filter out boring statuses
      const boringStatuses = ["idle", "docked", "charging", "standby", "none"];
      if (desc && !boringStatuses.includes(desc.toLowerCase())) {
        message = desc;
        // Check if it's a warning (like brush wrapped, low water, etc.)
        const warningKeywords = ["wrapped", "stuck", "low", "empty", "full", "blocked", "tangled", "replace", "clean"];
        isWarning = warningKeywords.some(kw => desc.toLowerCase().includes(kw));
      }
    }

    return {
      message,
      isError,
      isWarning,
      hasNotification: !!message,
    };
  }, [state.attributes, vacuumState]);

  // Load saved room selection from localStorage
  useEffect(() => {
    if (isOpen && rooms.length > 0) {
      try {
        const savedSelection = localStorage.getItem(`${ROOM_SELECTION_KEY}_${state.entity_id}`);
        if (savedSelection) {
          const parsed = JSON.parse(savedSelection) as (number | string)[];
          // Only keep rooms that still exist
          const validRooms = parsed.filter((id) => rooms.some((r) => r.id === id));
          setSelectedRooms(new Set(validRooms));
        }
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [isOpen, rooms, state.entity_id]);

  // Save room selection to localStorage when it changes
  useEffect(() => {
    if (rooms.length > 0 && selectedRooms.size > 0) {
      try {
        localStorage.setItem(
          `${ROOM_SELECTION_KEY}_${state.entity_id}`,
          JSON.stringify(Array.from(selectedRooms))
        );
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [selectedRooms, rooms.length, state.entity_id]);

  // Set current fan speed on open
  useEffect(() => {
    if (isOpen && currentFanSpeed) {
      setSelectedFanSpeed(currentFanSpeed);
    }
  }, [isOpen, currentFanSpeed]);

  // Set current cleaning mode on open
  useEffect(() => {
    if (isOpen && currentCleaningMode) {
      setSelectedCleaningMode(currentCleaningMode);
    }
  }, [isOpen, currentCleaningMode]);

  // Set current mopping type on open
  useEffect(() => {
    if (isOpen && currentMoppingType) {
      setSelectedMoppingType(currentMoppingType);
    }
  }, [isOpen, currentMoppingType]);

  const handleServiceCall = async (service: string, data?: Record<string, unknown>, domain = "vacuum") => {
    setIsLoading(true);
    try {
      await onCallService(domain, service, { entity_id: state.entity_id, ...data });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStart = () => handleServiceCall("start");
  const handlePause = () => handleServiceCall("pause");
  const handleStop = () => handleServiceCall("stop");
  const handleReturnToBase = () => handleServiceCall("return_to_base");

  const handleSetFanSpeed = (speed: string) => {
    setSelectedFanSpeed(speed);
    handleServiceCall("set_fan_speed", { fan_speed: speed });
  };

  const handleSetCleaningMode = (mode: string) => {
    setSelectedCleaningMode(mode);
    // Dreame vacuums - set cleaning mode (Sweeping, Mopping, Sweeping and mopping)
    handleServiceCall("send_command", { command: "set_cleaning_mode", params: { cleaning_mode: mode } });
  };

  const handleSetMoppingType = (type: string) => {
    setSelectedMoppingType(type);
    // Dreame vacuums - set mopping type (Deep, Daily, Accurate)
    handleServiceCall("send_command", { command: "set_mopping_type", params: { mopping_type: type } });
  };

  const handleCleanSelectedRooms = () => {
    if (selectedRooms.size === 0) return;

    // Use dreame_vacuum.vacuum_clean_segment for Tasshack Dreame integration
    handleServiceCall("vacuum_clean_segment", {
      segments: Array.from(selectedRooms),
    }, "dreame_vacuum");
  };

  const handleRunShortcut = (shortcutId: string) => {
    // Use dreame_vacuum service for Tasshack Dreame integration
    handleServiceCall("vacuum_clean_shortcut", {
      shortcut: parseInt(shortcutId, 10),
    }, "dreame_vacuum");
  };

  const toggleRoomSelection = (roomId: number | string) => {
    const newSelection = new Set(selectedRooms);
    if (newSelection.has(roomId)) {
      newSelection.delete(roomId);
    } else {
      newSelection.add(roomId);
    }
    setSelectedRooms(newSelection);
  };

  const selectAllRooms = () => {
    setSelectedRooms(new Set(rooms.map((r) => r.id)));
  };

  const clearRoomSelection = () => {
    setSelectedRooms(new Set());
  };

  const getBatteryIcon = () => {
    if (batteryLevel === undefined) return null;

    const iconClass = "h-5 w-5";
    if (batteryLevel <= 10) {
      return <BatteryWarning className={cn(iconClass, "text-destructive")} />;
    } else if (batteryLevel <= 30) {
      return <BatteryLow className={cn(iconClass, "text-amber-500")} />;
    } else if (batteryLevel <= 70) {
      return <BatteryMedium className={cn(iconClass, "text-muted-foreground")} />;
    }
    return <BatteryFull className={cn(iconClass, "text-green-500")} />;
  };

  // Get available fan speeds (use custom list if available, otherwise use defaults)
  const availableFanSpeeds = useMemo(() => {
    if (fanSpeedList && fanSpeedList.length > 0) {
      return fanSpeedList.map((speed) => {
        const predefined = FAN_SPEED_OPTIONS.find(
          (opt) => opt.value.toLowerCase() === speed.toLowerCase()
        );
        return predefined || { value: speed, label: speed, icon: Wind };
      });
    }
    return FAN_SPEED_OPTIONS;
  }, [fanSpeedList]);

  // Get available cleaning modes (use custom list if available)
  const availableCleaningModes = useMemo(() => {
    if (cleaningModeList && cleaningModeList.length > 0) {
      return cleaningModeList.map((mode) => {
        const predefined = CLEANING_MODE_OPTIONS.find(
          (opt) => opt.value.toLowerCase() === mode.toLowerCase()
        );
        return predefined || { value: mode, label: mode.replace(/_/g, " "), icon: Wind };
      });
    }
    // Only show cleaning modes if the vacuum reports supporting them
    if (currentCleaningMode) {
      return CLEANING_MODE_OPTIONS;
    }
    return [];
  }, [cleaningModeList, currentCleaningMode]);

  // Get available mopping types (use custom list if available)
  const availableMoppingTypes = useMemo(() => {
    if (moppingTypeList && moppingTypeList.length > 0) {
      return moppingTypeList.map((type) => {
        const predefined = MOPPING_TYPE_OPTIONS.find(
          (opt) => opt.value.toLowerCase() === type.toLowerCase()
        );
        return predefined || { value: type, label: type };
      });
    }
    // Only show mopping types if the vacuum reports supporting them
    if (currentMoppingType) {
      return MOPPING_TYPE_OPTIONS;
    }
    return [];
  }, [moppingTypeList, currentMoppingType]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-5xl mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center justify-center w-10 h-10 rounded-full",
              stateInfo.isActive ? "bg-primary/20" : "bg-muted"
            )}>
              {vacuumState === "error" ? (
                <AlertCircle className="h-5 w-5 text-destructive" />
              ) : (
                <VacuumIcon className="h-5 w-5" isAnimated={isCleaning} />
              )}
            </div>
            <div>
              <h2 className="font-semibold">{entityName}</h2>
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <span className={stateInfo.color}>{stateInfo.label}</span>
                {batteryLevel !== undefined && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    {getBatteryIcon()}
                    {batteryLevel}%
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Status/Error Notification Banner */}
        {statusInfo.hasNotification && (
          <div className={cn(
            "flex items-center gap-3 px-4 py-3 border-b",
            statusInfo.isError
              ? "bg-destructive/10 border-destructive/20 text-destructive"
              : statusInfo.isWarning
                ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                : "bg-primary/10 border-primary/20 text-primary"
          )}>
            <AlertCircle className={cn(
              "h-5 w-5 shrink-0",
              statusInfo.isError
                ? "text-destructive"
                : statusInfo.isWarning
                  ? "text-amber-500"
                  : "text-primary"
            )} />
            <span className="text-sm font-medium">{statusInfo.message}</span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Cleaning Map View - shown when actively cleaning and map camera available */}
          {isActivelyCleaning && mapCameraEntity ? (
            <div className="flex flex-col items-center gap-6">
              {/* Map Display */}
              <div className="relative w-full max-w-2xl aspect-square bg-muted/30 rounded-xl overflow-hidden border border-primary/20">
                <img
                  key={mapRefreshKey}
                  src={`${getMapSnapshotUrl()}&t=${mapRefreshKey}`}
                  alt="Vacuum cleaning map"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    // Hide broken image and show placeholder
                    e.currentTarget.style.display = "none";
                  }}
                />
                {/* Map loading/refresh indicator */}
                <div className="absolute top-3 right-3 flex items-center gap-2 px-2 py-1 bg-background/80 backdrop-blur-sm rounded-lg text-xs text-muted-foreground">
                  <Map className="h-3 w-3" />
                  Live Map
                </div>
              </div>

              {/* Cleaning Controls */}
              <div className="flex flex-wrap justify-center gap-3">
                {isCleaning && (
                  <Button
                    onClick={handlePause}
                    disabled={isLoading || isUnavailable}
                    variant="secondary"
                    size="lg"
                    className="flex items-center gap-2"
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Pause className="h-5 w-5" />
                    )}
                    Pause
                  </Button>
                )}
                {isPaused && (
                  <Button
                    onClick={handleStart}
                    disabled={isLoading || isUnavailable}
                    size="lg"
                    className="flex items-center gap-2"
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Play className="h-5 w-5" />
                    )}
                    Resume
                  </Button>
                )}
                {(isCleaning || isPaused) && (
                  <Button
                    onClick={handleStop}
                    disabled={isLoading || isUnavailable}
                    variant="outline"
                    size="lg"
                    className="flex items-center gap-2"
                  >
                    <Square className="h-5 w-5" />
                    Stop
                  </Button>
                )}
                {!isReturning && (
                  <Button
                    onClick={handleReturnToBase}
                    disabled={isLoading || isUnavailable}
                    variant="outline"
                    size="lg"
                    className="flex items-center gap-2"
                  >
                    <Home className="h-5 w-5" />
                    Return to Dock
                  </Button>
                )}
              </div>

              {/* Cleaning Stats */}
              <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
                {currentCleaningStats.currentRoom && (
                  <div className="flex items-center gap-2">
                    <Home className="h-4 w-4 text-primary" />
                    <span>{currentCleaningStats.currentRoom}</span>
                  </div>
                )}
                {currentCleaningStats.cleanedArea !== undefined && (
                  <div className="flex items-center gap-2">
                    <Map className="h-4 w-4 text-primary" />
                    <span>{currentCleaningStats.cleanedArea} m²</span>
                  </div>
                )}
                {currentCleaningStats.cleaningTime !== undefined && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <span>{currentCleaningStats.cleaningTime} min</span>
                  </div>
                )}
                {batteryLevel !== undefined && (
                  <div className="flex items-center gap-2">
                    {getBatteryIcon()}
                    <span>{batteryLevel}%</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Setup View - shown when not actively cleaning */
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[0.33fr_1fr_1fr] gap-6">
              {/* Left Column - Consumables & Statistics (hidden on smaller screens) */}
              <div className="hidden lg:block space-y-6 pr-6 border-r border-primary/40">
                {/* Consumables - always visible */}
                {consumables.length > 0 && (
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-primary mb-3">
                      <Wrench className="h-4 w-4" />
                      Consumables
                    </label>
                    <div className="space-y-3">
                      {consumables.map((consumable) => (
                        <div key={consumable.key} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{consumable.label}</span>
                            <span className={cn("font-medium", getConsumableTextColor(consumable.percentage))}>
                              {consumable.percentage}%
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full transition-all", getConsumableColor(consumable.percentage))}
                              style={{ width: `${consumable.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Statistics */}
                {statistics.length > 0 && (
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-primary mb-3">
                      <BarChart3 className="h-4 w-4" />
                      Statistics
                    </label>
                    <div className="space-y-2">
                      {statistics.map((stat) => (
                        <div key={stat.label} className="bg-muted/50 rounded-lg p-3 text-center">
                          <div className="text-lg font-semibold text-foreground">{stat.value}</div>
                          <div className="text-xs text-muted-foreground">{stat.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            {/* Middle Column - Controls */}
            <div className="space-y-5">
              {/* Control Buttons */}
              <div>
                <label className="block text-sm font-medium text-primary mb-2">
                  Controls
                </label>
                <div className="flex flex-wrap gap-2">
                  {/* Start/Resume button */}
                  {(!isCleaning || isPaused) && !isReturning && (
                    <Button
                      onClick={isPaused ? handleStart : handleStart}
                      disabled={isLoading || isUnavailable}
                      className="flex items-center gap-2"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      {isPaused ? "Resume" : "Start"}
                    </Button>
                  )}

                  {/* Pause button */}
                  {isCleaning && (
                    <Button
                      onClick={handlePause}
                      disabled={isLoading || isUnavailable}
                      variant="secondary"
                      className="flex items-center gap-2"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Pause className="h-4 w-4" />
                      )}
                      Pause
                    </Button>
                  )}

                  {/* Stop button */}
                  {(isCleaning || isPaused) && (
                    <Button
                      onClick={handleStop}
                      disabled={isLoading || isUnavailable}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Square className="h-4 w-4" />
                      Stop
                    </Button>
                  )}

                  {/* Return to dock button */}
                  {vacuumState !== "docked" && !isReturning && (
                    <Button
                      onClick={handleReturnToBase}
                      disabled={isLoading || isUnavailable}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Home className="h-4 w-4" />
                      Return
                    </Button>
                  )}
                </div>
              </div>

              {/* Fan Speed Selection */}
              {availableFanSpeeds.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-primary mb-2">
                    Fan Speed
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableFanSpeeds.map((speed) => {
                      const Icon = speed.icon;
                      const isSelected = selectedFanSpeed?.toLowerCase() === speed.value.toLowerCase();
                      return (
                        <button
                          key={speed.value}
                          onClick={() => handleSetFanSpeed(speed.value)}
                          disabled={isLoading || isUnavailable}
                          className={cn(
                            "flex items-center gap-2 py-2 px-3 rounded-lg font-medium transition-all text-sm",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {speed.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Cleaning Mode Selection (Vacuum/Mop) */}
              {availableCleaningModes.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-primary mb-2">
                    Cleaning Mode
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableCleaningModes.map((mode) => {
                      const Icon = mode.icon;
                      const isSelected = selectedCleaningMode?.toLowerCase() === mode.value.toLowerCase();
                      return (
                        <button
                          key={mode.value}
                          onClick={() => handleSetCleaningMode(mode.value)}
                          disabled={isLoading || isUnavailable}
                          className={cn(
                            "flex items-center gap-2 py-2 px-3 rounded-lg font-medium transition-all text-sm",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {mode.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Mopping Type Selection - only show when mopping is enabled */}
              {availableMoppingTypes.length > 0 && selectedCleaningMode?.toLowerCase() !== "sweeping" && (
                <div>
                  <label className="block text-sm font-medium text-primary mb-2">
                    <span className="flex items-center gap-2">
                      <Droplets className="h-4 w-4" />
                      Mopping Type
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableMoppingTypes.map((type) => {
                      const isSelected = selectedMoppingType?.toLowerCase() === type.value.toLowerCase();
                      return (
                        <button
                          key={type.value}
                          onClick={() => handleSetMoppingType(type.value)}
                          disabled={isLoading || isUnavailable}
                          className={cn(
                            "py-2 px-3 rounded-lg font-medium transition-all text-sm",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          )}
                        >
                          {type.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Shortcuts Section - in middle column on large screens */}
              {shortcuts.length > 0 && (
                <div className="hidden lg:block">
                  <label className="flex items-center gap-2 text-sm font-medium text-primary mb-3">
                    <Zap className="h-4 w-4" />
                    Shortcuts
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {shortcuts.map((shortcut) => (
                      <button
                        key={shortcut.id}
                        onClick={() => handleRunShortcut(shortcut.id)}
                        disabled={isLoading || isUnavailable}
                        className="py-1.5 px-3 rounded-full bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all text-sm font-medium"
                      >
                        {formatShortcutName(shortcut.name)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Room Selection */}
            <div className="space-y-3">
              {rooms.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-primary">
                      Select Rooms
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={selectAllRooms}
                        className="text-xs text-primary hover:underline"
                      >
                        Select All
                      </button>
                      <span className="text-muted-foreground">|</span>
                      <button
                        onClick={clearRoomSelection}
                        className="text-xs text-muted-foreground hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {rooms.map((room) => {
                      const isSelected = selectedRooms.has(room.id);
                      const IconComponent = room.icon ? MDI_TO_LUCIDE[room.icon] : null;
                      return (
                        <button
                          key={room.id}
                          onClick={() => toggleRoomSelection(room.id)}
                          disabled={isLoading || isUnavailable}
                          className={cn(
                            "flex flex-col items-center justify-center gap-1 py-4 px-2 rounded-lg font-medium transition-all",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          )}
                        >
                          {IconComponent ? (
                            <IconComponent className="h-6 w-6" />
                          ) : (
                            <Home className="h-6 w-6" />
                          )}
                          <span className="text-xs text-center leading-tight line-clamp-2">
                            {room.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Clean selected rooms button */}
                  <Button
                    onClick={handleCleanSelectedRooms}
                    disabled={isLoading || isUnavailable || selectedRooms.size === 0}
                    className="w-full mt-2"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Clean {selectedRooms.size > 0 ? `${selectedRooms.size} Room${selectedRooms.size > 1 ? "s" : ""}` : "Selected Rooms"}
                  </Button>
                </>
              )}

              {/* Show message if no rooms available */}
              {rooms.length === 0 && (
                <div className="py-4 text-sm">
                  <p className="text-center text-muted-foreground">Room selection not available.</p>
                  <details className="mt-3">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                      Show vacuum attributes (debug)
                    </summary>
                    <pre className="mt-2 p-3 bg-muted/50 rounded-lg text-xs overflow-auto max-h-48 text-left">
                      {JSON.stringify(state.attributes, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          </div>

          {/* Shortcuts Section - shown on small/medium screens only */}
          {shortcuts.length > 0 && (
            <div className="lg:hidden mt-6 pt-4 border-t border-border">
              <label className="flex items-center gap-2 text-sm font-medium text-primary mb-3">
                <Zap className="h-4 w-4" />
                Shortcuts
              </label>
              <div className="flex flex-wrap gap-2">
                {shortcuts.map((shortcut) => (
                  <button
                    key={shortcut.id}
                    onClick={() => handleRunShortcut(shortcut.id)}
                    disabled={isLoading || isUnavailable}
                    className="py-1.5 px-3 rounded-full bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all text-sm font-medium"
                  >
                    {formatShortcutName(shortcut.name)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Consumables Section - shown on small/medium screens only */}
          {consumables.length > 0 && (
            <div className="lg:hidden mt-6 pt-4 border-t border-border">
              <button
                onClick={() => setConsumablesExpanded(!consumablesExpanded)}
                className="flex items-center justify-between w-full text-sm font-medium text-primary mb-3"
              >
                <span className="flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Consumables
                </span>
                {consumablesExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              {consumablesExpanded && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {consumables.map((consumable) => (
                    <div key={consumable.key} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{consumable.label}</span>
                        <span className={cn("font-medium", getConsumableTextColor(consumable.percentage))}>
                          {consumable.percentage}%
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", getConsumableColor(consumable.percentage))}
                          style={{ width: `${consumable.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Statistics Section - shown on small/medium screens only */}
          {statistics.length > 0 && (
            <div className="lg:hidden mt-6 pt-4 border-t border-border">
              <label className="flex items-center gap-2 text-sm font-medium text-primary mb-3">
                <BarChart3 className="h-4 w-4" />
                Statistics
              </label>
              <div className="grid grid-cols-3 gap-3">
                {statistics.map((stat) => (
                  <div key={stat.label} className="bg-muted/50 rounded-lg p-3 text-center">
                    <div className="text-lg font-semibold text-foreground">{stat.value}</div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-border">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
