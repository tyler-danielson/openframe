import { CheckSquare } from "lucide-react";
import type { PlannerWidgetInstance } from "@openframe/shared";
import { type ViewMode, getViewModeClasses } from "../TemplateGallery";

interface TasksWidgetProps {
  widget: PlannerWidgetInstance;
  viewMode?: ViewMode;
}

export function TasksWidget({ widget, viewMode = "local" }: TasksWidgetProps) {
  const { config } = widget;
  const maxItems = (config.maxItems as number) || 10;
  const title = (config.title as string) || "Tasks";
  const classes = getViewModeClasses(viewMode);

  const sampleTasks = ["Review documents", "Send email", "Meeting prep", "Call client", "Update report"];
  const previewCount = Math.min(4, maxItems);

  return (
    <div className={`h-full flex flex-col p-2 ${classes.containerBg}`}>
      <div className="flex items-center gap-1 mb-1">
        <CheckSquare className={`h-3 w-3 ${classes.muted}`} />
        <span className={`text-xs font-medium ${classes.heading}`}>{title}</span>
      </div>
      <div className="flex-1 space-y-1 overflow-hidden">
        {sampleTasks.slice(0, previewCount).map((task, i) => (
          <div key={i} className={`flex items-center gap-1 text-[10px] ${classes.text}`}>
            <div className={`w-2 h-2 border rounded-sm shrink-0 ${classes.checkboxBorder}`} />
            <span className="truncate">{task}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
