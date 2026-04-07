import { useQuery } from "@tanstack/react-query";
import { Check, Circle, Flame, Target } from "lucide-react";
import { api } from "../../services/api";
import type { WidgetStyle } from "../../stores/screensaver";
import { cn } from "../../lib/utils";

interface HabitsWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
  widgetId?: string;
}

export function HabitsWidget({ config, style, isBuilder }: HabitsWidgetProps) {
  const displayMode = (config.displayMode as string) ?? "grid";
  const maxHabits = (config.maxHabits as number) ?? 6;

  const { data: habits = [] } = useQuery({
    queryKey: ["habits"],
    queryFn: () => api.getHabits(),
    enabled: !isBuilder,
  });

  const visibleHabits = habits.slice(0, maxHabits);

  if (isBuilder && habits.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
        <Target className="h-8 w-8" />
        <span className="text-xs">Habit Tracker</span>
      </div>
    );
  }

  // Build 7-day dates
  const weekDates: string[] = [];
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekDates.push(d.toISOString().slice(0, 10));
  }

  const today = now.toISOString().slice(0, 10);

  if (displayMode === "streaks") {
    return (
      <div className="h-full p-3 flex flex-col gap-2 overflow-hidden">
        {visibleHabits.map((habit: any) => (
          <div key={habit.id} className="flex items-center gap-2">
            <span className="text-sm">{habit.icon || "📋"}</span>
            <span className="text-xs flex-1 truncate">{habit.name}</span>
            {(habit.streak?.current ?? 0) > 0 && (
              <div className="flex items-center gap-1">
                <Flame className="h-3 w-3 text-orange-500" />
                <span className="text-xs font-bold text-orange-500">
                  {habit.streak.current}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Default: grid mode
  return (
    <div className="h-full p-3 flex flex-col gap-1.5 overflow-hidden">
      {visibleHabits.map((habit: any) => (
        <div key={habit.id} className="flex items-center gap-2">
          <span className="text-sm">{habit.icon || "📋"}</span>
          <span className="text-xs flex-1 truncate">{habit.name}</span>
          <div className="flex gap-0.5">
            {weekDates.map((date) => {
              const completed = (habit.completions ?? []).some(
                (c: any) => c.completedDate === date
              );
              return (
                <div
                  key={date}
                  className={cn(
                    "w-4 h-4 rounded-sm flex items-center justify-center",
                    completed ? "bg-primary/30" : "bg-muted/30",
                    date === today && "ring-1 ring-primary/40"
                  )}
                >
                  {completed && <Check className="h-2.5 w-2.5 text-primary" />}
                </div>
              );
            })}
          </div>
          {(habit.streak?.current ?? 0) > 0 && (
            <span className="text-[10px] text-orange-500 font-medium w-8 text-right">
              🔥{habit.streak.current}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
