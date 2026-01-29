import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, addWeeks, format, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, X, Droplets, Wind, Thermometer, PenTool } from "lucide-react";
import { api, type WeatherData, type WeatherForecast, type HourlyForecast } from "../services/api";
import { useCalendarStore } from "../stores/calendar";
import { CalendarView, EventModal, CreateEventModal, HandwritingOverlay, DaySummaryModal } from "../components/calendar";
import { SportsScoreBadge } from "../components/sports";
import { Button } from "../components/ui/Button";
import type { CalendarEvent, SportsGame } from "@openframe/shared";

// Weather detail info for popup
interface WeatherPopupData {
  date: Date;
  isToday: boolean;
  current?: WeatherData;
  forecast?: WeatherForecast;
}

// Weather popup component
function WeatherPopup({
  data,
  onClose
}: {
  data: WeatherPopupData;
  onClose: () => void;
}) {
  const weather = data.isToday && data.current ? data.current : null;
  const forecast = data.forecast;

  // Fetch hourly forecast for today
  const { data: hourlyForecast } = useQuery({
    queryKey: ["weather-hourly"],
    queryFn: () => api.getHourlyForecast(),
    enabled: data.isToday,
    staleTime: 10 * 60 * 1000,
  });

  // Helper to format precipitation
  const formatPrecip = (rain?: number, snow?: number) => {
    if (snow && snow > 0) {
      // Convert mm to inches for snow
      const inches = (snow / 25.4).toFixed(1);
      return `${inches}"`;
    }
    if (rain && rain > 0) {
      // Convert mm to inches for rain
      const inches = (rain / 25.4).toFixed(2);
      return `${inches}"`;
    }
    return null;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-lg shadow-xl p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {format(data.date, "EEEE, MMMM d")}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {weather ? (
          // Current weather details for today
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-5xl">{getWeatherIcon(weather.icon)}</span>
              <div>
                <p className="text-4xl font-bold">{weather.temp}°</p>
                <p className="text-muted-foreground capitalize">{weather.description}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                <Thermometer className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Feels Like</p>
                  <p className="font-medium">{weather.feels_like}°</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Thermometer className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">High / Low</p>
                  <p className="font-medium">{weather.temp_max}° / {weather.temp_min}°</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Droplets className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Humidity</p>
                  <p className="font-medium">{weather.humidity}%</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Wind className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Wind</p>
                  <p className="font-medium">{weather.wind_speed} mph</p>
                </div>
              </div>
              {hourlyForecast && (
                <div className="flex items-center gap-2 col-span-2">
                  <Droplets className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Precipitation</p>
                    <p className="font-medium">
                      {Math.max(...hourlyForecast.map(h => h.pop))}% chance
                      {(() => {
                        const totalRain = hourlyForecast.reduce((sum, h) => sum + (h.rain || 0), 0);
                        const totalSnow = hourlyForecast.reduce((sum, h) => sum + (h.snow || 0), 0);
                        if (totalSnow > 0) return ` / ${(totalSnow / 25.4).toFixed(1)}" snow`;
                        if (totalRain > 0) return ` / ${(totalRain / 25.4).toFixed(2)}" rain`;
                        return "";
                      })()}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Hourly forecast */}
            {hourlyForecast && hourlyForecast.length > 0 && (
              <div className="pt-4 border-t border-border">
                <h4 className="text-sm font-semibold mb-3">Hourly Forecast</h4>
                <div className="space-y-2">
                  {hourlyForecast.map((hour, i) => {
                    const precip = formatPrecip(hour.rain, hour.snow);
                    return (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <span className="w-12 text-muted-foreground">{hour.time}</span>
                        <span className="text-lg">{getWeatherIcon(hour.icon)}</span>
                        <span className="w-10 font-medium">{hour.temp}°</span>
                        <span className="w-16 flex items-center gap-1 text-muted-foreground">
                          <Droplets className="h-3 w-3" />
                          {hour.pop}%
                          {precip && <span className="text-blue-500 ml-1">{precip}</span>}
                        </span>
                        <span className="text-xs text-muted-foreground">{hour.wind_speed} mph</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : forecast ? (
          // Forecast details for future days
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-5xl">{getWeatherIcon(forecast.icon)}</span>
              <div>
                <p className="text-4xl font-bold">{forecast.temp_max}°</p>
                <p className="text-muted-foreground capitalize">{forecast.description}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                <Thermometer className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">High</p>
                  <p className="font-medium">{forecast.temp_max}°</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Thermometer className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Low</p>
                  <p className="font-medium">{forecast.temp_min}°</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-4">
            No weather data available for this day
          </p>
        )}
      </div>
    </div>
  );
}

// Weather icon mapping
function getWeatherIcon(iconCode: string): string {
  const iconMap: Record<string, string> = {
    "01d": "\u2600\uFE0F", // sunny
    "01n": "\uD83C\uDF19", // clear night
    "02d": "\u26C5", // partly cloudy
    "02n": "\u26C5", // partly cloudy night
    "03d": "\u2601\uFE0F", // cloudy
    "03n": "\u2601\uFE0F",
    "04d": "\u2601\uFE0F", // broken clouds
    "04n": "\u2601\uFE0F",
    "09d": "\uD83C\uDF27\uFE0F", // rain
    "09n": "\uD83C\uDF27\uFE0F",
    "10d": "\uD83C\uDF26\uFE0F", // sun rain
    "10n": "\uD83C\uDF27\uFE0F",
    "11d": "\u26C8\uFE0F", // thunder
    "11n": "\u26C8\uFE0F",
    "13d": "\uD83C\uDF28\uFE0F", // snow
    "13n": "\uD83C\uDF28\uFE0F",
    "50d": "\uD83C\uDF2B\uFE0F", // mist
    "50n": "\uD83C\uDF2B\uFE0F",
  };
  return iconMap[iconCode] || "\u2600\uFE0F";
}

export function CalendarPage() {
  const queryClient = useQueryClient();
  const {
    currentDate,
    view,
    selectedCalendarIds,
    calendars,
    setCalendars,
    setSelectedEvent,
    selectedEvent,
    weekStartsOn,
    familyName,
    timeFormat,
    cycleTimeFormat,
    navigateToday,
    navigatePrevious,
    navigateNext,
    setView,
    setCurrentDate,
  } = useCalendarStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timeFade, setTimeFade] = useState(true);
  const [weatherPopup, setWeatherPopup] = useState<WeatherPopupData | null>(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawingTargetDate, setDrawingTargetDate] = useState<Date | null>(null);
  const [daySummaryDate, setDaySummaryDate] = useState<Date | null>(null);

  // Fetch weather data
  const { data: weather } = useQuery({
    queryKey: ["weather-current"],
    queryFn: () => api.getCurrentWeather(),
    refetchInterval: 10 * 60 * 1000, // Refresh every 10 minutes
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Fetch weather forecast
  const { data: forecast } = useQuery({
    queryKey: ["weather-forecast"],
    queryFn: () => api.getWeatherForecast(),
    refetchInterval: 30 * 60 * 1000, // Refresh every 30 minutes
    staleTime: 15 * 60 * 1000,
    retry: false,
  });

  // Fetch today's sports games (scheduled, live, and finished)
  const { data: todaysGames = [] } = useQuery({
    queryKey: ["todays-sports"],
    queryFn: () => api.getTodaySportsScores(),
    refetchInterval: (query) => {
      // Smart polling: 30s if there are live games, 5 min otherwise
      const games = query.state.data as SportsGame[] | undefined;
      const hasLiveGames = games?.some(
        (g) => g.status === "in_progress" || g.status === "halftime"
      );
      return hasLiveGames ? 30 * 1000 : 5 * 60 * 1000;
    },
    staleTime: 15 * 1000,
    retry: false,
  });

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Handle time format change with fade effect
  const handleTimeFormatChange = () => {
    setTimeFade(false);
    setTimeout(() => {
      cycleTimeFormat();
      setTimeFade(true);
    }, 300);
  };

  // Calculate date range based on view
  const dateRange = useMemo(() => {
    let start: Date;
    let end: Date;

    switch (view) {
      case "month":
        start = startOfWeek(startOfMonth(currentDate), { weekStartsOn });
        end = endOfWeek(endOfMonth(currentDate), { weekStartsOn });
        break;
      case "week":
        start = startOfWeek(currentDate, { weekStartsOn });
        // Include next week for the "Next Week" preview cell
        end = endOfWeek(addWeeks(currentDate, 1), { weekStartsOn });
        break;
      case "day":
        start = new Date(currentDate);
        start.setHours(0, 0, 0, 0);
        end = new Date(currentDate);
        end.setHours(23, 59, 59, 999);
        break;
      case "agenda":
      default:
        start = new Date(currentDate);
        start.setHours(0, 0, 0, 0);
        end = addMonths(start, 1);
        break;
    }

    return { start, end };
  }, [currentDate, view, weekStartsOn]);

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

  // Fetch events
  const { data: events = [] } = useQuery({
    queryKey: ["events", dateRange.start.toISOString(), dateRange.end.toISOString(), selectedCalendarIds],
    queryFn: () => api.getEvents(dateRange.start, dateRange.end, selectedCalendarIds),
    enabled: selectedCalendarIds.length > 0,
  });

  // Delete event mutation
  const deleteEvent = useMutation({
    mutationFn: (id: string) => api.deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedEvent(null);
  };

  const handleDeleteEvent = (id: string) => {
    deleteEvent.mutate(id);
  };

  const handleUpdateEvent = () => {
    queryClient.invalidateQueries({ queryKey: ["events"] });
  };

  // Handle clicking on a day/slot
  const handleSelectSlot = (slotInfo: { start: Date; end: Date }) => {
    // If in drawing mode, open handwriting overlay for this date
    if (isDrawingMode) {
      setDrawingTargetDate(slotInfo.start);
      setIsDrawingMode(false); // Exit drawing mode after selecting date
      return;
    }
    // Show day summary modal instead of switching to day view
    setDaySummaryDate(slotInfo.start);
  };

  // Handle long-press on a date to open handwriting
  const handleDateLongPress = (date: Date) => {
    setDrawingTargetDate(date);
  };

  // Toggle drawing mode
  const toggleDrawingMode = () => {
    setIsDrawingMode((prev) => !prev);
  };

  // Close handwriting overlay
  const handleCloseHandwriting = () => {
    setDrawingTargetDate(null);
  };

  // Handle weather click to show popup
  const handleWeatherClick = (date: Date) => {
    const isToday = isSameDay(date, new Date());
    let forecastData: WeatherForecast | undefined;

    if (forecast) {
      const dayName = format(date, "EEE");
      forecastData = forecast.find(f => f.date === dayName);
    }

    setWeatherPopup({
      date,
      isToday,
      current: isToday ? weather : undefined,
      forecast: forecastData,
    });
  };

  // Format time based on selected format
  const formattedTime = useMemo(() => {
    switch (timeFormat) {
      case "12h":
        return format(currentTime, "h:mm a");
      case "12h-seconds":
        return format(currentTime, "h:mm:ss a");
      case "24h":
        return format(currentTime, "HH:mm");
      case "24h-seconds":
        return format(currentTime, "HH:mm:ss");
      default:
        return format(currentTime, "h:mm a");
    }
  }, [currentTime, timeFormat]);

  // Format the header based on view
  const headerText = useMemo(() => {
    switch (view) {
      case "month":
        return format(currentDate, "MMMM yyyy");
      case "week":
        const weekStart = startOfWeek(currentDate, { weekStartsOn });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn });
        return `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`;
      case "day":
        return format(currentDate, "EEEE, MMMM d, yyyy");
      case "agenda":
        return format(currentDate, "MMMM yyyy");
      default:
        return "";
    }
  }, [currentDate, view, weekStartsOn]);

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col">
        {/* Navigation header - 75% larger */}
        <div className="flex items-center justify-between border-b border-border px-5 py-2">
          <div className="flex items-center gap-5">
            <h1 className="text-3xl font-bold">{familyName}</h1>
            <button
              onClick={handleTimeFormatChange}
              className={`text-3xl font-semibold text-muted-foreground hover:text-foreground transition-opacity duration-300 ${
                timeFade ? "opacity-100" : "opacity-0"
              }`}
              title="Click to change time format"
            >
              {formattedTime}
            </button>
            {weather && (
              <button
                onClick={() => handleWeatherClick(new Date())}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                title={weather.description}
              >
                <span className="text-4xl">{getWeatherIcon(weather.icon)}</span>
                <span className="text-3xl font-semibold">{weather.temp}°</span>
              </button>
            )}
            {/* Today's Sports Games */}
            {todaysGames.length > 0 && (
              <div className="flex items-center gap-3 border-l border-border pl-5">
                {todaysGames.slice(0, 3).map((game) => (
                  <SportsScoreBadge key={game.externalId} game={game} compact />
                ))}
                {todaysGames.length > 3 && (
                  <span className="text-base text-muted-foreground">
                    +{todaysGames.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">{headerText}</h2>
            <select
              className="rounded-md border border-border bg-background px-4 py-2.5 text-lg font-medium"
              value={view}
              onChange={(e) => setView(e.target.value as "month" | "week" | "day" | "agenda")}
            >
              <option value="month">Month</option>
              <option value="week">Week</option>
              <option value="day">Day</option>
              <option value="agenda">Agenda</option>
            </select>
            <div className="flex items-center gap-2 ml-3">
              <Button variant="ghost" size="lg" onClick={navigatePrevious} title="Previous">
                <ChevronLeft className="h-8 w-8" />
              </Button>
              <Button variant="outline" size="lg" onClick={navigateToday} className="text-lg px-5">
                TODAY
              </Button>
              <Button variant="ghost" size="lg" onClick={navigateNext} title="Next">
                <ChevronRight className="h-8 w-8" />
              </Button>
            </div>
          </div>
        </div>

        {/* Calendar view */}
        <div className="flex-1 relative">
          <CalendarView
            events={events}
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
            onDateLongPress={handleDateLongPress}
            weatherForecast={forecast}
            currentWeather={weather}
            onWeatherClick={handleWeatherClick}
          />

          {/* Drawing mode indicator */}
          {isDrawingMode && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-md text-sm font-medium">
              Tap a date to write an event
            </div>
          )}

          {/* FAB buttons */}
          <div className="absolute bottom-6 right-6 flex flex-col gap-3">
            {/* Pen/Handwriting button */}
            <button
              onClick={toggleDrawingMode}
              className={`w-14 h-14 rounded-full shadow-md hover:shadow-lg transition-all flex items-center justify-center ${
                isDrawingMode
                  ? "bg-primary text-primary-foreground ring-4 ring-primary/30"
                  : "bg-card text-foreground border border-border hover:bg-muted"
              }`}
              title={isDrawingMode ? "Cancel drawing mode" : "Write event by hand"}
            >
              <PenTool className="h-6 w-6" />
            </button>

            {/* Add event button */}
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-md hover:shadow-lg hover:bg-primary/90 transition-all flex items-center justify-center"
              title="Add new event"
            >
              <Plus className="h-7 w-7" />
            </button>
          </div>
        </div>
      </div>

      <EventModal
        event={selectedEvent}
        open={isModalOpen}
        onClose={handleCloseModal}
        onDelete={handleDeleteEvent}
        onUpdate={handleUpdateEvent}
      />

      <CreateEventModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        calendars={calendars}
      />

      {weatherPopup && (
        <WeatherPopup
          data={weatherPopup}
          onClose={() => setWeatherPopup(null)}
        />
      )}

      {drawingTargetDate && (
        <HandwritingOverlay
          targetDate={drawingTargetDate}
          calendars={calendars}
          onClose={handleCloseHandwriting}
        />
      )}

      <DaySummaryModal
        date={daySummaryDate}
        events={events}
        open={daySummaryDate !== null}
        onClose={() => setDaySummaryDate(null)}
        onSelectEvent={handleSelectEvent}
      />
    </div>
  );
}
