import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type KioskConfig, type KioskDisplayMode, type KioskDisplayType, type KioskEnabledFeatures, type KioskSettings, type KioskDashboard } from "../services/api";
import { useScreensaverStore, type ScreensaverLayoutConfig, DEFAULT_LAYOUT_CONFIG } from "../stores/screensaver";
import { useCalendarStore } from "../stores/calendar";
import { useTasksStore } from "../stores/tasks";
import { useSidebarStore, type SidebarFeature } from "../stores/sidebar";
import { useAuthStore } from "../stores/auth";
import { useConnection } from "./ConnectionContext";
import type { ConnectionStatus } from "../hooks/useConnectionHealth";
import { offlineCache, CACHE_KEYS, CACHE_MAX_AGES } from "../lib/offlineCache";

interface KioskContextValue {
  token: string | null;
  config: KioskConfig | null;
  settings: KioskSettings;
  displayMode: KioskDisplayMode;
  displayType: KioskDisplayType;
  homePage: string;
  selectedCalendarIds: string[] | null;
  enabledFeatures: KioskEnabledFeatures;
  dashboards: KioskDashboard[];
  getDashboardConfig: (dashboardId: string) => Record<string, unknown>;
  startFullscreen: boolean;
  fullscreenDelayMinutes: number | null;
  isLoading: boolean;
  isAuthReady: boolean;
  error: string | null;
  // Connection status
  connectionStatus: ConnectionStatus;
  lastOnlineAt: Date | null;
  isOfflineMode: boolean;
}

// Default enabled features (all enabled)
const DEFAULT_ENABLED_FEATURES: KioskEnabledFeatures = {
  calendar: true,
  dashboard: true,
  tasks: true,
  photos: true,
  spotify: true,
  iptv: true,
  cameras: true,
  homeassistant: true,
  map: true,
  kitchen: true,
  screensaver: true,
  cardview: true,
};

const KioskContext = createContext<KioskContextValue>({
  token: null,
  config: null,
  settings: {},
  displayMode: "full",
  displayType: "touch",
  homePage: "calendar",
  selectedCalendarIds: null,
  enabledFeatures: DEFAULT_ENABLED_FEATURES,
  dashboards: [],
  getDashboardConfig: () => ({}),
  startFullscreen: false,
  fullscreenDelayMinutes: null,
  isLoading: false,
  isAuthReady: false,
  error: null,
  connectionStatus: "online",
  lastOnlineAt: null,
  isOfflineMode: false,
});

export function useKiosk() {
  return useContext(KioskContext);
}

interface KioskProviderProps {
  token: string;
  children: ReactNode;
}

