import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, addWeeks, addDays, format, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, X, Droplets, Wind, Thermometer, PenTool } from "lucide-react";
import { api, type WeatherData, type WeatherForecast, type HourlyForecast } from "../services/api";
import { useCalendarStore } from "../stores/calendar";
import { CalendarView, EventModal, CreateEventModal, HandwritingOverlay, DaySummaryModal } from "../components/calendar";
import { SportsScoreBadge } from "../components/sports";
import { Button } from "../components/ui/Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/Select";
import type { CalendarEvent, SportsGame, FavoriteSportsTeam, CalendarVisibility } from "@openframe/shared";

// Weather detail info for popup
interface WeatherPopupData {
  date: Date;
  isToday: boolean;
  current?: WeatherData;
  forecast?: WeatherForecast;
}

// Sports game detail modal
function SportsGameModal({
  game,
  onClose
}: {
  game: SportsGame;
  onClose: () => void;
}) {
  const isLive = game.status === "in_progress" || game.status === "halftime";
  const isFinal = game.status === "final";
  const isScheduled = game.status === "scheduled";

  const formatGameTime = (startTime: string | Date): string => {
    const date = new Date(startTime);
    return format(date, "h:mm a");
  };

  const formatGameDate = (startTime: string | Date): string => {
    const date = new Date(startTime);
    return format(date, "EEEE, MMMM d");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {game.league.toUpperCase()} Game
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Game date/time */}
        <p className="text-sm text-muted-foreground mb-4">
          {formatGameDate(game.startTime)} • {formatGameTime(game.startTime)}
        </p>

        {/* Teams and scores */}
        <div className="space-y-4">
          {/* Away team */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {game.awayTeam.logo ? (
                <img
                  src={game.awayTeam.logo}
                  alt={game.awayTeam.name}
                  className="h-10 w-10 object-contain"
                />
              ) : (
                <div
                  className="h-10 w-10 rounded-full"
                  style={{ backgroundColor: game.awayTeam.color || "#6366F1" }}
                />
              )}
              <div>
                <p className="font-semibold">{game.awayTeam.name}</p>
                <p className="text-xs text-muted-foreground">{game.awayTeam.abbreviation}</p>
              </div>
            </div>
            {!isScheduled && (
              <span className="text-3xl font-bold">{game.awayTeam.score ?? 0}</span>
            )}
          </div>

          {/* Home team */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {game.homeTeam.logo ? (
                <img
                  src={game.homeTeam.logo}
                  alt={game.homeTeam.name}
                  className="h-10 w-10 object-contain"
                />
              ) : (
                <div
                  className="h-10 w-10 rounded-full"
                  style={{ backgroundColor: game.homeTeam.color || "#6366F1" }}
                />
              )}
              <div>
                <p className="font-semibold">{game.homeTeam.name}</p>
                <p className="text-xs text-muted-foreground">{game.homeTeam.abbreviation}</p>
              </div>
            </div>
            {!isScheduled && (
              <span className="text-3xl font-bold">{game.homeTeam.score ?? 0}</span>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="mt-4 pt-4 border-t border-border text-center">
          {isScheduled && (
            <p className="text-muted-foreground">
              Game starts at {formatGameTime(game.startTime)}
            </p>
          )}
          {isLive && (
            <p className="text-red-500 font-semibold">
              {game.statusDetail || "LIVE"}
            </p>
          )}
          {isFinal && (
            <p className="text-muted-foreground font-medium">Final</p>
          )}
        </div>

        {/* Venue if available */}
        {game.venue && (
          <p className="mt-3 text-sm text-muted-foreground text-center">
            {game.venue}
          </p>
        )}
      </div>
    </div>
  );
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
    tickerSpeed,
    weekMode,
    setWeekMode,
    monthMode,
    setMonthMode,
  } = useCalendarStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timeFade, setTimeFade] = useState(true);
  const [weatherPopup, setWeatherPopup] = useState<WeatherPopupData | null>(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawingTargetDate, setDrawingTargetDate] = useState<Date | null>(null);
  const [daySummaryDate, setDaySummaryDate] = useState<Date | null>(null);
  const [selectedGame, setSelectedGame] = useState<SportsGame | null>(null);

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

  // Fetch hourly forecast for header
  const { data: hourlyForecast } = useQuery({
    queryKey: ["weather-hourly"],
    queryFn: () => api.getHourlyForecast(),
    refetchInterval: 30 * 60 * 1000,
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
        if (monthMode === "rolling") {
          // Rolling month: 28 days (4 weeks) starting from beginning of current week
          start = startOfWeek(currentDate, { weekStartsOn });
          end = addDays(start, 28);
        } else {
          // Standard month: full visible calendar grid
          start = startOfWeek(startOfMonth(currentDate), { weekStartsOn });
          end = endOfWeek(endOfMonth(currentDate), { weekStartsOn });
        }
        break;
      case "week":
        if (weekMode === "rolling") {
          start = new Date(currentDate);
          start.setHours(0, 0, 0, 0);
          // Include next week for the "Next Week" preview cell
          end = addDays(start, 14);
        } else {
          start = startOfWeek(currentDate, { weekStartsOn });
          // Include next week for the "Next Week" preview cell
          end = endOfWeek(addWeeks(currentDate, 1), { weekStartsOn });
        }
        break;
      case "day":
        start = new Date(currentDate);
        start.setHours(0, 0, 0, 0);
        end = new Date(currentDate);
        end.setHours(23, 59, 59, 999);
        break;
      case "schedule":
        // Schedule view: today + next 4 days (5 days total)
        start = new Date(currentDate);
        start.setHours(0, 0, 0, 0);
        end = addDays(start, 5);
        break;
      case "agenda":
      default:
        start = new Date(currentDate);
        start.setHours(0, 0, 0, 0);
        end = addMonths(start, 1);
        break;
    }

    return { start, end };
  }, [currentDate, view, weekStartsOn, weekMode, monthMode]);

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

  // Fetch events (refresh every 2 minutes)
  const { data: rawCalendarEvents = [] } = useQuery({
    queryKey: ["events", dateRange.start.toISOString(), dateRange.end.toISOString(), selectedCalendarIds],
    queryFn: () => api.getEvents(dateRange.start, dateRange.end, selectedCalendarIds),
    enabled: selectedCalendarIds.length > 0,
    refetchInterval: 2 * 60 * 1000, // 2 minutes
    staleTime: 60 * 1000, // 1 minute
  });

  // Fetch favorite teams for visibility settings
  const { data: favoriteTeams = [] } = useQuery({
    queryKey: ["favorite-teams"],
    queryFn: () => api.getFavoriteTeams(),
  });

  // Fetch sports events (refresh every 2 minutes)
  const { data: rawSportsEvents = [] } = useQuery({
    queryKey: ["sports-events", dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: () => api.getSportsEvents(dateRange.start, dateRange.end),
    enabled: favoriteTeams.length > 0,
    refetchInterval: 2 * 60 * 1000, // 2 minutes
    staleTime: 60 * 1000, // 1 minute
  });

  // Map calendar IDs to their visibility settings
  const calendarVisibility = useMemo(() =>
    new Map(calendars.map(cal => [cal.id, cal.visibility ?? { week: true, month: true, day: true, popup: true, screensaver: false }])),
    [calendars]
  );

  // Map favorite team database IDs to their visibility settings
  const teamVisibility = useMemo(() => {
    const defaultVisibility: CalendarVisibility = { week: false, month: false, day: false, popup: true, screensaver: false };
    return new Map(favoriteTeams.map((team: FavoriteSportsTeam) => [
      team.id, // Use database ID, not ESPN teamId
      team.visibility ?? defaultVisibility
    ]));
  }, [favoriteTeams]);

  // Helper to check visibility for current view
  const isVisibleForView = (visibility: CalendarVisibility | undefined, currentView: string): boolean => {
    if (!visibility) return true;
    switch (currentView) {
      case "week": return visibility.week;
      case "month": return visibility.month;
      case "day": return visibility.day;
      case "agenda": return visibility.day;
      case "schedule": return visibility.week;
      default: return true;
    }
  };

  // Combine and filter all events based on visibility settings for current view
  const rawEvents = useMemo(() => {
    // Filter sports events based on team visibility
    // Sports event calendarId format is "sports-{favoriteTeamId}"
    const filteredSportsEvents = rawSportsEvents.filter(event => {
      if (!event.calendarId?.startsWith("sports-")) return false;
      const teamDbId = event.calendarId.replace("sports-", "");
      const visibility = teamVisibility.get(teamDbId);
      return isVisibleForView(visibility, view);
    });
    return [...rawCalendarEvents, ...filteredSportsEvents];
  }, [rawCalendarEvents, rawSportsEvents, teamVisibility, view]);

  // Filter calendar events based on calendar visibility settings for current view
  const events = useMemo(() => {
    return rawEvents.filter(event => {
      // Sports events don't have calendarId visibility - they use team visibility (already filtered above)
      if (!event.calendarId || event.calendarId.startsWith("sports-")) {
        return true; // Sports events already filtered in rawEvents
      }
      const visibility = calendarVisibility.get(event.calendarId);
      if (!visibility) return true; // Default to visible if calendar not found

      // Check visibility based on current view
      return isVisibleForView(visibility, view);
    });
  }, [rawEvents, calendarVisibility, view]);

  // Filter events for popup (day summary modal) based on popup visibility
  const popupEvents = useMemo(() => {
    return [...rawCalendarEvents, ...rawSportsEvents].filter(event => {
      // Check sports team popup visibility
      if (event.calendarId?.startsWith("sports-")) {
        const teamDbId = event.calendarId.replace("sports-", "");
        const visibility = teamVisibility.get(teamDbId);
        return visibility?.popup ?? true;
      }
      // Check calendar popup visibility
      const visibility = calendarVisibility.get(event.calendarId);
      if (!visibility) return true;
      return visibility.popup;
    });
  }, [rawCalendarEvents, rawSportsEvents, teamVisibility, calendarVisibility]);

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
        if (monthMode === "rolling") {
          const monthStart = startOfWeek(currentDate, { weekStartsOn });
          const monthEnd = addDays(monthStart, 27); // 28 days total (4 weeks)
          return `${format(monthStart, "MMM d")} - ${format(monthEnd, "MMM d, yyyy")}`;
        }
        return format(currentDate, "MMMM yyyy");
      case "week":
        const weekStart = weekMode === "rolling"
          ? currentDate
          : startOfWeek(currentDate, { weekStartsOn });
        const weekEnd = weekMode === "rolling"
          ? addDays(currentDate, 6)
          : endOfWeek(currentDate, { weekStartsOn });
        return `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`;
      case "day":
        return format(currentDate, "EEEE, MMMM d, yyyy");
      case "agenda":
        return format(currentDate, "MMMM yyyy");
      case "schedule":
        const scheduleStart = currentDate;
        const scheduleEnd = addDays(currentDate, 4);
        return `${format(scheduleStart, "MMM d")} - ${format(scheduleEnd, "MMM d, yyyy")}`;
      default:
        return "";
    }
  }, [currentDate, view, weekStartsOn, weekMode, monthMode]);

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col">
        {/* Navigation header - 2-row grid layout */}
        <div className="grid grid-cols-[auto_1fr] grid-rows-[auto_auto] gap-x-4 gap-y-0 border-b border-border px-4 pt-0.5 pb-2">
          {/* Row 1, Left: Weather */}
          <div className="flex items-center gap-[clamp(0.5rem,1vw,1rem)]">
            {/* Current weather */}
            {weather && (
              <button
                onClick={() => handleWeatherClick(new Date())}
                className="flex items-center gap-[clamp(0.25rem,0.5vw,0.5rem)] text-muted-foreground hover:text-foreground transition-colors"
                title={weather.description}
              >
                <span className="text-[clamp(1.5rem,3vw,2.5rem)]">{getWeatherIcon(weather.icon)}</span>
                <span className="text-[clamp(1.25rem,2.5vw,2rem)] font-semibold">{weather.temp}°</span>
              </button>
            )}
            {/* Hourly forecast */}
            {hourlyForecast && hourlyForecast.length > 0 && (
              <div className="flex items-center gap-[clamp(0.5rem,1vw,1rem)] text-muted-foreground">
                {hourlyForecast.slice(0, 4).map((hour, i) => (
                  <div key={i} className="flex flex-col items-center text-[clamp(0.625rem,1.25vw,0.875rem)] leading-tight">
                    <div className="flex items-center gap-0.5">
                      <span className="text-[clamp(0.875rem,1.5vw,1.25rem)]">{getWeatherIcon(hour.icon)}</span>
                      <span>{hour.temp}°</span>
                    </div>
                    <span className="-mt-0.5">{hour.time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Row 1, Right: Clock */}
          <div className="flex items-stretch justify-end">
            <button
              onClick={handleTimeFormatChange}
              className={`flex items-center text-[clamp(1.75rem,4vw,3rem)] font-semibold text-muted-foreground hover:text-foreground transition-opacity duration-300 whitespace-nowrap ${
                timeFade ? "opacity-100" : "opacity-0"
              }`}
              title="Click to change time format"
            >
              {formattedTime}
            </button>
          </div>

          {/* Row 2, Left: Date range */}
          <div className="flex items-center">
            <p className="text-sm text-muted-foreground whitespace-nowrap">{headerText}</p>
          </div>

          {/* Row 2, Right: Ticker + Navigation */}
          <div className="flex items-center gap-2 min-w-0">
            {/* Ticker area - fills available space, or spacer when no games */}
            {todaysGames.length > 0 ? (
              <div className="flex-1 overflow-hidden relative min-w-0">
                {/* Left fade gradient */}
                <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
                {/* Right fade gradient */}
                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

                {/* Scrolling content - clickable items */}
                <div
                  className="flex items-center whitespace-nowrap"
                  style={{
                    animation: `ticker ${tickerSpeed === 'slow' ? 45 : tickerSpeed === 'fast' ? 15 : 30}s linear infinite`,
                  }}
                >
                  {/* First set of items with separators */}
                  {todaysGames.map((game, idx) => (
                    <div key={`${game.externalId}-1`} className="flex items-center shrink-0">
                      <button
                        onClick={() => setSelectedGame(game)}
                        className="shrink-0 hover:bg-muted/50 rounded px-1 py-0.5 transition-colors"
                      >
                        <SportsScoreBadge game={game} compact />
                      </button>
                      {/* Separator after each item */}
                      <span className="mx-3 text-muted-foreground/50">•</span>
                    </div>
                  ))}
                  {/* Gap before repeat */}
                  <div className="shrink-0" style={{ width: '50%' }} />
                  {/* Duplicate items for seamless loop */}
                  {todaysGames.map((game, idx) => (
                    <div key={`${game.externalId}-2`} className="flex items-center shrink-0">
                      <button
                        onClick={() => setSelectedGame(game)}
                        className="shrink-0 hover:bg-muted/50 rounded px-1 py-0.5 transition-colors"
                      >
                        <SportsScoreBadge game={game} compact />
                      </button>
                      {/* Separator after each item */}
                      <span className="mx-3 text-muted-foreground/50">•</span>
                    </div>
                  ))}
                  {/* Gap at end for seamless loop */}
                  <div className="shrink-0" style={{ width: '50%' }} />
                </div>
              </div>
            ) : (
              <div className="flex-1" />
            )}

            {/* Navigation controls */}
            <div className="flex items-center gap-2 shrink-0">
              <Select value={view} onValueChange={(v) => setView(v as "month" | "week" | "day" | "agenda" | "schedule")}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Month</SelectItem>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="agenda">Agenda</SelectItem>
                  <SelectItem value="schedule">Schedule</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={navigatePrevious} title="Previous" className="p-1.5 border-2 border-primary/30 bg-primary/5 hover:border-primary/50 hover:bg-primary/10">
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button variant="outline" size="sm" onClick={navigateToday} className="text-sm px-3 py-1.5 border-2 border-primary/40 bg-primary/10 hover:border-primary/60 hover:bg-primary/20 font-semibold">
                  TODAY
                </Button>
                <Button variant="ghost" size="sm" onClick={navigateNext} title="Next" className="p-1.5 border-2 border-primary/30 bg-primary/5 hover:border-primary/50 hover:bg-primary/10">
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar view */}
        <div className="flex-1 relative overflow-hidden">
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

          {/* Rolling/Current toggle - bottom left */}
          {(view === "week" || view === "month") && (
            <button
              onClick={() => {
                if (view === "week") {
                  setWeekMode(weekMode === "current" ? "rolling" : "current");
                } else {
                  setMonthMode(monthMode === "current" ? "rolling" : "current");
                }
              }}
              className="absolute bottom-6 left-6 px-4 py-2 text-sm font-medium rounded-full shadow-md bg-card border-2 border-primary/40 hover:bg-muted hover:border-primary/60 transition-colors"
              title={
                view === "week"
                  ? weekMode === "current" ? "Switch to rolling week (Today+7)" : "Switch to current week (Mon-Sun)"
                  : monthMode === "current" ? "Switch to 4-week rolling view" : "Switch to calendar month"
              }
            >
              {view === "week"
                ? (weekMode === "current" ? "Mon-Sun" : "Today+7")
                : (monthMode === "current" ? "Calendar" : "4 Weeks")
              }
            </button>
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
        events={popupEvents}
        open={daySummaryDate !== null}
        onClose={() => setDaySummaryDate(null)}
        onSelectEvent={handleSelectEvent}
      />

      {selectedGame && (
        <SportsGameModal
          game={selectedGame}
          onClose={() => setSelectedGame(null)}
        />
      )}

      {/* Ticker animation styles */}
      <style>{`
        @keyframes ticker {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}
