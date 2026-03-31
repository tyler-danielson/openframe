import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  GripVertical,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Pin,
  PinOff,
  PanelLeft,
  Settings,
  X,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { resolveLucideIcon as sharedResolveLucideIcon } from "../../lib/icon-utils";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api } from "../../services/api";
import {
  useSidebarStore,
  SIDEBAR_FEATURES,
  type SidebarFeature,
} from "../../stores/sidebar";
import { useCalendarStore, type WeekCellWidget } from "../../stores/calendar";
import { useTasksStore, type TasksLayout } from "../../stores/tasks";
import { cn } from "../../lib/utils";
import { parseDakExport, convertDakboardToLayout } from "../../lib/dakboard-import";
import { parseMagicMirrorConfig, convertMagicMirrorToLayout } from "../../lib/magicmirror-import";
import { parseLovelaceConfig, convertLovelaceToLayout } from "../../lib/homeassistant-import";
import { parseOpenFrameScreen, downloadScreenExport } from "../../lib/openframe-screen-io";
import { DEFAULT_LAYOUT_CONFIG, type ScreensaverLayoutConfig } from "../../stores/screensaver";
import { Button } from "../ui/Button";
import { Card, CardContent } from "../ui/Card";
import { Toggle } from "../ui/Toggle";
import type { Calendar, CalendarVisibility, CustomScreen } from "@openframe/shared";

// Built-in feature display info
const BUILTIN_INFO: Record<string, { label: string; iconName: string }> = {
  calendar: { label: "Calendar", iconName: "Calendar" },
  tasks: { label: "Tasks", iconName: "ListTodo" },
  routines: { label: "Routines", iconName: "ListChecks" },
  dashboard: { label: "Dashboard", iconName: "LayoutDashboard" },
  cardview: { label: "Card View", iconName: "Kanban" },
  photos: { label: "Photos", iconName: "Image" },
  spotify: { label: "Spotify", iconName: "Music" },
  iptv: { label: "Live TV", iconName: "Tv" },
  cameras: { label: "Cameras", iconName: "Camera" },
  multiview: { label: "Multi-View", iconName: "LayoutGrid" },
  homeassistant: { label: "Home Assistant", iconName: "Home" },
  matter: { label: "Matter", iconName: "Cpu" },
  map: { label: "Map", iconName: "MapPin" },
  kitchen: { label: "Kitchen", iconName: "ChefHat" },
  chat: { label: "Chat", iconName: "MessageCircle" },
  screensaver: { label: "Custom Screen", iconName: "Monitor" },
};

const SCREENS_WITH_SETTINGS = new Set(["calendar", "tasks"]);

function resolveLucideIcon(name: string): React.ComponentType<{ className?: string }> {
  return sharedResolveLucideIcon(name);
}

interface ScreenItem {
  id: string;
  label: string;
  iconName: string;
  isCustom: boolean;
  customScreen?: CustomScreen;
}

