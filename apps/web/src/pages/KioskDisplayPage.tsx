import { useEffect, useRef } from "react";
import { useParams, Routes, Route, Navigate } from "react-router-dom";
import { api } from "../services/api";
import { KioskProvider, useKiosk } from "../contexts/KioskContext";
import { useIdleDetector } from "../hooks/useIdleDetector";
import { Screensaver } from "../components/Screensaver";
import { Layout } from "../components/ui/Layout";

// Import all pages
import { DashboardPage } from "./DashboardPage";
import { CalendarPage } from "./CalendarPage";
import { TasksPage } from "./TasksPage";
import { PhotosPage } from "./PhotosPage";
import { SpotifyPage } from "./SpotifyPage";
import { IptvPage } from "./IptvPage";
import { CamerasPage } from "./CamerasPage";
import { HomeAssistantPage } from "./HomeAssistantPage";
import { MapPage } from "./MapPage";

// Kiosk app content - uses the same Layout and pages as the main app
function KioskApp() {
  const { isAuthReady } = useKiosk();

  // Enable idle detection for screensaver
  useIdleDetector();

  if (!isAuthReady) {
    return null; // Still loading auth
  }

  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="calendar" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="photos/*" element={<PhotosPage />} />
          <Route path="spotify" element={<SpotifyPage />} />
          <Route path="iptv" element={<IptvPage />} />
          <Route path="cameras" element={<CamerasPage />} />
          <Route path="homeassistant/*" element={<HomeAssistantPage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="*" element={<Navigate to="calendar" replace />} />
        </Route>
      </Routes>
      <Screensaver />
    </>
  );
}

// Wrapper to handle loading/error states
function KioskLayoutWrapper() {
  const { isLoading, error, config } = useKiosk();

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="text-xl animate-pulse">Loading kiosk...</div>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl mb-4">Kiosk Not Found</div>
          <div className="text-muted-foreground">
            {error || "This kiosk URL is invalid or has been disabled."}
          </div>
        </div>
      </div>
    );
  }

  return <KioskApp />;
}

// Main component
export function KioskDisplayPage() {
  const { token } = useParams<{ token: string }>();
  const lastCommandTimestamp = useRef(Date.now());

  // Poll for commands (refresh, etc.)
  useEffect(() => {
    if (!token) return;

    const pollInterval = setInterval(async () => {
      try {
        const { commands } = await api.getKioskCommandsByToken(token, lastCommandTimestamp.current);
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
    }, 10000);

    return () => clearInterval(pollInterval);
  }, [token]);

  if (!token) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl mb-4">Invalid Kiosk URL</div>
          <div className="text-muted-foreground">No token provided</div>
        </div>
      </div>
    );
  }

  return (
    <KioskProvider token={token}>
      <KioskLayoutWrapper />
    </KioskProvider>
  );
}
