import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api, type ColorScheme } from "../services/api";

export type ScreensaverLayout = "fullscreen" | "informational" | "quad" | "scatter" | "builder" | "skylight";
export type ScreensaverTransition = "fade" | "slide-left" | "slide-right" | "slide-up" | "slide-down" | "zoom";
export type ClockPosition = "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";
export type ClockSize = "small" | "medium" | "large" | "extra-large";
export type InfoPaneWidget = "clock" | "weather" | "forecast" | "sports" | "events" | "spotify" | "tasks" | "notes";
export type WidgetSize = "small" | "medium" | "large";
export type { ColorScheme };

// ============ Builder Widget Types (v3) ============

export type BuilderWidgetType =
  | "clock"
  | "weather"
  | "forecast"
  | "calendar"
  | "up-next"
  | "tasks"
  | "sports"
  | "spotify"
  | "ha-entity"
  | "ha-gauge"
  | "ha-graph"
  | "ha-camera"
  | "ha-map"
  | "text"
  | "image"
  | "countdown"
  | "photo-album"
  | "fullscreen-toggle"
  | "day-schedule"
  | "news"
  | "iptv"
  | "week-schedule"
  | "photo-feed"
  | "youtube"
  | "plex"
  | "plexamp"
  | "audiobookshelf"
  | "support";

export type FontSizePreset = "xs" | "sm" | "md" | "lg" | "xl" | "custom";

export interface WidgetStyle {
  backgroundColor?: string;
  textColor?: string;
  fontSize?: FontSizePreset;
  customFontSize?: string; // e.g., "24px" or "150%"
  opacity?: number;
}

export interface VisibilitySchedule {
  enabled: boolean;
  startTime: string;    // "HH:mm" format (e.g., "19:00")
  endTime: string;      // "HH:mm" format (e.g., "07:00")
  daysOfWeek: number[]; // 0-6 (0=Sun, 6=Sat), empty = all days
}

// ============ Visibility Conditions (multi-condition system) ============

export type VisibilityConditionType = "time-schedule" | "ha-entity" | "spotify-playing" | "calendar-event";
export type ComparisonOperator = "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "contains";

export interface TimeScheduleCondition {
  type: "time-schedule";
  startTime: string;     // "HH:mm"
  endTime: string;       // "HH:mm"
  daysOfWeek: number[];  // 0-6, empty = all
}

export interface HAEntityCondition {
  type: "ha-entity";
  entityId: string;
  operator: ComparisonOperator;
  value: string;
}

export interface SpotifyPlayingCondition {
  type: "spotify-playing";
  isPlaying: boolean;
}

export interface CalendarEventCondition {
  type: "calendar-event";
  hasActiveEvent: boolean;
  calendarIds?: string[];  // empty = any
}

export type VisibilityCondition = TimeScheduleCondition | HAEntityCondition | SpotifyPlayingCondition | CalendarEventCondition;

export interface VisibilityConfig {
  enabled: boolean;
  logic: "all" | "any";  // AND vs OR, default "all"
  conditions: VisibilityCondition[];
}

export interface WidgetInstance {
  id: string;
  type: BuilderWidgetType;
  x: number; // Grid column (0-based)
  y: number; // Grid row (0-based)
  width: number; // Columns spanned
  height: number; // Rows spanned
  config: Record<string, unknown>; // Type-specific settings
  style?: WidgetStyle;
  visibility?: VisibilitySchedule;
  visibilityConditions?: VisibilityConfig;  // Multi-condition system, takes precedence over legacy `visibility`
  hidden?: boolean; // Toggle visibility in layers panel
}

export type CanvasSizeMode = "fill" | "aspectRatio" | "pixels";
export type AspectRatioPreset = "16:9" | "16:10" | "4:3" | "21:9" | "32:9" | "9:16" | "3:4" | "custom";

export const ASPECT_RATIO_PRESETS: { id: AspectRatioPreset; label: string; ratio: number; description: string }[] = [
  { id: "16:9", label: "16:9", ratio: 16 / 9, description: "HD/4K TV (1920×1080)" },
  { id: "16:10", label: "16:10", ratio: 16 / 10, description: "Widescreen monitor" },
  { id: "4:3", label: "4:3", ratio: 4 / 3, description: "Classic monitor/iPad" },
  { id: "21:9", label: "21:9", ratio: 21 / 9, description: "Ultrawide monitor" },
  { id: "32:9", label: "32:9", ratio: 32 / 9, description: "Super ultrawide" },
  { id: "9:16", label: "9:16", ratio: 9 / 16, description: "Portrait phone" },
  { id: "3:4", label: "3:4", ratio: 3 / 4, description: "Portrait tablet" },
  { id: "custom", label: "Custom", ratio: 16 / 9, description: "Custom dimensions" },
];

