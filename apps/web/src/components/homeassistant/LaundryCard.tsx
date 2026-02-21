import { cn } from "../../lib/utils";
import type { HomeAssistantEntityState } from "@openframe/shared";

interface LaundryCardProps {
  state: HomeAssistantEntityState;
  displayName?: string | null;
  onOpenModal: () => void;
}

// State map for laundry appliances
const LAUNDRY_STATE_MAP: Record<string, { label: string; color: string; isActive: boolean }> = {
  idle: { label: "Idle", color: "text-muted-foreground", isActive: false },
  off: { label: "Off", color: "text-muted-foreground", isActive: false },
  ready: { label: "Ready", color: "text-muted-foreground", isActive: false },
  standby: { label: "Standby", color: "text-muted-foreground", isActive: false },
  running: { label: "Running", color: "text-primary", isActive: true },
  washing: { label: "Washing", color: "text-primary", isActive: true },
  drying: { label: "Drying", color: "text-primary", isActive: true },
  rinsing: { label: "Rinsing", color: "text-primary", isActive: true },
  spinning: { label: "Spinning", color: "text-primary", isActive: true },
  complete: { label: "Complete", color: "text-green-600", isActive: false },
  finished: { label: "Finished", color: "text-green-600", isActive: false },
  error: { label: "Error", color: "text-destructive", isActive: false },
  paused: { label: "Paused", color: "text-amber-600", isActive: false },
  delayed_start: { label: "Delayed", color: "text-amber-600", isActive: false },
};

function isDryer(entityId: string, friendlyName: string): boolean {
  const id = entityId.toLowerCase();
  const name = friendlyName.toLowerCase();
  return id.includes("dryer") || id.includes("tumble_dryer") || name.includes("dryer");
}

// Custom washer icon with animated inner drum
function WasherIcon({ className, isActive }: { className?: string; isActive?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Outer body */}
      <rect x="3" y="2" width="18" height="20" rx="2" />
      {/* Control panel dots */}
      <circle cx="7" cy="5" r="0.8" fill="currentColor" />
      <circle cx="10" cy="5" r="0.8" fill="currentColor" />
      {/* Door circle */}
      <circle cx="12" cy="14" r="6" />
      {/* Inner drum with rotation */}
      <g style={isActive ? { transformOrigin: "12px 14px", animation: "spin 3s linear infinite" } : undefined}>
        <path d="M12 10c1.5 1 1.5 3 0 4" />
        <path d="M12 18c-1.5-1-1.5-3 0-4" />
        <path d="M8.5 12.5c1-1.5 3-1.5 4 0" />
        <path d="M15.5 15.5c-1 1.5-3 1.5-4 0" />
      </g>
    </svg>
  );
}

// Custom dryer icon with animated inner drum
function DryerIcon({ className, isActive }: { className?: string; isActive?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Outer body */}
      <rect x="3" y="2" width="18" height="20" rx="2" />
      {/* Control panel */}
      <circle cx="7" cy="5" r="0.8" fill="currentColor" />
      <line x1="10" y1="5" x2="17" y2="5" />
      {/* Door circle */}
      <circle cx="12" cy="14" r="6" />
      {/* Inner tumble pattern */}
      <g style={isActive ? { transformOrigin: "12px 14px", animation: "spin 3s linear infinite" } : undefined}>
        <path d="M9 12.5c1.5-1.5 4.5-1.5 6 0" />
        <path d="M9 15.5c1.5 1.5 4.5 1.5 6 0" />
      </g>
    </svg>
  );
}

export function LaundryCard({ state, displayName, onOpenModal }: LaundryCardProps) {
  const friendlyName = state.attributes.friendly_name;
  const entityName = displayName || (typeof friendlyName === "string" ? friendlyName : null) || state.entity_id;
  const nameStr = typeof friendlyName === "string" ? friendlyName : "";

  const stateKey = state.state.toLowerCase();
  const stateInfo = LAUNDRY_STATE_MAP[stateKey] || { label: state.state, color: "text-[var(--homio-text-muted)]", isActive: false };
  const isActive = stateInfo.isActive;
  const isComplete = stateKey === "complete" || stateKey === "finished";
  const dryer = isDryer(state.entity_id, nameStr);

  // Remaining time from attributes
  const remainingTime = (state.attributes.remaining_time || state.attributes.remain_time) as string | number | undefined;
  const remainingTimeStr = remainingTime !== undefined && remainingTime !== null ? String(remainingTime) : null;

  // Progress from attributes
  const progress = state.attributes.progress as number | undefined;

  return (
    <div
      onClick={onOpenModal}
      className={cn(
        "homio-card w-full text-left transition-all relative cursor-pointer hover:scale-[1.02] active:scale-[0.98]",
        isActive && "active"
      )}
    >
      {/* Remaining Time Badge */}
      {remainingTimeStr && isActive && (
        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-primary/10 rounded-full text-xs font-medium text-primary">
          {remainingTimeStr}
        </div>
      )}

      <div className="flex flex-col items-center pt-2 pb-3">
        {/* Icon Circle */}
        <div
          className={cn(
            "flex items-center justify-center w-16 h-16 rounded-full mb-3 transition-all",
            isActive
              ? "bg-primary text-primary-foreground"
              : isComplete
                ? "bg-green-600/20 text-green-600"
                : "bg-white/10 text-muted-foreground"
          )}
        >
          {dryer ? (
            <DryerIcon className="h-8 w-8" isActive={isActive} />
          ) : (
            <WasherIcon className="h-8 w-8" isActive={isActive} />
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
          <div className={cn("text-xs uppercase tracking-wider", stateInfo.color)}>
            {stateInfo.label}
          </div>
        </div>

        {/* Progress Bar */}
        {progress !== undefined && isActive && (
          <div className="w-full px-4 mt-3">
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
