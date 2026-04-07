import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Flame,
  Check,
  Circle,
  MoreVertical,
  Trash2,
  Pencil,
} from "lucide-react";
import { api } from "../../services/api";
import { Button } from "../ui/Button";
import { AddHabitModal } from "./AddHabitModal";
import { HabitHeatMap } from "./HabitHeatMap";
import { cn } from "../../lib/utils";
import { useAuthStore } from "../../stores/auth";
import { isProductivityFeatureAvailable } from "@openframe/shared";
import type { UserMode } from "@openframe/shared";

export function HabitList() {
  const [showAdd, setShowAdd] = useState(false);
  const [editingHabit, setEditingHabit] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const userMode: UserMode =
    (user?.preferences as any)?.userMode ?? "simple";
  const showAdvanced = isProductivityFeatureAvailable("gamification", userMode);

  const { data: habits = [], isLoading } = useQuery({
    queryKey: ["habits"],
    queryFn: () => api.getHabits(),
  });

  const completeMutation = useMutation({
    mutationFn: ({ habitId, profileId }: { habitId: string; profileId?: string }) =>
      api.completeHabit(habitId, { profileId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
    },
  });

  const uncompleteMutation = useMutation({
    mutationFn: ({
      habitId,
      date,
      profileId,
    }: {
      habitId: string;
      date: string;
      profileId?: string;
    }) => api.uncompleteHabit(habitId, date, profileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteHabit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
    },
  });

  const today = new Date().toISOString().slice(0, 10);

  // Build 7-day date array (Mon-Sun of current week)
  const weekDates = getWeekDates();

  function getWeekDates(): string[] {
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7));
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  }

  function isCompletedOnDate(habit: any, date: string): boolean {
    return (habit.completions ?? []).some(
      (c: any) => c.completedDate === date
    );
  }

  function toggleCompletion(habit: any, date: string) {
    if (isCompletedOnDate(habit, date)) {
      uncompleteMutation.mutate({
        habitId: habit.id,
        date,
        profileId: habit.profileId,
      });
    } else {
      completeMutation.mutate({
        habitId: habit.id,
        profileId: habit.profileId,
      });
    }
  }

  const personalHabits = habits.filter((h: any) => !h.isShared);
  const sharedHabits = habits.filter((h: any) => h.isShared);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading habits...
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-primary">Today's Habits</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdd(true)}
          className="border-primary/40 text-primary"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Habit
        </Button>
      </div>

      {/* Habits list */}
      {habits.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg mb-2">No habits yet</p>
          <p className="text-sm">Create your first habit to start tracking.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Personal habits */}
          {personalHabits.length > 0 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="divide-y divide-border">
                {personalHabits.map((habit: any) => (
                  <HabitRow
                    key={habit.id}
                    habit={habit}
                    weekDates={weekDates}
                    today={today}
                    isCompletedOnDate={isCompletedOnDate}
                    onToggle={toggleCompletion}
                    onEdit={() => {
                      setEditingHabit(habit);
                      setShowAdd(true);
                    }}
                    onDelete={() => deleteMutation.mutate(habit.id)}
                    menuOpen={menuOpen}
                    setMenuOpen={setMenuOpen}
                  />
                ))}
              </div>
              {/* Day headers */}
              <div className="px-4 py-2 flex justify-end gap-0 text-xs text-muted-foreground">
                <div className="w-[calc(7*2.5rem)] flex">
                  {weekDates.map((date) => (
                    <div key={date} className="w-10 text-center">
                      {new Date(date + "T12:00:00").toLocaleDateString("en-US", {
                        weekday: "narrow",
                      })}
                    </div>
                  ))}
                </div>
                <div className="w-20" />
              </div>
            </div>
          )}

          {/* Shared habits */}
          {sharedHabits.length > 0 && (
            <>
              <h3 className="text-sm font-medium text-primary/80 mt-6">
                Shared Family Habits
              </h3>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="divide-y divide-border">
                  {sharedHabits.map((habit: any) => (
                    <HabitRow
                      key={habit.id}
                      habit={habit}
                      weekDates={weekDates}
                      today={today}
                      isCompletedOnDate={isCompletedOnDate}
                      onToggle={toggleCompletion}
                      onEdit={() => {
                        setEditingHabit(habit);
                        setShowAdd(true);
                      }}
                      onDelete={() => deleteMutation.mutate(habit.id)}
                      menuOpen={menuOpen}
                      setMenuOpen={setMenuOpen}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Heat map (advanced mode only) */}
      {showAdvanced && habits.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-medium text-primary/80 mb-3">
            This Month
          </h3>
          <HabitHeatMap habits={habits} />
        </div>
      )}

      {/* Add/Edit modal */}
      {showAdd && (
        <AddHabitModal
          habit={editingHabit}
          onClose={() => {
            setShowAdd(false);
            setEditingHabit(null);
          }}
        />
      )}
    </div>
  );
}

function HabitRow({
  habit,
  weekDates,
  today,
  isCompletedOnDate,
  onToggle,
  onEdit,
  onDelete,
  menuOpen,
  setMenuOpen,
}: {
  habit: any;
  weekDates: string[];
  today: string;
  isCompletedOnDate: (h: any, d: string) => boolean;
  onToggle: (h: any, d: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  menuOpen: string | null;
  setMenuOpen: (id: string | null) => void;
}) {
  return (
    <div className="flex items-center px-4 py-3 gap-3">
      {/* Icon + name */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-lg">{habit.icon || "📋"}</span>
        <span className="font-medium truncate">{habit.name}</span>
      </div>

      {/* 7-day grid */}
      <div className="flex gap-0">
        {weekDates.map((date) => {
          const completed = isCompletedOnDate(habit, date);
          const isToday = date === today;
          const isFuture = date > today;
          return (
            <button
              key={date}
              onClick={() => !isFuture && onToggle(habit, date)}
              disabled={isFuture}
              className={cn(
                "w-10 h-10 flex items-center justify-center rounded-lg transition-colors",
                isFuture && "opacity-30 cursor-not-allowed",
                isToday && !completed && "ring-2 ring-primary/30",
                completed
                  ? "bg-primary/20 text-primary"
                  : "hover:bg-primary/5"
              )}
            >
              {completed ? (
                <Check className="h-4 w-4" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground/50" />
              )}
            </button>
          );
        })}
      </div>

      {/* Streak */}
      <div className="w-20 flex items-center justify-end gap-1 text-sm">
        {(habit.streak?.current ?? 0) > 0 && (
          <>
            <Flame className="h-4 w-4 text-orange-500" />
            <span className="font-medium text-orange-500">
              {habit.streak.current}d
            </span>
          </>
        )}
      </div>

      {/* Menu */}
      <div className="relative">
        <button
          onClick={() =>
            setMenuOpen(menuOpen === habit.id ? null : habit.id)
          }
          className="p-1 rounded hover:bg-muted"
        >
          <MoreVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        {menuOpen === habit.id && (
          <div className="absolute right-0 top-8 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[120px]">
            <button
              onClick={() => {
                setMenuOpen(null);
                onEdit();
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
            <button
              onClick={() => {
                setMenuOpen(null);
                onDelete();
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-muted text-destructive flex items-center gap-2"
            >
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
