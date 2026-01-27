import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
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
import { HomeAssistantPage } from "./pages/HomeAssistantPage";
import { SpotifyPage } from "./pages/SpotifyPage";
import { Toaster } from "./components/ui/Toaster";
import { Screensaver } from "./components/Screensaver";
import { useIdleDetector } from "./hooks/useIdleDetector";
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

export default function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const kioskEnabled = useAuthStore((state) => state.kioskEnabled);
  const kioskChecked = useAuthStore((state) => state.kioskChecked);
  const setKioskStatus = useAuthStore((state) => state.setKioskStatus);
  const setKioskChecked = useAuthStore((state) => state.setKioskChecked);
  const syncScreensaverSettings = useScreensaverStore((state) => state.syncFromServer);

  // Check kiosk status and sync settings on app load
  useEffect(() => {
    async function checkKioskStatus() {
      try {
        const status = await api.getKioskStatus();
        setKioskStatus(status.enabled);
        // Sync screensaver settings from server
        await syncScreensaverSettings();
      } catch {
        setKioskStatus(false);
      } finally {
        setKioskChecked(true);
      }
    }
    checkKioskStatus();
  }, [setKioskStatus, setKioskChecked, syncScreensaverSettings]);

  // Show loading while checking kiosk status
  if (!kioskChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

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
          <Route path="homeassistant" element={<HomeAssistantPage />} />
          <Route path="spotify" element={<SpotifyPage />} />
          <Route
            path="settings"
            element={
              <SettingsProtectedRoute>
                <SettingsPage />
              </SettingsProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
      {(isAuthenticated || kioskEnabled) && <Screensaver />}
    </>
  );
}
