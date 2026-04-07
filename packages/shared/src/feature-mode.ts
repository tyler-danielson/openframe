import type { UserMode } from "./types/index.js";

/**
 * Central feature registry for Simple/Advanced user mode.
 *
 * Features listed here with modes: ["advanced"] are hidden in Simple mode.
 * Features with modes: ["simple", "advanced"] are always visible.
 * Unknown feature IDs default to visible (advanced users see everything).
 */

// Sidebar / navigation features (keys match BUILTIN_FEATURE_MAP in Layout.tsx)
const ADVANCED_SIDEBAR_FEATURES = new Set([
  "cameras",
  "multiview",
  "homeassistant",
  "matter",
  "map",
  "screensaver",
  "chat",
  "routines",
  "files",
  "cardview",
]);

// Media sub-items
const ADVANCED_MEDIA_FEATURES = new Set([
  "spotify",
  "iptv",
  "siriusxm",
]);

// Settings tabs that are advanced-only
const ADVANCED_SETTINGS_TABS = new Set([
  "kiosks",
  "ai",
  "assumptions",
  "automations",
  "cameras",
  "custom-screens",
  "planner",
  "system",
  "users",
  "instances",
  "companion",
]);

// Productivity features hidden in Simple mode (goals, gamification — habits/streaks always visible)
const ADVANCED_PRODUCTIVITY_FEATURES = new Set([
  "goals",
  "gamification",
  "leaderboard",
  "scoreboard",
]);

// Route paths that are advanced-only (used by ModeGate)
const ADVANCED_ROUTES = new Set([
  "iptv",
  "siriusxm",
  "cameras",
  "multiview",
  "homeassistant",
  "matter",
  "map",
  "screensaver-builder",
  "remarkable",
  "chat",
  "automations",
  "routines",
  "files",
  "cardview",
  "scoreboard",
]);

/**
 * Check if a sidebar feature is available in the given mode.
 */
export function isSidebarFeatureAvailable(featureId: string, mode: UserMode): boolean {
  if (mode === "advanced") return true;
  return !ADVANCED_SIDEBAR_FEATURES.has(featureId);
}

/**
 * Check if a media feature is available in the given mode.
 */
export function isMediaFeatureAvailable(featureId: string, mode: UserMode): boolean {
  if (mode === "advanced") return true;
  return !ADVANCED_MEDIA_FEATURES.has(featureId);
}

/**
 * Check if a settings tab is available in the given mode.
 */
export function isSettingsTabAvailable(tabId: string, mode: UserMode): boolean {
  if (mode === "advanced") return true;
  return !ADVANCED_SETTINGS_TABS.has(tabId);
}

/**
 * Check if a route is available in the given mode.
 */
export function isRouteAvailable(routePath: string, mode: UserMode): boolean {
  if (mode === "advanced") return true;
  return !ADVANCED_ROUTES.has(routePath);
}

/**
 * Check if a productivity feature (goals, gamification, leaderboard, scoreboard) is available.
 * Habits and streaks are always available in both modes.
 */
export function isProductivityFeatureAvailable(featureId: string, mode: UserMode): boolean {
  if (mode === "advanced") return true;
  return !ADVANCED_PRODUCTIVITY_FEATURES.has(featureId);
}
