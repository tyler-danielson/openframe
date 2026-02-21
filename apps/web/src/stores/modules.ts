import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api, type ModuleInfo } from "../services/api";

interface ModuleState {
  modules: Record<string, boolean>; // moduleId -> enabled
  moduleList: ModuleInfo[]; // full module info from server
  loading: boolean;
  loaded: boolean;
  fetchModules: () => Promise<void>;
  installModule: (id: string) => Promise<string[]>;
  uninstallModule: (id: string) => Promise<string[]>;
  isEnabled: (id: string) => boolean;
}

export const useModuleStore = create<ModuleState>()(
  persist(
    (set, get) => ({
      modules: {},
      moduleList: [],
      loading: false,
      loaded: false,

      fetchModules: async () => {
        set({ loading: true });
        try {
          const data = await api.getModules();
          const modules: Record<string, boolean> = {};
          for (const mod of data.modules) {
            modules[mod.id] = mod.enabled;
          }
          set({ modules, moduleList: data.modules, loaded: true });
        } catch (error) {
          console.error("Failed to fetch modules:", error);
        } finally {
          set({ loading: false });
        }
      },

      installModule: async (id: string) => {
        try {
          const result = await api.setModuleEnabled(id, true);
          set((state) => ({
            modules: { ...state.modules, [id]: true },
            moduleList: state.moduleList.map((m) =>
              m.id === id ? { ...m, enabled: true } : m
            ),
          }));
          return [];
        } catch (error: any) {
          // Re-fetch on error to get accurate state
          get().fetchModules();
          throw error;
        }
      },

      uninstallModule: async (id: string) => {
        try {
          const result = await api.setModuleEnabled(id, false);
          // Cascade: also mark dependents as disabled
          set((state) => {
            const updated = { ...state.modules, [id]: false };
            const updatedList = [...state.moduleList];
            for (const mod of updatedList) {
              if (mod.id === id || result.cascadeDisabled.includes(mod.id)) {
                updated[mod.id] = false;
                mod.enabled = false;
              }
            }
            return { modules: updated, moduleList: updatedList };
          });
          return result.cascadeDisabled;
        } catch (error: any) {
          get().fetchModules();
          throw error;
        }
      },

      isEnabled: (id: string) => {
        return get().modules[id] ?? false;
      },
    }),
    {
      name: "openframe-modules",
      partialize: (state) => ({
        modules: state.modules,
      }),
    }
  )
);
