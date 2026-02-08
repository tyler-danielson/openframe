import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";
import type { User } from "@openframe/shared";

// Secure storage adapter for Zustand
const secureStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return await SecureStore.getItemAsync(name);
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await SecureStore.deleteItemAsync(name);
  },
};

interface AuthState {
  user: User | null;
  apiKey: string | null;
  serverUrl: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setApiKey: (apiKey: string) => void;
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
      serverUrl: null,
      isAuthenticated: false,
      isLoading: true,

      setApiKey: (apiKey) => {
        set({
          apiKey,
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
        serverUrl: state.serverUrl,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setLoading(false);
      },
    }
  )
);
