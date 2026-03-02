import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@openframe/shared";

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

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  apiKey: string | null;
  isAuthenticated: boolean;
  isDemo: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setApiKey: (apiKey: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      apiKey: null,
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

      setApiKey: (apiKey) => {
        set({
          apiKey,
          isAuthenticated: true,
          isDemo: false,
        });
      },

      setUser: (user) => {
        set({ user });
      },

      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          apiKey: null,
          isAuthenticated: false,
          isDemo: false,
        });
      },
    }),
    {
      name: "openframe-auth",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        apiKey: state.apiKey,
        isAuthenticated: state.isAuthenticated,
        isDemo: state.isDemo,
      }),
    }
  )
);
