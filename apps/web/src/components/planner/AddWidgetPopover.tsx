import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { PlannerWidgetType } from "@openframe/shared";
import { Button } from "../ui/Button";
import {
  PLANNER_WIDGET_REGISTRY,
  PLANNER_WIDGET_CATEGORIES,
  getPlannerWidgetsByCategory,
} from "../../lib/planner/widget-registry";
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  CheckSquare,
  Newspaper,
  CloudSun,
  FileText,
  Type,
  Minus,
  Grid3X3,
  Layout,
  Target,
} from "lucide-react";

interface AddWidgetPopoverProps {
  onAddWidget: (
    type: PlannerWidgetType,
    defaultSize: { width: number; height: number },
    defaultConfig: Record<string, unknown>
  ) => void;
}

export function AddWidgetPopover({ onAddWidget }: AddWidgetPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleAddWidget = (type: PlannerWidgetType) => {
    const definition = PLANNER_WIDGET_REGISTRY[type];
    onAddWidget(type, definition.defaultSize, definition.defaultConfig);
    setIsOpen(false);
  };

  // Map icon names to components
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    Calendar,
    CalendarDays,
    CalendarRange,
    CheckSquare,
    Newspaper,
    CloudSun,
    FileText,
    Type,
    Minus,
    Grid3X3,
    Layout,
    Target,
  };

  const getIcon = (iconName: string) => {
    const Icon = iconMap[iconName];
    return Icon ? <Icon className="h-4 w-4" /> : null;
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="gap-1"
      >
        <Plus className="h-4 w-4" />
        Add Widget
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Popover */}
          <div className="absolute top-full left-0 mt-2 z-50 w-80 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="font-medium text-sm">Add Widget</span>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-muted rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-auto p-2">
              {PLANNER_WIDGET_CATEGORIES.map((category) => {
                const widgetTypes = getPlannerWidgetsByCategory(category.id);
                if (widgetTypes.length === 0) return null;

                return (
                  <div key={category.id} className="mb-3 last:mb-0">
                    <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {getIcon(category.icon)}
                      {category.name}
                    </div>
                    <div className="grid grid-cols-2 gap-1 mt-1">
                      {widgetTypes.map((type) => {
                        const def = PLANNER_WIDGET_REGISTRY[type];
                        return (
                          <button
                            key={type}
                            onClick={() => handleAddWidget(type)}
                            className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted text-left transition-colors"
                          >
                            <def.icon className="h-4 w-4" />
                            <span className="truncate">{def.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
