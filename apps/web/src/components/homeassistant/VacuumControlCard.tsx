import { useState } from "react";
import {
  Loader2,
  Play,
  Pause,
  Home,
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  BatteryWarning,
  AlertCircle,
} from "lucide-react";
import { cn } from "../../lib/utils";
import type { HomeAssistantEntityState } from "@openframe/shared";

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

interface VacuumControlCardProps {
  state: HomeAssistantEntityState;
  displayName?: string | null;
  onCallService: (domain: string, service: string, data?: Record<string, unknown>) => Promise<void>;
  onOpenModal?: () => void;
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

export function VacuumControlCard({
  state,
  displayName,
  onCallService,
  onOpenModal,
}: VacuumControlCardProps) {
  const [isLoading, setIsLoading] = useState(false);

  const friendlyName = state.attributes.friendly_name;
  const entityName = displayName || (typeof friendlyName === "string" ? friendlyName : null) || state.entity_id;

  const vacuumState = state.state.toLowerCase();
  const stateInfo = VACUUM_STATE_MAP[vacuumState] || VACUUM_STATE_MAP.unknown!;
  const isActive = stateInfo.isActive;
  const isCleaning = vacuumState === "cleaning";
  const isPaused = vacuumState === "paused";
  const isReturning = vacuumState === "returning";
  const isUnavailable = vacuumState === "unavailable" || vacuumState === "unknown";

  // Battery level
  const batteryLevel = state.attributes.battery_level as number | undefined;
  const batteryIcon = state.attributes.battery_icon as string | undefined;

  const handleServiceCall = async (service: string, data?: Record<string, unknown>) => {
    setIsLoading(true);
    try {
      await onCallService("vacuum", service, { entity_id: state.entity_id, ...data });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleServiceCall("start");
  };

  const handlePause = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleServiceCall("pause");
  };

  const handleReturnToBase = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleServiceCall("return_to_base");
  };

  const getBatteryIcon = () => {
    if (batteryLevel === undefined) return null;

    const iconClass = "h-4 w-4";
    if (batteryLevel <= 10) {
      return <BatteryWarning className={cn(iconClass, "text-destructive")} />;
    } else if (batteryLevel <= 30) {
      return <BatteryLow className={cn(iconClass, "text-amber-500")} />;
    } else if (batteryLevel <= 70) {
      return <BatteryMedium className={cn(iconClass, "text-muted-foreground")} />;
    }
    return <BatteryFull className={cn(iconClass, "text-green-500")} />;
  };

  return (
    <div
      onClick={onOpenModal}
      className={cn(
        "homio-card w-full text-left transition-all relative",
        !isUnavailable && "cursor-pointer hover:scale-[1.02] active:scale-[0.98]",
        isActive && "active",
        isUnavailable && "opacity-50 cursor-not-allowed",
        isLoading && "pointer-events-none"
      )}
    >
      {/* Battery Badge */}
      {batteryLevel !== undefined && (
        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-primary/10 rounded-full text-xs font-medium">
          {getBatteryIcon()}
          <span className="text-muted-foreground">{batteryLevel}%</span>
        </div>
      )}

      {/* Large Icon Circle */}
      <div className="flex flex-col items-center pt-2 pb-3">
        <div
          className={cn(
            "flex items-center justify-center w-16 h-16 rounded-full mb-3 transition-all",
            isActive
              ? "bg-[hsl(var(--theme-accent))] text-[hsl(var(--background))]"
              : "bg-white/10 text-[var(--homio-text-secondary)]"
          )}
        >
          {isLoading ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : vacuumState === "error" ? (
            <AlertCircle className="h-8 w-8" />
          ) : (
            <VacuumIcon className="h-8 w-8" isAnimated={isCleaning} />
          )}
        </div>

        {/* Entity Name */}
        <div className="text-center px-2">
          <div className={cn(
            "font-medium text-sm leading-tight mb-1",
            isActive ? "text-[var(--homio-text-primary)]" : "text-[var(--homio-text-secondary)]"
          )}>
            {entityName}
          </div>

          {/* Status Text */}
          <div className={cn(
            "text-xs uppercase tracking-wider",
            stateInfo.color
          )}>
            {stateInfo.label}
          </div>
        </div>
      </div>

      {/* Quick Action Buttons */}
      {!isUnavailable && (
        <div className="flex items-center justify-center gap-2 pb-3">
          {/* Start button - shown when not cleaning */}
          {!isCleaning && !isReturning && (
            <button
              onClick={handleStart}
              disabled={isLoading}
              className="p-2 rounded-full bg-primary/20 hover:bg-primary/30 text-primary transition-colors"
              title="Start cleaning"
            >
              <Play className="h-4 w-4" />
            </button>
          )}

          {/* Pause button - shown when cleaning */}
          {(isCleaning || isPaused) && (
            <button
              onClick={isPaused ? handleStart : handlePause}
              disabled={isLoading}
              className="p-2 rounded-full bg-primary/20 hover:bg-primary/30 text-primary transition-colors"
              title={isPaused ? "Resume" : "Pause"}
            >
              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
          )}

          {/* Return to dock button */}
          {!vacuumState.includes("docked") && vacuumState !== "returning" && (
            <button
              onClick={handleReturnToBase}
              disabled={isLoading}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-[var(--homio-text-secondary)] transition-colors"
              title="Return to dock"
            >
              <Home className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
