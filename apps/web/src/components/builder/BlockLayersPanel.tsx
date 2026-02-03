import { useState, useCallback, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  GripVertical,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Play,
  Clock,
  Timer,
  Cloud,
  CloudSun,
  Calendar,
  CalendarClock,
  CheckSquare,
  Trophy,
  Music,
  Zap,
  Gauge,
  LineChart,
  Camera,
  Type,
  Image,
  Images,
  Shapes,
  Magnet,
  Grid3X3,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { getWidgetDefinition } from "../../lib/widgets/registry";
import { useBuilder } from "../../hooks/useBuilder";

interface BlockLayersPanelProps {
  onEditWidget: (widgetId: string) => void;
  onEnterPreview: () => void;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Clock,
  Timer,
  Cloud,
  CloudSun,
  Calendar,
  CalendarClock,
  CheckSquare,
  Trophy,
  Music,
  Zap,
  Gauge,
  LineChart,
  Camera,
  Type,
  Image,
  Images,
  Shapes,
};

export function BlockLayersPanel({ onEditWidget, onEnterPreview }: BlockLayersPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragStartIndex = useRef<number>(-1);

  const {
    layoutConfig,
    selectedWidgetId,
    selectWidget,
    removeWidget,
    toggleWidgetVisibility,
    bringWidgetToFront,
    sendWidgetToBack,
    gridSnap,
    setGridSnap,
  } = useBuilder();

  const widgets = layoutConfig.widgets || [];
  // Display widgets in reverse order (top = front, bottom = back)
  const widgetsReversed = [...widgets].reverse();

  const getWidgetIcon = (type: string) => {
    const def = getWidgetDefinition(type as any);
    return ICON_MAP[def.icon] || Shapes;
  };

  // Drag and drop handlers for reordering
  const handleDragStart = useCallback((e: React.DragEvent, widgetId: string, index: number) => {
    setDraggedId(widgetId);
    dragStartIndex.current = index;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", widgetId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, widgetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (widgetId !== draggedId) {
      setDragOverId(widgetId);
    }
  }, [draggedId]);

  const handleDragLeave = useCallback(() => {
    setDragOverId(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const draggedWidgetId = e.dataTransfer.getData("text/plain");

    if (!draggedWidgetId || dragStartIndex.current === dropIndex) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    // Convert from reversed display index to actual array index
    const actualDragIndex = widgets.length - 1 - dragStartIndex.current;
    const actualDropIndex = widgets.length - 1 - dropIndex;

    // Reorder by moving the widget to new position
    if (actualDragIndex < actualDropIndex) {
      // Moving backward in z-order (down in list = lower z)
      // Repeatedly bring forward until we reach target
      let currentIndex = actualDragIndex;
      while (currentIndex < actualDropIndex) {
        // Find widget at current position and bring forward
        const widgetAtPos = widgets[currentIndex];
        if (widgetAtPos) {
          bringWidgetToFront(widgetAtPos.id);
        }
        currentIndex++;
      }
    } else {
      // Moving forward in z-order (up in list = higher z)
      // Repeatedly send backward until we reach target
      let currentIndex = actualDragIndex;
      while (currentIndex > actualDropIndex) {
        const widgetAtPos = widgets[currentIndex];
        if (widgetAtPos) {
          sendWidgetToBack(widgetAtPos.id);
        }
        currentIndex--;
      }
    }

    setDraggedId(null);
    setDragOverId(null);
  }, [widgets, bringWidgetToFront, sendWidgetToBack]);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOverId(null);
  }, []);

  // Collapsed state - just show a thin expand button
  if (!expanded) {
    return (
      <div className="h-full w-12 border-l border-border bg-muted/30 flex flex-col items-center py-4">
        <button
          onClick={() => setExpanded(true)}
          className="p-2 rounded-md hover:bg-muted transition-colors"
          title="Expand Layers Panel"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="mt-4 flex flex-col items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground writing-mode-vertical rotate-180" style={{ writingMode: "vertical-rl" }}>
            Layers ({widgets.length})
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-72 border-l border-border bg-muted/30 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">Layers</span>
          <span className="text-xs text-muted-foreground">({widgets.length})</span>
        </div>
        <button
          onClick={() => setExpanded(false)}
          className="p-1 rounded-md hover:bg-muted transition-colors"
          title="Collapse Panel"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Snap to Grid Toggle */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Magnet className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs">Snap to Grid</span>
        </div>
        <button
          onClick={() => setGridSnap(!gridSnap)}
          className={cn(
            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
            gridSnap ? "bg-primary" : "bg-muted"
          )}
        >
          <span
            className={cn(
              "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
              gridSnap ? "translate-x-5" : "translate-x-1"
            )}
          />
        </button>
      </div>

      {/* Mini Grid Preview */}
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <Grid3X3 className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Preview</span>
          <span className="text-xs text-muted-foreground ml-auto">
            {layoutConfig.gridColumns}x{layoutConfig.gridRows}
          </span>
        </div>
        <div
          className="relative border-2 rounded overflow-hidden bg-muted/30"
          style={{
            aspectRatio: `${layoutConfig.gridColumns} / ${layoutConfig.gridRows}`,
            borderColor: "hsl(var(--theme-accent) / 0.3)",
          }}
        >
          {/* Grid lines */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${layoutConfig.gridColumns}, 1fr)`,
              gridTemplateRows: `repeat(${layoutConfig.gridRows}, 1fr)`,
              gap: "1px",
            }}
          >
            {Array.from({ length: layoutConfig.gridColumns * layoutConfig.gridRows }).map((_, i) => (
              <div key={i} className="border border-border/20" />
            ))}
          </div>

          {/* Widgets on grid */}
          <div
            className="absolute inset-0"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${layoutConfig.gridColumns}, 1fr)`,
              gridTemplateRows: `repeat(${layoutConfig.gridRows}, 1fr)`,
              gap: "1px",
              padding: "1px",
            }}
          >
            {widgets.map((widget) => {
              const isSelected = widget.id === selectedWidgetId;
              const Icon = getWidgetIcon(widget.type);

              return (
                <button
                  key={widget.id}
                  onClick={() => selectWidget(widget.id)}
                  className={cn(
                    "rounded transition-colors flex items-center justify-center",
                    widget.hidden && "opacity-30",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted-foreground/20 hover:bg-muted-foreground/30 text-foreground/70"
                  )}
                  style={{
                    gridColumn: `${widget.x + 1} / span ${widget.width}`,
                    gridRow: `${widget.y + 1} / span ${widget.height}`,
                  }}
                  title={getWidgetDefinition(widget.type as any).name}
                >
                  <Icon className="h-2.5 w-2.5" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Widget list */}
      <div className="flex-1 overflow-y-auto">
        {widgetsReversed.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No widgets added yet.
            <br />
            Click "Add Block" to get started.
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {widgetsReversed.map((widget, index) => {
              const def = getWidgetDefinition(widget.type as any);
              const Icon = getWidgetIcon(widget.type);
              const isSelected = widget.id === selectedWidgetId;
              const isDragging = widget.id === draggedId;
              const isDragOver = widget.id === dragOverId;

              return (
                <div
                  key={widget.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, widget.id, index)}
                  onDragOver={(e) => handleDragOver(e, widget.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  onClick={() => selectWidget(widget.id)}
                  onDoubleClick={() => onEditWidget(widget.id)}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-all",
                    "hover:bg-muted/50 group",
                    isSelected && "bg-primary/10 ring-1 ring-primary/50",
                    widget.hidden && "opacity-50",
                    isDragging && "opacity-30",
                    isDragOver && "ring-2 ring-primary ring-offset-1"
                  )}
                >
                  {/* Drag handle */}
                  <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
                    <GripVertical className="h-4 w-4" />
                  </div>

                  {/* Icon */}
                  <div className={cn(
                    "flex h-7 w-7 items-center justify-center rounded",
                    isSelected ? "bg-primary/20" : "bg-muted"
                  )}>
                    <Icon className={cn("h-4 w-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                  </div>

                  {/* Name */}
                  <span className="flex-1 text-sm truncate">{def.name}</span>

                  {/* Actions (visible on hover or when selected) */}
                  <div className={cn(
                    "flex items-center gap-0.5 transition-opacity",
                    isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  )}>
                    {/* Visibility toggle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWidgetVisibility(widget.id);
                      }}
                      className="p-1 rounded hover:bg-muted transition-colors"
                      title={widget.hidden ? "Show" : "Hide"}
                    >
                      {widget.hidden ? (
                        <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>

                    {/* Edit button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditWidget(widget.id);
                      }}
                      className="p-1 rounded hover:bg-muted transition-colors"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeWidget(widget.id);
                      }}
                      className="p-1 rounded hover:bg-red-500/20 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border p-3">
        <button
          onClick={onEnterPreview}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md",
            "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors",
            "text-sm font-medium"
          )}
        >
          <Play className="h-4 w-4" />
          Enter Screensaver Mode
        </button>
      </div>
    </div>
  );
}
