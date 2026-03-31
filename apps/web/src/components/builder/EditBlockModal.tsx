import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { useHAWebSocket } from "../../stores/homeassistant-ws";
import type { Calendar as CalendarType } from "@openframe/shared";
import {
  X,
  Settings,
  Palette,
  Clock,
  Timer,
  Cloud,
  CloudSun,
  Calendar,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  Trophy,
  Music,
  Zap,
  Gauge,
  LineChart,
  Camera,
  Map,
  Type,
  Image,
  Images,
  Shapes,
  StickyNote,
  Maximize,
  Newspaper,
  Tv,
  Youtube,
  Play,
  BookOpen,
  LayoutGrid,
  Eye,
  Plus,
  Trash2,
  TrendingUp,
  ArrowRightLeft,
  AlertTriangle,
  Wind,
  Waves,
  ChevronRight,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { type VisibilityConfig, type VisibilityCondition, type VisibilityConditionType, type ComparisonOperator } from "../../stores/screensaver";
import { getWidgetDefinition } from "../../lib/widgets/registry";
import { useBuilder } from "../../hooks/useBuilder";
import { HAEntityBrowser } from "./HAEntityBrowser";
import { AlbumPicker } from "./AlbumPicker";
import { WIDGET_CONFIG_REGISTRY } from "./widget-configs";

interface EditBlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  widgetId: string;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Clock,
  Timer,
  Cloud,
  CloudSun,
  Calendar,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  Trophy,
  Music,
  Zap,
  Gauge,
  LineChart,
  Camera,
  Map,
  Type,
  Image,
  Images,
  Shapes,
  Maximize,
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
};

type TabId = "setup" | "style" | "advanced";

