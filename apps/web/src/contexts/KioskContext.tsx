import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type KioskConfig, type KioskDisplayMode, type KioskDisplayType, type KioskEnabledFeatures, type KioskSettings } from "../services/api";
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

      // Apply per-kiosk calendar settings
      const cal = config.settings?.calendar;
      if (cal) {
        const calUpdate: Record<string, unknown> = {};
        if (cal.weekStartsOn !== undefined) calUpdate.weekStartsOn = cal.weekStartsOn;
        if (cal.dayStartHour !== undefined) calUpdate.dayStartHour = cal.dayStartHour;
        if (cal.dayEndHour !== undefined) calUpdate.dayEndHour = cal.dayEndHour;
        if (cal.timeFormat !== undefined) calUpdate.timeFormat = cal.timeFormat;
        if (cal.tickerSpeed !== undefined) calUpdate.tickerSpeed = cal.tickerSpeed;
        if (cal.weekMode !== undefined) calUpdate.weekMode = cal.weekMode;
        if (cal.monthMode !== undefined) calUpdate.monthMode = cal.monthMode;
        if (cal.weekCellWidget !== undefined) calUpdate.weekCellWidget = cal.weekCellWidget;
        if (cal.showDriveTimeOnNext !== undefined) calUpdate.showDriveTimeOnNext = cal.showDriveTimeOnNext;
        if (cal.showWeekNumbers !== undefined) calUpdate.showWeekNumbers = cal.showWeekNumbers;
        if (cal.defaultEventDuration !== undefined) calUpdate.defaultEventDuration = cal.defaultEventDuration;
        if (cal.autoRefreshInterval !== undefined) calUpdate.autoRefreshInterval = cal.autoRefreshInterval;
        if (cal.view !== undefined) calUpdate.view = cal.view;
        if (cal.familyName !== undefined) calUpdate.familyName = cal.familyName;
        if (cal.homeAddress !== undefined) calUpdate.homeAddress = cal.homeAddress;
        if (Object.keys(calUpdate).length > 0) {
          useCalendarStore.setState(calUpdate);
        }
      }

      // Apply per-kiosk tasks settings
      const tasks = config.settings?.tasks;
      if (tasks) {
        const tasksUpdate: Record<string, unknown> = {};
        if (tasks.layout !== undefined) tasksUpdate.layout = tasks.layout;
        if (tasks.showCompleted !== undefined) tasksUpdate.showCompleted = tasks.showCompleted;
        if (tasks.expandAllLists !== undefined) tasksUpdate.expandAllLists = tasks.expandAllLists;
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
  const enabledFeatures = config?.enabledFeatures ?? DEFAULT_ENABLED_FEATURES;
  const startFullscreen = config?.startFullscreen ?? false;
  const fullscreenDelayMinutes = config?.fullscreenDelayMinutes ?? null;
  const settings = config?.settings ?? {};

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
