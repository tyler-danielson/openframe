import { Type } from "lucide-react";
import type { PlannerWidgetInstance } from "@openframe/shared";
import { type ViewMode, getViewModeClasses } from "../TemplateGallery";

interface TextWidgetProps {
  widget: PlannerWidgetInstance;
  viewMode?: ViewMode;
}

export function TextWidget({ widget, viewMode = "local" }: TextWidgetProps) {
  const { config } = widget;
  const text = (config.text as string) || "Text";
  const fontSize = (config.fontSize as string) || "base";
  const align = (config.align as string) || "left";
  const classes = getViewModeClasses(viewMode);

  // Parse dynamic date placeholders
  const parseText = (input: string): string => {
    const now = new Date();
    return input.replace(/\{\{date:([^}]+)\}\}/g, (_, format) => {
      try {
        return new Intl.DateTimeFormat("en-US", {
          weekday: format.includes("dddd") ? "long" : undefined,
          month: format.includes("MMMM") ? "long" : format.includes("MMM") ? "short" : undefined,
          day: format.includes("d") ? "numeric" : undefined,
          year: format.includes("yyyy") ? "numeric" : undefined,
        }).format(now);
      } catch {
        return format;
      }
    });
  };

  const displayText = parseText(text);

  const fontSizeClasses: Record<string, string> = {
    xs: "text-xs",
    sm: "text-sm",
    base: "text-base",
    lg: "text-lg",
    xl: "text-xl",
    "2xl": "text-2xl",
  };

  const alignClasses: Record<string, string> = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  return (
    <div className={`h-full flex items-center p-2 ${classes.containerBg} ${alignClasses[align] || ""}`}>
      <span className={`font-medium w-full ${fontSizeClasses[fontSize] || "text-base"} ${classes.heading}`}>
        {displayText || (
          <span className={`flex items-center gap-1 ${classes.muted}`}>
            <Type className="h-3 w-3" />
            Text
          </span>
        )}
      </span>
    </div>
  );
}
