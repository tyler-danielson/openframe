import { useState, useEffect } from "react";
import {
  Lightbulb,
  Power,
  Thermometer,
  Fan,
  Lock,
  Unlock,
  Play,
  Volume2,
  ChevronUp,
  ChevronDown,
  Gauge,
  Loader2,
  Square,
  Tv,
  Blinds,
  Plug,
  Droplets,
  Sun,
  Snowflake,
  Flame,
  Wifi,
  WifiOff,
  BatteryLow,
  BatteryMedium,
  BatteryFull,
  DoorOpen,
  DoorClosed,
  Eye,
  EyeOff,
  Bell,
  BellOff,
  Camera,
  Speaker,
  Zap,
  Home,
  Timer,
  ToggleLeft,
  ToggleRight,
  Clock,
} from "lucide-react";
import { cn } from "../../lib/utils";
import type { HomeAssistantEntityState } from "@openframe/shared";
import { useLongPress } from "../../hooks/useLongPress";
import { EntityTimerMenu, type EntityTimer } from "./EntityTimerMenu";
import { VacuumControlCard } from "./VacuumControlCard";
import { VacuumControlModal } from "./VacuumControlModal";
import { api } from "../../services/api";

interface HomioEntityCardProps {
  state: HomeAssistantEntityState;
  displayName?: string | null;
  onCallService: (domain: string, service: string, data?: Record<string, unknown>) => Promise<void>;
  activeTimer?: EntityTimer | null;
  onTimerChange?: () => void;
  allEntities?: HomeAssistantEntityState[];
}

