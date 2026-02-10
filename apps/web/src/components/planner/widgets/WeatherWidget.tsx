import { Cloud, Sun, CloudRain } from "lucide-react";
import type { PlannerWidgetInstance } from "@openframe/shared";
import { type ViewMode, getViewModeClasses } from "../TemplateGallery";

interface WeatherWidgetProps {
  widget: PlannerWidgetInstance;
  viewMode?: ViewMode;
}

export function WeatherWidget({ widget, viewMode = "local" }: WeatherWidgetProps) {
  const classes = getViewModeClasses(viewMode);
  const isPdf = viewMode === "pdf";

  return (
    <div className={`h-full flex items-center gap-2 p-2 ${classes.containerBg}`}>
      <Sun className={`h-6 w-6 shrink-0 ${isPdf ? "text-gray-600" : "text-yellow-500"}`} />
      <div className="min-w-0">
        <div className={`text-sm font-medium ${classes.heading}`}>72°F</div>
        <div className={`text-[10px] ${classes.muted}`}>Sunny</div>
      </div>
    </div>
  );
}
