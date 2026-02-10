import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  Check,
  Eye,
  LayoutTemplate,
  Undo,
  Redo,
  Trash2,
} from "lucide-react";
import { api } from "../services/api";
import { Button } from "../components/ui/Button";
import { TemplateGallery } from "../components/planner/TemplateGallery";
import { LayoutSettings } from "../components/planner/LayoutSettings";
import { PlannerPreview } from "../components/planner/PlannerPreview";
import { PlannerLiveEditor } from "../components/planner/PlannerLiveEditor";
import { CalendarMultiSelect } from "../components/planner/CalendarMultiSelect";
import { TaskListMultiSelect } from "../components/planner/TaskListMultiSelect";
import { NewsFeedCategoryMultiSelect } from "../components/planner/NewsFeedCategoryMultiSelect";
import { DEFAULT_PLANNER_CONFIG } from "../lib/planner/templates";
import type { PlannerLayoutConfig, PlannerWidgetInstance } from "@openframe/shared";

export function PlannerBuilderPage() {
  const { profileId } = useParams<{ profileId: string }>();
  const navigate = useNavigate();

  // Local state for layout config
  const [layoutConfig, setLayoutConfig] = useState<PlannerLayoutConfig>(DEFAULT_PLANNER_CONFIG);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [history, setHistory] = useState<PlannerLayoutConfig[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Refs for autosave
  const layoutConfigRef = useRef<PlannerLayoutConfig>(DEFAULT_PLANNER_CONFIG);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoadRef = useRef(true);

  // Fetch profile
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile", profileId],
    queryFn: () => api.getProfile(profileId!),
    enabled: !!profileId,
  });

  // Fetch planner config
  const { data: serverConfig, isLoading: configLoading } = useQuery({
    queryKey: ["profile-planner", profileId],
    queryFn: () => api.getProfilePlanner(profileId!),
    enabled: !!profileId,
  });

  // Update layout config when server data loads
  useEffect(() => {
    if (serverConfig) {
      const config = {
        ...DEFAULT_PLANNER_CONFIG,
        ...serverConfig,
      };
      setLayoutConfig(config);
      layoutConfigRef.current = config;
      setHistory([config]);
      setHistoryIndex(0);
      // Mark initial load complete after a short delay
      setTimeout(() => {
        isInitialLoadRef.current = false;
      }, 100);
    }
  }, [serverConfig]);

  // Auto-save with debounce
  useEffect(() => {
    // Don't auto-save on initial load or if no profile
    if (isInitialLoadRef.current || !profileId || configLoading) return;

    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaveStatus("saving");

    // Debounce save by 1 second
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await api.updateProfilePlanner(profileId, layoutConfigRef.current);
        setSaveStatus("saved");
        // Reset to idle after showing "saved" briefly
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (error) {
        console.error("[PlannerBuilder] Failed to auto-save:", error);
        setSaveStatus("idle");
      }
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [profileId, configLoading, layoutConfig]);

  // Handle preview
  const handlePreview = useCallback(() => {
    setShowPreview(true);
  }, []);

  // Push history state
  const pushHistory = useCallback((newConfig: PlannerLayoutConfig) => {
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(newConfig);
      return newHistory.slice(-50); // Keep last 50 states
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 49));
  }, [historyIndex]);

  // Update layout with history
  const updateLayout = useCallback((updates: Partial<PlannerLayoutConfig>) => {
    setLayoutConfig((prev) => {
      const newConfig = { ...prev, ...updates };
      pushHistory(newConfig);
      layoutConfigRef.current = newConfig;
      return newConfig;
    });
  }, [pushHistory]);

  // Update widget
  const updateWidget = useCallback((id: string, updates: Partial<PlannerWidgetInstance>) => {
    const newWidgets = layoutConfig.widgets.map((w) =>
      w.id === id ? { ...w, ...updates } : w
    );
    updateLayout({ widgets: newWidgets });
  }, [layoutConfig.widgets, updateLayout]);

  // Delete widget
  const deleteWidget = useCallback((id: string) => {
    const newWidgets = layoutConfig.widgets.filter((w) => w.id !== id);
    updateLayout({ widgets: newWidgets });
    if (selectedWidgetId === id) {
      setSelectedWidgetId(null);
    }
  }, [layoutConfig.widgets, selectedWidgetId, updateLayout]);

  // Undo/Redo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex((prev) => prev - 1);
      const prevConfig = history[historyIndex - 1];
      if (prevConfig) {
        setLayoutConfig(prevConfig);
        layoutConfigRef.current = prevConfig;
      }
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex((prev) => prev + 1);
      const nextConfig = history[historyIndex + 1];
      if (nextConfig) {
        setLayoutConfig(nextConfig);
        layoutConfigRef.current = nextConfig;
      }
    }
  }, [history, historyIndex]);

  // Load template
  const loadTemplate = useCallback((config: PlannerLayoutConfig) => {
    setLayoutConfig(config);
    layoutConfigRef.current = config;
    pushHistory(config);
    setShowTemplateGallery(false);
    setSelectedWidgetId(null);
  }, [pushHistory]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Close preview with ESC
      if (e.key === "Escape") {
        setShowPreview(false);
        setShowTemplateGallery(false);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedWidgetId && document.activeElement?.tagName !== "INPUT") {
          deleteWidget(selectedWidgetId);
        }
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z") {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        }
        // Ctrl+S is now handled by autosave, but prevent default browser behavior
        if (e.key === "s") {
          e.preventDefault();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedWidgetId, deleteWidget, undo, redo]);

  const isLoading = profileLoading || configLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Profile not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/profiles")}>
            Back to Profiles
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/profiles")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-xl">{profile.icon || "👤"}</span>
            <h1 className="font-semibold">{profile.name}'s Planner</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Save status indicator */}
          <div className="w-20 flex justify-end">
            {saveStatus === "saving" && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving...
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <Check className="h-3 w-3" />
                Saved
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={undo}
            disabled={historyIndex <= 0}
            title="Undo (Ctrl+Z)"
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo className="h-4 w-4" />
          </Button>
          <div className="w-px h-6 bg-border mx-2" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTemplateGallery(true)}
          >
            <LayoutTemplate className="h-4 w-4 mr-2" />
            Templates
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreview}
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Live Editor - takes full width */}
        <div className="flex-1 overflow-hidden">
          <PlannerLiveEditor
            layoutConfig={layoutConfig}
            selectedWidgetId={selectedWidgetId}
            onSelectWidget={setSelectedWidgetId}
            onUpdateWidget={updateWidget}
            onUpdateLayout={updateLayout}
          />
        </div>

        {/* Right sidebar: Widget config or Layout settings */}
        <div className="w-72 border-l border-border bg-card p-4 overflow-auto">
          {selectedWidgetId ? (
            <WidgetConfigPanel
              widget={layoutConfig.widgets.find((w) => w.id === selectedWidgetId)!}
              onUpdate={(updates) => updateWidget(selectedWidgetId, updates)}
              onDelete={() => deleteWidget(selectedWidgetId)}
            />
          ) : (
            <LayoutSettings
              layoutConfig={layoutConfig}
              onUpdateConfig={updateLayout}
            />
          )}
        </div>
      </div>

      {/* Template gallery modal */}
      {showTemplateGallery && (
        <TemplateGallery
          onSelect={loadTemplate}
          onClose={() => setShowTemplateGallery(false)}
        />
      )}

      {showPreview && (
        <PlannerPreview
          layoutConfig={layoutConfig}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}

// Widget configuration panel
interface WidgetConfigPanelProps {
  widget: PlannerWidgetInstance;
  onUpdate: (updates: Partial<PlannerWidgetInstance>) => void;
  onDelete: () => void;
}

function WidgetConfigPanel({ widget, onUpdate, onDelete }: WidgetConfigPanelProps) {
  const updateConfig = (key: string, value: unknown) => {
    onUpdate({ config: { ...widget.config, [key]: value } });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium capitalize">{widget.type.replace("-", " ")}</h3>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      {/* Position/Size */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Position</label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">X</label>
            <input
              type="number"
              value={widget.x}
              onChange={(e) => onUpdate({ x: parseInt(e.target.value) || 0 })}
              min={0}
              className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Y</label>
            <input
              type="number"
              value={widget.y}
              onChange={(e) => onUpdate({ y: parseInt(e.target.value) || 0 })}
              min={0}
              className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Width</label>
            <input
              type="number"
              value={widget.width}
              onChange={(e) => onUpdate({ width: parseInt(e.target.value) || 1 })}
              min={1}
              className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Height</label>
            <input
              type="number"
              value={widget.height}
              onChange={(e) => onUpdate({ height: parseInt(e.target.value) || 1 })}
              min={1}
              className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
            />
          </div>
        </div>
      </div>

      {/* Type-specific config */}
      {widget.type === "text" && (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium">Text</label>
            <input
              type="text"
              value={(widget.config.text as string) || ""}
              onChange={(e) => updateConfig("text", e.target.value)}
              placeholder="Enter text..."
              className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
            />
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Use date tokens in placeholders:</p>
              <ul className="list-none space-y-0.5 text-[10px] font-mono bg-muted/50 rounded p-1.5">
                <li><code>W/WW</code> → 06 (week number)</li>
                <li><code>D</code> → 9 | <code>DD</code> → 09 (day)</li>
                <li><code>M</code> → 2 | <code>MM</code> → 02 (month)</li>
                <li><code>MMM</code> → Feb | <code>MMMM</code> → February</li>
                <li><code>YY</code> → 26 | <code>YYYY</code> → 2026</li>
                <li><code>ddd</code> → Mon | <code>dddd</code> → Monday</li>
              </ul>
              <p className="text-[10px]">Combine tokens: <code>{"{{date:W MMMM YYYY}}"}</code> → 06 February 2026</p>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Font Size</label>
            <select
              value={(widget.config.fontSize as string) || "lg"}
              onChange={(e) => updateConfig("fontSize", e.target.value)}
              className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
            >
              <option value="sm">Small</option>
              <option value="base">Normal</option>
              <option value="lg">Large</option>
              <option value="xl">X-Large</option>
              <option value="2xl">2X-Large</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Alignment</label>
            <select
              value={(widget.config.alignment as string) || "center"}
              onChange={(e) => updateConfig("alignment", e.target.value)}
              className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Font Weight</label>
            <select
              value={(widget.config.fontWeight as string) || "bold"}
              onChange={(e) => updateConfig("fontWeight", e.target.value)}
              className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
            >
              <option value="normal">Normal</option>
              <option value="medium">Medium</option>
              <option value="semibold">Semibold</option>
              <option value="bold">Bold</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Background</label>
            <select
              value={(widget.config.background as string) || "none"}
              onChange={(e) => updateConfig("background", e.target.value)}
              className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
            >
              <option value="none">None</option>
              <option value="light">Light Gray</option>
              <option value="accent">Accent Color</option>
              <option value="dark">Dark</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Border</label>
            <select
              value={(widget.config.border as string) || "none"}
              onChange={(e) => updateConfig("border", e.target.value)}
              className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
            >
              <option value="none">None</option>
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="double">Double</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Border Radius</label>
            <select
              value={(widget.config.borderRadius as string) || "none"}
              onChange={(e) => updateConfig("borderRadius", e.target.value)}
              className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
            >
              <option value="none">None</option>
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
              <option value="full">Pill</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Padding</label>
            <select
              value={(widget.config.padding as string) || "md"}
              onChange={(e) => updateConfig("padding", e.target.value)}
              className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
            >
              <option value="none">None</option>
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
            </select>
          </div>
        </>
      )}

      {widget.type === "notes" && (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <input
              type="text"
              value={(widget.config.title as string) || "Notes"}
              onChange={(e) => updateConfig("title", e.target.value)}
              className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Line Style</label>
            <select
              value={(widget.config.lineStyle as string) || "ruled"}
              onChange={(e) => updateConfig("lineStyle", e.target.value)}
              className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
            >
              <option value="ruled">Ruled</option>
              <option value="dotted">Dotted</option>
              <option value="grid">Grid</option>
              <option value="blank">Blank</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Line Spacing (px)</label>
            <input
              type="number"
              value={(widget.config.lineSpacing as number) || 20}
              onChange={(e) => updateConfig("lineSpacing", parseInt(e.target.value) || 20)}
              min={12}
              max={40}
              className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
            />
          </div>
        </>
      )}

      {widget.type === "tasks" && (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <input
              type="text"
              value={(widget.config.title as string) || "Tasks"}
              onChange={(e) => updateConfig("title", e.target.value)}
              className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Max Items</label>
            <input
              type="number"
              value={(widget.config.maxItems as number) || 10}
              onChange={(e) => updateConfig("maxItems", parseInt(e.target.value) || 10)}
              min={1}
              max={50}
              className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showCheckboxes"
              checked={(widget.config.showCheckboxes as boolean) !== false}
              onChange={(e) => updateConfig("showCheckboxes", e.target.checked)}
              className="rounded border-border"
            />
            <label htmlFor="showCheckboxes" className="text-sm">Show checkboxes</label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showDueDate"
              checked={(widget.config.showDueDate as boolean) !== false}
              onChange={(e) => updateConfig("showDueDate", e.target.checked)}
              className="rounded border-border"
            />
            <label htmlFor="showDueDate" className="text-sm">Show due dates</label>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Task Lists</label>
            <TaskListMultiSelect
              selectedIds={(widget.config.taskListIds as string[]) || []}
              onChange={(ids) => updateConfig("taskListIds", ids)}
            />
            <p className="text-xs text-muted-foreground">
              Select lists to show synced tasks, or leave empty for manual entry
            </p>
          </div>
        </>
      )}

      {widget.type === "news-headlines" && (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <input
              type="text"
              value={(widget.config.title as string) || "Headlines"}
              onChange={(e) => updateConfig("title", e.target.value)}
              className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Max Items</label>
            <input
              type="number"
              value={(widget.config.maxItems as number) || 5}
              onChange={(e) => updateConfig("maxItems", parseInt(e.target.value) || 5)}
              min={1}
              max={20}
              className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="sidebarShowSource"
              checked={(widget.config.showSource as boolean) !== false}
              onChange={(e) => updateConfig("showSource", e.target.checked)}
              className="rounded border-border"
            />
            <label htmlFor="sidebarShowSource" className="text-sm">Show source name</label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="sidebarShowTime"
              checked={(widget.config.showTime as boolean) !== false}
              onChange={(e) => updateConfig("showTime", e.target.checked)}
              className="rounded border-border"
            />
            <label htmlFor="sidebarShowTime" className="text-sm">Show time ago</label>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Categories</label>
            <NewsFeedCategoryMultiSelect
              selectedCategories={(widget.config.categories as string[]) || []}
              onChange={(categories) => updateConfig("categories", categories)}
            />
            <p className="text-xs text-muted-foreground">
              Filter by category or leave empty for all
            </p>
          </div>
        </>
      )}

      {widget.type === "calendar-day" && (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <input
              type="text"
              value={(widget.config.title as string) || "Schedule"}
              onChange={(e) => updateConfig("title", e.target.value)}
              className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Start Hour</label>
              <input
                type="number"
                value={(widget.config.startHour as number) ?? 6}
                onChange={(e) => updateConfig("startHour", parseInt(e.target.value) || 0)}
                min={0}
                max={23}
                className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">End Hour</label>
              <input
                type="number"
                value={(widget.config.endHour as number) ?? 22}
                onChange={(e) => updateConfig("endHour", parseInt(e.target.value) || 24)}
                min={1}
                max={24}
                className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="fillHeight"
              checked={(widget.config.fillHeight as boolean) !== false}
              onChange={(e) => updateConfig("fillHeight", e.target.checked)}
              className="rounded border-border"
            />
            <label htmlFor="fillHeight" className="text-sm">Fill available height</label>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Calendars</label>
            <CalendarMultiSelect
              selectedIds={(widget.config.calendarIds as string[]) || []}
              onChange={(ids) => updateConfig("calendarIds", ids)}
            />
          </div>
        </>
      )}

      {widget.type === "habits" && (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <input
              type="text"
              value={(widget.config.title as string) || "Self-Care"}
              onChange={(e) => updateConfig("title", e.target.value)}
              className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Habits (one per line)</label>
            <textarea
              value={((widget.config.habits as string[]) || []).join("\n")}
              onChange={(e) => updateConfig("habits", e.target.value.split("\n").filter(Boolean))}
              rows={5}
              className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm resize-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Columns</label>
            <input
              type="number"
              value={(widget.config.columns as number) || 2}
              onChange={(e) => updateConfig("columns", parseInt(e.target.value) || 2)}
              min={1}
              max={6}
              className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showLabels"
              checked={(widget.config.showLabels as boolean) === true}
              onChange={(e) => updateConfig("showLabels", e.target.checked)}
              className="rounded border-border"
            />
            <label htmlFor="showLabels" className="text-sm">Show text labels</label>
          </div>
        </>
      )}
    </div>
  );
}
