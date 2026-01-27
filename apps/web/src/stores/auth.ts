import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@openframe/shared";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  kioskEnabled: boolean;
  kioskChecked: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
  setKioskStatus: (enabled: boolean) => void;
  setKioskChecked: (checked: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      kioskEnabled: false,
      kioskChecked: false,

      setTokens: (accessToken, refreshToken) => {
        set({
          accessToken,
          refreshToken,
          isAuthenticated: true,
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
          isAuthenticated: false,
        });
      },

      setKioskStatus: (enabled) => {
        set({ kioskEnabled: enabled });
      },

      setKioskChecked: (checked) => {
        set({ kioskChecked: checked });
      },
    }),
    {
      name: "openframe-auth",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
