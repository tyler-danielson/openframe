import { PLANNER_WIDGET_REGISTRY, PLANNER_WIDGET_CATEGORIES } from "../../lib/planner/widget-registry";
import type { PlannerWidgetInstance } from "@openframe/shared";

interface PlannerWidgetPaletteProps {
  onAddWidget: (
    type: PlannerWidgetInstance["type"],
    defaultSize: { width: number; height: number },
    defaultConfig: Record<string, unknown>
  ) => void;
}

export function PlannerWidgetPalette({ onAddWidget }: PlannerWidgetPaletteProps) {
  const handleAddWidget = (widgetType: PlannerWidgetInstance["type"]) => {
    const definition = PLANNER_WIDGET_REGISTRY[widgetType];
    if (!definition) return;

    onAddWidget(widgetType, definition.defaultSize, definition.defaultConfig);
  };

  return (
    <div className="w-56 border-r border-border bg-card p-4 overflow-auto">
      <h3 className="font-medium mb-4">Widgets</h3>

      <div className="space-y-6">
        {PLANNER_WIDGET_CATEGORIES.map((category) => {
          const categoryWidgets = Object.entries(PLANNER_WIDGET_REGISTRY).filter(
            ([_, def]) => def.category === category.id
          );

          if (categoryWidgets.length === 0) return null;

          return (
            <div key={category.id}>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                {category.name}
              </h4>
              <div className="space-y-1">
                {categoryWidgets.map(([type, definition]) => (
                  <button
                    key={type}
                    onClick={() => handleAddWidget(type as PlannerWidgetInstance["type"])}
                    className="w-full flex items-center gap-3 p-2 rounded-md text-left hover:bg-muted transition-colors"
                  >
                    <div
                      className="w-8 h-8 rounded flex items-center justify-center"
                      style={{ backgroundColor: definition.previewColor }}
                    >
                      <definition.icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium block">{definition.name}</span>
                      <span className="text-xs text-muted-foreground truncate block">
                        {definition.description}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Help text */}
      <div className="mt-6 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">
          Click a widget to add it to the canvas. Drag to reposition, and use the handles to resize.
        </p>
      </div>
    </div>
  );
}
