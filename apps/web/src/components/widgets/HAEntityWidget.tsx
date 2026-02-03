import { Zap } from "lucide-react";
import { useHAWebSocket } from "../../stores/homeassistant-ws";
import type { WidgetStyle, FontSizePreset } from "../../stores/screensaver";
import { getFontSizeConfig } from "../../lib/font-size";
import { cn } from "../../lib/utils";

interface HAEntityWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
}

const FONT_SIZE_CLASSES: Record<Exclude<FontSizePreset, "custom">, { name: string; state: string; icon: string }> = {
  xs: { name: "text-[10px]", state: "text-base", icon: "text-lg" },
  sm: { name: "text-xs", state: "text-lg", icon: "text-xl" },
  md: { name: "text-sm", state: "text-2xl", icon: "text-3xl" },
  lg: { name: "text-base", state: "text-4xl", icon: "text-5xl" },
  xl: { name: "text-lg", state: "text-6xl", icon: "text-7xl" },
};

// Scale factors for custom font sizes
const CUSTOM_SCALE = {
  name: 0.5,
  state: 1,
  icon: 1.25,
};

export function HAEntityWidget({ config, style, isBuilder }: HAEntityWidgetProps) {
  const entityId = config.entityId as string ?? "";
  const showIcon = config.showIcon as boolean ?? true;
  const showName = config.showName as boolean ?? true;
  const showState = config.showState as boolean ?? true;
  const showLastChanged = config.showLastChanged as boolean ?? false;

  const { getEntityState, connected } = useHAWebSocket();
  const entity = entityId ? getEntityState(entityId) : undefined;

  const { preset, isCustom, customValue } = getFontSizeConfig(style);
  const sizeClasses = isCustom ? null : FONT_SIZE_CLASSES[preset];

  // Calculate custom font sizes if using custom mode
  const getCustomFontSize = (scale: number) => {
    if (!customValue) return undefined;
    const value = parseFloat(customValue);
    const unit = customValue.replace(/[\d.]/g, "") || "px";
    return `${value * scale}${unit}`;
  };

  // Icon size for custom mode
  const getIconSize = () => {
    if (!isCustom) return undefined;
    const value = parseFloat(customValue || "16");
    return value * CUSTOM_SCALE.icon;
  };

  if (isBuilder || !entityId) {
    return (
      <div
        className={cn(
          "flex h-full flex-col items-center justify-center p-4 rounded-lg",
          "bg-black/40 backdrop-blur-sm"
        )}
        style={{ color: style?.textColor || "#ffffff" }}
      >
        {showIcon && (
          <Zap
            className={cn(sizeClasses?.icon, "opacity-50 mb-2")}
            style={isCustom ? { width: getIconSize(), height: getIconSize() } : undefined}
          />
        )}
        {showName && (
          <div
            className={cn(sizeClasses?.name, "opacity-70 mb-1")}
            style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.name) } : undefined}
          >
            {entityId || "HA Entity"}
          </div>
        )}
        {showState && (
          <div
            className={cn(sizeClasses?.state, "font-light")}
            style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.state) } : undefined}
          >
            {isBuilder ? "State" : "No entity"}
          </div>
        )}
      </div>
    );
  }

  if (!connected) {
    return (
      <div
        className="flex h-full items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <span className="text-sm opacity-50">HA not connected</span>
      </div>
    );
  }

  if (!entity) {
    return (
      <div
        className="flex h-full items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <span className="text-sm opacity-50">Entity not found</span>
      </div>
    );
  }

  const friendlyName = (entity.attributes.friendly_name as string) || entityId;
  const unit = entity.attributes.unit_of_measurement as string | undefined;
  const icon = entity.attributes.icon as string | undefined;

  // Format last changed
  const lastChanged = showLastChanged && entity.last_changed
    ? new Date(entity.last_changed).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center p-4 rounded-lg",
        "bg-black/40 backdrop-blur-sm"
      )}
      style={{ color: style?.textColor || "#ffffff" }}
    >
      {showIcon && (
        <Zap
          className={cn(sizeClasses?.icon, "opacity-70 mb-2")}
          style={isCustom ? { width: getIconSize(), height: getIconSize() } : undefined}
        />
      )}
      {showName && (
        <div
          className={cn(sizeClasses?.name, "opacity-70 mb-1 truncate max-w-full text-center")}
          style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.name) } : undefined}
        >
          {friendlyName}
        </div>
      )}
      {showState && (
        <div
          className={cn(sizeClasses?.state, "font-light")}
          style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.state) } : undefined}
        >
          {entity.state}
          {unit && <span className="opacity-70 ml-1">{unit}</span>}
        </div>
      )}
      {lastChanged && (
        <div
          className={cn(sizeClasses?.name, "opacity-50 mt-1")}
          style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.name) } : undefined}
        >
          {lastChanged}
        </div>
      )}
    </div>
  );
}
