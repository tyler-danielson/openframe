import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import type { WidgetStyle, FontSizePreset } from "../../stores/screensaver";
import { getFontSizeConfig } from "../../lib/font-size";
import { cn } from "../../lib/utils";

interface CountdownWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
}

// Font size classes for each preset
const FONT_SIZE_CLASSES: Record<Exclude<FontSizePreset, "custom">, { value: string; label: string }> = {
  xs: { value: "text-base", label: "text-[10px]" },
  sm: { value: "text-xl", label: "text-xs" },
  md: { value: "text-3xl", label: "text-sm" },
  lg: { value: "text-5xl", label: "text-base" },
  xl: { value: "text-7xl", label: "text-lg" },
};

// Scale factors for custom font sizes
const CUSTOM_SCALE = {
  value: 1,
  label: 0.3,
};

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
}

function calculateTimeRemaining(targetDate: Date): TimeRemaining {
  const now = new Date();
  const diff = targetDate.getTime() - now.getTime();

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds, isExpired: false };
}

export function CountdownWidget({ config, style, isBuilder }: CountdownWidgetProps) {
  const targetDateStr = config.targetDate as string ?? "";
  const label = config.label as string ?? "Countdown";
  const showDays = config.showDays as boolean ?? true;
  const showHours = config.showHours as boolean ?? true;
  const showMinutes = config.showMinutes as boolean ?? true;
  const showSeconds = config.showSeconds as boolean ?? false;
  const eventId = config.eventId as string ?? "";
  const displayMode = config.displayMode as "full" | "days" ?? "full";

  // Fetch event if eventId is set
  const { data: event } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      if (!eventId) return null;
      // Get events around now and find the one with matching ID
      const start = new Date();
      const end = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
      const events = await api.getEvents(start, end);
      return events.find(e => e.id === eventId) || null;
    },
    enabled: !!eventId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Determine effective target date and label
  const effectiveTargetDate = event ? new Date(event.startTime).toISOString() : targetDateStr;
  const effectiveLabel = event ? event.title : label;

  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: true,
  });

  useEffect(() => {
    if (!effectiveTargetDate) return;

    const targetDate = new Date(effectiveTargetDate);
    if (isNaN(targetDate.getTime())) return;

    const updateCountdown = () => {
      setTimeRemaining(calculateTimeRemaining(targetDate));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [effectiveTargetDate]);

  const { preset, isCustom, customValue } = getFontSizeConfig(style);
  const sizeClasses = isCustom ? null : FONT_SIZE_CLASSES[preset as Exclude<FontSizePreset, "custom">];

  // Calculate custom font sizes if using custom mode
  const getCustomFontSize = (scale: number) => {
    if (!customValue) return undefined;
    const value = parseFloat(customValue);
    const unit = customValue.replace(/[\d.]/g, "") || "px";
    return `${value * scale}${unit}`;
  };

  if (!effectiveTargetDate) {
    if (isBuilder) {
      // Show helpful placeholder UI in builder mode
      return (
        <div
          className="flex h-full flex-col items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
          style={{ color: style?.textColor || "#ffffff" }}
        >
          <div className="text-lg font-medium opacity-70 mb-1">
            {label || "Countdown Placeholder"}
          </div>
          <div className="text-xs opacity-50 text-center">
            Assign an event from calendar to activate
          </div>
        </div>
      );
    }
    return (
      <div
        className="flex h-full items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <span className="text-sm opacity-50">No target date set</span>
      </div>
    );
  }

  // Render "days (sleeps)" mode
  if (displayMode === "days") {
    // Calculate sleeps: if there's any time remaining in the day, count it as another sleep
    const sleeps = timeRemaining.days + (timeRemaining.hours > 0 || timeRemaining.minutes > 0 || timeRemaining.seconds > 0 ? 1 : 0);

    return (
      <div
        className={cn(
          "flex h-full flex-col items-center justify-center p-4 rounded-lg",
          "bg-black/40 backdrop-blur-sm"
        )}
        style={{ color: style?.textColor || "#ffffff" }}
      >
        {effectiveLabel && (
          <div
            className={cn(sizeClasses?.label, "opacity-70 mb-2 uppercase tracking-wide")}
            style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.label) } : undefined}
          >
            {effectiveLabel}
          </div>
        )}
        {timeRemaining.isExpired ? (
          <div
            className={cn(sizeClasses?.value, "font-light")}
            style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.value) } : undefined}
          >
            Today!
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <span
              className={cn(sizeClasses?.value, "font-light tabular-nums")}
              style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.value) } : undefined}
            >
              {sleeps}
            </span>
            <span
              className={cn(sizeClasses?.label, "opacity-70")}
              style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.label) } : undefined}
            >
              {sleeps === 1 ? "sleep" : "sleeps"}
            </span>
          </div>
        )}
      </div>
    );
  }

  // Render full timer mode (existing logic)
  const parts: { value: number; unit: string }[] = [];
  if (showDays) parts.push({ value: timeRemaining.days, unit: "d" });
  if (showHours) parts.push({ value: timeRemaining.hours, unit: "h" });
  if (showMinutes) parts.push({ value: timeRemaining.minutes, unit: "m" });
  if (showSeconds) parts.push({ value: timeRemaining.seconds, unit: "s" });

  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center p-4 rounded-lg",
        "bg-black/40 backdrop-blur-sm"
      )}
      style={{ color: style?.textColor || "#ffffff" }}
    >
      {effectiveLabel && (
        <div
          className={cn(sizeClasses?.label, "opacity-70 mb-2 uppercase tracking-wide")}
          style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.label) } : undefined}
        >
          {effectiveLabel}
        </div>
      )}
      {timeRemaining.isExpired ? (
        <div
          className={cn(sizeClasses?.value, "font-light")}
          style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.value) } : undefined}
        >
          Expired
        </div>
      ) : (
        <div className="flex items-baseline gap-2">
          {parts.map((part, i) => (
            <div key={part.unit} className="flex items-baseline">
              <span
                className={cn(sizeClasses?.value, "font-light tabular-nums")}
                style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.value) } : undefined}
              >
                {part.value}
              </span>
              <span
                className={cn(sizeClasses?.label, "opacity-70 ml-0.5")}
                style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.label) } : undefined}
              >
                {part.unit}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
