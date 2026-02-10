import type { PlannerWidgetInstance } from "@openframe/shared";
import { type ViewMode, getViewModeClasses } from "../TemplateGallery";

interface DividerWidgetProps {
  widget: PlannerWidgetInstance;
  viewMode?: ViewMode;
}

export function DividerWidget({ widget, viewMode = "local" }: DividerWidgetProps) {
  const { config } = widget;
  const style = (config.style as string) || "solid";
  const orientation = (config.orientation as string) || "horizontal";
  const thickness = (config.thickness as number) || 1;
  const classes = getViewModeClasses(viewMode);

  const styleClasses: Record<string, string> = {
    solid: "border-solid",
    dashed: "border-dashed",
    dotted: "border-dotted",
  };

  if (orientation === "vertical") {
    return (
      <div className={`h-full flex items-center justify-center p-1 ${classes.containerBg}`}>
        <div
          className={`h-full ${styleClasses[style] || "border-solid"} border-l ${classes.border}`}
          style={{ borderLeftWidth: thickness }}
        />
      </div>
    );
  }

  return (
    <div className={`h-full flex items-center p-1 ${classes.containerBg}`}>
      <div
        className={`w-full ${styleClasses[style] || "border-solid"} border-t ${classes.border}`}
        style={{ borderTopWidth: thickness }}
      />
    </div>
  );
}