export interface ScreensaverLayoutConfig {
  gridColumns: number; // Default: 12
  gridRows: number; // Default: 8
  gridGap: number; // Default: 8px
  backgroundColor: string;
  backgroundImage?: string;
  widgets: WidgetInstance[];
  // Canvas size settings
  canvasSizeMode: CanvasSizeMode; // Default: "fill"
  aspectRatio: AspectRatioPreset; // Default: "16:9"
  canvasWidth: number; // Default: 1920 (used for "pixels" mode or custom aspect ratio)
  canvasHeight: number; // Default: 1080
}

// Grid presets following 16:9 aspect ratio
export const GRID_PRESETS = [
  { id: "16x9", label: "16×9", columns: 16, rows: 9, description: "Standard" },
  { id: "32x18", label: "32×18", columns: 32, rows: 18, description: "Fine" },
  { id: "64x36", label: "64×36", columns: 64, rows: 36, description: "Very Fine" },
  { id: "128x72", label: "128×72", columns: 128, rows: 72, description: "Ultra Fine" },
] as const;

export type GridPreset = typeof GRID_PRESETS[number]["id"];

export const DEFAULT_LAYOUT_CONFIG: ScreensaverLayoutConfig = {
  gridColumns: 16,
  gridRows: 9,
  gridGap: 8,
  backgroundColor: "#000000",
  widgets: [],
  canvasSizeMode: "fill",
  aspectRatio: "16:9",
  canvasWidth: 1920,
  canvasHeight: 1080,
};

export type WidgetGridSize = 1 | 2 | 3;

export interface InfoPaneWidgetConfig {
  id: InfoPaneWidget;
  enabled: boolean;
  size: WidgetSize;
  maxItems?: number; // For list widgets: events, sports, tasks
  // Grid positioning
  col?: number; // Column position (0-based)
  row?: number; // Row position (0-based)
  colSpan?: number; // Number of columns to span (default 1)
  rowSpan?: number; // Number of rows to span (default 1)
}

// Widgets that support maxItems configuration
export const LIST_WIDGETS: InfoPaneWidget[] = ["events", "sports", "tasks"];

// Default widget configurations (legacy - kept for migration)
export const DEFAULT_WIDGET_CONFIGS: InfoPaneWidgetConfig[] = [
  { id: "clock", enabled: true, size: "medium", col: 0, row: 0, colSpan: 1, rowSpan: 1 },
  { id: "weather", enabled: true, size: "medium", col: 1, row: 0, colSpan: 1, rowSpan: 1 },
  { id: "sports", enabled: true, size: "medium", maxItems: 3, col: 2, row: 0, colSpan: 1, rowSpan: 1 },
  { id: "events", enabled: true, size: "medium", maxItems: 3, col: 0, row: 1, colSpan: 1, rowSpan: 1 },
  { id: "spotify", enabled: false, size: "medium", col: 1, row: 1, colSpan: 1, rowSpan: 1 },
  { id: "tasks", enabled: false, size: "medium", maxItems: 3, col: 2, row: 1, colSpan: 1, rowSpan: 1 },
  { id: "forecast", enabled: false, size: "small", col: 0, row: 2, colSpan: 1, rowSpan: 1 },
  { id: "notes", enabled: false, size: "small", col: 1, row: 2, colSpan: 1, rowSpan: 1 },
];

// ============ Composite Widget Types (v2) ============

export type CompositeWidgetId = "clock" | "weather" | "schedule" | "media" | "controls";

export interface SubItemConfig {
  enabled: boolean;
  maxItems?: number; // For events, sports, tasks
}

export interface CompositeWidgetConfig {
  id: CompositeWidgetId;
  enabled: boolean;
  size: WidgetSize;
  col?: number;
  row?: number;
  colSpan?: number;
  rowSpan?: number;
  subItems?: Record<string, SubItemConfig>;
}

// Default sub-items for each composite widget
export const DEFAULT_SUB_ITEMS: Record<CompositeWidgetId, Record<string, SubItemConfig>> = {
  clock: {},
  weather: {
    current: { enabled: true },
    forecast: { enabled: true },
  },
  schedule: {
    events: { enabled: true, maxItems: 3 },
    sports: { enabled: true, maxItems: 3 },
    tasks: { enabled: true, maxItems: 3 },
  },
  media: {
    spotify: { enabled: true },
  },
  controls: {},
};

