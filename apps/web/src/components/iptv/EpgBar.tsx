import { useMemo } from "react";
import { Clock, ChevronRight } from "lucide-react";
import type { IptvEpgEntry } from "@openframe/shared";

interface EpgBarProps {
  epgEntries: IptvEpgEntry[];
  isLoading?: boolean;
}

export function EpgBar({ epgEntries, isLoading }: EpgBarProps) {
  const { currentProgram, nextProgram, progress } = useMemo(() => {
    const now = new Date();

    const current = epgEntries.find((entry) => {
      const start = new Date(entry.startTime);
      const end = new Date(entry.endTime);
      return now >= start && now < end;
    });

    const next = epgEntries.find((entry) => {
      const start = new Date(entry.startTime);
      return start > now;
    });

    let progressPercent = 0;
    if (current) {
      const start = new Date(current.startTime).getTime();
      const end = new Date(current.endTime).getTime();
      const nowTime = now.getTime();
      progressPercent = ((nowTime - start) / (end - start)) * 100;
    }

    return {
      currentProgram: current,
      nextProgram: next,
      progress: progressPercent,
    };
  }, [epgEntries]);

  if (isLoading) {
    return (
      <div className="border-t border-border bg-card px-4 py-3">
        <div className="animate-pulse">
          <div className="h-4 w-48 rounded bg-muted" />
          <div className="mt-1 h-3 w-32 rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (!currentProgram && !nextProgram) {
    return (
      <div className="border-t border-border bg-card px-4 py-3">
        <p className="text-sm text-muted-foreground">No program information available</p>
      </div>
    );
  }

  return (
    <div className="border-t border-border bg-card">
      {/* Progress bar */}
      {currentProgram && (
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-1000"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="flex items-stretch divide-x divide-border px-4 py-3">
        {/* Current program */}
        {currentProgram && (
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                NOW
              </span>
              <span className="text-xs text-muted-foreground">
                {formatTime(new Date(currentProgram.startTime))} -{" "}
                {formatTime(new Date(currentProgram.endTime))}
              </span>
            </div>
            <h4 className="mt-1 font-medium">{currentProgram.title}</h4>
            {currentProgram.description && (
              <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                {currentProgram.description}
              </p>
            )}
          </div>
        )}

        {/* Next program */}
        {nextProgram && (
          <div className="flex-1 pl-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                NEXT
              </span>
              <span className="text-xs text-muted-foreground">
                {formatTime(new Date(nextProgram.startTime))}
              </span>
            </div>
            <h4 className="mt-1 font-medium text-muted-foreground">
              {nextProgram.title}
            </h4>
            {nextProgram.description && (
              <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground/70">
                {nextProgram.description}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
