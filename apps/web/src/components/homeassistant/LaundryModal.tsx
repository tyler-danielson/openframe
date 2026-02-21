import { X, Clock, Zap, Thermometer, RotateCw } from "lucide-react";
import { cn } from "../../lib/utils";
import type { HomeAssistantEntityState } from "@openframe/shared";
import { formatTimeAgo } from "./sensorDetection";

interface LaundryModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: HomeAssistantEntityState;
  displayName?: string | null;
  allEntities?: HomeAssistantEntityState[];
}

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
  delayed_start: { label: "Delayed Start", color: "text-amber-600", isActive: false },
};

function isDryer(entityId: string): boolean {
  const id = entityId.toLowerCase();
  return id.includes("dryer") || id.includes("tumble_dryer");
}

// Custom washer icon
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
      <rect x="3" y="2" width="18" height="20" rx="2" />
      <circle cx="7" cy="5" r="0.8" fill="currentColor" />
      <circle cx="10" cy="5" r="0.8" fill="currentColor" />
      <circle cx="12" cy="14" r="6" />
      <g style={isActive ? { transformOrigin: "12px 14px", animation: "spin 3s linear infinite" } : undefined}>
        <path d="M12 10c1.5 1 1.5 3 0 4" />
        <path d="M12 18c-1.5-1-1.5-3 0-4" />
        <path d="M8.5 12.5c1-1.5 3-1.5 4 0" />
        <path d="M15.5 15.5c-1 1.5-3 1.5-4 0" />
      </g>
    </svg>
  );
}

export function LaundryModal({ isOpen, onClose, state, displayName, allEntities }: LaundryModalProps) {
  if (!isOpen) return null;

  const friendlyName = state.attributes.friendly_name;
  const entityName = displayName || (typeof friendlyName === "string" ? friendlyName : null) || state.entity_id;

  const stateKey = state.state.toLowerCase();
  const stateInfo = LAUNDRY_STATE_MAP[stateKey] || { label: state.state, color: "text-muted-foreground", isActive: false };

  const currentCourse = (state.attributes.current_course || state.attributes.run_state) as string | undefined;
  const remainingTime = (state.attributes.remaining_time || state.attributes.remain_time) as string | number | undefined;
  const remainingTimeStr = remainingTime !== undefined && remainingTime !== null ? String(remainingTime) : null;
  const progress = state.attributes.progress as number | undefined;

  // Gather detail attributes
  const detailAttrs: { label: string; value: string; icon: typeof Zap }[] = [];

  const power = state.attributes.power as number | string | undefined;
  if (power !== undefined) {
    detailAttrs.push({ label: "Power", value: `${power} W`, icon: Zap });
  }

  const temperature = (state.attributes.temperature || state.attributes.wash_temperature) as number | string | undefined;
  if (temperature !== undefined) {
    detailAttrs.push({ label: "Temperature", value: `${temperature}°`, icon: Thermometer });
  }

  const spinSpeed = (state.attributes.spin_speed || state.attributes.spin_level) as number | string | undefined;
  if (spinSpeed !== undefined) {
    detailAttrs.push({ label: "Spin Speed", value: `${spinSpeed} RPM`, icon: RotateCw });
  }

  // Find related entities by prefix matching
  const entityPrefix = state.entity_id.split(".")[1]?.split("_").slice(0, 2).join("_") || "";
  const relatedEntities = (allEntities || []).filter(
    (e) =>
      e.entity_id !== state.entity_id &&
      e.entity_id.startsWith("sensor.") &&
      e.entity_id.includes(entityPrefix) &&
      entityPrefix.length > 3
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center justify-center w-10 h-10 rounded-full",
              stateInfo.isActive ? "bg-primary/20" : "bg-muted"
            )}>
              <WasherIcon className="h-5 w-5" isActive={stateInfo.isActive} />
            </div>
            <div>
              <h2 className="font-semibold">{entityName}</h2>
              <div className="flex items-center gap-2 text-sm">
                <span className={stateInfo.color}>{stateInfo.label}</span>
                {currentCourse && (
                  <span className="text-muted-foreground">- {currentCourse}</span>
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Time Remaining */}
          {remainingTimeStr && (
            <div className="flex flex-col items-center py-4">
              <Clock className="h-8 w-8 text-primary mb-2" />
              <div className="text-3xl font-bold">{remainingTimeStr}</div>
              <div className="text-sm text-muted-foreground">Time Remaining</div>
            </div>
          )}

          {/* Progress Bar */}
          {progress !== undefined && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                />
              </div>
            </div>
          )}

          {/* Detail Attributes */}
          {detailAttrs.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-primary mb-3">
                Details
              </label>
              <div className="grid grid-cols-2 gap-3">
                {detailAttrs.map((attr) => {
                  const Icon = attr.icon;
                  return (
                    <div key={attr.label} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <Icon className="h-4 w-4 text-primary shrink-0" />
                      <div>
                        <div className="text-xs text-muted-foreground">{attr.label}</div>
                        <div className="text-sm font-medium">{attr.value}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Related Entities */}
          {relatedEntities.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-primary mb-3">
                Related Sensors
              </label>
              <div className="grid grid-cols-2 gap-2">
                {relatedEntities.slice(0, 8).map((entity) => {
                  const name = typeof entity.attributes.friendly_name === "string"
                    ? entity.attributes.friendly_name
                    : entity.entity_id;
                  const unit = entity.attributes.unit_of_measurement as string | undefined;
                  const value = unit ? `${entity.state} ${unit}` : entity.state;

                  return (
                    <div key={entity.entity_id} className="p-3 rounded-lg bg-muted/50">
                      <div className="text-xs text-muted-foreground truncate">{name}</div>
                      <div className="text-sm font-medium">{value}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatTimeAgo(entity.last_changed)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
