import { useState } from "react";
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
  ToggleLeft,
  ToggleRight,
  Gauge,
  Loader2,
} from "lucide-react";
import { cn } from "../../lib/utils";
import type { HomeAssistantEntityState } from "@openframe/shared";

interface EntityCardProps {
  state: HomeAssistantEntityState;
  displayName?: string | null;
  onCallService: (domain: string, service: string, data?: Record<string, unknown>) => Promise<void>;
  onRemove?: () => void;
}

export function EntityCard({ state, displayName, onCallService, onRemove }: EntityCardProps) {
  const [isLoading, setIsLoading] = useState(false);

  const domain = state.entity_id.split(".")[0];
  const friendlyName = state.attributes.friendly_name;
  const entityName = displayName || (typeof friendlyName === "string" ? friendlyName : null) || state.entity_id;
  const isOn = state.state === "on" || state.state === "playing" || state.state === "unlocked";
  const isUnavailable = state.state === "unavailable" || state.state === "unknown";

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

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 transition-all",
        isOn && "border-primary/30 shadow-sm shadow-primary/10",
        isUnavailable && "opacity-50"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              isOn ? "bg-primary/10" : "bg-muted"
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
  );
}
