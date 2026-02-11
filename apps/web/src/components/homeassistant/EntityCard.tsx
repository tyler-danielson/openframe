import { useState, useEffect } from "react";
import {
  Lightbulb,
  Power,
  Thermometer,
  Fan,
  Lock,
  Unlock,
  Play,
  Pause,
  Home,
  Volume2,
  ChevronUp,
  ChevronDown,
  ToggleLeft,
  ToggleRight,
  Gauge,
  Loader2,
  Clock,
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  BatteryWarning,
} from "lucide-react";
import { cn } from "../../lib/utils";
import type { HomeAssistantEntityState } from "@openframe/shared";
import { useLongPress } from "../../hooks/useLongPress";
import { EntityTimerMenu, type EntityTimer } from "./EntityTimerMenu";
import { VacuumControlModal } from "./VacuumControlModal";
import { api } from "../../services/api";

// Custom vacuum icon component
function VacuumIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
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

interface EntityCardProps {
  state: HomeAssistantEntityState;
  displayName?: string | null;
  onCallService: (domain: string, service: string, data?: Record<string, unknown>) => Promise<void>;
  onRemove?: () => void;
  activeTimer?: EntityTimer | null;
  onTimerChange?: () => void;
  allEntities?: HomeAssistantEntityState[];
}

