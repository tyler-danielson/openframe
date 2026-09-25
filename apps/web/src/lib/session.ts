/**
 * Signing in and out. Several people can use the same browser (a family
 * computer, a tablet on the wall), and on openframe.us every household shares
 * one origin, so what the app keeps in the browser for one person must not
 * be shown to, or sent as, the next one.
 */
import type { StoreApi } from "zustand";
import { api, setSessionExpiredHandler } from "../services/api";
import { useAuthStore, userIdFromToken } from "../stores/auth";
import { useCalendarStore } from "../stores/calendar";
import { useScreensaverStore } from "../stores/screensaver";
import { useDurationAlertStore } from "../stores/duration-alerts";
import { useAutomationNotificationStore } from "../stores/automations";
import { useProfileStore } from "../stores/profile";
import { useModuleStore } from "../stores/modules";
import { useSidebarStore } from "../stores/sidebar";
import { useHAWebSocket } from "../stores/homeassistant-ws";
import { useChatStore } from "../stores/chat";
import { queryClient } from "./query-client";
import { offlineCache } from "./offlineCache";
import { appPath } from "./cloud";

/** Browser storage outside the stores that belongs to the signed-in account. */
const USER_LOCAL_STORAGE_KEYS = ["multiview-selection", "camera-view-selection", "onboarding-dismissed"];
const USER_LOCAL_STORAGE_PREFIXES = ["vacuum_selected_rooms_"];
const USER_SESSION_STORAGE_KEYS = ["openframe_active_fileshare", "onboarding-snoozed"];

/** How long signing out waits for the server to revoke the refresh token. */
const REVOKE_TIMEOUT_MS = 3000;

interface PersistedStore<T> {
  getInitialState: () => T;
  setState: StoreApi<T>["setState"];
  persist: { clearStorage: () => void };
}

/** Put a persisted store back to its defaults, in memory and in storage. */
function resetPersistedStore<T>(store: PersistedStore<T>): void {
  store.setState(store.getInitialState(), true);
  store.persist.clearStorage();
}

function removeStorageEntries(): void {
  try {
    for (const key of USER_LOCAL_STORAGE_KEYS) localStorage.removeItem(key);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && USER_LOCAL_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        localStorage.removeItem(key);
      }
    }
    for (const key of USER_SESSION_STORAGE_KEYS) sessionStorage.removeItem(key);
  } catch {
    // Storage unavailable: nothing was kept there either
  }
}

/**
 * Forget everything kept for the signed-in account (not the session itself):
 * cached API responses, the Home Assistant connection, and the account's data
 * and settings in browser storage.
 */
export function clearUserData(): void {
  queryClient.clear();
  useAuthStore.getState().setUser(null);
  useHAWebSocket.getState().reset();
  useChatStore.setState(useChatStore.getInitialState(), true);

  resetPersistedStore(useScreensaverStore);
  resetPersistedStore(useDurationAlertStore);
  resetPersistedStore(useAutomationNotificationStore);
  resetPersistedStore(useProfileStore);
  resetPersistedStore(useModuleStore);
  resetPersistedStore(useSidebarStore);

  // The calendar's display preferences stay with the device; who the family
  // is, where it lives and which of its calendars/profiles are hidden don't
  const calendarDefaults = useCalendarStore.getInitialState();
  useCalendarStore.setState({
    familyName: calendarDefaults.familyName,
    homeAddress: calendarDefaults.homeAddress,
    calendars: [],
    selectedCalendarIds: [],
    dashboardCalendarIds: [],
    selectedEvent: null,
    hiddenCalendarIds: [],
    hiddenProfileIds: [],
  });

  offlineCache.clearAll();
  removeStorageEntries();
}

let signingOut = false;

/**
 * The one way to sign out: revoke the refresh token on the server, forget the
 * session and everything kept for the account, then reload so nothing of it
 * stays in memory. Reloads `redirectTo` (an app path such as "/login"), or
 * the current page when none is given (a session that expired: protected
 * pages then send the visitor to sign in).
 */
export async function signOut(options: { redirectTo?: string } = {}): Promise<void> {
  if (signingOut) return;
  signingOut = true;

  const { refreshToken } = useAuthStore.getState();
  // keepalive: the request survives the reload below if it's still running
  const revoked = refreshToken
    ? api.revokeRefreshToken(refreshToken).catch(() => {})
    : Promise.resolve();

  useAuthStore.getState().logout();
  clearUserData();

  await Promise.race([revoked, new Promise<void>((resolve) => setTimeout(resolve, REVOKE_TIMEOUT_MS))]);

  if (options.redirectTo) {
    window.location.replace(appPath(options.redirectTo));
  } else {
    window.location.reload();
  }
}

/**
 * Store the tokens of a new sign-in. Unless it's the same user as the session
 * it replaces, everything kept for whoever used this browser before is
 * forgotten first.
 *
 * Returns whether another account was signed in in this browser. Its state
 * may still be in this page's memory, so callers should then load their next
 * page with a full navigation rather than a client-side one.
 */
export function startSession(accessToken: string, refreshToken: string): { replacedAccount: boolean } {
  const previous = useAuthStore.getState();
  const previousUserId = previous.isAuthenticated ? userIdFromToken(previous.accessToken) : null;
  const sameUser = previousUserId !== null && previousUserId === userIdFromToken(accessToken);

  if (!sameUser) {
    clearUserData();
  }
  previous.setTokens(accessToken, refreshToken);

  return { replacedAccount: previous.isAuthenticated && !sameUser };
}

/** Route sessions that can't be refreshed through signOut. Called once at startup. */
export function installSessionHandlers(): void {
  setSessionExpiredHandler(() => {
    void signOut();
  });
}
