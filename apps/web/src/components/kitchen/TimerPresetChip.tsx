import { X } from "lucide-react";
import type { KitchenTimerPreset } from "@openframe/shared";

interface TimerPresetChipProps {
  preset: KitchenTimerPreset;
  onStart: (preset: KitchenTimerPreset) => void;
  onDelete: (id: string) => void;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0 && s > 0) return `${m}m ${s}s`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

export function TimerPresetChip({
  preset,
  onStart,
  onDelete,
}: TimerPresetChipProps) {
  return (
    <div className="group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 hover:bg-primary/10 cursor-pointer transition-colors">
      <button
        onClick={() => onStart(preset)}
        className="flex items-center gap-2 text-sm"
      >
        <span className="font-medium text-foreground">{preset.name}</span>
        <span className="text-primary/80">{formatDuration(preset.durationSeconds)}</span>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(preset.id);
        }}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded-full hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all"
        title="Delete preset"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
