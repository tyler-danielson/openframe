import { useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, endOfDay } from "date-fns";
import {
  Cloud,
  Sun,
  CloudRain,
  Snowflake,
  CloudLightning,
  CloudSun,
  CloudFog,
  Droplets,
  Umbrella,
} from "lucide-react";
import { api, type HourlyForecast } from "../services/api";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { ClockWidget } from "../components/home-assistant/ClockWidget";
import { DashboardTasksWidget } from "../components/dashboard/DashboardTasksWidget";
import { LocationMap } from "../components/homeassistant/LocationMap";
import { HeadlinesWidget } from "../components/news/HeadlinesWidget";
import { useCalendarStore } from "../stores/calendar";

// Map OpenWeatherMap icon codes to Lucide icons
const weatherIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  "01d": Sun,      // clear sky day
  "01n": Sun,      // clear sky night
  "02d": CloudSun, // few clouds day
  "02n": CloudSun, // few clouds night
  "03d": Cloud,    // scattered clouds
  "03n": Cloud,
  "04d": Cloud,    // broken clouds
  "04n": Cloud,
  "09d": CloudRain, // shower rain
  "09n": CloudRain,
  "10d": CloudRain, // rain
  "10n": CloudRain,
  "11d": CloudLightning, // thunderstorm
  "11n": CloudLightning,
  "13d": Snowflake, // snow
  "13n": Snowflake,
  "50d": CloudFog,  // mist/fog
  "50n": CloudFog,
};

// Get small weather icon component
function WeatherIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = weatherIconMap[icon] || Cloud;
  return <Icon className={className} />;
}