export function EntityCard({ state, displayName, onCallService, onRemove, activeTimer, onTimerChange, allEntities }: EntityCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [timerMenuOpen, setTimerMenuOpen] = useState(false);
  const [vacuumModalOpen, setVacuumModalOpen] = useState(false);
  const [remainingTime, setRemainingTime] = useState<string | null>(null);

  const domain = state.entity_id.split(".")[0];
  const friendlyName = state.attributes.friendly_name;
  const entityName = displayName || (typeof friendlyName === "string" ? friendlyName : null) || state.entity_id;
  const isOn = state.state === "on" || state.state === "playing" || state.state === "unlocked";
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
    const interval = setInterval(updateRemaining, 30000);

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

  const renderIcon = () => {
    const iconClass = cn(
      "h-6 w-6 transition-colors",
      isOn ? "text-primary" : "text-muted-foreground"
    );

    switch (domain) {
      case "light":
        return <Lightbulb className={cn(iconClass, isOn && "text-yellow-500 fill-yellow-500/20")} />;
      case "switch":
      case "input_boolean":
        return isOn ? <ToggleRight className={iconClass} /> : <ToggleLeft className={iconClass} />;
      case "fan":
        return <Fan className={cn(iconClass, isOn && "animate-spin")} />;
      case "lock":
        return isOn ? <Unlock className={iconClass} /> : <Lock className={iconClass} />;
      case "climate":
        return <Thermometer className={iconClass} />;
      case "media_player":
        return <Volume2 className={iconClass} />;
      case "cover":
        return <ChevronUp className={iconClass} />;
      case "sensor":
      case "binary_sensor":
        return <Gauge className={iconClass} />;
      case "vacuum": {
        const vacuumState = state.state.toLowerCase();
        const isActive = vacuumState === "cleaning" || vacuumState === "returning";
        return <VacuumIcon className={cn(iconClass, isActive && "text-primary animate-pulse")} />;
      }
      default:
        return <Power className={iconClass} />;
    }
  };

  const renderControls = () => {
    if (isUnavailable) {
      return <span className="text-xs text-muted-foreground">Unavailable</span>;
    }

    switch (domain) {
      case "light":
      case "switch":
      case "fan":
      case "input_boolean":
        return (
          <button
            onClick={handleToggle}
            disabled={isLoading}
            className={cn(
              "relative h-8 w-14 rounded-full transition-colors",
              isOn ? "bg-primary" : "bg-muted"
            )}
          >
            <span
              className={cn(
                "absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all",
                isOn ? "left-7" : "left-1"
              )}
            />
          </button>
        );

      case "lock":
        return (
          <button
            onClick={handleToggle}
            disabled={isLoading}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isOn
                ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
                : "bg-red-500/10 text-red-600 hover:bg-red-500/20"
            )}
          >
            {isOn ? "Unlocked" : "Locked"}
          </button>
        );

      case "cover":
        return (
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleServiceCall("open_cover")}
              disabled={isLoading}
              className="rounded p-1.5 hover:bg-muted"
              title="Open"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleServiceCall("stop_cover")}
              disabled={isLoading}
              className="rounded p-1.5 hover:bg-muted"
              title="Stop"
            >
              <Power className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleServiceCall("close_cover")}
              disabled={isLoading}
              className="rounded p-1.5 hover:bg-muted"
              title="Close"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        );

      case "scene":
      case "script":
        return (
          <button
            onClick={() => handleServiceCall(domain === "scene" ? "turn_on" : "turn_on")}
            disabled={isLoading}
            className="rounded-md bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20"
          >
            <Play className="mr-1 inline h-3 w-3" />
            Activate
          </button>
        );

      case "climate":
        const currentTemp = state.attributes.current_temperature as number | undefined;
        const targetTemp = state.attributes.temperature as number | undefined;
        return (
          <div className="text-right">
            {currentTemp !== undefined && (
              <div className="text-lg font-semibold">{currentTemp}°</div>
            )}
            {targetTemp !== undefined && (
              <div className="text-xs text-muted-foreground">Target: {targetTemp}°</div>
            )}
          </div>
        );

      case "sensor":
        const unit = state.attributes.unit_of_measurement as string | undefined;
        return (
          <div className="text-right">
            <span className="text-lg font-semibold">
              {state.state}
              {unit && <span className="text-sm text-muted-foreground ml-1">{unit}</span>}
            </span>
          </div>
        );

      case "binary_sensor":
        return (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              isOn ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"
            )}
          >
            {isOn ? "On" : "Off"}
          </span>
        );

      case "vacuum": {
        const vacuumState = state.state.toLowerCase();
        const isCleaning = vacuumState === "cleaning";
        const isPaused = vacuumState === "paused";
        const isReturning = vacuumState === "returning";
        const batteryLevel = state.attributes.battery_level as number | undefined;

        const getVacuumStateLabel = () => {
          switch (vacuumState) {
            case "cleaning": return "Cleaning";
            case "docked": return "Docked";
            case "returning": return "Returning";
            case "paused": return "Paused";
            case "idle": return "Idle";
            case "error": return "Error";
            default: return vacuumState;
          }
        };

        const getVacuumStateColor = () => {
          switch (vacuumState) {
            case "cleaning":
            case "returning":
              return "text-primary";
            case "paused":
              return "text-amber-500";
            case "error":
              return "text-destructive";
            default:
              return "text-muted-foreground";
          }
        };

        const getBatteryIcon = () => {
          if (batteryLevel === undefined) return null;
          const iconClass = "h-4 w-4";
          if (batteryLevel <= 10) return <BatteryWarning className={cn(iconClass, "text-destructive")} />;
          if (batteryLevel <= 30) return <BatteryLow className={cn(iconClass, "text-amber-500")} />;
          if (batteryLevel <= 70) return <BatteryMedium className={cn(iconClass, "text-muted-foreground")} />;
          return <BatteryFull className={cn(iconClass, "text-green-500")} />;
        };

        return (
          <div className="flex items-center gap-2">
            {/* Battery indicator */}
            {batteryLevel !== undefined && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {getBatteryIcon()}
                {batteryLevel}%
              </span>
            )}

            {/* Status */}
            <span className={cn("text-sm font-medium capitalize", getVacuumStateColor())}>
              {getVacuumStateLabel()}
            </span>

            {/* Quick action buttons */}
            <div className="flex items-center gap-1 ml-2">
              {!isCleaning && !isReturning && (
                <button
                  onClick={() => handleServiceCall("start")}
                  disabled={isLoading}
                  className="rounded p-1.5 hover:bg-primary/10 text-primary"
                  title="Start"
                >
                  <Play className="h-4 w-4" />
                </button>
              )}
              {isCleaning && (
                <button
                  onClick={() => handleServiceCall("pause")}
                  disabled={isLoading}
                  className="rounded p-1.5 hover:bg-amber-500/10 text-amber-500"
                  title="Pause"
                >
                  <Pause className="h-4 w-4" />
                </button>
              )}
              {isPaused && (
                <button
                  onClick={() => handleServiceCall("start")}
                  disabled={isLoading}
                  className="rounded p-1.5 hover:bg-primary/10 text-primary"
                  title="Resume"
                >
                  <Play className="h-4 w-4" />
                </button>
              )}
              {vacuumState !== "docked" && !isReturning && (
                <button
                  onClick={() => handleServiceCall("return_to_base")}
                  disabled={isLoading}
                  className="rounded p-1.5 hover:bg-muted"
                  title="Return to dock"
                >
                  <Home className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        );
      }

      default:
        if (state.state === "on" || state.state === "off") {
          return (
            <button
              onClick={handleToggle}
              disabled={isLoading}
              className={cn(
                "relative h-8 w-14 rounded-full transition-colors",
                isOn ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all",
                  isOn ? "left-7" : "left-1"
                )}
              />
            </button>
          );
        }
        return <span className="text-sm text-muted-foreground">{state.state}</span>;
    }
  };

  // Brightness slider for lights
  const renderBrightnessSlider = () => {
    if (domain !== "light" || !isOn) return null;

    const brightness = state.attributes.brightness as number | undefined;
    if (brightness === undefined) return null;

    const percent = Math.round((brightness / 255) * 100);

    return (
      <div className="mt-3 pt-3 border-t border-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>Brightness</span>
          <span>{percent}%</span>
        </div>
        <input
          type="range"
          min="1"
          max="255"
          value={brightness}
          onChange={(e) => {
            handleServiceCall("turn_on", { brightness: parseInt(e.target.value) });
          }}
          className="w-full accent-primary"
        />
      </div>
    );
  };

  // Check if vacuum to determine if card should be clickable
  const isVacuum = domain === "vacuum";
  const vacuumState = isVacuum ? state.state.toLowerCase() : "";
  const isVacuumActive = vacuumState === "cleaning" || vacuumState === "returning";

  return (
    <>
      <div
        {...(supportsTimer ? longPressHandlers : {})}
        onClick={isVacuum ? () => setVacuumModalOpen(true) : undefined}
        className={cn(
          "rounded-lg border bg-card p-4 transition-all relative",
          isOn && "border-primary/30 shadow-sm shadow-primary/10",
          isVacuumActive && "border-primary/30 shadow-sm shadow-primary/10",
          isUnavailable && "opacity-50",
          isVacuum && "cursor-pointer hover:bg-muted/50"
        )}
      >
        {/* Timer Badge */}
        {remainingTime && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-primary/20 text-primary rounded-full text-xs font-medium">
            <Clock className="h-3 w-3" />
            {remainingTime}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                isOn ? "bg-primary/10" : "bg-muted",
                isVacuumActive && "bg-primary/10"
              )}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                renderIcon()
              )}
            </div>
            <div>
              <h3 className="font-medium">{entityName}</h3>
              <p className="text-xs text-muted-foreground">{state.entity_id}</p>
            </div>
          </div>

          {renderControls()}
        </div>

        {renderBrightnessSlider()}
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

      {/* Vacuum Control Modal */}
      {isVacuum && (
        <VacuumControlModal
          isOpen={vacuumModalOpen}
          onClose={() => setVacuumModalOpen(false)}
          state={state}
          displayName={displayName}
          onCallService={onCallService}
          allEntities={allEntities}
        />
      )}
    </>
  );
}
