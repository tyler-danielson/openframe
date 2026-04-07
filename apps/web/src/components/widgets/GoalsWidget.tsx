import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { api } from "../../services/api";
import type { WidgetStyle } from "../../stores/screensaver";

interface GoalsWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
  widgetId?: string;
}

export function GoalsWidget({ config, style, isBuilder }: GoalsWidgetProps) {
  const maxGoals = (config.maxGoals as number) ?? 3;

  const { data: goals = [] } = useQuery({
    queryKey: ["goals"],
    queryFn: () => api.getGoals({ active: true }),
    enabled: !isBuilder,
  });

  const visibleGoals = goals.slice(0, maxGoals);

  if (isBuilder && goals.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
        <Trophy className="h-8 w-8" />
        <span className="text-xs">Goals</span>
      </div>
    );
  }

  return (
    <div className="h-full p-3 flex flex-col gap-3 overflow-hidden">
      {visibleGoals.map((goal: any) => {
        const isQuantifiable = goal.goalType === "quantifiable";
        const targetVal = parseFloat(goal.targetValue || "0");
        const currentVal = parseFloat(goal.currentValue || "0");
        const milestones = goal.milestones ?? [];
        const completedMilestones = milestones.filter(
          (m: any) => m.completed
        ).length;

        const progress = isQuantifiable
          ? targetVal > 0
            ? Math.min(currentVal / targetVal, 1)
            : 0
          : milestones.length > 0
            ? completedMilestones / milestones.length
            : 0;

        return (
          <div key={goal.id} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm">{goal.icon || "🎯"}</span>
              <span className="text-xs font-medium flex-1 truncate">
                {goal.name}
              </span>
              <span className="text-[10px] text-primary font-medium">
                {Math.round(progress * 100)}%
              </span>
            </div>
            <div className="w-full h-2 bg-muted/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              {isQuantifiable
                ? `${currentVal} / ${targetVal} ${goal.targetUnit || ""}`
                : `${completedMilestones}/${milestones.length} milestones`}
            </p>
          </div>
        );
      })}
    </div>
  );
}