export function HomioEntityCard({ state, displayName, onCallService, activeTimer, onTimerChange, allEntities }: HomioEntityCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [timerMenuOpen, setTimerMenuOpen] = useState(false);
  const [vacuumModalOpen, setVacuumModalOpen] = useState(false);
  const [remainingTime, setRemainingTime] = useState<string | null>(null);

  const domain = state.entity_id.split(".")[0];

  // Handle vacuum entities with dedicated components
  if (domain === "vacuum") {
    return (
      <>
        <VacuumControlCard
          state={state}
          displayName={displayName}
          onCallService={onCallService}
          onOpenModal={() => setVacuumModalOpen(true)}
        />
        <VacuumControlModal
          isOpen={vacuumModalOpen}
          onClose={() => setVacuumModalOpen(false)}
          state={state}
          displayName={displayName}
          onCallService={onCallService}
          allEntities={allEntities}
        />
      </>
    );
  }
  const friendlyName = state.attributes.friendly_name;
  const entityName = displayName || (typeof friendlyName === "string" ? friendlyName : null) || state.entity_id;
  const isOn = state.state === "on" || state.state === "playing" || state.state === "unlocked" || state.state === "open";
  const isUnavailable = state.state === "unavailable" || state.state === "unknown";

  // Check if this entity supports timers (lights and switches only)
  const supportsTimer = domain === "light" || domain === "switch";

  // Update remaining time display
  useEffect(() => {
    if (!activeTimer) {
      setRemainingTime(null);
      return;
    }

    const updateRemaining = () => {
      const target = new Date(activeTimer.triggerAt);
      const now = new Date();
      const diffMs = target.getTime() - now.getTime();

      if (diffMs <= 0) {
        setRemainingTime(null);
        onTimerChange?.();
        return;
      }

      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 60) {
        setRemainingTime(`${diffMins}m`);
      } else {
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        setRemainingTime(mins > 0 ? `${hours}h${mins}m` : `${hours}h`);
      }
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [activeTimer, onTimerChange]);

  // Long press handler for timer menu
  const longPressHandlers = useLongPress({
    threshold: 500,
    onLongPress: () => {
      if (supportsTimer && !isUnavailable) {
        setTimerMenuOpen(true);
      }
    },
    onClick: () => {
      if (isControllable() && !isUnavailable) {
        handleToggle();
      }
    },
  });

  const handleServiceCall = async (service: string, data?: Record<string, unknown>) => {
    setIsLoading(true);
    try {
      await onCallService(domain!, service, { entity_id: state.entity_id, ...data });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = () => {
    if (domain === "lock") {
      handleServiceCall(isOn ? "lock" : "unlock");
    } else if (domain === "cover") {
      handleServiceCall(isOn ? "close_cover" : "open_cover");
    } else {
      handleServiceCall("toggle");
    }
  };

  const handleCreateTimer = async (data: {
    entityId: string;
    action: "turn_on" | "turn_off";
    triggerAt: string;
    fadeEnabled: boolean;
    fadeDuration: number;
  }) => {
    await api.createHomeAssistantTimer(data);
    onTimerChange?.();
  };

  const handleCancelTimer = async (timerId: string) => {
    await api.cancelHomeAssistantTimer(timerId);
    onTimerChange?.();
  };

  // Get device class for better icon selection
  const deviceClass = state.attributes.device_class as string | undefined;

  // Get appropriate icon based on domain and device class
  const getIcon = () => {
    const iconSize = "h-8 w-8";

    if (isLoading) {
      return <Loader2 className={cn(iconSize, "animate-spin")} />;
    }

    // Binary sensors - use device class
    if (domain === "binary_sensor") {
      switch (deviceClass) {
        case "door":
          return isOn ? <DoorOpen className={iconSize} /> : <DoorClosed className={iconSize} />;
        case "window":
        case "opening":
          return isOn ? <Blinds className={iconSize} /> : <Blinds className={iconSize} />;
        case "motion":
        case "occupancy":
        case "presence":
          return isOn ? <Eye className={iconSize} /> : <EyeOff className={iconSize} />;
        case "connectivity":
          return isOn ? <Wifi className={iconSize} /> : <WifiOff className={iconSize} />;
        case "battery":
          return isOn ? <BatteryLow className={iconSize} /> : <BatteryFull className={iconSize} />;
        case "plug":
        case "power":
          return <Plug className={iconSize} />;
        case "moisture":
        case "water":
          return <Droplets className={iconSize} />;
        case "smoke":
        case "gas":
        case "heat":
          return <Flame className={iconSize} />;
        case "sound":
          return isOn ? <Bell className={iconSize} /> : <BellOff className={iconSize} />;
        default:
          return <Gauge className={iconSize} />;
      }
    }

    // Sensors - use device class
    if (domain === "sensor") {
      switch (deviceClass) {
        case "temperature":
          return <Thermometer className={iconSize} />;
        case "humidity":
          return <Droplets className={iconSize} />;
        case "battery":
          const batteryLevel = parseFloat(state.state) || 0;
          if (batteryLevel <= 20) return <BatteryLow className={iconSize} />;
          if (batteryLevel <= 60) return <BatteryMedium className={iconSize} />;
          return <BatteryFull className={iconSize} />;
        case "power":
        case "energy":
        case "voltage":
        case "current":
          return <Zap className={iconSize} />;
        case "illuminance":
          return <Sun className={iconSize} />;
        case "pressure":
          return <Gauge className={iconSize} />;
        default:
          return <Gauge className={iconSize} />;
      }
    }

    // Other domains
    switch (domain) {
      case "light":
        return <Lightbulb className={cn(iconSize, isOn && "fill-current")} />;
      case "switch":
        return isOn ? <ToggleRight className={iconSize} /> : <ToggleLeft className={iconSize} />;
      case "input_boolean":
        return isOn ? <ToggleRight className={iconSize} /> : <ToggleLeft className={iconSize} />;
      case "fan":
        return <Fan className={cn(iconSize, isOn && "animate-spin")} style={{ animationDuration: "1s" }} />;
      case "lock":
        return isOn ? <Unlock className={iconSize} /> : <Lock className={iconSize} />;
      case "cover":
        return <Blinds className={iconSize} />;
      case "climate":
        const hvacMode = state.state;
        if (hvacMode === "cool") return <Snowflake className={iconSize} />;
        if (hvacMode === "heat") return <Flame className={iconSize} />;
        if (hvacMode === "fan_only") return <Fan className={iconSize} />;
        return <Thermometer className={iconSize} />;
      case "media_player":
        const mediaType = state.attributes.device_class as string | undefined;
        if (mediaType === "speaker") return <Speaker className={iconSize} />;
        if (mediaType === "tv") return <Tv className={iconSize} />;
        return <Volume2 className={iconSize} />;
      case "camera":
        return <Camera className={iconSize} />;
      case "scene":
        return <Home className={iconSize} />;
      case "script":
        return <Play className={iconSize} />;
      case "automation":
        return <Timer className={iconSize} />;
      case "vacuum":
        return <Home className={iconSize} />;
      default:
        return <Power className={iconSize} />;
    }
  };

  // Get status text
  const getStatusText = (): string => {
    if (isUnavailable) return "Unavailable";

    switch (domain) {
      case "light":
        if (!isOn) return "Off";
        const brightness = state.attributes.brightness as number | undefined;
        if (brightness !== undefined) {
          const percent = Math.round((brightness / 255) * 100);
          return `${percent}%`;
        }
        return "On";
      case "switch":
      case "input_boolean":
      case "fan":
        return isOn ? "On" : "Off";
      case "lock":
        return isOn ? "Unlocked" : "Locked";
      case "cover":
        const position = state.attributes.current_position as number | undefined;
        if (position !== undefined) return `${position}%`;
        return state.state === "open" ? "Open" : state.state === "closed" ? "Closed" : state.state;
      case "climate":
        const currentTemp = state.attributes.current_temperature as number | undefined;
        const targetTemp = state.attributes.temperature as number | undefined;
        if (currentTemp !== undefined) {
          return `${currentTemp}°${targetTemp ? ` → ${targetTemp}°` : ""}`;
        }
        return state.state;
      case "sensor":
        const unit = state.attributes.unit_of_measurement as string | undefined;
        return unit ? `${state.state}${unit}` : state.state;
      case "binary_sensor":
        return isOn ? "Detected" : "Clear";
      case "media_player":
        if (state.state === "playing") {
          const title = state.attributes.media_title as string | undefined;
          return title || "Playing";
        }
        return state.state;
      default:
        return state.state;
    }
  };

  // Check if entity is controllable (can be toggled)
  const isControllable = () => {
    return ["light", "switch", "fan", "input_boolean", "lock", "cover", "scene", "script", "automation"].includes(domain || "");
  };

  // Brightness slider for lights
  const renderBrightnessSlider = () => {
    if (domain !== "light" || !isOn) return null;

    const brightness = state.attributes.brightness as number | undefined;
    if (brightness === undefined) return null;

    return (
      <div className="mt-4 px-2">
        <input
          type="range"
          min="1"
          max="255"
          value={brightness}
          onChange={(e) => {
            handleServiceCall("turn_on", { brightness: parseInt(e.target.value) });
          }}
          className="homio-slider w-full"
        />
      </div>
    );
  };

  // Cover controls
  const renderCoverControls = () => {
    if (domain !== "cover") return null;

    return (
      <div className="flex items-center justify-center gap-2 mt-3">
        <button
          onClick={() => handleServiceCall("open_cover")}
          disabled={isLoading}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          title="Open"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
        <button
          onClick={() => handleServiceCall("stop_cover")}
          disabled={isLoading}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          title="Stop"
        >
          <Square className="h-4 w-4" />
        </button>
        <button
          onClick={() => handleServiceCall("close_cover")}
          disabled={isLoading}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          title="Close"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      </div>
    );
  };

  return (
    <>
      <div
        {...(supportsTimer ? longPressHandlers : {})}
        className={cn(
          "homio-card w-full text-left transition-all relative",
          isControllable() && !isUnavailable && "cursor-pointer hover:scale-[1.02] active:scale-[0.98]",
          isOn && "active",
          isUnavailable && "opacity-50 cursor-not-allowed",
          isLoading && "pointer-events-none"
        )}
      >
        {/* Timer Badge */}
        {remainingTime && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-primary/20 text-primary rounded-full text-xs font-medium">
            <Clock className="h-3 w-3" />
            {remainingTime}
          </div>
        )}

        {/* Large Icon Circle */}
        <div className="flex flex-col items-center pt-2 pb-3">
          <div
            className={cn(
              "flex items-center justify-center w-16 h-16 rounded-full mb-3 transition-all",
              isOn
                ? "bg-[hsl(var(--theme-accent))] text-[hsl(var(--background))]"
                : "bg-white/10 text-[var(--homio-text-secondary)]"
            )}
          >
            {getIcon()}
          </div>

          {/* Entity Name */}
          <div className="text-center px-2">
            <div className={cn(
              "font-medium text-sm leading-tight mb-1",
              isOn ? "text-[var(--homio-text-primary)]" : "text-[var(--homio-text-secondary)]"
            )}>
              {entityName}
            </div>

            {/* Status Text */}
            <div className={cn(
              "text-xs uppercase tracking-wider",
              isOn ? "text-[hsl(var(--theme-accent))]" : "text-[var(--homio-text-muted)]"
            )}>
              {getStatusText()}
            </div>
          </div>
        </div>

        {/* Brightness Slider for Lights */}
        {renderBrightnessSlider()}

        {/* Cover Controls */}
        {renderCoverControls()}
      </div>

      {/* Timer Menu */}
      {supportsTimer && (
        <EntityTimerMenu
          isOpen={timerMenuOpen}
          onClose={() => setTimerMenuOpen(false)}
          entityId={state.entity_id}
          entityName={entityName}
          currentState={state.state}
          domain={domain as "light" | "switch"}
          existingTimer={activeTimer}
          onCreateTimer={handleCreateTimer}
          onCancelTimer={handleCancelTimer}
        />
      )}
    </>
  );
}
