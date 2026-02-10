import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import type { WidgetStyle, FontSizePreset } from "../../stores/screensaver";
import { getFontSizeConfig } from "../../lib/font-size";
import { cn } from "../../lib/utils";

interface WeatherWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
}

const getWeatherIcon = (iconCode: string): string => {
  const iconMap: Record<string, string> = {
    "01d": "☀️",
    "01n": "🌙",
    "02d": "⛅",
    "02n": "☁️",
    "03d": "☁️",
    "03n": "☁️",
    "04d": "☁️",
    "04n": "☁️",
    "09d": "🌧️",
    "09n": "🌧️",
    "10d": "🌦️",
    "10n": "🌧️",
    "11d": "⛈️",
    "11n": "⛈️",
    "13d": "❄️",
    "13n": "❄️",
    "50d": "🌫️",
    "50n": "🌫️",
  };
  return iconMap[iconCode] || "🌡️";
};

const FONT_SIZE_CLASSES: Record<Exclude<FontSizePreset, "custom">, { temp: string; icon: string; detail: string }> = {
  xs: { temp: "text-lg", icon: "text-2xl", detail: "text-[10px]" },
  sm: { temp: "text-2xl", icon: "text-3xl", detail: "text-xs" },
  md: { temp: "text-4xl", icon: "text-5xl", detail: "text-sm" },
  lg: { temp: "text-6xl", icon: "text-7xl", detail: "text-base" },
  xl: { temp: "text-8xl", icon: "text-9xl", detail: "text-lg" },
};

// Scale factors for custom font sizes
const CUSTOM_SCALE = {
  temp: 1,
  icon: 1.25,
  detail: 0.3,
};

export function WeatherWidget({ config, style, isBuilder }: WeatherWidgetProps) {
  const showIcon = config.showIcon as boolean ?? true;
  const showDescription = config.showDescription as boolean ?? true;
  const showHumidity = config.showHumidity as boolean ?? true;
  const showWind = config.showWind as boolean ?? true;

  const { data: weather, isLoading, error } = useQuery({
    queryKey: ["widget-weather"],
    queryFn: () => api.getCurrentWeather(),
    staleTime: 10 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    retry: false,
    enabled: !isBuilder,
  });

  const { preset, isCustom, customValue } = getFontSizeConfig(style);
  const sizeClasses = isCustom ? null : FONT_SIZE_CLASSES[preset as Exclude<FontSizePreset, "custom">];

  // Calculate custom font sizes if using custom mode
  const getCustomFontSize = (scale: number) => {
    if (!customValue) return undefined;
    const value = parseFloat(customValue);
    const unit = customValue.replace(/[\d.]/g, "") || "px";
    return `${value * scale}${unit}`;
  };

  if (isBuilder && !weather) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <div
          className={cn(sizeClasses?.icon, "mb-2")}
          style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.icon) } : undefined}
        >
          ☀️
        </div>
        <div
          className={cn(sizeClasses?.temp, "font-light")}
          style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.temp) } : undefined}
        >
          72°F
        </div>
        <div
          className={cn(sizeClasses?.detail, "opacity-70")}
          style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.detail) } : undefined}
        >
          Sample Weather
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className="flex h-full items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <span className="text-sm opacity-50">Loading weather...</span>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div
        className="flex h-full items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <span className="text-sm opacity-50">Weather unavailable</span>
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
      <div className="flex items-center gap-3">
        {showIcon && (
          <span
            className={sizeClasses?.icon}
            style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.icon) } : undefined}
          >
            {getWeatherIcon(weather.icon)}
          </span>
        )}
        <div
          className={cn(sizeClasses?.temp, "font-light")}
          style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.temp) } : undefined}
        >
          {weather.temp}°{weather.units === "metric" ? "C" : "F"}
        </div>
      </div>
      {showDescription && (
        <div
          className={cn(sizeClasses?.detail, "opacity-70 capitalize mt-1")}
          style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.detail) } : undefined}
        >
          {weather.description}
        </div>
      )}
      {(showHumidity || showWind) && (
        <div
          className={cn(sizeClasses?.detail, "opacity-50 mt-2 flex gap-3")}
          style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.detail) } : undefined}
        >
          {showHumidity && <span>Humidity: {weather.humidity}%</span>}
          {showWind && <span>Wind: {weather.wind_speed} {weather.units === "metric" ? "km/h" : "mph"}</span>}
        </div>
      )}
    </div>
  );
}
