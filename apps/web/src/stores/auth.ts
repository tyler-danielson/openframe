import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@openframe/shared";
import { isKioskRoute } from "../lib/cloud";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = atob(parts[1]!.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

/** The id of the user an access token was issued to, or null if it has none. */
export function userIdFromToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  return payload && typeof payload.userId === "string" ? payload.userId : null;
}

/** The signed-in user, as GET /auth/me returns it. */
export type AuthUser = User & {
  /** Administers the whole server (on the hosted service: a platform operator). */
  isServerAdmin?: boolean;
};

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  /**
   * The API key of the kiosk this page is showing. It acts as the kiosk's
   * owner, so it's kept only in memory and only sent while the browser is on
   * that kiosk's /kiosk/<token> pages (see getRequestCredentials): it must
   * never outlive the kiosk page or stand in for whoever is signed in.
   */
  kioskApiKey: string | null;
  /** Someone is signed in (a user session). A kiosk's key doesn't count. */
  isAuthenticated: boolean;
  isDemo: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setKioskApiKey: (apiKey: string | null) => void;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
}

type PersistedAuth = Pick<AuthState, "accessToken" | "refreshToken" | "isAuthenticated" | "isDemo">;

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      kioskApiKey: null,
      isAuthenticated: false,
      isDemo: false,

      setTokens: (accessToken, refreshToken) => {
        const payload = decodeJwtPayload(accessToken);
        set({
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isDemo: !!(payload && payload.isDemo),
        });
      },

      setKioskApiKey: (kioskApiKey) => {
        set({ kioskApiKey });
      },

      setUser: (user) => {
        set({ user });
      },

      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isDemo: false,
        });
      },
    }),
    {
      name: "openframe-auth",
      version: 1,
      // Version 0 also stored an API key (a kiosk's, or one from an ?apiKey=
      // link) that then acted for everything in this browser. Drop it, and the
      // "signed in" flag it set without a session.
      migrate: (persisted): PersistedAuth => {
        const old = (persisted ?? {}) as Partial<Record<keyof PersistedAuth, unknown>>;
        const accessToken = typeof old.accessToken === "string" ? old.accessToken : null;
        const refreshToken = typeof old.refreshToken === "string" ? old.refreshToken : null;
        return {
          accessToken,
          refreshToken,
          isAuthenticated: !!accessToken && old.isAuthenticated !== false,
          isDemo: !!accessToken && old.isDemo === true,
        };
      },
      partialize: (state): PersistedAuth => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        isDemo: state.isDemo,
      }),
    }
  )
);

export interface RequestCredentials {
  accessToken: string | null;
  apiKey: string | null;
}

function credentialsFor(accessToken: string | null, kioskApiKey: string | null): RequestCredentials {
  // A kiosk shows its owner's account: only its key, never the token of
  // whoever is signed in. Everywhere else only the signed-in user's token.
  return isKioskRoute()
    ? { accessToken: null, apiKey: kioskApiKey }
    : { accessToken, apiKey: null };
}

/**
 * The credentials the current page's API requests carry: the kiosk's key
 * while the browser shows a kiosk, otherwise the signed-in user's token.
 */
export function getRequestCredentials(): RequestCredentials {
  const { accessToken, kioskApiKey } = useAuthStore.getState();
  return credentialsFor(accessToken, kioskApiKey);
}

/** getRequestCredentials for render code (camera streams, image URLs). */
export function useRequestCredentials(): RequestCredentials {
  const accessToken = useAuthStore((s) => s.accessToken);
  const kioskApiKey = useAuthStore((s) => s.kioskApiKey);
  return credentialsFor(accessToken, kioskApiKey);
}

/**
 * Who the current page's requests act as: "user:<id>" for a signed-in user,
 * "kiosk" once a kiosk page has its key, null when there's no one. Effects
 * that load per-account state (modules, the Home Assistant connection) key on
 * this so they reload when it changes.
 */
export function useAuthScope(): string | null {
  const userId = useAuthStore((s) => (s.isAuthenticated ? userIdFromToken(s.accessToken) ?? "" : null));
  const hasKioskKey = useAuthStore((s) => s.kioskApiKey !== null);
  if (isKioskRoute()) return hasKioskKey ? "kiosk" : null;
  return userId === null ? null : `user:${userId}`;
}
