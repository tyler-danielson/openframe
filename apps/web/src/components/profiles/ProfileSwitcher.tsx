import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Plus, Settings, Users } from "lucide-react";
import { useProfileStore, useActiveProfile } from "../../stores/profile";
import type { FamilyProfile } from "@openframe/shared";

interface ProfileSwitcherProps {
  compact?: boolean;
}

export function ProfileSwitcher({ compact = false }: ProfileSwitcherProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const profiles = useProfileStore((state) => state.profiles);
  const setActiveProfile = useProfileStore((state) => state.setActiveProfile);
  const fetchProfiles = useProfileStore((state) => state.fetchProfiles);
  const activeProfile = useActiveProfile();

  // Fetch profiles on mount if empty
  useEffect(() => {
    if (profiles.length === 0) {
      fetchProfiles();
    }
  }, [profiles.length, fetchProfiles]);

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectProfile = (profile: FamilyProfile) => {
    setActiveProfile(profile.id);
    setIsOpen(false);
  };

  const handleManageProfiles = () => {
    navigate("/profiles");
    setIsOpen(false);
  };

  // Don't render if no profiles
  if (profiles.length === 0) {
    return null;
  }

  if (compact) {
    // Compact version for sidebar
    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          title={activeProfile?.name || "Select profile"}
        >
          <span className="text-lg">{activeProfile?.icon || "👤"}</span>
        </button>

        {isOpen && (
          <div className="absolute left-12 top-0 z-50 bg-card border border-border rounded-lg shadow-lg py-2 min-w-[180px]">
            <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-border mb-1">
              Family Profiles
            </div>
            {profiles.map((profile) => (
              <button
                key={profile.id}
                onClick={() => handleSelectProfile(profile)}
                className={`w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 ${
                  activeProfile?.id === profile.id ? "bg-muted" : ""
                }`}
              >
                <span className="text-base">{profile.icon || "👤"}</span>
                <span className="flex-1">{profile.name}</span>
                {profile.isDefault && (
                  <span className="text-xs text-muted-foreground">★</span>
                )}
              </button>
            ))}
            <hr className="my-1 border-border" />
            <button
              onClick={handleManageProfiles}
              className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Manage Profiles
            </button>
          </div>
        )}
      </div>
    );
  }

  // Full version with dropdown
  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-card hover:bg-muted transition-colors"
      >
        <span className="text-lg">{activeProfile?.icon || "👤"}</span>
        <span className="text-sm font-medium">{activeProfile?.name || "Select Profile"}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-lg py-2 min-w-[200px]">
          <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-border mb-1">
            Switch Profile
          </div>
          {profiles.map((profile) => (
            <button
              key={profile.id}
              onClick={() => handleSelectProfile(profile)}
              className={`w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 ${
                activeProfile?.id === profile.id ? "bg-primary/10 text-primary" : ""
              }`}
            >
              <span
                className="w-8 h-8 rounded-full flex items-center justify-center text-base"
                style={{ backgroundColor: profile.color ? `${profile.color}20` : "#E5E7EB" }}
              >
                {profile.icon || "👤"}
              </span>
              <span className="flex-1 font-medium">{profile.name}</span>
              {profile.isDefault && (
                <span className="text-xs bg-muted px-1.5 py-0.5 rounded">Default</span>
              )}
            </button>
          ))}
          <hr className="my-1 border-border" />
          <button
            onClick={handleManageProfiles}
            className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
          >
            <Users className="h-4 w-4" />
            Manage Profiles
          </button>
        </div>
      )}
    </div>
  );
}
