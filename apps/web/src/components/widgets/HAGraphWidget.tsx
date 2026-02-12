import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { useHAWebSocket } from "../../stores/homeassistant-ws";
import type { WidgetStyle, FontSizePreset } from "../../stores/screensaver";
import { getFontSizeConfig } from "../../lib/font-size";
import { cn } from "../../lib/utils";

interface HAGraphWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
}

const FONT_SIZE_CLASSES: Record<Exclude<FontSizePreset, "custom">, { label: string; value: string }> = {
  xs: { label: "text-[8px]", value: "text-[10px]" },
  sm: { label: "text-[10px]", value: "text-xs" },
  md: { label: "text-xs", value: "text-sm" },
  lg: { label: "text-sm", value: "text-base" },
  xl: { label: "text-base", value: "text-lg" },
};

// Scale factors for custom font sizes
const CUSTOM_SCALE = {
  label: 0.75,
  value: 1,
};

export function HAGraphWidget({ config, style, isBuilder }: HAGraphWidgetProps) {
  const entityId = config.entityId as string ?? "";
  const hours = config.hours as number ?? 24;
  const showLabels = config.showLabels as boolean ?? true;
  const showGrid = config.showGrid as boolean ?? true;
  const lineColor = config.lineColor as string ?? "#3B82F6";

  const { getEntityState, connected, connecting, error: wsError } = useHAWebSocket();
  const wsEntity = entityId ? getEntityState(entityId) : undefined;

  // REST fallback when WebSocket is unavailable
  const useRestFallback = !isBuilder && entityId && (!!wsError || (!connected && !connecting));
  const { data: restEntity } = useQuery({
    queryKey: ["ha-entity-rest", entityId],
    queryFn: () => api.getHomeAssistantState(entityId),
    enabled: !!useRestFallback,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });

  const entity = connected && wsEntity ? wsEntity : restEntity;

  const { preset, isCustom, customValue } = getFontSizeConfig(style);
  const sizeClasses = isCustom ? null : FONT_SIZE_CLASSES[preset as Exclude<FontSizePreset, "custom">];

  // Calculate custom font sizes if using custom mode
  const getCustomFontSize = (scale: number) => {
    if (!customValue) return undefined;
    const value = parseFloat(customValue);
    const unit = customValue.replace(/[\d.]/g, "") || "px";
    return `${value * scale}${unit}`;
  };

  // Mock data for preview
  const mockData = [
    { time: "12am", value: 65 },
    { time: "4am", value: 62 },
    { time: "8am", value: 68 },
    { time: "12pm", value: 72 },
    { time: "4pm", value: 75 },
    { time: "8pm", value: 70 },
    { time: "now", value: 68 },
  ];

  const friendlyName = entity?.attributes.friendly_name as string || entityId || "HA Graph";
  const unit = entity?.attributes.unit_of_measurement as string || "";
  const currentValue = entity ? parseFloat(entity.state) : mockData[mockData.length - 1]?.value ?? 0;

  // Generate SVG path from data
  const generatePath = (data: { value: number }[], width: number, height: number) => {
    if (data.length === 0) return "";

    const minValue = Math.min(...data.map(d => d.value));
    const maxValue = Math.max(...data.map(d => d.value));
    const range = maxValue - minValue || 1;
    const padding = 10;

    const points = data.map((d, i) => {
      const x = padding + (i / (data.length - 1)) * (width - padding * 2);
      const y = height - padding - ((d.value - minValue) / range) * (height - padding * 2);
      return `${x},${y}`;
    });

    return `M ${points.join(" L ")}`;
  };

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

  // For now, we don't have history API, so show current value with mock graph
  const data = mockData;

  return (
    <div
      className={cn(
        "flex h-full flex-col p-4 rounded-lg",
        "bg-black/40 backdrop-blur-sm"
      )}
      style={{ color: style?.textColor || "#ffffff" }}
    >
      <div className="flex items-center justify-between mb-2">
        <div
          className={cn(sizeClasses?.label, "opacity-70 truncate")}
          style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.label) } : undefined}
        >
          {friendlyName}
        </div>
        <div
          className={cn(sizeClasses?.value, "font-medium")}
          style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.value) } : undefined}
        >
          {isNaN(currentValue) ? entity?.state : currentValue.toFixed(1)}
          {unit && <span className="opacity-70 ml-1">{unit}</span>}
        </div>
      </div>

      <div className="flex-1 relative min-h-0">
        <svg
          className="w-full h-full"
          viewBox="0 0 200 100"
          preserveAspectRatio="none"
        >
          {/* Grid lines */}
          {showGrid && (
            <>
              <line x1="10" y1="25" x2="190" y2="25" stroke="currentColor" strokeOpacity="0.1" strokeWidth="1" />
              <line x1="10" y1="50" x2="190" y2="50" stroke="currentColor" strokeOpacity="0.1" strokeWidth="1" />
              <line x1="10" y1="75" x2="190" y2="75" stroke="currentColor" strokeOpacity="0.1" strokeWidth="1" />
            </>
          )}

          {/* Graph line */}
          <path
            d={generatePath(data, 200, 100)}
            fill="none"
            stroke={lineColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Area under the line */}
          <path
            d={`${generatePath(data, 200, 100)} L 190,90 L 10,90 Z`}
            fill={lineColor}
            fillOpacity="0.1"
          />
        </svg>

        {/* Time labels */}
        {showLabels && (
          <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2">
            <span
              className={cn(sizeClasses?.label, "opacity-50")}
              style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.label) } : undefined}
            >
              {hours}h ago
            </span>
            <span
              className={cn(sizeClasses?.label, "opacity-50")}
              style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.label) } : undefined}
            >
              now
            </span>
          </div>
        )}
      </div>

      {isBuilder && (
        <div
          className={cn(sizeClasses?.label, "opacity-40 text-center mt-1")}
          style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.label) } : undefined}
        >
          Historical data requires HA history API
        </div>
      )}
    </div>
  );
}
