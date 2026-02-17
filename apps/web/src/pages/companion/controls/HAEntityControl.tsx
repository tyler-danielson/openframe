import { useQuery } from "@tanstack/react-query";
import { Power, Zap, Loader2 } from "lucide-react";
import { api } from "../../../services/api";

interface HAEntityControlProps {
  kioskId: string;
  widgetId: string;
  widgetState?: Record<string, unknown>;
  config: Record<string, unknown>;
}

const TOGGLABLE_DOMAINS = new Set([
  "switch",
  "light",
  "input_boolean",
  "fan",
  "automation",
  "script",
  "scene",
  "lock",
  "cover",
]);

export function HAEntityControl({ kioskId, widgetId, widgetState, config }: HAEntityControlProps) {
  const entityId = (config.entityId as string) || (widgetState?.entityId as string) || "";
  const domain = entityId.split(".")[0] || "";
  const isTogglable = TOGGLABLE_DOMAINS.has(domain);

  // Fetch entity state directly from HA
  const { data: entity, isLoading } = useQuery({
    queryKey: ["companion-ha-entity", entityId],
    queryFn: () => api.getHomeAssistantState(entityId),
    enabled: !!entityId,
    refetchInterval: 5000,
  });

  const friendlyName = (entity?.attributes?.friendly_name as string) || entityId;
  const currentState = entity?.state || (widgetState?.state as string) || "unknown";
  const unit = entity?.attributes?.unit_of_measurement as string | undefined;
  const isOn = currentState === "on";

  const handleToggle = () => {
    api.callHomeAssistantService("homeassistant", "toggle", {
      entity_id: entityId,
    }).catch(() => {});
  };

  if (!entityId) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No entity configured
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center p-6 space-y-8">
      {/* Entity icon and state */}
      <div className="flex flex-col items-center gap-4">
        <div
          className={`flex items-center justify-center h-24 w-24 rounded-full transition-colors ${
            isOn
              ? "bg-primary/20 ring-2 ring-primary/40"
              : "bg-muted"
          }`}
        >
          <Zap
            className={`h-12 w-12 ${isOn ? "text-primary" : "text-muted-foreground"}`}
          />
        </div>

        <div className="text-center">
          <div className="text-lg font-semibold text-foreground">{friendlyName}</div>
          <div className="text-sm text-muted-foreground mt-1">
            {currentState}
            {unit && ` ${unit}`}
          </div>
          {entity?.last_changed && (
            <div className="text-xs text-muted-foreground mt-1">
              Last changed:{" "}
              {new Date(entity.last_changed).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>
          )}
        </div>
      </div>

      {/* Toggle button */}
      {isTogglable && (
        <button
          onClick={handleToggle}
          className={`flex items-center gap-3 px-8 py-4 rounded-xl font-medium text-lg transition-colors ${
            isOn
              ? "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80"
              : "bg-muted text-foreground hover:bg-muted/80 active:bg-muted/60"
          }`}
        >
          <Power className="h-6 w-6" />
          {isOn ? "Turn Off" : "Turn On"}
        </button>
      )}

      {/* Entity attributes */}
      {entity?.attributes && (
        <div className="w-full max-w-sm space-y-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
            Attributes
          </div>
          <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
            {Object.entries(entity.attributes)
              .filter(
                ([key]) =>
                  !["friendly_name", "icon", "entity_picture", "supported_features"].includes(key)
              )
              .slice(0, 8)
              .map(([key, value]) => (
                <div key={key} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{key.replace(/_/g, " ")}</span>
                  <span className="text-foreground font-medium truncate ml-4 max-w-[60%] text-right">
                    {String(value)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
