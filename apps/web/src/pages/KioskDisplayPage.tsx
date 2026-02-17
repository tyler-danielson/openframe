import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { useParams, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { WifiOff, RefreshCw, Maximize } from "lucide-react";
import { api, type KioskCommand } from "../services/api";
import { KioskProvider, useKiosk } from "../contexts/KioskContext";
import { useIdleDetector } from "../hooks/useIdleDetector";
import { Screensaver } from "../components/Screensaver";
import { TVControlsOverlay } from "../components/TVControlsOverlay";
import { Layout } from "../components/ui/Layout";
import { useScreensaverStore } from "../stores/screensaver";
import { useRemoteControlStore } from "../stores/remote-control";
import { useBlockNavStore } from "../stores/block-nav";
import type { ConnectionStatus } from "../hooks/useConnectionHealth";

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
import { KitchenPage } from "./KitchenPage";
import { ScreensaverDisplayPage } from "./ScreensaverDisplayPage";
import { MultiViewPage } from "./MultiViewPage";

// Feature to route mapping
const FEATURE_ROUTES: Record<string, { path: string; element: JSX.Element }> = {
  calendar: { path: "calendar", element: <CalendarPage /> },
  dashboard: { path: "dashboard", element: <DashboardPage /> },
  tasks: { path: "tasks", element: <TasksPage /> },
  photos: { path: "photos/*", element: <PhotosPage /> },
  spotify: { path: "spotify", element: <SpotifyPage /> },
  iptv: { path: "iptv", element: <IptvPage /> },
  cameras: { path: "cameras", element: <CamerasPage /> },
  homeassistant: { path: "homeassistant/*", element: <HomeAssistantPage /> },
  map: { path: "map", element: <MapPage /> },
  kitchen: { path: "kitchen/*", element: <KitchenPage /> },
  screensaver: { path: "screensaver", element: <ScreensaverDisplayPage /> },
  multiview: { path: "multiview", element: <MultiViewPage /> },
};

// Format time ago for display
function formatTimeAgo(date: Date | null): string {
  if (!date) return "Unknown";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleTimeString();
}

// Connection status indicator component
function ConnectionStatusIndicator({
  status,
  lastOnlineAt,
}: {
  status: ConnectionStatus;
  lastOnlineAt: Date | null;
}) {
  if (status === "online") return null;

  return (
    <div className="fixed bottom-4 right-4 bg-card/95 backdrop-blur-sm border border-border rounded-lg px-4 py-3 shadow-lg z-50 flex items-center gap-3">
      {status === "offline" && (
        <>
          <WifiOff className="h-5 w-5 text-destructive" />
          <div>
            <div className="text-sm font-medium text-destructive">Offline</div>
            <div className="text-xs text-muted-foreground">
              Last online: {formatTimeAgo(lastOnlineAt)}
            </div>
          </div>
        </>
      )}
      {status === "reconnecting" && (
        <>
          <RefreshCw className="h-5 w-5 text-yellow-500 animate-spin" />
          <div>
            <div className="text-sm font-medium text-yellow-500">Reconnecting...</div>
            <div className="text-xs text-muted-foreground">
              Last online: {formatTimeAgo(lastOnlineAt)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Kiosk app content - uses the same Layout and pages as the main app
function KioskApp() {
  const { isAuthReady, displayMode, displayType, homePage, enabledFeatures, connectionStatus, lastOnlineAt, startFullscreen } = useKiosk();
  const location = useLocation();
  const navigate = useNavigate();
  const hasAttemptedFullscreen = useRef(false);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const [showControls, setShowControls] = useState(displayType === "tv");
  const setScreensaverActive = useScreensaverStore((s) => s.setActive);
  const screensaverIsActive = useScreensaverStore((s) => s.isActive);
  const screensaverBehavior = useScreensaverStore((s) => s.behavior);
  const showScreensaverOverlay = screensaverBehavior !== "hide-toolbar";

  // Enable idle detection for screensaver
  useIdleDetector();

  // Auto-dismiss controls overlay after 5 seconds
  useEffect(() => {
    if (!showControls) return;
    const timer = setTimeout(() => setShowControls(false), 5000);
    return () => clearTimeout(timer);
  }, [showControls]);

  // Listen for postMessage commands from TV wrapper (Tizen iframe parent)
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!event.data?.type) return;
      // Accept messages from same origin, Tizen TV wrapper (wgt:// or "null"), or local file://
      const trustedOrigin =
        event.origin === window.location.origin ||
        event.origin === "null" ||
        event.origin.startsWith("wgt:") ||
        event.origin.startsWith("file:");
      if (!trustedOrigin) return;
      const { type, page } = event.data;
      // Debug: confirm message received
      useBlockNavStore.setState({ _debug: `rcv: ${type}/${page} from ${event.origin}` });
      if (type === "navigate" && page) {
        // Dismiss hide-toolbar mode on any remote activity
        const ss = useScreensaverStore.getState();
        if (ss.isActive && ss.behavior === "hide-toolbar") {
          ss.updateActivity(); // resets isActive → sidebar reappears
          // Left or back specifically: activate sidebar nav after sidebar re-renders
          if (page === "scroll:left" || page === "action:back") {
            setTimeout(() => {
              const nav = useBlockNavStore.getState();
              const sidebarBlocks = nav.blocks.filter((b) => b.group === "nav");
              if (sidebarBlocks.length > 0) {
                const sorted = [...sidebarBlocks].sort((a, b) => a.y - b.y || a.x - b.x);
                useBlockNavStore.setState({ mode: "selecting", focusedBlockId: sorted[0]?.id ?? null });
              }
            }, 100);
            return; // Consume the event
          }
        }

        if (page === "screensaver:toggle") {
          setScreensaverActive(!screensaverIsActive);
        } else if (page.startsWith("scroll:")) {
          const dir = page.replace("scroll:", "") as "up" | "down" | "left" | "right";
          const nav = useBlockNavStore.getState();

          if (nav.mode === "idle" && displayType === "tv" && nav.blocks.length > 0) {
            useBlockNavStore.setState({ _debug: `activate! dt=${displayType} b=${nav.blocks.length}` });
            // Left arrow from idle: activate sidebar nav directly
            // Other directions: activate page content blocks only
            nav.activateSelection(dir === "left" ? "nav" : undefined);
            // If activation didn't change mode (no matching blocks), fall through to scroll
            const afterNav = useBlockNavStore.getState();
            if (afterNav.mode === "idle") {
              const amount = 300;
              if (dir === "up") window.scrollBy(0, -amount);
              else if (dir === "down") window.scrollBy(0, amount);
              else if (dir === "right") window.scrollBy(amount, 0);
            }
          } else if (nav.mode === "selecting") {
            useBlockNavStore.setState({ _debug: `nav:${dir}` });
            nav.navigateDirection(dir);
          } else if (nav.mode === "controlling") {
            useBlockNavStore.setState({ _debug: `ctrl:${dir}` });
            nav.executeControl(dir);
          } else {
            // Legacy scroll behavior
            useBlockNavStore.setState({ _debug: `SCROLL m=${nav.mode} dt=${displayType} b=${nav.blocks.length}` });
            const amount = 300;
            if (dir === "up") window.scrollBy(0, -amount);
            else if (dir === "down") window.scrollBy(0, amount);
            else if (dir === "left") window.scrollBy(-amount, 0);
            else if (dir === "right") window.scrollBy(amount, 0);
          }
        } else if (page === "action:select") {
          const nav = useBlockNavStore.getState();
          if (nav.mode === "selecting") {
            nav.enterBlock();
          } else if (nav.mode === "controlling") {
            nav.executeControl("enter");
          } else {
            (document.activeElement as HTMLElement)?.click?.();
          }
        } else if (page === "action:back") {
          const nav = useBlockNavStore.getState();
          if (nav.mode === "controlling") {
            nav.exitBlock();
          } else if (nav.mode === "selecting") {
            nav.deactivateNavigation();
          } else {
            // Block nav didn't consume back — notify parent (Tizen wrapper)
            window.parent.postMessage({ type: "back-unhandled" }, "*");
          }
        } else if (page === "action:play_pause") {
          const nav = useBlockNavStore.getState();
          if (nav.mode === "controlling") {
            nav.executeControl("play_pause");
          }
          // When not controlling, play/pause does nothing in the iframe
        } else if (page.startsWith("color:")) {
          const color = page.replace("color:", "");
          const nav = useBlockNavStore.getState();
          if (nav.mode === "controlling") {
            nav.executeControl(color);
          } else {
            // Default color button actions when not in block nav controlling mode
            const colorActions: Record<string, string> = {
              red: "screensaver:toggle",
              green: "calendar",
              yellow: "dashboard",
              blue: "homeassistant",
            };
            const target = colorActions[color];
            if (target === "screensaver:toggle") {
              setScreensaverActive(!screensaverIsActive);
            } else if (target) {
              navigate(target);
            }
          }
        } else if (page === "help") {
          setShowControls((prev) => !prev);
        } else {
          navigate(page);
        }
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [navigate, setScreensaverActive, screensaverIsActive, displayType]);

  // Keyboard listener for desktop testing of block navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Dismiss hide-toolbar mode on any key press (idle detector handles this too,
      // but we need special left/Escape handling to activate sidebar nav)
      const ss = useScreensaverStore.getState();
      if (ss.isActive && ss.behavior === "hide-toolbar") {
        ss.updateActivity();
        if (e.key === "ArrowLeft" || e.key === "Escape") {
          e.preventDefault();
          setTimeout(() => {
            const nav = useBlockNavStore.getState();
            const sidebarBlocks = nav.blocks.filter((b) => b.group === "nav");
            if (sidebarBlocks.length > 0) {
              const sorted = [...sidebarBlocks].sort((a, b) => a.y - b.y || a.x - b.x);
              useBlockNavStore.setState({ mode: "selecting", focusedBlockId: sorted[0]?.id ?? null });
            }
          }, 100);
          return;
        }
      }

      const nav = useBlockNavStore.getState();
      const keyMap: Record<string, string> = {
        ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
      };

      if (keyMap[e.key]) {
        const dir = keyMap[e.key] as "up" | "down" | "left" | "right";
        if (nav.mode === "idle" && nav.blocks.length > 0) {
          nav.activateSelection(dir === "left" ? "nav" : undefined);
          // If activation didn't change mode (no matching blocks), fall through to scroll
          const afterNav = useBlockNavStore.getState();
          if (afterNav.mode !== "idle") {
            e.preventDefault();
          } else if (dir !== "left") {
            e.preventDefault();
            const amount = 300;
            if (dir === "up") window.scrollBy(0, -amount);
            else if (dir === "down") window.scrollBy(0, amount);
            else if (dir === "right") window.scrollBy(amount, 0);
          }
        } else if (nav.mode === "selecting") {
          e.preventDefault();
          nav.navigateDirection(dir);
        } else if (nav.mode === "controlling") {
          e.preventDefault();
          nav.executeControl(dir);
        }
      } else if (e.key === "Enter") {
        if (nav.mode === "selecting") {
          e.preventDefault();
          nav.enterBlock();
        } else if (nav.mode === "controlling") {
          e.preventDefault();
          nav.executeControl("enter");
        }
      } else if (e.key === "Escape") {
        if (nav.mode === "controlling") {
          e.preventDefault();
          nav.exitBlock();
        } else if (nav.mode === "selecting") {
          e.preventDefault();
          nav.deactivateNavigation();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Request fullscreen on load if enabled
  useEffect(() => {
    if (!isAuthReady || hasAttemptedFullscreen.current) return;

    if (startFullscreen && document.documentElement.requestFullscreen) {
      hasAttemptedFullscreen.current = true;
      // Small delay to ensure page is fully loaded
      const timer = setTimeout(() => {
        document.documentElement.requestFullscreen().catch((err) => {
          // Browsers require user gesture for fullscreen - show prompt instead
          console.warn("[Kiosk] Could not enter fullscreen automatically:", err.message);
          setShowFullscreenPrompt(true);
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isAuthReady, startFullscreen]);

  // Set display type data attribute on document root for CSS-level adaptations
  useEffect(() => {
    document.documentElement.dataset.displayType = displayType;
    return () => { delete document.documentElement.dataset.displayType; };
  }, [displayType]);

  // Handle click to enter fullscreen
  const handleFullscreenClick = () => {
    document.documentElement.requestFullscreen().then(() => {
      setShowFullscreenPrompt(false);
    }).catch((err) => {
      console.warn("[Kiosk] Could not enter fullscreen:", err.message);
      setShowFullscreenPrompt(false);
    });
  };

  // Determine enabled routes based on features
  const enabledRoutes = useMemo(() => {
    if (displayMode !== "full") return [];

    return Object.entries(FEATURE_ROUTES)
      .filter(([feature]) => {
        // Check if feature is enabled (default to true if not specified)
        const featureEnabled = enabledFeatures[feature as keyof typeof enabledFeatures];
        return featureEnabled !== false;
      })
      .map(([feature, route]) => ({
        feature,
        ...route,
      }));
  }, [displayMode, enabledFeatures]);

  // Get the effective home page
  const effectiveHomePage = useMemo(() => {
    // If the specified home page is not enabled, fall back to first enabled route
    const homePageEnabled = enabledFeatures[homePage as keyof typeof enabledFeatures];
    if (homePageEnabled === false && enabledRoutes.length > 0) {
      return enabledRoutes[0]?.path.replace("/*", "") ?? "calendar";
    }
    return homePage || "calendar";
  }, [homePage, enabledFeatures, enabledRoutes]);

  // Clear the refresh flag once auth is ready
  useEffect(() => {
    if (isAuthReady) {
      sessionStorage.removeItem("openframe_kiosk_refreshing");
      // Remove the injected overlay if it's still in the DOM
      document.getElementById("kiosk-refresh-overlay")?.remove();
    }
  }, [isAuthReady]);

  if (!isAuthReady) {
    return (
      <div className="fixed inset-0 z-[9999] bg-background flex items-center justify-center flex-col gap-4">
        <RefreshCw className="h-10 w-10 text-primary animate-spin" />
        <div className="text-lg text-muted-foreground">
          {sessionStorage.getItem("openframe_kiosk_refreshing")
            ? "Refreshing kiosk..."
            : "Loading kiosk..."}
        </div>
      </div>
    );
  }

  // Fullscreen prompt overlay (defined early so all modes can use it)
  const fullscreenPrompt = showFullscreenPrompt && (
    <div
      className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center cursor-pointer"
      onClick={handleFullscreenClick}
    >
      <div className="text-center text-white">
        <Maximize className="h-16 w-16 mx-auto mb-4 animate-pulse" />
        <div className="text-2xl font-semibold mb-2">Tap to Enter Fullscreen</div>
        <div className="text-sm text-white/70">This kiosk is configured to run in fullscreen mode</div>
      </div>
    </div>
  );

  // Controls overlay (shared across all display modes)
  const controlsOverlay = (
    <TVControlsOverlay visible={showControls} onDismiss={() => setShowControls(false)} />
  );

  // Handle different display modes
  if (displayMode === "screensaver-only") {
    // Only show the screensaver, always active and cannot be dismissed
    return (
      <>
        <Screensaver alwaysActive displayType={displayType} />
        <ConnectionStatusIndicator status={connectionStatus} lastOnlineAt={lastOnlineAt} />
        {fullscreenPrompt}
        {controlsOverlay}
      </>
    );
  }

  if (displayMode === "calendar-only") {
    // Only show calendar page with screensaver overlay
    return (
      <div className="min-h-screen bg-background">
        <CalendarPage />
        {showScreensaverOverlay && <Screensaver displayType={displayType} />}
        <ConnectionStatusIndicator status={connectionStatus} lastOnlineAt={lastOnlineAt} />
        {fullscreenPrompt}
        {controlsOverlay}
      </div>
    );
  }

  if (displayMode === "dashboard-only") {
    // Only show dashboard page with screensaver overlay
    return (
      <div className="min-h-screen bg-background">
        <DashboardPage />
        {showScreensaverOverlay && <Screensaver displayType={displayType} />}
        <ConnectionStatusIndicator status={connectionStatus} lastOnlineAt={lastOnlineAt} />
        {fullscreenPrompt}
        {controlsOverlay}
      </div>
    );
  }

  // Full mode: show navigation with filtered features
  return (
    <>
      <Routes>
        <Route element={<Layout kioskEnabledFeatures={enabledFeatures} kioskDisplayType={displayType} />}>
          <Route index element={<Navigate to={effectiveHomePage} replace />} />
          {enabledRoutes.map(({ feature, path, element }) => (
            <Route key={feature} path={path} element={element} />
          ))}
          {/* Redirect disabled routes to home page */}
          <Route path="*" element={<Navigate to={effectiveHomePage} replace />} />
        </Route>
      </Routes>
      {showScreensaverOverlay && <Screensaver displayType={displayType} />}
      <ConnectionStatusIndicator status={connectionStatus} lastOnlineAt={lastOnlineAt} />
      {fullscreenPrompt}
      {controlsOverlay}
    </>
  );
}

// Wrapper to handle loading/error states
function KioskLayoutWrapper() {
  const { isLoading, error, config, connectionStatus, lastOnlineAt } = useKiosk();

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
        <ConnectionStatusIndicator status={connectionStatus} lastOnlineAt={lastOnlineAt} />
      </div>
    );
  }

  return <KioskApp />;
}

// Inner component that has access to kiosk context for command polling
function KioskCommandPoller({ token }: { token: string }) {
  const { isOfflineMode } = useKiosk();
  const navigate = useNavigate();
  const lastCommandTimestamp = useRef(Date.now());
  const pollIntervalRef = useRef(10000);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const setScreensaverActive = useScreensaverStore((s) => s.setActive);
  const addRemoteCommand = useRemoteControlStore((s) => s.addCommand);

  // Handle a single command
  const handleCommand = useCallback(
    (cmd: KioskCommand) => {
      console.log(`[Kiosk] Processing command: ${cmd.type}`, cmd.payload);

      switch (cmd.type) {
        case "refresh":
          console.log("[Kiosk] Refresh command received, reloading page...");
          sessionStorage.setItem("openframe_kiosk_refreshing", "1");
          // Inject loading overlay so it's visible during the unload/reload gap
          const overlay = document.createElement("div");
          overlay.id = "kiosk-refresh-overlay";
          overlay.style.cssText =
            "position:fixed;inset:0;z-index:9999;background:var(--background, #000);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:1rem;";
          overlay.innerHTML = `
            <div style="width:2.5rem;height:2.5rem;border:3px solid var(--muted-foreground, #888);border-top-color:var(--primary, #fff);border-radius:50%;animation:kiosk-spin 1s linear infinite;"></div>
            <div style="color:var(--foreground, #fff);font-size:1.125rem;">Refreshing kiosk...</div>
            <style>@keyframes kiosk-spin{to{transform:rotate(360deg)}}</style>
          `;
          document.body.appendChild(overlay);
          window.location.reload();
          break;

        case "reload-photos":
          // This triggers a refetch in the screensaver - just need to emit
          console.log("[Kiosk] Reload photos command received");
          // Could emit an event or trigger refetch via query client
          break;

        case "navigate":
          if (cmd.payload?.path && typeof cmd.payload.path === "string") {
            console.log(`[Kiosk] Navigating to: ${cmd.payload.path}`);
            navigate(cmd.payload.path);
          }
          break;

        case "fullscreen":
          if (cmd.payload?.enabled === true) {
            console.log("[Kiosk] Entering fullscreen");
            document.documentElement.requestFullscreen().catch((err) => {
              console.warn("[Kiosk] Could not enter fullscreen:", err.message);
            });
          } else if (cmd.payload?.enabled === false) {
            console.log("[Kiosk] Exiting fullscreen");
            document.exitFullscreen().catch((err) => {
              console.warn("[Kiosk] Could not exit fullscreen:", err.message);
            });
          }
          break;

        case "screensaver":
          if (typeof cmd.payload?.enabled === "boolean") {
            console.log(`[Kiosk] Screensaver ${cmd.payload.enabled ? "activated" : "deactivated"}`);
            setScreensaverActive(cmd.payload.enabled);
          }
          break;

        case "multiview-add":
        case "multiview-remove":
        case "multiview-clear":
        case "multiview-set":
          // Forward multiview commands to the remote control store
          // These will be consumed by MultiViewPage
          console.log(`[Kiosk] Forwarding multiview command: ${cmd.type}`);
          addRemoteCommand(cmd);
          break;

        case "iptv-play":
        case "camera-view":
          // Forward cast commands to the remote control store
          // These will be consumed by IptvPage / CamerasPage
          console.log(`[Kiosk] Forwarding cast command: ${cmd.type}`);
          addRemoteCommand(cmd);
          break;

        case "widget-control": {
          const payload = cmd.payload as { widgetId?: string; action?: string; data?: Record<string, unknown> } | undefined;
          if (payload?.widgetId && payload?.action) {
            console.log(`[Kiosk] Widget control: ${payload.action} on ${payload.widgetId}`);
            const nav = useBlockNavStore.getState();
            nav.executeRemoteAction(payload.widgetId, payload.action, payload.data);
          }
          break;
        }

        default:
          console.warn(`[Kiosk] Unknown command type: ${cmd.type}`);
      }
    },
    [navigate, setScreensaverActive, addRemoteCommand]
  );

  // Poll for commands - pause when offline, adaptive interval
  useEffect(() => {
    if (!token || isOfflineMode) return;

    const poll = async () => {
      try {
        const { commands, fastPoll } = await api.getKioskCommandsByToken(token, lastCommandTimestamp.current);
        for (const cmd of commands) {
          if (cmd.timestamp > lastCommandTimestamp.current) {
            lastCommandTimestamp.current = cmd.timestamp;
          }
          handleCommand(cmd);
        }
        // Adjust poll interval based on server response
        const newInterval = fastPoll ? 2000 : 10000;
        if (newInterval !== pollIntervalRef.current) {
          pollIntervalRef.current = newInterval;
          // Restart timer with new interval
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          pollTimerRef.current = setInterval(poll, newInterval);
        }
      } catch (error) {
        console.error("Failed to poll kiosk commands:", error);
      }
    };

    pollIntervalRef.current = 10000;
    pollTimerRef.current = setInterval(poll, 10000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [token, isOfflineMode, handleCommand]);

  return null;
}

// Main component
export function KioskDisplayPage() {
  const { token } = useParams<{ token: string }>();

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
      <KioskCommandPoller token={token} />
      <KioskLayoutWrapper />
    </KioskProvider>
  );
}
