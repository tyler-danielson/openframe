import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Lightbulb,
  Power,
  Thermometer,
  Lock,
  Unlock,
  Eye,
  Droplets,
  Wind,
  ArrowUpDown,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Cpu,
} from "lucide-react";
import { api, type MatterDeviceWithState } from "../../services/api";
import type { MatterDeviceType } from "@openframe/shared";
import { cn } from "../../lib/utils";

function getDeviceIcon(deviceType: MatterDeviceType) {
  switch (deviceType) {
    case "onOffLight":
    case "dimmableLight":
    case "colorTemperatureLight":
      return Lightbulb;
    case "thermostat":
      return Thermometer;
    case "doorLock":
      return Lock;
    case "contactSensor":
      return Eye;
    case "occupancySensor":
      return Eye;
    case "temperatureSensor":
      return Thermometer;
    case "humiditySensor":
      return Droplets;
    case "onOffSwitch":
      return Power;
    case "windowCovering":
      return ArrowUpDown;
    case "fan":
      return Wind;
    default:
      return Cpu;
  }
}

function getDeviceLabel(deviceType: MatterDeviceType): string {
  switch (deviceType) {
    case "onOffLight": return "Light";
    case "dimmableLight": return "Dimmable Light";
    case "colorTemperatureLight": return "Color Temp Light";
    case "thermostat": return "Thermostat";
    case "doorLock": return "Lock";
    case "contactSensor": return "Contact Sensor";
    case "occupancySensor": return "Occupancy Sensor";
    case "temperatureSensor": return "Temperature Sensor";
    case "humiditySensor": return "Humidity Sensor";
    case "onOffSwitch": return "Switch";
    case "windowCovering": return "Window Covering";
    case "fan": return "Fan";
    default: return "Device";
  }
}

interface MatterDeviceCardProps {
  device: MatterDeviceWithState;
}

