import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  FamilyProfile,
  PlannerLayoutConfig,
  ProfileRemarkableSettings,
} from "@openframe/shared";
import { api } from "../services/api";

export interface ProfileWithSettings extends FamilyProfile {
  plannerConfig?: PlannerLayoutConfig | null;
  remarkableSettings?: ProfileRemarkableSettings | null;
}

interface ProfileState {
  // State
  profiles: FamilyProfile[];
  activeProfileId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setProfiles: (profiles: FamilyProfile[]) => void;
  setActiveProfile: (id: string | null) => void;
  fetchProfiles: () => Promise<void>;
  createProfile: (name: string, icon?: string, color?: string, isDefault?: boolean) => Promise<FamilyProfile | null>;
  updateProfile: (id: string, updates: { name?: string; icon?: string; color?: string }) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  setDefaultProfile: (id: string) => Promise<void>;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      // Initial state
      profiles: [],
      activeProfileId: null,
      isLoading: false,
      error: null,

      // Actions
      setProfiles: (profiles) => set({ profiles }),

      setActiveProfile: (id) => {
        set({ activeProfileId: id });
      },

      fetchProfiles: async () => {
        set({ isLoading: true, error: null });
        try {
          const profiles = await api.getProfiles();
          set({ profiles, isLoading: false });

          // Auto-select default profile if none selected
          const { activeProfileId } = get();
          if (!activeProfileId && profiles.length > 0) {
            const defaultProfile = profiles.find((p) => p.isDefault) ?? profiles[0];
            if (defaultProfile) {
              set({ activeProfileId: defaultProfile.id });
            }
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Failed to fetch profiles",
            isLoading: false,
          });
        }
      },

      createProfile: async (name, icon, color, isDefault) => {
        set({ isLoading: true, error: null });
        try {
          const profile = await api.createProfile({ name, icon, color, isDefault });
          const { profiles } = get();

          // If this is the default, update other profiles
          let updatedProfiles = [...profiles];
          if (isDefault) {
            updatedProfiles = updatedProfiles.map((p) => ({ ...p, isDefault: false }));
          }
          updatedProfiles.push(profile);

          set({ profiles: updatedProfiles, isLoading: false });

          // Auto-select if it's the first or default
          if (updatedProfiles.length === 1 || isDefault) {
            set({ activeProfileId: profile.id });
          }

          return profile;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Failed to create profile",
            isLoading: false,
          });
          return null;
        }
      },

      updateProfile: async (id, updates) => {
        set({ isLoading: true, error: null });
        try {
          const updated = await api.updateProfile(id, updates);
          const { profiles } = get();
          set({
            profiles: profiles.map((p) => (p.id === id ? updated : p)),
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Failed to update profile",
            isLoading: false,
          });
        }
      },

      deleteProfile: async (id) => {
        set({ isLoading: true, error: null });
        try {
          await api.deleteProfile(id);
          const { profiles, activeProfileId } = get();
          const newProfiles = profiles.filter((p) => p.id !== id);
          const updates: Partial<ProfileState> = {
            profiles: newProfiles,
            isLoading: false,
          };

          // If we deleted the active profile, select another one
          if (activeProfileId === id) {
            const defaultProfile = newProfiles.find((p) => p.isDefault) || newProfiles[0];
            updates.activeProfileId = defaultProfile?.id || null;
          }

          set(updates);
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Failed to delete profile",
            isLoading: false,
          });
        }
      },

      setDefaultProfile: async (id) => {
        set({ isLoading: true, error: null });
        try {
          await api.setDefaultProfile(id);
          const { profiles } = get();
          set({
            profiles: profiles.map((p) => ({
              ...p,
              isDefault: p.id === id,
            })),
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Failed to set default profile",
            isLoading: false,
          });
        }
      },
    }),
    {
      name: "profile-store",
      partialize: (state) => ({
        activeProfileId: state.activeProfileId,
      }),
    }
  )
);

// Selector hooks
export const useActiveProfile = () => {
  const profiles = useProfileStore((state) => state.profiles);
  const activeProfileId = useProfileStore((state) => state.activeProfileId);
  return profiles.find((p) => p.id === activeProfileId) || null;
};
