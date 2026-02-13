import { useEffect, useRef } from "react";
import { Pause, Play, X, Trash2 } from "lucide-react";
import type { KitchenActiveTimer } from "@openframe/shared";
import { useCountdown } from "../../hooks/useCountdown";
import { cn } from "../../lib/utils";

interface ActiveTimerCardProps {
  timer: KitchenActiveTimer;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onComplete: (id: string) => void;
  onDismiss: (id: string) => void;
  onAlarm: (name: string) => void;
}

export function ActiveTimerCard({
  timer,
  onPause,
  onResume,
  onCancel,
  onComplete,
  onDismiss,
  onAlarm,
}: ActiveTimerCardProps) {
  const isRunning = timer.status === "running";
  const isPaused = timer.status === "paused";
  const isCompleted = timer.status === "completed";
  const isCancelled = timer.status === "cancelled";

  const { minutes, seconds, totalRemaining, isComplete } = useCountdown(
    timer.remainingSeconds,
    isRunning
  );

  const alarmFiredRef = useRef(false);

  // Fire alarm when countdown hits 0
  useEffect(() => {
    if (isComplete && isRunning && !alarmFiredRef.current) {
      alarmFiredRef.current = true;
      onComplete(timer.id);
      onAlarm(timer.name);
    }
  }, [isComplete, isRunning, timer.id, timer.name, onComplete, onAlarm]);

  // Reset alarm flag when timer changes
  useEffect(() => {
    if (!isRunning) {
      alarmFiredRef.current = false;
    }
  }, [isRunning]);

  const isLastTenSeconds = isRunning && totalRemaining <= 10 && totalRemaining > 0;
  const progress = timer.durationSeconds > 0
    ? ((timer.durationSeconds - totalRemaining) / timer.durationSeconds) * 100
    : 100;

  const displayMinutes = String(minutes).padStart(2, "0");
  const displaySeconds = String(seconds).padStart(2, "0");

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border p-4 transition-all",
        isRunning && !isLastTenSeconds && "border-primary/40 bg-primary/5",
        isLastTenSeconds && "border-red-500/60 bg-red-500/10 animate-pulse",
        isPaused && "border-border bg-muted/50",
        isCompleted && "border-green-500/40 bg-green-500/5",
        isCancelled && "border-border bg-muted/30 opacity-60"
      )}
    >
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 h-1 bg-primary/20 w-full">
        <div
          className={cn(
            "h-full transition-all duration-1000",
            isCompleted ? "bg-green-500" : isLastTenSeconds ? "bg-red-500" : "bg-primary"
          )}
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">
            {timer.name}
          </p>
          <p
            className={cn(
              "text-3xl font-mono font-bold tabular-nums",
              isRunning && "text-primary",
              isLastTenSeconds && "text-red-500",
              isPaused && "text-muted-foreground",
              isCompleted && "text-green-500",
              isCancelled && "text-muted-foreground"
            )}
          >
            {displayMinutes}:{displaySeconds}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {isRunning && (
            <button
              onClick={() => onPause(timer.id)}
              className="p-2 rounded-lg hover:bg-primary/10 text-primary transition-colors"
              title="Pause"
            >
              <Pause className="h-5 w-5" />
            </button>
          )}
          {isPaused && (
            <button
              onClick={() => onResume(timer.id)}
              className="p-2 rounded-lg hover:bg-primary/10 text-primary transition-colors"
              title="Resume"
            >
              <Play className="h-5 w-5" />
            </button>
          )}
          {(isRunning || isPaused) && (
            <button
              onClick={() => onCancel(timer.id)}
              className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {(isCompleted || isCancelled) && (
            <button
              onClick={() => onDismiss(timer.id)}
              className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="Dismiss"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