// Default composite widget configurations
export const DEFAULT_COMPOSITE_CONFIGS: CompositeWidgetConfig[] = [
  { id: "clock", enabled: true, size: "medium", col: 0, row: 0, colSpan: 1, rowSpan: 1, subItems: { ...DEFAULT_SUB_ITEMS.clock } },
  { id: "weather", enabled: true, size: "medium", col: 1, row: 0, colSpan: 1, rowSpan: 1, subItems: { ...DEFAULT_SUB_ITEMS.weather } },
  { id: "schedule", enabled: true, size: "medium", col: 0, row: 1, colSpan: 2, rowSpan: 1, subItems: { ...DEFAULT_SUB_ITEMS.schedule } },
  { id: "media", enabled: false, size: "medium", col: 2, row: 0, colSpan: 1, rowSpan: 1, subItems: { ...DEFAULT_SUB_ITEMS.media } },
  { id: "controls", enabled: false, size: "medium", col: 2, row: 1, colSpan: 1, rowSpan: 1, subItems: { ...DEFAULT_SUB_ITEMS.controls } },
];

export type ScreensaverBehavior = "screensaver" | "hide-toolbar";

interface ScreensaverState {
  // Settings
  enabled: boolean;
  behavior: ScreensaverBehavior;
  idleTimeout: number; // seconds before screensaver starts
  slideInterval: number; // seconds between slides
  layout: ScreensaverLayout;
  transition: ScreensaverTransition;
  colorScheme: ColorScheme;
  synced: boolean; // whether settings have been synced from server

  // Night dim settings
  nightDimEnabled: boolean;
  nightDimStartHour: number; // 0-23 hour when dimming starts
  nightDimEndHour: number; // 0-23 hour when dimming ends
  nightDimOpacity: number; // 0-100 percentage of dimming
  nightDimFadeDuration: number; // minutes to fade to full dim

  // Clock settings
  clockPosition: ClockPosition;
  clockSize: ClockSize;

  // Info pane widgets (for informational layout)
  infoPaneWidgets: InfoPaneWidget[]; // Legacy - kept for migration
  infoPaneWidgetConfigs: InfoPaneWidgetConfig[]; // Legacy - kept for migration
  widgetGridSize: WidgetGridSize;

  // Composite widgets (v2)
  compositeWidgetConfigs: CompositeWidgetConfig[];

  // Builder layout config (v3)
  layoutConfig: ScreensaverLayoutConfig;
  selectedWidgetId: string | null;
  gridSnap: boolean; // Whether to snap widgets to grid cells

  // Runtime state
  isActive: boolean;
  lastActivity: number;

  // Actions
  setEnabled: (enabled: boolean) => void;
  setBehavior: (behavior: ScreensaverBehavior) => void;
  setIdleTimeout: (timeout: number) => void;
  setSlideInterval: (interval: number) => void;
  setLayout: (layout: ScreensaverLayout) => void;
  setTransition: (transition: ScreensaverTransition) => void;
  setColorScheme: (colorScheme: ColorScheme) => void;
  setNightDimEnabled: (enabled: boolean) => void;
  setNightDimStartHour: (hour: number) => void;
  setNightDimEndHour: (hour: number) => void;
  setNightDimOpacity: (opacity: number) => void;
  setNightDimFadeDuration: (duration: number) => void;
  setClockPosition: (position: ClockPosition) => void;
  setClockSize: (size: ClockSize) => void;
  setInfoPaneWidgets: (widgets: InfoPaneWidget[]) => void;
  setInfoPaneWidgetConfigs: (configs: InfoPaneWidgetConfig[]) => void;
  updateWidgetConfig: (id: InfoPaneWidget, updates: Partial<InfoPaneWidgetConfig>) => void;
  reorderWidgets: (fromIndex: number, toIndex: number) => void;
  setWidgetGridSize: (size: WidgetGridSize) => void;
  moveWidgetToCell: (id: InfoPaneWidget, col: number, row: number) => void;
  // Composite widget actions (v2)
  setCompositeWidgetConfigs: (configs: CompositeWidgetConfig[]) => void;
  updateCompositeWidgetConfig: (id: CompositeWidgetId, updates: Partial<CompositeWidgetConfig>) => void;
  updateSubItemConfig: (widgetId: CompositeWidgetId, subItemId: string, updates: Partial<SubItemConfig>) => void;
  reorderCompositeWidgets: (fromIndex: number, toIndex: number) => void;
  // Builder layout actions (v3)
  setLayoutConfig: (config: Partial<ScreensaverLayoutConfig>) => void;
  addWidget: (widget: Omit<WidgetInstance, "id">) => string;
  updateBuilderWidget: (id: string, updates: Partial<Omit<WidgetInstance, "id">>) => void;
  removeWidget: (id: string) => void;
  moveWidget: (id: string, x: number, y: number) => void;
  resizeWidget: (id: string, width: number, height: number) => void;
  selectWidget: (id: string | null) => void;
  duplicateWidget: (id: string) => string | null;
  bringWidgetForward: (id: string) => void;
  sendWidgetBackward: (id: string) => void;
  bringWidgetToFront: (id: string) => void;
  sendWidgetToBack: (id: string) => void;
  toggleWidgetVisibility: (id: string) => void;
  setGridSnap: (snap: boolean) => void;
  setActive: (active: boolean) => void;
  updateActivity: () => void;
  syncFromServer: () => Promise<void>;
  saveToServer: () => Promise<void>;
}

