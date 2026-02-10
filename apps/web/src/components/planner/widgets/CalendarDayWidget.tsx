import { Calendar } from "lucide-react";
import type { PlannerWidgetInstance } from "@openframe/shared";
import { type ViewMode, getViewModeClasses } from "../TemplateGallery";

interface CalendarDayWidgetProps {
  widget: PlannerWidgetInstance;
  viewMode?: ViewMode;
}

export function CalendarDayWidget({ widget, viewMode = "local" }: CalendarDayWidgetProps) {
  const { config } = widget;
  const showTime = config.showTime !== false;
  const classes = getViewModeClasses(viewMode);

  // Preview mode for builder
  const hours = ["9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM"];

  return (
    <div className={`h-full flex flex-col p-2 ${classes.containerBg}`}>
      <div className="flex items-center gap-1 mb-2">
        <Calendar className={`h-3 w-3 ${classes.muted}`} />
        <span className={`text-xs font-medium ${classes.heading}`}>Today's Schedule</span>
      </div>
      <div className="flex-1 space-y-1 overflow-hidden">
        {hours.map((hour) => (
          <div key={hour} className="flex text-[10px]">
            {showTime && (
              <span className={`w-10 shrink-0 ${classes.muted}`}>{hour}</span>
            )}
            <div className={`flex-1 border-t ${classes.border}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
