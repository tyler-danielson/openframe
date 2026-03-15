import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Sun, Camera, ChefHat, ListTodo, Search, ArrowLeft,
  Clock, Heart, ChevronRight, Circle, CheckCircle2,
} from "lucide-react";
import { api, type WeatherData, type WeatherForecast } from "../../services/api";
import { useCalendarStore } from "../../stores/calendar";
import type { CalendarEvent, Camera as CameraType, Recipe, Task } from "@openframe/shared";

// Weather icon helper (same as CalendarPage)
function getWeatherIcon(iconCode: string): string {
  const iconMap: Record<string, string> = {
    "01d": "\u2600\uFE0F", "01n": "\uD83C\uDF19",
    "02d": "\u26C5", "02n": "\u26C5",
    "03d": "\u2601\uFE0F", "03n": "\u2601\uFE0F",
    "04d": "\u2601\uFE0F", "04n": "\u2601\uFE0F",
    "09d": "\uD83C\uDF27\uFE0F", "09n": "\uD83C\uDF27\uFE0F",
    "10d": "\uD83C\uDF26\uFE0F", "10n": "\uD83C\uDF27\uFE0F",
    "11d": "\u26C8\uFE0F", "11n": "\u26C8\uFE0F",
    "13d": "\uD83C\uDF28\uFE0F", "13n": "\uD83C\uDF28\uFE0F",
    "50d": "\uD83C\uDF2B\uFE0F", "50n": "\uD83C\uDF2B\uFE0F",
  };
  return iconMap[iconCode] || "\u2600\uFE0F";
}

interface SidebarTab {
  id: string;
  icon: React.ElementType;
  label: string;
}

const SIDEBAR_TABS: SidebarTab[] = [
  { id: "today", icon: Sun, label: "Today" },
  { id: "cameras", icon: Camera, label: "Cameras" },
  { id: "recipes", icon: ChefHat, label: "Recipes" },
  { id: "tasks", icon: ListTodo, label: "Tasks" },
];

interface CalendarSidebarProps {
  events: CalendarEvent[];
  calendars: { id: string; name: string; color: string }[];
  onSelectEvent: (event: CalendarEvent) => void;
  timeFormat: string;
  weather?: WeatherData;
  forecast?: WeatherForecast[];
  onWeatherClick?: (date: Date) => void;
}

