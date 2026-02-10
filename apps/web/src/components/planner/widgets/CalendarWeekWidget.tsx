import { Calendar } from "lucide-react";
import type { PlannerWidgetInstance } from "@openframe/shared";
import { type ViewMode, getViewModeClasses } from "../TemplateGallery";

interface CalendarWeekWidgetProps {
  widget: PlannerWidgetInstance;
  viewMode?: ViewMode;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarWeekWidget({ widget, viewMode = "local" }: CalendarWeekWidgetProps) {
  const classes = getViewModeClasses(viewMode);

  return (
    <div className={`h-full flex flex-col p-2 ${classes.containerBg}`}>
      <div className="flex items-center gap-1 mb-2">
        <Calendar className={`h-3 w-3 ${classes.muted}`} />
        <span className={`text-xs font-medium ${classes.heading}`}>Week View</span>
      </div>
      <div className="flex-1 grid grid-cols-7 gap-0.5">
        {DAYS.map((day) => (
          <div key={day} className="flex flex-col">
            <span className={`text-[8px] font-medium text-center ${classes.muted}`}>
              {day}
            </span>
            <div className={`flex-1 border rounded-sm min-h-[20px] ${classes.border}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
