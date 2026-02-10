import {
  Settings,
  FileEdit,
  Trash2,
  Star,
  MoreVertical,
  Check,
} from "lucide-react";
import type { FamilyProfile } from "@openframe/shared";
import { Button } from "../ui/Button";
import { useState, useRef, useEffect } from "react";

interface ProfileCardProps {
  profile: FamilyProfile;
  isActive: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onEditPlanner: () => void;
  onEditSettings: () => void;
  onSetDefault: () => void;
  onDelete: () => void;
}

export function ProfileCard({
  profile,
  isActive,
  onSelect,
  onEdit,
  onEditPlanner,
  onEditSettings,
  onSetDefault,
  onDelete,
}: ProfileCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      className={`relative bg-card border rounded-lg p-4 transition-all cursor-pointer hover:shadow-md ${
        isActive ? "border-primary ring-2 ring-primary/20" : "border-border"
      }`}
      onClick={onSelect}
    >
      {/* Default badge */}
      {profile.isDefault && (
        <div className="absolute top-2 left-2">
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            Default
          </span>
        </div>
      )}

      {/* Menu button */}
      <div className="absolute top-2 right-2" ref={menuRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {/* Dropdown menu */}
        {showMenu && (
          <div className="absolute right-0 top-8 z-10 bg-card border border-border rounded-md shadow-lg py-1 min-w-[160px]">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
                setShowMenu(false);
              }}
              className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
            >
              <FileEdit className="h-4 w-4" />
              Edit Profile
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditPlanner();
                setShowMenu(false);
              }}
              className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
            >
              <FileEdit className="h-4 w-4" />
              Design Planner
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditSettings();
                setShowMenu(false);
              }}
              className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
            {!profile.isDefault && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSetDefault();
                  setShowMenu(false);
                }}
                className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
              >
                <Star className="h-4 w-4" />
                Set as Default
              </button>
            )}
            <hr className="my-1 border-border" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
                setShowMenu(false);
              }}
              className="w-full px-3 py-2 text-sm text-left hover:bg-destructive/10 text-destructive flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Profile content */}
      <div className="flex flex-col items-center pt-6 pb-2">
        {/* Icon/Avatar */}
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-3"
          style={{ backgroundColor: profile.color ? `${profile.color}20` : "#E5E7EB" }}
        >
          {profile.icon || "👤"}
        </div>

        {/* Name */}
        <h3 className="text-lg font-semibold text-center">{profile.name}</h3>

        {/* Active indicator */}
        {isActive && (
          <div className="flex items-center gap-1 text-xs text-primary mt-1">
            <Check className="h-3 w-3" />
            Active
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 mt-4">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={(e) => {
            e.stopPropagation();
            onEditPlanner();
          }}
        >
          <FileEdit className="h-3.5 w-3.5 mr-1" />
          Planner
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={(e) => {
            e.stopPropagation();
            onEditSettings();
          }}
        >
          <Settings className="h-3.5 w-3.5 mr-1" />
          Settings
        </Button>
      </div>
    </div>
  );
}
