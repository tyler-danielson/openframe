import type { UserMode } from "@openframe/shared";
import { isSidebarFeatureAvailable, isMediaFeatureAvailable, isSettingsTabAvailable, isRouteAvailable } from "@openframe/shared";
import { useAuthStore } from "../stores/auth";
import { api } from "../services/api";

/**
 * Hook to read and update the user's display mode (simple/advanced).
 * Defaults to "advanced" for existing users who haven't set a mode.
 */
export function useUserMode() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const mode: UserMode = user?.preferences?.userMode ?? "advanced";

  const setMode = async (newMode: UserMode) => {
    // Optimistic update
    if (user) {
      setUser({
        ...user,
        preferences: { ...user.preferences, userMode: newMode },
      });
    }
    await api.updatePreferences({ userMode: newMode });
  };

  return {
    mode,
    isSimple: mode === "simple",
    isAdvanced: mode === "advanced",
    setMode,
    isSidebarFeatureVisible: (featureId: string) => isSidebarFeatureAvailable(featureId, mode),
    isMediaFeatureVisible: (featureId: string) => isMediaFeatureAvailable(featureId, mode),
    isSettingsTabVisible: (tabId: string) => isSettingsTabAvailable(tabId, mode),
    isRouteVisible: (routePath: string) => isRouteAvailable(routePath, mode),
  };
}

/**
 * Read user mode directly from the store (for use outside hooks, e.g. in useMemo deps).
 */
export function getUserMode(): UserMode {
  return useAuthStore.getState().user?.preferences?.userMode ?? "advanced";
}
