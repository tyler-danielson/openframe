import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type KioskConfig, type KioskDisplayMode, type KioskDisplayType, type KioskEnabledFeatures } from "../services/api";
import { useScreensaverStore, type ScreensaverLayoutConfig, DEFAULT_LAYOUT_CONFIG } from "../stores/screensaver";
import { useAuthStore } from "../stores/auth";
import { useConnectionHealth, type ConnectionStatus } from "../hooks/useConnectionHealth";
import { offlineCache, CACHE_KEYS, CACHE_MAX_AGES } from "../lib/offlineCache";

interface KioskContextValue {
  token: string | null;
  config: KioskConfig | null;
  displayMode: KioskDisplayMode;
  displayType: KioskDisplayType;
  homePage: string;
  selectedCalendarIds: string[] | null;
  enabledFeatures: KioskEnabledFeatures;
  startFullscreen: boolean;
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
  recipes: true,
  screensaver: true,
};

const KioskContext = createContext<KioskContextValue>({
  token: null,
  config: null,
  displayMode: "full",
  displayType: "touch",
  homePage: "calendar",
  selectedCalendarIds: null,
  enabledFeatures: DEFAULT_ENABLED_FEATURES,
  startFullscreen: false,
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
  const setKioskStatus = useAuthStore((state) => state.setKioskStatus);
  const queryClient = useQueryClient();

  // Handle reconnection - invalidate cache and refresh data
  const handleReconnect = useCallback(() => {
    console.log("[Kiosk] Connection restored, refreshing data...");

    // Invalidate all queries to refetch fresh data
    queryClient.invalidateQueries();
  }, [queryClient]);

  // Connection health monitoring
  const { status: connectionStatus, lastOnlineAt } = useConnectionHealth({
    enabled: true,
    onReconnect: handleReconnect,
  });

  const isOfflineMode = connectionStatus !== "online";

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
      setKioskStatus(true);
      setIsAuthReady(true);
    }
  }, [authData, setApiKey, setKioskStatus]);

  useEffect(() => {
    if (config) {
      // Apply kiosk-specific screensaver settings directly to store state
      // Use setState to avoid triggering saveToServer calls
      const layoutConfig = config.screensaverLayoutConfig as ScreensaverLayoutConfig | null;
      useScreensaverStore.setState({
        enabled: config.screensaverEnabled,
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

  return (
    <KioskContext.Provider
      value={{
        token,
        config: config ?? null,
        displayMode,
        displayType,
        homePage,
        selectedCalendarIds,
        enabledFeatures,
        startFullscreen,
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
