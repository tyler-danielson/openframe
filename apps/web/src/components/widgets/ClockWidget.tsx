import { useState, useEffect } from "react";
import type { WidgetStyle, FontSizePreset } from "../../stores/screensaver";
import { getFontSizeConfig } from "../../lib/font-size";
import { cn } from "../../lib/utils";

interface ClockWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
  widgetId?: string;
}

// Font size classes for each preset (time and date elements)
const FONT_SIZE_CLASSES: Record<Exclude<FontSizePreset, "custom">, { time: string; date: string }> = {
  xs: { time: "text-lg", date: "text-[10px]" },
  sm: { time: "text-2xl", date: "text-xs" },
  md: { time: "text-4xl", date: "text-sm" },
  lg: { time: "text-6xl", date: "text-lg" },
  xl: { time: "text-8xl", date: "text-xl" },
};

// Scale factors for custom font sizes
const CUSTOM_SCALE = {
  time: 1,
  date: 0.25,
};

export function ClockWidget({ config, style, isBuilder }: ClockWidgetProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  const showSeconds = config.showSeconds as boolean ?? false;
  const showDate = config.showDate as boolean ?? true;
  const format24h = config.format24h as boolean ?? false;

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const { preset, isCustom, customValue } = getFontSizeConfig(style);
  const sizeClasses = isCustom ? null : FONT_SIZE_CLASSES[preset as Exclude<FontSizePreset, "custom">];

  const timeFormat: Intl.DateTimeFormatOptions = showSeconds
    ? { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: !format24h }
    : { hour: "numeric", minute: "2-digit", hour12: !format24h };

  const dateFormat: Intl.DateTimeFormatOptions =
    preset === "xs" || preset === "sm"
      ? { weekday: "short", month: "short", day: "numeric" }
      : { weekday: "long", month: "short", day: "numeric" };

  // Calculate custom font sizes if using custom mode
  const getCustomFontSize = (scale: number) => {
    if (!customValue) return undefined;
    const value = parseFloat(customValue);
    const unit = customValue.replace(/[\d.]/g, "") || "px";
    return `${value * scale}${unit}`;
  };

  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center p-4 rounded-lg",
        "bg-black/40 backdrop-blur-sm"
      )}
      style={{ color: style?.textColor || "#ffffff" }}
    >
      <div
        className={cn(sizeClasses?.time, "font-light tabular-nums")}
        style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.time) } : undefined}
      >
        {currentTime.toLocaleTimeString([], timeFormat)}
      </div>
      {showDate && (
        <div
          className={cn(sizeClasses?.date, "opacity-70 mt-1")}
          style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.date) } : undefined}
        >
          {currentTime.toLocaleDateString([], dateFormat)}
        </div>
      )}
    </div>
  );
}
