import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { cn } from "../../lib/utils";

interface Props {
  habits: any[];
}

export function HabitHeatMap({ habits }: Props) {
  // Build a 30-day grid
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  // Collect all completions across all habits
  const allCompletions = habits.flatMap((h: any) => h.completions ?? []);

  // Count completions per day
  const totalHabits = habits.length || 1;
  const dayData = days.map((date) => {
    const count = allCompletions.filter(
      (c: any) => c.completedDate === date
    ).length;
    const ratio = count / totalHabits;
    return { date, count, ratio };
  });

  return (
    <div className="flex flex-wrap gap-1">
      {dayData.map(({ date, ratio }) => (
        <div
          key={date}
          title={`${date}: ${Math.round(ratio * 100)}%`}
          className={cn(
            "w-6 h-6 rounded-sm border border-border/50 transition-colors",
            ratio === 0 && "bg-muted/30",
            ratio > 0 && ratio < 0.5 && "bg-primary/20",
            ratio >= 0.5 && ratio < 1 && "bg-primary/50",
            ratio >= 1 && "bg-primary"
          )}
        />
      ))}
    </div>
  );
}