export const useScreensaverStore = create<ScreensaverState>()(
  persist(
    (set, get) => ({
      // Settings (persisted)
      enabled: true,
      behavior: "screensaver" as ScreensaverBehavior,
      idleTimeout: 300, // 5 minutes default
      slideInterval: 15, // 15 seconds default
      layout: "fullscreen",
      transition: "fade",
      colorScheme: "default",
      synced: false,

      // Night dim settings (persisted)
      nightDimEnabled: false,
      nightDimStartHour: 21, // 9 PM default
      nightDimEndHour: 7, // 7 AM default
      nightDimOpacity: 50, // 50% dimming default
      nightDimFadeDuration: 15, // 15 minutes fade default

      // Clock settings (persisted)
      clockPosition: "top-right" as ClockPosition,
      clockSize: "medium" as ClockSize,

      // Info pane widgets (persisted) - default widgets for informational layout
      infoPaneWidgets: ["clock", "weather", "sports", "events"] as InfoPaneWidget[], // Legacy
      infoPaneWidgetConfigs: DEFAULT_WIDGET_CONFIGS, // Legacy
      widgetGridSize: 3 as WidgetGridSize,

      // Composite widgets (v2)
      compositeWidgetConfigs: DEFAULT_COMPOSITE_CONFIGS,

      // Builder layout config (v3)
      layoutConfig: DEFAULT_LAYOUT_CONFIG,
      selectedWidgetId: null,
      gridSnap: true, // Snap to grid by default

      // Runtime state (not persisted)
      isActive: false,
      lastActivity: Date.now(),

      setEnabled: (enabled) => {
        set({ enabled });
        get().saveToServer();
      },
      setBehavior: (behavior) => {
        set({ behavior });
        get().saveToServer();
      },
      setIdleTimeout: (idleTimeout) => {
        set({ idleTimeout });
        get().saveToServer();
      },
      setSlideInterval: (slideInterval) => {
        set({ slideInterval });
        get().saveToServer();
      },
      setLayout: (layout) => {
        set({ layout });
        get().saveToServer();
      },
      setTransition: (transition) => {
        set({ transition });
        get().saveToServer();
      },
      setColorScheme: (colorScheme) => {
        set({ colorScheme });
        // Apply color scheme to document
        document.documentElement.setAttribute("data-color-scheme", colorScheme);
        get().saveToServer();
      },
      setNightDimEnabled: (nightDimEnabled) => {
        set({ nightDimEnabled });
        get().saveToServer();
      },
      setNightDimStartHour: (nightDimStartHour) => {
        set({ nightDimStartHour });
        get().saveToServer();
      },
      setNightDimEndHour: (nightDimEndHour) => {
        set({ nightDimEndHour });
        get().saveToServer();
      },
      setNightDimOpacity: (nightDimOpacity) => {
        set({ nightDimOpacity });
        get().saveToServer();
      },
      setNightDimFadeDuration: (nightDimFadeDuration) => {
        set({ nightDimFadeDuration });
        get().saveToServer();
      },
      setClockPosition: (clockPosition) => {
        set({ clockPosition });
        get().saveToServer();
      },
      setClockSize: (clockSize) => {
        set({ clockSize });
        get().saveToServer();
      },
      setInfoPaneWidgets: (infoPaneWidgets) => {
        set({ infoPaneWidgets });
        get().saveToServer();
      },
      setInfoPaneWidgetConfigs: (infoPaneWidgetConfigs) => {
        set({ infoPaneWidgetConfigs });
        get().saveToServer();
      },
      updateWidgetConfig: (id, updates) => {
        const configs = get().infoPaneWidgetConfigs;
        const newConfigs = configs.map((config) =>
          config.id === id ? { ...config, ...updates } : config
        );
        set({ infoPaneWidgetConfigs: newConfigs });
        get().saveToServer();
      },
      reorderWidgets: (fromIndex, toIndex) => {
        const configs = [...get().infoPaneWidgetConfigs];
        const [removed] = configs.splice(fromIndex, 1);
        if (removed) {
          configs.splice(toIndex, 0, removed);
          set({ infoPaneWidgetConfigs: configs });
          get().saveToServer();
        }
      },
      setWidgetGridSize: (widgetGridSize) => {
        set({ widgetGridSize });
        get().saveToServer();
      },
      moveWidgetToCell: (id, col, row) => {
        const configs = get().infoPaneWidgetConfigs;
        const newConfigs = configs.map((config) =>
          config.id === id ? { ...config, col, row } : config
        );
        set({ infoPaneWidgetConfigs: newConfigs });
        get().saveToServer();
      },
      // Composite widget actions (v2)
      setCompositeWidgetConfigs: (compositeWidgetConfigs) => {
        set({ compositeWidgetConfigs });
        get().saveToServer();
      },
      updateCompositeWidgetConfig: (id, updates) => {
        const configs = get().compositeWidgetConfigs;
        const newConfigs = configs.map((config) =>
          config.id === id ? { ...config, ...updates } : config
        );
        set({ compositeWidgetConfigs: newConfigs });
        get().saveToServer();
      },
      updateSubItemConfig: (widgetId, subItemId, updates) => {
        const configs = get().compositeWidgetConfigs;
        const newConfigs = configs.map((config) => {
          if (config.id !== widgetId) return config;
          const currentSubItems = config.subItems ?? {};
          const currentSubItem = currentSubItems[subItemId] ?? { enabled: true };
          return {
            ...config,
            subItems: {
              ...currentSubItems,
              [subItemId]: { ...currentSubItem, ...updates },
            },
          };
        });
        set({ compositeWidgetConfigs: newConfigs });
        get().saveToServer();
      },
      reorderCompositeWidgets: (fromIndex, toIndex) => {
        const configs = [...get().compositeWidgetConfigs];
        const [removed] = configs.splice(fromIndex, 1);
        if (removed) {
          configs.splice(toIndex, 0, removed);
          set({ compositeWidgetConfigs: configs });
          get().saveToServer();
        }
      },
      // Builder layout actions (v3)
      setLayoutConfig: (config) => {
        const currentConfig = get().layoutConfig;
        set({ layoutConfig: { ...currentConfig, ...config } });
        get().saveToServer();
      },
      addWidget: (widget) => {
        console.log("[Screensaver] addWidget called with:", widget);
        const id = `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newWidget: WidgetInstance = { ...widget, id };
        const layoutConfig = get().layoutConfig;
        const widgets = layoutConfig.widgets || [];
        console.log("[Screensaver] Current widgets:", widgets.length, "Adding new widget:", newWidget);
        set({
          layoutConfig: {
            ...layoutConfig,
            widgets: [...widgets, newWidget],
          },
          selectedWidgetId: id,
        });
        console.log("[Screensaver] After set, widgets:", get().layoutConfig.widgets?.length);
        get().saveToServer();
        return id;
      },
      updateBuilderWidget: (id, updates) => {
        const layoutConfig = get().layoutConfig;
        const widgets = layoutConfig.widgets || [];
        const newWidgets = widgets.map((w) =>
          w.id === id ? { ...w, ...updates } : w
        );
        set({ layoutConfig: { ...layoutConfig, widgets: newWidgets } });
        get().saveToServer();
      },
      removeWidget: (id) => {
        const layoutConfig = get().layoutConfig;
        const widgets = layoutConfig.widgets || [];
        const newWidgets = widgets.filter((w) => w.id !== id);
        const selectedWidgetId = get().selectedWidgetId;
        set({
          layoutConfig: { ...layoutConfig, widgets: newWidgets },
          selectedWidgetId: selectedWidgetId === id ? null : selectedWidgetId,
        });
        get().saveToServer();
      },
      moveWidget: (id, x, y) => {
        const layoutConfig = get().layoutConfig;
        const widgets = layoutConfig.widgets || [];
        const newWidgets = widgets.map((w) =>
          w.id === id ? { ...w, x, y } : w
        );
        set({ layoutConfig: { ...layoutConfig, widgets: newWidgets } });
        get().saveToServer();
      },
      resizeWidget: (id, width, height) => {
        const layoutConfig = get().layoutConfig;
        const widgets = layoutConfig.widgets || [];
        const newWidgets = widgets.map((w) =>
          w.id === id ? { ...w, width, height } : w
        );
        set({ layoutConfig: { ...layoutConfig, widgets: newWidgets } });
        get().saveToServer();
      },
      selectWidget: (id) => {
        set({ selectedWidgetId: id });
      },
      duplicateWidget: (id) => {
        const layoutConfig = get().layoutConfig;
        const widgets = layoutConfig.widgets || [];
        const widget = widgets.find((w) => w.id === id);
        if (!widget) return null;
        const newId = `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const gridColumns = layoutConfig.gridColumns || 12;
        const gridRows = layoutConfig.gridRows || 8;
        const newWidget: WidgetInstance = {
          ...widget,
          id: newId,
          x: Math.min(widget.x + 1, gridColumns - widget.width),
          y: Math.min(widget.y + 1, gridRows - widget.height),
        };
        set({
          layoutConfig: {
            ...layoutConfig,
            widgets: [...widgets, newWidget],
          },
          selectedWidgetId: newId,
        });
        get().saveToServer();
        return newId;
      },
      bringWidgetForward: (id) => {
        const layoutConfig = get().layoutConfig;
        const sourceWidgets = layoutConfig.widgets || [];
        const widgets = [...sourceWidgets];
        const index = widgets.findIndex((w) => w.id === id);
        if (index === -1 || index === widgets.length - 1) return;
        const current = widgets[index];
        const next = widgets[index + 1];
        if (current && next) {
          widgets[index] = next;
          widgets[index + 1] = current;
        }
        set({ layoutConfig: { ...layoutConfig, widgets } });
        get().saveToServer();
      },
      sendWidgetBackward: (id) => {
        const layoutConfig = get().layoutConfig;
        const sourceWidgets = layoutConfig.widgets || [];
        const widgets = [...sourceWidgets];
        const index = widgets.findIndex((w) => w.id === id);
        if (index <= 0) return;
        const current = widgets[index];
        const prev = widgets[index - 1];
        if (current && prev) {
          widgets[index] = prev;
          widgets[index - 1] = current;
        }
        set({ layoutConfig: { ...layoutConfig, widgets } });
        get().saveToServer();
      },
      bringWidgetToFront: (id) => {
        const layoutConfig = get().layoutConfig;
        const sourceWidgets = layoutConfig.widgets || [];
        const widgets = sourceWidgets.filter((w) => w.id !== id);
        const widget = sourceWidgets.find((w) => w.id === id);
        if (!widget) return;
        set({ layoutConfig: { ...layoutConfig, widgets: [...widgets, widget] } });
        get().saveToServer();
      },
      sendWidgetToBack: (id) => {
        const layoutConfig = get().layoutConfig;
        const sourceWidgets = layoutConfig.widgets || [];
        const widgets = sourceWidgets.filter((w) => w.id !== id);
        const widget = sourceWidgets.find((w) => w.id === id);
        if (!widget) return;
        set({ layoutConfig: { ...layoutConfig, widgets: [widget, ...widgets] } });
        get().saveToServer();
      },
      toggleWidgetVisibility: (id) => {
        const layoutConfig = get().layoutConfig;
        const widgets = layoutConfig.widgets || [];
        const newWidgets = widgets.map((w) =>
          w.id === id ? { ...w, hidden: !w.hidden } : w
        );
        set({ layoutConfig: { ...layoutConfig, widgets: newWidgets } });
        get().saveToServer();
      },
      setGridSnap: (gridSnap) => set({ gridSnap }),
      setActive: (isActive) => set({ isActive }),
      updateActivity: () => set({ lastActivity: Date.now(), isActive: false }),

      syncFromServer: async () => {
        try {
          const settings = await api.getScreensaverSettings();
          const updates: Partial<ScreensaverState> = {
            enabled: settings.enabled,
            idleTimeout: settings.timeout,
            slideInterval: settings.interval,
            layout: settings.layout,
            transition: settings.transition,
            colorScheme: settings.colorScheme || "default",
            synced: true,
          };
          // Load layoutConfig if available from server (only if it has widgets)
          if (settings.layoutConfig && Array.isArray((settings.layoutConfig as unknown as ScreensaverLayoutConfig).widgets)) {
            // Merge with defaults to ensure all required properties exist
            updates.layoutConfig = {
              ...DEFAULT_LAYOUT_CONFIG,
              ...(settings.layoutConfig as unknown as ScreensaverLayoutConfig),
            };
          }
          set(updates);
          // Apply color scheme to document
          document.documentElement.setAttribute("data-color-scheme", settings.colorScheme || "default");
        } catch (error) {
          console.error("Failed to sync screensaver settings:", error);
        }
      },

      saveToServer: async () => {
        const state = get();
        console.log("[Screensaver] Saving to server, layoutConfig:", JSON.stringify(state.layoutConfig));
        try {
          await api.updateScreensaverSettings({
            enabled: state.enabled,
            timeout: state.idleTimeout,
            interval: state.slideInterval,
            layout: state.layout,
            transition: state.transition,
            colorScheme: state.colorScheme,
            layoutConfig: state.layoutConfig as unknown as Record<string, unknown>,
          });
          console.log("[Screensaver] Saved successfully");
        } catch (error) {
          console.error("[Screensaver] Failed to save screensaver settings:", error);
        }
      },
    }),
    {
      name: "screensaver-store",
      version: 3, // Bump version for builder layout config
      partialize: (state) => ({
        enabled: state.enabled,
        behavior: state.behavior,
        idleTimeout: state.idleTimeout,
        slideInterval: state.slideInterval,
        layout: state.layout,
        transition: state.transition,
        colorScheme: state.colorScheme,
        nightDimEnabled: state.nightDimEnabled,
        nightDimStartHour: state.nightDimStartHour,
        nightDimEndHour: state.nightDimEndHour,
        nightDimOpacity: state.nightDimOpacity,
        nightDimFadeDuration: state.nightDimFadeDuration,
        clockPosition: state.clockPosition,
        clockSize: state.clockSize,
        infoPaneWidgets: state.infoPaneWidgets,
        infoPaneWidgetConfigs: state.infoPaneWidgetConfigs,
        widgetGridSize: state.widgetGridSize,
        compositeWidgetConfigs: state.compositeWidgetConfigs,
        layoutConfig: state.layoutConfig,
      }),
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>;

        // Migration from version 0 (no version) to version 1
        if (version === 0 || !state.infoPaneWidgetConfigs) {
          // Migrate from old infoPaneWidgets array to new config format
          const oldWidgets = (state.infoPaneWidgets as InfoPaneWidget[] | undefined) || [];

          // Start with default configs
          const newConfigs: InfoPaneWidgetConfig[] = DEFAULT_WIDGET_CONFIGS.map((defaultConfig) => {
            // If the widget was in the old array, mark it as enabled
            const wasEnabled = oldWidgets.includes(defaultConfig.id);
            return {
              ...defaultConfig,
              enabled: wasEnabled,
            };
          });

          // Reorder to match the old widget order (enabled widgets first, in their original order)
          const enabledConfigs = oldWidgets
            .map((widgetId) => newConfigs.find((c) => c.id === widgetId))
            .filter((c): c is InfoPaneWidgetConfig => c !== undefined);
          const disabledConfigs = newConfigs.filter((c) => !oldWidgets.includes(c.id));

          state.infoPaneWidgetConfigs = [...enabledConfigs, ...disabledConfigs];
        }

        // Migration from version 1 to version 2: migrate infoPaneWidgetConfigs to compositeWidgetConfigs
        if (version <= 1 || !state.compositeWidgetConfigs) {
          const oldConfigs = state.infoPaneWidgetConfigs as InfoPaneWidgetConfig[] | undefined;

          if (oldConfigs && oldConfigs.length > 0) {
            // Map old widgets to composite widgets
            // clock -> clock
            // weather -> weather.current
            // forecast -> weather.forecast
            // events -> schedule.events
            // sports -> schedule.sports
            // tasks -> schedule.tasks
            // spotify -> media.spotify
            // notes -> removed

            const clockOld = oldConfigs.find((c) => c.id === "clock");
            const weatherOld = oldConfigs.find((c) => c.id === "weather");
            const forecastOld = oldConfigs.find((c) => c.id === "forecast");
            const eventsOld = oldConfigs.find((c) => c.id === "events");
            const sportsOld = oldConfigs.find((c) => c.id === "sports");
            const tasksOld = oldConfigs.find((c) => c.id === "tasks");
            const spotifyOld = oldConfigs.find((c) => c.id === "spotify");

            const compositeConfigs: CompositeWidgetConfig[] = [
              {
                id: "clock",
                enabled: clockOld?.enabled ?? true,
                size: clockOld?.size ?? "medium",
                col: 0,
                row: 0,
                colSpan: 1,
                rowSpan: 1,
                subItems: {},
              },
              {
                id: "weather",
                enabled: (weatherOld?.enabled || forecastOld?.enabled) ?? true,
                size: weatherOld?.size ?? forecastOld?.size ?? "medium",
                col: 1,
                row: 0,
                colSpan: 1,
                rowSpan: 1,
                subItems: {
                  current: { enabled: weatherOld?.enabled ?? true },
                  forecast: { enabled: forecastOld?.enabled ?? true },
                },
              },
              {
                id: "schedule",
                enabled: (eventsOld?.enabled || sportsOld?.enabled || tasksOld?.enabled) ?? true,
                size: eventsOld?.size ?? sportsOld?.size ?? tasksOld?.size ?? "medium",
                col: 0,
                row: 1,
                colSpan: 2,
                rowSpan: 1,
                subItems: {
                  events: { enabled: eventsOld?.enabled ?? true, maxItems: eventsOld?.maxItems ?? 3 },
                  sports: { enabled: sportsOld?.enabled ?? true, maxItems: sportsOld?.maxItems ?? 3 },
                  tasks: { enabled: tasksOld?.enabled ?? false, maxItems: tasksOld?.maxItems ?? 3 },
                },
              },
              {
                id: "media",
                enabled: spotifyOld?.enabled ?? false,
                size: spotifyOld?.size ?? "medium",
                col: 2,
                row: 0,
                colSpan: 1,
                rowSpan: 1,
                subItems: {
                  spotify: { enabled: spotifyOld?.enabled ?? true },
                },
              },
            ];

            state.compositeWidgetConfigs = compositeConfigs;
          } else {
            // No old configs, use defaults
            state.compositeWidgetConfigs = DEFAULT_COMPOSITE_CONFIGS;
          }
        }

        // Migration from version 2 to version 3: add layoutConfig
        if (version <= 2 || !state.layoutConfig) {
          // Convert existing composite widgets to builder layout
          const compositeConfigs = state.compositeWidgetConfigs as CompositeWidgetConfig[] | undefined;
          const widgets: WidgetInstance[] = [];

          if (compositeConfigs && compositeConfigs.length > 0) {
            let widgetIndex = 0;
            for (const config of compositeConfigs) {
              if (!config.enabled) continue;

              if (config.id === "clock") {
                widgets.push({
                  id: `widget-migrated-${widgetIndex++}`,
                  type: "clock",
                  x: 0,
                  y: 0,
                  width: 3,
                  height: 2,
                  config: {},
                });
              } else if (config.id === "weather") {
                if (config.subItems?.current?.enabled !== false) {
                  widgets.push({
                    id: `widget-migrated-${widgetIndex++}`,
                    type: "weather",
                    x: 3,
                    y: 0,
                    width: 3,
                    height: 2,
                    config: {},
                  });
                }
                if (config.subItems?.forecast?.enabled) {
                  widgets.push({
                    id: `widget-migrated-${widgetIndex++}`,
                    type: "forecast",
                    x: 6,
                    y: 0,
                    width: 3,
                    height: 2,
                    config: {},
                  });
                }
              } else if (config.id === "schedule") {
                if (config.subItems?.events?.enabled !== false) {
                  widgets.push({
                    id: `widget-migrated-${widgetIndex++}`,
                    type: "calendar",
                    x: 0,
                    y: 2,
                    width: 4,
                    height: 3,
                    config: { maxItems: config.subItems?.events?.maxItems ?? 3 },
                  });
                }
                if (config.subItems?.sports?.enabled !== false) {
                  widgets.push({
                    id: `widget-migrated-${widgetIndex++}`,
                    type: "sports",
                    x: 4,
                    y: 2,
                    width: 4,
                    height: 3,
                    config: { maxItems: config.subItems?.sports?.maxItems ?? 3 },
                  });
                }
                if (config.subItems?.tasks?.enabled) {
                  widgets.push({
                    id: `widget-migrated-${widgetIndex++}`,
                    type: "tasks",
                    x: 8,
                    y: 2,
                    width: 4,
                    height: 3,
                    config: { maxItems: config.subItems?.tasks?.maxItems ?? 3 },
                  });
                }
              } else if (config.id === "media") {
                if (config.subItems?.spotify?.enabled !== false) {
                  widgets.push({
                    id: `widget-migrated-${widgetIndex++}`,
                    type: "spotify",
                    x: 9,
                    y: 0,
                    width: 3,
                    height: 2,
                    config: {},
                  });
                }
              }
            }
          }

          state.layoutConfig = {
            ...DEFAULT_LAYOUT_CONFIG,
            widgets,
          };
        }

        // Ensure layoutConfig has all required properties (fix incomplete server data)
        if (state.layoutConfig) {
          state.layoutConfig = {
            ...DEFAULT_LAYOUT_CONFIG,
            ...state.layoutConfig,
            widgets: (state.layoutConfig as ScreensaverLayoutConfig).widgets || [],
          };
        }

        return state as unknown as ScreensaverState;
      },
      onRehydrateStorage: () => (state) => {
        // Apply color scheme on hydration
        if (state?.colorScheme) {
          document.documentElement.setAttribute("data-color-scheme", state.colorScheme);
        }
      },
    }
  )
);
