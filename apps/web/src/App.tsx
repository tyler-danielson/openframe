import { useEffect, useRef } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "./stores/auth";
import { useScreensaverStore } from "./stores/screensaver";
import { Layout } from "./components/ui/Layout";
import { LoginPage } from "./pages/LoginPage";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { DashboardPage } from "./pages/DashboardPage";
import { CalendarPage } from "./pages/CalendarPage";
import { TasksPage } from "./pages/TasksPage";
import { PhotosPage } from "./pages/PhotosPage";
import { SettingsPage } from "./pages/SettingsPage";
import { IptvPage } from "./pages/IptvPage";
import { CamerasPage } from "./pages/CamerasPage";
import { MultiViewPage } from "./pages/MultiViewPage";
import { HomeAssistantPage } from "./pages/HomeAssistantPage";
import { SpotifyPage } from "./pages/SpotifyPage";
import { MapPage } from "./pages/MapPage";
import { MobileUploadPage } from "./pages/MobileUploadPage";
import { RemarkablePage } from "./pages/RemarkablePage";
import { ScreensaverBuilderPage } from "./pages/ScreensaverBuilderPage";
import { KioskDisplayPage } from "./pages/KioskDisplayPage";
import { RecipesPage } from "./pages/RecipesPage";
import { MobileRecipeUploadPage } from "./pages/MobileRecipeUploadPage";
import { ProfilesPage } from "./pages/ProfilesPage";
import { PlannerBuilderPage } from "./pages/PlannerBuilderPage";
import { ProfileSettingsPage } from "./pages/ProfileSettingsPage";
import { Toaster } from "./components/ui/Toaster";
import { Screensaver } from "./components/Screensaver";
import { NowPlaying } from "./components/spotify/NowPlaying";
import { useIdleDetector } from "./hooks/useIdleDetector";
import { useDurationAlertMonitor } from "./hooks/useDurationAlertMonitor";
import { useHAWebSocket } from "./stores/homeassistant-ws";
import { DurationAlertBanner } from "./components/alerts/DurationAlertBanner";
import { api } from "./services/api";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const kioskEnabled = useAuthStore((state) => state.kioskEnabled);
  const kioskChecked = useAuthStore((state) => state.kioskChecked);

  // Enable idle detection for authenticated users or kiosk mode
  useIdleDetector();

  // Wait for kiosk check to complete
  if (!kioskChecked) {
    return null;
  }

  // Allow access if authenticated or in kiosk mode
  if (!isAuthenticated && !kioskEnabled) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function SettingsProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Settings always requires authentication, even in kiosk mode
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Wrapper component that runs the duration alert monitor inside the Toaster context
function DurationAlertMonitor() {
  useDurationAlertMonitor();
  return null;
}

