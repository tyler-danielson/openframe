import { Eye, EyeOff } from "lucide-react";
import { cn } from "../../lib/utils";
import type { HomeAssistantEntityState } from "@openframe/shared";
import { formatTimeAgo } from "./sensorDetection";

interface MotionSensorCardProps {
  state: HomeAssistantEntityState;
  displayName?: string | null;
  onOpenModal: () => void;
}

export function MotionSensorCard({ state, displayName, onOpenModal }: MotionSensorCardProps) {
  const friendlyName = state.attributes.friendly_name;
  const entityName = displayName || (typeof friendlyName === "string" ? friendlyName : null) || state.entity_id;
  const isDetected = state.state === "on";

  return (
    <div
      onClick={onOpenModal}
      className={cn(
        "homio-card w-full text-left transition-all relative cursor-pointer hover:scale-[1.02] active:scale-[0.98]",
        isDetected && "active"
      )}
    >
      <div className="flex flex-col items-center pt-2 pb-3">
        {/* Icon with pulsing radar ring when motion detected */}
        <div className="relative flex items-center justify-center w-16 h-16 mb-3">
          {isDetected && (
            <div className="absolute inset-0 rounded-full bg-[hsl(var(--theme-accent))]/30 animate-ping" />
          )}
          <div
            className={cn(
              "relative flex items-center justify-center w-16 h-16 rounded-full transition-all",
              isDetected
                ? "bg-[hsl(var(--theme-accent))] text-[hsl(var(--background))]"
                : "bg-white/10 text-[var(--homio-text-secondary)]"
            )}
          >
            {isDetected ? (
              <Eye className="h-8 w-8" />
            ) : (
              <EyeOff className="h-8 w-8" />
            )}
          </div>
        </div>

        {/* Entity Name */}
        <div className="text-center px-2">
          <div className={cn(
            "font-medium text-sm leading-tight mb-1",
            isDetected ? "text-[var(--homio-text-primary)]" : "text-[var(--homio-text-secondary)]"
          )}>
            {entityName}
          </div>

          {/* Status Text */}
          <div className={cn(
            "text-xs uppercase tracking-wider",
            isDetected ? "text-primary" : "text-muted-foreground"
          )}>
            {isDetected ? "Motion Detected" : `Last: ${formatTimeAgo(state.last_changed)}`}
          </div>
        </div>
      </div>
    </div>
  );
}
