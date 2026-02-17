import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Cloud,
  Sun,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudDrizzle,
  CloudFog,
  Loader2,
  Plus,
  ChevronRight,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Calendar,
  CheckSquare,
  Newspaper,
  Clock,
} from "lucide-react";
import { api } from "../../services/api";
import { useAuthStore } from "../../stores/auth";
import { Card } from "../../components/ui/Card";
import { useState } from "react";
import { useCompanion } from "./CompanionContext";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

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

function formatEventTime(event: any) {
  if (event.isAllDay) return "All day";
  const start = new Date(event.startTime);
  return start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function CompanionDashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const companion = useCompanion();
  const [briefingExpanded, setBriefingExpanded] = useState(false);
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const { data: weather } = useQuery({
    queryKey: ["companion-weather"],
    queryFn: () => api.getCurrentWeather(),
    staleTime: 300_000,
    retry: false,
    enabled: companion.canViewWeather,
  });

  const { data: briefing } = useQuery({
    queryKey: ["companion-briefing"],
    queryFn: () => api.getDailyBriefing(),
    staleTime: 600_000,
    retry: false,
  });

  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ["companion-today-events", startOfDay.toISOString()],
    queryFn: () => api.getCompanionEvents(startOfDay, endOfDay),
    staleTime: 60_000,
    enabled: companion.canViewCalendar,
  });

  const { data: tasks } = useQuery({
    queryKey: ["companion-active-tasks"],
    queryFn: () => api.getCompanionTasks({ status: "needsAction" }),
    staleTime: 60_000,
    enabled: companion.canViewTasks,
  });

  const { data: headlines } = useQuery({
    queryKey: ["companion-headlines"],
    queryFn: () => api.getNewsHeadlines(5),
    staleTime: 300_000,
    retry: false,
    enabled: companion.canViewNews,
  });

  const firstName = user?.name?.split(" ")[0] || "there";
  const todayEvents = (events || []).slice(0, 5);
  const dueTasks = (tasks || []).filter((t: any) => {
    if (!t.dueDate) return true;
    const due = new Date(t.dueDate);
    return due <= endOfDay;
  }).slice(0, 5);

  const WeatherIcon = getWeatherIcon(weather?.description);

  return (
    <div className="p-4 pb-6 space-y-4">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {getGreeting()}, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">{formatDate(now)}</p>
      </div>

      {/* Weather Card */}
      {companion.canViewWeather && weather && (
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-primary/10">
              <WeatherIcon className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <div className="text-2xl font-bold text-foreground">
                {Math.round(weather.temp || 0)}&deg;
              </div>
              <div className="text-sm text-muted-foreground capitalize">
                {weather.description || "Unknown"}
              </div>
            </div>
            {weather.temp_max != null && weather.temp_min != null && (
              <div className="text-right text-sm text-muted-foreground">
                <div>H: {Math.round(weather.temp_max)}&deg;</div>
                <div>L: {Math.round(weather.temp_min)}&deg;</div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* AI Briefing */}
      {briefing && (briefing as any).summary && (
        <Card className="p-4">
          <button
            onClick={() => setBriefingExpanded(!briefingExpanded)}
            className="w-full flex items-center gap-3"
          >
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 shrink-0">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-medium text-primary">Daily Briefing</div>
            </div>
            {briefingExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {briefingExpanded && (
            <div className="mt-3 text-sm text-foreground leading-relaxed whitespace-pre-line">
              {(briefing as any).summary}
            </div>
          )}
        </Card>
      )}

      {/* Today's Events */}
      {companion.canViewCalendar && <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-primary">Today's Events</h2>
          </div>
          <button
            onClick={() => navigate("/companion/calendar")}
            className="text-xs text-primary flex items-center gap-0.5"
          >
            View all <ChevronRight className="h-3 w-3" />
          </button>
        </div>
        {eventsLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
        ) : todayEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events today</p>
        ) : (
          <div className="space-y-2">
            {todayEvents.map((event: any) => (
              <div
                key={event.id}
                className="flex items-center gap-3 py-1.5"
              >
                <div
                  className="w-1 h-8 rounded-full shrink-0"
                  style={{ backgroundColor: event.calendarColor || "hsl(var(--primary))" }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {event.title}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatEventTime(event)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>}

      {/* Active Tasks */}
      {companion.canViewTasks && <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-primary">Tasks</h2>
          </div>
          <button
            onClick={() => navigate("/companion/tasks")}
            className="text-xs text-primary flex items-center gap-0.5"
          >
            View all <ChevronRight className="h-3 w-3" />
          </button>
        </div>
        {dueTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks due today</p>
        ) : (
          <div className="space-y-2">
            {dueTasks.map((task: any) => (
              <div key={task.id} className="flex items-center gap-2 py-1">
                <div className="h-4 w-4 rounded border border-primary/40 shrink-0" />
                <span className="text-sm text-foreground truncate">{task.title}</span>
              </div>
            ))}
          </div>
        )}
      </Card>}

      {/* Quick Actions */}
      {(companion.canEditCalendar || companion.canEditTasks) && (
        <div className="flex gap-3">
          {companion.canEditCalendar && (
            <button
              onClick={() => navigate("/companion/calendar/event/new")}
              className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl bg-primary text-primary-foreground font-medium text-sm"
            >
              <Plus className="h-4 w-4" />
              New Event
            </button>
          )}
          {companion.canEditTasks && (
            <button
              onClick={() => navigate("/companion/tasks")}
              className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl border border-primary/30 text-primary font-medium text-sm"
            >
              <Plus className="h-4 w-4" />
              New Task
            </button>
          )}
        </div>
      )}

      {/* News Headlines */}
      {companion.canViewNews && headlines && (headlines as any[]).length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Newspaper className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-primary">Headlines</h2>
          </div>
          <div className="space-y-3">
            {(headlines as any[]).slice(0, 5).map((item: any, i: number) => (
              <a
                key={i}
                href={item.link || item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-foreground hover:text-primary transition-colors leading-snug"
              >
                {item.title}
              </a>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
