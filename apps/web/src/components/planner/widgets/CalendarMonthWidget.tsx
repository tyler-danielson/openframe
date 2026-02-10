import { Calendar } from "lucide-react";
import type { PlannerWidgetInstance } from "@openframe/shared";
import { type ViewMode, getViewModeClasses } from "../TemplateGallery";

interface CalendarMonthWidgetProps {
  widget: PlannerWidgetInstance;
  viewMode?: ViewMode;
}

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function CalendarMonthWidget({ widget, viewMode = "local" }: CalendarMonthWidgetProps) {
  const classes = getViewModeClasses(viewMode);

  // Generate a sample month grid (5 weeks)
  const generateDays = () => {
    const days = [];
    let dayNum = 1;
    for (let week = 0; week < 5; week++) {
      for (let day = 0; day < 7; day++) {
        if (week === 0 && day < 3) {
          days.push(null); // Empty cells at start
        } else if (dayNum <= 31) {
          days.push(dayNum++);
        } else {
          days.push(null);
        }
      }
    }
    return days;
  };

  const days = generateDays();

  return (
    <div className={`h-full flex flex-col p-2 ${classes.containerBg}`}>
      <div className="flex items-center gap-1 mb-1">
        <Calendar className={`h-3 w-3 ${classes.muted}`} />
        <span className={`text-xs font-medium ${classes.heading}`}>Month View</span>
      </div>
      <div className={`grid grid-cols-7 gap-0.5 text-[7px] ${classes.text}`}>
        {DAYS.map((day, i) => (
          <span key={i} className={`text-center font-medium ${classes.muted}`}>
            {day}
          </span>
        ))}
        {days.slice(0, 35).map((day, i) => (
          <span key={i} className="text-center aspect-square flex items-center justify-center">
            {day || ""}
          </span>
        ))}
      </div>
    </div>
  );
}
