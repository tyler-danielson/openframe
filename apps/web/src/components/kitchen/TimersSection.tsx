import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Timer } from "lucide-react";
import { api } from "../../services/api";
import { useTimerAlarm } from "../../hooks/useTimerAlarm";
import { ActiveTimerCard } from "./ActiveTimerCard";
import { TimerPresetChip } from "./TimerPresetChip";
import type { KitchenTimerPreset } from "@openframe/shared";

export function TimersSection() {
  const queryClient = useQueryClient();
  const { playAlarm } = useTimerAlarm();

  // Fetch active timers (poll every 5s to keep server state in sync)
  const { data: activeTimers = [] } = useQuery({
    queryKey: ["kitchen-active-timers"],
    queryFn: () => api.getActiveTimers(),
    refetchInterval: 5000,
  });

  // Fetch presets
  const { data: presets = [] } = useQuery({
    queryKey: ["kitchen-timer-presets"],
    queryFn: () => api.getTimerPresets(),
  });

  // Mutations
  const startTimer = useMutation({
    mutationFn: (data: { name: string; durationSeconds: number; presetId?: string | null }) =>
      api.startTimer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kitchen-active-timers"] });
    },
  });

  const updateTimer = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "pause" | "resume" | "cancel" }) =>
      api.updateActiveTimer(id, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kitchen-active-timers"] });
    },
  });

  const completeTimer = useMutation({
    mutationFn: (id: string) => api.completeTimer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kitchen-active-timers"] });
    },
  });

  const dismissTimer = useMutation({
    mutationFn: (id: string) => api.deleteActiveTimer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kitchen-active-timers"] });
    },
  });

  const deletePreset = useMutation({
    mutationFn: (id: string) => api.deleteTimerPreset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kitchen-timer-presets"] });
    },
  });

  const handleStartFromPreset = useCallback(
    (preset: KitchenTimerPreset) => {
      startTimer.mutate({
        name: preset.name,
        durationSeconds: preset.durationSeconds,
        presetId: preset.id,
      });
    },
    [startTimer]
  );

  const handleAlarm = useCallback(
    (name: string) => {
      playAlarm(name);
    },
    [playAlarm]
  );

  // Only show visible (non-cancelled) timers, with running/paused first
  const visibleTimers = activeTimers
    .filter((t) => t.status !== "cancelled")
    .sort((a, b) => {
      const order = { running: 0, paused: 1, completed: 2 };
      const ao = order[a.status as keyof typeof order] ?? 3;
      const bo = order[b.status as keyof typeof order] ?? 3;
      return ao - bo;
    });

  const hasTimers = visibleTimers.length > 0;
  const hasPresets = presets.length > 0;

  if (!hasTimers && !hasPresets) return null;

  return (
    <div className="space-y-4">
      {/* Active Timers */}
      {hasTimers && (
        <div>
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
            <Timer className="h-4 w-4" />
            Active Timers
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {visibleTimers.map((timer) => (
              <ActiveTimerCard
                key={timer.id}
                timer={timer}
                onPause={(id) => updateTimer.mutate({ id, action: "pause" })}
                onResume={(id) => updateTimer.mutate({ id, action: "resume" })}
                onCancel={(id) => updateTimer.mutate({ id, action: "cancel" })}
                onComplete={(id) => completeTimer.mutate(id)}
                onDismiss={(id) => dismissTimer.mutate(id)}
                onAlarm={handleAlarm}
              />
            ))}
          </div>
        </div>
      )}

      {/* Timer Presets */}
      {hasPresets && (
        <div>
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">
            Quick Timers
          </h2>
          <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
            {presets.map((preset) => (
              <TimerPresetChip
                key={preset.id}
                preset={preset}
                onStart={handleStartFromPreset}
                onDelete={(id) => deletePreset.mutate(id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
