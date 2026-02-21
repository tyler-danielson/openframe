import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { PlannerWidgetType } from "@openframe/shared";
import {
  PLANNER_WIDGET_REGISTRY,
  PLANNER_WIDGET_CATEGORIES,
  getPlannerWidgetsByCategory,
} from "../../lib/planner/widget-registry";
import { useModuleStore } from "../../stores/modules";
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

interface AddWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWidget: (type: PlannerWidgetType) => void;
}

export function AddWidgetModal({ isOpen, onClose, onSelectWidget }: AddWidgetModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const isModuleEnabled = useModuleStore((s) => s.isEnabled);

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
    return Icon ? <Icon className="h-5 w-5" /> : null;
  };

  const getCategoryEmoji = (categoryId: string) => {
    switch (categoryId) {
      case "calendar": return "";
      case "content": return "";
      case "tracking": return "";
      case "layout": return "";
      default: return "";
    }
  };

  const handleSelectWidget = (type: PlannerWidgetType) => {
    onSelectWidget(type);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-card border border-border rounded-lg shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary/5">
          <h2 className="font-semibold text-primary">Add Widget</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-primary/10 rounded transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground hover:text-primary" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-auto p-4 space-y-5">
          {PLANNER_WIDGET_CATEGORIES.map((category) => {
            const widgetTypes = getPlannerWidgetsByCategory(category.id, isModuleEnabled);
            if (widgetTypes.length === 0) return null;

            return (
              <div key={category.id}>
                {/* Category header */}
                <div className="flex items-center gap-2 mb-2.5 text-xs font-semibold text-primary/80 uppercase tracking-wider">
                  <span className="text-primary">{getIcon(category.icon)}</span>
                  <span>{getCategoryEmoji(category.id)} {category.name}</span>
                </div>

                {/* Widget grid */}
                <div className="grid grid-cols-3 gap-2">
                  {widgetTypes.map((type) => {
                    const def = PLANNER_WIDGET_REGISTRY[type];
                    return (
                      <button
                        key={type}
                        onClick={() => handleSelectWidget(type)}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-center"
                      >
                        <div className="p-2 rounded-md bg-primary/10">
                          <span className="text-primary"><def.icon className="h-5 w-5" /></span>
                        </div>
                        <span className="text-xs font-medium leading-tight text-foreground">
                          {def.name}
                        </span>
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
  );
}
