import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import type { WidgetStyle, FontSizePreset } from "../../stores/screensaver";
import { getFontSizeConfig } from "../../lib/font-size";
import { cn } from "../../lib/utils";

interface ForecastWidgetProps {
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

const FONT_SIZE_CLASSES: Record<Exclude<FontSizePreset, "custom">, { day: string; temp: string; icon: string }> = {
  xs: { day: "text-[10px]", temp: "text-xs", icon: "text-base" },
  sm: { day: "text-xs", temp: "text-sm", icon: "text-lg" },
  md: { day: "text-sm", temp: "text-base", icon: "text-2xl" },
  lg: { day: "text-base", temp: "text-lg", icon: "text-3xl" },
  xl: { day: "text-lg", temp: "text-xl", icon: "text-4xl" },
};

// Scale factors for custom font sizes
const CUSTOM_SCALE = {
  day: 1,
  temp: 1.15,
  icon: 2,
};

export function ForecastWidget({ config, style, isBuilder }: ForecastWidgetProps) {
  const days = config.days as number ?? 5;
  const showHighLow = config.showHighLow as boolean ?? true;
  const showIcons = config.showIcons as boolean ?? true;

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

  // Mock forecast data for builder preview
  const mockForecast = [
    { day: "Mon", icon: "01d", high: 75, low: 58 },
    { day: "Tue", icon: "02d", high: 72, low: 55 },
    { day: "Wed", icon: "10d", high: 68, low: 52 },
    { day: "Thu", icon: "03d", high: 70, low: 54 },
    { day: "Fri", icon: "01d", high: 78, low: 60 },
  ];

  if (isBuilder) {
    return (
      <div
        className={cn(
          "flex h-full flex-col p-4 rounded-lg",
          "bg-black/40 backdrop-blur-sm"
        )}
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <div
          className={cn(sizeClasses?.day, "opacity-50 uppercase tracking-wide mb-2")}
          style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.day) } : undefined}
        >
          Forecast
        </div>
        <div className="flex-1 flex items-center justify-around">
          {mockForecast.slice(0, days).map((day) => (
            <div key={day.day} className="flex flex-col items-center">
              <div
                className={cn(sizeClasses?.day, "opacity-70")}
                style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.day) } : undefined}
              >
                {day.day}
              </div>
              {showIcons && (
                <div
                  className={sizeClasses?.icon}
                  style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.icon) } : undefined}
                >
                  {getWeatherIcon(day.icon)}
                </div>
              )}
              {showHighLow && (
                <div
                  className={cn(sizeClasses?.temp, "font-light")}
                  style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.temp) } : undefined}
                >
                  <span>{day.high}°</span>
                  <span className="opacity-50 mx-1">/</span>
                  <span className="opacity-70">{day.low}°</span>
                </div>
              )}
            </div>
          ))}
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
        <span className="text-sm opacity-50">Loading forecast...</span>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div
        className="flex h-full items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <span className="text-sm opacity-50">Forecast unavailable</span>
      </div>
    );
  }

  // For now, show today's high/low since we only have current weather
  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center p-4 rounded-lg",
        "bg-black/40 backdrop-blur-sm"
      )}
      style={{ color: style?.textColor || "#ffffff" }}
    >
      <div
        className={cn(sizeClasses?.day, "opacity-50 uppercase tracking-wide mb-2")}
        style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.day) } : undefined}
      >
        Today's Forecast
      </div>
      <div className="flex items-center gap-4">
        {showIcons && (
          <span
            className={sizeClasses?.icon}
            style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.icon) } : undefined}
          >
            {getWeatherIcon(weather.icon)}
          </span>
        )}
        <div className="text-center">
          {showHighLow && (
            <div
              className={cn(sizeClasses?.temp, "font-light")}
              style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.temp) } : undefined}
            >
              <span>H: {weather.temp_max}°{weather.units === "metric" ? "C" : "F"}</span>
              <span className="opacity-50 mx-2">|</span>
              <span>L: {weather.temp_min}°{weather.units === "metric" ? "C" : "F"}</span>
            </div>
          )}
          <div
            className={cn(sizeClasses?.day, "opacity-70 capitalize mt-1")}
            style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.day) } : undefined}
          >
            {weather.description}
          </div>
        </div>
      </div>
    </div>
  );
}
