import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { Platform } from "react-native";
import type { User } from "@openframe/shared";

// Secure storage adapter for Zustand
// expo-secure-store only works on native; fall back to localStorage on web
const secureStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (Platform.OS === "web") {
      return localStorage.getItem(name);
    }
    const SecureStore = await import("expo-secure-store");
    return await SecureStore.getItemAsync(name);
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (Platform.OS === "web") {
      localStorage.setItem(name, value);
      return;
    }
    const SecureStore = await import("expo-secure-store");
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    if (Platform.OS === "web") {
      localStorage.removeItem(name);
      return;
    }
    const SecureStore = await import("expo-secure-store");
    await SecureStore.deleteItemAsync(name);
  },
};

export type AuthMethod = "token" | "apiKey";

interface AuthState {
  user: User | null;
  apiKey: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  authMethod: AuthMethod | null;
  serverUrl: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setApiKey: (apiKey: string) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setServerUrl: (url: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      apiKey: null,
      accessToken: null,
      refreshToken: null,
      authMethod: null,
      serverUrl: null,
      isAuthenticated: false,
      isLoading: true,

      setApiKey: (apiKey) => {
        set({
          apiKey,
          authMethod: "apiKey",
          accessToken: null,
          refreshToken: null,
          isAuthenticated: true,
        });
      },

      setTokens: (accessToken, refreshToken) => {
        set({
          accessToken,
          refreshToken,
          authMethod: "token",
          apiKey: null,
          isAuthenticated: true,
        });
      },

      setServerUrl: (url) => {
        set({ serverUrl: url });
      },

      setUser: (user) => {
        set({ user });
      },

      logout: () => {
        set({
          user: null,
          apiKey: null,
          accessToken: null,
          refreshToken: null,
          authMethod: null,
          isAuthenticated: false,
        });
      },

      setLoading: (loading) => {
        set({ isLoading: loading });
      },
    }),
    {
      name: "openframe-mobile-auth",
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        apiKey: state.apiKey,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        authMethod: state.authMethod,
        serverUrl: state.serverUrl,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setLoading(false);
      },
    }
  )
);
