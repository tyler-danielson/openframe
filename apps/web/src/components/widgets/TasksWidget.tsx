import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { api } from "../../services/api";
import type { WidgetStyle, FontSizePreset } from "../../stores/screensaver";
import { getFontSizeConfig } from "../../lib/font-size";
import type { Task } from "@openframe/shared";
import { cn } from "../../lib/utils";

interface TasksWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
}

const FONT_SIZE_CLASSES: Record<Exclude<FontSizePreset, "custom">, { title: string; item: string; label: string }> = {
  xs: { title: "text-[10px]", item: "text-[10px]", label: "text-[8px]" },
  sm: { title: "text-xs", item: "text-xs", label: "text-[10px]" },
  md: { title: "text-sm", item: "text-sm", label: "text-xs" },
  lg: { title: "text-base", item: "text-base", label: "text-sm" },
  xl: { title: "text-lg", item: "text-lg", label: "text-base" },
};

// Scale factors for custom font sizes
const CUSTOM_SCALE = {
  title: 1,
  item: 1,
  label: 0.75,
};

export function TasksWidget({ config, style, isBuilder }: TasksWidgetProps) {
  const maxItems = config.maxItems as number ?? 5;
  const showDueDate = config.showDueDate as boolean ?? true;
  const showOverdue = config.showOverdue as boolean ?? true;
  const headerMode = config.headerMode as string ?? "default";
  const customHeader = config.customHeader as string ?? "";

  // Determine header text based on mode
  const getHeaderText = () => {
    if (headerMode === "hidden") return null;
    if (headerMode === "custom") return customHeader || null;
    return "Tasks Due Today";
  };
  const headerText = getHeaderText();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["widget-tasks"],
    queryFn: () => api.getTasks({ status: "needsAction" }),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    enabled: !isBuilder,
  });

  const upcomingTasks = useMemo(() => {
    const now = new Date();
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    let filtered = tasks;
    if (!showOverdue) {
      filtered = tasks.filter((task: Task) => {
        if (!task.dueDate) return true;
        return new Date(task.dueDate) >= now;
      });
    }

    return filtered
      .filter((task: Task) => {
        if (!task.dueDate) return false;
        return new Date(task.dueDate) <= endOfToday;
      })
      .sort((a: Task, b: Task) => {
        const aDate = new Date(a.dueDate!);
        const bDate = new Date(b.dueDate!);
        return aDate.getTime() - bDate.getTime();
      })
      .slice(0, maxItems);
  }, [tasks, maxItems, showOverdue]);

  const { preset, isCustom, customValue } = getFontSizeConfig(style);
  const sizeClasses = isCustom ? null : FONT_SIZE_CLASSES[preset as Exclude<FontSizePreset, "custom">];

  // Calculate custom font sizes if using custom mode
  const getCustomFontSize = (scale: number) => {
    if (!customValue) return undefined;
    const value = parseFloat(customValue);
    const unit = customValue.replace(/[\d.]/g, "") || "px";
    return `${value * scale}${unit}`;
  };

  // Mock data for builder preview
  const mockTasks = [
    { id: "1", title: "Review pull request", dueDate: "Today" },
    { id: "2", title: "Update documentation", dueDate: "Today" },
    { id: "3", title: "Send weekly report", dueDate: "Overdue" },
  ];

  if (isBuilder) {
    return (
      <div
        className={cn(
          "flex h-full flex-col p-4 rounded-lg",
          "bg-black/40 backdrop-blur-sm"
        )}
        style={{ color: style?.textColor || "#ffffff" }}
      >
        {headerText && (
          <div
            className={cn(sizeClasses?.label, "opacity-50 uppercase tracking-wide mb-3")}
            style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.label) } : undefined}
          >
            {headerText}
          </div>
        )}
        <div className="flex-1 space-y-2 overflow-hidden">
          {mockTasks.slice(0, maxItems).map((task) => (
            <div key={task.id} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
              <span
                className={cn(sizeClasses?.item, "truncate flex-1")}
                style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.item) } : undefined}
              >
                {task.title}
              </span>
              {showDueDate && (
                <span
                  className={cn(
                    sizeClasses?.label,
                    "flex-shrink-0",
                    task.dueDate === "Overdue" ? "text-red-400" : "opacity-60"
                  )}
                  style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.label) } : undefined}
                >
                  {task.dueDate}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className="flex h-full items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <span className="text-sm opacity-50">Loading tasks...</span>
      </div>
    );
  }

  if (upcomingTasks.length === 0) {
    return (
      <div
        className="flex h-full items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <span className="text-sm opacity-50">No tasks due today</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full flex-col p-4 rounded-lg",
        "bg-black/40 backdrop-blur-sm"
      )}
      style={{ color: style?.textColor || "#ffffff" }}
    >
      {headerText && (
        <div
          className={cn(sizeClasses?.label, "opacity-50 uppercase tracking-wide mb-3")}
          style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.label) } : undefined}
        >
          {headerText}
        </div>
      )}
      <div className="flex-1 space-y-2 overflow-hidden">
        {upcomingTasks.map((task: Task) => {
          const now = new Date();
          const dueDate = task.dueDate ? new Date(task.dueDate) : null;
          const isOverdue = dueDate && dueDate < now;

          return (
            <div key={task.id} className="flex items-center gap-2">
              <div
                className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0",
                  isOverdue ? "bg-red-500" : "bg-amber-500"
                )}
              />
              <span
                className={cn(sizeClasses?.item, "truncate flex-1")}
                style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.item) } : undefined}
              >
                {task.title}
              </span>
              {showDueDate && dueDate && (
                <span
                  className={cn(
                    sizeClasses?.label,
                    "flex-shrink-0",
                    isOverdue ? "text-red-400" : "opacity-60"
                  )}
                  style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.label) } : undefined}
                >
                  {isOverdue ? "Overdue" : format(dueDate, "h:mm a")}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
