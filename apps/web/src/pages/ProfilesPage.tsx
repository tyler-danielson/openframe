import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Settings,
  FileEdit,
  Trash2,
  Star,
  Loader2,
  Users,
} from "lucide-react";
import { api } from "../services/api";
import { Button } from "../components/ui/Button";
import { ProfileCard } from "../components/profiles/ProfileCard";
import { useProfileStore, useActiveProfile } from "../stores/profile";
import type { FamilyProfile } from "@openframe/shared";

// Emoji options for profile icons
const EMOJI_OPTIONS = ["👨", "👩", "👧", "👦", "👴", "👵", "🧑", "👶", "🐕", "🐱", "🌟"];

// Color options for profile accent colors
const COLOR_OPTIONS = [
  { name: "Blue", value: "#3B82F6" },
  { name: "Green", value: "#22C55E" },
  { name: "Purple", value: "#A855F7" },
  { name: "Orange", value: "#F97316" },
  { name: "Pink", value: "#EC4899" },
  { name: "Teal", value: "#14B8A6" },
  { name: "Red", value: "#EF4444" },
  { name: "Amber", value: "#F59E0B" },
];

export function ProfilesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setProfiles, setActiveProfile } = useProfileStore();
  const activeProfile = useActiveProfile();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<FamilyProfile | null>(null);

  // Fetch profiles
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => api.getProfiles(),
  });

  // Sync profiles to store
  useEffect(() => {
    if (profiles.length > 0) {
      setProfiles(profiles);
    }
  }, [profiles, setProfiles]);

  // Create profile mutation
  const createProfile = useMutation({
    mutationFn: (data: { name: string; icon?: string; color?: string; isDefault?: boolean }) =>
      api.createProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      setShowCreateModal(false);
    },
  });

  // Update profile mutation
  const updateProfile = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; icon?: string; color?: string } }) =>
      api.updateProfile(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      setEditingProfile(null);
    },
  });

  // Delete profile mutation
  const deleteProfile = useMutation({
    mutationFn: (id: string) => api.deleteProfile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
    },
  });

  // Set default mutation
  const setDefault = useMutation({
    mutationFn: (id: string) => api.setDefaultProfile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
    },
  });

  const handleSelectProfile = (profile: FamilyProfile) => {
    setActiveProfile(profile.id);
  };

  const handleEditPlanner = (profile: FamilyProfile) => {
    setActiveProfile(profile.id);
    navigate(`/profiles/${profile.id}/planner`);
  };

  const handleEditSettings = (profile: FamilyProfile) => {
    setActiveProfile(profile.id);
    navigate(`/profiles/${profile.id}/settings`);
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Family Profiles</h1>
            <p className="text-sm text-muted-foreground">
              Create personalized planners for each family member
            </p>
          </div>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Profile
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && profiles.length === 0 && (
        <div className="text-center py-12 border border-dashed border-border rounded-lg">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No profiles yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first family profile to get started with personalized planners.
          </p>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Profile
          </Button>
        </div>
      )}

      {/* Profile grid */}
      {!isLoading && profiles.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {profiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              isActive={activeProfile?.id === profile.id}
              onSelect={() => handleSelectProfile(profile)}
              onEdit={() => setEditingProfile(profile)}
              onEditPlanner={() => handleEditPlanner(profile)}
              onEditSettings={() => handleEditSettings(profile)}
              onSetDefault={() => setDefault.mutate(profile.id)}
              onDelete={() => {
                if (confirm(`Delete "${profile.name}"? This cannot be undone.`)) {
                  deleteProfile.mutate(profile.id);
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingProfile) && (
        <ProfileFormModal
          profile={editingProfile}
          onClose={() => {
            setShowCreateModal(false);
            setEditingProfile(null);
          }}
          onSave={(data) => {
            if (editingProfile) {
              updateProfile.mutate({ id: editingProfile.id, data });
            } else {
              createProfile.mutate(data);
            }
          }}
          isLoading={createProfile.isPending || updateProfile.isPending}
        />
      )}
    </div>
  );
}

// Profile form modal component
interface ProfileFormModalProps {
  profile?: FamilyProfile | null;
  onClose: () => void;
  onSave: (data: { name: string; icon?: string; color?: string; isDefault?: boolean }) => void;
  isLoading: boolean;
}

function ProfileFormModal({ profile, onClose, onSave, isLoading }: ProfileFormModalProps) {
  const [name, setName] = useState(profile?.name || "");
  const [icon, setIcon] = useState(profile?.icon || "👤");
  const [color, setColor] = useState(profile?.color || COLOR_OPTIONS[0]?.value || "#3b82f6");
  const [isDefault, setIsDefault] = useState(profile?.isDefault || false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), icon, color, isDefault });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-md mx-4">
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">
              {profile ? "Edit Profile" : "Create Profile"}
            </h2>

            {/* Name input */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Dad, Mom, Kids"
                className="w-full px-3 py-2 border border-border rounded-md bg-background"
                autoFocus
              />
            </div>

            {/* Icon picker */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Icon</label>
              <div className="flex flex-wrap gap-2">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setIcon(emoji)}
                    className={`w-10 h-10 text-xl rounded-md border transition-colors ${
                      icon === emoji
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Color picker */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Accent Color</label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((colorOpt) => (
                  <button
                    key={colorOpt.value}
                    type="button"
                    onClick={() => setColor(colorOpt.value)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      color === colorOpt.value
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: colorOpt.value }}
                    title={colorOpt.name}
                  />
                ))}
              </div>
            </div>

            {/* Default checkbox */}
            {!profile && (
              <div className="mb-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="rounded border-border"
                  />
                  Set as default profile
                </label>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 bg-muted/50 border-t border-border rounded-b-lg">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : profile ? (
                "Save Changes"
              ) : (
                "Create Profile"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
