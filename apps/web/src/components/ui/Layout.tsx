import { useEffect, useState, useCallback, useMemo, useRef, Suspense } from "react";
import { NavLink, Outlet, useNavigate, useLocation, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Image,
  LayoutDashboard,
  LayoutGrid,
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
  ListChecks,
  Music,
  MapPin,
  Menu,
  X,
  Moon,
  Play,
  PenTool,
  ChefHat,
  Users,
  MessageCircle,
  MoreHorizontal,
} from "lucide-react";
import { api, type KioskEnabledFeatures, type KioskDisplayType } from "../../services/api";
import { useAuthStore } from "../../stores/auth";
import { useSidebarStore, type SidebarFeature } from "../../stores/sidebar";
import { useHAWebSocket } from "../../stores/homeassistant-ws";
import { useScreensaverStore } from "../../stores/screensaver";
import { useBlockNavStore, type NavigableBlock } from "../../stores/block-nav";
import { cn } from "../../lib/utils";

interface LayoutProps {
  kioskEnabledFeatures?: KioskEnabledFeatures | null;
  kioskDisplayType?: KioskDisplayType | null;
}

// Media sub-items (base paths, will be prefixed in component)
const mediaItemsBase = [
  { path: "spotify", icon: Music, label: "Spotify" },
  { path: "iptv", icon: Tv, label: "Live TV" },
];

