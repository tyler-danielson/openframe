import { useQuery } from "@tanstack/react-query";
import {
  Cloud,
  Sun,
  CloudRain,
  Snowflake,
  CloudLightning,
  CloudSun,
  CloudFog,
  Droplets,
} from "lucide-react";
import { api } from "../../services/api";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { useCardBlockNav } from "./useCardBlockNav";
import { cn } from "../../lib/utils";
import type { CardViewCardProps } from "./types";

const weatherIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  "01d": Sun, "01n": Sun,
  "02d": CloudSun, "02n": CloudSun,
  "03d": Cloud, "03n": Cloud,
  "04d": Cloud, "04n": Cloud,
  "09d": CloudRain, "09n": CloudRain,
  "10d": CloudRain, "10n": CloudRain,
  "11d": CloudLightning, "11n": CloudLightning,
  "13d": Snowflake, "13n": Snowflake,
  "50d": CloudFog, "50n": CloudFog,
};

export function WeatherCard({ onClick, blockNavId }: CardViewCardProps) {
  const { blockNavClasses } = useCardBlockNav(blockNavId);

  const { data: weather, isLoading } = useQuery({
    queryKey: ["weather", "current"],
    queryFn: () => api.getCurrentWeather(),
    staleTime: 10 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    retry: false,
  });

  const Icon = weather?.icon ? (weatherIconMap[weather.icon] || Cloud) : Cloud;

  return (
    <Card
      className={cn(
        "cursor-pointer hover:bg-accent/50 transition-all duration-300 flex flex-col",
        blockNavClasses
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5 text-primary" />
          Weather
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex items-center justify-center">
        {isLoading ? (
          <div className="animate-pulse flex flex-col items-center gap-2">
            <div className="h-12 w-12 bg-muted rounded-full" />
            <div className="h-4 w-20 bg-muted rounded" />
          </div>
        ) : weather ? (
          <div className="flex flex-col items-center gap-2">
            <Icon className="h-16 w-16 text-muted-foreground" />
            <span className="text-4xl font-light">{weather.temp}°</span>
            <span className="text-sm text-muted-foreground capitalize">{weather.description}</span>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span>H: {weather.temp_max}°</span>
              <span>L: {weather.temp_min}°</span>
              <span className="flex items-center gap-1">
                <Droplets className="h-3 w-3" />{weather.humidity}%
              </span>
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">Weather unavailable</span>
        )}
      </CardContent>
    </Card>
  );
}