export function KioskProvider({ token, children }: KioskProviderProps) {
  const [error, setError] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const setApiKey = useAuthStore((state) => state.setApiKey);

  // Delegate to global ConnectionContext (handles health checks + reconnect invalidation)
  const { connectionStatus, lastOnlineAt, isOffline: isOfflineMode } = useConnection();

  // Fetch kiosk API key for authentication
  const { data: authData, error: authError } = useQuery({
    queryKey: ["kiosk-auth", token],
    queryFn: () => api.getKioskApiKey(token),
    enabled: !!token,
    staleTime: Infinity, // Don't refetch
    retry: 1,
  });

  // Fetch kiosk config
  const { data: config, isLoading, error: fetchError } = useQuery({
    queryKey: ["kiosk-config", token],
    queryFn: async () => {
      const data = await api.getKioskByToken(token);
      // Cache config for offline use
      offlineCache.set(CACHE_KEYS.KIOSK_CONFIG, data);
      return data;
    },
    enabled: !!token,
    staleTime: 60 * 1000,
    retry: 1,
  });

  // Set up API key for authentication
  useEffect(() => {
    if (authData?.apiKey) {
      setApiKey(authData.apiKey);
      setIsAuthReady(true);
    }
  }, [authData, setApiKey]);

  useEffect(() => {
    if (config) {
      // Apply kiosk-specific screensaver settings directly to store state
      // Use setState to avoid triggering saveToServer calls
      const layoutConfig = config.screensaverLayoutConfig as ScreensaverLayoutConfig | null;
      useScreensaverStore.setState({
        enabled: config.screensaverEnabled,
        behavior: config.screensaverBehavior || "screensaver",
        idleTimeout: config.screensaverTimeout,
        slideInterval: config.screensaverInterval,
        layout: config.screensaverLayout,
        transition: config.screensaverTransition,
        colorScheme: config.colorScheme || "default",
        layoutConfig: layoutConfig && Array.isArray(layoutConfig.widgets)
          ? { ...DEFAULT_LAYOUT_CONFIG, ...layoutConfig }
          : DEFAULT_LAYOUT_CONFIG,
        synced: true,
      });

      // Apply calendar/tasks settings from dashboards (first of each type) or from legacy settings
      const dbs = config.dashboards ?? [];
      const firstCalDb = dbs.find(d => d.type === "calendar");
      const calConfig = firstCalDb?.config ?? {};
      const cal = Object.keys(calConfig).length > 0 ? calConfig : config.settings?.calendar;
      if (cal) {
        const calUpdate: Record<string, unknown> = {};
        const c = cal as Record<string, unknown>;
        if (c.weekStartsOn !== undefined) calUpdate.weekStartsOn = c.weekStartsOn;
        if (c.dayStartHour !== undefined) calUpdate.dayStartHour = c.dayStartHour;
        if (c.dayEndHour !== undefined) calUpdate.dayEndHour = c.dayEndHour;
        if (c.timeFormat !== undefined) calUpdate.timeFormat = c.timeFormat;
        if (c.tickerSpeed !== undefined) calUpdate.tickerSpeed = c.tickerSpeed;
        if (c.weekMode !== undefined) calUpdate.weekMode = c.weekMode;
        if (c.monthMode !== undefined) calUpdate.monthMode = c.monthMode;
        if (c.weekCellWidget !== undefined) calUpdate.weekCellWidget = c.weekCellWidget;
        if (c.showDriveTimeOnNext !== undefined) calUpdate.showDriveTimeOnNext = c.showDriveTimeOnNext;
        if (c.showWeekNumbers !== undefined) calUpdate.showWeekNumbers = c.showWeekNumbers;
        if (c.defaultEventDuration !== undefined) calUpdate.defaultEventDuration = c.defaultEventDuration;
        if (c.autoRefreshInterval !== undefined) calUpdate.autoRefreshInterval = c.autoRefreshInterval;
        if (c.view !== undefined) calUpdate.view = c.view;
        if (c.familyName !== undefined) calUpdate.familyName = c.familyName;
        if (c.homeAddress !== undefined) calUpdate.homeAddress = c.homeAddress;
        if (Object.keys(calUpdate).length > 0) {
          useCalendarStore.setState(calUpdate);
        }
      }

      const firstTaskDb = dbs.find(d => d.type === "tasks");
      const taskConfig = firstTaskDb?.config ?? {};
      const tasks = Object.keys(taskConfig).length > 0 ? taskConfig : config.settings?.tasks;
      if (tasks) {
        const tasksUpdate: Record<string, unknown> = {};
        const t = tasks as Record<string, unknown>;
        if (t.layout !== undefined) tasksUpdate.layout = t.layout;
        if (t.showCompleted !== undefined) tasksUpdate.showCompleted = t.showCompleted;
        if (t.expandAllLists !== undefined) tasksUpdate.expandAllLists = t.expandAllLists;
        if (Object.keys(tasksUpdate).length > 0) {
          useTasksStore.setState(tasksUpdate);
        }
      }

      // Apply per-kiosk sidebar settings
      const sidebar = config.settings?.sidebar;
      if (sidebar) {
        const features = useSidebarStore.getState().features;
        const updatedFeatures = { ...features };
        for (const [key, value] of Object.entries(sidebar)) {
          if (key in features) {
            updatedFeatures[key as SidebarFeature] = {
              enabled: value.enabled ?? features[key as SidebarFeature]?.enabled ?? true,
              pinned: value.pinned ?? features[key as SidebarFeature]?.pinned ?? false,
            };
          }
        }
        useSidebarStore.setState({ features: updatedFeatures });
      }

      // Apply color scheme to document
      document.documentElement.setAttribute("data-color-scheme", config.colorScheme || "default");
    }

    return () => {
      // Reset color scheme on unmount
      document.documentElement.removeAttribute("data-color-scheme");
    };
  }, [config]);

  useEffect(() => {
    if (fetchError || authError) {
      setError("Kiosk not found or disabled");
    }
  }, [fetchError, authError]);

  // Derive display settings from config
  const displayMode = config?.displayMode ?? "full";
  const displayType = config?.displayType ?? "touch";
  const homePage = config?.homePage ?? "calendar";
  const selectedCalendarIds = config?.selectedCalendarIds ?? null;
  const startFullscreen = config?.startFullscreen ?? false;
  const fullscreenDelayMinutes = config?.fullscreenDelayMinutes ?? null;
  const settings = config?.settings ?? {};

  // Derive dashboards from config (fall back to old fields)
  const dashboards: KioskDashboard[] = config?.dashboards ?? [];

  // Compute enabledFeatures from dashboards for backward compat
  const enabledFeatures: KioskEnabledFeatures = dashboards.length > 0
    ? Object.fromEntries(dashboards.map(db => [db.type, true])) as unknown as KioskEnabledFeatures
    : config?.enabledFeatures ?? DEFAULT_ENABLED_FEATURES;

  const getDashboardConfig = useCallback((dashboardId: string): Record<string, unknown> => {
    const db = dashboards.find(d => d.id === dashboardId);
    return db?.config ?? {};
  }, [dashboards]);

  return (
    <KioskContext.Provider
      value={{
        token,
        config: config ?? null,
        settings,
        displayMode,
        displayType,
        homePage,
        selectedCalendarIds,
        enabledFeatures,
        dashboards,
        getDashboardConfig,
        startFullscreen,
        fullscreenDelayMinutes,
        isLoading: isLoading || !isAuthReady,
        isAuthReady,
        error,
        connectionStatus,
        lastOnlineAt,
        isOfflineMode,
      }}
    >
      {children}
    </KioskContext.Provider>
  );
}
