import { useRef, useState, useCallback, useMemo } from "react";
import { Trash2, GripVertical } from "lucide-react";
import type { PlannerLayoutConfig, PlannerWidgetInstance } from "@openframe/shared";
import { PLANNER_WIDGET_REGISTRY } from "../../lib/planner/widget-registry";
import { getPresetById } from "../../lib/planner/device-presets";

interface PlannerCanvasProps {
  layoutConfig: PlannerLayoutConfig;
  selectedWidgetId: string | null;
  onSelectWidget: (id: string | null) => void;
  onUpdateWidget: (id: string, updates: Partial<PlannerWidgetInstance>) => void;
  onDeleteWidget: (id: string) => void;
  onUpdateLayout: (updates: Partial<PlannerLayoutConfig>) => void;
}

const MAX_CANVAS_HEIGHT = 700; // Maximum canvas height in pixels
const GAP = 4; // gap between cells

export function PlannerCanvas({
  layoutConfig,
  selectedWidgetId,
  onSelectWidget,
  onUpdateWidget,
  onDeleteWidget,
}: PlannerCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{
    widgetId: string;
    startX: number;
    startY: number;
    originalX: number;
    originalY: number;
  } | null>(null);
  const [resizing, setResizing] = useState<{
    widgetId: string;
    startX: number;
    startY: number;
    originalWidth: number;
    originalHeight: number;
    handle: "se" | "e" | "s";
  } | null>(null);

  const { gridColumns, gridRows, widgets, pageSize, orientation } = layoutConfig;

  // Calculate canvas dimensions based on device preset and orientation
  const { canvasWidth, canvasHeight, cellWidth, cellHeight } = useMemo(() => {
    const preset = getPresetById(pageSize);

    // Get device dimensions, swapping for landscape orientation
    let deviceWidth = preset?.widthPx ?? 1404;
    let deviceHeight = preset?.heightPx ?? 1872;

    if (orientation === "landscape") {
      [deviceWidth, deviceHeight] = [deviceHeight, deviceWidth];
    }

    // Calculate aspect ratio
    const aspectRatio = deviceWidth / deviceHeight;

    // Calculate canvas size maintaining aspect ratio
    // Use max height and derive width from aspect ratio
    const height = MAX_CANVAS_HEIGHT;
    const width = Math.round(height * aspectRatio);

    // Calculate cell sizes based on canvas dimensions and grid
    const cellW = (width - GAP * (gridColumns - 1)) / gridColumns;
    const cellH = (height - GAP * (gridRows - 1)) / gridRows;

    return {
      canvasWidth: width,
      canvasHeight: height,
      cellWidth: cellW,
      cellHeight: cellH,
    };
  }, [pageSize, orientation, gridColumns, gridRows]);

  // Convert grid position to pixel position
  const gridToPixelX = useCallback((gridPos: number) => gridPos * (cellWidth + GAP), [cellWidth]);
  const gridToPixelY = useCallback((gridPos: number) => gridPos * (cellHeight + GAP), [cellHeight]);

  // Convert pixel position to grid position
  const pixelToGridX = useCallback((pixelPos: number) => Math.round(pixelPos / (cellWidth + GAP)), [cellWidth]);
  const pixelToGridY = useCallback((pixelPos: number) => Math.round(pixelPos / (cellHeight + GAP)), [cellHeight]);

  // Handle mouse move for dragging
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragging) {
        const deltaX = e.clientX - dragging.startX;
        const deltaY = e.clientY - dragging.startY;
        const newX = Math.max(0, Math.min(gridColumns - 1, dragging.originalX + pixelToGridX(deltaX)));
        const newY = Math.max(0, Math.min(gridRows - 1, dragging.originalY + pixelToGridY(deltaY)));

        const widget = widgets.find((w) => w.id === dragging.widgetId);
        if (widget && (widget.x !== newX || widget.y !== newY)) {
          // Clamp to canvas bounds
          const clampedX = Math.min(newX, gridColumns - widget.width);
          const clampedY = Math.min(newY, gridRows - widget.height);
          onUpdateWidget(dragging.widgetId, { x: Math.max(0, clampedX), y: Math.max(0, clampedY) });
        }
      }

      if (resizing) {
        const deltaX = e.clientX - resizing.startX;
        const deltaY = e.clientY - resizing.startY;
        const widget = widgets.find((w) => w.id === resizing.widgetId);
        if (!widget) return;

        let newWidth = resizing.originalWidth;
        let newHeight = resizing.originalHeight;

        if (resizing.handle === "e" || resizing.handle === "se") {
          newWidth = Math.max(1, resizing.originalWidth + pixelToGridX(deltaX));
          newWidth = Math.min(newWidth, gridColumns - widget.x);
        }
        if (resizing.handle === "s" || resizing.handle === "se") {
          newHeight = Math.max(1, resizing.originalHeight + pixelToGridY(deltaY));
          newHeight = Math.min(newHeight, gridRows - widget.y);
        }

        if (widget.width !== newWidth || widget.height !== newHeight) {
          onUpdateWidget(resizing.widgetId, { width: newWidth, height: newHeight });
        }
      }
    },
    [dragging, resizing, widgets, gridColumns, gridRows, onUpdateWidget, pixelToGridX, pixelToGridY]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    setResizing(null);
  }, []);

  // Handle drag start
  const handleDragStart = (e: React.MouseEvent, widgetId: string) => {
    e.stopPropagation();
    const widget = widgets.find((w) => w.id === widgetId);
    if (!widget) return;

    setDragging({
      widgetId,
      startX: e.clientX,
      startY: e.clientY,
      originalX: widget.x,
      originalY: widget.y,
    });
    onSelectWidget(widgetId);
  };

  // Handle resize start
  const handleResizeStart = (
    e: React.MouseEvent,
    widgetId: string,
    handle: "se" | "e" | "s"
  ) => {
    e.stopPropagation();
    const widget = widgets.find((w) => w.id === widgetId);
    if (!widget) return;

    setResizing({
      widgetId,
      startX: e.clientX,
      startY: e.clientY,
      originalWidth: widget.width,
      originalHeight: widget.height,
      handle,
    });
  };

  // Click on canvas background to deselect
  const handleCanvasClick = () => {
    onSelectWidget(null);
  };

  // Get preset name for display
  const preset = getPresetById(pageSize);
  const presetName = preset?.name ?? pageSize;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Canvas info */}
      <div className="text-sm text-muted-foreground">
        {gridColumns} × {gridRows} grid • {presetName} ({orientation})
      </div>

      {/* Canvas container */}
      <div
        ref={canvasRef}
        className="relative bg-white border-2 border-border rounded-lg shadow-lg"
        style={{
          width: canvasWidth + 32,
          height: canvasHeight + 32,
          padding: 16,
        }}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Grid lines */}
        <div
          className="absolute inset-4 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(to right, #e5e7eb 1px, transparent 1px),
              linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
            `,
            backgroundSize: `${cellWidth + GAP}px ${cellHeight + GAP}px`,
          }}
        />

        {/* Widgets */}
        {widgets.map((widget) => {
          const isSelected = widget.id === selectedWidgetId;
          const definition = PLANNER_WIDGET_REGISTRY[widget.type];

          return (
            <div
              key={widget.id}
              className={`absolute rounded-md border-2 transition-shadow cursor-move select-none ${
                isSelected
                  ? "border-primary ring-2 ring-primary/20 shadow-lg z-10"
                  : "border-border hover:border-primary/50"
              }`}
              style={{
                left: 16 + gridToPixelX(widget.x),
                top: 16 + gridToPixelY(widget.y),
                width: widget.width * (cellWidth + GAP) - GAP,
                height: widget.height * (cellHeight + GAP) - GAP,
                backgroundColor: definition?.previewColor || "#f3f4f6",
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectWidget(widget.id);
              }}
            >
              {/* Drag handle */}
              <div
                className="absolute top-1 left-1 p-1 rounded bg-white/80 cursor-grab active:cursor-grabbing select-none"
                onMouseDown={(e) => handleDragStart(e, widget.id)}
              >
                <GripVertical className="h-3 w-3 text-muted-foreground" />
              </div>

              {/* Widget content preview */}
              <div className="flex flex-col items-center justify-center h-full p-2">
                {definition && (
                  <>
                    <definition.icon className="h-6 w-6 text-muted-foreground mb-1" />
                    <span className="text-xs font-medium text-muted-foreground text-center">
                      {definition.name}
                    </span>
                  </>
                )}
              </div>

              {/* Delete button (when selected) */}
              {isSelected && (
                <button
                  className="absolute -top-2 -right-2 p-1 rounded-full bg-destructive text-destructive-foreground shadow-md hover:bg-destructive/90"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteWidget(widget.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}

              {/* Resize handles (when selected) */}
              {isSelected && (
                <>
                  {/* Right edge */}
                  <div
                    className="absolute top-1/2 -right-1 w-2 h-8 -translate-y-1/2 cursor-ew-resize bg-primary rounded select-none"
                    onMouseDown={(e) => handleResizeStart(e, widget.id, "e")}
                  />
                  {/* Bottom edge */}
                  <div
                    className="absolute -bottom-1 left-1/2 w-8 h-2 -translate-x-1/2 cursor-ns-resize bg-primary rounded select-none"
                    onMouseDown={(e) => handleResizeStart(e, widget.id, "s")}
                  />
                  {/* Bottom-right corner */}
                  <div
                    className="absolute -bottom-1 -right-1 w-3 h-3 cursor-nwse-resize bg-primary rounded select-none"
                    onMouseDown={(e) => handleResizeStart(e, widget.id, "se")}
                  />
                </>
              )}
            </div>
          );
        })}

        {/* Empty state */}
        {widgets.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-muted-foreground text-center">
              Drag widgets from the palette
              <br />
              or load a template to get started
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
