import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { RefreshCw, Key, Plus, ExternalLink, User, Calendar, Monitor, Image as ImageIcon, Tv, FolderOpen, CheckCircle, XCircle, LogIn, Video, Home, Trash2, Loader2, Star, Search, ListTodo, List, LayoutGrid, Columns3, Kanban, Music, Pencil, Speaker, Smartphone, ChevronDown, ChevronUp, ChevronRight, Settings, Sparkles, Crown, Trophy, Eye, EyeOff, Play, Zap, Clock, Power, Bell, ToggleLeft, ToggleRight, Newspaper, Rss, Globe, Palette, MapPin, Cloud, MessageCircle, PenTool, X, Download, Upload, HardDrive, AlertTriangle, Check, Tablet, Link2, Unlink, QrCode, Copy, ArrowLeft, PanelLeft, Camera as CameraIcon, LayoutDashboard, ChefHat, CreditCard, Server, Puzzle, LifeBuoy, Send, Lightbulb } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { Camera } from "@openframe/shared";
import { api, type SettingCategoryDefinition, type SystemSetting, type HAAvailableCamera, COLOR_SCHEMES, type ColorScheme, type Kiosk, type KioskDisplayMode, type KioskDisplayType, type KioskEnabledFeatures, type CompanionUser, type CompanionPermissions, type CloudInstance, type CloudBillingInfo, type PlanLimits, type SupportTicketSummary, type MyTicketDetail } from "../services/api";
import { useAuthStore } from "../stores/auth";
import { isCloudMode, appPath, appUrl } from "../lib/cloud";
import { useCalendarStore, type WeekCellWidget } from "../stores/calendar";
import { useScreensaverStore, type ScreensaverLayout, type ScreensaverTransition, type ClockPosition, type ClockSize, type InfoPaneWidget, type InfoPaneWidgetConfig, type WidgetSize, type WidgetGridSize, LIST_WIDGETS, DEFAULT_WIDGET_CONFIGS, type CompositeWidgetId, type CompositeWidgetConfig, type SubItemConfig, DEFAULT_COMPOSITE_CONFIGS, DEFAULT_SUB_ITEMS } from "../stores/screensaver";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, BookOpen } from "lucide-react";
import { Toggle, ToggleGroup } from "../components/ui/Toggle";
import { useTasksStore, type TasksLayout } from "../stores/tasks";
import { useSidebarStore, SIDEBAR_FEATURES, type SidebarFeature } from "../stores/sidebar";
import { useEntertainmentStore, type EntertainmentFeature } from "../stores/entertainment";
import { cn } from "../lib/utils";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { LocalPhotoAlbums } from "../components/photos/LocalPhotoAlbums";
import { AlbumPhotoGrid } from "../components/photos/AlbumPhotoGrid";
import { ManageAllPhotos } from "../components/photos/ManageAllPhotos";
import { EntityPicker } from "../components/homeassistant/EntityPicker";
import { TeamSelector, FavoriteTeamCard } from "../components/sports";
import { CalendarAccountsList } from "../components/settings/CalendarAccountsList";
import { CalendarListForAccount } from "../components/settings/CalendarListForAccount";
import { AddAccountModal } from "../components/settings/AddAccountModal";
import { HACalendarModal } from "../components/settings/HACalendarModal";
import { SupportButton } from "../components/settings/SupportButton";
import { HandwritingCanvas } from "../components/ui/HandwritingCanvas";
import { useHAWebSocket } from "../stores/homeassistant-ws";
import { useModuleStore } from "../stores/modules";
import { MODULE_REGISTRY, MODULE_CATEGORIES, type ModuleId } from "@openframe/shared";
import type { CalendarProvider } from "@openframe/shared";
import { buildOAuthUrl } from "../utils/oauth-scopes";
import type { HomeAssistantRoom, FavoriteSportsTeam, Automation, AutomationParseResult, AutomationTriggerType, AutomationActionType, TimeTriggerConfig, StateTriggerConfig, DurationTriggerConfig, ServiceCallActionConfig, NotificationActionConfig, NewsFeed, PresetFeed, ExportedSettings } from "@openframe/shared";

// Parent tabs for URL routing
type SettingsTab = "account" | "calendars" | "tasks" | "modules" | "entertainment" | "appearance" | "ai" | "assumptions" | "automations" | "cameras" | "homeassistant" | "kiosks" | "companion" | "cloud" | "system" | "billing" | "instances" | "support";

// Entertainment sub-tabs
type EntertainmentSubTab = "sports" | "spotify" | "iptv" | "plex" | "audiobookshelf" | "news";

// Appearance sub-tabs
type AppearanceSubTab = "display" | "photos" | "screensaver" | "sidebar";

const validTabs: SettingsTab[] = ["account", "calendars", "tasks", "modules", "entertainment", "appearance", "ai", "assumptions", "automations", "cameras", "homeassistant", "kiosks", "companion", "cloud", "system", "billing", "instances", "support"];
const validEntertainmentSubTabs: EntertainmentSubTab[] = ["sports", "spotify", "iptv", "plex", "audiobookshelf", "news"];
const validAppearanceSubTabs: AppearanceSubTab[] = ["display", "photos", "screensaver", "sidebar"];

const allTabs: { id: SettingsTab; label: string; icon: React.ReactNode; description: string; cloudOnly?: boolean; selfHostedOnly?: boolean; moduleId?: string | null }[] = [
  { id: "account", label: "Account", icon: <User className="h-4 w-4" />, description: "Profile & login" },
  { id: "calendars", label: "Calendars", icon: <Calendar className="h-4 w-4" />, description: "Sources & sync" },
  { id: "tasks", label: "Tasks", icon: <ListTodo className="h-4 w-4" />, description: "Lists & layout" },
  { id: "modules", label: "Modules", icon: <Puzzle className="h-4 w-4" />, description: "Add & manage features" },
  { id: "entertainment", label: "Entertainment", icon: <Play className="h-4 w-4" />, description: "Sports, music & media", moduleId: "__entertainment__" },
  { id: "appearance", label: "Appearance", icon: <Monitor className="h-4 w-4" />, description: "Theme, photos & screensaver" },
  { id: "ai", label: "AI", icon: <Sparkles className="h-4 w-4" />, description: "Assistant & models", moduleId: "__ai__" },
  { id: "assumptions", label: "Assumptions", icon: <Lightbulb className="h-4 w-4" />, description: "AI behavior rules" },
  { id: "automations", label: "Automations", icon: <Zap className="h-4 w-4" />, description: "Triggers & actions", moduleId: "automations" },
  { id: "cameras", label: "Cameras", icon: <Video className="h-4 w-4" />, description: "Feeds & streams", moduleId: "cameras" },
  { id: "homeassistant", label: "Home Assistant", icon: <Home className="h-4 w-4" />, description: "Devices & entities", moduleId: "homeassistant" },
  { id: "kiosks", label: "Kiosks", icon: <Monitor className="h-4 w-4" />, description: "Displays & remote" },
  { id: "companion", label: "Companion", icon: <Smartphone className="h-4 w-4" />, description: "Mobile app access", moduleId: "companion" },
  { id: "billing", label: "Billing", icon: <CreditCard className="h-4 w-4" />, description: "Plan & subscription", cloudOnly: true },
  { id: "instances", label: "Instances", icon: <Server className="h-4 w-4" />, description: "Linked instances", cloudOnly: true },
  { id: "cloud", label: "Cloud", icon: <Cloud className="h-4 w-4" />, description: "Remote management", selfHostedOnly: true },
  { id: "system", label: "System", icon: <Settings className="h-4 w-4" />, description: "Backup & advanced", selfHostedOnly: true },
  { id: "support", label: "Support", icon: <LifeBuoy className="h-4 w-4" />, description: "Help & tickets", cloudOnly: true, moduleId: null },
];

// Entertainment module IDs — show tab if any are enabled
const ENTERTAINMENT_MODULE_IDS = ["spotify", "iptv", "youtube", "plex", "audiobookshelf", "sports", "news"];
// AI module IDs — show tab if any are enabled
const AI_MODULE_IDS = ["ai-chat", "ai-briefing", "gmail", "telegram", "capacities"];

function useFilteredTabs() {
  const isModuleEnabled = useModuleStore((s) => s.isEnabled);
  return useMemo(() => {
    return allTabs.filter((tab) => {
      if (isCloudMode && tab.selfHostedOnly) return false;
      if (!isCloudMode && tab.cloudOnly) return false;
      // Module gating
      if (tab.moduleId === "__entertainment__") {
        return ENTERTAINMENT_MODULE_IDS.some((id) => isModuleEnabled(id));
      }
      if (tab.moduleId === "__ai__") {
        return AI_MODULE_IDS.some((id) => isModuleEnabled(id));
      }
      if (tab.moduleId) {
        return isModuleEnabled(tab.moduleId);
      }
      return true;
    });
  }, [isModuleEnabled]);
}

// Static fallback for initial render (used where hooks can't be called)
const tabs = allTabs.filter((tab) => {
  if (isCloudMode && tab.selfHostedOnly) return false;
  if (!isCloudMode && tab.cloudOnly) return false;
  return true;
});

// Sub-tab config for entertainment
const entertainmentSubTabs: { id: EntertainmentSubTab; label: string; icon: React.ReactNode }[] = [
  { id: "sports", label: "Sports", icon: <Trophy className="h-4 w-4" /> },
  { id: "spotify", label: "Spotify", icon: <Music className="h-4 w-4" /> },
  { id: "iptv", label: "IPTV", icon: <Tv className="h-4 w-4" /> },
  { id: "plex", label: "Plex", icon: <Play className="h-4 w-4" /> },
  { id: "audiobookshelf", label: "Audiobookshelf", icon: <BookOpen className="h-4 w-4" /> },
  { id: "news", label: "News", icon: <Newspaper className="h-4 w-4" /> },
];

// Sub-tab config for appearance
const appearanceSubTabs: { id: AppearanceSubTab; label: string; icon: React.ReactNode }[] = [
  { id: "display", label: "Display", icon: <Monitor className="h-4 w-4" /> },
  { id: "photos", label: "Photos", icon: <ImageIcon className="h-4 w-4" /> },
  { id: "screensaver", label: "Screensaver", icon: <Tv className="h-4 w-4" /> },
  { id: "sidebar", label: "Sidebar", icon: <PanelLeft className="h-4 w-4" /> },
];

// Widget labels and icons for the builder (legacy)
const WIDGET_INFO: Record<InfoPaneWidget, { label: string; icon: string }> = {
  clock: { label: "Clock", icon: "🕐" },
  weather: { label: "Weather", icon: "🌤️" },
  forecast: { label: "Forecast", icon: "📊" },
  sports: { label: "Sports", icon: "🏈" },
  events: { label: "Events", icon: "📅" },
  spotify: { label: "Spotify", icon: "🎵" },
  tasks: { label: "Tasks", icon: "✓" },
  notes: { label: "Notes", icon: "📝" },
};

