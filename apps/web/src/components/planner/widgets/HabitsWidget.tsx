import { Target } from "lucide-react";
import type { PlannerWidgetInstance } from "@openframe/shared";
import { type ViewMode, getViewModeClasses } from "../TemplateGallery";

interface HabitsWidgetProps {
  widget: PlannerWidgetInstance;
  viewMode?: ViewMode;
}

export function HabitsWidget({ widget, viewMode = "local" }: HabitsWidgetProps) {
  const { config } = widget;
  const habits = (config.habits as string[]) || ["Exercise", "Read", "Meditate"];
  const title = (config.title as string) || "Habit Tracker";
  const classes = getViewModeClasses(viewMode);

  const previewDays = 7;
  const previewHabits = habits.slice(0, 3);

  return (
    <div className={`h-full flex flex-col p-2 ${classes.containerBg}`}>
      <div className="flex items-center gap-1 mb-1">
        <Target className={`h-3 w-3 ${classes.muted}`} />
        <span className={`text-xs font-medium ${classes.heading}`}>{title}</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <table className={`w-full text-[8px] ${classes.text}`}>
          <thead>
            <tr>
              <th className={`text-left font-normal w-12 ${classes.muted}`} />
              {Array.from({ length: previewDays }, (_, i) => (
                <th key={i} className={`font-normal px-0.5 ${classes.muted}`}>
                  {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewHabits.map((habit, i) => (
              <tr key={i}>
                <td className="truncate max-w-[40px]">{habit}</td>
                {Array.from({ length: previewDays }, (_, j) => (
                  <td key={j} className="text-center">
                    <div className={`w-2 h-2 border rounded-sm mx-auto ${classes.checkboxBorder}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
