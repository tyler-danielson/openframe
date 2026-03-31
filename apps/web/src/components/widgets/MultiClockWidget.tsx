import { useState, useEffect } from "react";
import type { WidgetStyle } from "../../stores/screensaver";
import { getFontSizeConfig } from "../../lib/font-size";
import { cn } from "../../lib/utils";

interface TimezoneConfig {
  label: string;
  timezone: string;
}

interface MultiClockWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
}

export function MultiClockWidget({ config, style }: MultiClockWidgetProps) {
  const [now, setNow] = useState(new Date());

  const timezones = (config.timezones as TimezoneConfig[]) || [
    { label: "Pacific", timezone: "America/Los_Angeles" },
    { label: "Central", timezone: "America/Chicago" },
    { label: "Eastern", timezone: "America/New_York" },
  ];
  const showSeconds = config.showSeconds as boolean ?? true;
  const showDate = config.showDate as boolean ?? true;
  const highlightLocal = config.highlightLocal as boolean ?? true;

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const { isCustom, customValue } = getFontSizeConfig(style);

  // Detect local timezone to highlight it
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const formatTime = (tz: string) => {
    const opts: Intl.DateTimeFormatOptions = {
      hour: "numeric",
      minute: "2-digit",
      ...(showSeconds ? { second: "2-digit" } : {}),
      hour12: true,
      timeZone: tz,
    };
    return now.toLocaleTimeString("en-US", opts);
  };

  const formatDate = () => {
    return now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  // Parse time into parts for styling (main digits bigger, am/pm smaller)
  const parseTime = (timeStr: string) => {
    // Split "4:34:17 PM" into parts
    const match = timeStr.match(/^(\d+:\d+)(:\d+)?\s*(AM|PM)$/i);
    if (!match) return { main: timeStr, seconds: "", ampm: "" };
    return {
      main: match[1],
      seconds: match[2] || "",
      ampm: match[3] || "",
    };
  };

  // Determine which timezone to make "primary" (largest)
  // If highlightLocal is on, the local tz gets the big treatment
  const primaryIndex = highlightLocal
    ? timezones.findIndex((tz) => tz.timezone === localTz)
    : -1;
  const hasPrimary = primaryIndex >= 0;

  const baseFontSize = isCustom && customValue ? parseFloat(customValue) : 0;
  const baseUnit = isCustom && customValue ? (customValue.replace(/[\d.]/g, "") || "px") : "px";

  return (
    <div
      className="flex h-full flex-col rounded-lg bg-black/40 backdrop-blur-sm overflow-hidden"
      style={{ color: style?.textColor || "#ffffff" }}
    >
      {/* Date row */}
      {showDate && (
        <div className="text-center pt-2 pb-1 text-sm opacity-60">
          {formatDate()}
        </div>
      )}

      {/* Clocks row */}
      <div className="flex-1 flex items-center justify-around px-4 gap-2">
        {timezones.map((tz, i) => {
          const timeStr = formatTime(tz.timezone);
          const parts = parseTime(timeStr);
          const isPrimary = i === primaryIndex;

          return (
            <div
              key={tz.timezone + i}
              className={cn(
                "flex flex-col items-center",
                isPrimary && hasPrimary && "flex-[2]",
                !isPrimary && hasPrimary && "flex-1"
              )}
            >
              {/* Label */}
              <div className={cn(
                "uppercase tracking-widest font-medium mb-1",
                isPrimary ? "text-xs text-primary" : "text-[10px] opacity-50"
              )}>
                {tz.label}
              </div>

              {/* Time */}
              <div
                className={cn("font-light tabular-nums leading-none flex items-baseline")}
                style={isCustom ? {
                  fontSize: isPrimary
                    ? `${baseFontSize}${baseUnit}`
                    : `${baseFontSize * 0.65}${baseUnit}`,
                } : undefined}
              >
                <span className={cn(
                  isPrimary && !isCustom && "text-5xl sm:text-6xl",
                  !isPrimary && !isCustom && "text-2xl sm:text-3xl",
                )}>
                  {parts.main}
                </span>
                {parts.seconds && (
                  <span className={cn(
                    "opacity-50",
                    isPrimary && !isCustom && "text-2xl",
                    !isPrimary && !isCustom && "text-lg",
                  )}
                  style={isCustom ? { fontSize: "0.5em" } : undefined}
                  >
                    {parts.seconds}
                  </span>
                )}
                <span className={cn(
                  "ml-1 font-normal uppercase",
                  isPrimary && !isCustom && "text-sm",
                  !isPrimary && !isCustom && "text-[10px]",
                )}
                style={isCustom ? { fontSize: "0.25em" } : undefined}
                >
                  {parts.ampm}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
