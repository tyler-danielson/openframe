import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ListChecks, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, subDays } from "date-fns";
import { api } from "../services/api";
import { Button } from "../components/ui/Button";
import { RoutineItem } from "../components/routines/RoutineItem";
import { AddRoutineModal } from "../components/routines/AddRoutineModal";
import { useProfileStore, useActiveProfile } from "../stores/profile";
import type { RoutineWithCompletions, RoutineFrequency } from "@openframe/shared";

export function RoutinesPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingRoutine, setEditingRoutine] =
    useState<RoutineWithCompletions | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const profiles = useProfileStore((state) => state.profiles);
  const fetchProfiles = useProfileStore((state) => state.fetchProfiles);
  const activeProfile = useActiveProfile();
  const activeProfileId = useProfileStore((state) => state.activeProfileId);
  const setActiveProfile = useProfileStore((state) => state.setActiveProfile);

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const isToday = dateStr === format(new Date(), "yyyy-MM-dd");

  // Fetch profiles on mount
  const { } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      await fetchProfiles();
      return null;
    },
    staleTime: 60000,
  });

  // Fetch routines
  const { data: routines = [], isLoading } = useQuery({
    queryKey: ["routines", dateStr],
    queryFn: () => api.getRoutines(dateStr),
  });

  // Create routine
  const createRoutine = useMutation({
    mutationFn: (data: {
      title: string;
      icon: string | null;
      category: string | null;
      frequency: RoutineFrequency;
      daysOfWeek: number[] | null;
      assignedProfileId: string | null;
    }) => api.createRoutine(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routines"] });
      setShowModal(false);
    },
  });

  // Update routine
  const updateRoutine = useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      title?: string;
      icon?: string | null;
      category?: string | null;
      frequency?: RoutineFrequency;
      daysOfWeek?: number[] | null;
      assignedProfileId?: string | null;
    }) => api.updateRoutine(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routines"] });
      setShowModal(false);
      setEditingRoutine(null);
    },
  });

  const handleSave = (data: {
    title: string;
    icon: string | null;
    category: string | null;
    frequency: RoutineFrequency;
    daysOfWeek: number[] | null;
    assignedProfileId: string | null;
  }) => {
    if (editingRoutine) {
      updateRoutine.mutate({ id: editingRoutine.id, ...data });
    } else {
      createRoutine.mutate(data);
    }
  };

  const handleEdit = (routine: RoutineWithCompletions) => {
    setEditingRoutine(routine);
    setShowModal(true);
  };

  // Group routines by category
  const categories = new Map<string, RoutineWithCompletions[]>();
  const uncategorized: RoutineWithCompletions[] = [];

  for (const routine of routines) {
    if (routine.category) {
      const existing = categories.get(routine.category) || [];
      existing.push(routine);
      categories.set(routine.category, existing);
    } else {
      uncategorized.push(routine);
    }
  }

  const completedCount = routines.filter((r) => r.isCompletedToday).length;
  const totalCount = routines.length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <ListChecks className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                Routines
              </h1>
              <p className="text-sm text-muted-foreground">
                {totalCount > 0
                  ? `${completedCount}/${totalCount} completed`
                  : "Track daily habits & chores"}
              </p>
            </div>
          </div>

          <Button
            onClick={() => {
              setEditingRoutine(null);
              setShowModal(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Routine
          </Button>
        </div>

        {/* Date navigation & profile selector */}
        <div className="flex items-center justify-between px-4 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedDate((d) => subDays(d, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setSelectedDate(new Date())}
              className="rounded-md px-3 py-1 text-sm font-medium hover:bg-accent"
            >
              {isToday ? "Today" : format(selectedDate, "EEE, MMM d")}
            </button>
            <button
              onClick={() => setSelectedDate((d) => addDays(d, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Active profile selector */}
          {profiles.length > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveProfile(null)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  !activeProfileId
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                All
              </button>
              {profiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setActiveProfile(p.id)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    activeProfileId === p.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {p.icon ? `${p.icon} ` : ""}
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="px-4 pb-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{
                  width: `${(completedCount / totalCount) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-pulse text-muted-foreground">
              Loading routines...
            </div>
          </div>
        ) : routines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
              <ListChecks className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">
              No routines yet
            </h2>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              Create your first routine to start tracking daily habits and
              household chores.
            </p>
            <Button
              onClick={() => {
                setEditingRoutine(null);
                setShowModal(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Routine
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Categorized routines */}
            {Array.from(categories.entries()).map(([cat, items]) => (
              <div key={cat}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
                  {cat}
                </h3>
                <div className="space-y-1.5">
                  {items.map((routine) => (
                    <RoutineItem
                      key={routine.id}
                      routine={routine}
                      date={dateStr}
                      activeProfileId={activeProfileId}
                      profiles={profiles}
                      onEdit={handleEdit}
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* Uncategorized routines */}
            {uncategorized.length > 0 && (
              <div>
                {categories.size > 0 && (
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
                    Other
                  </h3>
                )}
                <div className="space-y-1.5">
                  {uncategorized.map((routine) => (
                    <RoutineItem
                      key={routine.id}
                      routine={routine}
                      date={dateStr}
                      activeProfileId={activeProfileId}
                      profiles={profiles}
                      onEdit={handleEdit}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add/Edit Modal */}
      <AddRoutineModal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingRoutine(null);
        }}
        onSave={handleSave}
        editingRoutine={editingRoutine}
        profiles={profiles}
      />
    </div>
  );
}
