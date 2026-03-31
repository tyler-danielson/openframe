import { useState, useCallback, useRef, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  GripVertical,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Copy,
  ArrowUpToLine,
  ArrowDownToLine,
  MoreVertical,
  Magnet,
  Grid3X3,
  Shapes,
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
  Map,
  Newspaper,
  Tv,
  Youtube,
  Play,
  BookOpen,
  LayoutGrid,
  StickyNote,
  TrendingUp,
  ArrowRightLeft,
  AlertTriangle,
  Wind,
  Waves,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { getWidgetDefinition } from "../../lib/widgets/registry";
import { useBuilder } from "../../hooks/useBuilder";

interface BlockLayersPanelProps {
  onEditWidget: (widgetId: string) => void;
  onEnterPreview: () => void;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Clock, Timer, Cloud, CloudSun, Calendar, CalendarClock, CheckSquare,
  Trophy, Music, Zap, Gauge, LineChart, Camera, Type, Image, Images,
  Shapes, Map, Newspaper, Tv, Youtube, Play, BookOpen, LayoutGrid, StickyNote,
  TrendingUp, ArrowRightLeft, AlertTriangle, Wind, Waves,
};

export function BlockLayersPanel({ onEditWidget, onEnterPreview }: BlockLayersPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [menuWidgetId, setMenuWidgetId] = useState<string | null>(null);
  const dragStartIndex = useRef<number>(-1);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!menuWidgetId) return;
    const handleClick = () => setMenuWidgetId(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [menuWidgetId]);

  const {
    layoutConfig,
    selectedWidgetId,
    selectWidget,
    removeWidget,
    duplicateWidget,
    toggleWidgetVisibility,
    bringWidgetToFront,
    sendWidgetToBack,
    gridSnap,
    setGridSnap,
  } = useBuilder();

  const widgets = layoutConfig.widgets || [];
  const widgetsReversed = [...widgets].reverse();

  const getWidgetIcon = (type: string) => {
    const def = getWidgetDefinition(type as any);
    return ICON_MAP[def.icon] || Shapes;
  };

  const getWidgetLabel = (widget: { type: string; config: Record<string, unknown> }) => {
    const def = getWidgetDefinition(widget.type as any);
    // Use custom header text if available, otherwise the widget type name
    const headerText = widget.config.headerText as string;
    return headerText || def.name;
  };

  // Drag and drop handlers
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

    const actualDragIndex = widgets.length - 1 - dragStartIndex.current;
    const actualDropIndex = widgets.length - 1 - dropIndex;

    if (actualDragIndex < actualDropIndex) {
      let currentIndex = actualDragIndex;
      while (currentIndex < actualDropIndex) {
        const widgetAtPos = widgets[currentIndex];
        if (widgetAtPos) bringWidgetToFront(widgetAtPos.id);
        currentIndex++;
      }
    } else {
      let currentIndex = actualDragIndex;
      while (currentIndex > actualDropIndex) {
        const widgetAtPos = widgets[currentIndex];
        if (widgetAtPos) sendWidgetToBack(widgetAtPos.id);
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

  // Collapsed state
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
          <span className="text-xs text-muted-foreground" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
            Layers ({widgets.length})
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-72 border-l border-border bg-[#f5f5f5] dark:bg-muted/30 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="font-semibold text-sm text-primary">Block Layers</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Drag to reorder. Double-click to edit.
          </p>
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
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Magnet className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs">Snap to Grid</span>
        </div>
        <button
          onClick={() => setGridSnap(!gridSnap)}
          className={cn(
            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
            gridSnap ? "bg-primary" : "bg-muted"
          )}
        >
          <span className={cn(
            "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
            gridSnap ? "translate-x-5" : "translate-x-1"
          )} />
        </button>
      </div>

      {/* Mini Grid Preview */}
      <div className="px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <Grid3X3 className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Preview</span>
          <span className="text-[10px] text-muted-foreground ml-auto">
            {layoutConfig.gridColumns}x{layoutConfig.gridRows}
          </span>
        </div>
        <div
          className="relative border rounded overflow-hidden bg-muted/30"
          style={{
            aspectRatio: `${layoutConfig.gridColumns} / ${layoutConfig.gridRows}`,
            borderColor: "hsl(var(--theme-accent) / 0.3)",
          }}
        >
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
              <div key={i} className="border border-border/10" />
            ))}
          </div>
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
                  title={getWidgetLabel(widget)}
                >
                  <Icon className="h-2.5 w-2.5" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Widget list - DAKboard style */}
      <div className="flex-1 overflow-y-auto">
        {widgetsReversed.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No widgets added yet.
            <br />
            Click "Add Block" to get started.
          </div>
        ) : (
          <div className="py-1">
            {widgetsReversed.map((widget, index) => {
              const Icon = getWidgetIcon(widget.type);
              const isSelected = widget.id === selectedWidgetId;
              const isDragging = widget.id === draggedId;
              const isDragOver = widget.id === dragOverId;
              const label = getWidgetLabel(widget);
              const bgColor = widget.style?.backgroundColor;

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
                    "relative flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-all border-l-4",
                    isSelected
                      ? "bg-primary text-primary-foreground border-l-primary"
                      : "hover:bg-muted/50 border-l-transparent",
                    widget.hidden && !isSelected && "opacity-50",
                    isDragging && "opacity-30",
                    isDragOver && "bg-primary/10 border-l-primary/50"
                  )}
                >
                  {/* Visibility toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleWidgetVisibility(widget.id);
                    }}
                    className={cn(
                      "shrink-0 p-0.5 rounded transition-colors",
                      isSelected
                        ? "hover:bg-primary-foreground/20"
                        : "hover:bg-muted"
                    )}
                    title={widget.hidden ? "Show" : "Hide"}
                  >
                    {widget.hidden ? (
                      <EyeOff className={cn("h-4 w-4", isSelected ? "text-primary-foreground/60" : "text-muted-foreground")} />
                    ) : (
                      <Eye className={cn("h-4 w-4", isSelected ? "text-primary-foreground" : "text-muted-foreground")} />
                    )}
                  </button>

                  {/* Color swatch / icon thumbnail */}
                  <div
                    className={cn(
                      "shrink-0 w-8 h-6 rounded border flex items-center justify-center",
                      isSelected ? "border-primary-foreground/30" : "border-border"
                    )}
                    style={{ backgroundColor: bgColor || (isSelected ? "hsl(var(--primary-foreground) / 0.15)" : "hsl(var(--muted))") }}
                  >
                    <Icon className={cn("h-3 w-3", isSelected ? "text-primary-foreground" : "text-muted-foreground")} />
                  </div>

                  {/* Widget name */}
                  <span className={cn(
                    "flex-1 text-sm truncate",
                    isSelected ? "font-medium" : ""
                  )}>
                    {label}
                  </span>

                  {/* Three-dot menu */}
                  <div className="relative shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuWidgetId(menuWidgetId === widget.id ? null : widget.id);
                      }}
                      className={cn(
                        "p-1 rounded transition-colors",
                        isSelected
                          ? "hover:bg-primary-foreground/20 text-primary-foreground"
                          : "hover:bg-muted text-muted-foreground opacity-0 group-hover:opacity-100",
                        // Always visible for selected or when menu is open
                        (isSelected || menuWidgetId === widget.id) && "opacity-100"
                      )}
                      title="More actions"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>

                    {/* Dropdown menu */}
                    {menuWidgetId === widget.id && (
                      <div
                        className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-lg border border-border bg-[#1c1c1e] py-1 shadow-xl"
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <button
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-popover-foreground hover:bg-accent transition-colors"
                          onClick={(e) => { e.stopPropagation(); onEditWidget(widget.id); setMenuWidgetId(null); }}
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-popover-foreground hover:bg-accent transition-colors"
                          onClick={(e) => { e.stopPropagation(); duplicateWidget(widget.id); setMenuWidgetId(null); }}
                        >
                          <Copy className="h-3.5 w-3.5" /> Duplicate
                        </button>
                        <div className="my-1 h-px bg-border" />
                        <button
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-popover-foreground hover:bg-accent transition-colors"
                          onClick={(e) => { e.stopPropagation(); bringWidgetToFront(widget.id); setMenuWidgetId(null); }}
                        >
                          <ArrowUpToLine className="h-3.5 w-3.5" /> Bring to Front
                        </button>
                        <button
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-popover-foreground hover:bg-accent transition-colors"
                          onClick={(e) => { e.stopPropagation(); sendWidgetToBack(widget.id); setMenuWidgetId(null); }}
                        >
                          <ArrowDownToLine className="h-3.5 w-3.5" /> Send to Back
                        </button>
                        <div className="my-1 h-px bg-border" />
                        <button
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                          onClick={(e) => { e.stopPropagation(); removeWidget(widget.id); setMenuWidgetId(null); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
