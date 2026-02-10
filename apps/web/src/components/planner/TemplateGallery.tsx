import { useState } from "react";
import { X, Check, Eye, ArrowLeft, Monitor, FileText } from "lucide-react";
import { Button } from "../ui/Button";
import { PLANNER_TEMPLATES } from "../../lib/planner/templates";
import { PLANNER_WIDGET_REGISTRY } from "../../lib/planner/widget-registry";
import type { PlannerLayoutConfig, PlannerWidgetInstance } from "@openframe/shared";
import { CalendarDayWidget } from "./widgets/CalendarDayWidget";
import { CalendarWeekWidget } from "./widgets/CalendarWeekWidget";
import { CalendarMonthWidget } from "./widgets/CalendarMonthWidget";
import { TasksWidget } from "./widgets/TasksWidget";
import { NewsHeadlinesWidget } from "./widgets/NewsHeadlinesWidget";
import { WeatherWidget } from "./widgets/WeatherWidget";
import { NotesWidget } from "./widgets/NotesWidget";
import { TextWidget } from "./widgets/TextWidget";
import { DividerWidget } from "./widgets/DividerWidget";
import { HabitsWidget } from "./widgets/HabitsWidget";

interface TemplateGalleryProps {
  onSelect: (config: PlannerLayoutConfig) => void;
  onClose: () => void;
}

export type ViewMode = "local" | "pdf";

// Helper to get view mode-aware classes
export function getViewModeClasses(viewMode: ViewMode) {
  const isPdf = viewMode === "pdf";
  return {
    container: isPdf ? "bg-white text-gray-900" : "bg-card text-card-foreground",
    containerBg: isPdf ? "bg-white" : "bg-card",
    border: isPdf ? "border-gray-300" : "border-border",
    muted: isPdf ? "text-gray-500" : "text-muted-foreground",
    heading: isPdf ? "text-black" : "text-foreground",
    line: isPdf ? "border-gray-400" : "border-muted-foreground/30",
    text: isPdf ? "text-gray-900" : "text-foreground",
    checkboxBorder: isPdf ? "border-gray-600" : "border-muted-foreground",
  };
}

