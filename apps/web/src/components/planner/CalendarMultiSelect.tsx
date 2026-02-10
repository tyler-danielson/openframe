import { useQuery } from "@tanstack/react-query";
import { Loader2, Calendar } from "lucide-react";
import { api } from "../../services/api";

interface CalendarMultiSelectProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function CalendarMultiSelect({ selectedIds, onChange }: CalendarMultiSelectProps) {
  const { data: calendars, isLoading, error } = useQuery({
    queryKey: ["calendars"],
    queryFn: () => api.getCalendars(),
  });

  const handleToggle = (calendarId: string) => {
    if (selectedIds.includes(calendarId)) {
      onChange(selectedIds.filter((id) => id !== calendarId));
    } else {
      onChange([...selectedIds, calendarId]);
    }
  };

  const handleSelectAll = () => {
    if (!calendars) return;
    const allIds = calendars.filter((c) => c.syncEnabled).map((c) => c.id);
    onChange(allIds);
  };

  const handleSelectNone = () => {
    onChange([]);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-destructive py-2">
        Failed to load calendars
      </div>
    );
  }

  // Only show calendars that have sync enabled
  const syncedCalendars = calendars?.filter((c) => c.syncEnabled) || [];

  if (syncedCalendars.length === 0) {
    return (
      <div className="text-xs text-muted-foreground py-2 flex items-center gap-2">
        <Calendar className="h-3 w-3" />
        No synced calendars found
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Quick actions */}
      <div className="flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={handleSelectAll}
          className="text-primary hover:underline"
        >
          Select all
        </button>
        <span className="text-muted-foreground">|</span>
        <button
          type="button"
          onClick={handleSelectNone}
          className="text-primary hover:underline"
        >
          Clear
        </button>
      </div>

      {/* Calendar list */}
      <div className="border border-border rounded-md max-h-48 overflow-auto">
        {syncedCalendars.map((calendar) => (
          <label
            key={calendar.id}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted/50 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(calendar.id)}
              onChange={() => handleToggle(calendar.id)}
              className="rounded border-border"
            />
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: calendar.color || "#3B82F6" }}
            />
            <span className="text-sm truncate flex-1">{calendar.name}</span>
            {calendar.provider !== "google" && (
              <span className="text-[10px] text-muted-foreground uppercase">
                {calendar.provider === "ics" ? "ICS" : calendar.provider === "homeassistant" ? "HA" : calendar.provider}
              </span>
            )}
          </label>
        ))}
      </div>

      {selectedIds.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {selectedIds.length} calendar{selectedIds.length !== 1 ? "s" : ""} selected
        </div>
      )}
    </div>
  );
}
