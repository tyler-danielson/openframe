import { useQuery } from "@tanstack/react-query";
import { Waves, ArrowUp, ArrowDown } from "lucide-react";
import { api } from "../../services/api";
import type { WidgetStyle } from "../../stores/screensaver";
import { getFontSizeConfig } from "../../lib/font-size";
import { cn } from "../../lib/utils";

interface OceanTidesWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
}

export function OceanTidesWidget({ config, style, isBuilder }: OceanTidesWidgetProps) {
  const { data } = useQuery({
    queryKey: ["ocean-tides"],
    queryFn: () => api.getOceanTides(),
    refetchInterval: 60 * 60 * 1000,
    staleTime: 30 * 60 * 1000,
    enabled: !isBuilder,
  });

  const { isCustom, customValue } = getFontSizeConfig(style);

  if (isBuilder) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}>
        <Waves className="h-10 w-10 opacity-50 mb-2" />
        <span className="text-sm opacity-70">Ocean Tides</span>
      </div>
    );
  }

  const tides = data?.tides || [];
  const station = data?.station;
  const now = new Date();

  // Find upcoming tides (next 8)
  const upcomingTides = tides
    .filter((t) => new Date(t.time) > now)
    .slice(0, 8);

  // Find current tide state (last passed tide)
  const pastTides = tides.filter((t) => new Date(t.time) <= now);
  const lastTide = pastTides[pastTides.length - 1];
  const nextTide = upcomingTides[0];

  return (
    <div
      className="flex flex-col h-full rounded-lg bg-black/40 backdrop-blur-sm overflow-hidden"
      style={{
        color: style?.textColor || "#ffffff",
        ...(isCustom && customValue ? { fontSize: customValue } : {}),
      }}
    >
      {/* Station header */}
      {station && (
        <div className="px-3 pt-3 pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Waves className="h-4 w-4 text-blue-400" />
            <span className="text-xs opacity-50 truncate">{station.name}</span>
          </div>
        </div>
      )}

      {!station && data?.message && (
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <Waves className="h-10 w-10 opacity-30 mb-2" />
          <span className="text-sm opacity-50">{data.message}</span>
        </div>
      )}

      {/* Current status */}
      {nextTide && (
        <div className="px-3 py-2 border-b border-white/10">
          <div className="text-xs opacity-40 mb-1">
            {lastTide ? (lastTide.type === "high" ? "Falling" : "Rising") : "Next"}
          </div>
          <div className="flex items-center gap-2">
            {nextTide.type === "high" ? (
              <ArrowUp className="h-5 w-5 text-blue-400" />
            ) : (
              <ArrowDown className="h-5 w-5 text-cyan-400" />
            )}
            <div>
              <span className="font-semibold text-sm capitalize">{nextTide.type} Tide</span>
              <span className="text-xs opacity-50 ml-2">
                {new Date(nextTide.time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </span>
            </div>
            <span className="ml-auto text-sm font-mono tabular-nums">
              {nextTide.height.toFixed(1)} ft
            </span>
          </div>
        </div>
      )}

      {/* Upcoming tides list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {upcomingTides.map((tide, i) => {
          const tideTime = new Date(tide.time);
          const isToday = tideTime.toDateString() === now.toDateString();
          return (
            <div key={i} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-2">
                {tide.type === "high" ? (
                  <ArrowUp className="h-3.5 w-3.5 text-blue-400" />
                ) : (
                  <ArrowDown className="h-3.5 w-3.5 text-cyan-400" />
                )}
                <span className="text-xs capitalize opacity-70">{tide.type}</span>
              </div>
              <span className="text-xs opacity-50">
                {isToday ? "" : tideTime.toLocaleDateString([], { weekday: "short" }) + " "}
                {tideTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </span>
              <span className="text-xs font-mono tabular-nums">{tide.height.toFixed(1)} ft</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
