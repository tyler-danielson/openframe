import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type KioskConfig } from "../services/api";
import { useScreensaverStore, type ScreensaverLayoutConfig, DEFAULT_LAYOUT_CONFIG } from "../stores/screensaver";
import { useAuthStore } from "../stores/auth";

interface KioskContextValue {
  token: string | null;
  config: KioskConfig | null;
  isLoading: boolean;
  isAuthReady: boolean;
  error: string | null;
}

const KioskContext = createContext<KioskContextValue>({
  token: null,
  config: null,
  isLoading: false,
  isAuthReady: false,
  error: null,
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
    queryFn: () => api.getKioskByToken(token),
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

  return (
    <KioskContext.Provider
      value={{
        token,
        config: config ?? null,
        isLoading: isLoading || !isAuthReady,
        isAuthReady,
        error,
      }}
    >
      {children}
    </KioskContext.Provider>
  );
}