export function DashboardPage() {
  const { calendars, dashboardCalendarIds, setCalendars } = useCalendarStore();

  // Fetch calendars
  const { data: calendarsData } = useQuery({
    queryKey: ["calendars"],
    queryFn: () => api.getCalendars(),
  });

  useEffect(() => {
    if (calendarsData) {
      setCalendars(calendarsData);
    }
  }, [calendarsData, setCalendars]);

  // Fetch today's events using dashboard calendar IDs
  const today = new Date();
  const { data: events = [] } = useQuery({
    queryKey: ["events", "dashboard", "today", dashboardCalendarIds],
    queryFn: () =>
      api.getEvents(
        startOfDay(today),
        endOfDay(today),
        dashboardCalendarIds
      ),
    enabled: dashboardCalendarIds.length > 0,
  });

  // Fetch weather data
  const { data: weather, isLoading: weatherLoading, error: weatherError } = useQuery({
    queryKey: ["weather", "current"],
    queryFn: () => api.getCurrentWeather(),
    refetchInterval: 600000, // Refresh every 10 minutes
    retry: false,
  });

  // Fetch hourly forecast for today
  const { data: hourlyForecast = [] } = useQuery<HourlyForecast[]>({
    queryKey: ["weather", "hourly"],
    queryFn: () => api.getHourlyForecast(),
    refetchInterval: 600000,
    retry: false,
    enabled: !weatherError,
  });

  const calendarMap = new Map(calendars.map((c) => [c.id, c]));

  // Weather forecast toggle state
  const [showForecast, setShowForecast] = useState(false);

  const toggleForecast = useCallback(() => {
    setShowForecast((prev) => !prev);
  }, []);

  // Auto-hide forecast after 30 seconds
  useEffect(() => {
    if (showForecast) {
      const timer = setTimeout(() => {
        setShowForecast(false);
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, [showForecast]);

  // Sort events by time
  const sortedEvents = [...events].sort((a, b) => {
    // All-day events first
    if (a.isAllDay && !b.isAllDay) return -1;
    if (!a.isAllDay && b.isAllDay) return 1;
    // Then by start time
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  });

  // Calculate max precipitation chance for today
  const maxPrecipChance = hourlyForecast.length > 0
    ? Math.max(...hourlyForecast.map((h) => h.pop))
    : 0;

  const CurrentWeatherIcon = weather?.icon ? weatherIconMap[weather.icon] || Cloud : Cloud;

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header with clock and weather inline */}
      <div className="mb-6 flex items-start justify-between gap-6">
        {/* Clock on the left */}
        <div className="flex-shrink-0">
          <ClockWidget />
        </div>

        {/* Weather on the right - expanded with forecast */}
        <div className="flex-shrink-0">
          {weatherLoading ? (
            <div className="animate-pulse flex items-center gap-4">
              <div className="h-12 w-12 bg-muted rounded-full" />
              <div className="space-y-2">
                <div className="h-4 w-16 bg-muted rounded" />
                <div className="h-3 w-24 bg-muted rounded" />
              </div>
            </div>
          ) : weatherError ? (
            <div className="flex items-center gap-3 text-muted-foreground">
              <Cloud className="h-10 w-10 opacity-50" />
              <div className="text-sm">
                <p>Weather not configured</p>
              </div>
            </div>
          ) : weather ? (
            <button
              type="button"
              onClick={toggleForecast}
              className="relative cursor-pointer text-left focus:outline-none min-h-[4rem]"
              aria-label={showForecast ? "Show current weather" : "Show hourly forecast"}
            >
              {/* Current weather */}
              <div
                className={`flex items-center gap-4 transition-opacity duration-500 ${
                  showForecast ? "opacity-0 pointer-events-none absolute inset-0" : "opacity-100"
                }`}
              >
                <div className="text-right">
                  <div className="flex items-baseline gap-2 justify-end">
                    <span className="text-4xl font-light">{weather.temp}°</span>
                    <span className="text-sm text-muted-foreground capitalize">
                      {weather.description}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 justify-end">
                    <span>{weather.city}</span>
                    <span className="text-xs">H: {weather.temp_max}° L: {weather.temp_min}°</span>
                    <span className="flex items-center gap-1 text-xs">
                      <Droplets className="h-3 w-3" />
                      {weather.humidity}%
                    </span>
                    {maxPrecipChance > 0 && (
                      <span className="flex items-center gap-1 text-xs">
                        <Umbrella className="h-3 w-3" />
                        {maxPrecipChance}%
                      </span>
                    )}
                  </div>
                </div>
                <CurrentWeatherIcon className="h-14 w-14 text-muted-foreground" />
              </div>

              {/* Today's hourly forecast */}
              {hourlyForecast.length > 0 && (
                <div
                  className={`flex items-center gap-3 transition-opacity duration-500 ${
                    showForecast ? "opacity-100" : "opacity-0 pointer-events-none absolute inset-0"
                  }`}
                >
                  {hourlyForecast.slice(0, 8).map((hour) => (
                    <div
                      key={hour.time}
                      className="flex flex-col items-center text-xs min-w-[3rem]"
                    >
                      <span className="text-muted-foreground font-medium">
                        {hour.time}
                      </span>
                      <WeatherIcon icon={hour.icon} className="h-5 w-5 my-1 text-muted-foreground" />
                      <span className="font-medium">{hour.temp}°</span>
                      {hour.pop > 0 && (
                        <span className="text-muted-foreground flex items-center gap-0.5">
                          <Umbrella className="h-3 w-3" />
                          {hour.pop}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </button>
          ) : null}
        </div>
      </div>

      {/* 3-column main content */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 min-h-0">
        {/* Column 1: Events */}
        <Card className="flex flex-col min-h-0">
          <CardHeader className="pb-2">
            <CardTitle>Today's Events</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {dashboardCalendarIds.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <p className="text-sm">No calendars enabled for dashboard</p>
                <p className="text-xs mt-1">Enable in Settings</p>
              </div>
            ) : sortedEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <p className="text-sm">No events today</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 rounded-lg border border-border p-3"
                  >
                    <div
                      className="mt-1.5 h-3 w-3 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor:
                          calendarMap.get(event.calendarId)?.color ?? "#3B82F6",
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{event.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {event.isAllDay
                          ? "All day"
                          : `${format(new Date(event.startTime), "h:mm a")} - ${format(new Date(event.endTime), "h:mm a")}`}
                      </p>
                      {event.location && (
                        <p className="text-sm text-muted-foreground truncate">
                          {event.location}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Column 2: Tasks */}
        <Card className="flex flex-col min-h-0">
          <CardHeader className="pb-2">
            <CardTitle>Today's Tasks</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            <DashboardTasksWidget />
          </CardContent>
        </Card>

        {/* Column 3: Map + News */}
        <div className="flex flex-col gap-6 min-h-0">
          {/* Family Locations Map */}
          <Card className="flex flex-col flex-1 min-h-0">
            <CardHeader className="pb-2">
              <CardTitle>Family Locations</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 min-h-0">
              <LocationMap height="100%" className="rounded-b-lg" />
            </CardContent>
          </Card>

          {/* News/Headlines */}
          <Card className="flex flex-col flex-1 min-h-0">
            <CardHeader className="pb-2">
              <CardTitle>Headlines</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              <HeadlinesWidget limit={8} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