export function TemplateGallery({ onSelect, onClose }: TemplateGalleryProps) {
  const templates = Object.entries(PLANNER_TEMPLATES);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("local");

  const previewTemplate = previewKey ? PLANNER_TEMPLATES[previewKey as keyof typeof PLANNER_TEMPLATES] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-card border border-border rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            {previewKey && (
              <Button variant="ghost" size="sm" onClick={() => setPreviewKey(null)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div>
              <h2 className="text-lg font-semibold">
                {previewKey ? previewTemplate?.name : "Choose a Template"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {previewKey
                  ? previewTemplate?.description
                  : "Select a template to load into the builder. This will replace your current layout."}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        {previewKey && previewTemplate ? (
          /* Preview mode */
          <div className="flex-1 overflow-auto p-6">
            <div className="flex gap-6">
              {/* Large preview */}
              <div className="flex-1 flex flex-col">
                {/* View mode toggle */}
                <div className="flex items-center gap-1 mb-3 p-1 bg-muted rounded-lg w-fit">
                  <button
                    onClick={() => setViewMode("local")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      viewMode === "local"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Monitor className="h-4 w-4" />
                    Local
                  </button>
                  <button
                    onClick={() => setViewMode("pdf")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      viewMode === "pdf"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <FileText className="h-4 w-4" />
                    Export/PDF
                  </button>
                </div>

                {/* Preview container */}
                <div
                  className={`aspect-[3/4] border rounded-lg overflow-hidden shadow-md ${
                    viewMode === "pdf" ? "bg-gray-100 border-gray-300" : "bg-white border-border"
                  }`}
                >
                  <TemplatePreviewLarge config={previewTemplate.config} viewMode={viewMode} />
                </div>

                {viewMode === "pdf" && (
                  <p className="text-xs text-muted-foreground mt-2">
                    PDF preview shows grayscale output optimized for e-ink displays
                  </p>
                )}
              </div>

              {/* Widget list */}
              <div className="w-64 shrink-0">
                <h3 className="font-medium mb-3">Widgets in this template</h3>
                <div className="space-y-2">
                  {previewTemplate.config.widgets.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">
                      No widgets - blank canvas
                    </p>
                  ) : (
                    previewTemplate.config.widgets.map((widget, index) => {
                      const definition = PLANNER_WIDGET_REGISTRY[widget.type];
                      return (
                        <div
                          key={index}
                          className="flex items-center gap-2 p-2 rounded-md bg-muted/50"
                        >
                          <div
                            className="w-6 h-6 rounded flex items-center justify-center"
                            style={{ backgroundColor: getWidgetColor(widget.type) }}
                          >
                            {definition && <definition.icon className="h-3 w-3 text-muted-foreground" />}
                          </div>
                          <span className="text-sm">{definition?.name || widget.type}</span>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2">
                    Grid: {previewTemplate.config.gridColumns} × {previewTemplate.config.gridRows}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Page: {previewTemplate.config.pageSize} {previewTemplate.config.orientation}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Template grid */
          <div className="flex-1 overflow-auto p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {templates.map(([key, template]) => (
                <div
                  key={key}
                  className="group relative flex flex-col items-center p-4 rounded-lg border-2 border-border hover:border-primary transition-colors text-left"
                >
                  {/* Preview thumbnail */}
                  <div className="w-full aspect-[3/4] bg-muted rounded-md mb-3 overflow-hidden">
                    <TemplatePreview config={template.config} />
                  </div>

                  {/* Template info */}
                  <div className="w-full">
                    <h3 className="font-medium text-sm">{template.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {template.description}
                    </p>
                  </div>

                  {/* Hover overlay with two buttons */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                    <button
                      onClick={() => setPreviewKey(key)}
                      className="bg-white text-gray-900 px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1 hover:bg-gray-100 transition-colors"
                    >
                      <Eye className="h-4 w-4" />
                      Preview
                    </button>
                    <button
                      onClick={() => onSelect(template.config)}
                      className="bg-primary text-primary-foreground px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1 hover:bg-primary/90 transition-colors"
                    >
                      <Check className="h-4 w-4" />
                      Use
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          {previewKey ? (
            <>
              <Button variant="outline" onClick={() => setPreviewKey(null)}>
                Back
              </Button>
              <Button onClick={() => onSelect(previewTemplate!.config)}>
                <Check className="h-4 w-4 mr-2" />
                Use This Template
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Mini preview of template layout (for grid) - shows rendered widgets (always local mode)
function TemplatePreview({ config }: { config: PlannerLayoutConfig }) {
  const { gridColumns, gridRows, widgets } = config;

  return (
    <div className="relative w-full h-full bg-card">
      {/* Widgets */}
      {widgets.map((widget, index) => (
        <div
          key={index}
          className="absolute overflow-hidden"
          style={{
            left: `${(widget.x / gridColumns) * 100}%`,
            top: `${(widget.y / gridRows) * 100}%`,
            width: `${(widget.width / gridColumns) * 100}%`,
            height: `${(widget.height / gridRows) * 100}%`,
          }}
        >
          <WidgetRenderer widget={widget} viewMode="local" />
        </div>
      ))}

      {/* Empty state */}
      {widgets.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs text-muted-foreground">Blank</span>
        </div>
      )}
    </div>
  );
}

// Render widget component based on type
function WidgetRenderer({ widget, viewMode = "local" }: { widget: PlannerWidgetInstance; viewMode?: ViewMode }) {
  const props = { widget, viewMode };

  switch (widget.type) {
    case "calendar-day":
      return <CalendarDayWidget {...props} />;
    case "calendar-week":
      return <CalendarWeekWidget {...props} />;
    case "calendar-month":
      return <CalendarMonthWidget {...props} />;
    case "tasks":
      return <TasksWidget {...props} />;
    case "news-headlines":
      return <NewsHeadlinesWidget {...props} />;
    case "weather":
      return <WeatherWidget {...props} />;
    case "notes":
      return <NotesWidget {...props} />;
    case "text":
      return <TextWidget {...props} />;
    case "divider":
      return <DividerWidget {...props} />;
    case "habits":
      return <HabitsWidget {...props} />;
    default:
      return (
        <div className={`h-full flex items-center justify-center text-xs ${viewMode === "pdf" ? "text-gray-500" : "text-muted-foreground"}`}>
          {widget.type}
        </div>
      );
  }
}

// Larger preview with rendered widgets
function TemplatePreviewLarge({ config, viewMode = "local" }: { config: PlannerLayoutConfig; viewMode?: ViewMode }) {
  const { gridColumns, gridRows, widgets } = config;
  const isPdf = viewMode === "pdf";

  return (
    <div className={`relative w-full h-full ${isPdf ? "bg-white" : "bg-card"}`}>
      {/* Widgets */}
      {widgets.map((widget, index) => (
        <div
          key={index}
          className={`absolute overflow-hidden rounded-sm ${
            isPdf ? "border border-gray-300" : "border border-border"
          }`}
          style={{
            left: `${(widget.x / gridColumns) * 100}%`,
            top: `${(widget.y / gridRows) * 100}%`,
            width: `${(widget.width / gridColumns) * 100}%`,
            height: `${(widget.height / gridRows) * 100}%`,
          }}
        >
          <WidgetRenderer widget={widget} viewMode={viewMode} />
        </div>
      ))}

      {/* Empty state */}
      {widgets.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={isPdf ? "text-gray-500" : "text-muted-foreground"}>Blank Canvas</span>
        </div>
      )}
    </div>
  );
}

// Get preview color for widget type
function getWidgetColor(type: string): string {
  const colors: Record<string, string> = {
    "calendar-day": "#dbeafe",
    "calendar-week": "#dbeafe",
    "calendar-month": "#dbeafe",
    tasks: "#dcfce7",
    "news-headlines": "#fef3c7",
    weather: "#e0e7ff",
    notes: "#f3f4f6",
    text: "#f9fafb",
    divider: "#e5e7eb",
    habits: "#fce7f3",
  };
  return colors[type] || "#f3f4f6";
}