export function MatterDeviceCard({ device }: MatterDeviceCardProps) {
  const queryClient = useQueryClient();
  const [isCommanding, setIsCommanding] = useState(false);

  const commandMutation = useMutation({
    mutationFn: (cmd: { clusterId: string; commandId: string; payload?: Record<string, unknown> }) =>
      api.sendMatterCommand(device.id, cmd),
    onMutate: () => setIsCommanding(true),
    onSettled: () => {
      setIsCommanding(false);
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["matter-devices"] }), 500);
    },
  });

  const Icon = getDeviceIcon(device.deviceType);
  const isReachable = device.state.isReachable;
  const attrs = device.state.attributes;

  const isOn = attrs.onOff === true;
  const level = attrs.currentLevel;

  const handleToggle = () => {
    commandMutation.mutate({ clusterId: "onOff", commandId: isOn ? "off" : "on" });
  };

  const handleLock = (lock: boolean) => {
    commandMutation.mutate({ clusterId: "doorLock", commandId: lock ? "lock" : "unlock" });
  };

  const handleLevel = (newLevel: number) => {
    commandMutation.mutate({
      clusterId: "levelControl",
      commandId: "moveToLevel",
      payload: { level: newLevel, transitionTime: 10 },
    });
  };

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-all",
        isReachable
          ? "border-primary/20 bg-card hover:border-primary/40"
          : "border-border/50 bg-muted/30 opacity-60"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
            isReachable && isOn ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
          )}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-primary truncate">{device.displayName}</h3>
            <p className="text-xs text-muted-foreground">{getDeviceLabel(device.deviceType)}</p>
          </div>
        </div>

        {/* Reachability indicator */}
        <div className={cn(
          "w-2 h-2 rounded-full flex-shrink-0 mt-1",
          isReachable ? "bg-primary" : "bg-destructive/70"
        )} />
      </div>

      {/* Controls based on device type */}
      <div className="space-y-2">
        {/* On/Off toggle for lights and switches */}
        {(device.deviceType === "onOffLight" ||
          device.deviceType === "dimmableLight" ||
          device.deviceType === "colorTemperatureLight" ||
          device.deviceType === "onOffSwitch") && (
          <button
            onClick={handleToggle}
            disabled={!isReachable || isCommanding}
            className={cn(
              "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              isOn
                ? "bg-primary/10 text-primary hover:bg-primary/20"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
              (!isReachable || isCommanding) && "cursor-not-allowed"
            )}
          >
            {isCommanding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isOn ? (
              <ToggleRight className="w-4 h-4" />
            ) : (
              <ToggleLeft className="w-4 h-4" />
            )}
            {isOn ? "On" : "Off"}
          </button>
        )}

        {/* Brightness slider for dimmable lights */}
        {(device.deviceType === "dimmableLight" || device.deviceType === "colorTemperatureLight") &&
          level !== undefined && (
          <div className="flex items-center gap-2 px-1">
            <Lightbulb className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <input
              type="range"
              min={0}
              max={254}
              value={level}
              onChange={(e) => handleLevel(Number(e.target.value))}
              disabled={!isReachable || isCommanding}
              className="flex-1 h-1.5 accent-primary"
            />
            <span className="text-xs text-muted-foreground w-8 text-right">
              {Math.round((level / 254) * 100)}%
            </span>
          </div>
        )}

        {/* Thermostat display */}
        {device.deviceType === "thermostat" && (
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-muted-foreground">Temperature</span>
            <span className="text-sm font-medium text-primary">
              {attrs.localTemperature != null
                ? `${(attrs.localTemperature / 100).toFixed(1)}°`
                : "--"}
            </span>
          </div>
        )}

        {/* Door lock */}
        {device.deviceType === "doorLock" && (
          <button
            onClick={() => handleLock(attrs.lockState !== 1)}
            disabled={!isReachable || isCommanding}
            className={cn(
              "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              attrs.lockState === 1
                ? "bg-primary/10 text-primary hover:bg-primary/20"
                : "bg-accent/10 text-accent-foreground hover:bg-accent/20",
              (!isReachable || isCommanding) && "cursor-not-allowed"
            )}
          >
            {isCommanding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : attrs.lockState === 1 ? (
              <Lock className="w-4 h-4" />
            ) : (
              <Unlock className="w-4 h-4" />
            )}
            {attrs.lockState === 1 ? "Locked" : "Unlocked"}
          </button>
        )}

        {/* Sensor displays */}
        {device.deviceType === "temperatureSensor" && attrs.measuredTemperature != null && (
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-muted-foreground">Temperature</span>
            <span className="text-sm font-medium text-primary">
              {(attrs.measuredTemperature / 100).toFixed(1)}°C
            </span>
          </div>
        )}

        {device.deviceType === "humiditySensor" && attrs.measuredHumidity != null && (
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-muted-foreground">Humidity</span>
            <span className="text-sm font-medium text-primary">
              {(attrs.measuredHumidity / 100).toFixed(1)}%
            </span>
          </div>
        )}

        {device.deviceType === "contactSensor" && (
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-muted-foreground">State</span>
            <span className={cn(
              "text-sm font-medium",
              attrs.contactState ? "text-primary" : "text-accent-foreground"
            )}>
              {attrs.contactState ? "Closed" : "Open"}
            </span>
          </div>
        )}

        {device.deviceType === "occupancySensor" && (
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-muted-foreground">Occupancy</span>
            <span className={cn(
              "text-sm font-medium",
              attrs.occupancy ? "text-primary" : "text-muted-foreground"
            )}>
              {attrs.occupancy ? "Occupied" : "Clear"}
            </span>
          </div>
        )}

        {/* Window covering */}
        {device.deviceType === "windowCovering" && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => commandMutation.mutate({ clusterId: "windowCovering", commandId: "upOrOpen" })}
              disabled={!isReachable || isCommanding}
              className="flex-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-muted hover:bg-muted/80 text-muted-foreground transition-colors disabled:cursor-not-allowed"
            >
              Open
            </button>
            <button
              onClick={() => commandMutation.mutate({ clusterId: "windowCovering", commandId: "stop" })}
              disabled={!isReachable || isCommanding}
              className="flex-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-muted hover:bg-muted/80 text-muted-foreground transition-colors disabled:cursor-not-allowed"
            >
              Stop
            </button>
            <button
              onClick={() => commandMutation.mutate({ clusterId: "windowCovering", commandId: "downOrClose" })}
              disabled={!isReachable || isCommanding}
              className="flex-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-muted hover:bg-muted/80 text-muted-foreground transition-colors disabled:cursor-not-allowed"
            >
              Close
            </button>
          </div>
        )}

        {/* Fan */}
        {device.deviceType === "fan" && (
          <button
            onClick={handleToggle}
            disabled={!isReachable || isCommanding}
            className={cn(
              "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              isOn
                ? "bg-primary/10 text-primary hover:bg-primary/20"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
              (!isReachable || isCommanding) && "cursor-not-allowed"
            )}
          >
            {isCommanding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wind className="w-4 h-4" />
            )}
            {isOn ? "On" : "Off"}
            {attrs.fanSpeed != null && isOn && (
              <span className="ml-auto text-xs opacity-70">{attrs.fanSpeed}%</span>
            )}
          </button>
        )}
      </div>

      {/* Vendor info */}
      {(device.vendorName || device.productName) && (
        <p className="text-[10px] text-muted-foreground/60 mt-2 truncate">
          {[device.vendorName, device.productName].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
}
