import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Trash2, User, CalendarDays } from "lucide-react";
import { api } from "../../services/api";
import { cn } from "../../lib/utils";
import type { RoutineWithCompletions, FamilyProfile, RecurrenceRule } from "@openframe/shared";

const DAY_ABBREVS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORDINALS = ["first", "second", "third", "fourth", "last"];

function describeRecurrenceShort(rule: RecurrenceRule): string {
  const { frequency, interval } = rule;

  if (frequency === "daily" && interval === 1) return "Every day";
  if (frequency === "daily") return `Every ${interval} days`;

  if (frequency === "weekly") {
    const days = rule.daysOfWeek?.length
      ? [...rule.daysOfWeek].sort((a, b) => a - b).map(d => DAY_ABBREVS[d]).join(", ")
      : "";
    const prefix = interval === 1 ? "Weekly" : `Every ${interval} weeks`;
    return days ? `${prefix} on ${days}` : prefix;
  }

  if (frequency === "monthly") {
    const prefix = interval === 1 ? "Monthly" : `Every ${interval} months`;
    if (rule.monthlyMode === "dayOfMonth" && rule.dayOfMonth) {
      return `${prefix} on day ${rule.dayOfMonth}`;
    } else if (rule.monthlyMode === "dayOfWeek" && rule.weekOfMonth != null && rule.dayOfWeekForMonth != null) {
      const ordinal = ORDINALS[rule.weekOfMonth - 1] ?? `${rule.weekOfMonth}th`;
      const dayName = DAY_NAMES[rule.dayOfWeekForMonth];
      return `${prefix} on the ${ordinal} ${dayName}`;
    }
    return prefix;
  }

  if (frequency === "yearly") {
    return interval === 1 ? "Yearly" : `Every ${interval} years`;
  }

  return "Custom";
}

function getEffectiveRule(routine: RoutineWithCompletions): RecurrenceRule | null {
  if (routine.recurrenceRule) return routine.recurrenceRule;
  // Synthesize from legacy
  const freq = routine.frequency;
  if (freq === "daily") return { frequency: "daily", interval: 1, endType: "never" };
  if (freq === "weekly" || freq === "custom") {
    return { frequency: "weekly", interval: 1, daysOfWeek: routine.daysOfWeek ?? [], endType: "never" };
  }
  return null;
}

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
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

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

  const toggleCalendar = useMutation({
    mutationFn: () =>
      api.updateRoutine(routine.id, { showOnCalendar: !routine.showOnCalendar }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routines"] });
      queryClient.invalidateQueries({ queryKey: ["routine-calendar-events"] });
    },
  });

  const assignedProfile = routine.assignedProfileId
    ? profiles.find((p) => p.id === routine.assignedProfileId)
    : null;

  const isCompleted = routine.isCompletedToday;

  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors",
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
            "text-sm font-medium truncate",
            isCompleted
              ? "text-muted-foreground line-through"
              : "text-foreground"
          )}
        >
          {routine.title}
        </span>
        {(() => {
          const rule = getEffectiveRule(routine);
          if (!rule) return null;
          const desc = describeRecurrenceShort(rule);
          // Don't show for simple "Every day" — it's obvious
          if (desc === "Every day") return null;
          return (
            <p className="text-xs text-muted-foreground truncate">{desc}</p>
          );
        })()}
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

      {/* Calendar toggle */}
      <button
        onClick={() => toggleCalendar.mutate()}
        disabled={toggleCalendar.isPending}
        className={cn(
          "p-1.5 rounded-md transition-colors",
          isTouchDevice ? "opacity-60" : "opacity-0 group-hover:opacity-100",
          routine.showOnCalendar
            ? "text-primary bg-primary/10 !opacity-100"
            : "text-muted-foreground hover:bg-muted"
        )}
        title={routine.showOnCalendar ? "Showing on calendar" : "Show on calendar"}
      >
        <CalendarDays className="h-4 w-4" />
      </button>

      {/* Inline action buttons */}
      <div className={cn(
        "flex gap-0.5 flex-shrink-0 transition-opacity",
        isTouchDevice ? "opacity-60" : "opacity-0 group-hover:opacity-100"
      )}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(routine);
          }}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Edit routine"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`Delete "${routine.title}"?`)) {
              deleteRoutine.mutate();
            }
          }}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Delete routine"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
