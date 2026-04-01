import { create } from "zustand";
import { api, type CompanionPermissions } from "../services/api";

interface CompanionState {
  context: CompanionPermissions | null;
  loading: boolean;
  fetchContext: () => Promise<void>;
  // Convenience permission getters
  isOwner: () => boolean;
  canViewCalendar: () => boolean;
  canEditCalendar: () => boolean;
  canViewTasks: () => boolean;
  canEditTasks: () => boolean;
  canViewKiosks: () => boolean;
  canViewPhotos: () => boolean;
  canViewRecipes: () => boolean;
  canViewIptv: () => boolean;
  canViewHA: () => boolean;
  canViewNews: () => boolean;
  canViewWeather: () => boolean;
}

export const useCompanionStore = create<CompanionState>((set, get) => ({
  context: null,
  loading: false,

  fetchContext: async () => {
    set({ loading: true });
    try {
      const context = await api.getCompanionContext();
      set({ context });
    } catch (error) {
      console.error("Failed to fetch companion context:", error);
      // Fallback: assume owner with all permissions
      set({ context: { isOwner: true, permissions: null } });
    } finally {
      set({ loading: false });
    }
  },

  isOwner: () => get().context?.isOwner ?? true,

  canViewCalendar: () => {
    const ctx = get().context;
    if (!ctx || ctx.isOwner) return true;
    const p = ctx.permissions;
    return p?.calendarAccess === "view" || p?.calendarAccess === "edit";
  },

  canEditCalendar: () => {
    const ctx = get().context;
    if (!ctx || ctx.isOwner) return true;
    return ctx.permissions?.calendarAccess === "edit";
  },

  canViewTasks: () => {
    const ctx = get().context;
    if (!ctx || ctx.isOwner) return true;
    const p = ctx.permissions;
    return p?.taskAccess === "view" || p?.taskAccess === "edit";
  },

  canEditTasks: () => {
    const ctx = get().context;
    if (!ctx || ctx.isOwner) return true;
    return ctx.permissions?.taskAccess === "edit";
  },

  canViewKiosks: () => {
    const ctx = get().context;
    if (!ctx || ctx.isOwner) return true;
    return ctx.permissions?.kioskAccess !== false;
  },

  canViewPhotos: () => {
    const ctx = get().context;
    if (!ctx || ctx.isOwner) return true;
    return ctx.permissions?.photoAccess !== false;
  },

  canViewRecipes: () => {
    const ctx = get().context;
    if (!ctx || ctx.isOwner) return true;
    return ctx.permissions?.recipeAccess !== false;
  },

  canViewIptv: () => {
    const ctx = get().context;
    if (!ctx || ctx.isOwner) return true;
    return ctx.permissions?.iptvAccess !== false;
  },

  canViewHA: () => {
    const ctx = get().context;
    if (!ctx || ctx.isOwner) return true;
    return ctx.permissions?.homeAssistantAccess !== false;
  },

  canViewNews: () => {
    const ctx = get().context;
    if (!ctx || ctx.isOwner) return true;
    return ctx.permissions?.newsAccess !== false;
  },

  canViewWeather: () => {
    const ctx = get().context;
    if (!ctx || ctx.isOwner) return true;
    return ctx.permissions?.weatherAccess !== false;
  },
}));
