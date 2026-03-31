import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../services/api";
import type { WidgetConfigProps } from "./types";

export function CountdownConfig({ config, onChange }: WidgetConfigProps) {
  const eventId = config.eventId as string ?? "";
  const displayMode = config.displayMode as "full" | "days" ?? "full";
  const hasEventOrDate = eventId || config.targetDate;
  const sourceMode = eventId ? "event" : "manual";

  // Fetch upcoming events for the dropdown
  const { data: events = [] } = useQuery({
    queryKey: ["upcoming-events-for-countdown"],
    queryFn: async () => {
      const start = new Date();
      const end = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      return api.getEvents(start, end);
    },
    staleTime: 60 * 1000,
  });

  // Filter to future events only and sort by date
  const futureEvents = useMemo(() => {
    return events
      .filter(e => new Date(e.startTime) > new Date())
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [events]);

  // Format date for display
  const formatEventDate = (dateInput: Date | string) => {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleSourceChange = (newSource: "manual" | "event") => {
    if (newSource === "manual") {
      onChange("eventId", "");
    } else {
      // When switching to event mode, clear manual fields
      onChange("targetDate", "");
    }
  };

  return (
    <>
      {/* Source Selection */}
      <div className="block">
        <span className="text-sm">Source</span>
        <div className="flex gap-4 mt-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="countdownSource"
              checked={sourceMode === "manual"}
              onChange={() => handleSourceChange("manual")}
              className="rounded"
            />
            <span className="text-sm">Manual Date</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="countdownSource"
              checked={sourceMode === "event"}
              onChange={() => handleSourceChange("event")}
              className="rounded"
            />
            <span className="text-sm">Calendar Event</span>
          </label>
        </div>
      </div>

      {/* Source-specific fields */}
      {sourceMode === "manual" ? (
        <>
          <label className="block">
            <span className="text-sm">Label</span>
            <input
              type="text"
              value={config.label as string ?? ""}
              onChange={(e) => onChange("label", e.target.value)}
              className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
              placeholder="Countdown to..."
            />
          </label>
          <label className="block">
            <span className="text-sm">Target Date</span>
            <input
              type="datetime-local"
              value={config.targetDate as string ?? ""}
              onChange={(e) => onChange("targetDate", e.target.value)}
              className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        </>
      ) : (
        <label className="block">
          <span className="text-sm">Select Event</span>
          <select
            value={eventId}
            onChange={(e) => onChange("eventId", e.target.value)}
            className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Select an event...</option>
            {futureEvents.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title} - {formatEventDate(event.startTime)}
              </option>
            ))}
          </select>
          {futureEvents.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">No upcoming events found</p>
          )}
        </label>
      )}

      {/* Display Mode */}
      <div className="block">
        <span className="text-sm">Display Mode</span>
        <div className="flex gap-4 mt-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="displayMode"
              checked={displayMode === "full"}
              onChange={() => onChange("displayMode", "full")}
              className="rounded"
            />
            <span className="text-sm">Full Timer</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="displayMode"
              checked={displayMode === "days"}
              onChange={() => onChange("displayMode", "days")}
              className="rounded"
            />
            <span className="text-sm">Days (Sleeps)</span>
          </label>
        </div>
      </div>

      {/* Timer component toggles - only show for Full Timer mode */}
      {displayMode === "full" && (
        <div className="space-y-2 border-t border-border pt-3 mt-3">
          <span className="text-xs text-muted-foreground">Timer Components</span>
          <label className="flex items-center justify-between">
            <span className="text-sm">Show Days</span>
            <input
              type="checkbox"
              checked={config.showDays as boolean ?? true}
              onChange={(e) => onChange("showDays", e.target.checked)}
              className="rounded"
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm">Show Hours</span>
            <input
              type="checkbox"
              checked={config.showHours as boolean ?? true}
              onChange={(e) => onChange("showHours", e.target.checked)}
              className="rounded"
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm">Show Minutes</span>
            <input
              type="checkbox"
              checked={config.showMinutes as boolean ?? true}
              onChange={(e) => onChange("showMinutes", e.target.checked)}
              className="rounded"
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm">Show Seconds</span>
            <input
              type="checkbox"
              checked={config.showSeconds as boolean ?? false}
              onChange={(e) => onChange("showSeconds", e.target.checked)}
              className="rounded"
            />
          </label>
        </div>
      )}

      {/* Clear event button - make it a placeholder */}
      {hasEventOrDate && (
        <div className="border-t border-border pt-3 mt-3">
          <button
            onClick={() => {
              onChange("eventId", "");
              onChange("targetDate", "");
            }}
            className="w-full px-3 py-2 text-sm text-destructive border border-destructive/30 rounded-md hover:bg-destructive/10 transition-colors"
          >
            Clear event (make placeholder)
          </button>
        </div>
      )}
    </>
  );
}
