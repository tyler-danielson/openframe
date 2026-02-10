import { useEffect } from "react";
import { X, Printer } from "lucide-react";
import type { PlannerLayoutConfig, LayoutSection, PlannerWidgetInstance } from "@openframe/shared";
import { Button } from "../ui/Button";
import { getPresetById } from "../../lib/planner/device-presets";
import { renderEditableWidget, plannerColors } from "./editable-widgets";

interface PlannerPreviewProps {
  layoutConfig: PlannerLayoutConfig;
  onClose: () => void;
}

// Use shared planner colors
const colors = plannerColors;

export function PlannerPreview({ layoutConfig, onClose }: PlannerPreviewProps) {
  const { widgets, pageSize, orientation, columns } = layoutConfig;

  // Load Google Fonts
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Playfair+Display:wght@600;700;800&family=JetBrains+Mono:wght@400;500&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // Get device preset for dimensions
  const preset = getPresetById(pageSize);
  let deviceWidth = preset?.widthPx ?? 1404;
  let deviceHeight = preset?.heightPx ?? 1872;

  if (orientation === "landscape") {
    [deviceWidth, deviceHeight] = [deviceHeight, deviceWidth];
  }

  // Scale to fit in viewport (matching reference: 702x936 is half of 1404x1872)
  const aspectRatio = deviceWidth / deviceHeight;
  const maxHeight = window.innerHeight * 0.88;
  const maxWidth = window.innerWidth * 0.9;

  let previewHeight = maxHeight;
  let previewWidth = previewHeight * aspectRatio;

  if (previewWidth > maxWidth) {
    previewWidth = maxWidth;
    previewHeight = previewWidth / aspectRatio;
  }

  const handlePrint = () => {
    window.print();
  };

  // Get root section from columns layout
  const rootSection = columns?.sections?.[0] ?? null;

  // Check if we have any widgets assigned in the layout
  const hasAssignedWidgets = rootSection && hasWidgetsInSection(rootSection, widgets);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "#d8d4cd" }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/10 transition-colors print:hidden"
        style={{ color: colors.ink }}
      >
        <X className="h-6 w-6" />
      </button>

      {/* Header with actions */}
      <div className="absolute top-4 left-4 flex items-center gap-4 print:hidden">
        <h2 className="text-lg font-medium" style={{ color: colors.ink, fontFamily: "'DM Sans', sans-serif" }}>
          Preview: {preset?.name ?? pageSize} ({orientation})
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrint}
          style={{
            backgroundColor: colors.paper,
            borderColor: colors.ruleLine,
            color: colors.ink,
          }}
        >
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
      </div>

      {/* Planner frame */}
      <div
        className="relative overflow-hidden print:shadow-none"
        style={{
          width: previewWidth,
          height: previewHeight,
          backgroundColor: plannerColors.paper,
          borderRadius: 4,
          boxShadow: `0 1px 3px rgba(44,42,39,0.06), 0 8px 24px rgba(44,42,39,0.1), inset 0 0 0 1px rgba(44,42,39,0.05)`,
          fontFamily: "'DM Sans', sans-serif",
          color: plannerColors.ink,
        }}
      >
        {/* Render using columns layout */}
        {rootSection ? (
          <PreviewSection section={rootSection} widgets={widgets} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <p style={{ color: colors.inkFaint }} className="text-center">
              No layout defined.<br />
              Create a layout in the editor.
            </p>
          </div>
        )}

        {/* Empty state - no widgets assigned */}
        {rootSection && !hasAssignedWidgets && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/5">
            <p style={{ color: colors.inkFaint }} className="text-center">
              No widgets added yet.<br />
              Add widgets from the palette to build your planner.
            </p>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm print:hidden"
        style={{ color: colors.inkLight }}
      >
        Press ESC to close · Click Print to generate PDF
      </div>
    </div>
  );
}

// Check if section has any widgets assigned
function hasWidgetsInSection(section: LayoutSection, widgets: PlannerWidgetInstance[]): boolean {
  for (const child of section.children) {
    if (child.type === "widget" && child.widgetId) {
      const widget = widgets.find(w => w.id === child.widgetId);
      if (widget) return true;
    }
    if (child.type === "section" && child.section) {
      if (hasWidgetsInSection(child.section, widgets)) return true;
    }
  }
  return false;
}

// Preview section component - renders the flex-based layout
function PreviewSection({ section, widgets }: { section: LayoutSection; widgets: PlannerWidgetInstance[] }) {
  const isHorizontal = section.direction === "horizontal";

  return (
    <div
      className="flex h-full w-full"
      style={{ flexDirection: isHorizontal ? "row" : "column" }}
    >
      {section.children.map((child) => (
        <div
          key={child.id}
          style={{ flex: child.flex, minWidth: 0, minHeight: 0, overflow: "hidden" }}
        >
          {child.type === "widget" ? (
            <PreviewWidgetSlot widgetId={child.widgetId} widgets={widgets} />
          ) : child.section ? (
            <PreviewSection section={child.section} widgets={widgets} />
          ) : null}
        </div>
      ))}
    </div>
  );
}

// Preview widget slot - renders a single widget
function PreviewWidgetSlot({ widgetId, widgets }: { widgetId: string | undefined; widgets: PlannerWidgetInstance[] }) {
  const widget = widgetId ? widgets.find(w => w.id === widgetId) : undefined;

  if (!widget) {
    // Empty slot - render nothing in preview (or subtle placeholder)
    return <div className="h-full w-full" />;
  }

  // Use the same editable widget renderer but without interactivity
  return (
    <div className="h-full w-full">
      {renderEditableWidget(widget, false, () => {}, () => {})}
    </div>
  );
}

