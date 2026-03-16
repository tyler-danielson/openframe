import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { NavLink, Outlet, useNavigate, useLocation, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Image,
  LayoutDashboard,
  LayoutGrid,
  Settings,
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
  Shield,
  Cpu,
  Kanban,
  UserPlus,
  HelpCircle,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { resolveLucideIcon as sharedResolveLucideIcon, isCustomIcon } from "../../lib/icon-utils";
import { DashboardIcon } from "./DashboardIcon";
import { api, type KioskEnabledFeatures, type KioskDisplayType, type KioskDashboard } from "../../services/api";
import { getDashboardTypeOption } from "../../data/kiosk-options";
import { useAuthStore } from "../../stores/auth";
import { isCloudMode } from "../../lib/cloud";
import { useSidebarStore, SIDEBAR_FEATURES, type SidebarFeature } from "../../stores/sidebar";
import { useModuleStore } from "../../stores/modules";
import type { CustomScreen } from "@openframe/shared";
import { useHAWebSocket } from "../../stores/homeassistant-ws";
import { useScreensaverStore } from "../../stores/screensaver";
import { useBlockNavStore, type NavigableBlock } from "../../stores/block-nav";
import { cn } from "../../lib/utils";
import { SidebarHelpOverlay, type HelpItem } from "../SidebarHelpOverlay";
import { useDemoMode } from "../../contexts/DemoContext";
import { useSplitScreenStore } from "../../stores/split-screen";
import { SplitScreenContainer } from "../SplitScreenContainer";

interface LayoutProps {
  kioskEnabledFeatures?: KioskEnabledFeatures | null;
  kioskDisplayType?: KioskDisplayType | null;
  kioskDashboards?: KioskDashboard[] | null;
  kioskControls?: { fullscreen?: boolean; screensaver?: boolean; settings?: boolean; reload?: boolean; join?: boolean } | null;
  className?: string;
  basePath?: string;
}

// Built-in feature definitions (icon + route + label)
const BUILTIN_FEATURE_MAP: Record<string, { icon: any; path: string; label: string; moduleId: string | null }> = {
  calendar: { icon: Calendar, path: "calendar", label: "Calendar", moduleId: null },
  tasks: { icon: ListTodo, path: "tasks", label: "Tasks", moduleId: null },
  routines: { icon: ListChecks, path: "routines", label: "Routines", moduleId: "routines" },
  dashboard: { icon: LayoutDashboard, path: "dashboard", label: "Dashboard", moduleId: null },
  cardview: { icon: Kanban, path: "cardview", label: "Card View", moduleId: null },
  photos: { icon: Image, path: "photos", label: "Photos", moduleId: "photos" },
  cameras: { icon: Camera, path: "cameras", label: "Cameras", moduleId: "cameras" },
  multiview: { icon: LayoutGrid, path: "multiview", label: "Multi-View", moduleId: "cameras" },
  homeassistant: { icon: Home, path: "homeassistant", label: "Home Assistant", moduleId: "homeassistant" },
  matter: { icon: Cpu, path: "matter", label: "Matter", moduleId: "matter" },
  map: { icon: MapPin, path: "map", label: "Map", moduleId: "map" },
  kitchen: { icon: ChefHat, path: "kitchen", label: "Kitchen", moduleId: "recipes" },
  chat: { icon: MessageCircle, path: "chat", label: "Chat", moduleId: "ai-chat" },
  screensaver: { icon: Monitor, path: "screensaver", label: "Custom Screen", moduleId: null },
};

/** Resolve a lucide icon name to a component (fallback to LayoutDashboard) */
function resolveLucideIcon(name: string): React.ComponentType<{ className?: string }> {
  return sharedResolveLucideIcon(name);
}

// Media sub-items (base paths, will be prefixed in component)
const mediaItemsBase = [
  { path: "spotify", icon: Music, label: "Spotify" },
  { path: "iptv", icon: Tv, label: "Live TV" },
];

export function Layout({ kioskEnabledFeatures, kioskDisplayType, kioskDashboards, kioskControls, className, basePath: baseProp }: LayoutProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { setUser, isAuthenticated, isDemo, user: authUser } = useAuthStore();

  const isKioskPath = window.location.pathname.startsWith("/kiosk/");
  const setScreensaverActive = useScreensaverStore((state) => state.setActive);
  const screensaverEnabled = useScreensaverStore((state) => state.enabled);
  const setScreensaverEnabled = useScreensaverStore((state) => state.setEnabled);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMediaMenuOpen, setIsMediaMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarFeatures = useSidebarStore((s) => s.features);
  const sidebarOrder = useSidebarStore((s) => s.order);
  const sidebarCustomScreens = useSidebarStore((s) => s.customScreens);
  const isModuleEnabled = useModuleStore((s) => s.isEnabled);
  const splitActive = useSplitScreenStore((s) => s.isActive);

  // Detect kiosk mode base path from URL (e.g., /kiosk/abc123), or use explicit basePath prop (e.g., /demo)
  const basePath = useMemo(() => {
    if (baseProp) return baseProp;
    const match = location.pathname.match(/^(\/kiosk\/[^/]+)/);
    return match ? match[1] : "";
  }, [baseProp, location.pathname]);

  // Helper to build full path with kiosk prefix if needed
  const buildPath = useCallback((path: string) => {
    return basePath ? `${basePath}/${path}` : `/${path}`;
  }, [basePath]);

  // Fetch custom screens for navigation
  const hasCustomDashboards = kioskDashboards?.some(db => db.type === "custom") ?? false;
  const { data: customScreensData } = useQuery({
    queryKey: ["custom-screens"],
    queryFn: () => api.getCustomScreens(),
    enabled: (isAuthenticated && !basePath) || hasCustomDashboards,
    staleTime: 30_000,
  });
  const customScreensMap = useMemo(() => {
    const map: Record<string, CustomScreen> = {};
    if (customScreensData) {
      for (const s of customScreensData) map[s.id] = s;
    }
    return map;
  }, [customScreensData]);

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

  const { isDemoMode } = useDemoMode();

  const handleReconnectAll = async () => {
    if (isDemoMode || isReconnecting) return;

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

  // Build nav items based on order array, authentication status, and custom screens
  const navItems = useMemo(() => {
    type NavItem = { to: string; icon: any; label: string; feature: string | undefined; moduleId: string | null; isCustom?: boolean; isPinned?: boolean; dashboardId?: string };
    const items: NavItem[] = [];

    // If kioskDashboards is provided, build nav directly from dashboards array
    if (kioskDashboards && kioskDashboards.length > 0) {
      // Track first occurrence of each type for short paths
      const typeCount: Record<string, number> = {};
      for (const db of kioskDashboards) {
        const count = typeCount[db.type] ?? 0;
        typeCount[db.type] = count + 1;
        const opt = getDashboardTypeOption(db.type);
        let routePath: string;
        if (db.type === "custom") {
          // Custom dashboards route to screen/{slug}
          const screenId = db.config?.screenId as string | undefined;
          const screen = screenId ? customScreensMap[screenId] : undefined;
          routePath = screen ? `screen/${screen.slug}` : `d/${db.id}`;
        } else {
          routePath = count === 0
            ? (opt?.path ?? db.type)
            : `d/${db.id}`;
        }
        const iconName = db.icon;
        items.push({
          to: buildPath(routePath),
          icon: isCustomIcon(iconName)
            ? (props: { className?: string }) => <DashboardIcon icon={iconName} {...props} />
            : resolveLucideIcon(iconName),
          label: db.name,
          feature: db.type,
          moduleId: opt?.moduleId ?? null,
          isPinned: db.pinned,
          dashboardId: db.id,
        });
      }
      return items;
    }

    // Iterate through the order array to build items in correct sequence
    for (const key of sidebarOrder) {
      const builtin = BUILTIN_FEATURE_MAP[key];
      if (builtin) {
        // Built-in feature
        items.push({
          to: buildPath(builtin.path),
          icon: builtin.icon,
          label: builtin.label,
          feature: key,
          moduleId: builtin.moduleId,
        });
      } else {
        // Custom screen (UUID key)
        const cs = customScreensMap[key];
        if (cs) {
          items.push({
            to: buildPath(`screen/${cs.slug}`),
            icon: resolveLucideIcon(cs.icon),
            label: cs.name,
            feature: undefined,
            moduleId: null,
            isCustom: true,
          });
        }
      }
    }

    // Also add any custom screens not yet in the order array
    if (customScreensData) {
      const orderSet = new Set(sidebarOrder);
      for (const cs of customScreensData) {
        if (!orderSet.has(cs.id)) {
          items.push({
            to: buildPath(`screen/${cs.slug}`),
            icon: resolveLucideIcon(cs.icon),
            label: cs.name,
            feature: undefined,
            moduleId: null,
            isCustom: true,
          });
        }
      }
    }

    // First filter: remove items whose module is not enabled
    let filteredItems = items.filter(item => !item.moduleId || isModuleEnabled(item.moduleId));

    // Second filter: apply kiosk or sidebar feature flags
    if (kioskEnabledFeatures) {
      // Kiosk mode: use kiosk feature flags
      filteredItems = filteredItems.filter(item =>
        !item.feature || isFeatureEnabled(item.feature as keyof KioskEnabledFeatures)
      );
    } else {
      // Normal mode: use sidebar store enabled state for built-in features
      filteredItems = filteredItems.filter(item => {
        if (item.isCustom) {
          // Custom screens use their own state in sidebarCustomScreens
          return true; // always show if they exist — pin/enable handled below
        }
        const feat = item.feature as SidebarFeature;
        if (!feat) return true;
        return !sidebarFeatures[feat] || sidebarFeatures[feat].enabled;
      });
    }

    // Only show reMarkable, profiles, and admin if authenticated AND not accessing via kiosk URL
    // Settings is rendered separately at the bottom of the sidebar
    if (isAuthenticated && !basePath) {
      const authItems: NavItem[] = [
        { to: "/profiles", icon: Users, label: "Family", feature: undefined, moduleId: null },
      ];
      // Only show reMarkable if module is enabled
      if (isModuleEnabled("remarkable")) {
        authItems.unshift({ to: "/remarkable", icon: PenTool, label: "reMarkable", feature: undefined, moduleId: "remarkable" });
      }
      // Admin link (cloud mode + admin role only)
      if (isCloudMode && authUser?.role === "admin") {
        authItems.push({ to: "/admin", icon: Shield, label: "Admin", feature: undefined, moduleId: null });
      }
      filteredItems.push(...authItems);
    }

    return filteredItems;
  }, [buildPath, isAuthenticated, basePath, kioskEnabledFeatures, kioskDashboards, isFeatureEnabled, sidebarFeatures, sidebarOrder, sidebarCustomScreens, customScreensMap, customScreensData, isModuleEnabled, authUser]);

  // Helper to check pinned state for any nav item (built-in or custom)
  const isItemPinned = useCallback((item: { feature: string | undefined; isCustom?: boolean; to: string }) => {
    if (item.isCustom) {
      // Find custom screen ID from the to path
      const cs = customScreensData?.find(s => item.to.endsWith(`/screen/${s.slug}`));
      if (cs) {
        const state = sidebarCustomScreens[cs.id];
        return !state || state.pinned; // default pinned
      }
      return true;
    }
    const feat = item.feature as SidebarFeature;
    if (!feat) return true; // auth-only items always pinned
    return !sidebarFeatures[feat] || sidebarFeatures[feat].pinned;
  }, [sidebarFeatures, sidebarCustomScreens, customScreensData]);

  // Derive pinned vs more items
  const pinnedItems = useMemo(() => {
    if (kioskDashboards && kioskDashboards.length > 0) {
      return navItems.filter(item => item.isPinned !== false);
    }
    if (kioskEnabledFeatures) return navItems; // legacy kiosk: all items are "pinned"
    return navItems.filter(item => isItemPinned(item));
  }, [navItems, kioskEnabledFeatures, kioskDashboards, isItemPinned]);

  const moreItems = useMemo(() => {
    if (kioskDashboards && kioskDashboards.length > 0) {
      return navItems.filter(item => item.isPinned === false);
    }
    if (kioskEnabledFeatures) return []; // legacy kiosk: no overflow
    return navItems.filter(item => {
      if (item.isCustom) {
        return !isItemPinned(item);
      }
      const feat = item.feature as SidebarFeature;
      if (!feat) return false; // auth-only items never in More
      return sidebarFeatures[feat] && !sidebarFeatures[feat].pinned;
    });
  }, [navItems, kioskEnabledFeatures, kioskDashboards, sidebarFeatures, isItemPinned]);

  // Check if media features are enabled (module + sidebar/kiosk)
  // When dashboards are provided, media items are regular nav items (no separate submenu)
  const hasDashboards = kioskDashboards && kioskDashboards.length > 0;
  const spotifyModuleOn = isModuleEnabled("spotify");
  const iptvModuleOn = isModuleEnabled("iptv");
  const spotifyEnabled = !hasDashboards && spotifyModuleOn && (kioskEnabledFeatures ? isFeatureEnabled("spotify") : (!sidebarFeatures.spotify || sidebarFeatures.spotify.enabled));
  const iptvEnabled = !hasDashboards && iptvModuleOn && (kioskEnabledFeatures ? isFeatureEnabled("iptv") : (!sidebarFeatures.iptv || sidebarFeatures.iptv.enabled));
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

  // Build help overlay items dynamically based on what's currently visible
  const helpNavItems = useMemo((): HelpItem[] => {
    const descriptions: Record<string, string> = {
      "Calendar": "Events and schedules",
      "Tasks": "To-do items",
      "Routines": "Daily routines",
      "Dashboard": "HA dashboard",
      "Card View": "Card-based layout",
      "Photos": "Photo albums",
      "Cameras": "Live camera feeds",
      "Multi-View": "Multi-camera layout",
      "Home Assistant": "Smart home controls",
      "Matter": "Matter devices",
      "Map": "Location map",
      "Kitchen": "Recipes and cooking",
      "Chat": "AI assistant",
      "Family": "Family profiles",
      "reMarkable": "reMarkable tablet",
      "Admin": "Administration",
    };
    const items: HelpItem[] = pinnedItems.map((item) => ({
      icon: item.icon,
      label: item.label,
      description: descriptions[item.label] || "Custom screen",
    }));
    if (showMedia) {
      items.push({ icon: Play, label: "Media", description: "Spotify and Live TV" });
    }
    return items;
  }, [pinnedItems, showMedia]);

  const helpControlItems = useMemo((): HelpItem[] => {
    const items: HelpItem[] = [];
    if (screensaverEnabled && kioskControls?.screensaver !== false) {
      items.push({ icon: Moon, label: "Screensaver", description: "Start screensaver" });
    }
    if (kioskControls?.screensaver !== false) {
      items.push({ icon: Moon, label: "Disable Screensaver", description: "Toggle auto-screensaver" });
    }
    if (kioskControls?.fullscreen !== false) {
      items.push({ icon: Maximize, label: "Fullscreen", description: "Toggle fullscreen" });
    }
    if (kioskControls?.reload !== false) {
      items.push({ icon: RefreshCw, label: "Reconnect", description: "Reconnect services" });
    }
    if (kioskControls?.join === true) {
      items.push({ icon: UserPlus, label: "Join", description: "Show QR code" });
    }
    if (isAuthenticated && !isKioskPath && kioskControls?.settings !== false) {
      items.push({ icon: Settings, label: "Settings", description: "App settings" });
    }
    items.push({ icon: HelpCircle, label: "Help", description: "This guide" });
    return items;
  }, [screensaverEnabled, kioskControls, isAuthenticated, isKioskPath]);

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
  // TV mode: hide sidebar, use popup nav instead
  const hideNav = kioskDisplayType === "display" || kioskDisplayType === "tv";
  const isTvMode = kioskDisplayType === "tv";

  // Block navigation for TV sidebar
  const blockNavMode = useBlockNavStore((s) => s.mode);
  const focusedBlockId = useBlockNavStore((s) => s.focusedBlockId);
  const registerBlocks = useBlockNavStore((s) => s.registerBlocks);
  const clearBlocks = useBlockNavStore((s) => s.clearBlocks);

  // TV popup nav state
  const tvNavOpen = useBlockNavStore((s) => s.tvNavOpen);
  const tvNavIndex = useBlockNavStore((s) => s.tvNavIndex);
  const setTvNavOpen = useBlockNavStore((s) => s.setTvNavOpen);
  const setTvNavIndex = useBlockNavStore((s) => s.setTvNavIndex);

  // All TV popup nav items (main items + media items combined)
  const tvPopupItems = useMemo(() => {
    const items = [...navItems];
    // Insert media items after Photos if media is enabled
    if (showMedia) {
      const photosIdx = items.findIndex(i => i.label === "Photos");
      const insertIdx = photosIdx >= 0 ? photosIdx + 1 : items.length;
      filteredMediaItems.forEach((mi, i) => {
        items.splice(insertIdx + i, 0, { ...mi, feature: undefined as any, moduleId: null });
      });
    }
    return items;
  }, [navItems, showMedia, filteredMediaItems]);

  // Handle TV popup nav selection
  const handleTvNavSelect = useCallback((index: number) => {
    const item = tvPopupItems[index];
    if (item) {
      setTvNavOpen(false);
      navigate(item.to);
    }
  }, [tvPopupItems, navigate, setTvNavOpen]);

  // Register sidebar nav items as navigable blocks (at x=-1, left of page content)
  useEffect(() => {
    if (!isTvMode) return;

    // Build nav blocks from popup items so block-nav store knows about them
    const sidebarBlocks: NavigableBlock[] = tvPopupItems.map((item, index) => ({
      id: `nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`,
      group: "nav",
      x: index,
      y: 0,
      width: 1,
      height: 1,
      label: item.label,
      instantAction: () => {
        setTvNavOpen(false);
        navigate(item.to);
      },
    }));

    registerBlocks(sidebarBlocks, "nav");
    return () => clearBlocks("nav");
  }, [isTvMode, tvPopupItems, navigate, registerBlocks, clearBlocks, setTvNavOpen]);

  // Helper to get block nav focus classes for a sidebar item (unused in TV popup, kept for non-TV)
  const getNavBlockClasses = (_itemLabel: string) => {
    return "";
  };

  // Check if a sidebar item is focused (unused in TV popup, kept for non-TV)
  const isNavItemFocused = (_itemLabel: string) => {
    return false;
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
    <div className={cn("flex h-screen max-w-full overflow-hidden bg-background", isDemo ? "pt-10" : "", className)}>
      {/* Demo Banner */}
      {isDemo && (
        <div className="fixed top-0 inset-x-0 z-[60] flex items-center justify-center gap-4 bg-primary px-4 py-2 text-primary-foreground text-sm">
          <span>You're exploring the live demo. Changes reset between sessions.</span>
          <a
            href={isCloudMode ? "https://openframe.us/login" : "/login"}
            className="rounded-md bg-primary-foreground/20 px-3 py-0.5 font-medium hover:bg-primary-foreground/30 transition-colors"
          >
            Sign Up Free
          </a>
        </div>
      )}
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
          "fixed lg:relative z-50 lg:z-auto h-full flex w-16 shrink-0 flex-col items-center border-r border-primary/15 bg-card py-4 transform transition-transform duration-500 ease-in-out",
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
          {hasDashboards ? (
            /* Dashboard-based nav: all items in order, no media submenu */
            pinnedItems.map((item) => (
              <div key={item.dashboardId ?? item.to} className="relative">
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
                    )
                  }
                  title={item.label}
                >
                  <item.icon className={isTvMode ? "h-6 w-6" : "h-5 w-5"} />
                </NavLink>
              </div>
            ))
          ) : (
            <>
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
            </>
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
          {/* Custom screen toggle */}
          {screensaverEnabled && kioskControls?.screensaver !== false && (
            <button
              onClick={activateScreensaver}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              title="Start custom screen"
            >
              <Moon className="h-5 w-5" />
            </button>
          )}
          {/* Disable/enable screensaver toggle — always shows moon with slash;
              highlighted when screensaver is disabled (i.e. "disable screensaver" is active) */}
          {kioskControls?.screensaver !== false && (
            <button
              onClick={() => {
                const next = !screensaverEnabled;
                setScreensaverEnabled(next);
                if (!next) setScreensaverActive(false);
              }}
              className={cn(
                "relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                !screensaverEnabled
                  ? "bg-primary/10 text-primary hover:bg-primary/20"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
              title={screensaverEnabled ? "Disable screensaver" : "Screensaver disabled — click to enable"}
            >
              <Moon className="h-5 w-5" />
              <div className="absolute h-6 w-0.5 bg-current rotate-45 rounded-full" />
            </button>
          )}
          {/* Fullscreen toggle */}
          {kioskControls?.fullscreen !== false && (
            <button
              onClick={toggleFullscreen}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </button>
          )}
          {kioskControls?.reload !== false && (
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
          )}
          {/* Join button — kiosk QR code page */}
          {kioskControls?.join === true && (
            <button
              onClick={() => navigate(buildPath("join"))}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              title="Join — show QR code"
            >
              <UserPlus className="h-5 w-5" />
            </button>
          )}
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
          {/* Settings at the bottom */}
          {isAuthenticated && !isKioskPath && kioskControls?.settings !== false && (
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )
              }
              title="Settings"
            >
              <Settings className="h-5 w-5" />
            </NavLink>
          )}
          {/* Help button — always at the very bottom */}
          <button
            onClick={() => setIsHelpOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            title="Help — what do these icons mean?"
          >
            <HelpCircle className="h-5 w-5" />
          </button>
        </div>
      </aside>}

      <SidebarHelpOverlay
        visible={isHelpOpen}
        onDismiss={() => setIsHelpOpen(false)}
        navItems={helpNavItems}
        controlItems={helpControlItems}
      />

      {/* Media Submenu - appears to the right of sidebar */}
      {!hideNav && !hideToolbarForBurnIn && isMediaMenuOpen && showMedia && (
        <aside className="fixed lg:relative z-40 lg:z-auto h-full flex w-16 shrink-0 flex-col items-center border-r border-primary/15 bg-card/95 backdrop-blur-sm py-4 left-16 lg:left-auto">
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
          className="fixed z-50 left-16 top-0 h-full w-48 border-r border-primary/15 bg-card/95 backdrop-blur-sm py-4 shadow-lg"
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
      <main className={cn("relative flex-1 min-w-0 min-h-0 pt-16 lg:pt-0", splitActive ? "overflow-hidden" : "overflow-y-auto overflow-x-hidden")}>
        <SplitScreenContainer>
          <Outlet />
        </SplitScreenContainer>
      </main>

      {/* TV Popup Navigation Overlay */}
      {isTvMode && tvNavOpen && (
        <div className="fixed inset-x-0 bottom-0 z-[100] h-[15vh] bg-black/90 backdrop-blur-md border-t border-primary/30 animate-in slide-in-from-bottom duration-200">
          <div className="h-full flex items-center justify-center px-4">
            <div className="flex items-center gap-1 overflow-x-auto max-w-full px-4">
              {tvPopupItems.map((item, index) => {
                const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
                const isFocused = tvNavIndex === index;
                return (
                  <button
                    key={item.to}
                    onClick={() => handleTvNavSelect(index)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1.5 px-4 py-2 rounded-xl transition-all min-w-[80px] shrink-0",
                      isFocused
                        ? "bg-primary text-primary-foreground scale-110 ring-2 ring-primary shadow-[0_0_20px_hsl(var(--primary)/0.5)]"
                        : isActive
                          ? "bg-primary/20 text-primary"
                          : "text-muted-foreground hover:text-primary hover:bg-white/5"
                    )}
                  >
                    <item.icon className="h-6 w-6" />
                    <span className="text-xs font-medium whitespace-nowrap">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
