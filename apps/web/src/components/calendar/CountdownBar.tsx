import { useState, useEffect } from "react";
import { Timer } from "lucide-react";
import type { CalendarEvent } from "@openframe/shared";
import { calculateTimeRemaining, formatCountdownWithOptions } from "../../lib/countdown";

interface CountdownBarProps {
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
}

export function CountdownBar({ events, onSelectEvent }: CountdownBarProps) {
  const [, setTick] = useState(0);

  // Filter to future events with showCountdown enabled
  const countdownEvents = events.filter((e) => {
    const meta = e.metadata as Record<string, unknown> | undefined;
    return meta?.showCountdown === true && new Date(e.startTime) > new Date();
  });

  // Deduplicate recurring events (show only the next occurrence per recurringEventId)
  const deduped = new Map<string, CalendarEvent>();
  for (const e of countdownEvents) {
    const key = e.recurringEventId || e.id;
    const existing = deduped.get(key);
    if (!existing || new Date(e.startTime) < new Date(existing.startTime)) {
      deduped.set(key, e);
    }
  }

  const sorted = Array.from(deduped.values()).sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  // Tick every second for live countdown
  useEffect(() => {
    if (sorted.length === 0) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [sorted.length]);

  if (sorted.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 overflow-x-auto scrollbar-none">
      {sorted.map((event) => {
        const meta = event.metadata as Record<string, unknown> | undefined;
        const fmt = (meta?.countdownFormat as string) ?? "dhm";
        const displayName = (meta?.countdownLabel as string) || event.title;
        const tr = calculateTimeRemaining(new Date(event.startTime));
        return (
          <button
            key={event.id}
            onClick={() => onSelectEvent(event)}
            className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 hover:bg-primary/20 transition-colors flex-1 min-w-0"
          >
            <Timer className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-xs font-medium text-primary truncate">
              {displayName}
            </span>
            <span className="text-xs font-mono text-primary/80 tabular-nums shrink-0">
              {formatCountdownWithOptions(tr, fmt, new Date(event.startTime))}
            </span>
          </button>
        );
      })}
    </div>
  );
}
