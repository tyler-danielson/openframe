import { useState, useRef, useCallback, useEffect } from "react";
import { Trash2, Pencil } from "lucide-react";
import { cn } from "../../lib/utils";
import { ASPECT_RATIO_PRESETS, type WidgetInstance, type BuilderWidgetType } from "../../stores/screensaver";
import { WIDGET_REGISTRY, getWidgetDefinition } from "../../lib/widgets/registry";
import { WidgetRenderer } from "../widgets/WidgetRenderer";
import { useBuilder } from "../../hooks/useBuilder";

interface BuilderCanvasProps {
  showGrid: boolean;
  previewMode: boolean;
  liveMode?: boolean; // Show live widget data in editor
  onWidgetDoubleClick?: (widgetId: string) => void; // Callback for double-click to edit
}

export function BuilderCanvas({ showGrid, previewMode, liveMode = false, onWidgetDoubleClick }: BuilderCanvasProps) {
  const {
    layoutConfig,
    selectedWidgetId,
    selectWidget,
    addWidget,
    moveWidget,
    resizeWidget,
    removeWidget,
    gridSnap,
  } = useBuilder();

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number } | null>(null);
  const [dragState, setDragState] = useState<{
    type: "move" | "resize" | "new";
    widgetId?: string;
    startX: number;
    startY: number;
    startWidgetX?: number;
    startWidgetY?: number;
    startWidth?: number;
    startHeight?: number;
    resizeHandle?: "se" | "sw" | "ne" | "nw" | "e" | "w" | "n" | "s";
    newWidgetType?: BuilderWidgetType;
  } | null>(null);
  const [dropPreview, setDropPreview] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const { gridColumns = 12, gridRows = 8, gridGap = 8, backgroundColor = "#000000", widgets = [], canvasSizeMode = "fill", aspectRatio = "16:9", canvasWidth = 1920, canvasHeight = 1080 } = layoutConfig;

  // Calculate canvas size based on mode and available container space
  useEffect(() => {
    if (!containerRef.current) return;

    const updateCanvasSize = () => {
      const container = containerRef.current;
      if (!container) return;

      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      if (canvasSizeMode === "fill") {
        // Fill mode: use full container (existing behavior)
        setCanvasSize(null);
        return;
      }

      let targetRatio: number;

      if (canvasSizeMode === "pixels" || (canvasSizeMode === "aspectRatio" && aspectRatio === "custom")) {
        // Use exact pixel dimensions to calculate ratio
        targetRatio = canvasWidth / canvasHeight;
      } else {
        // Use preset aspect ratio
        const preset = ASPECT_RATIO_PRESETS.find(p => p.id === aspectRatio);
        targetRatio = preset?.ratio ?? 16 / 9;
      }

      // Calculate dimensions that fit within container while maintaining aspect ratio
      const containerRatio = containerWidth / containerHeight;
      let width: number;
      let height: number;

      if (targetRatio > containerRatio) {
        // Canvas is wider than container, constrain by width
        width = containerWidth;
        height = containerWidth / targetRatio;
      } else {
        // Canvas is taller than container, constrain by height
        height = containerHeight;
        width = containerHeight * targetRatio;
      }

      setCanvasSize({ width, height });
    };

    updateCanvasSize();

    // Use ResizeObserver to update on container resize
    const resizeObserver = new ResizeObserver(updateCanvasSize);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, [canvasSizeMode, aspectRatio, canvasWidth, canvasHeight, previewMode]);

  // Calculate grid cell dimensions
  const getCellDimensions = useCallback(() => {
    if (!canvasRef.current) return { cellWidth: 0, cellHeight: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const totalGapX = gridGap * (gridColumns - 1);
    const totalGapY = gridGap * (gridRows - 1);
    const cellWidth = (rect.width - totalGapX) / gridColumns;
    const cellHeight = (rect.height - totalGapY) / gridRows;
    return { cellWidth, cellHeight };
  }, [gridColumns, gridRows, gridGap]);

  // Convert pixel position to grid position
  const pixelToGrid = useCallback(
    (pixelX: number, pixelY: number) => {
      const { cellWidth, cellHeight } = getCellDimensions();
      if (cellWidth === 0 || cellHeight === 0) return { x: 0, y: 0 };
      const x = Math.floor(pixelX / (cellWidth + gridGap));
      const y = Math.floor(pixelY / (cellHeight + gridGap));
      return {
        x: Math.max(0, Math.min(gridColumns - 1, x)),
        y: Math.max(0, Math.min(gridRows - 1, y)),
      };
    },
    [getCellDimensions, gridColumns, gridRows, gridGap]
  );

  // Handle drag over for drop zone
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const gridPos = pixelToGrid(x, y);

      // Scale widget size based on current grid density relative to base 16x9 grid
      const baseColumns = 16;
      const baseRows = 9;
      const scaleX = gridColumns / baseColumns;
      const scaleY = gridRows / baseRows;

      const widgetType = e.dataTransfer.types.includes("widgettype")
        ? (e.dataTransfer.getData("widgetType") as BuilderWidgetType)
        : null;

      if (widgetType) {
        const definition = WIDGET_REGISTRY[widgetType];
        const scaledWidth = Math.max(1, Math.round(definition.defaultSize.width * scaleX));
        const scaledHeight = Math.max(1, Math.round(definition.defaultSize.height * scaleY));
        setDropPreview({
          x: gridPos.x,
          y: gridPos.y,
          width: scaledWidth,
          height: scaledHeight,
        });
      } else {
        const defaultWidth = Math.max(1, Math.round(2 * scaleX));
        const defaultHeight = Math.max(1, Math.round(2 * scaleY));
        setDropPreview({
          x: gridPos.x,
          y: gridPos.y,
          width: defaultWidth,
          height: defaultHeight,
        });
      }
    },
    [pixelToGrid, gridColumns, gridRows]
  );

  // Handle drop
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const widgetType = e.dataTransfer.getData("widgetType") as BuilderWidgetType;
      if (!widgetType || !dropPreview) return;

      const definition = WIDGET_REGISTRY[widgetType];

      // Scale widget size based on current grid density relative to base 16x9 grid
      const baseColumns = 16;
      const baseRows = 9;
      const scaleX = gridColumns / baseColumns;
      const scaleY = gridRows / baseRows;

      const scaledWidth = Math.max(1, Math.round(definition.defaultSize.width * scaleX));
      const scaledHeight = Math.max(1, Math.round(definition.defaultSize.height * scaleY));

      addWidget({
        type: widgetType,
        x: Math.min(dropPreview.x, gridColumns - scaledWidth),
        y: Math.min(dropPreview.y, gridRows - scaledHeight),
        width: scaledWidth,
        height: scaledHeight,
        config: { ...definition.defaultConfig },
      });

      setDropPreview(null);
    },
    [addWidget, dropPreview, gridColumns, gridRows]
  );

  // Handle drag leave
  const handleDragLeave = useCallback(() => {
    setDropPreview(null);
  }, []);

  // Handle mouse down on widget for move
  const handleWidgetMouseDown = useCallback(
    (e: React.MouseEvent, widget: WidgetInstance) => {
      if (previewMode) return;
      e.stopPropagation();
      selectWidget(widget.id);

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      setDragState({
        type: "move",
        widgetId: widget.id,
        startX: e.clientX - rect.left,
        startY: e.clientY - rect.top,
        startWidgetX: widget.x,
        startWidgetY: widget.y,
      });
    },
    [previewMode, selectWidget]
  );

  // Handle mouse down on resize handle
  const handleResizeMouseDown = useCallback(
    (
      e: React.MouseEvent,
      widget: WidgetInstance,
      handle: "se" | "sw" | "ne" | "nw" | "e" | "w" | "n" | "s"
    ) => {
      if (previewMode) return;
      e.stopPropagation();

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      setDragState({
        type: "resize",
        widgetId: widget.id,
        startX: e.clientX - rect.left,
        startY: e.clientY - rect.top,
        startWidgetX: widget.x,
        startWidgetY: widget.y,
        startWidth: widget.width,
        startHeight: widget.height,
        resizeHandle: handle,
      });
    },
    [previewMode]
  );

  // Handle mouse move
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;
      const { cellWidth, cellHeight } = getCellDimensions();

      if (dragState.type === "move" && dragState.widgetId) {
        const deltaX = currentX - dragState.startX;
        const deltaY = currentY - dragState.startY;

        // When snap is off, use finer increments for smoother movement
        const snapIncrement = gridSnap ? 1 : 0.25;
        const rawDeltaX = deltaX / (cellWidth + gridGap);
        const rawDeltaY = deltaY / (cellHeight + gridGap);
        const gridDeltaX = Math.round(rawDeltaX / snapIncrement) * snapIncrement;
        const gridDeltaY = Math.round(rawDeltaY / snapIncrement) * snapIncrement;

        const widget = widgets.find((w) => w.id === dragState.widgetId);
        if (!widget) return;

        // Final position rounds to integer for grid placement
        const newX = Math.max(
          0,
          Math.min(gridColumns - widget.width, Math.round((dragState.startWidgetX ?? 0) + gridDeltaX))
        );
        const newY = Math.max(
          0,
          Math.min(gridRows - widget.height, Math.round((dragState.startWidgetY ?? 0) + gridDeltaY))
        );

        moveWidget(dragState.widgetId, newX, newY);
      } else if (dragState.type === "resize" && dragState.widgetId) {
        const widget = widgets.find((w) => w.id === dragState.widgetId);
        if (!widget) return;

        const definition = getWidgetDefinition(widget.type);
        const deltaX = currentX - dragState.startX;
        const deltaY = currentY - dragState.startY;

        // When snap is off, use finer increments for smoother resizing
        const snapIncrement = gridSnap ? 1 : 0.25;
        const rawDeltaX = deltaX / (cellWidth + gridGap);
        const rawDeltaY = deltaY / (cellHeight + gridGap);
        const gridDeltaX = Math.round(rawDeltaX / snapIncrement) * snapIncrement;
        const gridDeltaY = Math.round(rawDeltaY / snapIncrement) * snapIncrement;

        let newWidth = dragState.startWidth ?? widget.width;
        let newHeight = dragState.startHeight ?? widget.height;
        let newX = dragState.startWidgetX ?? widget.x;
        let newY = dragState.startWidgetY ?? widget.y;

        const handle = dragState.resizeHandle;
        const effectiveMaxWidth = Math.min(definition.maxSize.width, gridColumns);
        const effectiveMaxHeight = Math.min(definition.maxSize.height, gridRows);

        if (handle?.includes("e")) {
          newWidth = Math.max(
            definition.minSize.width,
            Math.min(effectiveMaxWidth, (dragState.startWidth ?? widget.width) + gridDeltaX)
          );
        }
        if (handle?.includes("w")) {
          const widthChange = -gridDeltaX;
          const potentialWidth = (dragState.startWidth ?? widget.width) + widthChange;
          if (
            potentialWidth >= definition.minSize.width &&
            potentialWidth <= effectiveMaxWidth
          ) {
            newWidth = potentialWidth;
            newX = (dragState.startWidgetX ?? widget.x) - widthChange;
          }
        }
        if (handle?.includes("s")) {
          newHeight = Math.max(
            definition.minSize.height,
            Math.min(effectiveMaxHeight, (dragState.startHeight ?? widget.height) + gridDeltaY)
          );
        }
        if (handle?.includes("n")) {
          const heightChange = -gridDeltaY;
          const potentialHeight = (dragState.startHeight ?? widget.height) + heightChange;
          if (
            potentialHeight >= definition.minSize.height &&
            potentialHeight <= effectiveMaxHeight
          ) {
            newHeight = potentialHeight;
            newY = (dragState.startWidgetY ?? widget.y) - heightChange;
          }
        }

        // Constrain to grid bounds and round to integers
        newX = Math.max(0, Math.round(newX));
        newY = Math.max(0, Math.round(newY));
        newWidth = Math.round(Math.min(newWidth, gridColumns - newX));
        newHeight = Math.round(Math.min(newHeight, gridRows - newY));

        // Ensure minimum sizes after rounding
        newWidth = Math.max(definition.minSize.width, newWidth);
        newHeight = Math.max(definition.minSize.height, newHeight);

        if (newX !== widget.x || newY !== widget.y) {
          moveWidget(dragState.widgetId, newX, newY);
        }
        if (newWidth !== widget.width || newHeight !== widget.height) {
          resizeWidget(dragState.widgetId, newWidth, newHeight);
        }
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    dragState,
    getCellDimensions,
    gridColumns,
    gridRows,
    gridGap,
    gridSnap,
    moveWidget,
    resizeWidget,
    widgets,
  ]);

  // Handle keyboard shortcuts (Escape to deselect only - no keyboard deletion)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (previewMode) return;
      if (!selectedWidgetId) return;

      if (e.key === "Escape") {
        selectWidget(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedWidgetId, selectWidget, previewMode]);

  // Handle canvas mousedown to deselect - uses mousedown so widget's stopPropagation works
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    // Only deselect if clicking on empty area (not on a widget)
    if (!previewMode) {
      selectWidget(null);
    }
  }, [previewMode, selectWidget]);

  const selectedWidget = widgets.find((w) => w.id === selectedWidgetId);

  // Get display info for canvas size indicator
  const getCanvasSizeLabel = () => {
    if (canvasSizeMode === "fill") return null;
    if (canvasSizeMode === "pixels" || aspectRatio === "custom") {
      return `${canvasWidth} × ${canvasHeight}`;
    }
    const preset = ASPECT_RATIO_PRESETS.find(p => p.id === aspectRatio);
    return preset?.label ?? aspectRatio;
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center"
    >
      {/* Canvas header bar */}
      {!previewMode && (
        <div className="absolute top-2 left-2 right-2 flex items-center gap-3 z-30">
          {/* Canvas size indicator */}
          {canvasSize && (
            <div className="px-2 py-1 bg-black/60 rounded text-xs text-white/70">
              {getCanvasSizeLabel()} ({Math.round(canvasSize.width)} × {Math.round(canvasSize.height)})
            </div>
          )}

          {/* Selected widget position controls */}
          {selectedWidget && (
            <div className="flex items-center gap-2 px-2 py-1 bg-black/80 rounded text-xs text-white">
              <span className="font-medium text-primary">
                {getWidgetDefinition(selectedWidget.type).name}
              </span>
              <div className="w-px h-4 bg-white/20" />
              <label className="flex items-center gap-1">
                <span className="text-[10px] text-white/50 uppercase">X</span>
                <input
                  type="number"
                  value={selectedWidget.x}
                  onChange={(e) => {
                    const val = Math.max(0, Math.min(gridColumns - selectedWidget.width, parseInt(e.target.value) || 0));
                    moveWidget(selectedWidget.id, val, selectedWidget.y);
                  }}
                  min={0}
                  max={gridColumns - selectedWidget.width}
                  className="w-8 h-5 px-1 text-xs text-center bg-white/10 border border-white/20 rounded text-white focus:outline-none focus:border-primary"
                />
              </label>
              <label className="flex items-center gap-1">
                <span className="text-[10px] text-white/50 uppercase">Y</span>
                <input
                  type="number"
                  value={selectedWidget.y}
                  onChange={(e) => {
                    const val = Math.max(0, Math.min(gridRows - selectedWidget.height, parseInt(e.target.value) || 0));
                    moveWidget(selectedWidget.id, selectedWidget.x, val);
                  }}
                  min={0}
                  max={gridRows - selectedWidget.height}
                  className="w-8 h-5 px-1 text-xs text-center bg-white/10 border border-white/20 rounded text-white focus:outline-none focus:border-primary"
                />
              </label>
              <label className="flex items-center gap-1">
                <span className="text-[10px] text-white/50 uppercase">W</span>
                <input
                  type="number"
                  value={selectedWidget.width}
                  onChange={(e) => {
                    const def = getWidgetDefinition(selectedWidget.type);
                    const val = Math.max(def.minSize.width, Math.min(Math.min(def.maxSize.width, gridColumns - selectedWidget.x), parseInt(e.target.value) || 1));
                    resizeWidget(selectedWidget.id, val, selectedWidget.height);
                  }}
                  min={getWidgetDefinition(selectedWidget.type).minSize.width}
                  max={Math.min(getWidgetDefinition(selectedWidget.type).maxSize.width, gridColumns - selectedWidget.x)}
                  className="w-8 h-5 px-1 text-xs text-center bg-white/10 border border-white/20 rounded text-white focus:outline-none focus:border-primary"
                />
              </label>
              <label className="flex items-center gap-1">
                <span className="text-[10px] text-white/50 uppercase">H</span>
                <input
                  type="number"
                  value={selectedWidget.height}
                  onChange={(e) => {
                    const def = getWidgetDefinition(selectedWidget.type);
                    const val = Math.max(def.minSize.height, Math.min(Math.min(def.maxSize.height, gridRows - selectedWidget.y), parseInt(e.target.value) || 1));
                    resizeWidget(selectedWidget.id, selectedWidget.width, val);
                  }}
                  min={getWidgetDefinition(selectedWidget.type).minSize.height}
                  max={Math.min(getWidgetDefinition(selectedWidget.type).maxSize.height, gridRows - selectedWidget.y)}
                  className="w-8 h-5 px-1 text-xs text-center bg-white/10 border border-white/20 rounded text-white focus:outline-none focus:border-primary"
                />
              </label>
            </div>
          )}
        </div>
      )}
      <div
        ref={canvasRef}
        className={cn(
          "relative overflow-hidden rounded-lg",
          !previewMode && "border-2 shadow-2xl",
          !canvasSize && "w-full h-full"
        )}
        style={{
          backgroundColor,
          ...(!previewMode ? {
            borderColor: "hsl(var(--theme-accent) / 0.5)",
          } : {}),
          ...(canvasSize ? {
            width: canvasSize.width,
            height: canvasSize.height,
          } : {}),
        }}
        onMouseDown={handleCanvasMouseDown}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragLeave={handleDragLeave}
      >
      {/* Grid overlay */}
      {showGrid && !previewMode && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
            gridTemplateRows: `repeat(${gridRows}, 1fr)`,
            gap: `${gridGap}px`,
          }}
        >
          {Array.from({ length: gridColumns * gridRows }).map((_, i) => (
            <div
              key={i}
              className="border border-dashed border-white/10 rounded"
            />
          ))}
        </div>
      )}

      {/* Center guide lines - always visible in edit mode */}
      {!previewMode && (
        <>
          {/* Vertical center line */}
          <div
            className="absolute top-0 bottom-0 w-px bg-primary/50 pointer-events-none z-10"
            style={{ left: "50%" }}
          />
          {/* Horizontal center line */}
          <div
            className="absolute left-0 right-0 h-px bg-primary/50 pointer-events-none z-10"
            style={{ top: "50%" }}
          />
        </>
      )}

      {/* Widgets container */}
      <div
        className="absolute inset-0"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
          gridTemplateRows: `repeat(${gridRows}, 1fr)`,
          gap: `${gridGap}px`,
        }}
      >
        {/* Drop preview (positioned in grid) */}
        {dropPreview && !previewMode && (
          <div
            className="bg-primary/20 border-2 border-primary border-dashed rounded-lg pointer-events-none"
            style={{
              gridColumn: `${dropPreview.x + 1} / span ${dropPreview.width}`,
              gridRow: `${dropPreview.y + 1} / span ${dropPreview.height}`,
            }}
          />
        )}

        {widgets.map((widget) => {
          const isSelected = widget.id === selectedWidgetId && !previewMode;

          // In preview mode, skip hidden widgets entirely
          if (previewMode && widget.hidden) {
            return null;
          }

          return (
            <div
              key={widget.id}
              className={cn(
                "relative rounded-lg overflow-hidden group",
                !previewMode && "cursor-move select-none",
                // In editor mode, show hidden widgets with reduced opacity
                !previewMode && widget.hidden && "opacity-30"
              )}
              style={{
                gridColumn: `${widget.x + 1} / span ${widget.width}`,
                gridRow: `${widget.y + 1} / span ${widget.height}`,
                backgroundColor: widget.style?.backgroundColor,
                opacity: widget.hidden ? undefined : (widget.style?.opacity !== undefined ? widget.style.opacity / 100 : 1),
                // Bring selected widget to front so resize handles aren't obscured
                zIndex: isSelected ? 10 : undefined,
              }}
              onMouseDown={(e) => handleWidgetMouseDown(e, widget)}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (!previewMode && onWidgetDoubleClick) {
                  onWidgetDoubleClick(widget.id);
                }
              }}
            >
              {/* DAKboard-style subtle border with corner dots (editor mode only) */}
              {!previewMode && (
                <>
                  {/* Subtle border */}
                  <div
                    className={cn(
                      "absolute inset-0 rounded-lg pointer-events-none transition-colors",
                      isSelected
                        ? "border-2 border-primary"
                        : "border border-white/20 group-hover:border-white/40"
                    )}
                  />
                  {/* Corner dots - on top of border */}
                  {!isSelected && (
                    <>
                      <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white/50 rounded-full pointer-events-none z-10" />
                      <div className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white/50 rounded-full pointer-events-none z-10" />
                      <div className="absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-white/50 rounded-full pointer-events-none z-10" />
                      <div className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 w-2 h-2 bg-white/50 rounded-full pointer-events-none z-10" />
                    </>
                  )}
                </>
              )}

              {/* Widget content */}
              <div className="w-full h-full">
                <WidgetRenderer widget={widget} isBuilder={!previewMode && !liveMode} />
              </div>

              {/* Edit button - visible on hover (non-selected widgets) */}
              {!previewMode && !isSelected && (
                <div
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                >
                  <button
                    className="p-1.5 bg-black/70 rounded-md hover:bg-black transition-colors"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onWidgetDoubleClick) {
                        onWidgetDoubleClick(widget.id);
                      }
                    }}
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4 text-white" />
                  </button>
                </div>
              )}

              {/* Selection overlay with controls */}
              {isSelected && (
                <>
                  {/* Large move/grab zone - covers interior with padding from edges */}
                  <div
                    className="absolute inset-4 cursor-move z-10"
                    onMouseDown={(e) => handleWidgetMouseDown(e, widget)}
                  />

                  {/* Action buttons */}
                  <div className="absolute top-2 right-2 flex gap-1 z-20">
                    <button
                      className="p-1.5 bg-black/80 rounded-md hover:bg-black transition-colors"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onWidgetDoubleClick) {
                          onWidgetDoubleClick(widget.id);
                        }
                      }}
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4 text-white" />
                    </button>
                    <button
                      className="p-1.5 bg-red-600/80 rounded-md hover:bg-red-600 transition-colors"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeWidget(widget.id);
                      }}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-white" />
                    </button>
                  </div>

                  {/* Corner resize handles - positioned at corners, centered on the corner point */}
                  <div
                    className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 w-3 h-3 bg-white border-2 border-primary rounded-full cursor-se-resize z-20 shadow-sm"
                    onMouseDown={(e) => handleResizeMouseDown(e, widget, "se")}
                  />
                  <div
                    className="absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2 w-3 h-3 bg-white border-2 border-primary rounded-full cursor-sw-resize z-20 shadow-sm"
                    onMouseDown={(e) => handleResizeMouseDown(e, widget, "sw")}
                  />
                  <div
                    className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-primary rounded-full cursor-ne-resize z-20 shadow-sm"
                    onMouseDown={(e) => handleResizeMouseDown(e, widget, "ne")}
                  />
                  <div
                    className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-primary rounded-full cursor-nw-resize z-20 shadow-sm"
                    onMouseDown={(e) => handleResizeMouseDown(e, widget, "nw")}
                  />

                  {/* Edge resize handles - invisible but functional */}
                  <div
                    className="absolute top-0 left-4 right-4 h-2 -translate-y-1/2 cursor-n-resize z-20"
                    onMouseDown={(e) => handleResizeMouseDown(e, widget, "n")}
                  />
                  <div
                    className="absolute bottom-0 left-4 right-4 h-2 translate-y-1/2 cursor-s-resize z-20"
                    onMouseDown={(e) => handleResizeMouseDown(e, widget, "s")}
                  />
                  <div
                    className="absolute left-0 top-4 bottom-4 w-2 -translate-x-1/2 cursor-w-resize z-20"
                    onMouseDown={(e) => handleResizeMouseDown(e, widget, "w")}
                  />
                  <div
                    className="absolute right-0 top-4 bottom-4 w-2 translate-x-1/2 cursor-e-resize z-20"
                    onMouseDown={(e) => handleResizeMouseDown(e, widget, "e")}
                  />
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {widgets.length === 0 && !previewMode && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-white/50">
            <p className="text-lg font-medium">No widgets yet</p>
            <p className="text-sm">Click "Add Block" to get started</p>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
