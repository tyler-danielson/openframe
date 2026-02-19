import { useEffect, useState } from "react";
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
import { KitchenPage } from "./pages/KitchenPage";
import { MobileRecipeUploadPage } from "./pages/MobileRecipeUploadPage";
import { DeviceLoginPage } from "./pages/DeviceLoginPage";
import { ChatPage } from "./pages/ChatPage";
import { RoutinesPage } from "./pages/RoutinesPage";
import { SetupPage } from "./pages/SetupPage";
import { ProfilesPage } from "./pages/ProfilesPage";
import { PlannerBuilderPage } from "./pages/PlannerBuilderPage";
import { ProfileSettingsPage } from "./pages/ProfileSettingsPage";
import { CompanionLayout } from "./pages/companion/CompanionLayout";
import { CompanionLoginPage } from "./pages/companion/CompanionLoginPage";
import { CompanionDashboardPage } from "./pages/companion/CompanionDashboardPage";
import { CompanionCalendarPage } from "./pages/companion/CompanionCalendarPage";
import { CompanionEventFormPage } from "./pages/companion/CompanionEventFormPage";
import { CompanionTasksPage } from "./pages/companion/CompanionTasksPage";
import { CompanionKiosksPage } from "./pages/companion/CompanionKiosksPage";
import { CompanionKioskPage } from "./pages/companion/CompanionKioskPage";
import { CompanionWidgetPage } from "./pages/companion/CompanionWidgetPage";
import { CompanionMorePage } from "./pages/companion/CompanionMorePage";
import { CompanionPhotosPage } from "./pages/companion/more/CompanionPhotosPage";
import { CompanionIptvPage } from "./pages/companion/more/CompanionIptvPage";
import { CompanionHAPage } from "./pages/companion/more/CompanionHAPage";
import { CompanionNewsPage } from "./pages/companion/more/CompanionNewsPage";
import { CompanionWeatherPage } from "./pages/companion/more/CompanionWeatherPage";
import { CompanionRecipesPage } from "./pages/companion/more/CompanionRecipesPage";
import { CompanionSettingsPage } from "./pages/companion/more/CompanionSettingsPage";
import { Toaster } from "./components/ui/Toaster";
import { Screensaver } from "./components/Screensaver";
import { NowPlaying } from "./components/spotify/NowPlaying";
import { useIdleDetector } from "./hooks/useIdleDetector";
import { useDurationAlertMonitor } from "./hooks/useDurationAlertMonitor";
import { useHAWebSocket } from "./stores/homeassistant-ws";
import { DurationAlertBanner } from "./components/alerts/DurationAlertBanner";
import { ChatDrawer } from "./components/chat/ChatDrawer";
import { api } from "./services/api";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Enable idle detection for authenticated users
  useIdleDetector();

  if (!isAuthenticated) {
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

function CompanionProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/companion/login" replace />;
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
  const setApiKey = useAuthStore((state) => state.setApiKey);
  const syncScreensaverSettings = useScreensaverStore((state) => state.syncFromServer);
  const colorScheme = useScreensaverStore((state) => state.colorScheme);

  // Setup status
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  // Check setup status on app load
  useEffect(() => {
    async function checkSetupStatus() {
      // Skip setup check for kiosk, upload, auth callback, and setup pages
      const path = window.location.pathname;
      if (
        path.startsWith("/kiosk/") ||
        path.startsWith("/upload") ||
        path.startsWith("/auth/callback") ||
        path.startsWith("/setup") ||
        path.startsWith("/companion")
      ) {
        setNeedsSetup(false);
        return;
      }

      try {
        const status = await api.getSetupStatus();
        setNeedsSetup(status.needsSetup);
      } catch {
        setNeedsSetup(false);
      }
    }
    checkSetupStatus();
  }, []);

  // Hide NowPlaying on settings pages, upload pages, and kiosk pages
  const isSettingsPage = location.pathname.startsWith("/settings");
  const isUploadPage = location.pathname.startsWith("/upload");
  const isKioskPage = location.pathname.startsWith("/kiosk");
  const isCompanionPage = location.pathname.startsWith("/companion");
  const hideNowPlaying = isSettingsPage || isUploadPage || isKioskPage || isCompanionPage;

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

  // Sync screensaver settings on app load
  useEffect(() => {
    // Skip global settings sync when on kiosk URL - KioskContext handles settings
    const isKioskUrl = window.location.pathname.startsWith("/kiosk/");
    if (!isKioskUrl) {
      syncScreensaverSettings().catch(() => {});
    }
  }, [syncScreensaverSettings]);

  // Connect to Home Assistant WebSocket for real-time updates
  const connectHA = useHAWebSocket((state) => state.connect);
  useEffect(() => {
    if (isAuthenticated) {
      connectHA();
    }
  }, [isAuthenticated, connectHA]);

  // Show loading while checking setup status
  if (needsSetup === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Redirect to setup if needed (and not already on setup page)
  if (needsSetup && !location.pathname.startsWith("/setup")) {
    return (
      <Toaster>
        <Routes>
          <Route path="/setup" element={<SetupPage />} />
          <Route path="*" element={<Navigate to="/setup" replace />} />
        </Routes>
      </Toaster>
    );
  }

  return (
    <Toaster>
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        {/* Public mobile upload page (accessed via QR code) */}
        <Route path="/upload/:token" element={<MobileUploadPage />} />
        {/* Public mobile recipe upload page (accessed via QR code) */}
        <Route path="/upload-recipe/:token" element={<MobileRecipeUploadPage />} />
        {/* Public device login page (QR code flow) */}
        <Route path="/device-login" element={<DeviceLoginPage />} />
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
          <Route path="routines" element={<RoutinesPage />} />
          <Route path="photos" element={<PhotosPage />} />
          <Route path="iptv" element={<IptvPage />} />
          <Route path="cameras" element={<CamerasPage />} />
          <Route path="multiview" element={<MultiViewPage />} />
          <Route path="homeassistant" element={<HomeAssistantPage />} />
          <Route path="spotify" element={<SpotifyPage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="kitchen" element={<KitchenPage />} />
          <Route path="recipes" element={<Navigate to="/kitchen" replace />} />
          <Route path="chat" element={<ChatPage />} />
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

        {/* Companion app - mobile companion experience */}
        <Route path="companion/login" element={<CompanionLoginPage />} />
        <Route
          path="companion"
          element={
            <CompanionProtectedRoute>
              <CompanionLayout />
            </CompanionProtectedRoute>
          }
        >
          <Route index element={<CompanionDashboardPage />} />
          <Route path="calendar" element={<CompanionCalendarPage />} />
          <Route path="calendar/event/new" element={<CompanionEventFormPage />} />
          <Route path="calendar/event/:eventId" element={<CompanionEventFormPage />} />
          <Route path="tasks" element={<CompanionTasksPage />} />
          <Route path="kiosks" element={<CompanionKiosksPage />} />
          <Route path="kiosks/:kioskId" element={<CompanionKioskPage />} />
          <Route path="kiosks/:kioskId/widget/:widgetId" element={<CompanionWidgetPage />} />
          <Route path="more" element={<CompanionMorePage />} />
          <Route path="more/photos" element={<CompanionPhotosPage />} />
          <Route path="more/iptv" element={<CompanionIptvPage />} />
          <Route path="more/homeassistant" element={<CompanionHAPage />} />
          <Route path="more/news" element={<CompanionNewsPage />} />
          <Route path="more/weather" element={<CompanionWeatherPage />} />
          <Route path="more/recipes" element={<CompanionRecipesPage />} />
          <Route path="more/settings" element={<CompanionSettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <DurationAlertMonitor />
      {isAuthenticated && (
        <>
          <DurationAlertBanner />
          <Screensaver />
          {!hideNowPlaying && <NowPlaying />}
          {!isKioskPage && !isCompanionPage && <ChatDrawer />}
        </>
      )}
    </Toaster>
  );
}