// Sidebar feature info for settings UI
const SIDEBAR_FEATURE_INFO: { feature: SidebarFeature; label: string; icon: React.ReactNode }[] = [
  { feature: "calendar", label: "Calendar", icon: <Calendar className="h-4 w-4" /> },
  { feature: "tasks", label: "Tasks", icon: <ListTodo className="h-4 w-4" /> },
  { feature: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { feature: "photos", label: "Photos", icon: <ImageIcon className="h-4 w-4" /> },
  { feature: "spotify", label: "Spotify", icon: <Music className="h-4 w-4" /> },
  { feature: "iptv", label: "Live TV", icon: <Tv className="h-4 w-4" /> },
  { feature: "cameras", label: "Cameras", icon: <CameraIcon className="h-4 w-4" /> },
  { feature: "multiview", label: "Multi-View", icon: <LayoutGrid className="h-4 w-4" /> },
  { feature: "homeassistant", label: "Home Assistant", icon: <Home className="h-4 w-4" /> },
  { feature: "map", label: "Map", icon: <MapPin className="h-4 w-4" /> },
  { feature: "kitchen", label: "Kitchen", icon: <ChefHat className="h-4 w-4" /> },
  { feature: "chat", label: "Chat", icon: <MessageCircle className="h-4 w-4" /> },
  { feature: "screensaver", label: "Custom", icon: <Monitor className="h-4 w-4" /> },
];

// Composite widget info (v2)
const COMPOSITE_WIDGET_INFO: Record<CompositeWidgetId, {
  label: string;
  icon: string;
  description: string;
  subItems?: { id: string; label: string; hasMaxItems?: boolean }[];
}> = {
  clock: { label: "Clock", icon: "🕐", description: "Time and date" },
  weather: {
    label: "Weather", icon: "🌤️", description: "Conditions and forecast",
    subItems: [
      { id: "current", label: "Current Conditions" },
      { id: "forecast", label: "Today's Forecast" },
    ],
  },
  schedule: {
    label: "Schedule", icon: "📅", description: "Events, sports, tasks",
    subItems: [
      { id: "events", label: "Calendar Events", hasMaxItems: true },
      { id: "sports", label: "Sports Scores", hasMaxItems: true },
      { id: "tasks", label: "Tasks Due", hasMaxItems: true },
    ],
  },
  media: {
    label: "Media", icon: "🎵", description: "Now playing",
    subItems: [{ id: "spotify", label: "Spotify" }],
  },
  controls: { label: "TV Controls", icon: "🎮", description: "Remote control reference" },
};

// Sortable widget card component
function SortableWidgetCard({
  config,
  onUpdate,
}: {
  config: InfoPaneWidgetConfig;
  onUpdate: (id: InfoPaneWidget, updates: Partial<InfoPaneWidgetConfig>) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: config.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const widgetInfo = WIDGET_INFO[config.id];
  const isListWidget = LIST_WIDGETS.includes(config.id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 border rounded-lg bg-background ${
        config.enabled ? "border-primary/50" : "border-border"
      } ${isDragging ? "shadow-lg" : ""}`}
    >
      {/* Drag handle */}
      <button
        type="button"
        {...listeners}
        {...attributes}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      {/* Widget icon and name */}
      <div className="flex items-center gap-2 min-w-[100px]">
        <span className="text-lg">{widgetInfo.icon}</span>
        <span className="text-sm font-medium">{widgetInfo.label}</span>
      </div>

      {/* Enable/disable toggle */}
      <button
        type="button"
        role="switch"
        aria-checked={config.enabled}
        onClick={() => onUpdate(config.id, { enabled: !config.enabled })}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          config.enabled ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            config.enabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>

      {/* Size selector */}
      <select
        value={config.size}
        onChange={(e) => onUpdate(config.id, { size: e.target.value as WidgetSize })}
        disabled={!config.enabled}
        className={`rounded-md border border-border bg-background px-2 py-1 text-sm min-w-[70px] ${
          !config.enabled ? "opacity-50" : ""
        }`}
      >
        <option value="small">S</option>
        <option value="medium">M</option>
        <option value="large">L</option>
      </select>

      {/* Max items slider (only for list widgets) */}
      {isListWidget && (
        <div className={`flex items-center gap-2 ${!config.enabled ? "opacity-50" : ""}`}>
          <span className="text-xs text-muted-foreground whitespace-nowrap">Max:</span>
          <input
            type="range"
            min={1}
            max={5}
            value={config.maxItems ?? 3}
            onChange={(e) => onUpdate(config.id, { maxItems: Number(e.target.value) })}
            disabled={!config.enabled}
            className="w-16 h-2"
          />
          <span className="text-xs font-medium w-4">{config.maxItems ?? 3}</span>
        </div>
      )}
    </div>
  );
}

// Sortable composite widget card component (v2)
function SortableCompositeWidgetCard({
  config,
  onUpdate,
  onUpdateSubItem,
}: {
  config: CompositeWidgetConfig;
  onUpdate: (id: CompositeWidgetId, updates: Partial<CompositeWidgetConfig>) => void;
  onUpdateSubItem: (widgetId: CompositeWidgetId, subItemId: string, updates: Partial<SubItemConfig>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: config.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const widgetInfo = COMPOSITE_WIDGET_INFO[config.id];
  const hasSubItems = widgetInfo.subItems && widgetInfo.subItems.length > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border rounded-lg bg-background ${
        config.enabled ? "border-primary/50" : "border-border"
      } ${isDragging ? "shadow-lg" : ""}`}
    >
      <div className="flex items-center gap-3 p-3">
        {/* Drag handle */}
        <button
          type="button"
          {...listeners}
          {...attributes}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
        >
          <GripVertical className="h-5 w-5" />
        </button>

        {/* Widget icon and name */}
        <div className="flex items-center gap-2 min-w-[100px]">
          <span className="text-lg">{widgetInfo.icon}</span>
          <div>
            <span className="text-sm font-medium">{widgetInfo.label}</span>
            <span className="text-xs text-muted-foreground block">{widgetInfo.description}</span>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Size selector */}
        <select
          value={config.size}
          onChange={(e) => onUpdate(config.id, { size: e.target.value as WidgetSize })}
          disabled={!config.enabled}
          className={`rounded-md border border-border bg-background px-2 py-1 text-sm min-w-[70px] ${
            !config.enabled ? "opacity-50" : ""
          }`}
        >
          <option value="small">S</option>
          <option value="medium">M</option>
          <option value="large">L</option>
        </select>

        {/* Enable/disable toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={config.enabled}
          onClick={() => onUpdate(config.id, { enabled: !config.enabled })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            config.enabled ? "bg-primary" : "bg-muted"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              config.enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>

        {/* Expand button for sub-items */}
        {hasSubItems && config.enabled && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground hover:text-foreground p-1"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* Sub-items section */}
      {hasSubItems && config.enabled && expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border/50 space-y-2 ml-8">
          {widgetInfo.subItems!.map((subItem) => {
            const subItemConfig = config.subItems?.[subItem.id] ?? { enabled: true };
            return (
              <div key={subItem.id} className="flex items-center gap-3">
                <label className="flex items-center gap-2 flex-1 text-sm">
                  <input
                    type="checkbox"
                    checked={subItemConfig.enabled}
                    onChange={(e) => onUpdateSubItem(config.id, subItem.id, { enabled: e.target.checked })}
                    className="rounded border-border"
                  />
                  {subItem.label}
                </label>
                {subItem.hasMaxItems && subItemConfig.enabled && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Max:</span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={subItemConfig.maxItems ?? 3}
                      onChange={(e) => onUpdateSubItem(config.id, subItem.id, { maxItems: Number(e.target.value) })}
                      className="w-14 rounded-md border border-border bg-background px-2 py-0.5 text-sm"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Draggable grid widget with span controls on edges (legacy)
function DraggableGridWidget({
  widget,
  onSpanChange,
  gridSize,
}: {
  widget: InfoPaneWidgetConfig;
  onSpanChange: (colSpan: number, rowSpan: number) => void;
  gridSize: WidgetGridSize;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  const colSpan = Math.min(widget.colSpan ?? 1, gridSize);
  const rowSpan = Math.min(widget.rowSpan ?? 1, gridSize);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    gridColumn: `span ${colSpan}`,
    gridRow: `span ${rowSpan}`,
  };

  const canExpandCol = colSpan < gridSize;
  const canShrinkCol = colSpan > 1;
  const canExpandRow = rowSpan < gridSize;
  const canShrinkRow = rowSpan > 1;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group rounded-lg p-2 bg-white/10 hover:bg-white/15 transition-colors cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-50 z-10' : ''
      }`}
      {...listeners}
      {...attributes}
    >
      {/* Widget content */}
      <div className="h-full flex flex-col items-center justify-center gap-1 pointer-events-none">
        <span className="text-xl">
          {WIDGET_INFO[widget.id].icon}
        </span>
        <span className="text-xs truncate text-white/70">
          {WIDGET_INFO[widget.id].label}
        </span>
      </div>

      {/* Right edge controls */}
      {gridSize > 1 && (canExpandCol || canShrinkCol) && (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
          {canExpandCol && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSpanChange(colSpan + 1, rowSpan);
              }}
              className="w-4 h-4 bg-black/70 hover:bg-primary/80 rounded-l text-[10px] text-white flex items-center justify-center"
              title="Expand right"
            >
              +
            </button>
          )}
          {canShrinkCol && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSpanChange(colSpan - 1, rowSpan);
              }}
              className="w-4 h-4 bg-black/70 hover:bg-red-500/80 rounded-l text-[10px] text-white flex items-center justify-center"
              title="Shrink from right"
            >
              −
            </button>
          )}
        </div>
      )}

      {/* Bottom edge controls */}
      {gridSize > 1 && (canExpandRow || canShrinkRow) && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
          {canExpandRow && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSpanChange(colSpan, rowSpan + 1);
              }}
              className="w-4 h-4 bg-black/70 hover:bg-primary/80 rounded-t text-[10px] text-white flex items-center justify-center"
              title="Expand down"
            >
              +
            </button>
          )}
          {canShrinkRow && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSpanChange(colSpan, rowSpan - 1);
              }}
              className="w-4 h-4 bg-black/70 hover:bg-red-500/80 rounded-t text-[10px] text-white flex items-center justify-center"
              title="Shrink from bottom"
            >
              −
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Draggable composite grid widget with span controls (v2)
function DraggableCompositeGridWidget({
  widget,
  onSpanChange,
  gridSize,
}: {
  widget: CompositeWidgetConfig;
  onSpanChange: (colSpan: number, rowSpan: number) => void;
  gridSize: WidgetGridSize;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  const colSpan = Math.min(widget.colSpan ?? 1, gridSize);
  const rowSpan = Math.min(widget.rowSpan ?? 1, gridSize);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    gridColumn: `span ${colSpan}`,
    gridRow: `span ${rowSpan}`,
  };

  const canExpandCol = colSpan < gridSize;
  const canShrinkCol = colSpan > 1;
  const canExpandRow = rowSpan < gridSize;
  const canShrinkRow = rowSpan > 1;

  const widgetInfo = COMPOSITE_WIDGET_INFO[widget.id];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group rounded-lg p-2 bg-white/10 hover:bg-white/15 transition-colors cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-50 z-10' : ''
      }`}
      {...listeners}
      {...attributes}
    >
      {/* Widget content */}
      <div className="h-full flex flex-col items-center justify-center gap-1 pointer-events-none">
        <span className="text-xl">
          {widgetInfo.icon}
        </span>
        <span className="text-xs truncate text-white/70">
          {widgetInfo.label}
        </span>
      </div>

      {/* Right edge controls */}
      {gridSize > 1 && (canExpandCol || canShrinkCol) && (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
          {canExpandCol && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSpanChange(colSpan + 1, rowSpan);
              }}
              className="w-4 h-4 bg-black/70 hover:bg-primary/80 rounded-l text-[10px] text-white flex items-center justify-center"
              title="Expand right"
            >
              +
            </button>
          )}
          {canShrinkCol && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSpanChange(colSpan - 1, rowSpan);
              }}
              className="w-4 h-4 bg-black/70 hover:bg-red-500/80 rounded-l text-[10px] text-white flex items-center justify-center"
              title="Shrink from right"
            >
              −
            </button>
          )}
        </div>
      )}

      {/* Bottom edge controls */}
      {gridSize > 1 && (canExpandRow || canShrinkRow) && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
          {canExpandRow && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSpanChange(colSpan, rowSpan + 1);
              }}
              className="w-4 h-4 bg-black/70 hover:bg-primary/80 rounded-t text-[10px] text-white flex items-center justify-center"
              title="Expand down"
            >
              +
            </button>
          )}
          {canShrinkRow && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSpanChange(colSpan, rowSpan - 1);
              }}
              className="w-4 h-4 bg-black/70 hover:bg-red-500/80 rounded-t text-[10px] text-white flex items-center justify-center"
              title="Shrink from bottom"
            >
              −
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Widget grid preview component
function WidgetGridPreview({
  configs,
  gridSize,
  onGridSizeChange,
  onUpdateConfig,
  onReorder,
}: {
  configs: InfoPaneWidgetConfig[];
  gridSize: WidgetGridSize;
  onGridSizeChange: (size: WidgetGridSize) => void;
  onUpdateConfig: (id: InfoPaneWidget, updates: Partial<InfoPaneWidgetConfig>) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // Only show enabled widgets
  const enabledWidgets = configs.filter((w) => w.enabled);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = configs.findIndex((c) => c.id === active.id);
      const newIndex = configs.findIndex((c) => c.id === over.id);
      onReorder(oldIndex, newIndex);
    }
  };

  const gridClass = gridSize === 1
    ? "grid-cols-1"
    : gridSize === 2
      ? "grid-cols-2"
      : "grid-cols-3";

  return (
    <div className="mb-4 p-3 bg-muted/30 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground">Widget Grid Preview</p>
        <div className="flex items-center gap-1">
          {([1, 2, 3] as WidgetGridSize[]).map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => onGridSizeChange(size)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                gridSize === size
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              }`}
            >
              {size}×{size}
            </button>
          ))}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={enabledWidgets.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <div
            className={`bg-black/80 rounded-lg overflow-hidden p-2 grid gap-2 ${gridClass}`}
            style={{ minHeight: gridSize === 1 ? '80px' : gridSize === 2 ? '160px' : '200px' }}
          >
            {enabledWidgets.length > 0 ? (
              enabledWidgets.map((widget) => (
                <DraggableGridWidget
                  key={widget.id}
                  widget={widget}
                  gridSize={gridSize}
                  onSpanChange={(colSpan, rowSpan) => onUpdateConfig(widget.id, { colSpan, rowSpan })}
                />
              ))
            ) : (
              <div className="col-span-full flex items-center justify-center text-white/30 text-sm py-4">
                Enable widgets below to see preview
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>

      <p className="text-[10px] text-muted-foreground mt-2">
        Drag to reorder • Hover for size controls
      </p>
    </div>
  );
}

// Info pane widget builder component
function InfoPaneWidgetBuilder({
  configs,
  onConfigsChange,
  onUpdateConfig,
  onReorder,
}: {
  configs: InfoPaneWidgetConfig[];
  onConfigsChange: (configs: InfoPaneWidgetConfig[]) => void;
  onUpdateConfig: (id: InfoPaneWidget, updates: Partial<InfoPaneWidgetConfig>) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = configs.findIndex((c) => c.id === active.id);
      const newIndex = configs.findIndex((c) => c.id === over.id);
      onReorder(oldIndex, newIndex);
    }
  };

  const handleResetToDefaults = () => {
    onConfigsChange(DEFAULT_WIDGET_CONFIGS);
  };

  const enabledCount = configs.filter((c) => c.enabled).length;

  return (
    <div className="border-t border-border pt-4 mt-4">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="font-medium">Info Pane Widgets</p>
          <p className="text-sm text-muted-foreground">
            Drag to reorder, toggle to enable/disable, and configure size and max items
          </p>
        </div>
        <button
          type="button"
          onClick={handleResetToDefaults}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          Reset to defaults
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={configs.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {configs.map((config) => (
              <SortableWidgetCard
                key={config.id}
                config={config}
                onUpdate={onUpdateConfig}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {enabledCount > 0 && (
        <p className="text-xs text-muted-foreground mt-3">
          {enabledCount} widget{enabledCount !== 1 ? "s" : ""} enabled. Widgets display in the order shown above.
        </p>
      )}
    </div>
  );
}

// Composite widget grid preview component (v2)
function CompositeWidgetGridPreview({
  configs,
  gridSize,
  onGridSizeChange,
  onUpdateConfig,
  onReorder,
}: {
  configs: CompositeWidgetConfig[];
  gridSize: WidgetGridSize;
  onGridSizeChange: (size: WidgetGridSize) => void;
  onUpdateConfig: (id: CompositeWidgetId, updates: Partial<CompositeWidgetConfig>) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // Only show enabled widgets
  const enabledWidgets = configs.filter((w) => w.enabled);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = configs.findIndex((c) => c.id === active.id);
      const newIndex = configs.findIndex((c) => c.id === over.id);
      onReorder(oldIndex, newIndex);
    }
  };

  const gridClass = gridSize === 1
    ? "grid-cols-1"
    : gridSize === 2
      ? "grid-cols-2"
      : "grid-cols-3";

  return (
    <div className="mb-4 p-3 bg-muted/30 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground">Widget Grid Preview</p>
        <div className="flex items-center gap-1">
          {([1, 2, 3] as WidgetGridSize[]).map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => onGridSizeChange(size)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                gridSize === size
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              }`}
            >
              {size}x{size}
            </button>
          ))}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={enabledWidgets.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <div
            className={`bg-black/80 rounded-lg overflow-hidden p-2 grid gap-2 ${gridClass}`}
            style={{ minHeight: gridSize === 1 ? '80px' : gridSize === 2 ? '160px' : '200px' }}
          >
            {enabledWidgets.length > 0 ? (
              enabledWidgets.map((widget) => (
                <DraggableCompositeGridWidget
                  key={widget.id}
                  widget={widget}
                  gridSize={gridSize}
                  onSpanChange={(colSpan, rowSpan) => onUpdateConfig(widget.id, { colSpan, rowSpan })}
                />
              ))
            ) : (
              <div className="col-span-full flex items-center justify-center text-white/30 text-sm py-4">
                Enable widgets below to see preview
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>

      <p className="text-[10px] text-muted-foreground mt-2">
        Drag to reorder - Hover for size controls
      </p>
    </div>
  );
}

// Composite widget builder component (v2)
function CompositeWidgetBuilder({
  configs,
  onConfigsChange,
  onUpdateConfig,
  onUpdateSubItem,
  onReorder,
}: {
  configs: CompositeWidgetConfig[];
  onConfigsChange: (configs: CompositeWidgetConfig[]) => void;
  onUpdateConfig: (id: CompositeWidgetId, updates: Partial<CompositeWidgetConfig>) => void;
  onUpdateSubItem: (widgetId: CompositeWidgetId, subItemId: string, updates: Partial<SubItemConfig>) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = configs.findIndex((c) => c.id === active.id);
      const newIndex = configs.findIndex((c) => c.id === over.id);
      onReorder(oldIndex, newIndex);
    }
  };

  const handleResetToDefaults = () => {
    onConfigsChange(DEFAULT_COMPOSITE_CONFIGS);
  };

  const enabledCount = configs.filter((c) => c.enabled).length;

  return (
    <div className="border-t border-border pt-4 mt-4">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="font-medium">Info Pane Widgets</p>
          <p className="text-sm text-muted-foreground">
            Configure widgets shown on the screensaver info pane
          </p>
        </div>
        <button
          type="button"
          onClick={handleResetToDefaults}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          Reset to defaults
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={configs.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {configs.map((config) => (
              <SortableCompositeWidgetCard
                key={config.id}
                config={config}
                onUpdate={onUpdateConfig}
                onUpdateSubItem={onUpdateSubItem}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {enabledCount > 0 && (
        <p className="text-xs text-muted-foreground mt-3">
          {enabledCount} widget{enabledCount !== 1 ? "s" : ""} enabled. Widgets display in the order shown above.
        </p>
      )}
    </div>
  );
}

// Vacuum Map Camera Selector with Preview
function VacuumMapCameraSelector({
  cameras,
  defaultValue,
}: {
  cameras: { entity_id: string; attributes: Record<string, unknown> }[];
  defaultValue: string;
}) {
  const [selectedCamera, setSelectedCamera] = useState(defaultValue);
  const [previewKey, setPreviewKey] = useState(0);

  const handleCameraChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCamera(e.target.value);
    setPreviewKey((k) => k + 1); // Force refresh preview
  };

  const previewUrl = selectedCamera ? api.getHACameraSnapshotUrl(selectedCamera) : null;

  return (
    <div className="pt-2 border-t border-border">
      <label className="text-sm font-medium text-foreground">
        Map Camera
      </label>
      <div className="mt-1 flex gap-3">
        <div className="flex-1">
          <select
            name="mapCameraEntityId"
            value={selectedCamera}
            onChange={handleCameraChange}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Auto-detect</option>
            {cameras.map((camera) => (
              <option key={camera.entity_id} value={camera.entity_id}>
                {(camera.attributes.friendly_name as string) || camera.entity_id}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            Select the camera entity that displays the vacuum's map
          </p>
        </div>
        {/* Map Preview */}
        {selectedCamera && previewUrl && (
          <div className="w-32 h-32 rounded-lg border border-border bg-muted/30 overflow-hidden shrink-0">
            <img
              key={previewKey}
              src={`${previewUrl}${previewUrl.includes("?") ? "&" : "?"}t=${previewKey}`}
              alt="Map preview"
              className="w-full h-full object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Display type options (device interaction model)
const DISPLAY_TYPE_OPTIONS: { value: KioskDisplayType; label: string; description: string }[] = [
  { value: "touch", label: "Touch Screen", description: "Standard touch interaction" },
  { value: "tv", label: "Samsung TV", description: "Remote/D-pad navigation with larger controls" },
  { value: "display", label: "Display Only", description: "No interactive controls, view-only" },
];

// Display mode options
const DISPLAY_MODE_OPTIONS: { value: KioskDisplayMode; label: string; description: string }[] = [
  { value: "full", label: "Full App", description: "Full navigation with all enabled features" },
  { value: "screensaver-only", label: "Screensaver Only", description: "Only shows the screensaver, no app UI" },
  { value: "calendar-only", label: "Calendar Only", description: "Only calendar page with screensaver overlay" },
  { value: "dashboard-only", label: "Dashboard Only", description: "Only dashboard page with screensaver overlay" },
];

// Home page options
const HOME_PAGE_OPTIONS = [
  { value: "calendar", label: "Calendar" },
  { value: "dashboard", label: "Dashboard" },
  { value: "tasks", label: "Tasks" },
  { value: "photos", label: "Photos" },
  { value: "spotify", label: "Spotify" },
  { value: "iptv", label: "Live TV" },
  { value: "cameras", label: "Cameras" },
  { value: "homeassistant", label: "Home Assistant" },
  { value: "map", label: "Map" },
  { value: "kitchen", label: "Kitchen" },
  { value: "screensaver", label: "Screensaver" },
];

// Feature options
const FEATURE_OPTIONS: { key: keyof KioskEnabledFeatures; label: string; icon: React.ReactNode }[] = [
  { key: "calendar", label: "Calendar", icon: <Calendar className="h-4 w-4" /> },
  { key: "dashboard", label: "Dashboard", icon: <LayoutGrid className="h-4 w-4" /> },
  { key: "tasks", label: "Tasks", icon: <ListTodo className="h-4 w-4" /> },
  { key: "photos", label: "Photos", icon: <ImageIcon className="h-4 w-4" /> },
  { key: "spotify", label: "Spotify", icon: <Music className="h-4 w-4" /> },
  { key: "iptv", label: "Live TV", icon: <Tv className="h-4 w-4" /> },
  { key: "cameras", label: "Cameras", icon: <Video className="h-4 w-4" /> },
  { key: "homeassistant", label: "Home Assistant", icon: <Home className="h-4 w-4" /> },
  { key: "map", label: "Map", icon: <MapPin className="h-4 w-4" /> },
  { key: "kitchen", label: "Kitchen", icon: <Settings className="h-4 w-4" /> },
  { key: "screensaver", label: "Screensaver", icon: <Monitor className="h-4 w-4" /> },
];

function KiosksSettings() {
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingKiosk, setEditingKiosk] = useState<string | null>(null);
  const [expandedKiosk, setExpandedKiosk] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formColorScheme, setFormColorScheme] = useState<ColorScheme>("default");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [showQrKiosk, setShowQrKiosk] = useState<{ token: string; name: string } | null>(null);
  const [deviceKioskMap, setDeviceKioskMap] = useState<Record<string, string>>({});

  const { data: kiosks = [], isLoading } = useQuery({
    queryKey: ["kiosks"],
    queryFn: () => api.getKiosks(),
  });

  // Fetch server config to get configured frontend URL for kiosk URLs
  const { data: serverConfig } = useQuery({
    queryKey: ["server-config"],
    queryFn: () => api.getServerConfig(),
    staleTime: Infinity,
  });
  const frontendUrl = serverConfig?.frontendUrl || window.location.origin;

  // Pending TV devices (remote push setup)
  const { data: pendingDevices = [] } = useQuery({
    queryKey: ["pending-tv-devices"],
    queryFn: () => api.getPendingTvDevices(),
    refetchInterval: 5000,
  });

  const assignTvDevice = useMutation({
    mutationFn: ({ registrationId, kioskId }: { registrationId: string; kioskId: string }) =>
      api.assignTvDevice(registrationId, kioskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-tv-devices"] });
    },
  });

  // Fetch calendars for calendar selection
  const { data: calendars = [] } = useQuery({
    queryKey: ["calendars"],
    queryFn: () => api.getCalendars(),
  });

  const createKiosk = useMutation({
    mutationFn: (name: string) => api.createKiosk({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kiosks"] });
      setShowCreateForm(false);
      setFormName("");
    },
  });

  const updateKiosk = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.updateKiosk>[1] }) =>
      api.updateKiosk(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kiosks"] });
      setEditingKiosk(null);
      setFormName("");
      setFormColorScheme("default");
    },
  });

  const deleteKiosk = useMutation({
    mutationFn: (id: string) => api.deleteKiosk(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kiosks"] });
    },
  });

  const regenerateToken = useMutation({
    mutationFn: (id: string) => api.regenerateKioskToken(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kiosks"] });
    },
  });

  const refreshKiosk = useMutation({
    mutationFn: (id: string) => api.refreshKioskById(id),
  });

  const handleCopyUrl = async (token: string) => {
    const url = `${frontendUrl}/kiosk/${token}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback for non-HTTPS contexts
      const textArea = document.createElement("textarea");
      textArea.value = url;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    createKiosk.mutate(formName.trim());
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKiosk || !formName.trim()) return;
    updateKiosk.mutate({ id: editingKiosk, data: { name: formName.trim(), colorScheme: formColorScheme } });
  };

  const handleStartEdit = (kiosk: Kiosk) => {
    setEditingKiosk(kiosk.id);
    setFormName(kiosk.name);
    setFormColorScheme(kiosk.colorScheme || "default");
    setShowCreateForm(false);
  };

  const handleCancelEdit = () => {
    setEditingKiosk(null);
    setFormName("");
    setFormColorScheme("default");
  };

  return (
    <div className="space-y-6">
      {/* Pending TV Devices (Remote Push Setup) */}
      {pendingDevices.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Tv className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Pending Devices</CardTitle>
                <CardDescription>
                  TVs waiting for a kiosk assignment via remote setup
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingDevices.map((device) => {
              const timeLeft = Math.max(0, Math.floor((device.expiresAt - Date.now()) / 1000));
              const minutes = Math.floor(timeLeft / 60);
              const seconds = timeLeft % 60;
              return (
                <div
                  key={device.registrationId}
                  className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3"
                >
                  <Monitor className="h-5 w-5 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{device.ipAddress}</div>
                    <div className="text-xs text-muted-foreground truncate">{device.userAgent}</div>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {minutes}:{seconds.toString().padStart(2, "0")} left
                  </div>
                  <select
                    className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                    value={deviceKioskMap[device.registrationId] || ""}
                    onChange={(e) =>
                      setDeviceKioskMap((prev) => ({
                        ...prev,
                        [device.registrationId]: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select kiosk...</option>
                    {kiosks.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    disabled={
                      !deviceKioskMap[device.registrationId] ||
                      assignTvDevice.isPending
                    }
                    onClick={() => {
                      const kioskId = deviceKioskMap[device.registrationId];
                      if (kioskId) {
                        assignTvDevice.mutate({
                          registrationId: device.registrationId,
                          kioskId,
                        });
                      }
                    }}
                  >
                    {assignTvDevice.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Assign"
                    )}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Kiosks</CardTitle>
              <CardDescription>
                Create multiple kiosks with unique URLs that can be loaded without authentication
              </CardDescription>
            </div>
            <Button
              onClick={() => {
                setShowCreateForm(true);
                setEditingKiosk(null);
                setFormName("");
              }}
              disabled={showCreateForm}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Kiosk
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Create Form */}
          {showCreateForm && (
            <form onSubmit={handleCreateSubmit} className="rounded-lg border border-primary/50 bg-primary/5 p-4 space-y-4">
              <h4 className="font-medium">Create New Kiosk</h4>
              <div>
                <label className="text-sm font-medium">Kiosk Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Living Room Display"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createKiosk.isPending || !formName.trim()}>
                  {createKiosk.isPending ? "Creating..." : "Create Kiosk"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateForm(false);
                    setFormName("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {/* Kiosks List */}
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading kiosks...</div>
          ) : kiosks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Monitor className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No kiosks yet</p>
              <p className="text-sm mt-1">Create your first kiosk to get a unique URL for your display</p>
            </div>
          ) : (
            <div className="space-y-3">
              {kiosks.map((kiosk) => (
                <div
                  key={kiosk.id}
                  className={`rounded-lg border p-4 ${
                    kiosk.isActive ? "border-border" : "border-border/50 opacity-60"
                  }`}
                >
                  {editingKiosk === kiosk.id ? (
                    <form onSubmit={handleEditSubmit} className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">Kiosk Name</label>
                        <input
                          type="text"
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Color Scheme</label>
                        <div className="mt-2 grid grid-cols-4 sm:grid-cols-6 gap-2">
                          {COLOR_SCHEMES.map((scheme) => (
                            <button
                              key={scheme.value}
                              type="button"
                              onClick={() => setFormColorScheme(scheme.value)}
                              className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all ${
                                formColorScheme === scheme.value
                                  ? "border-primary bg-primary/10"
                                  : "border-border hover:border-muted-foreground/50"
                              }`}
                              title={scheme.label}
                            >
                              <div
                                className="w-6 h-6 rounded-full shadow-sm"
                                style={{ backgroundColor: scheme.accent }}
                              />
                              <span className="text-xs truncate w-full text-center">{scheme.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" disabled={updateKiosk.isPending || !formName.trim()}>
                          Save
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={handleCancelEdit}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setExpandedKiosk(expandedKiosk === kiosk.id ? null : kiosk.id)}
                              className="p-1 -ml-1 text-muted-foreground hover:text-foreground rounded"
                            >
                              {expandedKiosk === kiosk.id ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                            <h4 className="font-medium">{kiosk.name}</h4>
                            {kiosk.colorScheme && kiosk.colorScheme !== "default" && (
                              <span
                                className="w-4 h-4 rounded-full border border-border shadow-sm"
                                style={{ backgroundColor: COLOR_SCHEMES.find(s => s.value === kiosk.colorScheme)?.accent }}
                                title={COLOR_SCHEMES.find(s => s.value === kiosk.colorScheme)?.label || kiosk.colorScheme}
                              />
                            )}
                            {kiosk.displayMode && kiosk.displayMode !== "full" && (
                              <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">
                                {DISPLAY_MODE_OPTIONS.find(o => o.value === kiosk.displayMode)?.label}
                              </span>
                            )}
                            {!kiosk.isActive && (
                              <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                                Disabled
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-2 ml-5">
                            <code className="text-xs bg-muted px-2 py-1 rounded font-mono truncate max-w-md">
                              {frontendUrl}/kiosk/{kiosk.token}
                            </code>
                            <button
                              type="button"
                              onClick={() => handleCopyUrl(kiosk.token)}
                              className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                            >
                              {copiedToken === kiosk.token ? (
                                <>
                                  <CheckCircle className="h-3 w-3" />
                                  Copied!
                                </>
                              ) : (
                                "Copy URL"
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowQrKiosk({ token: kiosk.token, name: kiosk.name })}
                              className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                            >
                              <QrCode className="h-3 w-3" />
                              QR Code
                            </button>
                          </div>
                          {kiosk.lastAccessedAt && (
                            <p className="text-xs text-muted-foreground mt-2 ml-5">
                              Last accessed: {new Date(kiosk.lastAccessedAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Link
                            to={`/settings/screensaver-builder?kioskId=${kiosk.id}`}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md"
                            title="Edit screensaver"
                          >
                            <Palette className="h-4 w-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => refreshKiosk.mutate(kiosk.id)}
                            disabled={refreshKiosk.isPending}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md"
                            title="Refresh kiosk"
                          >
                            <RefreshCw className={`h-4 w-4 ${refreshKiosk.isPending ? "animate-spin" : ""}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(kiosk)}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md"
                            title="Edit kiosk name"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Are you sure you want to regenerate the token for "${kiosk.name}"? The old URL will stop working.`)) {
                                regenerateToken.mutate(kiosk.id);
                              }
                            }}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md"
                            title="Regenerate token (invalidates old URL)"
                          >
                            <Key className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={kiosk.isActive}
                            onClick={() => updateKiosk.mutate({ id: kiosk.id, data: { isActive: !kiosk.isActive } })}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              kiosk.isActive ? "bg-primary" : "bg-muted"
                            }`}
                            title={kiosk.isActive ? "Disable kiosk" : "Enable kiosk"}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                kiosk.isActive ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Delete kiosk "${kiosk.name}"? This cannot be undone.`)) {
                                deleteKiosk.mutate(kiosk.id);
                              }
                            }}
                            className="p-2 text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-md"
                            title="Delete kiosk"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Expanded Configuration Section */}
                      {expandedKiosk === kiosk.id && (
                        <div className="mt-3 pt-3 border-t-2 border-primary/30 space-y-3 ml-5">
                          {/* Display Mode & Home Page Row */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Display Mode */}
                            <div className="p-2.5 rounded-lg border-2 border-primary/20 bg-primary/5">
                              <label className="text-xs font-semibold text-primary uppercase tracking-wide">Display Mode</label>
                              <select
                                value={kiosk.displayMode || "full"}
                                onChange={(e) => updateKiosk.mutate({
                                  id: kiosk.id,
                                  data: { displayMode: e.target.value as KioskDisplayMode }
                                })}
                                className="mt-1 w-full rounded-md border border-primary/30 bg-background px-2 py-1.5 text-sm"
                              >
                                {DISPLAY_MODE_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Display Type */}
                            <div className="p-2.5 rounded-lg border-2 border-primary/20 bg-primary/5">
                              <label className="text-xs font-semibold text-primary uppercase tracking-wide">Display Type</label>
                              <select
                                value={kiosk.displayType || "touch"}
                                onChange={(e) => updateKiosk.mutate({
                                  id: kiosk.id,
                                  data: { displayType: e.target.value as KioskDisplayType }
                                })}
                                className="mt-1 w-full rounded-md border border-primary/30 bg-background px-2 py-1.5 text-sm"
                              >
                                {DISPLAY_TYPE_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Home Page (only for full mode) */}
                            {(kiosk.displayMode === "full" || !kiosk.displayMode) && (
                              <div className="p-2.5 rounded-lg border-2 border-primary/20 bg-primary/5">
                                <label className="text-xs font-semibold text-primary uppercase tracking-wide">Home Page</label>
                                <select
                                  value={kiosk.homePage || "calendar"}
                                  onChange={(e) => updateKiosk.mutate({
                                    id: kiosk.id,
                                    data: { homePage: e.target.value }
                                  })}
                                  className="mt-1 w-full rounded-md border border-primary/30 bg-background px-2 py-1.5 text-sm"
                                >
                                  {HOME_PAGE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>

                          {/* Start in Fullscreen */}
                          <div className="p-2.5 rounded-lg border-2 border-primary/20 bg-primary/5">
                            <label className="flex items-center gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={kiosk.startFullscreen ?? false}
                                onChange={(e) => updateKiosk.mutate({
                                  id: kiosk.id,
                                  data: { startFullscreen: e.target.checked }
                                })}
                                className="rounded border-primary/30 h-4 w-4"
                              />
                              <div>
                                <span className="text-xs font-semibold text-primary uppercase tracking-wide">Start in Fullscreen</span>
                                <p className="text-xs text-muted-foreground mt-0.5">Automatically enter fullscreen mode when kiosk loads</p>
                              </div>
                            </label>
                          </div>

                          {/* Screensaver & Idle */}
                          <div className="p-2.5 rounded-lg border-2 border-primary/20 bg-primary/5">
                            <label className="text-xs font-semibold text-primary uppercase tracking-wide">Screensaver & Idle</label>
                            <div className="mt-2 space-y-3">
                              {/* Screensaver Enabled */}
                              <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={kiosk.screensaverEnabled ?? true}
                                  onChange={(e) => updateKiosk.mutate({
                                    id: kiosk.id,
                                    data: { screensaverEnabled: e.target.checked }
                                  })}
                                  className="rounded border-primary/30 h-4 w-4"
                                />
                                <div>
                                  <span className="text-xs font-medium text-foreground">Screensaver Enabled</span>
                                  <p className="text-xs text-muted-foreground mt-0.5">Activate idle behavior after timeout</p>
                                </div>
                              </label>

                              {(kiosk.screensaverEnabled ?? true) && (
                                <>
                                  {/* Idle Behavior */}
                                  <div>
                                    <label className="text-xs font-medium text-foreground block mb-1">Idle Behavior</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => updateKiosk.mutate({
                                          id: kiosk.id,
                                          data: { screensaverBehavior: "screensaver" }
                                        })}
                                        className={`text-left px-3 py-2 rounded-lg border-2 transition-all text-xs ${
                                          (kiosk.screensaverBehavior || "screensaver") === "screensaver"
                                            ? "border-primary bg-primary/10"
                                            : "border-border hover:border-primary/40"
                                        }`}
                                      >
                                        <div className="font-medium text-foreground">Custom Screensaver</div>
                                        <div className="text-muted-foreground mt-0.5">Show custom photo/widget screensaver overlay</div>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => updateKiosk.mutate({
                                          id: kiosk.id,
                                          data: { screensaverBehavior: "hide-toolbar" }
                                        })}
                                        className={`text-left px-3 py-2 rounded-lg border-2 transition-all text-xs ${
                                          kiosk.screensaverBehavior === "hide-toolbar"
                                            ? "border-primary bg-primary/10"
                                            : "border-border hover:border-primary/40"
                                        }`}
                                      >
                                        <div className="font-medium text-foreground">Hide Toolbar Only</div>
                                        <div className="text-muted-foreground mt-0.5">Hide sidebar after idle to prevent burn-in; page stays visible</div>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Idle Timeout */}
                                  <div>
                                    <label className="text-xs font-medium text-foreground block mb-1">
                                      Idle Timeout: {Math.floor((kiosk.screensaverTimeout ?? 300) / 60)} min {(kiosk.screensaverTimeout ?? 300) % 60 > 0 ? `${(kiosk.screensaverTimeout ?? 300) % 60}s` : ""}
                                    </label>
                                    <input
                                      type="range"
                                      min={30}
                                      max={3600}
                                      step={30}
                                      value={kiosk.screensaverTimeout ?? 300}
                                      onChange={(e) => updateKiosk.mutate({
                                        id: kiosk.id,
                                        data: { screensaverTimeout: parseInt(e.target.value) }
                                      })}
                                      className="w-full accent-primary"
                                    />
                                    <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                                      <span>30s</span>
                                      <span>60 min</span>
                                    </div>
                                  </div>

                                  {/* Edit Screensaver Layout link (only for full screensaver behavior) */}
                                  {(kiosk.screensaverBehavior || "screensaver") === "screensaver" && (
                                    <Link
                                      to={`/settings/screensaver-builder?kioskId=${kiosk.id}`}
                                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
                                    >
                                      <Palette className="h-3.5 w-3.5" />
                                      Edit Screensaver Layout
                                      <ChevronRight className="h-3 w-3" />
                                    </Link>
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                          {/* Calendar Selection */}
                          <div className="p-2.5 rounded-lg border-2 border-primary/20 bg-primary/5">
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-semibold text-primary uppercase tracking-wide">Calendars</label>
                              {kiosk.selectedCalendarIds && kiosk.selectedCalendarIds.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => updateKiosk.mutate({
                                    id: kiosk.id,
                                    data: { selectedCalendarIds: null }
                                  })}
                                  className="text-[10px] text-muted-foreground hover:text-foreground"
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                              {calendars.map((cal) => {
                                const isSelected = kiosk.selectedCalendarIds?.includes(cal.id) ?? false;
                                return (
                                  <label
                                    key={cal.id}
                                    className={`flex items-center gap-1.5 px-2 py-1 rounded border cursor-pointer transition-colors text-xs ${
                                      isSelected ? "border-primary bg-primary/10" : "border-border/60 hover:bg-muted/50"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        const currentIds = kiosk.selectedCalendarIds || [];
                                        const newIds = e.target.checked
                                          ? [...currentIds, cal.id]
                                          : currentIds.filter((id) => id !== cal.id);
                                        updateKiosk.mutate({
                                          id: kiosk.id,
                                          data: { selectedCalendarIds: newIds.length > 0 ? newIds : null }
                                        });
                                      }}
                                      className="rounded border-border h-3 w-3"
                                    />
                                    <span
                                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                      style={{ backgroundColor: cal.color || "#3B82F6" }}
                                    />
                                    <span className="truncate">{cal.name}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>

                          {/* Feature Toggles (only for full mode) */}
                          {(kiosk.displayMode === "full" || !kiosk.displayMode) && (
                            <div className="p-2.5 rounded-lg border-2 border-primary/20 bg-primary/5">
                              <label className="text-xs font-semibold text-primary uppercase tracking-wide">Enabled Features</label>
                              <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-1.5">
                                {FEATURE_OPTIONS.map((feature) => {
                                  const isEnabled = kiosk.enabledFeatures?.[feature.key] !== false;
                                  return (
                                    <label
                                      key={feature.key}
                                      className={`flex items-center gap-1.5 px-2 py-1 rounded border cursor-pointer transition-colors text-xs ${
                                        isEnabled ? "border-primary bg-primary/10" : "border-border/60 hover:bg-muted/50 opacity-50"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isEnabled}
                                        onChange={(e) => {
                                          const currentFeatures = kiosk.enabledFeatures || {};
                                          const newFeatures = {
                                            ...currentFeatures,
                                            [feature.key]: e.target.checked
                                          };
                                          updateKiosk.mutate({
                                            id: kiosk.id,
                                            data: { enabledFeatures: newFeatures }
                                          });
                                        }}
                                        className="rounded border-border h-3 w-3"
                                      />
                                      <span className="text-primary">{feature.icon}</span>
                                      <span className="truncate">{feature.label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Color Scheme */}
                          <div className="p-2.5 rounded-lg border-2 border-primary/20 bg-primary/5">
                            <label className="text-xs font-semibold text-primary uppercase tracking-wide">Color Scheme</label>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {COLOR_SCHEMES.map((scheme) => (
                                <button
                                  key={scheme.value}
                                  type="button"
                                  onClick={() => updateKiosk.mutate({
                                    id: kiosk.id,
                                    data: { colorScheme: scheme.value }
                                  })}
                                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md border-2 transition-all text-xs ${
                                    kiosk.colorScheme === scheme.value
                                      ? "border-primary bg-primary/10"
                                      : "border-border hover:border-primary/40"
                                  }`}
                                  title={scheme.label}
                                >
                                  <div
                                    className="w-4 h-4 rounded-full shadow-sm"
                                    style={{ backgroundColor: scheme.accent }}
                                  />
                                  <span>{scheme.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How Kiosks Work</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-3">
              <Monitor className="h-5 w-5 mt-0.5 text-primary" />
              <div>
                <p className="font-medium text-foreground">Unique URLs</p>
                <p>Each kiosk gets a unique, unguessable URL that works without logging in</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Key className="h-5 w-5 mt-0.5 text-primary" />
              <div>
                <p className="font-medium text-foreground">Secure Tokens</p>
                <p>URLs use UUID tokens - impossible to guess, easy to share with trusted displays</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <RefreshCw className="h-5 w-5 mt-0.5 text-primary" />
              <div>
                <p className="font-medium text-foreground">Remote Control</p>
                <p>Send refresh commands to update kiosk displays without physical access</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Settings className="h-5 w-5 mt-0.5 text-primary" />
              <div>
                <p className="font-medium text-foreground">Individual Settings</p>
                <p>Each kiosk can have its own screensaver layout and color scheme</p>
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* QR Code Modal */}
      <AnimatePresence>
        {showQrKiosk && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setShowQrKiosk(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card rounded-lg shadow-xl p-6 max-w-sm w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-lg">{showQrKiosk.name}</h3>
                <button
                  onClick={() => setShowQrKiosk(null)}
                  className="p-1 hover:bg-muted rounded-md"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex flex-col items-center gap-4">
                <div className="bg-white p-4 rounded-lg">
                  <QRCodeSVG
                    value={`${frontendUrl}/kiosk/${showQrKiosk.token}`}
                    size={200}
                    level="M"
                  />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Scan this QR code to open the kiosk on another device
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Icons for each settings category
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  home: <MapPin className="h-5 w-5" />,
  weather: <Cloud className="h-5 w-5" />,
  google: <Globe className="h-5 w-5" />,
  spotify: <Music className="h-5 w-5" />,
  telegram: <MessageCircle className="h-5 w-5" />,
  homeassistant: <Home className="h-5 w-5" />,
  handwriting: <PenTool className="h-5 w-5" />,
};

// localStorage store keys for client settings
const CLIENT_STORE_KEYS = {
  calendar: "calendar-store",
  screensaver: "screensaver-store",
  tasks: "tasks-store",
  durationAlerts: "duration-alerts-storage",
} as const;

function CompanionSettings() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<"invite" | "create">("invite");
  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formLabel, setFormLabel] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const { data: companionUsers = [], isLoading } = useQuery({
    queryKey: ["companion-users"],
    queryFn: () => api.getCompanionUsers(),
  });

  const { data: calendars = [] } = useQuery({
    queryKey: ["calendars"],
    queryFn: () => api.getCalendars(),
  });

  const { data: taskLists = [] } = useQuery({
    queryKey: ["task-lists"],
    queryFn: () => api.getTaskLists(),
  });

  const createUser = useMutation({
    mutationFn: (data: Parameters<typeof api.createCompanionUser>[0]) =>
      api.createCompanionUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companion-users"] });
      resetForm();
    },
  });

  const updateUser = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CompanionPermissions> & { label?: string; isActive?: boolean } }) =>
      api.updateCompanionUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companion-users"] });
    },
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => api.deleteCompanionUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companion-users"] });
      setShowDeleteConfirm(null);
    },
  });

  const resetForm = () => {
    setShowAddForm(false);
    setFormEmail("");
    setFormName("");
    setFormPassword("");
    setFormLabel("");
    setAddMode("invite");
  };

  const handleCreate = () => {
    if (!formEmail.trim()) return;
    if (addMode === "create" && !formPassword.trim()) return;

    createUser.mutate({
      type: addMode,
      email: formEmail.trim(),
      name: addMode === "create" ? formName.trim() || undefined : undefined,
      password: addMode === "create" ? formPassword : undefined,
      label: formLabel.trim() || undefined,
    });
  };

  const togglePermission = (user: CompanionUser, key: keyof CompanionPermissions, value: any) => {
    updateUser.mutate({ id: user.id, data: { [key]: value } });
  };

  return (
    <>
      {/* User List Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Companion Users</CardTitle>
              <CardDescription>Manage who can access the companion mobile app</CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setShowAddForm(true)}
              className="gap-1"
            >
              <Plus className="h-4 w-4" />
              Add User
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : companionUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Smartphone className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No companion users yet</p>
              <p className="text-xs mt-1">Add users to let them access your calendar and tasks from their phone</p>
            </div>
          ) : (
            <div className="space-y-3">
              {companionUsers.map((user: CompanionUser) => (
                <div
                  key={user.id}
                  className="border border-border rounded-xl p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {user.label || user.userName || user.userEmail}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {user.userEmail}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          user.isActive
                            ? "bg-green-500/10 text-green-600"
                            : "bg-red-500/10 text-red-600"
                        }`}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                      <button
                        onClick={() => setEditingUser(editingUser === user.id ? null : user.id)}
                        className="p-1.5 rounded-lg hover:bg-primary/10 transition-colors"
                      >
                        <Settings className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded permission editor */}
                  {editingUser === user.id && (
                    <div className="mt-4 pt-4 border-t border-border space-y-4">
                      {/* Active toggle */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">Active</span>
                        <button
                          onClick={() => updateUser.mutate({ id: user.id, data: { isActive: !user.isActive } })}
                          className={`w-11 h-6 rounded-full transition-colors relative ${
                            user.isActive ? "bg-primary" : "bg-muted"
                          }`}
                        >
                          <div
                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                              user.isActive ? "translate-x-[22px]" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                      </div>

                      {/* Calendar access */}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Calendar Access</label>
                        <div className="flex gap-2 mt-1.5">
                          {(["none", "view", "edit"] as const).map((level) => (
                            <button
                              key={level}
                              onClick={() => togglePermission(user, "accessCalendar", level)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                user.permissions.accessCalendar === level
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-card border border-border text-foreground hover:bg-primary/5"
                              }`}
                            >
                              {level.charAt(0).toUpperCase() + level.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Calendar scoping */}
                      {user.permissions.accessCalendar !== "none" && (
                        <div>
                          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Allowed Calendars</label>
                          <div className="mt-1.5 space-y-1">
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={user.permissions.allowedCalendarIds === null}
                                onChange={() =>
                                  togglePermission(
                                    user,
                                    "allowedCalendarIds",
                                    user.permissions.allowedCalendarIds === null
                                      ? (calendars as any[]).map((c) => c.id)
                                      : null
                                  )
                                }
                                className="rounded border-border"
                              />
                              All Calendars
                            </label>
                            {user.permissions.allowedCalendarIds !== null && (
                              <div className="pl-4 space-y-1">
                                {(calendars as any[]).map((cal) => (
                                  <label key={cal.id} className="flex items-center gap-2 text-sm">
                                    <input
                                      type="checkbox"
                                      checked={(user.permissions.allowedCalendarIds || []).includes(cal.id)}
                                      onChange={() => {
                                        const current = user.permissions.allowedCalendarIds || [];
                                        const next = current.includes(cal.id)
                                          ? current.filter((id: string) => id !== cal.id)
                                          : [...current, cal.id];
                                        togglePermission(user, "allowedCalendarIds", next);
                                      }}
                                      className="rounded border-border"
                                    />
                                    <span
                                      className="w-3 h-3 rounded-full shrink-0"
                                      style={{ backgroundColor: cal.color || "hsl(var(--primary))" }}
                                    />
                                    {cal.name}
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Tasks access */}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tasks Access</label>
                        <div className="flex gap-2 mt-1.5">
                          {(["none", "view", "edit"] as const).map((level) => (
                            <button
                              key={level}
                              onClick={() => togglePermission(user, "accessTasks", level)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                user.permissions.accessTasks === level
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-card border border-border text-foreground hover:bg-primary/5"
                              }`}
                            >
                              {level.charAt(0).toUpperCase() + level.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Task list scoping */}
                      {user.permissions.accessTasks !== "none" && (
                        <div>
                          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Allowed Task Lists</label>
                          <div className="mt-1.5 space-y-1">
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={user.permissions.allowedTaskListIds === null}
                                onChange={() =>
                                  togglePermission(
                                    user,
                                    "allowedTaskListIds",
                                    user.permissions.allowedTaskListIds === null
                                      ? (taskLists as any[]).map((tl) => tl.id)
                                      : null
                                  )
                                }
                                className="rounded border-border"
                              />
                              All Task Lists
                            </label>
                            {user.permissions.allowedTaskListIds !== null && (
                              <div className="pl-4 space-y-1">
                                {(taskLists as any[]).map((tl) => (
                                  <label key={tl.id} className="flex items-center gap-2 text-sm">
                                    <input
                                      type="checkbox"
                                      checked={(user.permissions.allowedTaskListIds || []).includes(tl.id)}
                                      onChange={() => {
                                        const current = user.permissions.allowedTaskListIds || [];
                                        const next = current.includes(tl.id)
                                          ? current.filter((id: string) => id !== tl.id)
                                          : [...current, tl.id];
                                        togglePermission(user, "allowedTaskListIds", next);
                                      }}
                                      className="rounded border-border"
                                    />
                                    {tl.title}
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Feature toggles */}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Feature Access</label>
                        <div className="grid grid-cols-2 gap-2 mt-1.5">
                          {([
                            { key: "accessKiosks" as const, label: "Kiosks" },
                            { key: "accessPhotos" as const, label: "Photos" },
                            { key: "accessIptv" as const, label: "IPTV" },
                            { key: "accessHomeAssistant" as const, label: "Home Assistant" },
                            { key: "accessNews" as const, label: "News" },
                            { key: "accessWeather" as const, label: "Weather" },
                            { key: "accessRecipes" as const, label: "Recipes" },
                          ]).map(({ key, label }) => (
                            <label key={key} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={!!user.permissions[key]}
                                onChange={() => togglePermission(user, key, !user.permissions[key])}
                                className="rounded border-border"
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Remove button */}
                      <div className="pt-2">
                        {showDeleteConfirm === user.id ? (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => setShowDeleteConfirm(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="flex-1 gap-1"
                              onClick={() => deleteUser.mutate(user.id)}
                              disabled={deleteUser.isPending}
                            >
                              {deleteUser.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                              Remove
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowDeleteConfirm(user.id)}
                            className="text-xs text-destructive hover:underline"
                          >
                            Remove access
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add User Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add Companion User</CardTitle>
            <CardDescription>Grant someone access to your companion app</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mode toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setAddMode("invite")}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  addMode === "invite"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-foreground hover:bg-primary/5"
                }`}
              >
                Invite Existing User
              </button>
              <button
                onClick={() => setAddMode("create")}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  addMode === "create"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-foreground hover:bg-primary/5"
                }`}
              >
                Create New Account
              </button>
            </div>

            {/* Email */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder={addMode === "invite" ? "user@example.com" : "newuser@example.com"}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>

            {/* Name (create mode) */}
            {addMode === "create" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="John Doe"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>
            )}

            {/* Password (create mode) */}
            {addMode === "create" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Password</label>
                <input
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>
            )}

            {/* Label */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Display Label (optional)</label>
              <input
                type="text"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="e.g. Mom, Partner, Babysitter"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>

            {/* Error */}
            {createUser.error && (
              <p className="text-sm text-destructive">
                {(createUser.error as any)?.message || "Failed to add user"}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={resetForm} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={
                  !formEmail.trim() ||
                  (addMode === "create" && !formPassword.trim()) ||
                  createUser.isPending
                }
                className="flex-1 gap-1"
              >
                {createUser.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {addMode === "invite" ? "Invite" : "Create"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function RemarkableSettingsCard() {
  const queryClient = useQueryClient();

  // Fetch reMarkable status
  const { data: status, isLoading } = useQuery({
    queryKey: ["remarkable", "status"],
    queryFn: () => api.getRemarkableStatus(),
  });

  // Disconnect mutation
  const disconnect = useMutation({
    mutationFn: () => api.disconnectRemarkable(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["remarkable"] });
    },
  });

  const isConnected = status?.connected === true;

  return (
    <Card className="col-span-full mb-4 border-2 border-primary/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tablet className="h-5 w-5" />
          reMarkable
        </CardTitle>
        <CardDescription>
          Connect your reMarkable tablet to sync calendars and planners
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Status */}
          <div className="flex items-center gap-3 flex-1">
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : isConnected ? (
              <>
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Connected</span>
                </div>
                {status?.lastSyncAt && (
                  <span className="text-sm text-muted-foreground">
                    Last sync: {new Date(status.lastSyncAt).toLocaleDateString()}
                  </span>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <XCircle className="h-5 w-5" />
                <span>Not connected</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {isConnected && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => disconnect.mutate()}
                disabled={disconnect.isPending}
              >
                {disconnect.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Unlink className="h-4 w-4 mr-2" />
                )}
                Disconnect
              </Button>
            )}
            <Link to="/remarkable">
              <Button variant={isConnected ? "outline" : "default"} size="sm">
                {isConnected ? (
                  <>
                    <Settings className="h-4 w-4 mr-2" />
                    Manage
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4 mr-2" />
                    Connect Device
                  </>
                )}
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BackupRestoreCard() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await api.exportSettings();

      // Add client-side settings from localStorage
      const exportData: ExportedSettings = {
        ...response,
        clientSettings: {
          calendar: getLocalStorageState(CLIENT_STORE_KEYS.calendar),
          screensaver: getLocalStorageState(CLIENT_STORE_KEYS.screensaver),
          tasks: getLocalStorageState(CLIENT_STORE_KEYS.tasks),
          durationAlerts: getLocalStorageState(CLIENT_STORE_KEYS.durationAlerts),
        },
      };

      // Download file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `openframe-settings-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
      setImportStatus({ type: "error", message: "Failed to export settings" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    setIsImporting(true);
    setImportStatus(null);

    try {
      const text = await selectedFile.text();
      const settings: ExportedSettings = JSON.parse(text);

      // Validate version
      if (settings.version !== "1.0") {
        throw new Error("Unsupported export file version");
      }

      // Import server settings
      const result = await api.importSettings(settings);

      // Apply client settings to localStorage
      if (settings.clientSettings?.calendar) {
        setLocalStorageState(CLIENT_STORE_KEYS.calendar, settings.clientSettings.calendar);
      }
      if (settings.clientSettings?.screensaver) {
        setLocalStorageState(CLIENT_STORE_KEYS.screensaver, settings.clientSettings.screensaver);
      }
      if (settings.clientSettings?.tasks) {
        setLocalStorageState(CLIENT_STORE_KEYS.tasks, settings.clientSettings.tasks);
      }
      if (settings.clientSettings?.durationAlerts) {
        setLocalStorageState(CLIENT_STORE_KEYS.durationAlerts, settings.clientSettings.durationAlerts);
      }

      // Calculate total imported
      const total = Object.values(result.imported).reduce((a, b) => a + b, 0);
      const errorCount = result.errors.length;

      if (errorCount > 0) {
        setImportStatus({
          type: "success",
          message: `Imported ${total} items with ${errorCount} errors. Refresh to apply changes.`,
        });
      } else {
        setImportStatus({
          type: "success",
          message: `Successfully imported ${total} items. Refresh to apply changes.`,
        });
      }
    } catch (error) {
      console.error("Import failed:", error);
      setImportStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to import settings",
      });
    } finally {
      setIsImporting(false);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <Card className="col-span-full mb-6 border-2 border-primary/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Backup & Restore
        </CardTitle>
        <CardDescription>
          Export settings to a file or restore from a backup. Passwords and API keys are never included in exports.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Export Section */}
          <div className="flex-1">
            <p className="text-sm text-muted-foreground mb-3">
              Download all display settings, kiosk configs, camera settings, and other configurations.
            </p>
            <Button onClick={handleExport} disabled={isExporting}>
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export Settings
                </>
              )}
            </Button>
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px bg-border" />
          <div className="sm:hidden h-px bg-border" />

          {/* Import Section */}
          <div className="flex-1">
            <p className="text-sm text-muted-foreground mb-3">
              Restore settings from a previously exported file. Existing settings with matching names will be updated.
            </p>
            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Select File
              </Button>
              {selectedFile && (
                <>
                  <span className="text-sm text-muted-foreground self-center truncate max-w-[150px]">
                    {selectedFile.name}
                  </span>
                  <Button onClick={handleImport} disabled={isImporting}>
                    {isImporting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      "Import"
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Status Message */}
        {importStatus && (
          <div
            className={`mt-4 p-3 rounded-md flex items-center gap-2 ${
              importStatus.type === "success"
                ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300"
                : "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300"
            }`}
          >
            {importStatus.type === "success" ? (
              <CheckCircle className="h-4 w-4 flex-shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 flex-shrink-0" />
            )}
            <span className="text-sm">{importStatus.message}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper functions for localStorage state management
function getLocalStorageState(key: string): Record<string, unknown> | null {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed.state ?? parsed;
  } catch {
    return null;
  }
}

function setLocalStorageState(key: string, state: Record<string, unknown>): void {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Preserve the Zustand persist structure
      if (parsed.state !== undefined) {
        localStorage.setItem(key, JSON.stringify({ ...parsed, state: { ...parsed.state, ...state } }));
      } else {
        localStorage.setItem(key, JSON.stringify({ ...parsed, ...state }));
      }
    } else {
      localStorage.setItem(key, JSON.stringify({ state }));
    }
  } catch (error) {
    console.error("Failed to set localStorage state:", error);
  }
}

function SystemSettings() {
  const queryClient = useQueryClient();
  // Start with all sections collapsed except "home" (Home Location)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set(["weather", "google", "microsoft", "spotify", "telegram", "homeassistant", "handwriting"])
  );
  const [formValues, setFormValues] = useState<Record<string, Record<string, string>>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});
  const [locationSearch, setLocationSearch] = useState("");
  const [locationStatus, setLocationStatus] = useState<"idle" | "searching" | "success" | "error">("idle");
  const [locationError, setLocationError] = useState<string | null>(null);

  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Fetch setting definitions
  const { data: definitions = [], isLoading: isLoadingDefs, error: defsError } = useQuery({
    queryKey: ["setting-definitions"],
    queryFn: () => api.getSettingDefinitions(),
  });

  // Fetch current settings
  const { data: settings = [], isLoading: isLoadingSettings, error: settingsError } = useQuery({
    queryKey: ["system-settings"],
    queryFn: () => api.getAllSettings(),
  });

  const isLoading = isLoadingDefs || isLoadingSettings;
  const error = defsError || settingsError;

  // Initialize form values from settings
  const getSettingValue = (category: string, key: string): string => {
    // Check form values first (for unsaved changes)
    if (formValues[category]?.[key] !== undefined) {
      return formValues[category][key];
    }
    // Then check saved settings
    const setting = settings.find((s) => s.category === category && s.key === key);
    return setting?.value || "";
  };

  const handleInputChange = (category: string, key: string, value: string) => {
    setFormValues((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value,
      },
    }));
    // Reset save status when user makes changes
    setSaveStatus((prev) => ({ ...prev, [category]: "idle" }));
  };

  const saveCategory = useMutation({
    mutationFn: async ({ category, values }: { category: string; values: Record<string, string | null> }) => {
      await api.updateCategorySettings(category, values);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      // When server settings change (external_url), refresh server-config so kiosk URLs update
      if (variables.category === "server") {
        queryClient.invalidateQueries({ queryKey: ["server-config"] });
      }
      setSaveStatus((prev) => ({ ...prev, [variables.category]: "saved" }));
      // Clear form values for this category since they're saved
      setFormValues((prev) => {
        const newValues = { ...prev };
        delete newValues[variables.category];
        return newValues;
      });
      // Reset status after 2 seconds
      setTimeout(() => {
        setSaveStatus((prev) => ({ ...prev, [variables.category]: "idle" }));
      }, 2000);
    },
    onError: (_, variables) => {
      setSaveStatus((prev) => ({ ...prev, [variables.category]: "error" }));
    },
  });

  const handleSaveCategory = (category: string, categoryDef: SettingCategoryDefinition) => {
    setSaveStatus((prev) => ({ ...prev, [category]: "saving" }));

    const values: Record<string, string | null> = {};
    for (const setting of categoryDef.settings) {
      const value = getSettingValue(category, setting.key);
      // Skip masked values (unchanged secrets)
      if (value !== "••••••••") {
        values[setting.key] = value || null;
      }
    }

    saveCategory.mutate({ category, values });
  };

  const handleLocationLookup = async () => {
    if (!locationSearch.trim()) return;

    setLocationStatus("searching");
    setLocationError(null);

    try {
      const result = await api.geocodeAddress(locationSearch);
      // Update the form values for home location
      setFormValues((prev) => ({
        ...prev,
        home: {
          ...prev.home,
          address: result.formattedAddress,
          latitude: result.latitude,
          longitude: result.longitude,
        },
      }));
      setLocationStatus("success");
      setLocationSearch(result.formattedAddress);
      // Reset save status since we have new values
      setSaveStatus((prev) => ({ ...prev, home: "idle" }));
    } catch (err) {
      setLocationStatus("error");
      setLocationError(err instanceof Error ? err.message : "Failed to lookup location");
    }
  };

  // Split definitions into 3 columns
  const column1: typeof definitions = [];
  const column2: typeof definitions = [];
  const column3: typeof definitions = [];
  definitions.forEach((def, idx) => {
    if (idx % 3 === 0) column1.push(def);
    else if (idx % 3 === 1) column2.push(def);
    else column3.push(def);
  });

  const renderSection = (categoryDef: typeof definitions[0]) => {
    const icon = CATEGORY_ICONS[categoryDef.category] || <Settings className="h-5 w-5" />;
    const isCollapsed = collapsedCategories.has(categoryDef.category);

    return (
      <div
        key={categoryDef.category}
        className="rounded-lg border-2 border-primary bg-primary/5 dark:bg-primary/10"
      >
            <button
              type="button"
              onClick={() => toggleCategory(categoryDef.category)}
              className="flex w-full items-center justify-between p-4 text-left hover:bg-primary/10 dark:hover:bg-primary/20 rounded-t-lg"
            >
              <div className="flex items-center gap-3">
                <span className="text-primary">
                  {icon}
                </span>
                <div>
                  <h4 className="font-medium text-lg text-primary dark:text-primary">{categoryDef.label}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{categoryDef.description}</p>
                </div>
              </div>
              {isCollapsed ? (
                <ChevronDown className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronUp className="h-5 w-5 text-gray-500" />
              )}
            </button>

            {!isCollapsed && (
              <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-4">
                {/* Location lookup for home category */}
                {categoryDef.category === "home" && (
                  <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 p-4 mb-4">
                    <label className="block text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                      Lookup Location
                    </label>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                      Enter a city name or address to auto-fill latitude and longitude (requires Google Maps API key)
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={locationSearch}
                        onChange={(e) => {
                          setLocationSearch(e.target.value);
                          setLocationStatus("idle");
                        }}
                        placeholder="e.g., New York, NY or 123 Main St, Boston"
                        className="flex-1 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:border-primary focus:outline-none"
                        onKeyDown={(e) => e.key === "Enter" && handleLocationLookup()}
                      />
                      <Button
                        onClick={handleLocationLookup}
                        disabled={locationStatus === "searching" || !locationSearch.trim()}
                        className="whitespace-nowrap"
                      >
                        {locationStatus === "searching" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {locationStatus === "success" && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Location found! Latitude and longitude have been updated below.
                      </p>
                    )}
                    {locationStatus === "error" && locationError && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-2 flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        {locationError}
                      </p>
                    )}
                  </div>
                )}

                {categoryDef.settings.map((settingDef) => (
                  <div key={settingDef.key}>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                      {settingDef.label}
                      {settingDef.isSecret && (
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">(encrypted)</span>
                      )}
                    </label>
                    {settingDef.description && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                        {settingDef.description}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <input
                        type={settingDef.isSecret ? "password" : "text"}
                        value={getSettingValue(categoryDef.category, settingDef.key)}
                        onChange={(e) =>
                          handleInputChange(categoryDef.category, settingDef.key, e.target.value)
                        }
                        placeholder={settingDef.placeholder}
                        className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:border-primary focus:outline-none"
                      />
                      {categoryDef.category === "server" && settingDef.key === "external_url" && (
                        <button
                          type="button"
                          onClick={() => handleInputChange("server", "external_url", window.location.origin)}
                          className="shrink-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-primary/10 hover:border-primary/40 transition-colors"
                          title="Use current URL"
                        >
                          <Globe className="h-4 w-4 inline-block mr-1" />
                          Use Current
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Redirect URIs - show computed OAuth redirect URIs for each valid access method */}
                {categoryDef.category === "server" && (() => {
                  const externalUrl = getSettingValue("server", "external_url");
                  if (!externalUrl) return null;
                  const base = externalUrl.replace(/\/+$/, "");

                  // Check if the configured URL is a private IP
                  const isPrivateIp = /^https?:\/\/(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(base);

                  // Build list of origins that need redirect URIs registered
                  const origins: { label: string; base: string }[] = [];

                  if (isPrivateIp) {
                    // Private IP configured — show localhost URIs instead (with the same port)
                    try {
                      const parsed = new URL(base);
                      const localhostBase = `${parsed.protocol}//localhost${parsed.port ? `:${parsed.port}` : ""}`;
                      origins.push({ label: "Localhost", base: localhostBase });
                    } catch {
                      // Fall through
                    }
                  } else if (/^https?:\/\/localhost/.test(base)) {
                    origins.push({ label: "Localhost", base });
                  } else {
                    // Public domain — show both public domain and localhost URIs
                    origins.push({ label: base.replace(/^https?:\/\//, ""), base });
                    origins.push({ label: "Localhost (dev)", base: "http://localhost:5176" });
                  }

                  const callbackPaths = [
                    { label: "Google", path: "/api/v1/auth/oauth/google/callback" },
                    { label: "Microsoft", path: "/api/v1/auth/oauth/microsoft/callback" },
                    { label: "Spotify", path: "/api/v1/spotify/auth/callback" },
                  ];

                  return (
                    <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 p-4 mt-2">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                        OAuth Redirect URIs
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
                        Register these URLs in Google Cloud Console, Microsoft Entra, and Spotify Developer Dashboard.
                        {origins.length > 1 && " Add all URIs listed below for each access method."}
                      </p>
                      {isPrivateIp && (
                        <div className="rounded-md bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 p-2.5 mb-3">
                          <p className="text-xs text-yellow-800 dark:text-yellow-200">
                            <AlertTriangle className="h-3.5 w-3.5 inline-block mr-1 -mt-0.5" />
                            Private IP addresses (like {base}) don't work with Google OAuth.
                            Access via <strong>localhost</strong> or a public domain instead. The URIs below use localhost with the same port.
                          </p>
                        </div>
                      )}
                      <div className="space-y-3">
                        {origins.map((origin) => (
                          <div key={origin.base}>
                            {origins.length > 1 && (
                              <p className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-1.5">{origin.label}</p>
                            )}
                            <div className="space-y-1.5">
                              {callbackPaths.map((cb) => {
                                const uri = `${origin.base}${cb.path}`;
                                return (
                                  <div key={uri} className="flex items-center gap-1">
                                    <code className="text-xs bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-700 rounded px-2 py-1 truncate block flex-1">{uri}</code>
                                    <button
                                      type="button"
                                      onClick={() => navigator.clipboard.writeText(uri)}
                                      className="shrink-0 rounded p-1 text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900"
                                      title={`Copy ${cb.label} redirect URI`}
                                    >
                                      <Copy className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Handwriting recognition - link to AI tab */}
                {categoryDef.category === "handwriting" && (
                  <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 p-4 mt-4">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      For advanced configuration, testing, and API key management, visit the{" "}
                      <Link to="/settings?tab=ai" className="font-medium underline hover:text-blue-600 dark:hover:text-blue-400">
                        AI Settings
                      </Link>{" "}
                      tab.
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <div className="text-sm">
                    {saveStatus[categoryDef.category] === "saved" && (
                      <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" />
                        Saved
                      </span>
                    )}
                    {saveStatus[categoryDef.category] === "error" && (
                      <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                        <XCircle className="h-4 w-4" />
                        Error saving
                      </span>
                    )}
                  </div>
                  <Button
                    onClick={() => handleSaveCategory(categoryDef.category, categoryDef)}
                    disabled={saveStatus[categoryDef.category] === "saving"}
                  >
                    {saveStatus[categoryDef.category] === "saving" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
            </div>
          )}
        </div>
      );
  };

  if (isLoading) {
    return (
      <div className="col-span-full text-center py-8 text-gray-600 dark:text-gray-400">
        <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin opacity-50" />
        <p>Loading settings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="col-span-full text-center py-8 text-red-600 dark:text-red-400">
        <XCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Failed to load settings</p>
        <p className="text-sm mt-2">{error instanceof Error ? error.message : "Unknown error"}</p>
      </div>
    );
  }

  return (
    <>
      {/* Column 1 */}
      <div className="flex flex-col gap-4">
        {column1.map(renderSection)}
      </div>
      {/* Column 2 */}
      <div className="flex flex-col gap-4">
        {column2.map(renderSection)}
      </div>
      {/* Column 3 */}
      <div className="flex flex-col gap-4">
        {column3.map(renderSection)}
        <ApiKeysSettings />
      </div>
    </>
  );
}

function IptvSettings() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [serverName, setServerName] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const { data: servers = [], isLoading } = useQuery({
    queryKey: ["iptv-servers"],
    queryFn: () => api.getIptvServers(),
  });

  const addServer = useMutation({
    mutationFn: async (data: { name: string; serverUrl: string; username: string; password: string }) => {
      const server = await api.addIptvServer(data);
      // Auto-sync after adding
      await api.syncIptvServer(server.id);
      return server;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["iptv-servers"] });
      queryClient.invalidateQueries({ queryKey: ["iptv-categories"] });
      queryClient.invalidateQueries({ queryKey: ["iptv-channels"] });
      setShowAddForm(false);
      setServerName("");
      setServerUrl("");
      setUsername("");
      setPassword("");
      setAddError(null);
    },
    onError: (error) => {
      setAddError(error instanceof Error ? error.message : "Failed to add server");
    },
  });

  const deleteServer = useMutation({
    mutationFn: (id: string) => api.deleteIptvServer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["iptv-servers"] });
      queryClient.invalidateQueries({ queryKey: ["iptv-categories"] });
      queryClient.invalidateQueries({ queryKey: ["iptv-channels"] });
    },
  });

  const syncServer = useMutation({
    mutationFn: (id: string) => api.syncIptvServer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["iptv-categories"] });
      queryClient.invalidateQueries({ queryKey: ["iptv-channels"] });
    },
  });

  const handleDeleteServer = (server: { id: string; name: string }) => {
    if (confirm(`Delete IPTV server "${server.name}"? This will remove all associated channels.`)) {
      deleteServer.mutate(server.id);
    }
  };

  const handleAddServer = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    addServer.mutate({ name: serverName, serverUrl, username, password });
  };

  return (
    <Card className="border-2 border-primary/40">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>IPTV Servers</CardTitle>
            <CardDescription>
              Manage your Xtreme Codes IPTV servers
            </CardDescription>
          </div>
          {!showAddForm && (
            <Button size="sm" onClick={() => setShowAddForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Server
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Server Form */}
        {showAddForm && (
          <form onSubmit={handleAddServer} className="space-y-4 rounded-lg border border-border p-4">
            <h4 className="font-medium">Add New IPTV Server</h4>
            {addError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
                <p className="text-sm text-destructive">{addError}</p>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Server Name</label>
                <input
                  type="text"
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  placeholder="My IPTV Server"
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Server URL</label>
                <input
                  type="url"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="http://example.com:8080"
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="password"
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addServer.isPending}>
                {addServer.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Server"
                )}
              </Button>
            </div>
          </form>
        )}

        {/* Server List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : servers.length === 0 && !showAddForm ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <Tv className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              No IPTV servers configured
            </p>
            <Button size="sm" className="mt-4" onClick={() => setShowAddForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Server
            </Button>
          </div>
        ) : servers.length > 0 ? (
          <div className="space-y-3">
            {servers.map((server) => (
              <div
                key={server.id}
                className="flex items-center justify-between rounded-lg border border-border p-4"
              >
                <div>
                  <p className="font-medium">{server.name}</p>
                  <p className="text-sm text-muted-foreground">{server.serverUrl}</p>
                  <p className="text-xs text-muted-foreground">
                    Username: {server.username}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncServer.mutate(server.id)}
                    disabled={syncServer.isPending}
                  >
                    <RefreshCw className={`h-4 w-4 ${syncServer.isPending ? "animate-spin" : ""}`} />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteServer(server)}
                    disabled={deleteServer.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PlexSettings() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [serverName, setServerName] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const { data: servers = [], isLoading } = useQuery({
    queryKey: ["plex-servers"],
    queryFn: () => api.getPlexServers(),
  });

  const addServer = useMutation({
    mutationFn: async (data: { name: string; serverUrl: string; accessToken: string }) => {
      return api.addPlexServer(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plex-servers"] });
      setShowAddForm(false);
      setServerName("");
      setServerUrl("");
      setAccessToken("");
      setAddError(null);
    },
    onError: (error) => {
      setAddError(error instanceof Error ? error.message : "Failed to add server");
    },
  });

  const deleteServer = useMutation({
    mutationFn: (id: string) => api.deletePlexServer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plex-servers"] });
    },
  });

  const handleDeleteServer = (server: { id: string; name: string }) => {
    if (confirm(`Delete Plex server "${server.name}"?`)) {
      deleteServer.mutate(server.id);
    }
  };

  const handleAddServer = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    addServer.mutate({ name: serverName, serverUrl, accessToken });
  };

  return (
    <Card className="border-2 border-primary/40">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Plex Servers</CardTitle>
            <CardDescription>
              Manage your Plex Media Server connections
            </CardDescription>
          </div>
          {!showAddForm && (
            <Button size="sm" onClick={() => setShowAddForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Server
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showAddForm && (
          <form onSubmit={handleAddServer} className="space-y-4 rounded-lg border border-border p-4">
            <h4 className="font-medium">Add New Plex Server</h4>
            {addError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
                <p className="text-sm text-destructive">{addError}</p>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Server Name</label>
                <input
                  type="text"
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  placeholder="My Plex Server"
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Server URL</label>
                <input
                  type="url"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="http://192.168.1.50:32400"
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium">Access Token</label>
                <input
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="Plex authentication token"
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Find your token in Plex Web &rarr; Settings &rarr; Authorized Devices, or from a browser inspection of app.plex.tv
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addServer.isPending}>
                {addServer.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  "Add Server"
                )}
              </Button>
            </div>
          </form>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : servers.length === 0 && !showAddForm ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <Play className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              No Plex servers configured
            </p>
            <Button size="sm" className="mt-4" onClick={() => setShowAddForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Server
            </Button>
          </div>
        ) : servers.length > 0 ? (
          <div className="space-y-3">
            {servers.map((server) => (
              <div
                key={server.id}
                className="flex items-center justify-between rounded-lg border border-border p-4"
              >
                <div>
                  <p className="font-medium">{server.name}</p>
                  <p className="text-sm text-muted-foreground">{server.serverUrl}</p>
                  {server.machineId && (
                    <p className="text-xs text-muted-foreground">
                      Machine ID: {server.machineId.slice(0, 12)}...
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteServer(server)}
                    disabled={deleteServer.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AudiobookshelfSettings() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [serverName, setServerName] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const { data: servers = [], isLoading } = useQuery({
    queryKey: ["audiobookshelf-servers"],
    queryFn: () => api.getAudiobookshelfServers(),
  });

  const addServer = useMutation({
    mutationFn: async (data: { name: string; serverUrl: string; accessToken: string }) => {
      return api.addAudiobookshelfServer(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audiobookshelf-servers"] });
      setShowAddForm(false);
      setServerName("");
      setServerUrl("");
      setAccessToken("");
      setAddError(null);
    },
    onError: (error) => {
      setAddError(error instanceof Error ? error.message : "Failed to add server");
    },
  });

  const deleteServer = useMutation({
    mutationFn: (id: string) => api.deleteAudiobookshelfServer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audiobookshelf-servers"] });
    },
  });

  const handleDeleteServer = (server: { id: string; name: string }) => {
    if (confirm(`Delete Audiobookshelf server "${server.name}"?`)) {
      deleteServer.mutate(server.id);
    }
  };

  const handleAddServer = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    addServer.mutate({ name: serverName, serverUrl, accessToken });
  };

  return (
    <Card className="border-2 border-primary/40">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Audiobookshelf Servers</CardTitle>
            <CardDescription>
              Manage your Audiobookshelf server connections
            </CardDescription>
          </div>
          {!showAddForm && (
            <Button size="sm" onClick={() => setShowAddForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Server
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showAddForm && (
          <form onSubmit={handleAddServer} className="space-y-4 rounded-lg border border-border p-4">
            <h4 className="font-medium">Add New Audiobookshelf Server</h4>
            {addError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
                <p className="text-sm text-destructive">{addError}</p>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Server Name</label>
                <input
                  type="text"
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  placeholder="My Audiobookshelf"
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Server URL</label>
                <input
                  type="url"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="http://192.168.1.50:13378"
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium">API Token</label>
                <input
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="Audiobookshelf API token"
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Find your API token in Audiobookshelf &rarr; Settings &rarr; Users &rarr; your user
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addServer.isPending}>
                {addServer.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  "Add Server"
                )}
              </Button>
            </div>
          </form>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : servers.length === 0 && !showAddForm ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              No Audiobookshelf servers configured
            </p>
            <Button size="sm" className="mt-4" onClick={() => setShowAddForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Server
            </Button>
          </div>
        ) : servers.length > 0 ? (
          <div className="space-y-3">
            {servers.map((server) => (
              <div
                key={server.id}
                className="flex items-center justify-between rounded-lg border border-border p-4"
              >
                <div>
                  <p className="font-medium">{server.name}</p>
                  <p className="text-sm text-muted-foreground">{server.serverUrl}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteServer(server)}
                    disabled={deleteServer.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function IptvChannelManager() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "category">("name");

  const { data: categories = [] } = useQuery({
    queryKey: ["iptv-categories"],
    queryFn: () => api.getIptvCategories(),
  });

  const { data: channels = [], isLoading } = useQuery({
    queryKey: ["iptv-channels", selectedCategory, search],
    queryFn: () => api.getIptvChannels({
      categoryId: selectedCategory || undefined,
      search: search || undefined,
    }),
  });

  const { data: favorites = [] } = useQuery({
    queryKey: ["iptv-favorites"],
    queryFn: () => api.getIptvFavorites(),
  });

  const favoriteIds = new Set(favorites.map((f: { id: string }) => f.id));

  const toggleFavorite = useMutation({
    mutationFn: async ({ channelId, isFavorite }: { channelId: string; isFavorite: boolean }) => {
      if (isFavorite) {
        await api.removeIptvFavorite(channelId);
      } else {
        await api.addIptvFavorite(channelId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["iptv-favorites"] });
      queryClient.invalidateQueries({ queryKey: ["iptv-channels"] });
    },
  });

  // Filter and sort channels
  const displayedChannels = useMemo(() => {
    let result = [...channels];

    if (showFavoritesOnly) {
      result = result.filter((ch: { id: string }) => favoriteIds.has(ch.id));
    }

    if (sortBy === "name") {
      result.sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
    } else if (sortBy === "category") {
      result.sort((a: { categoryName?: string }, b: { categoryName?: string }) =>
        (a.categoryName || "").localeCompare(b.categoryName || "")
      );
    }

    return result.slice(0, 100); // Limit display to 100 channels for performance
  }, [channels, showFavoritesOnly, favoriteIds, sortBy]);

  return (
    <Card className="border-2 border-primary/40">
      <CardHeader>
        <CardTitle>Channel Manager</CardTitle>
        <CardDescription>
          Search, filter, and manage your favorite channels ({favorites.length} favorites)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search channels..."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          {/* Category filter */}
          <select
            value={selectedCategory || ""}
            onChange={(e) => setSelectedCategory(e.target.value || null)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm min-w-[150px]"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name} ({cat.channelCount ?? 0})
              </option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "name" | "category")}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="name">Sort by Name</option>
            <option value="category">Sort by Category</option>
          </select>

          {/* Favorites toggle */}
          <Button
            variant={showFavoritesOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className="whitespace-nowrap"
          >
            <Star className={`mr-2 h-4 w-4 ${showFavoritesOnly ? "fill-current" : ""}`} />
            Favorites ({favorites.length})
          </Button>
        </div>

        {/* Results info */}
        <p className="text-sm text-muted-foreground">
          Showing {displayedChannels.length} of {showFavoritesOnly ? favorites.length : channels.length} channels
          {displayedChannels.length === 100 && " (limited to 100)"}
        </p>

        {/* Channel list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : displayedChannels.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <Tv className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              {showFavoritesOnly ? "No favorite channels" : "No channels found"}
            </p>
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Channel</th>
                  <th className="px-3 py-2 text-left font-medium">Category</th>
                  <th className="px-3 py-2 text-center font-medium w-20">Favorite</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayedChannels.map((channel) => {
                  const isFav = favoriteIds.has(channel.id);
                  return (
                    <tr key={channel.id} className="hover:bg-muted/50">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {channel.logoUrl && (
                            <img
                              src={channel.logoUrl}
                              alt=""
                              className="h-6 w-6 rounded object-contain bg-black"
                              onError={(e) => (e.currentTarget.style.display = "none")}
                            />
                          )}
                          <span className="truncate max-w-[250px]">{channel.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        <span className="truncate max-w-[150px] block">{channel.categoryName || "-"}</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => toggleFavorite.mutate({ channelId: channel.id, isFavorite: isFav })}
                          disabled={toggleFavorite.isPending}
                          className={`p-1 rounded hover:bg-muted ${isFav ? "text-yellow-500" : "text-muted-foreground"}`}
                        >
                          <Star className={`h-4 w-4 ${isFav ? "fill-current" : ""}`} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Camera Troubleshooting Component
function CameraTroubleshooting({ cameras }: { cameras: Camera[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [testRtspUrl, setTestRtspUrl] = useState("");
  const [testUsername, setTestUsername] = useState("");
  const [testPassword, setTestPassword] = useState("");
  const [testResult, setTestResult] = useState<{
    registered: boolean;
    ready: boolean;
    sourceType: string | null;
    tracks: string[];
    error: string | null;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");

  // Fetch MediaMTX paths
  const { data: paths = [], isLoading: isLoadingPaths, refetch: refetchPaths } = useQuery({
    queryKey: ["mediamtx", "paths"],
    queryFn: () => api.getMediaMTXPaths(),
    enabled: isExpanded,
    refetchInterval: isExpanded ? 5000 : false,
  });

  // Get stream status for a specific camera
  const { data: streamStatus, isLoading: isLoadingStatus, refetch: refetchStatus } = useQuery({
    queryKey: ["camera", "stream-status", selectedCameraId],
    queryFn: () => api.getCameraStreamStatus(selectedCameraId),
    enabled: !!selectedCameraId && isExpanded,
  });

  const handleTestRtsp = async () => {
    if (!testRtspUrl.trim()) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await api.testRtspUrl({
        rtspUrl: testRtspUrl.trim(),
        username: testUsername.trim() || undefined,
        password: testPassword || undefined,
      });
      setTestResult(result);
    } catch (error) {
      setTestResult({
        registered: false,
        ready: false,
        sourceType: null,
        tracks: [],
        error: `Test failed: ${(error as Error).message}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleStartStream = async (cameraId: string) => {
    try {
      await api.startCameraStream(cameraId);
      refetchPaths();
      if (selectedCameraId === cameraId) {
        refetchStatus();
      }
    } catch (error) {
      console.error("Failed to start stream:", error);
    }
  };

  const handleFillFromCamera = (camera: Camera) => {
    setTestRtspUrl(camera.rtspUrl || "");
    setTestUsername(camera.username || "");
    setTestPassword("");
    setTestResult(null);
  };

  return (
    <Card className="border-2 border-amber-500/40">
      <CardHeader
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Camera Troubleshooting
            </CardTitle>
            <CardDescription>
              Test RTSP connections and diagnose camera issues
            </CardDescription>
          </div>
          <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="space-y-6">
          {/* Test RTSP URL */}
          <div className="space-y-4">
            <h4 className="font-medium">Test RTSP URL</h4>
            <p className="text-sm text-muted-foreground">
              Test if MediaMTX can connect to an RTSP stream. This helps diagnose connection issues.
            </p>

            {cameras.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Quick fill from camera:</span>
                {cameras.filter(c => c.rtspUrl).map((camera) => (
                  <button
                    key={camera.id}
                    onClick={() => handleFillFromCamera(camera)}
                    className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80 text-foreground"
                  >
                    {camera.name}
                  </button>
                ))}
              </div>
            )}

            <div className="grid gap-3">
              <div>
                <label className="text-sm font-medium">RTSP URL</label>
                <input
                  type="text"
                  value={testRtspUrl}
                  onChange={(e) => setTestRtspUrl(e.target.value)}
                  placeholder="rtsp://192.168.1.100:554/stream"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Username (optional)</label>
                  <input
                    type="text"
                    value={testUsername}
                    onChange={(e) => setTestUsername(e.target.value)}
                    placeholder="admin"
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Password (optional)</label>
                  <input
                    type="password"
                    value={testPassword}
                    onChange={(e) => setTestPassword(e.target.value)}
                    placeholder="password"
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <Button
                onClick={handleTestRtsp}
                disabled={isTesting || !testRtspUrl.trim()}
                className="w-fit"
              >
                {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Test Connection
              </Button>
            </div>

            {testResult && (
              <div className={`rounded-lg border p-4 ${
                testResult.ready
                  ? "border-green-500/30 bg-green-500/10"
                  : testResult.error
                  ? "border-red-500/30 bg-red-500/10"
                  : "border-amber-500/30 bg-amber-500/10"
              }`}>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Status:</span>
                    {testResult.ready ? (
                      <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                        <Check className="h-4 w-4" /> Stream Ready
                      </span>
                    ) : testResult.registered ? (
                      <span className="text-amber-600 dark:text-amber-400">Registered but not ready</span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400">Failed to register</span>
                    )}
                  </div>
                  {testResult.sourceType && (
                    <div><span className="font-medium">Source Type:</span> {testResult.sourceType}</div>
                  )}
                  {testResult.tracks.length > 0 && (
                    <div><span className="font-medium">Tracks:</span> {testResult.tracks.join(", ")}</div>
                  )}
                  {testResult.error && (
                    <div className="text-red-600 dark:text-red-400">
                      <span className="font-medium">Error:</span> {testResult.error}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Registered Streams */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Registered Streams in MediaMTX</h4>
              <Button variant="outline" size="sm" onClick={() => refetchPaths()}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingPaths ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            {isLoadingPaths ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : paths.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                No streams registered. Start a camera stream to see it here.
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Path</th>
                      <th className="text-left px-3 py-2 font-medium">Status</th>
                      <th className="text-left px-3 py-2 font-medium">Source</th>
                      <th className="text-left px-3 py-2 font-medium">Readers</th>
                      <th className="text-left px-3 py-2 font-medium">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paths.map((path) => (
                      <tr key={path.name} className="hover:bg-muted/30">
                        <td className="px-3 py-2 font-mono text-xs">{path.name}</td>
                        <td className="px-3 py-2">
                          {path.ready ? (
                            <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                              <span className="h-2 w-2 rounded-full bg-green-500" />
                              Ready
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                              <span className="h-2 w-2 rounded-full bg-amber-500" />
                              Waiting
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{path.sourceType || "-"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{path.readers}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {path.bytesReceived > 0 ? `${(path.bytesReceived / 1024 / 1024).toFixed(2)} MB` : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Camera Stream Status */}
          {cameras.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-medium">Check Camera Stream Status</h4>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-sm font-medium">Select Camera</label>
                  <select
                    value={selectedCameraId}
                    onChange={(e) => setSelectedCameraId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">-- Select a camera --</option>
                    {cameras.filter(c => c.rtspUrl).map((camera) => (
                      <option key={camera.id} value={camera.id}>{camera.name}</option>
                    ))}
                  </select>
                </div>
                {selectedCameraId && (
                  <Button
                    variant="outline"
                    onClick={() => handleStartStream(selectedCameraId)}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Start Stream
                  </Button>
                )}
              </div>

              {selectedCameraId && streamStatus && (
                <div className="rounded-lg border border-border p-4 space-y-2 text-sm">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <span className="font-medium">MediaMTX Available:</span>{" "}
                      {streamStatus.mediamtxAvailable ? (
                        <span className="text-green-600 dark:text-green-400">Yes</span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400">No</span>
                      )}
                    </div>
                    <div>
                      <span className="font-medium">Stream Ready:</span>{" "}
                      {streamStatus.streamReady ? (
                        <span className="text-green-600 dark:text-green-400">Yes</span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">No</span>
                      )}
                    </div>
                    <div>
                      <span className="font-medium">Has RTSP URL:</span>{" "}
                      {streamStatus.hasRtspUrl ? "Yes" : "No"}
                    </div>
                  </div>
                  {streamStatus.webrtcUrl && (
                    <div className="pt-2 border-t border-border">
                      <span className="font-medium">WebRTC URL:</span>{" "}
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">{streamStatus.webrtcUrl}</code>
                    </div>
                  )}
                  {streamStatus.hlsUrl && (
                    <div>
                      <span className="font-medium">HLS URL:</span>{" "}
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">{streamStatus.hlsUrl}</code>
                    </div>
                  )}
                </div>
              )}
              {selectedCameraId && isLoadingStatus && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          )}

          {/* Common Issues */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <h4 className="font-medium">Common Issues</h4>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex gap-2">
                <span className="text-amber-500">1.</span>
                <span><strong>Stream not ready:</strong> Check if the camera is online and the RTSP URL is correct. Some cameras need specific stream paths like <code className="bg-muted px-1 rounded">/h264Preview_01_main</code></span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-500">2.</span>
                <span><strong>Authentication failed:</strong> Verify username/password. Some cameras require credentials in the URL itself.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-500">3.</span>
                <span><strong>Connection timeout:</strong> Check if the camera IP is reachable from the server. Firewall rules may block port 554.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-500">4.</span>
                <span><strong>Reolink cameras:</strong> Use format <code className="bg-muted px-1 rounded">rtsp://user:pass@IP:554/h264Preview_01_main</code></span>
              </li>
            </ul>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function CamerasSettings() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCamera, setEditingCamera] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formMjpegUrl, setFormMjpegUrl] = useState("");
  const [formSnapshotUrl, setFormSnapshotUrl] = useState("");
  const [formRtspUrl, setFormRtspUrl] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");

  // MediaMTX config state
  const [mediamtxApiUrl, setMediamtxApiUrl] = useState("");
  const [mediamtxHost, setMediamtxHost] = useState("");
  const [mediamtxWebrtcPort, setMediamtxWebrtcPort] = useState("");
  const [mediamtxHlsPort, setMediamtxHlsPort] = useState("");
  const [mediamtxTestResult, setMediamtxTestResult] = useState<{ available: boolean; message: string } | null>(null);
  const [mediamtxTesting, setMediamtxTesting] = useState(false);

  const { data: cameras = [], isLoading } = useQuery({
    queryKey: ["cameras"],
    queryFn: () => api.getCameras(),
  });

  // MediaMTX configuration
  const { data: mediamtxConfig, isLoading: isLoadingMediamtx } = useQuery({
    queryKey: ["mediamtx", "config"],
    queryFn: () => api.getMediaMTXConfig(),
  });

  const { data: mediamtxStatus } = useQuery({
    queryKey: ["mediamtx", "status"],
    queryFn: () => api.getMediaMTXStatus(),
    refetchInterval: 10000, // Check every 10 seconds
  });

  // Initialize MediaMTX form when config loads
  useEffect(() => {
    if (mediamtxConfig) {
      setMediamtxApiUrl(mediamtxConfig.apiUrl);
      setMediamtxHost(mediamtxConfig.host);
      setMediamtxWebrtcPort(mediamtxConfig.webrtcPort);
      setMediamtxHlsPort(mediamtxConfig.hlsPort);
    }
  }, [mediamtxConfig]);

  const saveMediamtxConfig = useMutation({
    mutationFn: (data: { apiUrl: string; host: string; webrtcPort: string; hlsPort: string }) =>
      api.saveMediaMTXConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mediamtx"] });
    },
  });

  const handleTestMediamtx = async () => {
    setMediamtxTesting(true);
    setMediamtxTestResult(null);
    try {
      const result = await api.getMediaMTXStatus(mediamtxApiUrl);
      setMediamtxTestResult({
        available: result.available,
        message: result.available ? "Connected successfully!" : "Could not connect to MediaMTX",
      });
    } catch (error) {
      setMediamtxTestResult({
        available: false,
        message: `Connection failed: ${(error as Error).message}`,
      });
    } finally {
      setMediamtxTesting(false);
    }
  };

  const handleSaveMediamtx = () => {
    saveMediamtxConfig.mutate({
      apiUrl: mediamtxApiUrl,
      host: mediamtxHost,
      webrtcPort: mediamtxWebrtcPort,
      hlsPort: mediamtxHlsPort,
    });
  };

  // Check HA connection and get enabled HA cameras
  const { data: haConfig } = useQuery({
    queryKey: ["homeassistant", "config"],
    queryFn: () => api.getHomeAssistantConfig(),
  });

  const { data: haCameras = [] } = useQuery({
    queryKey: ["ha-cameras"],
    queryFn: () => api.getHomeAssistantCameras(),
    enabled: !!haConfig?.url,
  });

  const haConnected = !!haConfig?.url;

  const createCamera = useMutation({
    mutationFn: (data: {
      name: string;
      mjpegUrl?: string;
      snapshotUrl?: string;
      rtspUrl?: string;
      username?: string;
      password?: string;
    }) => api.createCamera(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cameras"] });
      resetForm();
      setShowAddForm(false);
    },
  });

  const deleteCamera = useMutation({
    mutationFn: (id: string) => api.deleteCamera(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cameras"] });
    },
  });

  const updateCamera = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{
      name: string;
      mjpegUrl: string | null;
      snapshotUrl: string | null;
      rtspUrl: string | null;
      username: string | null;
      password: string | null;
      isEnabled: boolean;
    }> }) => api.updateCamera(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cameras"] });
      resetForm();
      setEditingCamera(null);
    },
  });

  const resetForm = () => {
    setFormName("");
    setFormMjpegUrl("");
    setFormSnapshotUrl("");
    setFormRtspUrl("");
    setFormUsername("");
    setFormPassword("");
  };

  const handleEdit = (camera: Camera) => {
    setEditingCamera(camera.id);
    setFormName(camera.name);
    setFormMjpegUrl(camera.mjpegUrl || "");
    setFormSnapshotUrl(camera.snapshotUrl || "");
    setFormRtspUrl(camera.rtspUrl || "");
    setFormUsername(camera.username || "");
    setFormPassword("");
    setShowAddForm(false);
  };

  const handleSubmitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    createCamera.mutate({
      name: formName.trim(),
      mjpegUrl: formMjpegUrl.trim() || undefined,
      snapshotUrl: formSnapshotUrl.trim() || undefined,
      rtspUrl: formRtspUrl.trim() || undefined,
      username: formUsername.trim() || undefined,
      password: formPassword || undefined,
    });
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCamera || !formName.trim()) return;

    updateCamera.mutate({
      id: editingCamera,
      data: {
        name: formName.trim(),
        mjpegUrl: formMjpegUrl.trim() || null,
        snapshotUrl: formSnapshotUrl.trim() || null,
        rtspUrl: formRtspUrl.trim() || null,
        username: formUsername.trim() || null,
        password: formPassword || undefined, // Only update if provided
      },
    });
  };

  const handleDeleteCamera = (camera: { id: string; name: string }) => {
    if (confirm(`Delete camera "${camera.name}"?`)) {
      deleteCamera.mutate(camera.id);
    }
  };

  const handleCancelForm = () => {
    resetForm();
    setShowAddForm(false);
    setEditingCamera(null);
  };

  const renderForm = (isEdit: boolean) => (
    <form onSubmit={isEdit ? handleSubmitEdit : handleSubmitAdd} className="space-y-4 rounded-lg border border-border p-4 bg-muted/30">
      <h4 className="font-medium">{isEdit ? "Edit Camera" : "Add New Camera"}</h4>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-sm font-medium">Camera Name *</label>
          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="e.g., Front Door, Backyard"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            required
          />
        </div>

        <div className="sm:col-span-2">
          <label className="text-sm font-medium">MJPEG Stream URL</label>
          <input
            type="url"
            value={formMjpegUrl}
            onChange={(e) => setFormMjpegUrl(e.target.value)}
            placeholder="http://camera-ip/mjpeg/stream"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-muted-foreground">Live video stream (recommended for browser viewing)</p>
        </div>

        <div className="sm:col-span-2">
          <label className="text-sm font-medium">Snapshot URL</label>
          <input
            type="url"
            value={formSnapshotUrl}
            onChange={(e) => setFormSnapshotUrl(e.target.value)}
            placeholder="http://camera-ip/snapshot.jpg"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-muted-foreground">Static image URL (refreshed periodically)</p>
        </div>

        <div className="sm:col-span-2">
          <label className="text-sm font-medium">RTSP URL</label>
          <input
            type="text"
            value={formRtspUrl}
            onChange={(e) => setFormRtspUrl(e.target.value)}
            placeholder="rtsp://camera-ip:554/stream"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-muted-foreground">For future use with RTSP proxy</p>
        </div>

        <div>
          <label className="text-sm font-medium">Username</label>
          <input
            type="text"
            value={formUsername}
            onChange={(e) => setFormUsername(e.target.value)}
            placeholder="Camera username"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Password</label>
          <input
            type="password"
            value={formPassword}
            onChange={(e) => setFormPassword(e.target.value)}
            placeholder={isEdit ? "Leave blank to keep current" : "Camera password"}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={createCamera.isPending || updateCamera.isPending}>
          {(createCamera.isPending || updateCamera.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEdit ? "Save Changes" : "Add Camera"}
        </Button>
        <Button type="button" variant="outline" onClick={handleCancelForm}>
          Cancel
        </Button>
      </div>
    </form>
  );

  return (
    <>
      {/* MediaMTX Configuration */}
      <Card className="border-2 border-primary/40">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                MediaMTX Streaming Server
                {mediamtxStatus?.available ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/20 px-2.5 py-1 text-xs font-medium text-green-600 dark:text-green-400">
                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-400">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    Not Connected
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                MediaMTX converts RTSP camera streams to WebRTC/HLS for browser playback
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingMediamtx ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium">MediaMTX API URL</label>
                  <input
                    type="url"
                    value={mediamtxApiUrl}
                    onChange={(e) => setMediamtxApiUrl(e.target.value)}
                    placeholder="http://localhost:9997"
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    The URL of the MediaMTX API endpoint (default: http://localhost:9997)
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">Host</label>
                  <input
                    type="text"
                    value={mediamtxHost}
                    onChange={(e) => setMediamtxHost(e.target.value)}
                    placeholder="localhost"
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Host for WebRTC/HLS URLs (use your server IP for remote access)
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">WebRTC Port</label>
                  <input
                    type="text"
                    value={mediamtxWebrtcPort}
                    onChange={(e) => setMediamtxWebrtcPort(e.target.value)}
                    placeholder="8889"
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">HLS Port</label>
                  <input
                    type="text"
                    value={mediamtxHlsPort}
                    onChange={(e) => setMediamtxHlsPort(e.target.value)}
                    placeholder="8888"
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {mediamtxTestResult && (
                <div
                  className={`rounded-lg border p-3 text-sm font-medium ${
                    mediamtxTestResult.available
                      ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300"
                      : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
                  }`}
                >
                  {mediamtxTestResult.message}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleTestMediamtx}
                  disabled={mediamtxTesting || !mediamtxApiUrl}
                >
                  {mediamtxTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Test Connection
                </Button>
                <Button
                  onClick={handleSaveMediamtx}
                  disabled={saveMediamtxConfig.isPending}
                >
                  {saveMediamtxConfig.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Configuration
                </Button>
              </div>

              {!mediamtxStatus?.available && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                  <h4 className="font-medium text-amber-700 dark:text-amber-300">MediaMTX Not Running</h4>
                  <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
                    MediaMTX is required for RTSP to WebRTC conversion. Start it with Docker:
                  </p>
                  <pre className="mt-2 overflow-x-auto rounded bg-black/10 dark:bg-white/10 p-2 text-xs text-foreground font-mono">
                    docker run -d --name mediamtx -p 8554:8554 -p 8889:8889 -p 8888:8888 -p 9997:9997 bluenviron/mediamtx
                  </pre>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Troubleshooting Section */}
      {mediamtxStatus?.available && (
        <CameraTroubleshooting cameras={cameras} />
      )}

      <Card className="border-2 border-primary/40">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>IP Cameras</CardTitle>
              <CardDescription>
                Configure and manage your IP cameras
              </CardDescription>
            </div>
          {!showAddForm && !editingCamera && (
            <Button onClick={() => setShowAddForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Camera
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showAddForm && renderForm(false)}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : cameras.length === 0 && !showAddForm ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <Video className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              No cameras configured
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Camera
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {cameras.map((camera) => (
              <div key={camera.id}>
                {editingCamera === camera.id ? (
                  renderForm(true)
                ) : (
                  <div className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-3 w-3 rounded-full ${
                          camera.isEnabled ? "bg-green-500" : "bg-muted"
                        }`}
                      />
                      <div>
                        <p className="font-medium">{camera.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {camera.mjpegUrl || camera.snapshotUrl || camera.rtspUrl || "No URL configured"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={camera.isEnabled}
                          onChange={(e) =>
                            updateCamera.mutate({
                              id: camera.id,
                              data: { isEnabled: e.target.checked },
                            })
                          }
                          className="rounded"
                        />
                        Enabled
                      </label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(camera)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteCamera(camera)}
                        disabled={deleteCamera.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>

      {/* Home Assistant Cameras (read-only reference) */}
      {haConnected && (
        <Card className="border-2 border-primary/40">
          <CardHeader>
            <CardTitle>Home Assistant Cameras</CardTitle>
            <CardDescription>
              Cameras from your Home Assistant instance
            </CardDescription>
          </CardHeader>
          <CardContent>
            {haCameras.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <Home className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No Home Assistant cameras configured
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => window.location.href = appPath("/settings?tab=homeassistant")}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Cameras in Home Assistant Settings
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {haCameras.length} camera{haCameras.length !== 1 ? "s" : ""} configured via Home Assistant
                </p>
                <div className="space-y-2">
                  {haCameras.map((camera) => (
                    <div
                      key={camera.entityId}
                      className="flex items-center gap-3 rounded-lg border border-border p-3 bg-muted/30"
                    >
                      <Home className="h-4 w-4 text-blue-500" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{camera.name}</p>
                        <p className="text-xs text-muted-foreground">{camera.entityId}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {camera.refreshInterval}s • {camera.aspectRatio}
                      </span>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.href = appPath("/settings?tab=homeassistant")}
                >
                  Manage in Home Assistant Settings
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

type HandwritingProvider = "tesseract" | "gemini" | "openai" | "claude" | "google_vision";

const HANDWRITING_PROVIDERS: { value: HandwritingProvider; label: string; description: string; price: string }[] = [
  { value: "tesseract", label: "Tesseract (Local)", description: "Free, works offline. Best for clear handwriting.", price: "Free" },
  { value: "gemini", label: "Google Gemini", description: "Recommended - Best value with excellent accuracy.", price: "~$0.001/image" },
  { value: "openai", label: "OpenAI GPT-4o", description: "Great for complex text and context understanding.", price: "~$0.01-0.03/image" },
  { value: "claude", label: "Anthropic Claude", description: "Good accuracy with strong context understanding.", price: "~$0.01-0.02/image" },
  { value: "google_vision", label: "Google Cloud Vision", description: "Best pure OCR accuracy for document-style text.", price: "~$0.0015/image" },
];

interface HandwritingTestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function HandwritingTestModal({ isOpen, onClose }: HandwritingTestModalProps) {
  const [testResult, setTestResult] = useState<{ text: string; provider: string } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const handleRecognized = async (text: string) => {
    // The HandwritingCanvas already did the recognition, so we just need to get the provider info
    // We'll use a workaround: call the API directly to get the result with provider info
    setTestResult({ text, provider: "current" });
  };

  const handleClose = () => {
    setTestResult(null);
    setTestError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">Test Handwriting Recognition</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!testResult ? (
            <HandwritingCanvas
              onRecognized={handleRecognized}
              onCancel={handleClose}
              placeholder="Write something here to test recognition..."
              className="h-64"
            />
          ) : (
            <div className="space-y-4">
              {/* Success Result */}
              <div className="rounded-lg bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 p-4">
                <div className="flex items-center gap-2 text-green-800 dark:text-green-200 mb-3">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium text-lg">Recognition Successful</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-green-700 dark:text-green-300 font-medium mb-1">
                      Recognized Text:
                    </p>
                    <p className="bg-white dark:bg-gray-800 rounded-lg p-3 text-gray-900 dark:text-gray-100 font-mono border border-green-200 dark:border-green-800">
                      {testResult.text || "(empty)"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setTestResult(null)}
                >
                  Try Again
                </Button>
                <Button onClick={handleClose}>
                  Done
                </Button>
              </div>
            </div>
          )}

          {testError && (
            <div className="mt-4 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 p-4">
              <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                <XCircle className="h-5 w-5" />
                <span className="font-medium">Recognition failed:</span>
              </div>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">{testError}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HandwritingSettings() {
  const queryClient = useQueryClient();
  const [selectedProvider, setSelectedProvider] = useState<HandwritingProvider>("tesseract");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [showTestModal, setShowTestModal] = useState(false);

  // Fetch current settings
  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["system-settings"],
    queryFn: () => api.getAllSettings(),
  });

  // Fetch provider configuration status
  const { data: providerStatus } = useQuery({
    queryKey: ["handwriting-provider"],
    queryFn: () => api.getHandwritingProvider(),
  });

  // Initialize selected provider from settings
  useEffect(() => {
    const providerSetting = settings.find((s) => s.category === "handwriting" && s.key === "provider");
    if (providerSetting?.value) {
      setSelectedProvider(providerSetting.value as HandwritingProvider);
    }
  }, [settings]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      await api.updateCategorySettings("handwriting", { provider: selectedProvider });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      queryClient.invalidateQueries({ queryKey: ["handwriting-provider"] });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    },
    onError: () => {
      setSaveStatus("error");
    },
  });

  const selectedProviderInfo = HANDWRITING_PROVIDERS.find((p) => p.value === selectedProvider);

  // Check if a provider is configured
  const isProviderConfigured = (providerValue: HandwritingProvider): boolean => {
    if (!providerStatus?.configured) return providerValue === "tesseract";
    const configMap: Record<HandwritingProvider, boolean> = {
      tesseract: true, // Always available
      openai: providerStatus.configured.openai,
      claude: providerStatus.configured.claude,
      gemini: providerStatus.configured.gemini,
      google_vision: providerStatus.configured.google_vision,
    };
    return configMap[providerValue] ?? false;
  };

  return (
    <Card className="border-2 border-primary/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Pencil className="h-5 w-5" />
          Handwriting Recognition
        </CardTitle>
        <CardDescription>
          Configure how handwritten text is recognized. Choose between free local processing or AI providers for better accuracy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Provider Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                Recognition Provider
              </label>
              <div className="space-y-2">
                {HANDWRITING_PROVIDERS.map((provider) => {
                  const isConfigured = isProviderConfigured(provider.value);
                  const isSelected = selectedProvider === provider.value;
                  const needsApiKey = provider.value !== "tesseract" && !isConfigured;

                  return (
                    <button
                      key={provider.value}
                      type="button"
                      onClick={() => {
                        setSelectedProvider(provider.value);
                        setSaveStatus("idle");
                      }}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10 dark:bg-primary/20"
                          : "border-border bg-card hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Selection indicator */}
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          isSelected
                            ? "border-primary bg-primary"
                            : "border-muted-foreground/50"
                        }`}>
                          {isSelected && (
                            <div className="w-2.5 h-2.5 rounded-full bg-white" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-semibold text-foreground text-base">
                                {provider.label}
                              </h4>
                              <p className="text-sm text-primary font-medium">
                                {provider.price}
                              </p>
                            </div>
                            {/* Configuration status */}
                            <div className="flex-shrink-0">
                              {isConfigured ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-600 dark:text-green-400">
                                  <CheckCircle className="h-3 w-3" />
                                  Ready
                                </span>
                              ) : needsApiKey ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-600 dark:text-amber-400">
                                  <Key className="h-3 w-3" />
                                  Needs Key
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {provider.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Warning if selected provider needs API key */}
            {selectedProvider !== "tesseract" && !isProviderConfigured(selectedProvider) && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 p-4">
                <div className="flex items-start gap-3">
                  <Key className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-200">
                      API Key Required
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      To use {selectedProviderInfo?.label}, configure your API key in{" "}
                      <strong>Settings → System → {selectedProvider === "gemini" || selectedProvider === "google_vision" ? "Google APIs" : selectedProvider === "openai" ? "OpenAI" : "Anthropic"}</strong>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Test Recognition */}
            <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950 p-4">
              <label className="block text-sm font-medium text-purple-900 dark:text-purple-100 mb-2">
                Test Recognition
              </label>
              <p className="text-xs text-purple-700 dark:text-purple-300 mb-3">
                Draw something to test the current provider and see the recognized text.
              </p>
              <Button
                variant="outline"
                onClick={() => setShowTestModal(true)}
                className="border-purple-300 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900"
              >
                <PenTool className="h-4 w-4 mr-2" />
                Test Recognition
              </Button>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm">
                {saveStatus === "saved" && (
                  <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                    <CheckCircle className="h-4 w-4" />
                    Settings saved
                  </span>
                )}
                {saveStatus === "error" && (
                  <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                    <XCircle className="h-4 w-4" />
                    Error saving
                  </span>
                )}
              </div>
              <Button
                onClick={() => saveSettings.mutate()}
                disabled={saveStatus === "saving"}
              >
                {saveStatus === "saving" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  "Save Settings"
                )}
              </Button>
            </div>

            {/* Test Modal */}
            <HandwritingTestModal
              isOpen={showTestModal}
              onClose={() => setShowTestModal(false)}
            />

            {/* Info Box */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">About Handwriting Recognition</h4>
              <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400 mb-4">
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-gray-400" />
                  <strong>Tesseract:</strong> Runs entirely in your browser, no API key needed
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-gray-400" />
                  <strong>AI Providers:</strong> Send handwriting images to cloud for recognition
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-gray-400" />
                  <strong>Fallback:</strong> If AI fails, automatically falls back to Tesseract
                </li>
              </ul>

              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Provider Comparison</h4>
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-green-500" />
                  <div>
                    <strong>Tesseract (Local)</strong> — Free, offline, good for clear handwriting. No data leaves your device.
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <div>
                    <strong>Google Gemini</strong> — Best value (~$0.001/image). Excellent accuracy, fast responses. Recommended for most users.
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-purple-500" />
                  <div>
                    <strong>OpenAI GPT-4o</strong> — Premium (~$0.01-0.03/image). Great for messy handwriting and complex context.
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-orange-500" />
                  <div>
                    <strong>Anthropic Claude</strong> — Premium (~$0.01-0.02/image). Strong reasoning, good with unclear text.
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-red-500" />
                  <div>
                    <strong>Google Cloud Vision</strong> — Low cost (~$0.0015/image). Pure OCR, best for printed or document-style text.
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AIProviderKeys() {
  const queryClient = useQueryClient();
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});
  const [testStatus, setTestStatus] = useState<Record<string, "idle" | "testing" | "success" | "error">>({});
  const [testErrors, setTestErrors] = useState<Record<string, string>>({});

  // Provider config: category and key name for the new location
  const providers = [
    { id: "openai", name: "OpenAI", category: "openai", keyName: "api_key", placeholder: "sk-...", color: "purple", testName: "openai", link: "https://platform.openai.com/api-keys" },
    { id: "anthropic", name: "Anthropic", category: "anthropic", keyName: "api_key", placeholder: "sk-ant-...", color: "orange", testName: "claude", link: "https://console.anthropic.com/settings/keys" },
    { id: "gemini", name: "Google Gemini", category: "google", keyName: "gemini_api_key", placeholder: "AIza...", color: "blue", testName: "gemini", link: "https://aistudio.google.com/app/apikey" },
    { id: "google_vision", name: "Google Cloud Vision", category: "google", keyName: "vision_api_key", placeholder: "AIza...", color: "red", testName: "google_vision", link: "https://console.cloud.google.com/apis/credentials" },
  ];

  // Fetch current settings
  const { data: settings = [] } = useQuery({
    queryKey: ["system-settings"],
    queryFn: () => api.getAllSettings(),
  });

  const getSettingValue = (category: string, keyName: string): string => {
    const formKey = `${category}.${keyName}`;
    if (formValues[formKey] !== undefined) {
      return formValues[formKey];
    }
    const setting = settings.find((s) => s.category === category && s.key === keyName);
    return setting?.value || "";
  };

  const handleInputChange = (category: string, keyName: string, value: string) => {
    const formKey = `${category}.${keyName}`;
    setFormValues((prev) => ({ ...prev, [formKey]: value }));
    setSaveStatus((prev) => ({ ...prev, [formKey]: "idle" }));
  };

  const saveKey = useMutation({
    mutationFn: async ({ category, keyName }: { category: string; keyName: string }) => {
      const formKey = `${category}.${keyName}`;
      const value = formValues[formKey];
      if (value === "••••••••") return;
      await api.updateCategorySettings(category, { [keyName]: value || null });
    },
    onSuccess: (_, { category, keyName }) => {
      const formKey = `${category}.${keyName}`;
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      queryClient.invalidateQueries({ queryKey: ["handwriting-provider"] });
      setSaveStatus((prev) => ({ ...prev, [formKey]: "saved" }));
      setFormValues((prev) => {
        const newValues = { ...prev };
        delete newValues[formKey];
        return newValues;
      });
      setTimeout(() => setSaveStatus((prev) => ({ ...prev, [formKey]: "idle" })), 2000);
    },
    onError: (_, { category, keyName }) => {
      const formKey = `${category}.${keyName}`;
      setSaveStatus((prev) => ({ ...prev, [formKey]: "error" }));
    },
  });

  const handleTest = async (provider: typeof providers[0]) => {
    setTestStatus((prev) => ({ ...prev, [provider.id]: "testing" }));
    setTestErrors((prev) => ({ ...prev, [provider.id]: "" }));

    try {
      await api.testHandwritingProvider(provider.testName);
      setTestStatus((prev) => ({ ...prev, [provider.id]: "success" }));
      setTimeout(() => setTestStatus((prev) => ({ ...prev, [provider.id]: "idle" })), 3000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Connection failed";
      setTestErrors((prev) => ({ ...prev, [provider.id]: errorMessage }));
      setTestStatus((prev) => ({ ...prev, [provider.id]: "error" }));
      setTimeout(() => {
        setTestStatus((prev) => ({ ...prev, [provider.id]: "idle" }));
        setTestErrors((prev) => ({ ...prev, [provider.id]: "" }));
      }, 5000);
    }
  };

  const getColorClasses = (color: string) => {
    switch (color) {
      case "purple": return { dot: "bg-purple-500", border: "border-purple-200 dark:border-purple-800", bg: "bg-purple-50 dark:bg-purple-950" };
      case "orange": return { dot: "bg-orange-500", border: "border-orange-200 dark:border-orange-800", bg: "bg-orange-50 dark:bg-orange-950" };
      case "blue": return { dot: "bg-blue-500", border: "border-blue-200 dark:border-blue-800", bg: "bg-blue-50 dark:bg-blue-950" };
      case "red": return { dot: "bg-red-500", border: "border-red-200 dark:border-red-800", bg: "bg-red-50 dark:bg-red-950" };
      default: return { dot: "bg-gray-500", border: "border-gray-200 dark:border-gray-700", bg: "bg-gray-50 dark:bg-gray-800" };
    }
  };

  return (
    <Card className="h-fit border-2 border-primary/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          API Keys
        </CardTitle>
        <CardDescription>
          Manage API keys for each AI provider
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {providers.map((provider) => {
          const colors = getColorClasses(provider.color);
          const formKey = `${provider.category}.${provider.keyName}`;
          const currentValue = getSettingValue(provider.category, provider.keyName);
          const isConfigured = currentValue && currentValue !== "" && currentValue !== "••••••••";
          const providerSaveStatus = saveStatus[formKey] || "idle";
          const providerTestStatus = testStatus[provider.id] || "idle";
          const providerTestError = testErrors[provider.id] || "";

          return (
            <div
              key={provider.id}
              className={`rounded-lg border ${colors.border} ${colors.bg} p-3 space-y-2`}
            >
              {/* Provider Header with Actions */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${colors.dot}`} />
                  <span className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">{provider.name}</span>
                  <a
                    href={provider.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 flex-shrink-0"
                  >
                    Get key
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {providerTestStatus === "success" && (
                    <span className="text-xs text-green-600 dark:text-green-400">Connected</span>
                  )}
                  {providerTestStatus === "error" && (
                    <span className="text-xs text-red-600 dark:text-red-400 truncate max-w-[150px]" title={providerTestError}>
                      {providerTestError || "Failed"}
                    </span>
                  )}
                  {providerSaveStatus === "saved" && (
                    <span className="text-xs text-green-600 dark:text-green-400">Saved</span>
                  )}
                  {isConfigured && !providerSaveStatus.match(/saved/) && !providerTestStatus.match(/success|error/) && (
                    <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                  )}
                  <button
                    onClick={() => handleTest(provider)}
                    disabled={providerTestStatus === "testing" || !currentValue}
                    className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {providerTestStatus === "testing" ? "..." : "Test"}
                  </button>
                  <button
                    onClick={() => {
                      setSaveStatus((prev) => ({ ...prev, [formKey]: "saving" }));
                      saveKey.mutate({ category: provider.category, keyName: provider.keyName });
                    }}
                    disabled={providerSaveStatus === "saving" || formValues[formKey] === undefined}
                    className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {providerSaveStatus === "saving" ? "..." : "Save"}
                  </button>
                </div>
              </div>

              {/* API Key Input */}
              <input
                type="password"
                value={formValues[formKey] ?? currentValue}
                onChange={(e) => handleInputChange(provider.category, provider.keyName, e.target.value)}
                placeholder={provider.placeholder}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-primary focus:outline-none"
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function AISettings() {
  return (
    <div className="space-y-6">
      {/* AI Settings Header - Full Width */}
      <Card className="border-2 border-primary/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Features
          </CardTitle>
          <CardDescription>
            Configure AI-powered features. You can use different providers for different features, or share API keys across features.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 p-4">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">About AI Integration</h4>
            <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
                API keys are encrypted and stored securely in the database
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
                Each feature can be configured to use a different provider
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
                Local/free options are available when you want to avoid API costs
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Three Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Column 1 - Handwriting Recognition */}
        <HandwritingSettings />

        {/* Column 2 - Placeholder for future AI features */}
        <Card className="border-dashed h-fit border-2 border-primary/40">
          <CardHeader>
            <CardTitle className="text-muted-foreground">More AI Features Coming Soon</CardTitle>
            <CardDescription>
              Future AI-powered features will appear here, such as:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                Smart event suggestions from natural language
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                Photo captioning and search
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                Voice command processing
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Column 3 - API Keys Management */}
        <AIProviderKeys />
      </div>
    </div>
  );
}

// Helper functions for automation display
function formatTriggerSummary(triggerType: AutomationTriggerType, config: TimeTriggerConfig | StateTriggerConfig | DurationTriggerConfig): string {
  if (triggerType === "time") {
    const timeConfig = config as TimeTriggerConfig;
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const days = timeConfig.days?.map((d) => dayNames[d]).join(", ") || "Every day";
    return `${timeConfig.time} (${days})`;
  }
  if (triggerType === "state") {
    const stateConfig = config as StateTriggerConfig;
    const entityName = stateConfig.entityId.split(".")[1]?.replace(/_/g, " ") || stateConfig.entityId;
    return `${entityName}: ${stateConfig.fromState || "*"} → ${stateConfig.toState}`;
  }
  if (triggerType === "duration") {
    const durationConfig = config as DurationTriggerConfig;
    const entityName = durationConfig.entityId.split(".")[1]?.replace(/_/g, " ") || durationConfig.entityId;
    return `${entityName} ${durationConfig.targetState} for ${durationConfig.durationMinutes}min`;
  }
  return "Unknown trigger";
}

function formatActionSummary(actionType: AutomationActionType, config: ServiceCallActionConfig | NotificationActionConfig): string {
  if (actionType === "service_call") {
    const serviceConfig = config as ServiceCallActionConfig;
    const entityName = serviceConfig.entityId.split(".")[1]?.replace(/_/g, " ") || serviceConfig.entityId;
    return `${serviceConfig.service.replace(/_/g, " ")} ${entityName}`;
  }
  if (actionType === "notification") {
    const notifConfig = config as NotificationActionConfig;
    return notifConfig.title;
  }
  return "Unknown action";
}

function getTriggerIcon(triggerType: AutomationTriggerType) {
  switch (triggerType) {
    case "time": return <Clock className="h-3 w-3" />;
    case "state": return <Power className="h-3 w-3" />;
    case "duration": return <Clock className="h-3 w-3" />;
    default: return <Zap className="h-3 w-3" />;
  }
}

function getActionIcon(actionType: AutomationActionType) {
  switch (actionType) {
    case "service_call": return <Power className="h-3 w-3" />;
    case "notification": return <Bell className="h-3 w-3" />;
    default: return <Zap className="h-3 w-3" />;
  }
}

function AssumptionsSettings() {
  const queryClient = useQueryClient();
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const { data: assumptions = [], isLoading } = useQuery({
    queryKey: ["assumptions"],
    queryFn: () => api.getAssumptions(),
  });

  const createMutation = useMutation({
    mutationFn: (text: string) => api.createAssumption(text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assumptions"] });
      setNewText("");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ text: string; enabled: boolean }> }) =>
      api.updateAssumption(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assumptions"] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAssumption(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["assumptions"] }),
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newText.trim()) createMutation.mutate(newText.trim());
  };

  const handleSaveEdit = (id: string) => {
    if (editText.trim()) {
      updateMutation.mutate({ id, data: { text: editText.trim() } });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          AI Assumptions
        </CardTitle>
        <CardDescription>
          Rules and instructions that all AI features will follow. Enable or disable individual assumptions as needed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : assumptions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Lightbulb className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p>No assumptions yet</p>
            <p className="text-sm">Add rules to guide AI behavior across chat, automations, and more.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {assumptions.map((a) => (
              <div
                key={a.id}
                className={cn(
                  "flex items-start gap-3 rounded-lg border border-border p-3 transition-colors",
                  !a.enabled && "opacity-50"
                )}
              >
                <button
                  onClick={() => updateMutation.mutate({ id: a.id, data: { enabled: !a.enabled } })}
                  className="mt-0.5 shrink-0"
                  title={a.enabled ? "Disable" : "Enable"}
                >
                  {a.enabled ? (
                    <ToggleRight className="h-5 w-5 text-primary" />
                  ) : (
                    <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  {editingId === a.id ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit(a.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm focus:border-primary focus:outline-none"
                        autoFocus
                      />
                      <Button size="sm" onClick={() => handleSaveEdit(a.id)}>
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <p
                      className="text-sm cursor-pointer hover:text-primary transition-colors"
                      onClick={() => { setEditingId(a.id); setEditText(a.text); }}
                      title="Click to edit"
                    >
                      {a.text}
                    </p>
                  )}
                </div>

                {editingId !== a.id && (
                  <button
                    onClick={() => deleteMutation.mutate(a.id)}
                    className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add new assumption */}
        <form onSubmit={handleAdd} className="flex gap-2 pt-2">
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Add a new assumption..."
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <Button type="submit" disabled={!newText.trim() || createMutation.isPending}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function AutomationsSettings() {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [parseResult, setParseResult] = useState<AutomationParseResult | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAutomationId, setEditAutomationId] = useState<string | null>(null);

  // Fetch automations
  const { data: automations = [], isLoading } = useQuery({
    queryKey: ["automations"],
    queryFn: () => api.getAutomations(),
  });

  // Check if HA is configured
  const { data: haConfig } = useQuery({
    queryKey: ["homeassistant", "config"],
    queryFn: () => api.getHomeAssistantConfig(),
  });

  const isHaConfigured = !!(haConfig && haConfig.url);

  // Parse mutation
  const parseMutation = useMutation({
    mutationFn: (prompt: string) => api.parseAutomation(prompt),
    onSuccess: (result) => {
      setParseResult(result);
      setEditName(result.name);
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.createAutomation>[0]) => api.createAutomation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      setParseResult(null);
      setPrompt("");
      setEditName("");
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.updateAutomation>[1] }) =>
      api.updateAutomation(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAutomation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
    },
  });

  // Test mutation
  const testMutation = useMutation({
    mutationFn: (id: string) => api.testAutomation(id),
  });

  const handleParse = () => {
    if (!prompt.trim()) return;
    parseMutation.mutate(prompt);
  };

  const handleCreate = () => {
    if (!parseResult) return;
    createMutation.mutate({
      name: editName || parseResult.name,
      description: prompt,
      triggerType: parseResult.trigger.type,
      triggerConfig: parseResult.trigger.config,
      actionType: parseResult.action.type,
      actionConfig: parseResult.action.config,
    });
  };

  const handleCancel = () => {
    setParseResult(null);
    setPrompt("");
    setEditName("");
  };

  const handleToggleEnabled = (automation: Automation) => {
    updateMutation.mutate({
      id: automation.id,
      data: { enabled: !automation.enabled },
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this automation?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleTest = (id: string) => {
    testMutation.mutate(id);
  };

  if (!isHaConfigured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            AI Automations
          </CardTitle>
          <CardDescription>
            Create smart home automations using natural language
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950 p-4">
            <p className="text-yellow-800 dark:text-yellow-200">
              Please configure Home Assistant first to use automations.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create Automation Card */}
      <Card className="border-2 border-primary/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Create Automation
          </CardTitle>
          <CardDescription>
            Describe what you want to automate in plain English
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Natural Language Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleParse()}
              placeholder='e.g., "Turn on kitchen lights at 7am on weekdays" or "Notify me when the garage is open for 30 minutes"'
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={parseMutation.isPending}
            />
            <Button
              onClick={handleParse}
              disabled={!prompt.trim() || parseMutation.isPending}
            >
              {parseMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              <span className="ml-2">Parse</span>
            </Button>
          </div>

          {/* Parse Error */}
          {parseMutation.isError && (
            <div className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950 p-3">
              <p className="text-sm text-red-600 dark:text-red-400">
                {parseMutation.error instanceof Error ? parseMutation.error.message : "Failed to parse automation"}
              </p>
            </div>
          )}

          {/* Parse Result Preview */}
          {parseResult && (
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Preview</h4>
                <span className="text-xs text-muted-foreground">
                  Confidence: {Math.round(parseResult.confidence * 100)}%
                </span>
              </div>

              {/* Editable Name */}
              <div>
                <label className="text-sm text-muted-foreground">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>

              {/* Trigger & Action Display */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2 text-sm font-medium mb-2">
                    {getTriggerIcon(parseResult.trigger.type)}
                    <span>Trigger</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatTriggerSummary(parseResult.trigger.type, parseResult.trigger.config as TimeTriggerConfig | StateTriggerConfig | DurationTriggerConfig)}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2 text-sm font-medium mb-2">
                    {getActionIcon(parseResult.action.type)}
                    <span>Action</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatActionSummary(parseResult.action.type, parseResult.action.config as ServiceCallActionConfig | NotificationActionConfig)}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Save Automation
                </Button>
              </div>
            </div>
          )}

          {/* Example Prompts */}
          <div className="rounded-lg border border-border p-3">
            <h4 className="text-sm font-medium mb-2">Example prompts:</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>"Turn on the living room lights at sunset"</li>
              <li>"Notify me when the washer finishes"</li>
              <li>"Lock the front door at 10pm every day"</li>
              <li>"Alert me if the garage door is open for 30 minutes"</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Automations List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Your Automations
          </CardTitle>
          <CardDescription>
            {automations.length} automation{automations.length !== 1 ? "s" : ""} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : automations.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No automations yet. Create one above!
            </p>
          ) : (
            <div className="space-y-3">
              {automations.map((automation) => (
                <div
                  key={automation.id}
                  className={`rounded-lg border p-4 ${
                    automation.enabled
                      ? "border-border"
                      : "border-border/50 bg-muted/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className={`font-medium ${!automation.enabled ? "text-muted-foreground" : ""}`}>
                          {automation.name}
                        </h4>
                        {!automation.enabled && (
                          <span className="text-xs text-muted-foreground">(disabled)</span>
                        )}
                      </div>
                      {automation.description && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          "{automation.description}"
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="inline-flex items-center gap-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                          {getTriggerIcon(automation.triggerType as AutomationTriggerType)}
                          {formatTriggerSummary(
                            automation.triggerType as AutomationTriggerType,
                            automation.triggerConfig as TimeTriggerConfig | StateTriggerConfig | DurationTriggerConfig
                          )}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-1 rounded">
                          {getActionIcon(automation.actionType as AutomationActionType)}
                          {formatActionSummary(
                            automation.actionType as AutomationActionType,
                            automation.actionConfig as ServiceCallActionConfig | NotificationActionConfig
                          )}
                        </span>
                      </div>
                      {automation.lastTriggeredAt && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Last triggered: {new Date(automation.lastTriggeredAt).toLocaleString()}
                          {automation.triggerCount > 0 && ` (${automation.triggerCount} times)`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleTest(automation.id)}
                        disabled={testMutation.isPending}
                        className="p-2 rounded hover:bg-muted transition-colors"
                        title="Test Run"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleToggleEnabled(automation)}
                        className="p-2 rounded hover:bg-muted transition-colors"
                        title={automation.enabled ? "Disable" : "Enable"}
                      >
                        {automation.enabled ? (
                          <ToggleRight className="h-5 w-5 text-primary" />
                        ) : (
                          <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(automation.id)}
                        disabled={deleteMutation.isPending}
                        className="p-2 rounded hover:bg-red-100 dark:hover:bg-red-900 text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HomeAssistantSettings() {
  const queryClient = useQueryClient();
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [showEntityPicker, setShowEntityPicker] = useState(false);
  const [showCameraPicker, setShowCameraPicker] = useState(false);
  const [editingCamera, setEditingCamera] = useState<string | null>(null);
  const [editingEntity, setEditingEntity] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [accessToken, setAccessToken] = useState("");
  // Room management state
  const [newRoomName, setNewRoomName] = useState("");
  const [editingRoom, setEditingRoom] = useState<HomeAssistantRoom | null>(null);
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);

  const { data: config, isLoading } = useQuery({
    queryKey: ["homeassistant", "config"],
    queryFn: () => api.getHomeAssistantConfig(),
  });

  const isConnected = !!(config && config.url);

  // Real-time WebSocket connection status
  const wsConnected = useHAWebSocket((s) => s.connected);
  const wsConnecting = useHAWebSocket((s) => s.connecting);
  const wsError = useHAWebSocket((s) => s.error);
  const wsConnect = useHAWebSocket((s) => s.connect);

  const { data: entities = [] } = useQuery({
    queryKey: ["homeassistant", "entities"],
    queryFn: () => api.getHomeAssistantEntities(),
    enabled: isConnected,
  });

  // Fetch all HA states for entity picker
  const { data: allStates = [], isLoading: isLoadingStates } = useQuery({
    queryKey: ["homeassistant", "states"],
    queryFn: () => api.getHomeAssistantStates(),
    enabled: isConnected && showEntityPicker,
  });

  // Fetch enabled HA cameras (stored in entities table with camera.* prefix)
  const enabledCameras = entities.filter((e) => e.entityId.startsWith("camera."));

  // Fetch all HA camera states for vacuum map camera selection
  const { data: allCameraStates = [] } = useQuery({
    queryKey: ["homeassistant", "states", "cameras"],
    queryFn: async () => {
      const states = await api.getHomeAssistantStates();
      return states.filter((s) => s.entity_id.startsWith("camera."));
    },
    enabled: isConnected && editingEntity !== null,
  });

  // Fetch available HA cameras for picker
  const { data: availableCameras = [], isLoading: isLoadingCameras } = useQuery({
    queryKey: ["homeassistant", "cameras", "available"],
    queryFn: () => api.getHomeAssistantAvailableCameras(),
    enabled: isConnected && showCameraPicker,
  });

  // Auto-discover Home Assistant instances when not connected
  const { data: discovered = [], isLoading: isDiscovering } = useQuery({
    queryKey: ["homeassistant", "discover"],
    queryFn: () => api.discoverHomeAssistant(),
    enabled: !isConnected, // Only scan when not connected
    staleTime: 60000, // Cache for 1 minute
  });

  // Fetch rooms for room management
  const { data: rooms = [] } = useQuery({
    queryKey: ["homeassistant", "rooms"],
    queryFn: () => api.getHomeAssistantRooms(),
    enabled: isConnected,
  });

  // Fetch all HA states for room sensor configuration (need these for room management)
  const { data: allStatesForRooms = [] } = useQuery({
    queryKey: ["homeassistant", "states", "for-rooms"],
    queryFn: () => api.getHomeAssistantStates(),
    enabled: isConnected && expandedRoomId !== null,
  });

  const saveConfig = useMutation({
    mutationFn: (data: { url: string; accessToken: string }) =>
      api.saveHomeAssistantConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homeassistant"] });
      setShowConfigForm(false);
      setUrl("");
      setAccessToken("");
    },
  });

  const deleteConfig = useMutation({
    mutationFn: () => api.deleteHomeAssistantConfig(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homeassistant"] });
    },
  });

  const addEntity = useMutation({
    mutationFn: (data: {
      entityId: string;
      displayName?: string;
      showInDashboard?: boolean;
      settings?: { refreshInterval?: number; aspectRatio?: "16:9" | "4:3" | "1:1" };
    }) => api.addHomeAssistantEntity(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homeassistant", "entities"] });
    },
  });

  const removeEntity = useMutation({
    mutationFn: (id: string) => api.removeHomeAssistantEntity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homeassistant", "entities"] });
    },
  });

  // Room mutations
  const createRoom = useMutation({
    mutationFn: (data: { name: string; temperatureSensorId?: string; humiditySensorId?: string; windowSensorId?: string }) =>
      api.createHomeAssistantRoom(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homeassistant", "rooms"] });
    },
  });

  const updateRoom = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<HomeAssistantRoom> }) =>
      api.updateHomeAssistantRoom(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homeassistant", "rooms"] });
    },
  });

  const deleteRoom = useMutation({
    mutationFn: (id: string) => api.deleteHomeAssistantRoom(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homeassistant", "rooms"] });
      queryClient.invalidateQueries({ queryKey: ["homeassistant", "entities"] });
    },
  });

  const assignEntityToRoom = useMutation({
    mutationFn: ({ entityId, roomId }: { entityId: string; roomId: string | null }) =>
      api.assignEntityToRoom(entityId, roomId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homeassistant", "entities"] });
    },
  });

  const handleAddEntity = async (entityId: string) => {
    await addEntity.mutateAsync({ entityId });
  };

  const handleAddCamera = async (entityId: string, displayName?: string) => {
    await addEntity.mutateAsync({
      entityId,
      displayName,
      settings: { refreshInterval: 5, aspectRatio: "16:9" as const },
    });
    setShowCameraPicker(false);
    queryClient.invalidateQueries({ queryKey: ["ha-cameras"] });
  };

  const updateCameraSettings = useMutation({
    mutationFn: ({
      id,
      displayName,
      settings,
    }: {
      id: string;
      displayName?: string | null;
      settings?: { refreshInterval?: number; aspectRatio?: "16:9" | "4:3" | "1:1" };
    }) =>
      api.updateHomeAssistantEntity(id, { displayName, settings }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homeassistant", "entities"] });
      queryClient.invalidateQueries({ queryKey: ["ha-cameras"] });
      setEditingCamera(null);
    },
  });

  const updateEntitySettings = useMutation({
    mutationFn: ({
      id,
      displayName,
      settings,
    }: {
      id: string;
      displayName?: string | null;
      settings: {
        durationAlert?: {
          enabled: boolean;
          thresholdMinutes: number;
          repeatIntervalMinutes?: number;
        };
        vacuum?: {
          mapCameraEntityId?: string;
        };
      };
    }) =>
      api.updateHomeAssistantEntity(id, { displayName, settings }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homeassistant", "entities"] });
      setEditingEntity(null);
    },
  });

  const handleRemoveCamera = (entity: { id: string; entityId: string }) => {
    if (confirm(`Remove camera "${entity.entityId}"?`)) {
      removeEntity.mutate(entity.id);
      queryClient.invalidateQueries({ queryKey: ["ha-cameras"] });
    }
  };

  const selectedEntityIds = new Set(entities.map((e) => e.entityId));

  const handleDisconnect = () => {
    if (confirm("Disconnect from Home Assistant? This will remove all configured entities.")) {
      deleteConfig.mutate();
    }
  };

  const handleRemoveEntity = (entity: { id: string; entityId: string }) => {
    if (confirm(`Remove entity "${entity.entityId}"?`)) {
      removeEntity.mutate(entity.id);
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (url && accessToken) {
      saveConfig.mutate({ url, accessToken });
    }
  };

  const handleSelectDiscovered = (discoveredUrl: string) => {
    setUrl(discoveredUrl);
    setShowConfigForm(true);
  };

  // Room handlers
  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;
    await createRoom.mutateAsync({ name: newRoomName.trim() });
    setNewRoomName("");
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (confirm("Are you sure you want to delete this room? Entities will be moved to 'All Devices'.")) {
      await deleteRoom.mutateAsync(roomId);
    }
  };

  // Get available sensors from entity states for room configuration
  const temperatureSensors = allStatesForRooms.filter(
    (s) => s.entity_id.startsWith("sensor.") &&
    (s.attributes.device_class === "temperature" ||
     s.attributes.unit_of_measurement === "°C" ||
     s.attributes.unit_of_measurement === "°F")
  );

  const humiditySensors = allStatesForRooms.filter(
    (s) => s.entity_id.startsWith("sensor.") &&
    (s.attributes.device_class === "humidity" ||
     s.attributes.unit_of_measurement === "%")
  );

  const binarySensors = allStatesForRooms.filter(
    (s) => s.entity_id.startsWith("binary_sensor.") &&
    (s.attributes.device_class === "window" ||
     s.attributes.device_class === "door" ||
     s.attributes.device_class === "opening")
  );

  // Get entities for a room
  const getEntitiesForRoom = (roomId: string | null) => {
    return entities.filter((e) => e.roomId === roomId);
  };

  // Get entity name from state
  const getEntityName = (entityId: string) => {
    const state = allStatesForRooms.find(s => s.entity_id === entityId);
    return state?.attributes.friendly_name as string || entityId;
  };

  return (
    <>
      <Card className="border-2 border-primary/40">
        <CardHeader>
          <CardTitle>Home Assistant Connection</CardTitle>
          <CardDescription>
            Connect to your Home Assistant instance to control smart home devices
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : config && config.url ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border-2 border-green-600 bg-green-100 dark:bg-green-950 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-600/20 dark:bg-green-500/20">
                    <Home className="h-5 w-5 text-green-700 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium text-green-800 dark:text-green-200">Configured</p>
                    <p className="text-sm text-green-700 dark:text-green-400">{config.url}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
                    onClick={() => {
                      setUrl(config.url);
                      setShowConfigForm(true);
                    }}
                  >
                    Update
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                    onClick={handleDisconnect}
                    disabled={deleteConfig.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>

              {/* Real-time WebSocket connection status */}
              <div className={cn(
                "flex items-center justify-between rounded-lg border p-3",
                wsConnected
                  ? "border-green-500/40 bg-green-50 dark:bg-green-950/50"
                  : wsConnecting
                    ? "border-yellow-500/40 bg-yellow-50 dark:bg-yellow-950/50"
                    : "border-red-500/40 bg-red-50 dark:bg-red-950/50"
              )}>
                <div className="flex items-center gap-2.5">
                  <div className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    wsConnected
                      ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]"
                      : wsConnecting
                        ? "bg-yellow-500 animate-pulse"
                        : "bg-red-500"
                  )} />
                  <div>
                    <p className={cn(
                      "text-sm font-medium",
                      wsConnected
                        ? "text-green-700 dark:text-green-300"
                        : wsConnecting
                          ? "text-yellow-700 dark:text-yellow-300"
                          : "text-red-700 dark:text-red-300"
                    )}>
                      {wsConnected ? "Live Connection Active" : wsConnecting ? "Connecting..." : "Disconnected"}
                    </p>
                    {wsError && !wsConnected && (
                      <p className="text-xs text-red-600 dark:text-red-400">{wsError}</p>
                    )}
                  </div>
                </div>
                {!wsConnected && !wsConnecting && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => wsConnect()}
                    className="text-xs"
                  >
                    Reconnect
                  </Button>
                )}
              </div>

              {showConfigForm && (
                <form onSubmit={handleSaveConfig} className="space-y-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 p-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-900 dark:text-gray-100">Home Assistant URL</label>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="http://homeassistant.local:8123"
                      required
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-900 dark:text-gray-100">Long-Lived Access Token</label>
                    <input
                      type="password"
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      placeholder="Enter new token to update"
                      required
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-mono text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:border-primary focus:outline-none"
                    />
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Create a new token at{" "}
                      <a
                        href={`${url || config?.url}/profile/security`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {(url || config?.url || "").replace(/^https?:\/\//, "")}/profile/security
                      </a>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600" onClick={() => setShowConfigForm(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saveConfig.isPending}>
                      {saveConfig.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Save"
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-6 text-center bg-gray-50 dark:bg-gray-800/50">
                <Home className="mx-auto h-8 w-8 text-gray-400 dark:text-gray-500" />
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Not connected to Home Assistant
                </p>

                {/* Auto-discovery results */}
                {isDiscovering && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Scanning network for Home Assistant...
                  </div>
                )}

                {!isDiscovering && discovered.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-2">
                      Found {discovered.length} instance{discovered.length > 1 ? "s" : ""} on your network:
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {discovered.map((d) => (
                        <button
                          key={d.url}
                          onClick={() => handleSelectDiscovered(d.url)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800 border border-green-300 dark:border-green-700 transition-colors"
                        >
                          <Home className="h-3.5 w-3.5" />
                          {d.url.replace("http://", "")}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {!isDiscovering && discovered.length === 0 && !showConfigForm && (
                  <p className="mt-3 text-xs text-gray-500 dark:text-gray-500">
                    No instances found automatically. Enter URL manually below.
                  </p>
                )}
              </div>

              {showConfigForm ? (
                <form onSubmit={handleSaveConfig} className="space-y-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 p-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-900 dark:text-gray-100">Home Assistant URL</label>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="http://homeassistant.local:8123"
                      required
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-900 dark:text-gray-100">Long-Lived Access Token</label>
                    <input
                      type="password"
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      placeholder="eyJ0eXAiOiJKV1Q..."
                      required
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-mono text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:border-primary focus:outline-none"
                    />
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {url ? (
                        <>
                          Create one at{" "}
                          <a
                            href={`${url}/profile/security`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {url.replace(/^https?:\/\//, "")}/profile/security
                          </a>
                        </>
                      ) : (
                        "Enter URL above, then create a token at: Profile → Security → Long-Lived Access Tokens"
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600" onClick={() => setShowConfigForm(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saveConfig.isPending}>
                      {saveConfig.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Connect"
                      )}
                    </Button>
                  </div>
                </form>
              ) : (
                <Button onClick={() => setShowConfigForm(true)} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Connect Home Assistant
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {isConnected && (
        <Card className="border-2 border-primary/40">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Configured Entities</CardTitle>
              <CardDescription>
                Entities displayed on your Home Assistant control panel
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowEntityPicker(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Entity
            </Button>
          </CardHeader>
          <CardContent>
            {entities.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-6 text-center bg-gray-50 dark:bg-gray-800/50">
                <Home className="mx-auto h-8 w-8 text-gray-400 dark:text-gray-500" />
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  No entities configured
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setShowEntityPicker(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Entity
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {entities.map((entity) => {
                  const domainParts = entity.entityId.split(".");
                  const domain = domainParts[0] || "";
                  const supportsDurationAlert = ["light", "switch", "cover", "lock", "fan", "binary_sensor", "input_boolean"].includes(domain);
                  const isVacuum = domain === "vacuum";
                  const hasEditableSettings = supportsDurationAlert || isVacuum;
                  const settings = entity.settings as {
                    durationAlert?: {
                      enabled: boolean;
                      thresholdMinutes: number;
                      repeatIntervalMinutes?: number;
                    };
                    vacuum?: {
                      mapCameraEntityId?: string;
                    };
                  };

                  return (
                    <div
                      key={entity.id}
                      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                            {entity.displayName || entity.entityId}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{entity.entityId}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {supportsDurationAlert && settings?.durationAlert?.enabled && (
                            <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                              {settings.durationAlert.thresholdMinutes}m
                            </span>
                          )}
                          {/* Vacuum: Show prominent Configure Map button */}
                          {isVacuum && (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setEditingEntity(entity.id)}
                            >
                              {settings?.vacuum?.mapCameraEntityId ? "Map Configured" : "Configure Map"}
                            </Button>
                          )}
                          {/* Other entities: Show gear icon */}
                          {supportsDurationAlert && !isVacuum && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => setEditingEntity(entity.id)}
                            >
                              <Settings className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleRemoveEntity(entity)}
                            disabled={removeEntity.isPending}
                          >
                            <X className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Entity Edit Modal */}
            {editingEntity && (() => {
              const entity = entities.find(e => e.id === editingEntity);
              if (!entity) return null;

              const domainParts = entity.entityId.split(".");
              const domain = domainParts[0] || "";
              const supportsDurationAlert = ["light", "switch", "cover", "lock", "fan", "binary_sensor", "input_boolean"].includes(domain);
              const isVacuum = domain === "vacuum";
              const settings = entity.settings as {
                durationAlert?: {
                  enabled: boolean;
                  thresholdMinutes: number;
                  repeatIntervalMinutes?: number;
                };
                vacuum?: {
                  mapCameraEntityId?: string;
                };
              };

              return (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingEntity(null)} />
                  <div className="relative z-10 w-full max-w-md mx-4 bg-card border border-border rounded-xl shadow-xl">
                    <div className="flex items-center justify-between p-4 border-b border-border">
                      <h3 className="font-semibold text-foreground">
                        Entity Settings
                      </h3>
                      <button
                        onClick={() => setEditingEntity(null)}
                        className="p-1 rounded-lg hover:bg-muted transition-colors"
                      >
                        <X className="h-5 w-5 text-muted-foreground" />
                      </button>
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const newSettings: {
                          durationAlert?: { enabled: boolean; thresholdMinutes: number; repeatIntervalMinutes?: number };
                          vacuum?: { mapCameraEntityId?: string };
                        } = { ...entity.settings };

                        if (supportsDurationAlert) {
                          const enabled = formData.get("durationAlertEnabled") === "on";
                          const thresholdMinutes = parseInt(formData.get("thresholdMinutes") as string) || 30;
                          const repeatIntervalMinutes = parseInt(formData.get("repeatIntervalMinutes") as string) || 15;
                          newSettings.durationAlert = { enabled, thresholdMinutes, repeatIntervalMinutes };
                        }

                        if (isVacuum) {
                          const mapCameraEntityId = formData.get("mapCameraEntityId") as string;
                          newSettings.vacuum = { mapCameraEntityId: mapCameraEntityId || undefined };
                        }

                        updateEntitySettings.mutate({
                          id: entity.id,
                          displayName: (formData.get("displayName") as string) || null,
                          settings: newSettings,
                        });
                      }}
                      className="p-4 space-y-4"
                    >
                      {/* Entity info */}
                      <div>
                        <label className="text-sm font-medium text-foreground">
                          Display Name
                        </label>
                        <input
                          type="text"
                          name="displayName"
                          defaultValue={entity.displayName || ""}
                          placeholder="Custom name (optional)"
                          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">{entity.entityId}</p>
                      </div>

                      {/* Vacuum-specific: Map Camera Selection */}
                      {isVacuum && (
                        <VacuumMapCameraSelector
                          cameras={allCameraStates}
                          defaultValue={settings?.vacuum?.mapCameraEntityId || ""}
                        />
                      )}

                      {/* Duration Alert Settings */}
                      {supportsDurationAlert && (
                        <div className="pt-2 border-t border-border">
                          <div className="flex items-center gap-3 mb-3">
                            <input
                              type="checkbox"
                              id={`duration-alert-${entity.id}`}
                              name="durationAlertEnabled"
                              defaultChecked={settings?.durationAlert?.enabled}
                              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                            />
                            <label htmlFor={`duration-alert-${entity.id}`} className="text-sm font-medium text-foreground">
                              Enable duration alert
                            </label>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium text-foreground">
                                Alert after (min)
                              </label>
                              <input
                                type="number"
                                name="thresholdMinutes"
                                min="1"
                                defaultValue={settings?.durationAlert?.thresholdMinutes ?? 30}
                                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-foreground">
                                Repeat every (min)
                              </label>
                              <input
                                type="number"
                                name="repeatIntervalMinutes"
                                min="1"
                                defaultValue={settings?.durationAlert?.repeatIntervalMinutes ?? 15}
                                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Button type="submit" size="sm" className="flex-1" disabled={updateEntitySettings.isPending}>
                          {updateEntitySettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Save
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => setEditingEntity(null)}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Cameras Card */}
      {isConnected && (
        <Card className="border-2 border-primary/40">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Cameras</CardTitle>
              <CardDescription>
                Home Assistant cameras to display on the Cameras page
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowCameraPicker(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Camera
            </Button>
          </CardHeader>
          <CardContent>
            {enabledCameras.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-6 text-center bg-gray-50 dark:bg-gray-800/50">
                <Video className="mx-auto h-8 w-8 text-gray-400 dark:text-gray-500" />
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  No cameras configured
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setShowCameraPicker(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Camera
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {enabledCameras.map((camera) => {
                  const settings = camera.settings as {
                    refreshInterval?: number;
                    aspectRatio?: "16:9" | "4:3" | "1:1";
                  };
                  const isEditing = editingCamera === camera.id;

                  return (
                    <div
                      key={camera.id}
                      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
                    >
                      {isEditing ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            updateCameraSettings.mutate({
                              id: camera.id,
                              displayName: formData.get("displayName") as string || null,
                              settings: {
                                refreshInterval: parseInt(formData.get("refreshInterval") as string) || 5,
                                aspectRatio: (formData.get("aspectRatio") as "16:9" | "4:3" | "1:1") || "16:9",
                              },
                            });
                          }}
                          className="space-y-4"
                        >
                          <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Display Name
                            </label>
                            <input
                              type="text"
                              name="displayName"
                              defaultValue={camera.displayName || ""}
                              placeholder="Custom name (optional)"
                              className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                            />
                            <p className="mt-1 text-xs text-gray-500">
                              Entity: {camera.entityId}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Refresh Interval
                              </label>
                              <select
                                name="refreshInterval"
                                defaultValue={settings?.refreshInterval ?? 5}
                                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                              >
                                <option value="1">1 second</option>
                                <option value="2">2 seconds</option>
                                <option value="5">5 seconds</option>
                                <option value="10">10 seconds</option>
                                <option value="30">30 seconds</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Aspect Ratio
                              </label>
                              <select
                                name="aspectRatio"
                                defaultValue={settings?.aspectRatio ?? "16:9"}
                                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                              >
                                <option value="16:9">16:9 (Widescreen)</option>
                                <option value="4:3">4:3 (Standard)</option>
                                <option value="1:1">1:1 (Square)</option>
                              </select>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button type="submit" size="sm" disabled={updateCameraSettings.isPending}>
                              {updateCameraSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Save
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => setEditingCamera(null)}>
                              Cancel
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              {camera.displayName || camera.entityId.replace("camera.", "")}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {camera.entityId} • {settings?.refreshInterval || 5}s refresh • {settings?.aspectRatio || "16:9"}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingCamera(camera.id)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveCamera(camera)}
                              disabled={removeEntity.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Camera Picker Modal */}
      {showCameraPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white dark:bg-gray-900 p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Add Camera</h3>
            {isLoadingCameras ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : availableCameras.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">No cameras found in Home Assistant</p>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {availableCameras.map((camera) => (
                  <button
                    key={camera.entityId}
                    onClick={() => {
                      if (!camera.isEnabled) {
                        handleAddCamera(camera.entityId, camera.name);
                      }
                    }}
                    disabled={camera.isEnabled}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-colors ${
                      camera.isEnabled
                        ? "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 opacity-50 cursor-not-allowed"
                        : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Video className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{camera.name}</p>
                        <p className="text-xs text-gray-500">{camera.entityId}</p>
                      </div>
                    </div>
                    {camera.isEnabled ? (
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium">Added</span>
                    ) : (
                      <Plus className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={() => setShowCameraPicker(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Rooms Management Card */}
      {isConnected && (
        <Card className="border-2 border-primary/40">
          <CardHeader>
            <div>
              <CardTitle>Rooms</CardTitle>
              <CardDescription>
                Organize your devices into rooms for easier navigation
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Create Room */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Add New Room
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="Room name..."
                  className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:border-primary focus:outline-none"
                  onKeyDown={(e) => e.key === "Enter" && handleCreateRoom()}
                />
                <Button
                  onClick={handleCreateRoom}
                  disabled={!newRoomName.trim() || createRoom.isPending}
                >
                  {createRoom.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                  Add
                </Button>
              </div>
            </div>

            {/* Room List */}
            <div className="space-y-3">
              {rooms.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-6 text-center bg-gray-50 dark:bg-gray-800/50">
                  <Home className="mx-auto h-8 w-8 text-gray-400 dark:text-gray-500" />
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    No rooms created yet. Add a room above to organize your devices.
                  </p>
                </div>
              ) : (
                rooms.map((room) => {
                  const roomEntities = getEntitiesForRoom(room.id);
                  const isExpanded = expandedRoomId === room.id;

                  return (
                    <div
                      key={room.id}
                      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
                    >
                      {/* Room Header */}
                      <div className="flex items-center gap-3 p-4">
                        {editingRoom?.id === room.id ? (
                          <input
                            type="text"
                            value={editingRoom.name}
                            onChange={(e) => setEditingRoom({ ...editingRoom, name: e.target.value })}
                            onBlur={async () => {
                              if (editingRoom.name.trim() && editingRoom.name !== room.name) {
                                await updateRoom.mutateAsync({ id: room.id, data: { name: editingRoom.name.trim() } });
                              }
                              setEditingRoom(null);
                            }}
                            onKeyDown={async (e) => {
                              if (e.key === "Enter") {
                                if (editingRoom.name.trim() && editingRoom.name !== room.name) {
                                  await updateRoom.mutateAsync({ id: room.id, data: { name: editingRoom.name.trim() } });
                                }
                                setEditingRoom(null);
                              } else if (e.key === "Escape") {
                                setEditingRoom(null);
                              }
                            }}
                            autoFocus
                            className="flex-1 border-b border-primary bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none"
                          />
                        ) : (
                          <button
                            onClick={() => setEditingRoom(room)}
                            className="flex-1 text-left font-medium text-gray-900 dark:text-gray-100 hover:text-primary transition-colors"
                          >
                            {room.name}
                          </button>
                        )}

                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {roomEntities.length} device{roomEntities.length !== 1 ? "s" : ""}
                        </span>

                        <button
                          onClick={() => setExpandedRoomId(isExpanded ? null : room.id)}
                          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          )}
                        </button>

                        <button
                          onClick={() => handleDeleteRoom(room.id)}
                          className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </button>
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-4 bg-gray-50 dark:bg-gray-900/50">
                          {/* Sensor Configuration */}
                          <div className="space-y-3">
                            <h4 className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium">
                              Room Sensors (shown in header)
                            </h4>

                            {/* Temperature Sensor */}
                            <div className="flex items-center gap-3">
                              <label className="text-sm text-gray-600 dark:text-gray-400 w-24">Temperature</label>
                              <select
                                value={room.temperatureSensorId || ""}
                                onChange={(e) => updateRoom.mutate({ id: room.id, data: { temperatureSensorId: e.target.value || null } })}
                                className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
                              >
                                <option value="">None</option>
                                {temperatureSensors.map((s) => {
                                  const name = s.attributes.friendly_name as string || s.entity_id;
                                  const unit = s.attributes.unit_of_measurement as string || "";
                                  const shortId = s.entity_id.replace("sensor.", "");
                                  return (
                                    <option key={s.entity_id} value={s.entity_id}>
                                      {name} — {s.state}{unit} [{shortId}]
                                    </option>
                                  );
                                })}
                              </select>
                            </div>

                            {/* Humidity Sensor */}
                            <div className="flex items-center gap-3">
                              <label className="text-sm text-gray-600 dark:text-gray-400 w-24">Humidity</label>
                              <select
                                value={room.humiditySensorId || ""}
                                onChange={(e) => updateRoom.mutate({ id: room.id, data: { humiditySensorId: e.target.value || null } })}
                                className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
                              >
                                <option value="">None</option>
                                {humiditySensors.map((s) => {
                                  const name = s.attributes.friendly_name as string || s.entity_id;
                                  const unit = s.attributes.unit_of_measurement as string || "";
                                  const shortId = s.entity_id.replace("sensor.", "");
                                  return (
                                    <option key={s.entity_id} value={s.entity_id}>
                                      {name} — {s.state}{unit} [{shortId}]
                                    </option>
                                  );
                                })}
                              </select>
                            </div>

                            {/* Window Sensor */}
                            <div className="flex items-center gap-3">
                              <label className="text-sm text-gray-600 dark:text-gray-400 w-24">Window</label>
                              <select
                                value={room.windowSensorId || ""}
                                onChange={(e) => updateRoom.mutate({ id: room.id, data: { windowSensorId: e.target.value || null } })}
                                className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
                              >
                                <option value="">None</option>
                                {binarySensors.map((s) => {
                                  const name = s.attributes.friendly_name as string || s.entity_id;
                                  const stateText = s.state === "on" ? "Open" : s.state === "off" ? "Closed" : s.state;
                                  const shortId = s.entity_id.replace("binary_sensor.", "");
                                  return (
                                    <option key={s.entity_id} value={s.entity_id}>
                                      {name} — {stateText} [{shortId}]
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          </div>

                          {/* Entities in Room */}
                          {roomEntities.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium">
                                Devices in this room
                              </h4>
                              {roomEntities.map((entity) => (
                                <div
                                  key={entity.id}
                                  className="flex items-center justify-between py-2 px-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                                >
                                  <span className="text-sm text-gray-900 dark:text-gray-100">
                                    {entity.displayName || getEntityName(entity.entityId)}
                                  </span>
                                  <button
                                    onClick={() => assignEntityToRoom.mutate({ entityId: entity.id, roomId: null })}
                                    className="text-xs text-gray-500 hover:text-destructive transition-colors"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add Entities to Room */}
                          <div className="space-y-2">
                            <h4 className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium">
                              Add devices to room
                            </h4>
                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  assignEntityToRoom.mutate({ entityId: e.target.value, roomId: room.id });
                                }
                              }}
                              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
                            >
                              <option value="">Select a device to add...</option>
                              {entities
                                .filter((e) => e.roomId !== room.id && !e.entityId.startsWith("camera."))
                                .map((entity) => (
                                  <option key={entity.id} value={entity.id}>
                                    {entity.displayName || getEntityName(entity.entityId)}
                                  </option>
                                ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entity Picker Modal */}
      <EntityPicker
        isOpen={showEntityPicker}
        onClose={() => setShowEntityPicker(false)}
        allStates={allStates}
        selectedEntityIds={selectedEntityIds}
        onAddEntity={handleAddEntity}
        isLoading={isLoadingStates}
      />
    </>
  );
}

// API Keys Settings
function ApiKeysSettings() {
  const queryClient = useQueryClient();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch server config to get the frontend URL
  const { data: serverConfig } = useQuery({
    queryKey: ["server-config"],
    queryFn: () => api.getServerConfig(),
    staleTime: Infinity, // Config doesn't change often
  });

  // Use configured frontend URL, fallback to current origin
  const frontendUrl = serverConfig?.frontendUrl || window.location.origin;

  const { data: apiKeys = [], isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => api.getApiKeys(),
  });

  const createKeyMutation = useMutation({
    mutationFn: (name: string) => api.createApiKey(name),
    onSuccess: (data) => {
      setCreatedKey(data.key);
      setNewKeyName("");
      setShowCreateForm(false);
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });

  const deleteKeyMutation = useMutation({
    mutationFn: (id: string) => api.deleteApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
  };

  const handleCopyKey = async () => {
    if (createdKey) {
      await copyToClipboard(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyKioskUrl = async () => {
    if (createdKey) {
      const kioskUrl = `${frontendUrl}?apiKey=${createdKey}`;
      await copyToClipboard(kioskUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-lg border-2 border-primary bg-primary/5 dark:bg-primary/10">
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-primary/10 dark:hover:bg-primary/20 rounded-t-lg"
      >
        <div className="flex items-center gap-3">
          <span className="text-primary">
            <Key className="h-5 w-5" />
          </span>
          <div>
            <h4 className="font-medium text-lg text-primary dark:text-primary">API Keys</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">Manage API keys for kiosk devices, automation tools</p>
          </div>
        </div>
        {isCollapsed ? (
          <ChevronDown className="h-5 w-5 text-gray-500" />
        ) : (
          <ChevronUp className="h-5 w-5 text-gray-500" />
        )}
      </button>

      {!isCollapsed && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-4">
        {/* Newly created key display */}
        {createdKey && (
          <div className="rounded-lg border-2 border-green-600 bg-green-100 dark:bg-green-950 p-4 space-y-3">
            <div className="flex items-center gap-2 text-green-800 dark:text-green-300">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">API Key Created Successfully</span>
            </div>
            <p className="text-sm text-green-700 dark:text-green-400 font-medium">
              Copy this key now - it won't be shown again!
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-white dark:bg-gray-900 px-3 py-2 text-sm font-mono border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 overflow-x-auto">
                {createdKey}
              </code>
              <Button size="sm" variant="outline" className="border-green-600 text-green-700 hover:bg-green-200 dark:text-green-300 dark:hover:bg-green-900" onClick={handleCopyKey}>
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
            <div className="pt-2 border-t border-green-400 dark:border-green-700">
              <p className="text-sm text-green-700 dark:text-green-400 mb-2 font-medium">
                For kiosk devices, use this URL to auto-authenticate:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-white dark:bg-gray-900 px-3 py-2 text-xs font-mono border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 overflow-x-auto">
                  {frontendUrl}?apiKey={createdKey}
                </code>
                <Button size="sm" variant="outline" className="border-green-600 text-green-700 hover:bg-green-200 dark:text-green-300 dark:hover:bg-green-900" onClick={handleCopyKioskUrl}>
                  Copy URL
                </Button>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2 border-green-600 text-green-700 hover:bg-green-200 dark:text-green-300 dark:hover:bg-green-900"
              onClick={() => setCreatedKey(null)}
            >
              Done
            </Button>
          </div>
        )}

        {/* Create form */}
        {showCreateForm && !createdKey && (
          <div className="rounded-lg border p-4 space-y-3">
            <label className="text-sm font-medium">Key Name</label>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="e.g., Living Room Kiosk"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => createKeyMutation.mutate(newKeyName)}
                disabled={!newKeyName.trim() || createKeyMutation.isPending}
              >
                {createKeyMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Create
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewKeyName("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Existing keys list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
          </div>
        ) : apiKeys.length === 0 && !createdKey ? (
          <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-6 text-center">
            <Key className="mx-auto h-8 w-8 text-gray-400 dark:text-gray-500" />
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              No API keys created yet
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
              Create an API key to authenticate kiosk devices without OAuth login
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {apiKeys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <span className="font-medium text-gray-900 dark:text-gray-100">{key.name}</span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    <code className="text-gray-600 dark:text-gray-300">{key.keyPrefix}...</code>
                    {key.lastUsedAt && (
                      <span className="ml-2">
                        Last used: {new Date(key.lastUsedAt).toLocaleDateString()}
                      </span>
                    )}
                    {key.expiresAt && (
                      <span className="ml-2">
                        Expires: {new Date(key.expiresAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-900/30"
                  onClick={() => {
                    if (confirm("Delete this API key? Any devices using it will lose access.")) {
                      deleteKeyMutation.mutate(key.id);
                    }
                  }}
                  disabled={deleteKeyMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

          {/* Help text */}
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4 text-sm space-y-2">
            <p className="font-medium text-blue-800 dark:text-blue-300">How to use API keys:</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-700 dark:text-blue-400">
              <li>Create an API key with a descriptive name (e.g., "Kitchen Kiosk")</li>
              <li>Copy the kiosk URL shown after creation</li>
              <li>Open that URL on your kiosk device - it will auto-authenticate</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

// Common emojis for account icons
const ACCOUNT_ICON_OPTIONS = [
  "👨", "👩", "👦", "👧", "👴", "👵", "🧑", "👶",
  "🎵", "🎸", "🎹", "🎤", "🎧", "🎺", "🎷", "🥁",
  "❤️", "⭐", "🌟", "🔥", "💜", "💙", "💚", "🧡",
];

function NewsSettings() {
  const queryClient = useQueryClient();
  const [customFeedUrl, setCustomFeedUrl] = useState("");
  const [customFeedName, setCustomFeedName] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Fetch preset feeds
  const { data: presets = [] } = useQuery({
    queryKey: ["news-presets"],
    queryFn: () => api.getNewsPresets(),
  });

  // Fetch user's feeds
  const { data: feeds = [], isLoading } = useQuery({
    queryKey: ["news-feeds"],
    queryFn: () => api.getNewsFeeds(),
  });

  // Add feed mutation
  const addFeedMutation = useMutation({
    mutationFn: (data: { name: string; feedUrl: string; category?: string }) =>
      api.addNewsFeed(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news-feeds"] });
      setCustomFeedUrl("");
      setCustomFeedName("");
      setValidationError(null);
    },
  });

  // Update feed mutation
  const updateFeedMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ name: string; isActive: boolean }> }) =>
      api.updateNewsFeed(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news-feeds"] });
    },
  });

  // Delete feed mutation
  const deleteFeedMutation = useMutation({
    mutationFn: (id: string) => api.deleteNewsFeed(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news-feeds"] });
    },
  });

  // Refresh feeds mutation
  const refreshMutation = useMutation({
    mutationFn: () => api.refreshNewsFeeds(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news-feeds"] });
      queryClient.invalidateQueries({ queryKey: ["news-headlines"] });
    },
  });

  // Check if a preset is already added
  const isPresetAdded = (url: string) => feeds.some((f) => f.feedUrl === url);

  // Handle adding a custom feed
  const handleAddCustomFeed = async () => {
    if (!customFeedUrl) return;

    setIsValidating(true);
    setValidationError(null);

    try {
      const result = await api.validateNewsFeedUrl(customFeedUrl);
      if (!result.valid) {
        setValidationError(result.error || "Invalid feed URL");
        setIsValidating(false);
        return;
      }

      await addFeedMutation.mutateAsync({
        name: customFeedName || result.title || "Custom Feed",
        feedUrl: customFeedUrl,
        category: "custom",
      });
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "Failed to add feed");
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* Preset Feeds */}
      <Card className="border-2 border-primary/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rss className="h-5 w-5" />
            NYTimes Feeds
          </CardTitle>
          <CardDescription>
            Quick add popular news feeds
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {presets.map((preset) => {
            const isAdded = isPresetAdded(preset.url);
            return (
              <div
                key={preset.url}
                className="flex items-center justify-between p-3 rounded-lg border border-border"
              >
                <div className="flex items-center gap-3">
                  <Newspaper className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{preset.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{preset.category}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={isAdded ? "outline" : "default"}
                  disabled={isAdded || addFeedMutation.isPending}
                  onClick={() => addFeedMutation.mutate({
                    name: preset.name,
                    feedUrl: preset.url,
                    category: preset.category,
                  })}
                >
                  {isAdded ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Added
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Your Feeds */}
      <Card className="border-2 border-primary/40">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your Feeds</CardTitle>
              <CardDescription>
                Manage your subscribed feeds
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : feeds.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Newspaper className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No feeds subscribed</p>
              <p className="text-sm mt-1">Add feeds from the presets or add a custom feed below</p>
            </div>
          ) : (
            <div className="space-y-2">
              {feeds.map((feed) => (
                <div
                  key={feed.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => updateFeedMutation.mutate({
                        id: feed.id,
                        data: { isActive: !feed.isActive },
                      })}
                      className="flex-shrink-0"
                    >
                      {feed.isActive ? (
                        <Eye className="h-5 w-5 text-primary" />
                      ) : (
                        <EyeOff className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`font-medium text-sm truncate ${!feed.isActive ? "text-muted-foreground" : ""}`}>
                        {feed.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {feed.articleCount ?? 0} articles
                        {feed.lastFetchedAt && ` · Updated ${new Date(feed.lastFetchedAt).toLocaleTimeString()}`}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteFeedMutation.mutate(feed.id)}
                    disabled={deleteFeedMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom Feed */}
      <Card className="lg:col-span-2 border-2 border-primary/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Add Custom Feed
          </CardTitle>
          <CardDescription>
            Add any RSS or Atom feed URL
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Feed name (optional)"
              value={customFeedName}
              onChange={(e) => setCustomFeedName(e.target.value)}
              className="flex-shrink-0 sm:w-48 px-3 py-2 rounded-md border border-input bg-background text-sm"
            />
            <input
              type="url"
              placeholder="https://example.com/rss.xml"
              value={customFeedUrl}
              onChange={(e) => {
                setCustomFeedUrl(e.target.value);
                setValidationError(null);
              }}
              className="flex-1 px-3 py-2 rounded-md border border-input bg-background text-sm"
            />
            <Button
              onClick={handleAddCustomFeed}
              disabled={!customFeedUrl || isValidating || addFeedMutation.isPending}
            >
              {isValidating ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              Add Feed
            </Button>
          </div>
          {validationError && (
            <p className="mt-2 text-sm text-destructive">{validationError}</p>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="lg:col-span-2 border-2 border-primary/40">
        <CardContent className="pt-6">
          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 p-4">
            <h4 className="font-medium text-blue-900 dark:text-blue-100">How News Feeds Work</h4>
            <ul className="mt-2 space-y-1 text-sm text-blue-800 dark:text-blue-200">
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
                Headlines from your feeds appear on the Dashboard
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
                Feeds are automatically refreshed every 30 minutes
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
                Click a headline to open the full article in a new tab
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
                Toggle the eye icon to show/hide a feed from your headlines
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SportsSettings() {
  const queryClient = useQueryClient();

  // Fetch user's favorite teams
  const { data: favoriteTeams = [], isLoading } = useQuery({
    queryKey: ["favorite-teams"],
    queryFn: () => api.getFavoriteTeams(),
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* Add Teams Card */}
      <Card className="border-2 border-primary/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Add Teams
          </CardTitle>
          <CardDescription>
            Click a team to add it to your favorites
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TeamSelector onTeamAdded={() => queryClient.invalidateQueries({ queryKey: ["favorite-teams"] })} />
        </CardContent>
      </Card>

      {/* Your Teams Card */}
      <Card className="border-2 border-primary/40">
        <CardHeader>
          <CardTitle>Your Teams</CardTitle>
          <CardDescription>
            Hover and click X to remove a team
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : favoriteTeams.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No favorite teams yet</p>
              <p className="text-sm mt-1">Click teams on the left to add them</p>
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-2">
              <AnimatePresence mode="popLayout">
                {favoriteTeams.map((team, index) => (
                  <FavoriteTeamCard key={team.id} team={team} index={index} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="lg:col-span-2 border-2 border-primary/40">
        <CardContent className="pt-6">
          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 p-4">
            <h4 className="font-medium text-blue-900 dark:text-blue-100">How Sports Tracking Works</h4>
            <ul className="mt-2 space-y-1 text-sm text-blue-800 dark:text-blue-200">
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
                Live scores for your teams appear in the calendar header during games
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
                Scores update every 30 seconds during live games
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
                Live scores also appear in the screensaver clock widget
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SpotifySettings() {
  const queryClient = useQueryClient();
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingIconAccountId, setEditingIconAccountId] = useState<string | null>(null);
  const [expandedDeviceAccountId, setExpandedDeviceAccountId] = useState<string | null>(null);

  const { data: status, isLoading } = useQuery({
    queryKey: ["spotify-status"],
    queryFn: () => api.getSpotifyStatus(),
  });

  const accounts = status?.accounts || [];

  // Fetch devices for expanded account
  const { data: devices, isLoading: devicesLoading } = useQuery({
    queryKey: ["spotify-devices", expandedDeviceAccountId],
    queryFn: () => expandedDeviceAccountId ? api.getSpotifyDevices(expandedDeviceAccountId) : Promise.resolve([]),
    enabled: !!expandedDeviceAccountId,
  });

  const disconnectMutation = useMutation({
    mutationFn: (accountId?: string) => api.disconnectSpotify(accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spotify-status"] });
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: ({ accountId, data }: { accountId: string; data: { accountName?: string; isPrimary?: boolean; icon?: string | null; defaultDeviceId?: string | null; favoriteDeviceIds?: string[] | null } }) =>
      api.updateSpotifyAccount(accountId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spotify-status"] });
      setEditingAccountId(null);
      setEditingIconAccountId(null);
    },
  });

  const handleDisconnect = (accountId: string, accountName: string) => {
    if (confirm(`Disconnect "${accountName}" from Spotify?`)) {
      disconnectMutation.mutate(accountId);
    }
  };

  const handleStartEdit = (accountId: string, currentName: string) => {
    setEditingAccountId(accountId);
    setEditingName(currentName);
  };

  const handleSaveName = (accountId: string) => {
    updateAccountMutation.mutate({
      accountId,
      data: { accountName: editingName },
    });
  };

  const handleSetPrimary = (accountId: string) => {
    updateAccountMutation.mutate({
      accountId,
      data: { isPrimary: true },
    });
  };

  const handleSetIcon = (accountId: string, icon: string | null) => {
    updateAccountMutation.mutate({
      accountId,
      data: { icon },
    });
  };

  const handleSetDefaultDevice = (accountId: string, deviceId: string | null) => {
    updateAccountMutation.mutate({
      accountId,
      data: { defaultDeviceId: deviceId },
    });
  };

  const handleToggleFavoriteDevice = (accountId: string, deviceId: string, currentFavorites: string[] | null) => {
    const favorites = currentFavorites || [];
    const newFavorites = favorites.includes(deviceId)
      ? favorites.filter((id) => id !== deviceId)
      : [...favorites, deviceId];
    updateAccountMutation.mutate({
      accountId,
      data: { favoriteDeviceIds: newFavorites.length > 0 ? newFavorites : null },
    });
  };

  return (
    <Card className="border-2 border-primary/40">
      <CardHeader>
        <CardTitle>Spotify Accounts</CardTitle>
        <CardDescription>
          Connect Spotify accounts to control music playback. You can connect multiple accounts (e.g., for family members).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Connected Accounts List */}
            {accounts.length > 0 && (
              <div className="space-y-3">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className={`rounded-lg border p-4 ${
                      account.isPrimary
                        ? "border-green-500 bg-green-100 dark:border-green-600 dark:bg-green-900"
                        : "border-border"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar/Icon */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setEditingIconAccountId(
                            editingIconAccountId === account.id ? null : account.id
                          )}
                          className="group relative h-10 w-10 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                          title="Change icon"
                        >
                          {account.icon ? (
                            <div className="flex h-full w-full items-center justify-center bg-muted text-xl">
                              {account.icon}
                            </div>
                          ) : account.spotifyUser?.images?.[0]?.url ? (
                            <img
                              src={account.spotifyUser.images[0].url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-green-500">
                              <Music className="h-5 w-5 text-white" />
                            </div>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Pencil className="h-4 w-4 text-white" />
                          </div>
                        </button>
                        {/* Icon Picker Popup */}
                        {editingIconAccountId === account.id && (
                          <div className="absolute left-0 top-12 z-50 w-64 rounded-lg border border-border bg-background p-2 shadow-lg">
                            <div className="grid grid-cols-8 gap-1">
                              {ACCOUNT_ICON_OPTIONS.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => handleSetIcon(account.id, emoji)}
                                  className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted text-lg"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                            {account.icon && (
                              <button
                                type="button"
                                onClick={() => handleSetIcon(account.id, null)}
                                className="mt-2 w-full rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                              >
                                Remove custom icon
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Account Info */}
                      <div className="flex-1 min-w-0">
                        {editingAccountId === account.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleSaveName(account.id);
                                } else if (e.key === "Escape") {
                                  setEditingAccountId(null);
                                }
                              }}
                              className={`flex-1 rounded border px-2 py-1 text-sm ${
                                account.isPrimary
                                  ? "border-green-400 bg-white text-green-900 placeholder:text-green-600 dark:border-green-600 dark:bg-green-950 dark:text-green-50 dark:placeholder:text-green-400"
                                  : "border-border bg-background"
                              }`}
                              placeholder="Account name"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              onClick={() => handleSaveName(account.id)}
                              disabled={updateAccountMutation.isPending}
                              className={account.isPrimary ? "bg-green-700 hover:bg-green-800 text-white" : ""}
                            >
                              {updateAccountMutation.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Save"
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingAccountId(null)}
                              className={account.isPrimary ? "border-green-600 text-green-800 hover:bg-green-200 dark:border-green-500 dark:text-green-100 dark:hover:bg-green-800" : ""}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <p
                                className={`font-medium truncate ${
                                  account.isPrimary ? "text-green-800 dark:text-green-50" : ""
                                }`}
                              >
                                {account.accountName || account.spotifyUser?.display_name || "Spotify Account"}
                              </p>
                              {account.isPrimary && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-600 px-2 py-0.5 text-xs font-medium text-white shadow-sm">
                                  <Star className="h-3 w-3" /> Primary
                                </span>
                              )}
                            </div>
                            {account.spotifyUser?.display_name &&
                              account.accountName &&
                              account.accountName !== account.spotifyUser.display_name && (
                                <p className={`text-sm truncate ${account.isPrimary ? "text-green-700 dark:text-green-300" : "text-muted-foreground"}`}>
                                  {account.spotifyUser.display_name}
                                </p>
                              )}
                          </>
                        )}
                      </div>

                      {/* Actions */}
                      {editingAccountId !== account.id && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant={account.isPrimary ? "outline" : "ghost"}
                            size="sm"
                            onClick={() =>
                              handleStartEdit(
                                account.id,
                                account.accountName || account.spotifyUser?.display_name || ""
                              )
                            }
                            title="Rename account"
                            className={account.isPrimary ? "border-green-600 text-green-800 hover:bg-green-200 dark:border-green-500 dark:text-green-100 dark:hover:bg-green-800" : ""}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={account.isPrimary ? "outline" : "ghost"}
                            size="sm"
                            onClick={() =>
                              setExpandedDeviceAccountId(
                                expandedDeviceAccountId === account.id ? null : account.id
                              )
                            }
                            title="Device settings"
                            className={account.isPrimary ? "border-green-600 text-green-800 hover:bg-green-200 dark:border-green-500 dark:text-green-100 dark:hover:bg-green-800" : ""}
                          >
                            {expandedDeviceAccountId === account.id ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <Speaker className="h-4 w-4" />
                            )}
                          </Button>
                          {!account.isPrimary && accounts.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSetPrimary(account.id)}
                              disabled={updateAccountMutation.isPending}
                              title="Set as primary"
                            >
                              <Star className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant={account.isPrimary ? "outline" : "ghost"}
                            size="sm"
                            onClick={() =>
                              handleDisconnect(
                                account.id,
                                account.accountName || account.spotifyUser?.display_name || "this account"
                              )
                            }
                            disabled={disconnectMutation.isPending}
                            title="Disconnect account"
                            className={account.isPrimary ? "border-red-400 text-red-700 hover:bg-red-100 dark:border-red-500 dark:text-red-300 dark:hover:bg-red-900" : ""}
                          >
                            {disconnectMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Device Settings Panel */}
                    {expandedDeviceAccountId === account.id && (
                      <div className={`mt-3 border-t pt-3 ${account.isPrimary ? "border-green-300 dark:border-green-700" : "border-border"}`}>
                        <h5 className={`text-sm font-medium mb-2 flex items-center gap-2 ${account.isPrimary ? "text-green-800 dark:text-green-100" : ""}`}>
                          <Speaker className="h-4 w-4" />
                          Device Preferences
                        </h5>
                        {devicesLoading ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : devices && devices.length > 0 ? (
                          <div className="space-y-2">
                            {/* Sort devices: favorites first, then others */}
                            {[...devices]
                              .sort((a, b) => {
                                const aIsFav = account.favoriteDeviceIds?.includes(a.id) || false;
                                const bIsFav = account.favoriteDeviceIds?.includes(b.id) || false;
                                if (aIsFav && !bIsFav) return -1;
                                if (!aIsFav && bIsFav) return 1;
                                return a.name.localeCompare(b.name);
                              })
                              .map((device) => {
                                const isDefault = account.defaultDeviceId === device.id;
                                const isFavorite = account.favoriteDeviceIds?.includes(device.id) || false;
                                // Determine background and text colors based on state and whether parent is primary
                                const bgClass = isDefault
                                  ? "border-blue-400 bg-blue-50 dark:border-blue-600 dark:bg-blue-900"
                                  : isFavorite
                                  ? "border-yellow-400 bg-yellow-50 dark:border-yellow-600 dark:bg-yellow-900"
                                  : account.isPrimary
                                  ? "border-green-400 bg-white dark:border-green-600 dark:bg-green-950"
                                  : "border-border bg-background";
                                const textClass = account.isPrimary && !isDefault && !isFavorite
                                  ? "text-green-900 dark:text-green-50"
                                  : isDefault
                                  ? "text-blue-900 dark:text-blue-50"
                                  : isFavorite
                                  ? "text-yellow-900 dark:text-yellow-50"
                                  : "";
                                const iconClass = account.isPrimary && !isDefault && !isFavorite
                                  ? "text-green-700 dark:text-green-300"
                                  : isDefault
                                  ? "text-blue-600 dark:text-blue-300"
                                  : isFavorite
                                  ? "text-yellow-600 dark:text-yellow-300"
                                  : "text-muted-foreground";
                                return (
                                  <div
                                    key={device.id}
                                    className={`flex items-center justify-between p-2 rounded-lg border ${bgClass}`}
                                  >
                                    <div className="flex items-center gap-2">
                                      {device.type === "Smartphone" ? (
                                        <Smartphone className={`h-4 w-4 ${iconClass}`} />
                                      ) : device.type === "Computer" ? (
                                        <Monitor className={`h-4 w-4 ${iconClass}`} />
                                      ) : device.type === "TV" ? (
                                        <Tv className={`h-4 w-4 ${iconClass}`} />
                                      ) : (
                                        <Speaker className={`h-4 w-4 ${iconClass}`} />
                                      )}
                                      <span className={`text-sm ${textClass}`}>{device.name}</span>
                                      {isDefault && (
                                        <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded shadow-sm">
                                          Default
                                        </span>
                                      )}
                                      {isFavorite && !isDefault && (
                                        <span className="text-xs bg-yellow-600 text-white px-1.5 py-0.5 rounded shadow-sm">
                                          Favorite
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          handleToggleFavoriteDevice(
                                            account.id,
                                            device.id,
                                            account.favoriteDeviceIds
                                          )
                                        }
                                        title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                                        className={
                                          isFavorite
                                            ? "border-yellow-500 text-yellow-600 hover:bg-yellow-100 dark:hover:bg-yellow-900"
                                            : "border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                                        }
                                      >
                                        <Star className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          handleSetDefaultDevice(
                                            account.id,
                                            isDefault ? null : device.id
                                          )
                                        }
                                        title={isDefault ? "Remove as default" : "Set as default"}
                                        disabled={updateAccountMutation.isPending}
                                        className={
                                          isDefault
                                            ? "border-blue-500 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900"
                                            : "border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                                        }
                                      >
                                        <CheckCircle className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            <p className={`text-xs mt-2 ${account.isPrimary ? "text-green-700 dark:text-green-300" : "text-muted-foreground"}`}>
                              Favorite devices appear at the top of device lists. The default device is automatically selected when starting playback.
                            </p>
                          </div>
                        ) : (
                          <p className={`text-sm py-2 ${account.isPrimary ? "text-green-700 dark:text-green-300" : "text-muted-foreground"}`}>
                            No devices found. Make sure Spotify is open on a device.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add Account Button */}
            <a
              href={api.getSpotifyAuthUrl()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-2 font-medium text-white hover:bg-green-600 transition-colors"
            >
              <Plus className="h-5 w-5" />
              {accounts.length > 0 ? "Add Another Spotify Account" : "Connect Spotify"}
            </a>

            {accounts.length === 0 && (
              <div className="rounded-lg border border-border p-4">
                <h4 className="font-medium">Requirements</h4>
                <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                    Spotify Premium account required for playback control
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                    Active Spotify device needed (phone, computer, or speaker)
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                    Configure Spotify Client ID and Client Secret in the System tab under Spotify settings
                  </li>
                </ul>
              </div>
            )}

            {accounts.length > 0 && (
              <p className="text-sm text-muted-foreground">
                You can control Spotify playback from the Spotify page in the sidebar. Use the account dropdown to switch between accounts.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CloudSettings() {
  const queryClient = useQueryClient();
  const { data: cloudStatus, isLoading } = useQuery({
    queryKey: ["cloud-status"],
    queryFn: () => api.getCloudStatus(),
    refetchInterval: 10000,
  });

  const connectMutation = useMutation({
    mutationFn: (cloudUrl: string) => api.cloudConnect(cloudUrl),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cloud-status"] }),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => api.cloudDisconnect(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cloud-status"] }),
  });

  const syncMutation = useMutation({
    mutationFn: () => api.cloudSync(),
  });

  const [cloudUrl, setCloudUrl] = useState("https://openframe.us");
  const status = cloudStatus;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-primary" />
            OpenFrame Cloud
          </CardTitle>
          <CardDescription>
            Connect to OpenFrame Cloud for remote management of your kiosks from anywhere.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading status...
            </div>
          ) : status?.enabled ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {status.connected ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                <span className="font-medium">
                  {status.connected ? "Connected" : "Disconnected"}
                </span>
                <span className="text-sm text-muted-foreground">
                  ({status.state})
                </span>
              </div>
              {status.instanceId && (
                <p className="text-sm text-muted-foreground">
                  Instance ID: <code className="bg-muted px-1 py-0.5 rounded text-xs">{status.instanceId}</code>
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => syncMutation.mutate()}
                  disabled={!status.connected || syncMutation.isPending}
                >
                  {syncMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1" />
                  )}
                  Sync Kiosks
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                >
                  {disconnectMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Unlink className="h-4 w-4 mr-1" />
                  )}
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Not connected. Enter your cloud server URL to begin the connection process.
              </p>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={cloudUrl}
                  onChange={(e) => setCloudUrl(e.target.value)}
                  placeholder="https://openframe.us"
                  className="flex-1 px-3 py-2 text-sm rounded-md border bg-background"
                />
                <Button
                  size="sm"
                  onClick={() => connectMutation.mutate(cloudUrl)}
                  disabled={connectMutation.isPending || !cloudUrl}
                >
                  {connectMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Link2 className="h-4 w-4 mr-1" />
                  )}
                  Connect
                </Button>
              </div>
              {connectMutation.isSuccess && connectMutation.data && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
                  <p className="text-sm font-medium text-primary">Claim code generated!</p>
                  <div className="flex items-center justify-center gap-2">
                    <p className="text-2xl font-mono font-bold tracking-widest text-primary">
                      {connectMutation.data.code}
                    </p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(connectMutation.data.code);
                      }}
                      className="p-1.5 rounded-md hover:bg-primary/10 text-primary transition-colors"
                      title="Copy claim code"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Open the link below and sign in to claim this instance:
                  </p>
                  <a
                    href={connectMutation.data.claimUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1 justify-center"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open Cloud Dashboard
                  </a>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ============ Cloud-Only Components ============

function BillingSettings() {
  const { data: billing, isLoading } = useQuery({
    queryKey: ["cloud-billing"],
    queryFn: () => api.getCloudBillingInfo(),
    enabled: isCloudMode,
  });

  const { data: planLimits } = useQuery({
    queryKey: ["plan-limits"],
    queryFn: () => api.getUserPlanLimits(),
    enabled: isCloudMode,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-primary">Current Plan</CardTitle>
          <CardDescription>
            Manage your subscription and billing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border border-primary/30 bg-primary/5">
            <div>
              <p className="font-semibold text-primary text-lg">
                {billing?.plan?.name || "Free"}
              </p>
              <p className="text-sm text-muted-foreground">
                {billing?.plan?.status === "active" ? "Active" : billing?.plan?.status || "Active"}
              </p>
            </div>
            <a
              href={billing?.stripePortalUrl || "/billing"}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium"
            >
              <CreditCard className="h-4 w-4" />
              Manage Billing
            </a>
          </div>
        </CardContent>
      </Card>

      {planLimits && (
        <Card>
          <CardHeader>
            <CardTitle className="text-primary">Usage</CardTitle>
            <CardDescription>Current resource usage on your plan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <UsageBar
              label="Kiosks"
              current={billing?.usage?.kiosks?.current ?? 0}
              limit={planLimits.maxKiosks}
            />
            <UsageBar
              label="Calendars"
              current={billing?.usage?.calendars?.current ?? 0}
              limit={planLimits.maxCalendars}
            />
            <UsageBar
              label="Cameras"
              current={billing?.usage?.cameras?.current ?? 0}
              limit={planLimits.maxCameras}
            />
            <div className="pt-2 border-t border-border">
              <p className="text-sm font-medium text-primary mb-2">Features</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(planLimits.features).map(([feature, enabled]) => (
                  <div key={feature} className="flex items-center gap-2 text-sm">
                    {enabled ? (
                      <CheckCircle className="h-4 w-4 text-accent-foreground" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className={enabled ? "text-foreground" : "text-muted-foreground"}>
                      {feature.charAt(0).toUpperCase() + feature.slice(1).replace(/([A-Z])/g, " $1")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function UsageBar({ label, current, limit }: { label: string; current: number; limit: number }) {
  const percentage = limit > 0 ? Math.min((current / limit) * 100, 100) : 0;
  const isNearLimit = percentage >= 80;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-foreground">{label}</span>
        <span className={cn("text-sm font-medium", isNearLimit ? "text-destructive" : "text-muted-foreground")}>
          {current} / {limit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            isNearLimit ? "bg-destructive" : "bg-primary"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function InstancesSettings() {
  const { data: instances = [], isLoading } = useQuery({
    queryKey: ["cloud-instances"],
    queryFn: () => api.getCloudInstances(),
    enabled: isCloudMode,
    refetchInterval: 30000, // Refresh every 30s for online status
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-primary">Your Instances</CardTitle>
          <CardDescription>
            Manage your hosted and linked self-hosted instances
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {instances.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No instances found.
            </p>
          ) : (
            instances.map((instance) => (
              <div
                key={instance.id}
                className="flex items-center justify-between p-3 rounded-lg border border-primary/30 bg-card hover:bg-primary/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-2.5 h-2.5 rounded-full",
                    instance.isOnline ? "bg-accent" : "bg-muted-foreground"
                  )} />
                  <div>
                    <p className="font-medium text-foreground">{instance.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className={cn(
                        "px-1.5 py-0.5 rounded",
                        instance.instanceType === "hosted" ? "bg-primary/10 text-primary" : "bg-muted"
                      )}>
                        {instance.instanceType === "hosted" ? "Cloud Hosted" : "Self-Hosted"}
                      </span>
                      <span>{instance.kioskCount} kiosk{instance.kioskCount !== 1 ? "s" : ""}</span>
                      {instance.version && <span>v{instance.version}</span>}
                    </div>
                  </div>
                </div>
                <a
                  href={`/dashboard/instances/${instance.id}`}
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  Manage <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-primary">Link Self-Hosted Instance</CardTitle>
          <CardDescription>
            Connect a self-hosted OpenFrame instance to manage it from the cloud
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            In your self-hosted instance, go to Settings &gt; Cloud and click
            &quot;Connect to Cloud&quot; to generate a claim code.
          </p>
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium"
          >
            <Link2 className="h-4 w-4" />
            Go to Dashboard
          </a>
        </CardContent>
      </Card>
    </div>
  );
}

// Lucide icon mapping for module cards
const MODULE_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  CloudSun: Cloud,
  Image: ImageIcon,
  Camera: CameraIcon,
  Home: Home,
  Zap: Zap,
  MapPin: MapPin,
  Cast: Speaker,
  Music: Music,
  Tv: Tv,
  Youtube: Play,
  Play: Play,
  BookOpen: BookOpen,
  Trophy: Trophy,
  Newspaper: Newspaper,
  ListChecks: ListTodo,
  ChefHat: ChefHat,
  PenTool: PenTool,
  FileText: HardDrive,
  MessageCircle: MessageCircle,
  Sparkles: Sparkles,
  Mail: Globe,
  Send: MessageCircle,
  Smartphone: Smartphone,
};

function ModulesTab({
  isModuleEnabled,
  moduleList,
  modulesLoading,
  onInstall,
  onUninstall,
}: {
  isModuleEnabled: (id: string) => boolean;
  moduleList: import("../services/api").ModuleInfo[];
  modulesLoading: boolean;
  onInstall: (id: string) => Promise<void>;
  onUninstall: (id: string) => Promise<void>;
}) {
  const [toggling, setToggling] = useState<string | null>(null);

  const handleToggle = async (moduleId: string, currentlyEnabled: boolean) => {
    setToggling(moduleId);
    try {
      if (currentlyEnabled) {
        await onUninstall(moduleId);
      } else {
        await onInstall(moduleId);
      }
    } catch (error: any) {
      console.error("Module toggle failed:", error);
    } finally {
      setToggling(null);
    }
  };

  // Group modules by category using the canonical order
  const modulesByCategory = useMemo(() => {
    const map = new Map<string, typeof moduleList>();
    for (const cat of MODULE_CATEGORIES) {
      const mods = moduleList.filter((m) => m.category === cat.id);
      if (mods.length > 0) map.set(cat.id, mods);
    }
    return map;
  }, [moduleList]);

  const enabledCount = moduleList.filter((m) => isModuleEnabled(m.id)).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Modules</h2>
          <p className="text-sm text-muted-foreground">
            {enabledCount} of {moduleList.length} modules enabled
          </p>
        </div>
        {modulesLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {MODULE_CATEGORIES.map((category) => {
        const mods = modulesByCategory.get(category.id);
        if (!mods) return null;
        return (
          <section key={category.id}>
            <h3 className="text-sm font-medium text-primary mb-3">{category.label}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {mods.map((mod) => {
                const enabled = isModuleEnabled(mod.id);
                const isToggling = toggling === mod.id;
                const IconComponent = MODULE_ICON_MAP[mod.icon] || Puzzle;
                const depsNotMet = mod.dependsOn.length > 0 && mod.dependsOn.some((dep) => !isModuleEnabled(dep));
                const depNames = mod.dependsOn
                  .filter((dep) => !isModuleEnabled(dep))
                  .map((dep) => MODULE_REGISTRY[dep as ModuleId]?.name ?? dep);

                return (
                  <div
                    key={mod.id}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border-2 transition-colors",
                      enabled
                        ? "border-primary/40 bg-primary/5"
                        : "border-border bg-card"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      )}
                    >
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("text-sm font-medium truncate", enabled ? "text-primary" : "text-foreground")}>
                          {mod.name}
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={enabled}
                          disabled={isToggling || (!enabled && depsNotMet) || !mod.available}
                          onClick={() => handleToggle(mod.id, enabled)}
                          className={cn(
                            "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                            enabled ? "bg-primary" : "bg-muted",
                            (isToggling || (!enabled && depsNotMet) || !mod.available) && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <span
                            className={cn(
                              "inline-block h-3.5 w-3.5 transform rounded-full bg-background transition-transform",
                              enabled ? "translate-x-[18px]" : "translate-x-[3px]"
                            )}
                          />
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{mod.description}</p>
                      {!enabled && depsNotMet && (
                        <p className="text-xs text-destructive mt-1">
                          Requires: {depNames.join(", ")}
                        </p>
                      )}
                      {!mod.available && (
                        <p className="text-xs text-destructive mt-1">
                          <a href="https://openframe.us/billing" target="_blank" rel="noopener noreferrer" className="underline">
                            Upgrade plan
                          </a>{" "}to enable
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ============ Support Tab ============

const STATUS_BADGE_COLORS: Record<string, string> = {
  open: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  in_progress: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  waiting_on_user: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  resolved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  closed: "bg-muted text-muted-foreground border-border",
};

const CATEGORY_OPTIONS = [
  { value: "general", label: "General" },
  { value: "billing", label: "Billing" },
  { value: "bug", label: "Bug Report" },
  { value: "feature_request", label: "Feature Request" },
  { value: "account", label: "Account" },
];

function SupportTab() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<"list" | "new" | "detail">("list");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [newSubject, setNewSubject] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [newMessage, setNewMessage] = useState("");
  const [replyContent, setReplyContent] = useState("");

  const { data: tickets, isLoading: ticketsLoading } = useQuery<SupportTicketSummary[]>({
    queryKey: ["support", "my-tickets"],
    queryFn: () => api.getMyTickets(),
  });

  const { data: ticketDetail } = useQuery<MyTicketDetail>({
    queryKey: ["support", "ticket", selectedTicketId],
    queryFn: () => api.getMyTicket(selectedTicketId!),
    enabled: !!selectedTicketId && view === "detail",
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.createSupportTicket({
        subject: newSubject,
        category: newCategory,
        message: newMessage,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support", "my-tickets"] });
      setNewSubject("");
      setNewCategory("general");
      setNewMessage("");
      setView("list");
    },
  });

  const replyMutation = useMutation({
    mutationFn: () => api.postTicketMessage(selectedTicketId!, replyContent),
    onSuccess: () => {
      setReplyContent("");
      queryClient.invalidateQueries({ queryKey: ["support", "ticket", selectedTicketId] });
    },
  });

  // New ticket form
  if (view === "new") {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setView("list")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to tickets
        </button>
        <Card className="p-5">
          <h3 className="font-semibold text-primary mb-4">New Support Ticket</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1">Subject</label>
              <input
                type="text"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="Briefly describe your issue..."
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Message</label>
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Describe your issue in detail..."
                rows={5}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!newSubject.trim() || !newMessage.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Submit Ticket
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Ticket detail view
  if (view === "detail" && ticketDetail) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => {
            setView("list");
            setSelectedTicketId(null);
          }}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to tickets
        </button>

        <Card className="p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="font-semibold">{ticketDetail.subject}</h3>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full border capitalize",
                    STATUS_BADGE_COLORS[ticketDetail.status] || ""
                  )}
                >
                  {ticketDetail.status.replace(/_/g, " ")}
                </span>
                <span className="capitalize">{ticketDetail.category.replace(/_/g, " ")}</span>
                <span>&middot;</span>
                <span>{new Date(ticketDetail.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="space-y-3 mb-4">
            {ticketDetail.messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "rounded-lg px-4 py-3 text-sm",
                  msg.isAdminReply
                    ? "bg-primary/10 border border-primary/20 ml-6"
                    : "bg-accent border border-border mr-6"
                )}
              >
                <div className="flex items-center gap-2 mb-1 text-xs">
                  <span className="font-medium">
                    {msg.isAdminReply ? "Support Team" : msg.sender.name || "You"}
                  </span>
                  {msg.isAdminReply && (
                    <span className="px-1.5 py-0.5 rounded bg-primary/20 text-primary text-[10px] font-medium">
                      Admin
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {new Date(msg.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))}
          </div>

          {/* Reply */}
          {ticketDetail.status !== "closed" && (
            <div className="flex gap-3 pt-3 border-t border-border">
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Type a reply..."
                rows={2}
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && replyContent.trim()) {
                    replyMutation.mutate();
                  }
                }}
              />
              <Button
                size="sm"
                onClick={() => replyMutation.mutate()}
                disabled={!replyContent.trim() || replyMutation.isPending}
                className="self-end"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </Card>
      </div>
    );
  }

  // Ticket list (default view)
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-primary">Support Tickets</h3>
        <Button size="sm" onClick={() => setView("new")}>
          <Plus className="h-4 w-4 mr-2" />
          New Ticket
        </Button>
      </div>

      {ticketsLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-48 mb-2" />
              <div className="h-3 bg-muted rounded w-24" />
            </Card>
          ))}
        </div>
      ) : tickets && tickets.length > 0 ? (
        <div className="space-y-2">
          {tickets.map((ticket) => (
            <Card
              key={ticket.id}
              className="p-4 hover:bg-primary/5 cursor-pointer transition-colors"
              onClick={() => {
                setSelectedTicketId(ticket.id);
                setView("detail");
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{ticket.subject}</div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span className="capitalize">{ticket.category.replace(/_/g, " ")}</span>
                    <span>&middot;</span>
                    <span>{new Date(ticket.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-xs border capitalize whitespace-nowrap",
                    STATUS_BADGE_COLORS[ticket.status] || ""
                  )}
                >
                  {ticket.status.replace(/_/g, " ")}
                </span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <LifeBuoy className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No tickets yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Need help? Create a new support ticket.
          </p>
        </Card>
      )}
    </div>
  );
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const { weekStartsOn, setWeekStartsOn, familyName, setFamilyName, homeAddress, setHomeAddress, dayStartHour, setDayStartHour, dayEndHour, setDayEndHour, tickerSpeed, setTickerSpeed, weekCellWidget, setWeekCellWidget, showDriveTimeOnNext, setShowDriveTimeOnNext, showWeekNumbers, setShowWeekNumbers, defaultEventDuration, setDefaultEventDuration, autoRefreshInterval, setAutoRefreshInterval } = useCalendarStore();
  const {
    enabled: screensaverEnabled,
    setEnabled: setScreensaverEnabled,
    idleTimeout,
    setIdleTimeout,
    slideInterval,
    setSlideInterval,
    layout: screensaverLayout,
    setLayout: setScreensaverLayout,
    transition,
    setTransition,
    colorScheme,
    setColorScheme,
    nightDimEnabled,
    setNightDimEnabled,
    nightDimStartHour,
    setNightDimStartHour,
    nightDimEndHour,
    setNightDimEndHour,
    nightDimOpacity,
    setNightDimOpacity,
    nightDimFadeDuration,
    setNightDimFadeDuration,
    clockPosition,
    setClockPosition,
    clockSize,
    setClockSize,
    infoPaneWidgets,
    setInfoPaneWidgets,
    infoPaneWidgetConfigs,
    setInfoPaneWidgetConfigs,
    updateWidgetConfig,
    reorderWidgets,
    widgetGridSize,
    setWidgetGridSize,
    // Composite widgets (v2)
    compositeWidgetConfigs,
    setCompositeWidgetConfigs,
    updateCompositeWidgetConfig,
    updateSubItemConfig,
    reorderCompositeWidgets,
  } = useScreensaverStore();
  const {
    layout: tasksLayout,
    setLayout: setTasksLayout,
    showCompleted: tasksShowCompleted,
    setShowCompleted: setTasksShowCompleted,
    expandAllLists,
    setExpandAllLists,
  } = useTasksStore();

  const { features: sidebarFeatures, toggleEnabled: toggleSidebarEnabled, togglePinned: toggleSidebarPinned, resetAll: resetSidebar } = useSidebarStore();
  const { enabled: entertainmentEnabled, toggleEnabled: toggleEntertainmentEnabled } = useEntertainmentStore();
  const filteredTabs = useFilteredTabs();
  const { isEnabled: isModuleEnabled, installModule, uninstallModule, moduleList, fetchModules: refetchModules, loading: modulesLoading } = useModuleStore();

  // Read initial tab from URL, default to null (menu view)
  const tabFromUrl = searchParams.get("tab") as SettingsTab | null;
  const initialTab = tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : null;
  const [activeTab, setActiveTab] = useState<SettingsTab | null>(initialTab);

  // Entertainment sub-tab state
  const subTabFromUrl = searchParams.get("subtab") as EntertainmentSubTab | null;
  const initialSubTab = subTabFromUrl && validEntertainmentSubTabs.includes(subTabFromUrl) ? subTabFromUrl : "sports";
  const [activeEntertainmentSubTab, setActiveEntertainmentSubTab] = useState<EntertainmentSubTab>(initialSubTab);

  // Appearance sub-tab state
  const appearanceSubTabFromUrl = searchParams.get("subtab") as AppearanceSubTab | null;
  const initialAppearanceSubTab = appearanceSubTabFromUrl && validAppearanceSubTabs.includes(appearanceSubTabFromUrl)
    ? appearanceSubTabFromUrl : "display";
  const [activeAppearanceSubTab, setActiveAppearanceSubTab] = useState<AppearanceSubTab>(initialAppearanceSubTab);

  // Local photos album selection state
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [selectedAlbumName, setSelectedAlbumName] = useState<string>("");

  // Fetch albums for album name lookup
  const { data: albums = [] } = useQuery({
    queryKey: ["photo-albums"],
    queryFn: () => api.getAlbums(),
    staleTime: 0, // Always refetch when query is accessed
  });

  // Sync activeTab when URL search params change externally (e.g., clicking the Settings gear)
  useEffect(() => {
    const urlTab = searchParams.get("tab") as SettingsTab | null;
    const resolved = urlTab && validTabs.includes(urlTab) ? urlTab : null;
    setActiveTab(resolved);
  }, [searchParams]);

  // Update URL when tab changes
  const handleTabChange = (tab: SettingsTab | null) => {
    setActiveTab(tab);
    if (tab === null) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("tab");
      newParams.delete("subtab");
      setSearchParams(newParams);
    } else if (tab === "entertainment") {
      setSearchParams({ tab, subtab: activeEntertainmentSubTab });
    } else if (tab === "appearance") {
      setSearchParams({ tab, subtab: activeAppearanceSubTab });
    } else {
      setSearchParams({ tab });
    }
  };

  const handleEntertainmentSubTabChange = (subtab: EntertainmentSubTab) => {
    setActiveEntertainmentSubTab(subtab);
    setSearchParams({ tab: "entertainment", subtab });
  };

  const handleAppearanceSubTabChange = (subtab: AppearanceSubTab) => {
    setActiveAppearanceSubTab(subtab);
    setSearchParams({ tab: "appearance", subtab });
  };

  // Fetch calendars for settings
  const { data: calendars = [] } = useQuery({
    queryKey: ["calendars"],
    queryFn: () => api.getCalendars(),
  });

  // Fetch events for calendar preview and recent activity
  const { data: events = [] } = useQuery({
    queryKey: ["events", "calendar-settings"],
    queryFn: () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      return api.getEvents(thirtyDaysAgo, thirtyDaysAhead);
    },
  });

  // Sort calendars: primary → favorites → read-write → recent events → alphabetical
  // Also separate visible from hidden calendars
  const { visibleCalendars, hiddenCalendars } = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get calendar IDs that have recent events
    const calendarsWithRecentEvents = new Set(
      events
        .filter((event) => new Date(event.startTime) >= thirtyDaysAgo)
        .map((event) => event.calendarId)
    );

    const sortFn = (a: typeof calendars[0], b: typeof calendars[0]) => {
      // Primary calendar always first
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;

      // Favorites next
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;

      // Read-write calendars before read-only
      if (!a.isReadOnly && b.isReadOnly) return -1;
      if (a.isReadOnly && !b.isReadOnly) return 1;

      // Then calendars with recent events
      const aHasRecent = calendarsWithRecentEvents.has(a.id);
      const bHasRecent = calendarsWithRecentEvents.has(b.id);
      if (aHasRecent && !bHasRecent) return -1;
      if (!aHasRecent && bHasRecent) return 1;

      // Then sort alphabetically
      return a.name.localeCompare(b.name);
    };

    const visible = calendars.filter(c => c.isVisible).sort(sortFn);
    const hidden = calendars.filter(c => !c.isVisible).sort(sortFn);

    return { visibleCalendars: visible, hiddenCalendars: hidden };
  }, [calendars, events]);

  // For backwards compatibility
  const sortedCalendars = visibleCalendars;

  // State for hidden calendars section
  const [hiddenCalendarsExpanded, setHiddenCalendarsExpanded] = useState(false);

  // State for new two-column calendar settings layout
  const [selectedCalendarProvider, setSelectedCalendarProvider] = useState<CalendarProvider | null>("google");
  const [addAccountModalView, setAddAccountModalView] = useState<"select" | "caldav" | "ics" | null>(null);
  const [showHACalendarModal, setShowHACalendarModal] = useState(false);

  // Fetch favorite teams for sports provider in calendar settings
  const { data: calendarFavoriteTeams = [] } = useQuery({
    queryKey: ["favorite-teams"],
    queryFn: () => api.getFavoriteTeams(),
  });

  // Update favorite team mutation for calendar settings
  const updateFavoriteTeam = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { isVisible?: boolean; showOnDashboard?: boolean } }) =>
      api.updateFavoriteTeam(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorite-teams"] });
    },
  });

  const syncAll = useMutation({
    mutationFn: () => api.syncAllCalendars(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendars"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  // Auto-sync after returning from OAuth connection
  useEffect(() => {
    if (searchParams.get("connected")) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("connected");
      setSearchParams(newParams, { replace: true });
      syncAll.mutate();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track recently favorited calendars for highlight animation
  const [recentlyFavorited, setRecentlyFavorited] = useState<Set<string>>(new Set());
  const calendarListRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const savedScrollRef = useRef<number>(0);

  const updateCalendar = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { isVisible?: boolean; syncEnabled?: boolean; isPrimary?: boolean; isFavorite?: boolean; showOnDashboard?: boolean; visibility?: { week?: boolean; month?: boolean; day?: boolean; popup?: boolean; screensaver?: boolean } };
    }) => api.updateCalendar(id, data),
    onMutate: async ({ id, data }) => {
      // If favoriting/unfavoriting, track it and save scroll position
      if (data.isFavorite !== undefined) {
        // Save current scroll position
        if (scrollContainerRef.current) {
          savedScrollRef.current = scrollContainerRef.current.scrollTop;
        }
        setRecentlyFavorited((prev) => new Set(prev).add(id));
        // Clear highlight after animation
        setTimeout(() => {
          setRecentlyFavorited((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }, 800);
      }
    },
    onSuccess: (_, { data }) => {
      queryClient.invalidateQueries({ queryKey: ["calendars"] });
      // Restore scroll position after the DOM updates from query invalidation
      if (data.isFavorite !== undefined) {
        // Use multiple frames to ensure DOM has fully updated after React re-render
        setTimeout(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = savedScrollRef.current;
          }
        }, 50);
      }
    },
  });

  // Get editable calendars for default selection
  const editableCalendars = calendars.filter((c) => !c.isReadOnly && c.syncEnabled);
  const currentDefaultCalendar = calendars.find((c) => c.isPrimary);

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useAuthStore((state) => state.logout);

  return (
    <div className="flex h-full flex-col relative">
      {/* Login Status Banner */}
      {(() => {
        const hasValidSession = isAuthenticated && user?.email;
        const hasStaleSession = isAuthenticated && !user?.email;

        if (hasValidSession) {
          return (
            <div className="px-4 py-2 flex items-center justify-between bg-green-500/10 border-b border-green-500/20">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-700 dark:text-green-400">
                  Logged in as <strong>{user.email}</strong>
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  api.logout().catch(() => {});
                  logout();
                  window.location.href = appPath("/login");
                }}
                className="text-sm"
              >
                Sign Out
              </Button>
            </div>
          );
        }

        if (hasStaleSession) {
          return (
            <div className="px-4 py-2 flex items-center justify-between bg-yellow-500/10 border-b border-yellow-500/20">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-yellow-700 dark:text-yellow-400">
                  Session expired - please sign in again
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  logout();
                  window.location.href = appPath("/login");
                }}
                className="text-sm"
              >
                <LogIn className="h-4 w-4 mr-1" />
                Sign In
              </Button>
            </div>
          );
        }

        return (
          <div className="px-4 py-2 flex items-center justify-between bg-red-500/10 border-b border-red-500/20">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-700 dark:text-red-400">
                Not logged in - some features may not work
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.href = appPath("/login")}
              className="text-sm"
            >
              <LogIn className="h-4 w-4 mr-1" />
              Sign In
            </Button>
          </div>
        );
      })()}

      {/* OAuth error alert from redirect */}
      {searchParams.get("error") && (
        <div className="px-4 py-3 flex items-center gap-2 bg-red-500/10 border-b border-red-500/20">
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
          <span className="text-sm text-red-700 dark:text-red-400 flex-1">
            {decodeURIComponent(searchParams.get("error")!)}
          </span>
          <button
            type="button"
            onClick={() => {
              const newParams = new URLSearchParams(searchParams);
              newParams.delete("error");
              setSearchParams(newParams);
            }}
            className="shrink-0 rounded p-1 text-red-600 hover:bg-red-500/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Section Header (back button when inside a section) */}
      {activeTab !== null && (
        <div className="border-b border-border bg-card">
          <div className="relative flex items-center justify-center px-4 sm:px-6 py-4">
            <button
              onClick={() => handleTabChange(null)}
              className="absolute left-4 sm:left-6 flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg px-3 py-2 hover:bg-primary/10"
            >
              <ArrowLeft className="h-5 w-5" />
              Back
            </button>
            <div className="flex items-center gap-2.5 text-base font-semibold text-primary">
              {filteredTabs.find((t) => t.id === activeTab)?.icon}
              {filteredTabs.find((t) => t.id === activeTab)?.label}
            </div>
          </div>
        </div>
      )}

      {/* Tab Content */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6">
          {/* Settings Menu Grid */}
          {activeTab === null && (
            <div className="mx-auto max-w-4xl">
              <h2 className="text-lg font-semibold text-white mb-4">Settings</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className="flex flex-col items-center gap-2 p-4 sm:p-6 bg-card border-2 border-primary/40 rounded-lg hover:border-primary hover:bg-primary/10 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary [&>svg]:h-6 [&>svg]:w-6">
                      {tab.icon}
                    </div>
                    <span className="text-sm font-medium text-white">{tab.label}</span>
                    <span className="text-xs text-muted-foreground">{tab.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* Modules Tab */}
          {activeTab === "modules" && (
            <ModulesTab
              isModuleEnabled={isModuleEnabled}
              moduleList={moduleList}
              modulesLoading={modulesLoading}
              onInstall={async (id) => {
                await installModule(id);
                refetchModules();
              }}
              onUninstall={async (id) => {
                await uninstallModule(id);
                refetchModules();
              }}
            />
          )}
          {/* Account Tab */}
          {activeTab === "account" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <Card className="border-2 border-primary/40">
                <CardHeader>
                  <CardTitle>Account</CardTitle>
                  <CardDescription>Your account information</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    {user?.avatarUrl && (
                      <img
                        src={user.avatarUrl}
                        alt={user.name ?? ""}
                        className="h-16 w-16 rounded-full"
                      />
                    )}
                    <div>
                      <p className="font-medium">{user?.name}</p>
                      <p className="text-sm text-muted-foreground">{user?.email}</p>
                      <p className="text-sm text-muted-foreground">
                        Timezone: {user?.timezone}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-primary/40">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Connected Accounts</CardTitle>
                      <CardDescription>
                        Your linked calendar providers
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => syncAll.mutate()}
                      disabled={syncAll.isPending}
                    >
                      <RefreshCw
                        className={`mr-2 h-4 w-4 ${syncAll.isPending ? "animate-spin" : ""}`}
                      />
                      Sync All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Google Account */}
                    <div className="flex items-center justify-between rounded-lg border border-border p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                          <svg className="h-5 w-5" viewBox="0 0 24 24">
                            <path
                              fill="#EA4335"
                              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                              fill="#34A853"
                              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                              fill="#FBBC05"
                              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                              fill="#4285F4"
                              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium">Google</p>
                          <p className="text-sm text-muted-foreground">
                            {user?.linkedProviders?.includes("google")
                              ? "Profile linked"
                              : "Not linked"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {user?.linkedProviders?.includes("google") ? (
                          <>
                            <span className="flex items-center gap-1 text-sm text-green-500">
                              <Check className="h-3 w-3" />
                              Linked
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const token = useAuthStore.getState().accessToken;
                                window.location.href = buildOAuthUrl("google", "base", token, appUrl("/settings?tab=account"));
                              }}
                            >
                              <RefreshCw className="mr-1 h-3 w-3" />
                              Reconnect
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const token = useAuthStore.getState().accessToken;
                              window.location.href = buildOAuthUrl("google", "base", token, appUrl("/settings?tab=account"));
                            }}
                          >
                            <Link2 className="mr-1 h-3 w-3" />
                            Link Google Account
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Microsoft Account */}
                    <div className="flex items-center justify-between rounded-lg border border-border p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                          <svg className="h-5 w-5" viewBox="0 0 24 24">
                            <rect fill="#F25022" x="1" y="1" width="10" height="10" />
                            <rect fill="#7FBA00" x="13" y="1" width="10" height="10" />
                            <rect fill="#00A4EF" x="1" y="13" width="10" height="10" />
                            <rect fill="#FFB900" x="13" y="13" width="10" height="10" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium">Microsoft</p>
                          <p className="text-sm text-muted-foreground">
                            {user?.linkedProviders?.includes("microsoft")
                              ? "Profile linked"
                              : "Not linked"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {user?.linkedProviders?.includes("microsoft") ? (
                          <>
                            <span className="flex items-center gap-1 text-sm text-green-500">
                              <Check className="h-3 w-3" />
                              Linked
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const token = useAuthStore.getState().accessToken;
                                window.location.href = buildOAuthUrl("microsoft", "base", token, appUrl("/settings?tab=account"));
                              }}
                            >
                              <RefreshCw className="mr-1 h-3 w-3" />
                              Reconnect
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const token = useAuthStore.getState().accessToken;
                              window.location.href = buildOAuthUrl("microsoft", "base", token, appUrl("/settings?tab=account"));
                            }}
                          >
                            <Link2 className="mr-1 h-3 w-3" />
                            Link Microsoft Account
                          </Button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground mt-2">
                      Linking an account enables "Sign in with Google/Microsoft" on the login page. Calendar and task permissions are requested separately when you enable those features.
                    </p>
                  </div>
                </CardContent>
              </Card>

            </div>
          )}

          {/* Calendars Tab - Two Column Layout */}
          {activeTab === "calendars" && (
            <>
              <Card className="border-2 border-primary/40">
                <CardHeader>
                  <CardTitle>Calendar Settings</CardTitle>
                  <CardDescription>
                    Manage your calendar accounts and configure visibility settings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6 min-h-[500px]">
                    {/* Left Column - Accounts List */}
                    <div className="lg:border-r lg:border-border lg:pr-6">
                      <CalendarAccountsList
                        calendars={calendars}
                        favoriteTeams={calendarFavoriteTeams}
                        selectedProvider={selectedCalendarProvider}
                        onSelectProvider={setSelectedCalendarProvider}
                        onAddAccount={() => setAddAccountModalView("select")}
                        onSyncAll={() => syncAll.mutate()}
                        isSyncing={syncAll.isPending}
                      />
                    </div>

                    {/* Right Column - Calendars for Selected Provider */}
                    <div className="min-h-0">
                      {selectedCalendarProvider ? (
                        <CalendarListForAccount
                          provider={selectedCalendarProvider}
                          calendars={calendars}
                          favoriteTeams={calendarFavoriteTeams}
                          events={events}
                          onUpdateCalendar={(id, updates) =>
                            updateCalendar.mutate({ id, data: updates })
                          }
                          onUpdateTeam={(id, updates) =>
                            updateFavoriteTeam.mutate({ id, data: updates })
                          }
                          onConnect={() => {
                            const authToken = useAuthStore.getState().accessToken;
                            if (selectedCalendarProvider === "google") {
                              window.location.href = buildOAuthUrl("google", "calendar", authToken, appUrl("/settings?tab=calendars&connected=true"));
                            } else if (selectedCalendarProvider === "microsoft") {
                              window.location.href = buildOAuthUrl("microsoft", "calendar", authToken, appUrl("/settings?tab=calendars&connected=true"));
                            } else if (selectedCalendarProvider === "sports") {
                              // Navigate to entertainment tab with sports sub-tab
                              window.location.href = appPath("/settings?tab=entertainment&subtab=sports");
                            } else if (selectedCalendarProvider === "ics") {
                              setAddAccountModalView("ics");
                            } else if (selectedCalendarProvider === "caldav") {
                              setAddAccountModalView("caldav");
                            } else if (selectedCalendarProvider === "homeassistant") {
                              setShowHACalendarModal(true);
                            } else {
                              setAddAccountModalView("select");
                            }
                          }}
                          onManageTeams={() => {
                            window.location.href = appPath("/settings?tab=entertainment&subtab=sports");
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          Select an account type to view calendars
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Add Account Modal */}
              <AddAccountModal
                isOpen={addAccountModalView !== null}
                onClose={() => setAddAccountModalView(null)}
                initialView={addAccountModalView ?? "select"}
                onConnectGoogle={() => {
                  const authToken = useAuthStore.getState().accessToken;
                  window.location.href = buildOAuthUrl("google", "calendar", authToken, appUrl("/settings?tab=calendars&connected=true"));
                }}
                onConnectMicrosoft={() => {
                  const authToken = useAuthStore.getState().accessToken;
                  window.location.href = buildOAuthUrl("microsoft", "calendar", authToken, appUrl("/settings?tab=calendars&connected=true"));
                }}
                onConnectCalDAV={async (url, username, password) => {
                  // TODO: Implement CalDAV connection
                  console.log("CalDAV connection:", { url, username });
                  throw new Error("CalDAV connection not yet implemented");
                }}
                onSubscribeICS={async (url, name) => {
                  await api.subscribeICS(url, name);
                  queryClient.invalidateQueries({ queryKey: ["calendars"] });
                  setSelectedCalendarProvider("ics");
                }}
                onManageSports={() => {
                  setAddAccountModalView(null);
                  window.location.href = appPath("/settings?tab=entertainment&subtab=sports");
                }}
              />

              {/* Home Assistant Calendar Modal */}
              <HACalendarModal
                isOpen={showHACalendarModal}
                onClose={() => setShowHACalendarModal(false)}
                onSubscribe={async (entityId, name) => {
                  await api.subscribeHomeAssistantCalendar(entityId, name);
                  queryClient.invalidateQueries({ queryKey: ["calendars"] });
                  setShowHACalendarModal(false);
                }}
              />
            </>
          )}

          {/* Tasks Tab */}
          {activeTab === "tasks" && (
            <Card className="border-2 border-primary/40">
              <CardHeader>
                <CardTitle>Tasks Display</CardTitle>
                <CardDescription>
                  Configure how tasks are displayed
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="font-medium">Layout</p>
                    <p className="text-sm text-muted-foreground">
                      Choose how tasks are displayed
                    </p>
                  </div>
                  <select
                    className="rounded-md border border-border bg-background px-3 py-2 min-h-[44px] w-full sm:w-auto"
                    value={tasksLayout}
                    onChange={(e) => setTasksLayout(e.target.value as TasksLayout)}
                  >
                    <option value="lists">Collapsible Lists</option>
                    <option value="grid">Grid</option>
                    <option value="columns">Columns (Side-by-Side)</option>
                    <option value="kanban">Kanban (By Status)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">Show completed tasks</p>
                    <p className="text-sm text-muted-foreground">
                      Display completed tasks by default
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={tasksShowCompleted}
                    onChange={(e) => setTasksShowCompleted(e.target.checked)}
                    className="rounded min-h-[44px] min-w-[44px]"
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">Expand all lists</p>
                    <p className="text-sm text-muted-foreground">
                      Automatically expand all task lists (Lists layout only)
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={expandAllLists}
                    onChange={(e) => setExpandAllLists(e.target.checked)}
                    className="rounded min-h-[44px] min-w-[44px]"
                    disabled={tasksLayout !== "lists"}
                  />
                </div>

                {/* Layout preview */}
                <div className="rounded-lg border border-border p-4 bg-muted/30">
                  <p className="text-sm font-medium mb-2">Layout preview</p>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setTasksLayout("lists")}
                      className={`aspect-video rounded border-2 flex flex-col items-start justify-center p-1.5 gap-0.5 ${
                        tasksLayout === "lists" ? "border-primary bg-primary/10" : "border-border"
                      }`}
                      title="Collapsible Lists"
                    >
                      <div className="w-full h-1 bg-muted-foreground/30 rounded" />
                      <div className="w-3/4 h-0.5 bg-muted-foreground/20 rounded ml-1" />
                      <div className="w-full h-1 bg-muted-foreground/30 rounded" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setTasksLayout("grid")}
                      className={`aspect-video rounded border-2 grid grid-cols-3 gap-0.5 p-1 ${
                        tasksLayout === "grid" ? "border-primary bg-primary/10" : "border-border"
                      }`}
                      title="Grid"
                    >
                      <div className="bg-muted-foreground/30 rounded" />
                      <div className="bg-muted-foreground/30 rounded" />
                      <div className="bg-muted-foreground/30 rounded" />
                      <div className="bg-muted-foreground/30 rounded" />
                      <div className="bg-muted-foreground/30 rounded" />
                      <div className="bg-muted-foreground/30 rounded" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setTasksLayout("columns")}
                      className={`aspect-video rounded border-2 flex items-stretch gap-0.5 p-1 ${
                        tasksLayout === "columns" ? "border-primary bg-primary/10" : "border-border"
                      }`}
                      title="Columns"
                    >
                      <div className="flex-1 bg-muted-foreground/30 rounded" />
                      <div className="flex-1 bg-muted-foreground/30 rounded" />
                      <div className="flex-1 bg-muted-foreground/30 rounded" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setTasksLayout("kanban")}
                      className={`aspect-video rounded border-2 flex items-stretch gap-0.5 p-1 ${
                        tasksLayout === "kanban" ? "border-primary bg-primary/10" : "border-border"
                      }`}
                      title="Kanban"
                    >
                      <div className="flex-1 bg-muted-foreground/30 rounded flex flex-col gap-0.5 p-0.5">
                        <div className="flex-1 bg-muted-foreground/20 rounded" />
                        <div className="flex-1 bg-muted-foreground/20 rounded" />
                      </div>
                      <div className="flex-1 bg-green-500/30 rounded flex flex-col gap-0.5 p-0.5">
                        <div className="flex-1 bg-green-500/20 rounded" />
                      </div>
                    </button>
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                    <span>Lists</span>
                    <span>Grid</span>
                    <span>Columns</span>
                    <span>Kanban</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Entertainment Tab */}
          {activeTab === "entertainment" && (
            <div className="space-y-6">
              {/* Sub-tab navigation - horizontally scrollable on mobile */}
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 border-b border-border pb-4">
                <div className="flex gap-2 whitespace-nowrap">
                  {entertainmentSubTabs.map((subtab) => (
                    <button
                      key={subtab.id}
                      onClick={() => handleEntertainmentSubTabChange(subtab.id)}
                      className={`flex items-center gap-2 px-4 py-2 min-h-[44px] text-sm font-medium rounded-lg transition-colors ${
                        activeEntertainmentSubTab === subtab.id
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      {subtab.icon}
                      {subtab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sub-tab content */}
              {activeEntertainmentSubTab === "sports" && <SportsSettings />}
              {activeEntertainmentSubTab === "spotify" && <SpotifySettings />}
              {activeEntertainmentSubTab === "iptv" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                  <IptvSettings />
                  <IptvChannelManager />
                </div>
              )}
              {activeEntertainmentSubTab === "plex" && <PlexSettings />}
              {activeEntertainmentSubTab === "audiobookshelf" && <AudiobookshelfSettings />}
              {activeEntertainmentSubTab === "news" && <NewsSettings />}
            </div>
          )}

          {/* Appearance Tab */}
          {activeTab === "appearance" && (
            <div className="space-y-6">
              {/* Sub-tab navigation */}
              <div className="flex gap-2 whitespace-nowrap">
                {appearanceSubTabs.map((subtab) => (
                  <button
                    key={subtab.id}
                    onClick={() => handleAppearanceSubTabChange(subtab.id)}
                    className={`flex items-center gap-2 px-4 py-2 min-h-[44px] text-sm font-medium rounded-lg transition-colors ${
                      activeAppearanceSubTab === subtab.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {subtab.icon}
                    {subtab.label}
                  </button>
                ))}
              </div>

              {/* Display sub-tab */}
              {activeAppearanceSubTab === "display" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                  {/* Display Card */}
                  <Card className="border-2 border-primary/40">
                    <CardHeader>
                      <CardTitle>Display</CardTitle>
                      <CardDescription>
                        Configure the dashboard display for kiosk mode
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <p className="font-medium">Calendar name</p>
                          <p className="text-sm text-muted-foreground">
                            Display name shown at the top of the calendar
                          </p>
                        </div>
                        <input
                          type="text"
                          value={familyName}
                          onChange={(e) => setFamilyName(e.target.value)}
                          className="rounded-md border border-border bg-background px-3 py-2 min-h-[44px] w-full sm:w-48"
                          placeholder="Family Calendar"
                        />
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <p className="font-medium">Home address</p>
                          <p className="text-sm text-muted-foreground">
                            Used to calculate travel times to event locations
                          </p>
                        </div>
                        <input
                          type="text"
                          value={homeAddress}
                          onChange={(e) => setHomeAddress(e.target.value)}
                          className="rounded-md border border-border bg-background px-3 py-2 min-h-[44px] w-full sm:w-64"
                          placeholder="123 Main St, City, State"
                        />
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <p className="font-medium">Default calendar</p>
                          <p className="text-sm text-muted-foreground">
                            Calendar used when creating new events
                          </p>
                        </div>
                        <select
                          className="rounded-md border border-border bg-background px-3 py-2 min-h-[44px] w-full sm:w-auto"
                          value={currentDefaultCalendar?.id ?? ""}
                          onChange={(e) => {
                            const newDefaultId = e.target.value;
                            if (newDefaultId) {
                              updateCalendar.mutate({
                                id: newDefaultId,
                                data: { isPrimary: true },
                              });
                            }
                          }}
                        >
                          <option value="" disabled>Select a calendar</option>
                          {editableCalendars.map((calendar) => (
                            <option key={calendar.id} value={calendar.id}>
                              {calendar.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">Show clock</p>
                          <p className="text-sm text-muted-foreground">
                            Display time on dashboard
                          </p>
                        </div>
                        <input type="checkbox" defaultChecked className="rounded min-h-[44px] min-w-[44px]" />
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <p className="font-medium">Week starts on</p>
                          <p className="text-sm text-muted-foreground">
                            First day of the week in calendar views
                          </p>
                        </div>
                        <select
                          className="rounded-md border border-border bg-background px-3 py-2 min-h-[44px] w-full sm:w-auto"
                          value={weekStartsOn}
                          onChange={(e) => setWeekStartsOn(Number(e.target.value) as 0 | 1 | 2 | 3 | 4 | 5 | 6)}
                        >
                          <option value={1}>Monday</option>
                          <option value={0}>Sunday</option>
                          <option value={6}>Saturday</option>
                        </select>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <p className="font-medium">Day view hours</p>
                          <p className="text-sm text-muted-foreground">
                            Visible time range in day and week views
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            className="rounded-md border border-border bg-background px-3 py-2 min-h-[44px]"
                            value={dayStartHour}
                            onChange={(e) => setDayStartHour(Number(e.target.value))}
                          >
                            {Array.from({ length: 24 }, (_, i) => (
                              <option key={i} value={i}>
                                {i === 0 ? "12 AM" : i < 12 ? `${i} AM` : i === 12 ? "12 PM" : `${i - 12} PM`}
                              </option>
                            ))}
                          </select>
                          <span className="text-muted-foreground">to</span>
                          <select
                            className="rounded-md border border-border bg-background px-3 py-2 min-h-[44px]"
                            value={dayEndHour}
                            onChange={(e) => setDayEndHour(Number(e.target.value))}
                          >
                            {Array.from({ length: 24 }, (_, i) => (
                              <option key={i} value={i}>
                                {i === 0 ? "12 AM" : i < 12 ? `${i} AM` : i === 12 ? "12 PM" : `${i - 12} PM`}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <p className="font-medium">Ticker speed</p>
                          <p className="text-sm text-muted-foreground">
                            Speed of the scrolling news ticker in the header
                          </p>
                        </div>
                        <select
                          className="rounded-md border border-border bg-background px-3 py-2 min-h-[44px] w-full sm:w-auto"
                          value={tickerSpeed}
                          onChange={(e) => setTickerSpeed(e.target.value as "slow" | "normal" | "fast")}
                        >
                          <option value="slow">Slow (45s)</option>
                          <option value="normal">Normal (30s)</option>
                          <option value="fast">Fast (15s)</option>
                        </select>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <p className="font-medium">Week view widget</p>
                          <p className="text-sm text-muted-foreground">
                            What to show in the 8th cell of the week view
                          </p>
                        </div>
                        <select
                          className="rounded-md border border-border bg-background px-3 py-2 min-h-[44px] w-full sm:w-auto"
                          value={weekCellWidget}
                          onChange={(e) => setWeekCellWidget(e.target.value as "next-week" | "camera" | "map" | "spotify" | "home-control")}
                        >
                          <option value="next-week">Next Week</option>
                          <option value="camera">Camera</option>
                          <option value="map">Map</option>
                          <option value="spotify">Spotify</option>
                          <option value="home-control">Home Control</option>
                        </select>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">Show drive time on next event</p>
                          <p className="text-sm text-muted-foreground">
                            Display driving time from home on the "up next" event
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={showDriveTimeOnNext}
                          onClick={() => setShowDriveTimeOnNext(!showDriveTimeOnNext)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors min-w-[44px] ${
                            showDriveTimeOnNext ? "bg-primary" : "bg-muted"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              showDriveTimeOnNext ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">Show week numbers</p>
                          <p className="text-sm text-muted-foreground">
                            Display week numbers in calendar views
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={showWeekNumbers}
                          onClick={() => setShowWeekNumbers(!showWeekNumbers)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors min-w-[44px] ${
                            showWeekNumbers ? "bg-primary" : "bg-muted"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              showWeekNumbers ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <p className="font-medium">Default event duration</p>
                          <p className="text-sm text-muted-foreground">
                            Duration for new events
                          </p>
                        </div>
                        <select
                          className="rounded-md border border-border bg-background px-3 py-2 min-h-[44px] w-full sm:w-auto"
                          value={defaultEventDuration}
                          onChange={(e) => setDefaultEventDuration(Number(e.target.value))}
                        >
                          <option value={15}>15 minutes</option>
                          <option value={30}>30 minutes</option>
                          <option value={60}>1 hour</option>
                          <option value={90}>1.5 hours</option>
                          <option value={120}>2 hours</option>
                        </select>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <p className="font-medium">Auto-refresh interval</p>
                          <p className="text-sm text-muted-foreground">
                            How often to refresh calendar data
                          </p>
                        </div>
                        <select
                          className="rounded-md border border-border bg-background px-3 py-2 min-h-[44px] w-full sm:w-auto"
                          value={autoRefreshInterval}
                          onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                        >
                          <option value={0}>Disabled</option>
                          <option value={1}>1 minute</option>
                          <option value={5}>5 minutes</option>
                          <option value={10}>10 minutes</option>
                          <option value={15}>15 minutes</option>
                          <option value={30}>30 minutes</option>
                        </select>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Color Scheme Card */}
                  <Card className="border-2 border-primary/40">
                    <CardHeader>
                      <CardTitle>Color Scheme</CardTitle>
                      <CardDescription>
                        Choose a color theme for the entire application
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {COLOR_SCHEMES.map((scheme) => (
                          <button
                            key={scheme.value}
                            onClick={() => setColorScheme(scheme.value)}
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                              colorScheme === scheme.value
                                ? "border-primary bg-primary/10"
                                : "border-border hover:border-muted-foreground/50"
                            }`}
                          >
                            <div
                              className="w-12 h-12 rounded-full shadow-lg"
                              style={{ backgroundColor: scheme.accent }}
                            />
                            <span className="text-sm font-medium">{scheme.label}</span>
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Photos sub-tab */}
              {activeAppearanceSubTab === "photos" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                  {/* Photo Albums Card */}
                  <Card className="border-2 border-primary/40">
                    <CardHeader>
                      <CardTitle>
                        <div className="flex items-center gap-2">
                          <FolderOpen className="h-5 w-5" />
                          Photo Albums
                        </div>
                      </CardTitle>
                      <CardDescription>
                        Manage photos for the screensaver slideshow. Photos can be uploaded from your device or imported from Google Photos.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {selectedAlbumId ? (
                        <AlbumPhotoGrid
                          albumId={selectedAlbumId}
                          albumName={selectedAlbumName}
                          onBack={() => setSelectedAlbumId(null)}
                        />
                      ) : (
                        <LocalPhotoAlbums
                          onSelectAlbum={(albumId) => {
                            const album = albums.find((a) => a.id === albumId);
                            setSelectedAlbumId(albumId);
                            setSelectedAlbumName(album?.name ?? "Album");
                          }}
                        />
                      )}
                    </CardContent>
                  </Card>

                  {/* Manage Photos Card */}
                  <Card className="border-2 border-primary/40">
                    <CardHeader>
                      <CardTitle>Manage Photos</CardTitle>
                      <CardDescription>
                        View and delete uploaded photos across all albums
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ManageAllPhotos />
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Screensaver sub-tab */}
              {activeAppearanceSubTab === "screensaver" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  {/* Screensaver Settings Card */}
                  <Card className="border-2 border-primary/40">
                    <CardHeader>
                      <CardTitle>Screensaver Settings</CardTitle>
                      <CardDescription>
                        Configure when and how the screensaver appears
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">Enable screensaver</p>
                          <p className="text-sm text-muted-foreground">
                            Start photo slideshow after idle timeout
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={screensaverEnabled}
                          onChange={(e) => setScreensaverEnabled(e.target.checked)}
                          className="rounded min-h-[44px] min-w-[44px]"
                        />
                      </div>
                      {screensaverEnabled && (
                        <>
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div>
                              <p className="font-medium">Idle timeout</p>
                              <p className="text-sm text-muted-foreground">
                                Time before screensaver starts
                              </p>
                            </div>
                            <select
                              className="rounded-md border border-border bg-background px-3 py-2 min-h-[44px] w-full sm:w-auto"
                              value={idleTimeout}
                              onChange={(e) => setIdleTimeout(Number(e.target.value))}
                            >
                              <option value={60}>1 minute</option>
                              <option value={120}>2 minutes</option>
                              <option value={300}>5 minutes</option>
                              <option value={600}>10 minutes</option>
                              <option value={900}>15 minutes</option>
                              <option value={1800}>30 minutes</option>
                            </select>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div>
                              <p className="font-medium">Slide interval</p>
                              <p className="text-sm text-muted-foreground">
                                Time between photo transitions
                              </p>
                            </div>
                            <select
                              className="rounded-md border border-border bg-background px-3 py-2 min-h-[44px] w-full sm:w-auto"
                              value={slideInterval}
                              onChange={(e) => setSlideInterval(Number(e.target.value))}
                            >
                              <option value={5}>5 seconds</option>
                              <option value={10}>10 seconds</option>
                              <option value={15}>15 seconds</option>
                              <option value={30}>30 seconds</option>
                              <option value={60}>1 minute</option>
                              <option value={300}>5 minutes</option>
                            </select>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div>
                              <p className="font-medium">Layout</p>
                              <p className="text-sm text-muted-foreground">
                                How photos are displayed
                              </p>
                            </div>
                            <select
                              className="rounded-md border border-border bg-background px-3 py-2 min-h-[44px] w-full sm:w-auto"
                              value={screensaverLayout}
                              onChange={(e) => setScreensaverLayout(e.target.value as ScreensaverLayout)}
                            >
                              <option value="fullscreen">Full screen</option>
                              <option value="informational">Informational</option>
                              <option value="quad">Quad (4)</option>
                              <option value="scatter">Scatter collage</option>
                              <option value="builder">Custom Builder</option>
                            </select>
                          </div>
                          {screensaverLayout === "builder" && (
                            <div className="rounded-lg border-2 border-primary/40 p-4 bg-primary/5">
                              <p className="font-medium mb-2">Custom Layout Builder</p>
                              <p className="text-sm text-muted-foreground mb-3">
                                Create a custom screensaver layout with drag-and-drop widgets
                              </p>
                              <Link
                                to="/settings/screensaver-builder"
                                className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
                              >
                                Open Builder
                              </Link>
                            </div>
                          )}
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div>
                              <p className="font-medium">Transition</p>
                              <p className="text-sm text-muted-foreground">
                                Animation between slides
                              </p>
                            </div>
                            <select
                              className="rounded-md border border-border bg-background px-3 py-2 min-h-[44px] w-full sm:w-auto"
                              value={transition}
                              onChange={(e) => setTransition(e.target.value as ScreensaverTransition)}
                              disabled={screensaverLayout === "scatter"}
                            >
                              <option value="fade">Fade</option>
                              <option value="slide-left">Slide Left</option>
                              <option value="slide-right">Slide Right</option>
                              <option value="slide-up">Slide Up</option>
                              <option value="slide-down">Slide Down</option>
                              <option value="zoom">Zoom</option>
                            </select>
                          </div>
                          <div className="rounded-lg border border-border p-4 bg-muted/30">
                            <p className="text-sm font-medium mb-2">Layout preview</p>
                            <div className="grid grid-cols-6 gap-2">
                              <button
                                type="button"
                                onClick={() => setScreensaverLayout("fullscreen")}
                                className={`aspect-video rounded border-2 flex items-center justify-center ${
                                  screensaverLayout === "fullscreen" ? "border-primary bg-primary/10" : "border-border"
                                }`}
                              >
                                <div className="w-8 h-6 bg-muted-foreground/30 rounded" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setScreensaverLayout("informational")}
                                className={`aspect-video rounded border-2 flex items-center justify-center gap-0.5 ${
                                  screensaverLayout === "informational" ? "border-primary bg-primary/10" : "border-border"
                                }`}
                              >
                                <div className="w-3 h-5 bg-muted-foreground/30 rounded" />
                                <div className="w-3 h-5 bg-muted-foreground/30 rounded" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setScreensaverLayout("quad")}
                                className={`aspect-video rounded border-2 grid grid-cols-2 grid-rows-2 gap-0.5 p-1 ${
                                  screensaverLayout === "quad" ? "border-primary bg-primary/10" : "border-border"
                                }`}
                              >
                                <div className="bg-muted-foreground/30 rounded" />
                                <div className="bg-muted-foreground/30 rounded" />
                                <div className="bg-muted-foreground/30 rounded" />
                                <div className="bg-muted-foreground/30 rounded" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setScreensaverLayout("scatter")}
                                className={`aspect-video rounded border-2 relative overflow-hidden ${
                                  screensaverLayout === "scatter" ? "border-primary bg-primary/10" : "border-border"
                                }`}
                              >
                                <div className="absolute w-3 h-2 bg-muted-foreground/30 rounded top-1 left-1 rotate-[-5deg]" />
                                <div className="absolute w-4 h-3 bg-muted-foreground/30 rounded top-2 right-1 rotate-[8deg]" />
                                <div className="absolute w-3 h-2 bg-muted-foreground/30 rounded bottom-1 left-2 rotate-[3deg]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setScreensaverLayout("builder")}
                                className={`aspect-video rounded border-2 grid grid-cols-3 grid-rows-2 gap-0.5 p-0.5 ${
                                  screensaverLayout === "builder" ? "border-primary bg-primary/10" : "border-border"
                                }`}
                              >
                                <div className="bg-primary/40 rounded col-span-2" />
                                <div className="bg-muted-foreground/30 rounded" />
                                <div className="bg-muted-foreground/30 rounded" />
                                <div className="bg-primary/40 rounded col-span-2" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setScreensaverLayout("skylight")}
                                className={`aspect-video rounded border-2 flex items-center justify-center gap-0.5 p-1 ${
                                  screensaverLayout === "skylight" ? "border-primary bg-primary/10" : "border-border"
                                }`}
                              >
                                <div className="w-4 h-5 bg-muted-foreground/30 rounded" />
                                <div className="flex flex-col gap-0.5">
                                  <div className="w-2 h-[9px] bg-muted-foreground/30 rounded" />
                                  <div className="w-2 h-[9px] bg-muted-foreground/30 rounded" />
                                </div>
                              </button>
                            </div>
                          </div>

                          {/* Clock Display */}
                          <div className="border-t border-border pt-4 mt-4">
                            <h4 className="font-medium mb-3">Clock Display</h4>
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div>
                                <label className="text-sm font-medium block mb-2">Position</label>
                                <select
                                  value={clockPosition}
                                  onChange={(e) => setClockPosition(e.target.value as ClockPosition)}
                                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                >
                                  <option value="top-left">Top Left</option>
                                  <option value="top-center">Top Center</option>
                                  <option value="top-right">Top Right</option>
                                  <option value="bottom-left">Bottom Left</option>
                                  <option value="bottom-center">Bottom Center</option>
                                  <option value="bottom-right">Bottom Right</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-sm font-medium block mb-2">Size</label>
                                <select
                                  value={clockSize}
                                  onChange={(e) => setClockSize(e.target.value as ClockSize)}
                                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                >
                                  <option value="small">Small</option>
                                  <option value="medium">Medium</option>
                                  <option value="large">Large</option>
                                  <option value="extra-large">Extra Large</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* Night Dim Settings Card */}
                  <Card className="border-2 border-primary/40">
                    <CardHeader>
                      <CardTitle>Night Dim Settings</CardTitle>
                      <CardDescription>
                        Automatically dim the screen during nighttime hours
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">Enable night dimming</p>
                          <p className="text-sm text-muted-foreground">
                            Dim the screen during nighttime hours
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          className="min-h-[44px] min-w-[44px]"
                          checked={nightDimEnabled}
                          onChange={(e) => setNightDimEnabled(e.target.checked)}
                        />
                      </div>

                      {nightDimEnabled && (
                        <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium block mb-1">
                                Start time
                              </label>
                              <select
                                value={nightDimStartHour}
                                onChange={(e) => setNightDimStartHour(Number(e.target.value))}
                                className="w-full rounded-md border border-border bg-background px-3 py-2 min-h-[44px] text-sm"
                              >
                                {Array.from({ length: 24 }, (_, i) => (
                                  <option key={i} value={i}>
                                    {i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-sm font-medium block mb-1">
                                End time
                              </label>
                              <select
                                value={nightDimEndHour}
                                onChange={(e) => setNightDimEndHour(Number(e.target.value))}
                                className="w-full rounded-md border border-border bg-background px-3 py-2 min-h-[44px] text-sm"
                              >
                                {Array.from({ length: 24 }, (_, i) => (
                                  <option key={i} value={i}>
                                    {i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-medium block mb-1">
                              Fade duration: {nightDimFadeDuration} minutes
                            </label>
                            <input
                              type="range"
                              min="0"
                              max="60"
                              step="5"
                              value={nightDimFadeDuration}
                              onChange={(e) => setNightDimFadeDuration(Number(e.target.value))}
                              className="w-full"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Instant</span>
                              <span>1 hour</span>
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-medium block mb-1">
                              Dim level: {nightDimOpacity}%
                            </label>
                            <input
                              type="range"
                              min="10"
                              max="90"
                              step="5"
                              value={nightDimOpacity}
                              onChange={(e) => setNightDimOpacity(Number(e.target.value))}
                              className="w-full"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Slight</span>
                              <span>Very dark</span>
                            </div>
                          </div>

                          <p className="text-xs text-muted-foreground">
                            {nightDimFadeDuration > 0 ? (
                              <>Screen will gradually dim starting at {nightDimStartHour === 0 ? "12:00 AM" : nightDimStartHour < 12 ? `${nightDimStartHour}:00 AM` : nightDimStartHour === 12 ? "12:00 PM" : `${nightDimStartHour - 12}:00 PM`}, reaching full dim by {(() => {
                                const fullDimHour = nightDimStartHour + Math.floor(nightDimFadeDuration / 60);
                                const fullDimMinute = nightDimFadeDuration % 60;
                                const adjustedHour = fullDimHour % 24;
                                const hourStr = adjustedHour === 0 ? "12" : adjustedHour < 12 ? String(adjustedHour) : adjustedHour === 12 ? "12" : String(adjustedHour - 12);
                                const ampm = adjustedHour < 12 ? "AM" : "PM";
                                return `${hourStr}:${fullDimMinute.toString().padStart(2, '0')} ${ampm}`;
                              })()}, until {nightDimEndHour === 0 ? "12:00 AM" : nightDimEndHour < 12 ? `${nightDimEndHour}:00 AM` : nightDimEndHour === 12 ? "12:00 PM" : `${nightDimEndHour - 12}:00 PM`}</>
                            ) : (
                              <>Screen will dim instantly at {nightDimStartHour === 0 ? "12:00 AM" : nightDimStartHour < 12 ? `${nightDimStartHour}:00 AM` : nightDimStartHour === 12 ? "12:00 PM" : `${nightDimStartHour - 12}:00 PM`} until {nightDimEndHour === 0 ? "12:00 AM" : nightDimEndHour < 12 ? `${nightDimEndHour}:00 AM` : nightDimEndHour === 12 ? "12:00 PM" : `${nightDimEndHour - 12}:00 PM`}</>
                            )}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Informational Layout Widgets Card */}
                  <Card className={`border-2 ${screensaverLayout === "informational" ? "border-primary/40" : "border-border"}`}>
                    <CardHeader>
                      <CardTitle>Informational Layout Widgets</CardTitle>
                      <CardDescription>
                        Configure widgets shown in the informational screensaver layout
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <CompositeWidgetGridPreview
                        configs={compositeWidgetConfigs}
                        gridSize={widgetGridSize}
                        onGridSizeChange={setWidgetGridSize}
                        onUpdateConfig={updateCompositeWidgetConfig}
                        onReorder={reorderCompositeWidgets}
                      />

                      {screensaverLayout === "informational" ? (
                        <CompositeWidgetBuilder
                          configs={compositeWidgetConfigs}
                          onConfigsChange={setCompositeWidgetConfigs}
                          onUpdateConfig={updateCompositeWidgetConfig}
                          onUpdateSubItem={updateSubItemConfig}
                          onReorder={reorderCompositeWidgets}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Select the "Informational" layout to configure widgets.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Sidebar sub-tab */}
              {activeAppearanceSubTab === "sidebar" && (
                <Card className="border-2 border-primary/40">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Sidebar Navigation</CardTitle>
                        <CardDescription>
                          Control which features appear as sidebar icons or in the overflow menu
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resetSidebar}
                      >
                        Reset All
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {/* Header row */}
                      <div className="flex items-center gap-3 px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        <div className="flex-1">Feature</div>
                        <div className="w-20 text-center">Pinned</div>
                        <div className="w-20 text-center">Enabled</div>
                      </div>

                      {SIDEBAR_FEATURE_INFO.map(({ feature, label, icon }) => {
                        const state = sidebarFeatures[feature];
                        const isEnabled = state?.enabled !== false;
                        const isPinned = state?.pinned !== false;
                        const statusText = !isEnabled ? "Disabled" : isPinned ? "Sidebar" : "More menu";

                        return (
                          <div
                            key={feature}
                            className={cn(
                              "flex items-center gap-3 px-2 py-2.5 rounded-lg transition-colors",
                              !isEnabled && "opacity-50"
                            )}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className={cn(
                                "flex items-center justify-center h-8 w-8 rounded-md",
                                isEnabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                              )}>
                                {icon}
                              </div>
                              <div className="min-w-0">
                                <p className={cn(
                                  "text-sm font-medium",
                                  isEnabled ? "text-foreground" : "text-muted-foreground"
                                )}>
                                  {label}
                                </p>
                                <p className={cn(
                                  "text-xs",
                                  !isEnabled
                                    ? "text-muted-foreground"
                                    : isPinned
                                      ? "text-primary"
                                      : "text-muted-foreground"
                                )}>
                                  {statusText}
                                </p>
                              </div>
                            </div>
                            <div className="w-20 flex justify-center">
                              <Toggle
                                checked={isPinned}
                                onChange={() => toggleSidebarPinned(feature)}
                                size="sm"
                                disabled={!isEnabled}
                              />
                            </div>
                            <div className="w-20 flex justify-center">
                              <Toggle
                                checked={isEnabled}
                                onChange={() => toggleSidebarEnabled(feature)}
                                size="sm"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}


          {/* Cameras Tab */}
          {activeTab === "cameras" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <CamerasSettings />
            </div>
          )}

          {/* Home Assistant Tab */}
          {activeTab === "homeassistant" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <HomeAssistantSettings />
            </div>
          )}

          {/* AI Tab */}
          {activeTab === "ai" && (
            <AISettings />
          )}

          {/* Assumptions Tab */}
          {activeTab === "assumptions" && (
            <AssumptionsSettings />
          )}

          {/* Automations Tab */}
          {activeTab === "automations" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <AutomationsSettings />
            </div>
          )}

          {/* Kiosks Tab */}
          {activeTab === "kiosks" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <KiosksSettings />
            </div>
          )}

          {activeTab === "companion" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <CompanionSettings />
            </div>
          )}

          {/* Cloud Settings Tab */}
          {activeTab === "cloud" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <CloudSettings />
            </div>
          )}

          {/* System Settings Tab */}
          {activeTab === "system" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
              <RemarkableSettingsCard />
              <BackupRestoreCard />
              <SystemSettings />
            </div>
          )}

          {/* Billing Tab (cloud mode only) */}
          {activeTab === "billing" && (
            <div className="mx-auto max-w-2xl">
              <BillingSettings />
            </div>
          )}

          {/* Instances Tab (cloud mode only) */}
          {activeTab === "instances" && (
            <div className="mx-auto max-w-3xl">
              <InstancesSettings />
            </div>
          )}

          {/* Support Tab (cloud mode only) */}
          {activeTab === "support" && (
            <div className="mx-auto max-w-3xl">
              <SupportTab />
            </div>
          )}
        </div>
      </div>
      <SupportButton />
    </div>
  );
}
