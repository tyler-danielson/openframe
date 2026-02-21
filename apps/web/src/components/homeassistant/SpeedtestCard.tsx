import { ArrowDown, ArrowUp, Activity } from "lucide-react";
import { cn } from "../../lib/utils";
import type { HomeAssistantEntityState } from "@openframe/shared";

interface SpeedtestCardProps {
  state: HomeAssistantEntityState;
  displayName?: string | null;
  onOpenModal: () => void;
}

function getSpeedtestType(entityId: string): "download" | "upload" | "ping" {
  const id = entityId.toLowerCase();
  if (id.includes("download")) return "download";
  if (id.includes("upload")) return "upload";
  if (id.includes("ping")) return "ping";
  return "download";
}

function getSpeedtestIcon(type: "download" | "upload" | "ping") {
  const iconClass = "h-8 w-8";
  switch (type) {
    case "download":
      return <ArrowDown className={iconClass} />;
    case "upload":
      return <ArrowUp className={iconClass} />;
    case "ping":
      return <Activity className={iconClass} />;
  }
}

function getGaugeMax(type: "download" | "upload" | "ping"): number {
  switch (type) {
    case "download":
      return 1000;
    case "upload":
      return 500;
    case "ping":
      return 100;
  }
}

export function SpeedtestCard({ state, displayName, onOpenModal }: SpeedtestCardProps) {
  const friendlyName = state.attributes.friendly_name;
  const entityName = displayName || (typeof friendlyName === "string" ? friendlyName : null) || state.entity_id;
  const unit = state.attributes.unit_of_measurement as string | undefined;

  const speedType = getSpeedtestType(state.entity_id);
  const value = parseFloat(state.state);
  const isValid = !isNaN(value);

  // For ping, lower is better so we invert the gauge
  const gaugeMax = getGaugeMax(speedType);
  const gaugePercent = isValid
    ? speedType === "ping"
      ? Math.max(0, Math.min(100, ((gaugeMax - value) / gaugeMax) * 100))
      : Math.max(0, Math.min(100, (value / gaugeMax) * 100))
    : 0;

  return (
    <div
      onClick={onOpenModal}
      className={cn(
        "homio-card w-full text-left transition-all relative cursor-pointer hover:scale-[1.02] active:scale-[0.98]",
        isValid && "active"
      )}
    >
      <div className="flex flex-col items-center pt-2 pb-3">
        {/* Icon Circle */}
        <div
          className={cn(
            "flex items-center justify-center w-16 h-16 rounded-full mb-3 transition-all",
            isValid
              ? "bg-primary text-primary-foreground"
              : "bg-white/10 text-muted-foreground"
          )}
        >
          {getSpeedtestIcon(speedType)}
        </div>

        {/* Entity Name */}
        <div className="text-center px-2">
          <div className={cn(
            "font-medium text-sm leading-tight mb-1",
            isValid ? "text-[var(--homio-text-primary)]" : "text-[var(--homio-text-secondary)]"
          )}>
            {entityName}
          </div>

          {/* Value */}
          <div className={cn(
            "text-xs uppercase tracking-wider",
            isValid ? "text-primary" : "text-muted-foreground"
          )}>
            {isValid ? `${value} ${unit || ""}`.trim() : state.state}
          </div>
        </div>

        {/* Mini Gauge Bar */}
        {isValid && (
          <div className="w-full px-4 mt-3">
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${gaugePercent}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