// Add Condition dropdown menu
function AddConditionMenu({ onAdd }: { onAdd: (type: VisibilityConditionType) => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const items: { type: VisibilityConditionType; label: string; icon: React.ElementType }[] = [
    { type: "time-schedule", label: "Time Schedule", icon: Clock },
    { type: "ha-entity", label: "HA Entity State", icon: Zap },
    { type: "spotify-playing", label: "Music Playing", icon: Music },
    { type: "calendar-event", label: "Calendar Event", icon: Calendar },
  ];

  return (
    <div ref={menuRef} className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors px-3 py-1.5 rounded border border-dashed border-primary/40 hover:bg-primary/5"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Condition
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-52 rounded-lg border border-border bg-card shadow-lg py-1">
          {items.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              onClick={() => { onAdd(type); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
            >
              <Icon className="h-4 w-4 text-primary" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Calendar picker for visibility condition
function CalendarConditionPicker({ selectedIds, onChange }: { selectedIds: string[]; onChange: (ids: string[]) => void }) {
  const { data: calendars = [] } = useQuery({
    queryKey: ["calendars"],
    queryFn: () => api.getCalendars(),
    staleTime: 5 * 60 * 1000,
  });

  const visibleCalendars = calendars.filter((c: CalendarType) => c.isVisible);

  if (visibleCalendars.length === 0) {
    return <p className="text-xs text-muted-foreground mt-1">No calendars available</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {visibleCalendars.map((cal: CalendarType) => {
        const isSelected = selectedIds.includes(cal.id);
        return (
          <button
            key={cal.id}
            onClick={() => {
              const newIds = isSelected
                ? selectedIds.filter((id) => id !== cal.id)
                : [...selectedIds, cal.id];
              onChange(newIds);
            }}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors border",
              isSelected
                ? "bg-primary/10 border-primary/40 text-primary"
                : "bg-muted border-border text-muted-foreground hover:bg-muted/80"
            )}
          >
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: cal.color ?? "#3B82F6" }}
            />
            {cal.name}
          </button>
        );
      })}
    </div>
  );
}

export function EditBlockModal({ isOpen, onClose, widgetId }: EditBlockModalProps) {
  const { layoutConfig, updateBuilderWidget } = useBuilder();
  const [activeTab, setActiveTab] = useState<TabId>("setup");
  const [showEntityBrowser, setShowEntityBrowser] = useState(false);
  const [entityBrowserTarget, setEntityBrowserTarget] = useState<string | null>(null);
  const [showAlbumPicker, setShowAlbumPicker] = useState(false);
  const haGetEntityState = useHAWebSocket((s) => s.getEntityState);

  const widgets = layoutConfig.widgets || [];
  const widget = widgets.find((w) => w.id === widgetId);

  if (!isOpen || !widget) return null;

  const definition = getWidgetDefinition(widget.type);
  const WidgetIcon = ICON_MAP[definition.icon] || Shapes;

  const handleConfigChange = (key: string, value: unknown) => {
    updateBuilderWidget(widgetId, {
      config: { ...widget.config, [key]: value },
    });
  };

  const handleStyleChange = (key: string, value: unknown) => {
    updateBuilderWidget(widgetId, {
      style: { ...widget.style, [key]: value },
    });
  };

  // ============ Visibility Conditions Handlers ============

  const getVisibilityConditions = (): VisibilityConfig => {
    return widget.visibilityConditions ?? { enabled: false, logic: "all", conditions: [] };
  };

  const updateVisibilityConditions = (updates: Partial<VisibilityConfig>) => {
    const current = getVisibilityConditions();
    updateBuilderWidget(widgetId, {
      visibilityConditions: { ...current, ...updates },
    });
  };

  const addCondition = (type: VisibilityConditionType) => {
    const current = getVisibilityConditions();
    let newCondition: VisibilityCondition;
    switch (type) {
      case "time-schedule":
        newCondition = { type: "time-schedule", startTime: "00:00", endTime: "23:59", daysOfWeek: [] };
        break;
      case "ha-entity":
        newCondition = { type: "ha-entity", entityId: "", operator: "eq", value: "" };
        break;
      case "spotify-playing":
        newCondition = { type: "spotify-playing", isPlaying: true };
        break;
      case "calendar-event":
        newCondition = { type: "calendar-event", hasActiveEvent: true, calendarIds: [] };
        break;
    }
    updateVisibilityConditions({ conditions: [...current.conditions, newCondition] });
  };

  const updateCondition = (index: number, updates: Partial<VisibilityCondition>) => {
    const current = getVisibilityConditions();
    const newConditions = current.conditions.map((c, i) =>
      i === index ? { ...c, ...updates } as VisibilityCondition : c
    );
    updateVisibilityConditions({ conditions: newConditions });
  };

  const removeCondition = (index: number) => {
    const current = getVisibilityConditions();
    updateVisibilityConditions({ conditions: current.conditions.filter((_, i) => i !== index) });
  };

  // Auto-migrate legacy visibility to new conditions when opening Advanced tab
  const migrateToConditions = () => {
    if (widget.visibility?.enabled && !widget.visibilityConditions) {
      updateBuilderWidget(widgetId, {
        visibilityConditions: {
          enabled: true,
          logic: "all",
          conditions: [{
            type: "time-schedule",
            startTime: widget.visibility.startTime,
            endTime: widget.visibility.endTime,
            daysOfWeek: widget.visibility.daysOfWeek,
          }],
        },
      });
    }
  };

  const openEntityBrowser = (configKey: string) => {
    setEntityBrowserTarget(configKey);
    setShowEntityBrowser(true);
  };

  const handleEntitySelect = (entityId: string) => {
    if (entityBrowserTarget) {
      // Check if this is a visibility condition entity browser
      if (entityBrowserTarget.startsWith("__visibility_")) {
        const condIndex = parseInt(entityBrowserTarget.replace("__visibility_", ""), 10);
        updateCondition(condIndex, { entityId });
      } else {
        handleConfigChange(entityBrowserTarget, entityId);
      }
    }
    setShowEntityBrowser(false);
    setEntityBrowserTarget(null);
  };

  // Render config fields using the widget config registry
  const renderConfigFields = () => {
    const ConfigComponent = WIDGET_CONFIG_REGISTRY[widget.type];
    if (!ConfigComponent) {
      return <p className="text-sm text-muted-foreground">No configuration options for this widget.</p>;
    }
    return (
      <ConfigComponent
        config={widget.config}
        onChange={handleConfigChange}
        widgetId={widgetId}
        openEntityBrowser={openEntityBrowser}
        openAlbumPicker={() => setShowAlbumPicker(true)}
      />
    );
  };

  // Render Setup tab
  const renderSetupTab = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Settings className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-medium">Configuration</h4>
      </div>
      <div className="space-y-3">{renderConfigFields()}</div>
    </div>
  );

  // Render Style tab
  const [showAdvancedStyle, setShowAdvancedStyle] = useState(false);

  const renderStyleTab = () => (
    <div className="space-y-5">
      {/* Text Row */}
      <div className="flex items-start gap-4">
        <span className="text-sm font-medium text-muted-foreground w-24 pt-2 shrink-0">Text</span>
        <div className="flex-1 grid grid-cols-4 gap-2">
          <div>
            {(() => {
              const raw = widget.style?.customFontSize || "16";
              const numVal = parseFloat(raw) || 16;
              return (
                <input
                  type="number"
                  min={1}
                  max={999}
                  step={1}
                  value={numVal}
                  onChange={(e) => {
                    const unit = (widget.style?.customFontSize || "px").replace(/[\d.]/g, "") || "px";
                    handleStyleChange("fontSize", "custom");
                    handleStyleChange("customFontSize", `${e.target.value}${unit}`);
                  }}
                  className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                />
              );
            })()}
            <span className="text-[10px] text-muted-foreground mt-0.5 block text-center">Size</span>
          </div>
          <div>
            <select
              value={(widget.style?.customFontSize || "px").replace(/[\d.]/g, "") || "px"}
              onChange={(e) => {
                const raw = widget.style?.customFontSize || "16px";
                const numVal = parseFloat(raw) || 16;
                handleStyleChange("fontSize", "custom");
                handleStyleChange("customFontSize", `${numVal}${e.target.value}`);
              }}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="px">px</option>
              <option value="%">%</option>
              <option value="vw">vw</option>
              <option value="vh">vh</option>
            </select>
            <span className="text-[10px] text-muted-foreground mt-0.5 block text-center">Unit</span>
          </div>
          <div>
            <div className="relative">
              <input
                type="color"
                value={widget.style?.textColor || "#ffffff"}
                onChange={(e) => handleStyleChange("textColor", e.target.value)}
                className="w-full h-[34px] cursor-pointer rounded border border-border bg-background"
              />
            </div>
            <span className="text-[10px] text-muted-foreground mt-0.5 block text-center">Color</span>
          </div>
          <div>
            <select
              value={widget.style?.textAlign || "left"}
              onChange={(e) => handleStyleChange("textAlign", e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
            <span className="text-[10px] text-muted-foreground mt-0.5 block text-center">Align</span>
          </div>
        </div>
      </div>


      {/* Background Row */}
      <div className="flex items-start gap-4">
        <span className="text-sm font-medium text-muted-foreground w-24 pt-2 shrink-0">Background</span>
        <div className="flex-1 grid grid-cols-2 gap-2">
          <div>
            <div className="flex gap-1">
              <input
                type="color"
                value={widget.style?.backgroundColor || "#000000"}
                onChange={(e) => handleStyleChange("backgroundColor", e.target.value)}
                className="h-[34px] w-10 cursor-pointer rounded border border-border shrink-0"
              />
              <input
                type="text"
                value={widget.style?.backgroundColor || ""}
                onChange={(e) => handleStyleChange("backgroundColor", e.target.value)}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                placeholder="transparent"
              />
            </div>
            <span className="text-[10px] text-muted-foreground mt-0.5 block text-center">Color</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                value={widget.style?.opacity ?? 100}
                onChange={(e) => handleStyleChange("opacity", parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground w-8 text-right">{widget.style?.opacity ?? 100}%</span>
            </div>
            <span className="text-[10px] text-muted-foreground mt-0.5 block text-center">Opacity</span>
          </div>
        </div>
      </div>

      {/* Block Title Row */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-muted-foreground w-24 shrink-0">Block Title</span>
        <div className="flex gap-2 flex-1">
          <button
            onClick={() => handleConfigChange("showHeader", !(widget.config.showHeader ?? true))}
            className={cn(
              "p-1.5 rounded border transition-colors",
              (widget.config.showHeader ?? true)
                ? "border-primary text-primary bg-primary/10"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
            title={widget.config.showHeader !== false ? "Hide title" : "Show title"}
          >
            <Eye className="h-4 w-4" />
          </button>
          <input
            type="text"
            value={(widget.config.headerText as string) || definition.name}
            onChange={(e) => handleConfigChange("headerText", e.target.value)}
            className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm"
            placeholder={definition.name}
          />
        </div>
      </div>

      {/* Advanced Section (collapsible) */}
      <div className="border-t border-border pt-3">
        <button
          onClick={() => setShowAdvancedStyle(!showAdvancedStyle)}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", showAdvancedStyle && "rotate-90")} />
          Advanced
        </button>

        {showAdvancedStyle && (
          <div className="mt-3 space-y-3">
            {/* Block Size */}
            <div className="flex items-start gap-4">
              <span className="text-sm text-muted-foreground w-24 shrink-0">Block Size</span>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-20 flex items-center gap-1">
                    <span className="text-primary">&#8597;</span> Height
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={layoutConfig.gridRows}
                    value={widget.height}
                    onChange={(e) => updateBuilderWidget(widgetId, { height: Math.max(1, Math.min(layoutConfig.gridRows, parseInt(e.target.value) || 1)) })}
                    className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-20 flex items-center gap-1">
                    <span className="text-primary">&#8596;</span> Width
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={layoutConfig.gridColumns}
                    value={widget.width}
                    onChange={(e) => updateBuilderWidget(widgetId, { width: Math.max(1, Math.min(layoutConfig.gridColumns, parseInt(e.target.value) || 1)) })}
                    className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Block Position */}
            <div className="flex items-start gap-4">
              <span className="text-sm text-muted-foreground w-24 shrink-0">Block Position</span>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-20 flex items-center gap-1">
                    <span className="text-primary">&#8594;</span> Horizontal
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={layoutConfig.gridColumns - widget.width}
                    value={widget.x}
                    onChange={(e) => updateBuilderWidget(widgetId, { x: Math.max(0, Math.min(layoutConfig.gridColumns - widget.width, parseInt(e.target.value) || 0)) })}
                    className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-20 flex items-center gap-1">
                    <span className="text-primary">&#8595;</span> Vertical
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={layoutConfig.gridRows - widget.height}
                    value={widget.y}
                    onChange={(e) => updateBuilderWidget(widgetId, { y: Math.max(0, Math.min(layoutConfig.gridRows - widget.height, parseInt(e.target.value) || 0)) })}
                    className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Render Visibility tab (multi-condition builder)
  const renderAdvancedTab = () => {
    const vc = getVisibilityConditions();

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-3">
          <Eye className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-medium">Visibility Conditions</h4>
        </div>

        {/* Enable toggle */}
        <label className="flex items-center justify-between">
          <span className="text-sm">Enable Conditions</span>
          <button
            onClick={() => {
              if (!vc.enabled) migrateToConditions();
              updateVisibilityConditions({ enabled: !vc.enabled });
            }}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              vc.enabled ? "bg-primary" : "bg-muted"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                vc.enabled ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </label>

        {vc.enabled && (
          <div className="space-y-3">
            {/* Logic selector (only shown when 2+ conditions) */}
            {vc.conditions.length >= 2 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Show when</span>
                <select
                  value={vc.logic}
                  onChange={(e) => updateVisibilityConditions({ logic: e.target.value as "all" | "any" })}
                  className="rounded border border-border bg-background px-2 py-1 text-sm"
                >
                  <option value="all">all conditions match (AND)</option>
                  <option value="any">any condition matches (OR)</option>
                </select>
              </div>
            )}

            {/* Condition cards */}
            {vc.conditions.map((condition, index) => (
              <div key={index} className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-2">
                    {condition.type === "time-schedule" && <><Clock className="h-3.5 w-3.5 text-primary" /> Time Schedule</>}
                    {condition.type === "ha-entity" && <><Zap className="h-3.5 w-3.5 text-primary" /> HA Entity State</>}
                    {condition.type === "spotify-playing" && <><Music className="h-3.5 w-3.5 text-primary" /> Music Playing</>}
                    {condition.type === "calendar-event" && <><Calendar className="h-3.5 w-3.5 text-primary" /> Calendar Event</>}
                  </span>
                  <button
                    onClick={() => removeCondition(index)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Time Schedule condition */}
                {condition.type === "time-schedule" && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="text-xs text-muted-foreground">Show from</span>
                        <input
                          type="time"
                          value={condition.startTime}
                          onChange={(e) => updateCondition(index, { startTime: e.target.value })}
                          className="mt-1 block w-full rounded border border-border bg-background px-3 py-1.5 text-sm"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-muted-foreground">to</span>
                        <input
                          type="time"
                          value={condition.endTime}
                          onChange={(e) => updateCondition(index, { endTime: e.target.value })}
                          className="mt-1 block w-full rounded border border-border bg-background px-3 py-1.5 text-sm"
                        />
                      </label>
                    </div>
                    <p className="text-xs text-muted-foreground">Supports overnight ranges (e.g., 7pm to 7am)</p>
                    <div>
                      <span className="text-xs text-muted-foreground">Days (none = all days)</span>
                      <div className="flex gap-1 mt-1">
                        {["S", "M", "T", "W", "T", "F", "S"].map((label, dayIndex) => {
                          const isSelected = condition.daysOfWeek.includes(dayIndex);
                          return (
                            <button
                              key={dayIndex}
                              onClick={() => {
                                const newDays = isSelected
                                  ? condition.daysOfWeek.filter((d) => d !== dayIndex)
                                  : [...condition.daysOfWeek, dayIndex].sort((a, b) => a - b);
                                updateCondition(index, { daysOfWeek: newDays });
                              }}
                              className={cn(
                                "w-7 h-7 rounded text-xs font-medium transition-colors",
                                isSelected
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground hover:bg-muted/80"
                              )}
                              title={["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayIndex]}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* HA Entity condition */}
                {condition.type === "ha-entity" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={condition.entityId}
                        onChange={(e) => updateCondition(index, { entityId: e.target.value })}
                        placeholder="sensor.temperature"
                        className="flex-1 rounded border border-border bg-background px-3 py-1.5 text-sm"
                      />
                      <button
                        onClick={() => {
                          setEntityBrowserTarget(`__visibility_${index}`);
                          setShowEntityBrowser(true);
                        }}
                        className="px-2 py-1.5 text-xs rounded border border-border hover:bg-muted transition-colors"
                      >
                        Browse
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={condition.operator}
                        onChange={(e) => updateCondition(index, { operator: e.target.value as ComparisonOperator })}
                        className="rounded border border-border bg-background px-2 py-1.5 text-sm"
                      >
                        <option value="eq">is equal to</option>
                        <option value="neq">is not equal to</option>
                        <option value="gt">is greater than</option>
                        <option value="lt">is less than</option>
                        <option value="gte">is &gt;= to</option>
                        <option value="lte">is &lt;= to</option>
                        <option value="contains">contains</option>
                      </select>
                      <input
                        type="text"
                        value={condition.value}
                        onChange={(e) => updateCondition(index, { value: e.target.value })}
                        placeholder="on"
                        className="rounded border border-border bg-background px-3 py-1.5 text-sm"
                      />
                    </div>
                    {/* Live entity state */}
                    {condition.entityId && (() => {
                      const entity = haGetEntityState(condition.entityId);
                      if (!entity) return (
                        <p className="text-xs text-muted-foreground italic">Entity not found or HA not connected</p>
                      );
                      const friendlyName = entity.attributes.friendly_name as string | undefined;
                      const unit = entity.attributes.unit_of_measurement as string | undefined;
                      return (
                        <div className="flex items-center gap-2 rounded bg-muted/50 px-2.5 py-1.5 text-xs">
                          <span className="text-muted-foreground">{friendlyName ?? condition.entityId}:</span>
                          <span className="font-medium text-primary">{entity.state}</span>
                          {unit && (
                            <span className="text-muted-foreground">{unit}</span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Spotify Playing condition */}
                {condition.type === "spotify-playing" && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Show when music is</span>
                    <select
                      value={condition.isPlaying ? "playing" : "not-playing"}
                      onChange={(e) => updateCondition(index, { isPlaying: e.target.value === "playing" })}
                      className="rounded border border-border bg-background px-2 py-1.5 text-sm"
                    >
                      <option value="playing">Playing</option>
                      <option value="not-playing">Not Playing</option>
                    </select>
                  </div>
                )}

                {/* Calendar Event condition */}
                {condition.type === "calendar-event" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Show when event is</span>
                      <select
                        value={condition.hasActiveEvent ? "active" : "inactive"}
                        onChange={(e) => updateCondition(index, { hasActiveEvent: e.target.value === "active" })}
                        className="rounded border border-border bg-background px-2 py-1.5 text-sm"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Not Active</option>
                      </select>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Calendars (none = any calendar)</span>
                      <CalendarConditionPicker
                        selectedIds={condition.calendarIds ?? []}
                        onChange={(ids) => updateCondition(index, { calendarIds: ids })}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Add Condition button */}
            <div className="relative">
              <AddConditionMenu onAdd={addCondition} />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="relative flex h-[70vh] w-full max-w-2xl flex-col rounded-lg bg-card border border-border shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <WidgetIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Edit {definition.name}</h2>
                <p className="text-sm text-muted-foreground capitalize">{definition.category}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1 text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border bg-muted/30">
            <button
              onClick={() => setActiveTab("setup")}
              className={cn(
                "flex-1 px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2",
                activeTab === "setup"
                  ? "text-primary border-b-2 border-primary bg-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
            <button
              onClick={() => setActiveTab("style")}
              className={cn(
                "flex-1 px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2",
                activeTab === "style"
                  ? "text-primary border-b-2 border-primary bg-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Palette className="h-4 w-4" />
              Formatting
            </button>
            <button
              onClick={() => setActiveTab("advanced")}
              className={cn(
                "flex-1 px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2",
                activeTab === "advanced"
                  ? "text-primary border-b-2 border-primary bg-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Clock className="h-4 w-4" />
              Schedule
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === "setup" && renderSetupTab()}
            {activeTab === "style" && renderStyleTab()}
            {activeTab === "advanced" && renderAdvancedTab()}
          </div>

          {/* Footer */}
          <div className="border-t border-border p-4 bg-muted/30 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Entity Browser Modal */}
      {showEntityBrowser && (
        <HAEntityBrowser
          isOpen={showEntityBrowser}
          onClose={() => setShowEntityBrowser(false)}
          onSelect={handleEntitySelect}
        />
      )}

      {/* Album Picker Modal */}
      {showAlbumPicker && (
        <AlbumPicker
          isOpen={showAlbumPicker}
          onClose={() => setShowAlbumPicker(false)}
          onSelect={(albumId) => {
            handleConfigChange("albumId", albumId);
            setShowAlbumPicker(false);
          }}
          selectedAlbumId={widget.config.albumId as string}
        />
      )}
    </>
  );
}