export default function App() {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const kioskEnabled = useAuthStore((state) => state.kioskEnabled);
  const kioskChecked = useAuthStore((state) => state.kioskChecked);
  const setKioskStatus = useAuthStore((state) => state.setKioskStatus);
  const setKioskChecked = useAuthStore((state) => state.setKioskChecked);
  const setApiKey = useAuthStore((state) => state.setApiKey);
  const syncScreensaverSettings = useScreensaverStore((state) => state.syncFromServer);
  const colorScheme = useScreensaverStore((state) => state.colorScheme);

  // Hide NowPlaying on settings pages, upload pages, and kiosk pages
  const isSettingsPage = location.pathname.startsWith("/settings");
  const isUploadPage = location.pathname.startsWith("/upload");
  const isKioskPage = location.pathname.startsWith("/kiosk");
  const hideNowPlaying = isSettingsPage || isUploadPage || isKioskPage;

  // Apply color scheme on initial render (from persisted store)
  useEffect(() => {
    document.documentElement.setAttribute("data-color-scheme", colorScheme);
  }, [colorScheme]);

  // Check for API key in URL params on app load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const apiKeyParam = urlParams.get("apiKey");

    if (apiKeyParam) {
      // Store the API key and mark as authenticated
      setApiKey(apiKeyParam);
      // Remove the API key from the URL for security (don't leave it visible)
      urlParams.delete("apiKey");
      const newUrl = urlParams.toString()
        ? `${window.location.pathname}?${urlParams.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, [setApiKey]);

  // Check kiosk status and sync settings on app load
  useEffect(() => {
    async function checkKioskStatus() {
      // Skip global settings sync when on kiosk URL - KioskContext handles settings
      const isKioskUrl = window.location.pathname.startsWith("/kiosk/");

      try {
        const status = await api.getKioskStatus();
        setKioskStatus(status.enabled);
        // Only sync screensaver settings from server if NOT on a kiosk URL
        // Kiosk URLs use kiosk-specific settings from KioskContext instead
        if (!isKioskUrl) {
          await syncScreensaverSettings();
        }
      } catch {
        setKioskStatus(false);
      } finally {
        setKioskChecked(true);
      }
    }
    checkKioskStatus();
  }, [setKioskStatus, setKioskChecked, syncScreensaverSettings]);

  // Connect to Home Assistant WebSocket for real-time updates
  const connectHA = useHAWebSocket((state) => state.connect);
  useEffect(() => {
    if (isAuthenticated) {
      connectHA();
    }
  }, [isAuthenticated, connectHA]);

  // Poll for kiosk commands (refresh, etc.) when in kiosk mode
  const lastCommandTimestamp = useRef(Date.now());
  useEffect(() => {
    if (!kioskEnabled) return;

    const pollInterval = setInterval(async () => {
      try {
        const { commands } = await api.getKioskCommands(lastCommandTimestamp.current);
        for (const cmd of commands) {
          if (cmd.timestamp > lastCommandTimestamp.current) {
            lastCommandTimestamp.current = cmd.timestamp;
          }
          if (cmd.type === "refresh") {
            console.log("Kiosk refresh command received, reloading page...");
            window.location.reload();
          }
        }
      } catch (error) {
        console.error("Failed to poll kiosk commands:", error);
      }
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(pollInterval);
  }, [kioskEnabled]);

  // Show loading while checking kiosk status
  if (!kioskChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <Toaster>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        {/* Public mobile upload page (accessed via QR code) */}
        <Route path="/upload/:token" element={<MobileUploadPage />} />
        {/* Public mobile recipe upload page (accessed via QR code) */}
        <Route path="/upload-recipe/:token" element={<MobileRecipeUploadPage />} />
        {/* Public kiosk display page (accessed via unique token URL) */}
        <Route path="/kiosk/:token/*" element={<KioskDisplayPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/calendar" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="photos" element={<PhotosPage />} />
          <Route path="iptv" element={<IptvPage />} />
          <Route path="cameras" element={<CamerasPage />} />
          <Route path="multiview" element={<MultiViewPage />} />
          <Route path="homeassistant" element={<HomeAssistantPage />} />
          <Route path="spotify" element={<SpotifyPage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="recipes" element={<RecipesPage />} />
          <Route
            path="remarkable"
            element={
              <SettingsProtectedRoute>
                <RemarkablePage />
              </SettingsProtectedRoute>
            }
          />
          <Route
            path="settings"
            element={
              <SettingsProtectedRoute>
                <SettingsPage />
              </SettingsProtectedRoute>
            }
          />
          <Route
            path="settings/screensaver-builder"
            element={
              <SettingsProtectedRoute>
                <ScreensaverBuilderPage />
              </SettingsProtectedRoute>
            }
          />
          <Route
            path="profiles"
            element={
              <SettingsProtectedRoute>
                <ProfilesPage />
              </SettingsProtectedRoute>
            }
          />
          <Route
            path="profiles/:profileId/planner"
            element={
              <SettingsProtectedRoute>
                <PlannerBuilderPage />
              </SettingsProtectedRoute>
            }
          />
          <Route
            path="profiles/:profileId/settings"
            element={
              <SettingsProtectedRoute>
                <ProfileSettingsPage />
              </SettingsProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <DurationAlertMonitor />
      {(isAuthenticated || kioskEnabled) && (
        <>
          <DurationAlertBanner />
          <Screensaver />
          {!hideNowPlaying && <NowPlaying />}
        </>
      )}
    </Toaster>
  );
}
