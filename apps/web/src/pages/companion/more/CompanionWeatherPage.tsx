import { useQuery } from "@tanstack/react-query";
import {
  Cloud,
  Sun,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudDrizzle,
  CloudFog,
  Loader2,
  Droplets,
  Wind,
} from "lucide-react";
import { api } from "../../../services/api";
import { Card } from "../../../components/ui/Card";
import { CompanionPageHeader } from "../components/CompanionPageHeader";

function getWeatherIcon(description?: string) {
  if (!description) return Sun;
  const c = description.toLowerCase();
  if (c.includes("thunder") || c.includes("lightning")) return CloudLightning;
  if (c.includes("rain") || c.includes("shower")) return CloudRain;
  if (c.includes("drizzle")) return CloudDrizzle;
  if (c.includes("snow") || c.includes("sleet") || c.includes("ice")) return CloudSnow;
  if (c.includes("fog") || c.includes("mist") || c.includes("haze")) return CloudFog;
  if (c.includes("cloud") || c.includes("overcast")) return Cloud;
  return Sun;
}

export function CompanionWeatherPage() {
  const { data: current, isLoading } = useQuery({
    queryKey: ["companion-weather-current"],
    queryFn: () => api.getCurrentWeather(),
    staleTime: 300_000,
  });

  const { data: hourly } = useQuery({
    queryKey: ["companion-weather-hourly"],
    queryFn: () => api.getHourlyForecast(),
    staleTime: 300_000,
  });

  const { data: daily } = useQuery({
    queryKey: ["companion-weather-daily"],
    queryFn: () => api.getWeatherForecast(),
    staleTime: 300_000,
  });

  const WeatherIcon = getWeatherIcon(current?.description);

  return (
    <div className="flex flex-col h-full">
      <CompanionPageHeader title="Weather" backTo="/companion/more" />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !current ? (
          <div className="text-center py-12 text-muted-foreground">
            <Cloud className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Weather not configured</p>
          </div>
        ) : (
          <>
            {/* Current weather - large display */}
            <Card className="p-6 text-center">
              <WeatherIcon className="h-16 w-16 text-primary mx-auto mb-2" />
              <div className="text-5xl font-bold text-foreground">
                {Math.round(current.temp || 0)}&deg;
              </div>
              <div className="text-lg text-muted-foreground capitalize mt-1">
                {current.description || "Unknown"}
              </div>
              <div className="flex items-center justify-center gap-6 mt-4 text-sm text-muted-foreground">
                {current.humidity != null && (
                  <div className="flex items-center gap-1">
                    <Droplets className="h-4 w-4" />
                    {current.humidity}%
                  </div>
                )}
                {current.wind_speed != null && (
                  <div className="flex items-center gap-1">
                    <Wind className="h-4 w-4" />
                    {Math.round(current.wind_speed)} mph
                  </div>
                )}
              </div>
              {current.temp_max != null && current.temp_min != null && (
                <div className="text-sm text-muted-foreground mt-2">
                  H: {Math.round(current.temp_max)}&deg; &middot; L: {Math.round(current.temp_min)}&deg;
                </div>
              )}
            </Card>

            {/* Hourly forecast */}
            {hourly && (hourly as any[]).length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-primary px-1 mb-2">Hourly</h3>
                <Card className="p-3">
                  <div className="flex gap-4 overflow-x-auto scrollbar-none pb-1">
                    {(hourly as any[]).slice(0, 24).map((h: any, i: number) => {
                      const HIcon = getWeatherIcon(h.description);
                      const time = new Date(h.time);
                      return (
                        <div key={i} className="flex flex-col items-center gap-1 shrink-0 min-w-[48px]">
                          <span className="text-xs text-muted-foreground">
                            {i === 0 ? "Now" : time.toLocaleTimeString("en-US", { hour: "numeric" })}
                          </span>
                          <HIcon className="h-5 w-5 text-primary" />
                          <span className="text-sm font-medium">{Math.round(h.temp || 0)}&deg;</span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            )}

            {/* Daily forecast */}
            {daily && (daily as any[]).length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-primary px-1 mb-2">This Week</h3>
                <Card className="divide-y divide-border">
                  {(daily as any[]).slice(0, 7).map((d: any, i: number) => {
                    const DIcon = getWeatherIcon(d.description);
                    const date = new Date(d.date);
                    return (
                      <div key={i} className="flex items-center gap-3 px-4 py-3">
                        <span className="text-sm w-12 text-muted-foreground">
                          {i === 0 ? "Today" : date.toLocaleDateString("en-US", { weekday: "short" })}
                        </span>
                        <DIcon className="h-5 w-5 text-primary shrink-0" />
                        <span className="flex-1 text-sm text-muted-foreground truncate capitalize">
                          {d.description || ""}
                        </span>
                        <span className="text-sm font-medium text-foreground">
                          {Math.round(d.temp_max || 0)}&deg;
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {Math.round(d.temp_min || 0)}&deg;
                        </span>
                      </div>
                    );
                  })}
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
