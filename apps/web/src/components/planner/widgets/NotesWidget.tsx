import { StickyNote } from "lucide-react";
import type { PlannerWidgetInstance } from "@openframe/shared";
import { type ViewMode, getViewModeClasses } from "../TemplateGallery";

interface NotesWidgetProps {
  widget: PlannerWidgetInstance;
  viewMode?: ViewMode;
}

export function NotesWidget({ widget, viewMode = "local" }: NotesWidgetProps) {
  const { config } = widget;
  const title = (config.title as string) || "Notes";
  const lineStyle = (config.lineStyle as string) || "ruled";
  const classes = getViewModeClasses(viewMode);
  const isPdf = viewMode === "pdf";

  const lineCount = 5;

  // Line colors for PDF vs local mode
  const lineColor = isPdf ? "#9ca3af" : "currentColor";
  const gridColor = isPdf ? "#d1d5db" : "#e5e7eb";

  return (
    <div className={`h-full flex flex-col p-2 ${classes.containerBg}`}>
      <div className="flex items-center gap-1 mb-1">
        <StickyNote className={`h-3 w-3 ${classes.muted}`} />
        <span className={`text-xs font-medium ${classes.heading}`}>{title}</span>
      </div>
      <div className="flex-1 relative">
        {lineStyle === "ruled" && (
          <div className="absolute inset-0 flex flex-col justify-evenly">
            {Array.from({ length: lineCount }).map((_, i) => (
              <div key={i} className={`border-b ${classes.line}`} />
            ))}
          </div>
        )}
        {lineStyle === "dotted" && (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle, ${lineColor} 1px, transparent 1px)`,
              backgroundSize: "8px 8px",
            }}
          />
        )}
        {lineStyle === "grid" && (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `
                linear-gradient(to right, ${gridColor} 1px, transparent 1px),
                linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)
              `,
              backgroundSize: "10px 10px",
            }}
          />
        )}
      </div>
    </div>
  );
}
