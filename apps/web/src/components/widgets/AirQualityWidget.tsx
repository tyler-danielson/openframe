import { useQuery } from "@tanstack/react-query";
import { Wind } from "lucide-react";
import { api } from "../../services/api";
import type { WidgetStyle } from "../../stores/screensaver";
import { getFontSizeConfig } from "../../lib/font-size";
import { cn } from "../../lib/utils";

interface AirQualityWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
}

const AQI_COLORS = ["", "#4caf50", "#8bc34a", "#ff9800", "#f44336", "#9c27b0"];
const AQI_LABELS = ["", "Good", "Fair", "Moderate", "Poor", "Very Poor"];
const AQI_DESCRIPTIONS = [
  "",
  "Air quality is satisfactory",
  "Acceptable for most people",
  "Sensitive groups may experience effects",
  "Health effects possible for everyone",
  "Health alert: everyone may experience effects",
];

const POLLUTANT_LABELS: Record<string, { name: string; unit: string }> = {
  pm2_5: { name: "PM2.5", unit: "µg/m³" },
  pm10: { name: "PM10", unit: "µg/m³" },
  o3: { name: "Ozone (O₃)", unit: "µg/m³" },
  no2: { name: "NO₂", unit: "µg/m³" },
  so2: { name: "SO₂", unit: "µg/m³" },
  co: { name: "CO", unit: "µg/m³" },
};

export function AirQualityWidget({ config, style, isBuilder }: AirQualityWidgetProps) {
  const showComponents = (config.showComponents as boolean) ?? true;

  const { data } = useQuery({
    queryKey: ["air-quality"],
    queryFn: () => api.getAirQuality(),
    refetchInterval: 30 * 60 * 1000,
    staleTime: 15 * 60 * 1000,
    enabled: !isBuilder,
  });

  const { isCustom, customValue } = getFontSizeConfig(style);

  if (isBuilder) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}>
        <Wind className="h-10 w-10 opacity-50 mb-2" />
        <span className="text-sm opacity-70">Air Quality</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}>
        <span className="text-sm opacity-50">Loading...</span>
      </div>
    );
  }

  const aqi = data.aqi;
  const color = AQI_COLORS[aqi] || "#888";

  return (
    <div
      className="flex flex-col h-full rounded-lg bg-black/40 backdrop-blur-sm overflow-hidden"
      style={{
        color: style?.textColor || "#ffffff",
        ...(isCustom && customValue ? { fontSize: customValue } : {}),
      }}
    >
      {/* AQI display */}
      <div className="flex items-center gap-4 p-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shrink-0"
          style={{ backgroundColor: `${color}30`, color, border: `3px solid ${color}` }}
        >
          {aqi}
        </div>
        <div>
          <div className="font-semibold text-lg" style={{ color }}>{AQI_LABELS[aqi]}</div>
          <div className="text-xs opacity-50 mt-0.5">{AQI_DESCRIPTIONS[aqi]}</div>
        </div>
      </div>

      {/* Pollutant breakdown */}
      {showComponents && data.components && (
        <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-1.5">
          {Object.entries(POLLUTANT_LABELS).map(([key, info]) => {
            const value = data.components[key];
            if (value === undefined) return null;
            return (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="opacity-60">{info.name}</span>
                <span className="font-mono tabular-nums">
                  {value.toFixed(1)} <span className="opacity-40">{info.unit}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