export function CalendarSidebar({
  events,
  calendars,
  onSelectEvent,
  timeFormat,
  weather,
  forecast,
  onWeatherClick,
}: CalendarSidebarProps) {
  const { sidebarWidth, sidebarTab, setSidebarWidth, setSidebarTab } = useCalendarStore();

  // Resize handle
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = startX - e.clientX;
      setSidebarWidth(startWidth + delta);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [sidebarWidth, setSidebarWidth]);

  return (
    <div
      className="shrink-0 border-l border-border flex flex-col bg-background relative"
      style={{ width: sidebarWidth }}
    >
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors z-10"
        onMouseDown={handleMouseDown}
      />

      {/* Tab navigation */}
      <div className="flex items-center border-b border-border px-2 py-1.5 gap-0.5">
        {SIDEBAR_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = sidebarTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSidebarTab(tab.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isActive
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
              title={tab.label}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {sidebarTab === "today" && (
          <TodayContent
            events={events}
            calendars={calendars}
            onSelectEvent={onSelectEvent}
            timeFormat={timeFormat}
            weather={weather}
            forecast={forecast}
            onWeatherClick={onWeatherClick}
          />
        )}
        {sidebarTab === "cameras" && <CamerasContent />}
        {sidebarTab === "recipes" && <RecipesContent />}
        {sidebarTab === "tasks" && <TasksContent />}
      </div>
    </div>
  );
}

// ── Today Tab ──────────────────────────────────────────────

function TodayContent({
  events,
  calendars,
  onSelectEvent,
  timeFormat,
  weather,
  forecast,
  onWeatherClick,
}: {
  events: CalendarEvent[];
  calendars: { id: string; name: string; color: string }[];
  onSelectEvent: (event: CalendarEvent) => void;
  timeFormat: string;
  weather?: WeatherData;
  forecast?: WeatherForecast[];
  onWeatherClick?: (date: Date) => void;
}) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

  const dedup = (list: CalendarEvent[]): CalendarEvent[] => {
    const seen = new Set<string>();
    return list.filter(e => {
      const key = `${e.title}|${new Date(e.startTime).getTime()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const todayEvents = useMemo(() => {
    const filtered = events
      .filter(e => {
        const start = new Date(e.startTime);
        const end = new Date(e.endTime);
        return start < tomorrowStart && end > todayStart;
      })
      .sort((a, b) => {
        if (a.isAllDay && !b.isAllDay) return -1;
        if (!a.isAllDay && b.isAllDay) return 1;
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      });
    return dedup(filtered);
  }, [events, todayStart.getTime(), tomorrowStart.getTime()]);

  const tomorrowEvents = useMemo(() => {
    const filtered = events
      .filter(e => {
        const start = new Date(e.startTime);
        const end = new Date(e.endTime);
        return start < tomorrowEnd && end > tomorrowStart;
      })
      .sort((a, b) => {
        if (a.isAllDay && !b.isAllDay) return -1;
        if (!a.isAllDay && b.isAllDay) return 1;
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      });
    return dedup(filtered);
  }, [events, tomorrowStart.getTime(), tomorrowEnd.getTime()]);

  const use24h = timeFormat.startsWith("24h");
  const timeFormatStr = use24h ? "HH:mm" : "h:mm a";

  const formatTime = (event: CalendarEvent): string => {
    if (event.isAllDay) return "All Day";
    const start = new Date(event.startTime);
    const end = new Date(event.endTime);
    return `${format(start, timeFormatStr)} - ${format(end, timeFormatStr)}`;
  };

  const getCalendarInfo = (calendarId: string) => {
    if (calendarId === "federal-holidays") return { name: "Holidays", color: "#9333EA" };
    if (calendarId?.startsWith("sports-")) return { name: "Sports", color: "#EF4444" };
    const cal = calendars.find(c => c.id === calendarId);
    return { name: cal?.name ?? "Calendar", color: cal?.color ?? "#3B82F6" };
  };

  const tomorrowForecast = forecast?.find(f => f.date === format(tomorrowStart, "EEE"));

  return (
    <div className="p-4 space-y-5">
      {/* Today's date */}
      <div>
        <div className="text-lg font-semibold">{format(now, "EEEE")}</div>
        <div className="text-sm text-muted-foreground">{format(now, "MMMM d, yyyy")}</div>
      </div>

      {/* Weather */}
      {weather && (
        <button
          onClick={() => onWeatherClick?.(new Date())}
          className="w-full rounded-lg bg-muted/30 p-3 hover:bg-muted/50 transition-colors text-left"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-semibold">{weather.temp}&deg;{weather.units === "metric" ? "C" : "F"}</div>
              <div className="text-sm text-muted-foreground capitalize">{weather.description}</div>
            </div>
            <span className="text-4xl">{getWeatherIcon(weather.icon)}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            H: {weather.temp_max}&deg; &middot; L: {weather.temp_min}&deg; &middot; {weather.humidity}% humidity
          </div>
        </button>
      )}

      {/* Today's events */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Today</h3>
        {todayEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events today</p>
        ) : (
          <div className="space-y-1.5">
            {todayEvents.map(event => {
              const calInfo = getCalendarInfo(event.calendarId);
              const isPast = new Date(event.endTime) < now;
              const isNow = new Date(event.startTime) <= now && new Date(event.endTime) > now;
              return (
                <button
                  key={event.id}
                  onClick={() => onSelectEvent(event)}
                  className={`w-full text-left px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors ${isPast ? "opacity-50" : ""}`}
                  style={{ borderLeft: `3px solid ${calInfo.color}`, backgroundColor: `${calInfo.color}10` }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">{formatTime(event)}</span>
                    {isNow && (
                      <span className="text-[10px] font-semibold text-primary bg-primary/15 px-1.5 py-0.5 rounded-full">NOW</span>
                    )}
                  </div>
                  <div className="text-sm font-medium truncate">{event.title}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Tomorrow */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Tomorrow
          {tomorrowForecast && (
            <span className="ml-2 font-normal normal-case">
              {getWeatherIcon(tomorrowForecast.icon)} {tomorrowForecast.temp_max}&deg;
            </span>
          )}
        </h3>
        {tomorrowEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events tomorrow</p>
        ) : (
          <div className="space-y-1.5">
            {tomorrowEvents.slice(0, 5).map(event => {
              const calInfo = getCalendarInfo(event.calendarId);
              return (
                <button
                  key={event.id}
                  onClick={() => onSelectEvent(event)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors"
                  style={{ borderLeft: `3px solid ${calInfo.color}`, backgroundColor: `${calInfo.color}10` }}
                >
                  <span className="text-xs text-muted-foreground">{formatTime(event)}</span>
                  <div className="text-sm font-medium truncate">{event.title}</div>
                </button>
              );
            })}
            {tomorrowEvents.length > 5 && (
              <p className="text-xs text-muted-foreground pl-3">+{tomorrowEvents.length - 5} more</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Cameras Tab ────────────────────────────────────────────

function CamerasContent() {
  const { data: cameras = [] } = useQuery({
    queryKey: ["cameras"],
    queryFn: () => api.getCameras(),
  });

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setRefreshKey(k => k + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  const enabledCameras = cameras.filter((c: CameraType) => c.isEnabled);

  if (enabledCameras.length === 0) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground">No cameras configured</p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      {enabledCameras.map((camera: CameraType) => (
        <div key={camera.id} className="rounded-lg overflow-hidden border border-border bg-card">
          <img
            src={`${api.getCameraSnapshotUrl(camera.id)}${refreshKey ? `?t=${refreshKey}` : ""}`}
            alt={camera.name}
            className="w-full aspect-video object-cover bg-black"
            loading="lazy"
          />
          <div className="px-2.5 py-1.5 flex items-center gap-1.5">
            <Camera className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs font-medium truncate">{camera.name}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Recipes Tab ────────────────────────────────────────────

function RecipesContent() {
  const { data: recipes = [] } = useQuery({
    queryKey: ["recipes"],
    queryFn: () => api.getRecipes(),
  });

  const [search, setSearch] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const filtered = useMemo(() => {
    if (!search) return recipes;
    const q = search.toLowerCase();
    return recipes.filter((r: Recipe) =>
      r.title.toLowerCase().includes(q) ||
      r.tags?.some((t: string) => t.toLowerCase().includes(q))
    );
  }, [recipes, search]);

  if (selectedRecipe) {
    return <RecipeDetail recipe={selectedRecipe} onBack={() => setSelectedRecipe(null)} />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search recipes..."
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-border bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Recipe list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No recipes found</p>
        ) : (
          filtered.map((recipe: Recipe) => (
            <button
              key={recipe.id}
              onClick={() => setSelectedRecipe(recipe)}
              className="w-full text-left flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
            >
              {recipe.thumbnailPath ? (
                <img
                  src={api.getRecipeImageUrl(recipe.thumbnailPath)}
                  alt={recipe.title}
                  className="w-12 h-12 rounded-md object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-md bg-muted/50 flex items-center justify-center flex-shrink-0">
                  <ChefHat className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                  {recipe.title}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {(recipe.prepTime || recipe.cookTime) && (
                    <span className="flex items-center gap-0.5">
                      <Clock className="h-3 w-3" />
                      {(recipe.prepTime ?? 0) + (recipe.cookTime ?? 0)} min
                    </span>
                  )}
                  {recipe.isFavorite && <Heart className="h-3 w-3 text-red-400 fill-red-400" />}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function RecipeDetail({ recipe, onBack }: { recipe: Recipe; onBack: () => void }) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-border">
        <button onClick={onBack} className="p-1 hover:bg-muted rounded transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h3 className="text-sm font-semibold truncate flex-1">{recipe.title}</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Image */}
        {recipe.thumbnailPath && (
          <img
            src={api.getRecipeImageUrl(recipe.thumbnailPath)}
            alt={recipe.title}
            className="w-full rounded-lg object-cover max-h-40"
          />
        )}

        {/* Meta */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {recipe.prepTime != null && (
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Prep: {recipe.prepTime}m</span>
          )}
          {recipe.cookTime != null && (
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Cook: {recipe.cookTime}m</span>
          )}
          {recipe.servings != null && (
            <span>Serves {recipe.servings}</span>
          )}
        </div>

        {/* Tags */}
        {recipe.tags && recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {recipe.tags.map((tag: string) => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Ingredients */}
        {recipe.ingredients && recipe.ingredients.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Ingredients</h4>
            <ul className="space-y-1">
              {recipe.ingredients.map((ing, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <span className="text-muted-foreground mt-0.5">-</span>
                  <span>
                    {ing.amount && <span className="font-medium">{ing.amount}</span>}
                    {ing.unit && <span className="text-muted-foreground"> {ing.unit}</span>}
                    {" "}{ing.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Instructions */}
        {recipe.instructions && recipe.instructions.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Instructions</h4>
            <ol className="space-y-2">
              {recipe.instructions.map((step: string, i: number) => (
                <li key={i} className="text-sm flex gap-2">
                  <span className="text-xs font-bold text-primary bg-primary/10 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Notes */}
        {recipe.notes && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Notes</h4>
            <p className="text-sm text-muted-foreground">{recipe.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tasks Tab ──────────────────────────────────────────────

function TasksContent() {
  const queryClient = useQueryClient();

  const { data: taskLists = [] } = useQuery({
    queryKey: ["task-lists"],
    queryFn: () => api.getTaskLists(),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", { status: "needsAction" }],
    queryFn: () => api.getTasks({ status: "needsAction" }),
  });

  const completeTask = useMutation({
    mutationFn: (id: string) => api.completeTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  // Group tasks by list
  const tasksByList = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks as Task[]) {
      const existing = map.get(task.taskListId) ?? [];
      existing.push(task);
      map.set(task.taskListId, existing);
    }
    return map;
  }, [tasks]);

  const visibleLists = taskLists.filter((l: { id: string; name: string; isVisible: boolean }) => l.isVisible);

  if (visibleLists.length === 0) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground">No task lists configured</p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-4">
      {visibleLists.map((list: { id: string; name: string }) => {
        const listTasks = tasksByList.get(list.id) ?? [];
        if (listTasks.length === 0) return null;

        return (
          <div key={list.id}>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {list.name}
            </h4>
            <div className="space-y-1">
              {listTasks.map((task: Task) => {
                const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
                return (
                  <div
                    key={task.id}
                    className="flex items-start gap-2 p-1.5 rounded-md hover:bg-muted/50 transition-colors group"
                  >
                    <button
                      onClick={() => completeTask.mutate(task.id)}
                      className="mt-0.5 text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                      title="Complete task"
                    >
                      <Circle className="h-4 w-4" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">{task.title}</div>
                      {task.dueDate && (
                        <div className={`text-xs ${isOverdue ? "text-red-400" : "text-muted-foreground"}`}>
                          {isOverdue ? "Overdue: " : "Due: "}
                          {format(new Date(task.dueDate), "MMM d")}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {(tasks as Task[]).length === 0 && (
        <p className="text-sm text-muted-foreground">All tasks complete!</p>
      )}
    </div>
  );
}
