import { X, ArrowDown, ArrowUp, Activity } from "lucide-react";
import { cn } from "../../lib/utils";
import type { HomeAssistantEntityState } from "@openframe/shared";
import { isSpeedtestEntity, formatTimeAgo } from "./sensorDetection";

interface SpeedtestModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: HomeAssistantEntityState;
  displayName?: string | null;
  allEntities?: HomeAssistantEntityState[];
}

type SpeedtestType = "download" | "upload" | "ping";

function getSpeedtestType(entityId: string): SpeedtestType {
  const id = entityId.toLowerCase();
  if (id.includes("download")) return "download";
  if (id.includes("upload")) return "upload";
  if (id.includes("ping")) return "ping";
  return "download";
}

function getSpeedtestConfig(type: SpeedtestType) {
  switch (type) {
    case "download":
      return { icon: ArrowDown, label: "Download", gaugeMax: 1000, color: "text-primary" };
    case "upload":
      return { icon: ArrowUp, label: "Upload", gaugeMax: 500, color: "text-primary" };
    case "ping":
      return { icon: Activity, label: "Ping", gaugeMax: 100, color: "text-primary" };
  }
}

export function SpeedtestModal({ isOpen, onClose, state, displayName, allEntities }: SpeedtestModalProps) {
  if (!isOpen) return null;

  const friendlyName = state.attributes.friendly_name;
  const entityName = displayName || (typeof friendlyName === "string" ? friendlyName : null) || state.entity_id;

  // Find all speedtest sibling entities
  const allSpeedtest = (allEntities || []).filter(isSpeedtestEntity);

  // Group by type, preferring our own entity for its type
  const metrics: { type: SpeedtestType; entity: HomeAssistantEntityState }[] = [];
  const typeOrder: SpeedtestType[] = ["download", "upload", "ping"];

  for (const type of typeOrder) {
    const match = allSpeedtest.find((e) => getSpeedtestType(e.entity_id) === type);
    if (match) {
      metrics.push({ type, entity: match });
    }
  }

  // If no grouped metrics found, just show the current entity
  if (metrics.length === 0) {
    metrics.push({ type: getSpeedtestType(state.entity_id), entity: state });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/20">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">Network Speed</h2>
              <div className="text-sm text-muted-foreground">Speedtest Results</div>
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
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {metrics.map(({ type, entity }) => {
            const config = getSpeedtestConfig(type);
            const Icon = config.icon;
            const value = parseFloat(entity.state);
            const isValid = !isNaN(value);
            const unit = entity.attributes.unit_of_measurement as string | undefined;

            const gaugePercent = isValid
              ? type === "ping"
                ? Math.max(0, Math.min(100, ((config.gaugeMax - value) / config.gaugeMax) * 100))
                : Math.max(0, Math.min(100, (value / config.gaugeMax) * 100))
              : 0;

            return (
              <div key={type} className="p-4 rounded-xl bg-muted/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("flex items-center justify-center w-10 h-10 rounded-full bg-muted", config.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{config.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatTimeAgo(entity.last_changed)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">
                      {isValid ? value.toFixed(type === "ping" ? 0 : 1) : "--"}
                    </div>
                    <div className="text-xs text-muted-foreground">{unit || ""}</div>
                  </div>
                </div>

                {/* Gauge Bar */}
                {isValid && (
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${gaugePercent}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
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
