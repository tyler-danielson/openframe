import { useHAWebSocket } from "../../stores/homeassistant-ws";
import type { WidgetStyle, FontSizePreset } from "../../stores/screensaver";
import { getFontSizeConfig } from "../../lib/font-size";
import { cn } from "../../lib/utils";

interface HAGaugeWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
}

const FONT_SIZE_CLASSES: Record<Exclude<FontSizePreset, "custom">, { value: string; name: string }> = {
  xs: { value: "text-base", name: "text-[10px]" },
  sm: { value: "text-lg", name: "text-xs" },
  md: { value: "text-2xl", name: "text-sm" },
  lg: { value: "text-4xl", name: "text-base" },
  xl: { value: "text-6xl", name: "text-lg" },
};

// Gauge sizes based on font preset
const GAUGE_SIZES: Record<Exclude<FontSizePreset, "custom">, { size: number; stroke: number }> = {
  xs: { size: 60, stroke: 5 },
  sm: { size: 80, stroke: 6 },
  md: { size: 100, stroke: 8 },
  lg: { size: 120, stroke: 10 },
  xl: { size: 160, stroke: 12 },
};

// Scale factors for custom font sizes
const CUSTOM_SCALE = {
  value: 1,
  name: 0.5,
};

export function HAGaugeWidget({ config, style, isBuilder }: HAGaugeWidgetProps) {
  const entityId = config.entityId as string ?? "";
  const min = config.min as number ?? 0;
  const max = config.max as number ?? 100;
  const unit = config.unit as string ?? "";
  const showValue = config.showValue as boolean ?? true;
  const showName = config.showName as boolean ?? true;
  const warningValue = config.warningValue as number ?? 70;
  const criticalValue = config.criticalValue as number ?? 90;

  const { getEntityState, connected } = useHAWebSocket();
  const entity = entityId ? getEntityState(entityId) : undefined;

  const { preset, isCustom, customValue } = getFontSizeConfig(style);
  const presetKey = preset as Exclude<FontSizePreset, "custom">;
  const sizeClasses = isCustom ? null : FONT_SIZE_CLASSES[presetKey];
  const gaugeConfig = isCustom ? { size: 100, stroke: 8 } : GAUGE_SIZES[presetKey];

  // Calculate custom font sizes if using custom mode
  const getCustomFontSize = (scale: number) => {
    if (!customValue) return undefined;
    const value = parseFloat(customValue);
    const unit = customValue.replace(/[\d.]/g, "") || "px";
    return `${value * scale}${unit}`;
  };

  const getGaugeValue = () => {
    if (isBuilder) return 65;
    if (!entity) return 0;
    const numValue = parseFloat(entity.state);
    return isNaN(numValue) ? 0 : numValue;
  };

  const value = getGaugeValue();
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  // Calculate color based on value
  const getColor = () => {
    const normalizedValue = ((value - min) / (max - min)) * 100;
    if (normalizedValue >= criticalValue) return "#ef4444"; // red
    if (normalizedValue >= warningValue) return "#f59e0b"; // amber
    return "#22c55e"; // green
  };

  // SVG arc calculations
  const { size: gaugeSize, stroke: strokeWidth } = gaugeConfig;
  const radius = (gaugeSize - strokeWidth) / 2;
  const circumference = radius * Math.PI * 1.5; // 270 degrees
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const friendlyName = entity?.attributes.friendly_name as string || entityId || "HA Gauge";
  const displayUnit = unit || (entity?.attributes.unit_of_measurement as string) || "";

  if (!entityId && !isBuilder) {
    return (
      <div
        className="flex h-full items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <span className="text-sm opacity-50">No entity configured</span>
      </div>
    );
  }

  if (!connected && !isBuilder) {
    return (
      <div
        className="flex h-full items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <span className="text-sm opacity-50">HA not connected</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center p-4 rounded-lg",
        "bg-black/40 backdrop-blur-sm"
      )}
      style={{ color: style?.textColor || "#ffffff" }}
    >
      <div className="relative" style={{ width: gaugeSize, height: gaugeSize * 0.75 }}>
        <svg
          width={gaugeSize}
          height={gaugeSize * 0.75}
          viewBox={`0 0 ${gaugeSize} ${gaugeSize * 0.75}`}
          className="transform -rotate-0"
        >
          {/* Background arc */}
          <path
            d={`M ${strokeWidth / 2} ${gaugeSize * 0.6} A ${radius} ${radius} 0 1 1 ${gaugeSize - strokeWidth / 2} ${gaugeSize * 0.6}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="opacity-20"
          />
          {/* Value arc */}
          <path
            d={`M ${strokeWidth / 2} ${gaugeSize * 0.6} A ${radius} ${radius} 0 1 1 ${gaugeSize - strokeWidth / 2} ${gaugeSize * 0.6}`}
            fill="none"
            stroke={getColor()}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500"
          />
        </svg>
        {/* Value display */}
        {showValue && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ paddingTop: gaugeSize * 0.15 }}
          >
            <div
              className={cn(sizeClasses?.value, "font-light")}
              style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.value) } : undefined}
            >
              {value.toFixed(displayUnit === "%" ? 0 : 1)}
              {displayUnit && <span className="opacity-70 ml-0.5 text-[0.6em]">{displayUnit}</span>}
            </div>
          </div>
        )}
      </div>
      {showName && (
        <div
          className={cn(sizeClasses?.name, "opacity-70 mt-2 truncate max-w-full text-center")}
          style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.name) } : undefined}
        >
          {friendlyName}
        </div>
      )}
    </div>
  );
}
