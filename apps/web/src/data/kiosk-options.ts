import type { KioskDisplayMode, KioskDisplayType, KioskEnabledFeatures } from "../services/api";

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
