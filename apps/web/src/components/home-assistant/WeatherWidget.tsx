import { Cloud, Sun, CloudRain, Snowflake, CloudLightning } from "lucide-react";
import { Card, CardContent } from "../ui/Card";

interface WeatherData {
  temperature: number;
  condition: string;
  high: number;
  low: number;
  humidity: number;
  location: string;
}

interface WeatherWidgetProps {
  data?: WeatherData;
  isLoading?: boolean;
}

const weatherIcons: Record<string, typeof Sun> = {
  sunny: Sun,
  cloudy: Cloud,
  rainy: CloudRain,
  snowy: Snowflake,
  stormy: CloudLightning,
};

export function WeatherWidget({ data, isLoading }: WeatherWidgetProps) {
  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-4">
          <div className="h-20 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-4 text-center text-muted-foreground">
          Weather not configured
        </CardContent>
      </Card>
    );
  }

  const Icon = weatherIcons[data.condition.toLowerCase()] ?? Cloud;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{data.location}</p>
            <p className="text-4xl font-light">{data.temperature}°</p>
            <p className="text-sm capitalize text-muted-foreground">
              {data.condition}
            </p>
          </div>
          <Icon className="h-16 w-16 text-muted-foreground" />
        </div>
        <div className="mt-4 flex justify-between text-sm">
          <span>H: {data.high}°</span>
          <span>L: {data.low}°</span>
          <span>{data.humidity}% humidity</span>
        </div>
      </CardContent>
    </Card>
  );
}
