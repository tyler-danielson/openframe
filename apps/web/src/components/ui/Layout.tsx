import { useEffect, useState, useCallback } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Image,
  LayoutDashboard,
  Settings,
  LogOut,
  RefreshCw,
  Monitor,
  Tv,
  Camera,
  Home,
  Maximize,
  Minimize,
  ListTodo,
  Music,
  MapPin,
  Menu,
  X,
} from "lucide-react";
import { api } from "../../services/api";
import { useAuthStore } from "../../stores/auth";
import { useHAWebSocket } from "../../stores/homeassistant-ws";
import { cn } from "../../lib/utils";

export function Layout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { logout, setUser, isAuthenticated, kioskEnabled } = useAuthStore();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Home Assistant WebSocket
  const haDisconnect = useHAWebSocket((state) => state.disconnect);
  const haConnect = useHAWebSocket((state) => state.connect);

  // Track fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  }, []);

  const { data: user, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.getMe(),
    retry: false,
    enabled: isAuthenticated, // Only fetch if authenticated
  });

  useEffect(() => {
    if (user && !isLoading) {
      setUser(user);
    }
  }, [user, isLoading, setUser]);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore errors
    }
    logout();
    navigate("/login");
  };

  const handleReconnectAll = async () => {
    if (isReconnecting) return;

    setIsReconnecting(true);
    try {
      // Reconnect Home Assistant WebSocket
      haDisconnect();
      await haConnect();

      // Sync calendars
      await api.syncAllCalendars();

      // Invalidate and refetch all queries to refresh data
      await queryClient.invalidateQueries();

      console.log("All services reconnected");
    } catch (error) {
      console.error("Error reconnecting services:", error);
    } finally {
      setIsReconnecting(false);
    }
  };

  // Build nav items based on authentication status
  const navItems = [
    { to: "/calendar", icon: Calendar, label: "Calendar" },
    { to: "/tasks", icon: ListTodo, label: "Tasks" },
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/photos", icon: Image, label: "Photos" },
    { to: "/spotify", icon: Music, label: "Spotify" },
    { to: "/iptv", icon: Tv, label: "Live TV" },
    { to: "/cameras", icon: Camera, label: "Cameras" },
    { to: "/homeassistant", icon: Home, label: "Home Assistant" },
    { to: "/map", icon: MapPin, label: "Map" },
    // Only show settings if authenticated
    ...(isAuthenticated
      ? [{ to: "/settings", icon: Settings, label: "Settings" }]
      : []),
  ];

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileSidebarOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-3 rounded-lg bg-card border border-border min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5 text-foreground" />
      </button>

      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:relative z-50 lg:z-auto h-full flex w-16 flex-col items-center border-r border-border bg-card py-4 transform transition-transform lg:transform-none",
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Mobile Close Button */}
        <button
          onClick={() => setIsMobileSidebarOpen(false)}
          className="lg:hidden absolute top-4 right-[-44px] p-3 rounded-lg bg-card border border-border min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Close menu"
        >
          <X className="h-5 w-5 text-foreground" />
        </button>

        <div className="mb-8 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Calendar className="h-6 w-6" />
        </div>

        <nav className="flex flex-1 flex-col items-center gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsMobileSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )
              }
              title={item.label}
            >
              <item.icon className="h-5 w-5" />
            </NavLink>
          ))}
        </nav>

        <div className="flex flex-col items-center gap-2">
          {/* Kiosk mode indicator */}
          {kioskEnabled && !isAuthenticated && (
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500"
              title="Kiosk Mode"
            >
              <Monitor className="h-5 w-5" />
            </div>
          )}
          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </button>
          <button
            onClick={handleReconnectAll}
            disabled={isReconnecting}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
              isReconnecting && "opacity-50 cursor-not-allowed"
            )}
            title="Reconnect all services"
          >
            <RefreshCw className={cn("h-5 w-5", isReconnecting && "animate-spin")} />
          </button>
          {isAuthenticated ? (
            <button
              onClick={handleLogout}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </button>
          ) : (
            <NavLink
              to="/login"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              title="Login"
            >
              <LogOut className="h-5 w-5 rotate-180" />
            </NavLink>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="relative flex-1 overflow-auto pt-16 lg:pt-0">
        <Outlet />
      </main>

    </div>
  );
}
