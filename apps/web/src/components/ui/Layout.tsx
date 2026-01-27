import { useEffect, useState, useCallback } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import { api } from "../../services/api";
import { useAuthStore } from "../../stores/auth";
import { cn } from "../../lib/utils";

export function Layout() {
  const navigate = useNavigate();
  const { logout, setUser, isAuthenticated, kioskEnabled } = useAuthStore();
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  const handleSync = async () => {
    await api.syncAllCalendars();
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
    // Only show settings if authenticated
    ...(isAuthenticated
      ? [{ to: "/settings", icon: Settings, label: "Settings" }]
      : []),
  ];

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="flex w-16 flex-col items-center border-r border-border bg-card py-4">
        <div className="mb-8 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Calendar className="h-6 w-6" />
        </div>

        <nav className="flex flex-1 flex-col items-center gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
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
            onClick={handleSync}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            title="Sync calendars"
          >
            <RefreshCw className="h-5 w-5" />
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
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {/* Floating exit fullscreen button */}
      {isFullscreen && (
        <button
          onClick={toggleFullscreen}
          className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-black/50 px-3 py-2 text-white/80 backdrop-blur-sm transition-opacity hover:bg-black/70 hover:text-white"
          title="Exit fullscreen"
        >
          <Minimize className="h-4 w-4" />
          <span className="text-sm">Exit Fullscreen</span>
        </button>
      )}
    </div>
  );
}