export function Layout({ kioskEnabledFeatures, kioskDisplayType }: LayoutProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { logout, setUser, isAuthenticated } = useAuthStore();

  const isKioskPath = window.location.pathname.startsWith("/kiosk/");
  const setScreensaverActive = useScreensaverStore((state) => state.setActive);
  const screensaverEnabled = useScreensaverStore((state) => state.enabled);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMediaMenuOpen, setIsMediaMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarFeatures = useSidebarStore((s) => s.features);

  // Detect kiosk mode base path from URL (e.g., /kiosk/abc123)
  const basePath = useMemo(() => {
    const match = location.pathname.match(/^(\/kiosk\/[^/]+)/);
    return match ? match[1] : "";
  }, [location.pathname]);

  // Helper to build full path with kiosk prefix if needed
  const buildPath = useCallback((path: string) => {
    return basePath ? `${basePath}/${path}` : `/${path}`;
  }, [basePath]);

  // Media items with correct paths
  const mediaItems = useMemo(() =>
    mediaItemsBase.map(item => ({
      to: buildPath(item.path),
      icon: item.icon,
      label: item.label,
    })),
    [buildPath]
  );

  // Check if current route is a media route
  const isMediaRoute = location.pathname.endsWith("/spotify") || location.pathname.endsWith("/iptv");

  // Auto-open media menu when on a media route
  useEffect(() => {
    if (isMediaRoute) {
      setIsMediaMenuOpen(true);
    }
  }, [isMediaRoute]);

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

  const activateScreensaver = useCallback(() => {
    if (screensaverEnabled) {
      setScreensaverActive(true);
    }
  }, [screensaverEnabled, setScreensaverActive]);

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

  // Helper to check if a feature is enabled
  const isFeatureEnabled = useCallback((feature: keyof KioskEnabledFeatures) => {
    if (!kioskEnabledFeatures) return true; // No restrictions
    // Backward compat: "kitchen" also checks legacy "recipes" key
    if (feature === "kitchen" as any) {
      return kioskEnabledFeatures["kitchen" as keyof KioskEnabledFeatures] !== false
        || kioskEnabledFeatures["recipes" as keyof KioskEnabledFeatures] !== false;
    }
    return kioskEnabledFeatures[feature] !== false;
  }, [kioskEnabledFeatures]);

  // Build nav items based on authentication status (with kiosk prefix if needed)
  const navItems = useMemo(() => {
    const items = [
      { to: buildPath("calendar"), icon: Calendar, label: "Calendar", feature: "calendar" as const },
      { to: buildPath("tasks"), icon: ListTodo, label: "Tasks", feature: "tasks" as const },
      { to: buildPath("routines"), icon: ListChecks, label: "Routines", feature: "routines" as const },
      { to: buildPath("dashboard"), icon: LayoutDashboard, label: "Dashboard", feature: "dashboard" as const },
      { to: buildPath("photos"), icon: Image, label: "Photos", feature: "photos" as const },
      // Media is handled separately with submenu
      { to: buildPath("cameras"), icon: Camera, label: "Cameras", feature: "cameras" as const },
      { to: buildPath("multiview"), icon: LayoutGrid, label: "Multi-View", feature: "multiview" as const },
      { to: buildPath("homeassistant"), icon: Home, label: "Home Assistant", feature: "homeassistant" as const },
      { to: buildPath("map"), icon: MapPin, label: "Map", feature: "map" as const },
      { to: buildPath("kitchen"), icon: ChefHat, label: "Kitchen", feature: "kitchen" as const },
      { to: buildPath("chat"), icon: MessageCircle, label: "Chat", feature: "chat" as const },
      { to: buildPath("screensaver"), icon: Monitor, label: "Custom", feature: "screensaver" as const },
    ];

    // Filter items based on enabled features
    let filteredItems;
    if (kioskEnabledFeatures) {
      // Kiosk mode: use kiosk feature flags
      filteredItems = items.filter(item => isFeatureEnabled(item.feature));
    } else {
      // Normal mode: use sidebar store enabled state
      filteredItems = items.filter(item => {
        const feat = item.feature as SidebarFeature;
        return !sidebarFeatures[feat] || sidebarFeatures[feat].enabled;
      });
    }

    // Only show reMarkable, profiles, and settings if authenticated AND not accessing via kiosk URL
    if (isAuthenticated && !basePath) {
      filteredItems.push(
        { to: "/remarkable", icon: PenTool, label: "reMarkable", feature: undefined as any },
        { to: "/profiles", icon: Users, label: "Family", feature: undefined as any },
        { to: "/settings", icon: Settings, label: "Settings", feature: undefined as any },
      );
    }

    return filteredItems;
  }, [buildPath, isAuthenticated, basePath, kioskEnabledFeatures, isFeatureEnabled, sidebarFeatures]);

  // Derive pinned vs more items (non-kiosk only)
  const pinnedItems = useMemo(() => {
    if (kioskEnabledFeatures) return navItems; // kiosk: all items are "pinned"
    return navItems.filter(item => {
      const feat = item.feature as SidebarFeature;
      if (!feat) return true; // auth-only items always pinned
      return !sidebarFeatures[feat] || sidebarFeatures[feat].pinned;
    });
  }, [navItems, kioskEnabledFeatures, sidebarFeatures]);

  const moreItems = useMemo(() => {
    if (kioskEnabledFeatures) return []; // kiosk: no overflow
    return navItems.filter(item => {
      const feat = item.feature as SidebarFeature;
      if (!feat) return false; // auth-only items never in More
      return sidebarFeatures[feat] && !sidebarFeatures[feat].pinned;
    });
  }, [navItems, kioskEnabledFeatures, sidebarFeatures]);

  // Check if media features are enabled and pinned
  const spotifyEnabled = kioskEnabledFeatures ? isFeatureEnabled("spotify") : (!sidebarFeatures.spotify || sidebarFeatures.spotify.enabled);
  const iptvEnabled = kioskEnabledFeatures ? isFeatureEnabled("iptv") : (!sidebarFeatures.iptv || sidebarFeatures.iptv.enabled);
  const spotifyPinned = kioskEnabledFeatures ? true : (!sidebarFeatures.spotify || sidebarFeatures.spotify.pinned);
  const iptvPinned = kioskEnabledFeatures ? true : (!sidebarFeatures.iptv || sidebarFeatures.iptv.pinned);

  // Show media button in sidebar if at least one media item is enabled AND pinned
  const showMedia = (spotifyEnabled && spotifyPinned) || (iptvEnabled && iptvPinned);

  // Filter media items for sidebar (pinned ones)
  const filteredMediaItems = useMemo(() => {
    return mediaItems.filter(item => {
      if (item.label === "Spotify") return spotifyEnabled && spotifyPinned;
      if (item.label === "Live TV") return iptvEnabled && iptvPinned;
      return true;
    });
  }, [mediaItems, spotifyEnabled, spotifyPinned, iptvEnabled, iptvPinned]);

  // Media items for More menu (enabled but unpinned)
  const moreMediaItems = useMemo(() => {
    if (kioskEnabledFeatures) return [];
    return mediaItems.filter(item => {
      if (item.label === "Spotify") return spotifyEnabled && !spotifyPinned;
      if (item.label === "Live TV") return iptvEnabled && !iptvPinned;
      return false;
    });
  }, [mediaItems, kioskEnabledFeatures, spotifyEnabled, spotifyPinned, iptvEnabled, iptvPinned]);

  // Click outside handler for More menu
  useEffect(() => {
    if (!isMoreMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node) &&
        moreButtonRef.current && !moreButtonRef.current.contains(e.target as Node)
      ) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isMoreMenuOpen]);

  // Screensaver behavior: hide toolbar when idle (smooth slide)
  const screensaverActive = useScreensaverStore((s) => s.isActive);
  const screensaverBehavior = useScreensaverStore((s) => s.behavior);
  const hideToolbarForBurnIn = screensaverActive && screensaverBehavior === "hide-toolbar";

  // Display-only mode: hide sidebar entirely (hard remove from DOM)
  const hideNav = kioskDisplayType === "display";
  // TV mode: larger nav items with focus rings for D-pad navigation
  const isTvMode = kioskDisplayType === "tv";

  // Block navigation for TV sidebar
  const blockNavMode = useBlockNavStore((s) => s.mode);
  const focusedBlockId = useBlockNavStore((s) => s.focusedBlockId);
  const registerBlocks = useBlockNavStore((s) => s.registerBlocks);
  const clearBlocks = useBlockNavStore((s) => s.clearBlocks);

  // Register sidebar nav items as navigable blocks (at x=-1, left of page content)
  useEffect(() => {
    if (!isTvMode || hideNav) return;

    // Build sidebar blocks from visible nav items
    const sidebarBlocks: NavigableBlock[] = navItems.map((item, index) => ({
      id: `nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`,
      group: "nav",
      x: -1,
      y: index,
      width: 1,
      height: 1,
      label: item.label,
      instantAction: () => navigate(item.to),
    }));

    registerBlocks(sidebarBlocks, "nav");
    return () => clearBlocks("nav");
  }, [isTvMode, hideNav, navItems, navigate, registerBlocks, clearBlocks]);

  // Helper to get block nav focus classes for a sidebar item
  const getNavBlockClasses = (itemLabel: string) => {
    if (blockNavMode === "idle") return "";
    const blockId = `nav-${itemLabel.toLowerCase().replace(/\s+/g, "-")}`;
    const isFocused = focusedBlockId === blockId;
    if (blockNavMode === "selecting" && isFocused) {
      return "ring-3 ring-primary/80 shadow-[0_0_20px_hsl(var(--primary)/0.4)] scale-110";
    }
    if (blockNavMode === "controlling" && !isFocused) {
      return "opacity-30";
    }
    return "";
  };

  // Check if a sidebar item is focused (for showing label tooltip)
  const isNavItemFocused = (itemLabel: string) => {
    if (blockNavMode !== "selecting") return false;
    const blockId = `nav-${itemLabel.toLowerCase().replace(/\s+/g, "-")}`;
    return focusedBlockId === blockId;
  };

  // React Router v7 wraps navigations in startTransition which can fail to commit
  // from certain pages (builder pages). Force a hard navigation as a workaround.
  const handleNavClick = useCallback((to: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    setIsMobileSidebarOpen(false);
    setIsMediaMenuOpen(false);
    setIsMoreMenuOpen(false);
    const path = window.location.pathname;
    if (path.includes("/screensaver-builder") || path.includes("/planner")) {
      e.preventDefault();
      window.location.href = to;
    }
  }, []);

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile Menu Button */}
      {!hideNav && !hideToolbarForBurnIn && (
      <button
        onClick={() => setIsMobileSidebarOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-3 rounded-lg bg-card border border-border min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5 text-foreground" />
      </button>
      )}

      {/* Mobile Sidebar Overlay */}
      {!hideNav && isMobileSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      {!hideNav && <aside
        className={cn(
          "fixed lg:relative z-50 lg:z-auto h-full flex w-16 flex-col items-center border-r border-border bg-card py-4 transform transition-transform duration-500 ease-in-out",
          hideToolbarForBurnIn
            ? "-translate-x-full"
            : isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
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

        <nav className={cn("flex flex-1 flex-col items-center", isTvMode ? "gap-3" : "gap-2")}>
          {/* Pinned nav items before media */}
          {pinnedItems.filter(item => ["Calendar", "Tasks", "Dashboard", "Photos"].includes(item.label)).map((item) => (
            <div key={item.to} className="relative">
              <NavLink
                to={item.to}
                tabIndex={isTvMode ? 0 : undefined}
                onClick={handleNavClick(item.to)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center justify-center rounded-lg transition-all duration-200",
                    isTvMode ? "h-12 w-12 focus:outline-none focus:ring-2 focus:ring-primary/50" : "h-10 w-10",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    isTvMode && getNavBlockClasses(item.label)
                  )
                }
                title={item.label}
              >
                <item.icon className={isTvMode ? "h-6 w-6" : "h-5 w-5"} />
              </NavLink>
              {isTvMode && isNavItemFocused(item.label) && (
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-black/90 text-white text-sm px-3 py-1.5 rounded-lg whitespace-nowrap z-50 pointer-events-none border border-primary/30">
                  {item.label}
                </div>
              )}
            </div>
          ))}

          {/* Media button with submenu - only show if at least one media item is pinned */}
          {showMedia && (
            <button
              onClick={() => setIsMediaMenuOpen(!isMediaMenuOpen)}
              tabIndex={isTvMode ? 0 : undefined}
              className={cn(
                "flex items-center justify-center rounded-lg transition-colors",
                isTvMode ? "h-12 w-12 focus:outline-none focus:ring-2 focus:ring-primary/50" : "h-10 w-10",
                isMediaRoute || isMediaMenuOpen
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
              title="Media"
            >
              <Play className={isTvMode ? "h-6 w-6" : "h-5 w-5"} />
            </button>
          )}

          {/* Remaining pinned nav items (after media) */}
          {pinnedItems.filter(item => !["Calendar", "Tasks", "Dashboard", "Photos"].includes(item.label)).map((item) => (
            <div key={item.to} className="relative">
              <NavLink
                to={item.to}
                tabIndex={isTvMode ? 0 : undefined}
                onClick={handleNavClick(item.to)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center justify-center rounded-lg transition-all duration-200",
                    isTvMode ? "h-12 w-12 focus:outline-none focus:ring-2 focus:ring-primary/50" : "h-10 w-10",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    isTvMode && getNavBlockClasses(item.label)
                  )
                }
                title={item.label}
              >
                <item.icon className={isTvMode ? "h-6 w-6" : "h-5 w-5"} />
              </NavLink>
              {isTvMode && isNavItemFocused(item.label) && (
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-black/90 text-white text-sm px-3 py-1.5 rounded-lg whitespace-nowrap z-50 pointer-events-none border border-primary/30">
                  {item.label}
                </div>
              )}
            </div>
          ))}

          {/* More button - show overflow items */}
          {(moreItems.length > 0 || moreMediaItems.length > 0) && (
            <button
              ref={moreButtonRef}
              onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
              className={cn(
                "flex items-center justify-center rounded-lg transition-colors",
                "h-10 w-10",
                isMoreMenuOpen
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
              title="More"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
          )}
        </nav>

        <div className="flex flex-col items-center gap-2">
          {/* Kiosk mode indicator */}
          {isKioskPath && (
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500"
              title="Kiosk Mode"
            >
              <Monitor className="h-5 w-5" />
            </div>
          )}
          {/* Screensaver toggle */}
          {screensaverEnabled && (
            <button
              onClick={activateScreensaver}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              title="Start screensaver"
            >
              <Moon className="h-5 w-5" />
            </button>
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
          {/* Hide logout/login in kiosk mode */}
          {!isKioskPath && (
            isAuthenticated ? (
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
            )
          )}
        </div>
      </aside>}

      {/* Media Submenu - appears to the right of sidebar */}
      {!hideNav && !hideToolbarForBurnIn && isMediaMenuOpen && showMedia && (
        <aside className="fixed lg:relative z-40 lg:z-auto h-full flex w-16 flex-col items-center border-r border-border bg-card/95 backdrop-blur-sm py-4 left-16 lg:left-auto">
          <div className="flex flex-col items-center gap-2 mt-[72px]">
            {filteredMediaItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={handleNavClick(item.to)}
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
          </div>
        </aside>
      )}

      {/* More Menu Popup - appears to the right of sidebar */}
      {!hideNav && !hideToolbarForBurnIn && isMoreMenuOpen && (moreItems.length > 0 || moreMediaItems.length > 0) && (
        <div
          ref={moreMenuRef}
          className="fixed z-50 left-16 top-0 h-full w-48 border-r border-border bg-card/95 backdrop-blur-sm py-4 shadow-lg"
        >
          <div className="flex flex-col gap-1 px-2">
            <p className="text-xs font-medium text-muted-foreground px-2 py-1 uppercase tracking-wider">More</p>
            {moreMediaItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={handleNavClick(item.to)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-2 py-2 rounded-lg transition-colors text-sm",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
            {moreItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={handleNavClick(item.to)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-2 py-2 rounded-lg transition-colors text-sm",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="relative flex-1 overflow-auto pt-16 lg:pt-0">
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </main>

    </div>
  );
}