// --- Compact setting controls ---

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 min-h-[28px]">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Sel<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function MiniCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "h-4 w-4 rounded border flex items-center justify-center transition-colors",
        checked
          ? "bg-primary border-primary text-primary-foreground"
          : "border-border bg-background hover:border-primary/50"
      )}
    >
      {checked && (
        <svg className="h-2.5 w-2.5" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

// --- Calendar Settings Modal ---

function CalendarSettingsModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();

  // Calendar store settings
  const view = useCalendarStore((s) => s.view);
  const setView = useCalendarStore((s) => s.setView);
  const weekStartsOn = useCalendarStore((s) => s.weekStartsOn);
  const setWeekStartsOn = useCalendarStore((s) => s.setWeekStartsOn);
  const timeFormat = useCalendarStore((s) => s.timeFormat);
  const setTimeFormat = useCalendarStore((s) => s.setTimeFormat);
  const dayStartHour = useCalendarStore((s) => s.dayStartHour);
  const setDayStartHour = useCalendarStore((s) => s.setDayStartHour);
  const dayEndHour = useCalendarStore((s) => s.dayEndHour);
  const setDayEndHour = useCalendarStore((s) => s.setDayEndHour);
  const showWeekNumbers = useCalendarStore((s) => s.showWeekNumbers);
  const setShowWeekNumbers = useCalendarStore((s) => s.setShowWeekNumbers);
  const weekCellWidget = useCalendarStore((s) => s.weekCellWidget);
  const setWeekCellWidget = useCalendarStore((s) => s.setWeekCellWidget);
  const weekMode = useCalendarStore((s) => s.weekMode);
  const setWeekMode = useCalendarStore((s) => s.setWeekMode);
  const monthMode = useCalendarStore((s) => s.monthMode);
  const setMonthMode = useCalendarStore((s) => s.setMonthMode);
  const showDriveTimeOnNext = useCalendarStore((s) => s.showDriveTimeOnNext);
  const setShowDriveTimeOnNext = useCalendarStore((s) => s.setShowDriveTimeOnNext);
  const defaultEventDuration = useCalendarStore((s) => s.defaultEventDuration);
  const setDefaultEventDuration = useCalendarStore((s) => s.setDefaultEventDuration);

  // Calendars for visibility matrix
  const { data: calendars = [] } = useQuery({
    queryKey: ["calendars"],
    queryFn: () => api.getCalendars(),
  });

  const updateCalMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.updateCalendar>[1] }) =>
      api.updateCalendar(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendars"] });
    },
  });

  const visibleCalendars = useMemo(
    () => calendars.filter((c) => c.isVisible).sort((a, b) => a.name.localeCompare(b.name)),
    [calendars]
  );

  const toggleVisibility = (cal: Calendar, viewKey: keyof CalendarVisibility) => {
    const current = cal.visibility ?? { week: true, month: true, day: true, popup: true, screensaver: false };
    updateCalMutation.mutate({
      id: cal.id,
      data: { visibility: { ...current, [viewKey]: !current[viewKey] } },
    });
  };

  const hourLabel = (h: number) =>
    h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`;
  const hourOptions = Array.from({ length: 24 }, (_, i) => ({ value: String(i), label: hourLabel(i) }));

  const VIEW_COLS: { key: keyof CalendarVisibility; label: string }[] = [
    { key: "week", label: "Wk" },
    { key: "month", label: "Mo" },
    { key: "day", label: "Day" },
    { key: "popup", label: "Pop" },
    { key: "screensaver", label: "SS" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-3xl max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl border border-border bg-card shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-3">
          <h2 className="text-sm font-semibold">Calendar Settings</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          {/* Two-column layout: general settings + visibility matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: General settings */}
            <div className="space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">Display</p>

              <Row label="Default view">
                <Sel value={view} onChange={setView} options={[
                  { value: "month", label: "Month" },
                  { value: "week", label: "Week" },
                  { value: "day", label: "Day" },
                  { value: "agenda", label: "Agenda" },
                  { value: "schedule", label: "Schedule" },
                ]} />
              </Row>

              <Row label="Week starts">
                <Sel
                  value={String(weekStartsOn)}
                  onChange={(v) => setWeekStartsOn(Number(v) as 0 | 1 | 6)}
                  options={[
                    { value: "0", label: "Sunday" },
                    { value: "1", label: "Monday" },
                    { value: "6", label: "Saturday" },
                  ]}
                />
              </Row>

              <Row label="Time format">
                <Sel value={timeFormat} onChange={setTimeFormat} options={[
                  { value: "12h", label: "12h" },
                  { value: "12h-seconds", label: "12h :ss" },
                  { value: "24h", label: "24h" },
                  { value: "24h-seconds", label: "24h :ss" },
                ]} />
              </Row>

              <Row label="Hours shown">
                <div className="flex items-center gap-1.5">
                  <Sel value={String(dayStartHour)} onChange={(v) => setDayStartHour(Number(v))} options={hourOptions} />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Sel value={String(dayEndHour)} onChange={(v) => setDayEndHour(Number(v))} options={hourOptions} />
                </div>
              </Row>

              <Row label="Week mode">
                <Sel value={weekMode} onChange={setWeekMode} options={[
                  { value: "current", label: "Current" },
                  { value: "rolling", label: "Rolling" },
                ]} />
              </Row>

              <Row label="Month mode">
                <Sel value={monthMode} onChange={setMonthMode} options={[
                  { value: "current", label: "Current" },
                  { value: "rolling", label: "Rolling" },
                ]} />
              </Row>

              <Row label="Week widget">
                <Sel value={weekCellWidget} onChange={setWeekCellWidget} options={[
                  { value: "next-week", label: "Next week" },
                  { value: "camera", label: "Camera" },
                  { value: "map", label: "Map" },
                  { value: "spotify", label: "Spotify" },
                  { value: "home-control", label: "Home ctrl" },
                ]} />
              </Row>

              <Row label="Event duration">
                <Sel
                  value={String(defaultEventDuration)}
                  onChange={(v) => setDefaultEventDuration(Number(v))}
                  options={[
                    { value: "15", label: "15 min" },
                    { value: "30", label: "30 min" },
                    { value: "60", label: "1 hr" },
                    { value: "90", label: "1.5 hr" },
                    { value: "120", label: "2 hr" },
                  ]}
                />
              </Row>

              <Row label="Week numbers">
                <Toggle checked={showWeekNumbers} onChange={setShowWeekNumbers} size="sm" />
              </Row>

              <Row label="Drive time">
                <Toggle checked={showDriveTimeOnNext} onChange={setShowDriveTimeOnNext} size="sm" />
              </Row>
            </div>

            {/* Right: Calendar visibility matrix */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">
                Calendar Visibility by View
              </p>

              {visibleCalendars.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4">No calendars found.</p>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  {/* Header row */}
                  <div className="grid items-center bg-muted/40 border-b border-border" style={{ gridTemplateColumns: "1fr repeat(5, 36px)" }}>
                    <div className="px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground">Calendar</div>
                    {VIEW_COLS.map((v) => (
                      <div key={v.key} className="text-center text-[10px] font-medium text-muted-foreground py-1.5">{v.label}</div>
                    ))}
                  </div>

                  {/* Calendar rows */}
                  <div className="max-h-64 overflow-y-auto">
                    {visibleCalendars.map((cal, i) => {
                      const vis = cal.visibility ?? { week: true, month: true, day: true, popup: true, screensaver: false };
                      return (
                        <div
                          key={cal.id}
                          className={cn(
                            "grid items-center",
                            i < visibleCalendars.length - 1 && "border-b border-border/50"
                          )}
                          style={{ gridTemplateColumns: "1fr repeat(5, 36px)" }}
                        >
                          <div className="px-2.5 py-1.5 flex items-center gap-1.5 min-w-0">
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: cal.color }}
                            />
                            <span className="text-xs truncate">{cal.displayName || cal.name}</span>
                          </div>
                          {VIEW_COLS.map((v) => (
                            <div key={v.key} className="flex justify-center py-1.5">
                              <MiniCheckbox
                                checked={vis[v.key]}
                                onChange={() => toggleVisibility(cal, v.key)}
                              />
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Tasks Settings Modal ---

function TasksSettingsModal({ onClose }: { onClose: () => void }) {
  const layout = useTasksStore((s) => s.layout);
  const setLayout = useTasksStore((s) => s.setLayout);
  const showCompleted = useTasksStore((s) => s.showCompleted);
  const setShowCompleted = useTasksStore((s) => s.setShowCompleted);
  const expandAllLists = useTasksStore((s) => s.expandAllLists);
  const setExpandAllLists = useTasksStore((s) => s.setExpandAllLists);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">Tasks Settings</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-2.5">
          <Row label="Layout">
            <Sel value={layout} onChange={setLayout} options={[
              { value: "lists", label: "Lists" },
              { value: "grid", label: "Grid" },
              { value: "columns", label: "Columns" },
              { value: "kanban", label: "Kanban" },
            ]} />
          </Row>

          <Row label="Show completed">
            <Toggle checked={showCompleted} onChange={setShowCompleted} size="sm" />
          </Row>

          <Row label="Expand all lists">
            <Toggle checked={expandAllLists} onChange={setExpandAllLists} size="sm" />
          </Row>
        </div>
      </div>
    </div>
  );
}

// --- Sortable screen item ---

function SortableScreenItem({
  item,
  isPinned,
  isEnabled,
  hasSettings,
  onTogglePin,
  onToggleEnable,
  onOpenSettings,
  onEdit,
  onExport,
  onDelete,
}: {
  item: ScreenItem;
  isPinned: boolean;
  isEnabled: boolean;
  hasSettings: boolean;
  onTogglePin: () => void;
  onToggleEnable: () => void;
  onOpenSettings?: () => void;
  onEdit?: () => void;
  onExport?: () => void;
  onDelete?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = resolveLucideIcon(item.iconName);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border/50 bg-card px-3 py-2.5 transition-colors",
        isDragging && "z-50 shadow-lg border-primary/50",
        !isEnabled && "opacity-50"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground touch-none"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>

      <span className="flex-1 text-sm font-medium">{item.label}</span>

      <div className="flex items-center gap-1">
        {hasSettings && (
          <button
            onClick={onOpenSettings}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            title="Screen settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        )}

        <button
          onClick={onTogglePin}
          className={cn(
            "rounded-md p-1.5 transition-colors",
            isPinned
              ? "text-primary hover:text-primary/80"
              : "text-muted-foreground hover:text-foreground"
          )}
          title={isPinned ? "Unpin from sidebar" : "Pin to sidebar"}
        >
          {isPinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
        </button>

        <button
          onClick={onToggleEnable}
          className={cn(
            "rounded-md p-1.5 transition-colors",
            isEnabled
              ? "text-primary hover:text-primary/80"
              : "text-muted-foreground hover:text-foreground"
          )}
          title={isEnabled ? "Hide screen" : "Show screen"}
        >
          {isEnabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>

        {item.isCustom && onEdit && (
          <button
            onClick={onEdit}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            title="Edit screen"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}

        {item.isCustom && onExport && (
          <button
            onClick={onExport}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            title="Export screen"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        )}

        {item.isCustom && onDelete && (
          <button
            onClick={onDelete}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-destructive"
            title="Delete screen"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// --- Main ScreensTab ---

export function ScreensTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newScreenName, setNewScreenName] = useState("");
  const [settingsModal, setSettingsModal] = useState<string | null>(null);

  const features = useSidebarStore((s) => s.features);
  const order = useSidebarStore((s) => s.order);
  const customScreensState = useSidebarStore((s) => s.customScreens);
  const reorder = useSidebarStore((s) => s.reorder);
  const togglePinned = useSidebarStore((s) => s.togglePinned);
  const toggleEnabled = useSidebarStore((s) => s.toggleEnabled);
  const addCustomScreenToStore = useSidebarStore((s) => s.addCustomScreen);
  const removeCustomScreenFromStore = useSidebarStore((s) => s.removeCustomScreen);
  const setCustomScreenState = useSidebarStore((s) => s.setCustomScreenState);

  const { data: customScreens = [] } = useQuery({
    queryKey: ["custom-screens"],
    queryFn: () => api.getCustomScreens(),
  });

  // Screen import state
  type ImportSource = "openframe" | "dakboard" | "magicmirror" | "homeassistant";
  const [importSource, setImportSource] = useState<ImportSource>("openframe");
  const [importStatus, setImportStatus] = useState<
    | { type: "idle" }
    | { type: "importing" }
    | { type: "success"; name: string; widgetCount: number; details?: string }
    | { type: "error"; message: string }
  >({ type: "idle" });

  const IMPORT_SOURCES: { id: ImportSource; label: string; accept: string; description: string }[] = [
    { id: "openframe", label: "OpenFrame", accept: ".ofscreen", description: "OpenFrame screen export (.ofscreen)" },
    { id: "dakboard", label: "DAKboard", accept: ".dakexport", description: "DAKboard backup (.dakexport)" },
    { id: "magicmirror", label: "MagicMirror", accept: ".js,.json", description: "MagicMirror config.js" },
    { id: "homeassistant", label: "Home Assistant", accept: ".json", description: "Lovelace dashboard JSON" },
  ];

  const handleImport = useCallback(
    async (file: File, source: ImportSource) => {
      setImportStatus({ type: "importing" });
      try {
        const text = await file.text();
        let name: string;
        let layoutConfig: ScreensaverLayoutConfig;
        let widgetCount: number;
        let details: string | undefined;

        switch (source) {
          case "openframe": {
            const result = parseOpenFrameScreen(text);
            name = result.name;
            layoutConfig = result.layoutConfig;
            widgetCount = result.stats.widgetCount;
            break;
          }
          case "dakboard": {
            const data = parseDakExport(text);
            const result = convertDakboardToLayout(data);
            name = result.name;
            layoutConfig = result.layoutConfig;
            widgetCount = result.stats.importedWidgets;
            const parts: string[] = [];
            if (result.stats.skippedDisabled > 0) parts.push(`${result.stats.skippedDisabled} disabled skipped`);
            if (result.stats.skippedUnsupported > 0) parts.push(`${result.stats.skippedUnsupported} unsupported`);
            if (result.stats.unsupportedTypes.length > 0) parts.push(result.stats.unsupportedTypes.join(", "));
            details = parts.length > 0 ? parts.join(" · ") : undefined;
            break;
          }
          case "magicmirror": {
            const config = parseMagicMirrorConfig(text);
            const result = convertMagicMirrorToLayout(config);
            name = result.name;
            layoutConfig = result.layoutConfig;
            widgetCount = result.stats.importedWidgets;
            const parts: string[] = [];
            if (result.stats.skippedDisabled > 0) parts.push(`${result.stats.skippedDisabled} disabled skipped`);
            if (result.stats.skippedUnsupported > 0) parts.push(`${result.stats.skippedUnsupported} unsupported`);
            if (result.stats.unsupportedTypes.length > 0) parts.push(result.stats.unsupportedTypes.join(", "));
            details = parts.length > 0 ? parts.join(" · ") : undefined;
            break;
          }
          case "homeassistant": {
            const config = parseLovelaceConfig(text);
            const result = convertLovelaceToLayout(config);
            name = result.name;
            layoutConfig = result.layoutConfig;
            widgetCount = result.stats.importedWidgets;
            const parts: string[] = [];
            if (result.stats.skippedUnsupported > 0) parts.push(`${result.stats.skippedUnsupported} unsupported`);
            if (result.stats.unsupportedTypes.length > 0) parts.push(result.stats.unsupportedTypes.join(", "));
            if (result.stats.viewsFound > 1) parts.push(`${result.stats.viewsFound} views merged`);
            details = parts.length > 0 ? parts.join(" · ") : undefined;
            break;
          }
        }

        const screen = await api.createCustomScreen({
          name,
          layoutConfig: layoutConfig as unknown as Record<string, unknown>,
        });

        queryClient.invalidateQueries({ queryKey: ["custom-screens"] });
        addCustomScreenToStore(screen.id);
        setImportStatus({ type: "success", name, widgetCount, details });

        setTimeout(() => {
          navigate(`/screen/${screen.slug}/edit`);
        }, 2000);
      } catch (err) {
        setImportStatus({
          type: "error",
          message: err instanceof Error ? err.message : "Import failed",
        });
      }
    },
    [queryClient, addCustomScreenToStore, navigate]
  );

  const createScreen = useMutation({
    mutationFn: (data: { name: string; icon?: string }) => api.createCustomScreen(data),
    onSuccess: (screen) => {
      queryClient.invalidateQueries({ queryKey: ["custom-screens"] });
      addCustomScreenToStore(screen.id);
      setShowAddModal(false);
      setNewScreenName("");
      navigate(`/screen/${screen.slug}/edit`);
    },
  });

  const deleteScreen = useMutation({
    mutationFn: (id: string) => api.deleteCustomScreen(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["custom-screens"] });
      removeCustomScreenFromStore(id);
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const customScreensMap = new Map(customScreens.map((s) => [s.id, s]));

  const effectiveOrder = [...order];
  for (const f of SIDEBAR_FEATURES) {
    if (!effectiveOrder.includes(f)) effectiveOrder.push(f);
  }
  for (const cs of customScreens) {
    if (!effectiveOrder.includes(cs.id)) effectiveOrder.push(cs.id);
  }

  const screenItems: ScreenItem[] = effectiveOrder
    .map((key): ScreenItem | null => {
      const builtin = BUILTIN_INFO[key];
      if (builtin) {
        return { id: key, label: builtin.label, iconName: builtin.iconName, isCustom: false };
      }
      const cs = customScreensMap.get(key);
      if (cs) {
        return { id: cs.id, label: cs.name, iconName: cs.icon, isCustom: true, customScreen: cs };
      }
      return null;
    })
    .filter((x): x is ScreenItem => x !== null);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = effectiveOrder.indexOf(String(active.id));
    const newIndex = effectiveOrder.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    reorder(arrayMove(effectiveOrder, oldIndex, newIndex));
  };

  const getState = (item: ScreenItem): { pinned: boolean; enabled: boolean } => {
    if (item.isCustom) {
      const state = customScreensState[item.id];
      return { pinned: state?.pinned ?? true, enabled: state?.enabled ?? true };
    }
    const state = features[item.id as SidebarFeature];
    return { pinned: state?.pinned ?? true, enabled: state?.enabled ?? true };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <PanelLeft className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">Screens</h2>
          <p className="text-sm text-muted-foreground">
            Drag to reorder, pin to sidebar, or click the gear icon to configure each screen.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Screen
        </Button>
      </div>

      <Card className="border-primary/40">
        <CardContent className="p-3">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={screenItems.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1.5">
                {screenItems.map((item) => {
                  const state = getState(item);
                  const hasSettings = !item.isCustom && SCREENS_WITH_SETTINGS.has(item.id);
                  return (
                    <SortableScreenItem
                      key={item.id}
                      item={item}
                      isPinned={state.pinned}
                      isEnabled={state.enabled}
                      hasSettings={hasSettings}
                      onTogglePin={() => {
                        if (item.isCustom) {
                          setCustomScreenState(item.id, { pinned: !state.pinned });
                        } else {
                          togglePinned(item.id as SidebarFeature);
                        }
                      }}
                      onToggleEnable={() => {
                        if (item.isCustom) {
                          setCustomScreenState(item.id, { enabled: !state.enabled });
                        } else {
                          toggleEnabled(item.id as SidebarFeature);
                        }
                      }}
                      onOpenSettings={hasSettings ? () => setSettingsModal(item.id) : undefined}
                      onEdit={
                        item.isCustom && item.customScreen
                          ? () => navigate(`/screen/${item.customScreen!.slug}/edit`)
                          : undefined
                      }
                      onExport={
                        item.isCustom && item.customScreen
                          ? () => {
                              const cs = item.customScreen!;
                              downloadScreenExport(
                                cs.name,
                                {
                                  ...DEFAULT_LAYOUT_CONFIG,
                                  ...(cs.layoutConfig as Partial<ScreensaverLayoutConfig>),
                                } as ScreensaverLayoutConfig
                              );
                            }
                          : undefined
                      }
                      onDelete={
                        item.isCustom
                          ? () => {
                              if (confirm(`Delete "${item.label}"?`)) {
                                deleteScreen.mutate(item.id);
                              }
                            }
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </CardContent>
      </Card>

      {/* Settings modals */}
      {settingsModal === "calendar" && <CalendarSettingsModal onClose={() => setSettingsModal(null)} />}
      {settingsModal === "tasks" && <TasksSettingsModal onClose={() => setSettingsModal(null)} />}

      {/* Add Screen Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">New Custom Screen</h3>
            <div className="space-y-4">
              {/* Create blank screen */}
              <div>
                <label className="text-sm font-medium text-muted-foreground">Screen Name</label>
                <input
                  type="text"
                  value={newScreenName}
                  onChange={(e) => setNewScreenName(e.target.value)}
                  placeholder="e.g., My Dashboard"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newScreenName.trim()) {
                      createScreen.mutate({ name: newScreenName.trim() });
                    }
                  }}
                />
              </div>

              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  disabled={!newScreenName.trim() || createScreen.isPending}
                  onClick={() => createScreen.mutate({ name: newScreenName.trim() })}
                >
                  {createScreen.isPending ? "Creating..." : "Create & Edit"}
                </Button>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">or import from</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Import section */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <select
                    value={importSource}
                    onChange={(e) => {
                      setImportSource(e.target.value as ImportSource);
                      setImportStatus({ type: "idle" });
                    }}
                    className="w-full appearance-none rounded-md border border-border bg-background px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {IMPORT_SOURCES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={importStatus.type === "importing"}
                  onClick={() => {
                    const source = IMPORT_SOURCES.find((s) => s.id === importSource)!;
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = source.accept;
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) handleImport(file, importSource);
                    };
                    input.click();
                  }}
                >
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Import
                </Button>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                {IMPORT_SOURCES.find((s) => s.id === importSource)?.description}
              </p>

              {/* Import status */}
              {importStatus.type === "importing" && (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  Importing...
                </div>
              )}
              {importStatus.type === "success" && (
                <div className="rounded-md border border-green-500/30 bg-green-500/5 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2 text-green-500 font-medium">
                    <CheckCircle2 className="h-4 w-4" />
                    Imported "{importStatus.name}"
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {importStatus.widgetCount} widgets{importStatus.details && ` · ${importStatus.details}`}
                  </p>
                  <p className="text-xs text-primary mt-1">Opening builder...</p>
                </div>
              )}
              {importStatus.type === "error" && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    {importStatus.message}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAddModal(false);
                    setNewScreenName("");
                    setImportStatus({ type: "idle" });
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
