import { Newspaper } from "lucide-react";
import type { PlannerWidgetInstance } from "@openframe/shared";
import { type ViewMode, getViewModeClasses } from "../TemplateGallery";

interface NewsHeadlinesWidgetProps {
  widget: PlannerWidgetInstance;
  viewMode?: ViewMode;
}

export function NewsHeadlinesWidget({ widget, viewMode = "local" }: NewsHeadlinesWidgetProps) {
  const { config } = widget;
  const maxItems = (config.maxItems as number) || 5;
  const title = (config.title as string) || "Headlines";
  const classes = getViewModeClasses(viewMode);

  const sampleHeadlines = [
    "Breaking: Major tech announcement expected today",
    "Weather update: Snow expected this weekend",
    "Sports: Local team wins championship",
    "Business: Markets reach new highs",
    "Science: New discovery announced",
  ];

  const previewCount = Math.min(3, maxItems);

  return (
    <div className={`h-full flex flex-col p-2 ${classes.containerBg}`}>
      <div className="flex items-center gap-1 mb-1">
        <Newspaper className={`h-3 w-3 ${classes.muted}`} />
        <span className={`text-xs font-medium ${classes.heading}`}>{title}</span>
      </div>
      <div className="flex-1 space-y-1 overflow-hidden">
        {sampleHeadlines.slice(0, previewCount).map((headline, i) => (
          <div key={i} className={`text-[9px] truncate ${classes.muted}`}>
            • {headline}
          </div>
        ))}
      </div>
    </div>
  );
}
