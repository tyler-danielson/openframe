import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Timer } from "lucide-react";
import { api } from "../../services/api";
import type { WidgetStyle, FontSizePreset } from "../../stores/screensaver";
import { calculateTimeRemaining, formatCountdownWithOptions } from "../../lib/countdown";
import { getFontSizeConfig } from "../../lib/font-size";
import { cn } from "../../lib/utils";
import type { CalendarEvent } from "@openframe/shared";

interface CountdownHolderWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
}

// Font size classes matching CountdownWidget exactly
const FONT_SIZE_CLASSES: Record<Exclude<FontSizePreset, "custom">, { value: string; label: string }> = {
  xs: { value: "text-base", label: "text-[10px]" },
  sm: { value: "text-xl", label: "text-xs" },
  md: { value: "text-3xl", label: "text-sm" },
  lg: { value: "text-5xl", label: "text-base" },
  xl: { value: "text-7xl", label: "text-lg" },
};

const CUSTOM_SCALE = { value: 1, label: 0.3 };

export function CountdownHolderWidget({ config, style, isBuilder }: CountdownHolderWidgetProps) {
  const expandDirection = (config.expandDirection as string) ?? "fill";
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setTick] = useState(0);

  // Fetch all future events with showCountdown enabled
  const { data: countdownEvents = [] } = useQuery({
    queryKey: ["countdown-holder-events"],
    queryFn: async () => {
      const start = new Date();
      const end = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      const allEvents = await api.getEvents(start, end);
      return allEvents.filter(
        (e) => (e.metadata as Record<string, unknown>)?.showCountdown === true
          && new Date(e.startTime) > new Date()
      );
    },
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  // Deduplicate recurring events (keep nearest occurrence per recurringEventId)
  const deduped = new Map<string, CalendarEvent>();
  for (const e of countdownEvents) {
    const key = e.recurringEventId || e.id;
    const existing = deduped.get(key);
    if (!existing || new Date(e.startTime) < new Date(existing.startTime)) {
      deduped.set(key, e);
    }
  }

  const sorted = Array.from(deduped.values()).sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  // Tick every second for live countdowns
  useEffect(() => {
    if (sorted.length === 0) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [sorted.length]);

  // Calculate font size for multi-event list mode
  const [fontSize, setFontSize] = useState(16);
  useEffect(() => {
    if (!containerRef.current || sorted.length <= 1) return;
    const observer = new ResizeObserver(() => {
      const el = containerRef.current;
      if (!el) return;
      const h = el.clientHeight;
      const w = el.clientWidth;
      const count = sorted.length;

      if (expandDirection === "fill") {
        const rowHeight = h / count;
        const sizeFromHeight = Math.max(10, Math.min(rowHeight * 0.55, 72));
        const sizeFromWidth = Math.max(10, Math.min(w * 0.04, 72));
        setFontSize(Math.min(sizeFromHeight, sizeFromWidth));
      } else {
        const baseSize = Math.min(h * 0.2, 28);
        const maxFit = h / (count * 1.8);
        setFontSize(Math.max(10, Math.min(baseSize, maxFit)));
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [sorted.length, expandDirection]);

  const textColor = style?.textColor || "#ffffff";
  const { preset: emptyPreset, isCustom: emptyIsCustom, customValue: emptyCustomValue } = getFontSizeConfig(style);
  const emptySizeClasses = emptyIsCustom ? null : FONT_SIZE_CLASSES[emptyPreset as Exclude<FontSizePreset, "custom">];
  const getEmptyCustomFontSize = (scale: number) => {
    if (!emptyCustomValue) return undefined;
    const value = parseFloat(emptyCustomValue);
    const unit = emptyCustomValue.replace(/[\d.]/g, "") || "px";
    return `${value * scale}${unit}`;
  };

  // Empty state
  if (sorted.length === 0) {
    if (isBuilder) {
      return (
        <div
          className="flex h-full flex-col items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
          style={{ color: textColor }}
        >
          <div
            className={cn(emptySizeClasses?.label, "opacity-70 mb-2 uppercase tracking-wide")}
            style={emptyIsCustom ? { fontSize: getEmptyCustomFontSize(CUSTOM_SCALE.label) } : undefined}
          >
            Countdown Holder
          </div>
          <div
            className={cn(emptySizeClasses?.value, "font-light opacity-30")}
            style={emptyIsCustom ? { fontSize: getEmptyCustomFontSize(CUSTOM_SCALE.value * 0.5) } : undefined}
          >
            No Events
          </div>
        </div>
      );
    }
    return (
      <div
        className="flex h-full flex-col items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: textColor }}
      >
        <div
          className={cn(emptySizeClasses?.value, "font-light opacity-50")}
          style={emptyIsCustom ? { fontSize: getEmptyCustomFontSize(CUSTOM_SCALE.value) } : undefined}
        >
          No Upcoming Events
        </div>
      </div>
    );
  }

  // --- Single event: match dedicated CountdownWidget layout exactly ---
  if (sorted.length === 1) {
    const event = sorted[0]!;
    const meta = event.metadata as Record<string, unknown> | undefined;
    const fmt = (meta?.countdownFormat as string) ?? "dhm";
    const displayName = (meta?.countdownLabel as string) || event.title;
    const tr = calculateTimeRemaining(new Date(event.startTime));

    const { preset, isCustom, customValue } = getFontSizeConfig(style);
    const sizeClasses = isCustom ? null : FONT_SIZE_CLASSES[preset as Exclude<FontSizePreset, "custom">];
    const getCustomFontSize = (scale: number) => {
      if (!customValue) return undefined;
      const value = parseFloat(customValue);
      const unit = customValue.replace(/[\d.]/g, "") || "px";
      return `${value * scale}${unit}`;
    };

    // Sleeps mode
    if (fmt === "sleeps") {
      const now = new Date();
      const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const targetDate = new Date(event.startTime);
      const eventMidnight = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const sleeps = Math.max(0, Math.round((eventMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24)));

      return (
        <div
          className={cn("flex h-full flex-col items-center justify-center p-4 rounded-lg", "bg-black/40 backdrop-blur-sm")}
          style={{ color: textColor }}
        >
          {displayName && (
            <div
              className={cn(sizeClasses?.label, "opacity-70 mb-2 uppercase tracking-wide")}
              style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.label) } : undefined}
            >
              {displayName}
            </div>
          )}
          {sleeps === 0 && tr.isExpired ? (
            <div className={cn(sizeClasses?.label, "font-light opacity-50")}>No Upcoming Events</div>
          ) : sleeps === 0 ? (
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

    // Full timer modes (dhm, dh, d)
    const parts: { value: number; unit: string }[] = [];
    if (fmt === "dhm" || fmt === "dh" || fmt === "d") parts.push({ value: tr.days, unit: "d" });
    if (fmt === "dhm" || fmt === "dh") parts.push({ value: tr.hours, unit: "h" });
    if (fmt === "dhm") parts.push({ value: tr.minutes, unit: "m" });

    return (
      <div
        className={cn("flex h-full flex-col items-center justify-center p-4 rounded-lg", "bg-black/40 backdrop-blur-sm")}
        style={{ color: textColor }}
      >
        {displayName && (
          <div
            className={cn(sizeClasses?.label, "opacity-70 mb-2 uppercase tracking-wide")}
            style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.label) } : undefined}
          >
            {displayName}
          </div>
        )}
        {tr.isExpired ? (
          <div className={cn(sizeClasses?.label, "font-light opacity-50")}>No Upcoming Events</div>
        ) : (
          <div className="flex items-baseline gap-2">
            {parts.map((part) => (
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

  // --- Multiple events: list mode ---
  const justifyClass = expandDirection === "expand-up"
    ? "justify-end"
    : expandDirection === "expand-down"
      ? "justify-start"
      : "justify-center";

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex h-full w-full flex-col p-3 rounded-lg bg-black/40 backdrop-blur-sm overflow-hidden",
        justifyClass,
      )}
      style={{ color: textColor }}
    >
      {sorted.map((event) => {
        const meta = event.metadata as Record<string, unknown> | undefined;
        const fmt = (meta?.countdownFormat as string) ?? "dhm";
        const displayName = (meta?.countdownLabel as string) || event.title;
        const tr = calculateTimeRemaining(new Date(event.startTime));
        const countdownText = formatCountdownWithOptions(tr, fmt, new Date(event.startTime));

        return (
          <div
            key={event.id}
            className="flex items-center justify-between gap-3 px-2"
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: expandDirection === "fill" ? undefined : "1.8",
              flex: expandDirection === "fill" ? "1" : undefined,
              minHeight: 0,
            }}
          >
            <span
              className="font-medium truncate opacity-90"
              style={{ maxWidth: "65%" }}
            >
              {displayName}
            </span>
            <span className="font-mono tabular-nums opacity-70 shrink-0">
              {countdownText}
            </span>
          </div>
        );
      })}
    </div>
  );
}
