import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, MoreVertical, Pencil, Trash2, User } from "lucide-react";
import { api } from "../../services/api";
import { cn } from "../../lib/utils";
import type { RoutineWithCompletions, FamilyProfile } from "@openframe/shared";

interface RoutineItemProps {
  routine: RoutineWithCompletions;
  date: string;
  activeProfileId: string | null;
  profiles: FamilyProfile[];
  onEdit: (routine: RoutineWithCompletions) => void;
}

export function RoutineItem({
  routine,
  date,
  activeProfileId,
  profiles,
  onEdit,
}: RoutineItemProps) {
  const queryClient = useQueryClient();
  const [showMenu, setShowMenu] = useState(false);

  const toggleCompletion = useMutation({
    mutationFn: () =>
      api.toggleRoutineCompletion(routine.id, {
        date,
        profileId: activeProfileId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routines"] });
    },
  });

  const deleteRoutine = useMutation({
    mutationFn: () => api.deleteRoutine(routine.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routines"] });
    },
  });

  const assignedProfile = routine.assignedProfileId
    ? profiles.find((p) => p.id === routine.assignedProfileId)
    : null;

  const isCompleted = routine.isCompletedToday;

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
        isCompleted
          ? "border-primary/20 bg-primary/5"
          : "border-border hover:border-primary/30 hover:bg-accent/50"
      )}
    >
      {/* Completion checkbox */}
      <button
        onClick={() => toggleCompletion.mutate()}
        disabled={toggleCompletion.isPending}
        className={cn(
          "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border-2 transition-colors",
          isCompleted
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/40 hover:border-primary"
        )}
      >
        {isCompleted && <Check className="h-3.5 w-3.5" />}
      </button>

      {/* Icon */}
      {routine.icon && (
        <span className="text-lg flex-shrink-0">{routine.icon}</span>
      )}

      {/* Title & info */}
      <div className="flex-1 min-w-0">
        <span
          className={cn(
            "text-sm font-medium",
            isCompleted
              ? "text-muted-foreground line-through"
              : "text-foreground"
          )}
        >
          {routine.title}
        </span>
      </div>

      {/* Assigned profile badge */}
      {assignedProfile && (
        <span
          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
          style={{
            backgroundColor: assignedProfile.color
              ? `${assignedProfile.color}20`
              : undefined,
            color: assignedProfile.color || undefined,
          }}
        >
          {assignedProfile.icon ? (
            <span className="text-xs">{assignedProfile.icon}</span>
          ) : (
            <User className="h-3 w-3" />
          )}
          {assignedProfile.name}
        </span>
      )}

      {/* Three-dot menu */}
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex h-7 w-7 items-center justify-center rounded-md opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity"
        >
          <MoreVertical className="h-4 w-4 text-muted-foreground" />
        </button>

        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowMenu(false)}
            />
            <div className="absolute right-0 top-8 z-50 w-36 rounded-lg border border-border bg-popover p-1 shadow-lg">
              <button
                onClick={() => {
                  setShowMenu(false);
                  onEdit(routine);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  deleteRoutine.mutate();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
