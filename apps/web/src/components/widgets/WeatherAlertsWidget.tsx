import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { api } from "../../services/api";
import type { WidgetStyle } from "../../stores/screensaver";
import { getFontSizeConfig } from "../../lib/font-size";
import { cn } from "../../lib/utils";

interface WeatherAlertsWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
}

export function WeatherAlertsWidget({ config, style, isBuilder }: WeatherAlertsWidgetProps) {
  const { data: alerts = [] } = useQuery({
    queryKey: ["weather-alerts"],
    queryFn: () => api.getWeatherAlerts(),
    refetchInterval: 10 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
    enabled: !isBuilder,
  });

  const { isCustom, customValue } = getFontSizeConfig(style);

  if (isBuilder) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}>
        <AlertTriangle className="h-10 w-10 opacity-50 mb-2" />
        <span className="text-sm opacity-70">Weather Alerts</span>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full rounded-lg bg-black/40 backdrop-blur-sm overflow-hidden"
      style={{
        color: style?.textColor || "#ffffff",
        ...(isCustom && customValue ? { fontSize: customValue } : {}),
      }}
    >
      {alerts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <ShieldCheck className="h-10 w-10 text-green-400 mb-2" />
          <span className="text-sm opacity-70">No active weather alerts</span>
          <span className="text-xs opacity-40 mt-1">Your area is clear</span>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {alerts.map((alert, i) => {
            const isWarning = alert.event.toLowerCase().includes("warning");
            const isWatch = alert.event.toLowerCase().includes("watch");
            return (
              <div
                key={i}
                className={cn(
                  "rounded-lg p-3 border-l-4",
                  isWarning ? "bg-red-500/20 border-l-red-500" :
                  isWatch ? "bg-orange-500/20 border-l-orange-500" :
                  "bg-yellow-500/20 border-l-yellow-500"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className={cn(
                    "h-4 w-4",
                    isWarning ? "text-red-400" : isWatch ? "text-orange-400" : "text-yellow-400"
                  )} />
                  <span className="font-semibold text-sm">{alert.event}</span>
                </div>
                <div className="text-xs opacity-60 mb-1">
                  {new Date(alert.start).toLocaleString()} — {new Date(alert.end).toLocaleString()}
                </div>
                <div className="text-xs opacity-70 line-clamp-3">
                  {alert.description}
                </div>
                {alert.sender && (
                  <div className="text-[10px] opacity-40 mt-1">Source: {alert.sender}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
