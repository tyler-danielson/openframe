import type { KioskDisplayMode, KioskDisplayType, KioskEnabledFeatures, DashboardType } from "../services/api";

// Display type options (device interaction model)
export const DISPLAY_TYPE_OPTIONS: { value: KioskDisplayType; label: string; description: string }[] = [
  { value: "touch", label: "Touch Screen", description: "Standard touch interaction" },
  { value: "tv", label: "Samsung TV", description: "Remote/D-pad navigation with larger controls" },
  { value: "display", label: "Display Only", description: "No interactive controls, view-only" },
];

// Display mode options
export const DISPLAY_MODE_OPTIONS: { value: KioskDisplayMode; label: string; description: string }[] = [
  { value: "full", label: "Full App", description: "Full navigation with all enabled features" },
  { value: "screensaver-only", label: "Custom Screen Only", description: "Only shows the custom screen, no app UI" },
  { value: "calendar-only", label: "Calendar Only", description: "Only calendar page with custom screen overlay" },
  { value: "dashboard-only", label: "Dashboard Only", description: "Only dashboard page with custom screen overlay" },
];

// Home page options
export const HOME_PAGE_OPTIONS = [
  { value: "cardview", label: "Card View" },
  { value: "calendar", label: "Calendar" },
  { value: "dashboard", label: "Dashboard" },
  { value: "tasks", label: "Tasks" },
  { value: "photos", label: "Photos" },
  { value: "spotify", label: "Spotify" },
  { value: "iptv", label: "Live TV" },
  { value: "cameras", label: "Cameras" },
  { value: "homeassistant", label: "Home Assistant" },
  { value: "map", label: "Map" },
  { value: "kitchen", label: "Kitchen" },
  { value: "screensaver", label: "Screensaver" },
];

// Feature options for kiosk feature toggles
export const FEATURE_OPTIONS: { key: keyof KioskEnabledFeatures; label: string; moduleId?: string }[] = [
  { key: "calendar", label: "Calendar" },
  { key: "dashboard", label: "Dashboard" },
  { key: "tasks", label: "Tasks" },
  { key: "photos", label: "Photos", moduleId: "photos" },
  { key: "spotify", label: "Spotify", moduleId: "spotify" },
  { key: "iptv", label: "Live TV", moduleId: "iptv" },
  { key: "cameras", label: "Cameras", moduleId: "cameras" },
  { key: "homeassistant", label: "Home Assistant", moduleId: "homeassistant" },
  { key: "map", label: "Map", moduleId: "map" },
  { key: "kitchen", label: "Kitchen", moduleId: "recipes" },
  { key: "screensaver", label: "Screensaver" },
  { key: "cardview", label: "Card View" },
];

// Dashboard type options for the new dashboards system
export interface DashboardTypeOption {
  type: DashboardType;
  label: string;
  defaultIcon: string;
  moduleId: string | null;
  allowMultiple: boolean;
  path: string; // base route path
}

export const DASHBOARD_TYPE_OPTIONS: DashboardTypeOption[] = [
  { type: "calendar", label: "Calendar", defaultIcon: "Calendar", moduleId: null, allowMultiple: true, path: "calendar" },
  { type: "tasks", label: "Tasks", defaultIcon: "ListTodo", moduleId: null, allowMultiple: true, path: "tasks" },
  { type: "routines", label: "Routines", defaultIcon: "ListChecks", moduleId: "routines", allowMultiple: false, path: "routines" },
  { type: "dashboard", label: "Dashboard", defaultIcon: "LayoutDashboard", moduleId: null, allowMultiple: false, path: "dashboard" },
  { type: "cardview", label: "Card View", defaultIcon: "Kanban", moduleId: null, allowMultiple: false, path: "cardview" },
  { type: "photos", label: "Photos", defaultIcon: "Image", moduleId: "photos", allowMultiple: false, path: "photos" },
  { type: "spotify", label: "Spotify", defaultIcon: "Music", moduleId: "spotify", allowMultiple: true, path: "spotify" },
  { type: "iptv", label: "Live TV", defaultIcon: "Tv", moduleId: "iptv", allowMultiple: false, path: "iptv" },
  { type: "cameras", label: "Cameras", defaultIcon: "Camera", moduleId: "cameras", allowMultiple: false, path: "cameras" },
  { type: "multiview", label: "Multi-View", defaultIcon: "LayoutGrid", moduleId: "cameras", allowMultiple: false, path: "multiview" },
  { type: "homeassistant", label: "Home Assistant", defaultIcon: "Home", moduleId: "homeassistant", allowMultiple: false, path: "homeassistant" },
  { type: "matter", label: "Matter", defaultIcon: "Cpu", moduleId: "matter", allowMultiple: false, path: "matter" },
  { type: "map", label: "Map", defaultIcon: "MapPin", moduleId: "map", allowMultiple: false, path: "map" },
  { type: "kitchen", label: "Kitchen", defaultIcon: "ChefHat", moduleId: "recipes", allowMultiple: false, path: "kitchen" },
  { type: "chat", label: "Chat", defaultIcon: "MessageCircle", moduleId: "ai-chat", allowMultiple: false, path: "chat" },
  { type: "screensaver", label: "Custom Screen", defaultIcon: "Monitor", moduleId: null, allowMultiple: false, path: "screensaver" },
  { type: "custom", label: "Custom", defaultIcon: "LayoutDashboard", moduleId: null, allowMultiple: true, path: "screen" },
];

/** Get dashboard type option by type */
export function getDashboardTypeOption(type: DashboardType): DashboardTypeOption | undefined {
  return DASHBOARD_TYPE_OPTIONS.find(o => o.type === type);
}

/** Default dashboards for new kiosks */
export function getDefaultDashboards(): import("../services/api").KioskDashboard[] {
  return [
    { id: crypto.randomUUID(), type: "calendar", name: "Calendar", icon: "Calendar", pinned: true, config: {} },
    { id: crypto.randomUUID(), type: "tasks", name: "Tasks", icon: "ListTodo", pinned: true, config: {} },
  ];
}
