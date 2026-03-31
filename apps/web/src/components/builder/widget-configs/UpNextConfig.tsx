import { useRef, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../services/api";
import type { Calendar as CalendarType } from "@openframe/shared";
import type { WidgetConfigProps } from "./types";
import { HeaderSettings } from "./shared/HeaderSettings";

export function UpNextConfig({
  config,
  onChange,
}: WidgetConfigProps) {
  const { data: calendars = [] } = useQuery({
    queryKey: ["calendars-for-widget"],
    queryFn: () => api.getCalendars(),
    staleTime: 5 * 60 * 1000,
  });

  const selectedCalendarIds = (config.calendarIds as string[]) ?? [];
  const hasInitialized = useRef(false);

  // Sort calendars: favorites first, then alphabetically
  const sortedCalendars = useMemo(() => {
    return [...calendars].sort((a: CalendarType, b: CalendarType) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [calendars]);

  // Auto-select favorites on first load when no calendars are selected
  useEffect(() => {
    if (!hasInitialized.current && calendars.length > 0 && selectedCalendarIds.length === 0) {
      const favoriteIds = calendars
        .filter((cal: CalendarType) => cal.isFavorite)
        .map((cal: CalendarType) => cal.id);
      if (favoriteIds.length > 0) {
        onChange("calendarIds", favoriteIds);
      }
      hasInitialized.current = true;
    }
  }, [calendars, selectedCalendarIds.length, onChange]);

  const toggleCalendar = (calendarId: string) => {
    const current = selectedCalendarIds;
    if (current.includes(calendarId)) {
      onChange("calendarIds", current.filter((id) => id !== calendarId));
    } else {
      onChange("calendarIds", [...current, calendarId]);
    }
  };

  return (
    <>
      {/* Header Settings */}
      <HeaderSettings
        config={config}
        onChange={onChange}
        defaultHeaderText="Up Next"
      />

      {/* Max Events (0 = all) */}
      <label className="block">
        <span className="text-sm">Max Events <span className="text-xs text-muted-foreground">(0 = all)</span></span>
        <input
          type="number"
          min={0}
          max={50}
          value={config.maxItems as number ?? 10}
          onChange={(e) => { const v = parseInt(e.target.value); onChange("maxItems", Number.isNaN(v) ? 10 : v); }}
          className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
        />
      </label>

      {/* Show Countdown */}
      <label className="flex items-center justify-between">
        <span className="text-sm">Show Countdown</span>
        <input
          type="checkbox"
          checked={config.showCountdown as boolean ?? true}
          onChange={(e) => onChange("showCountdown", e.target.checked)}
          className="rounded"
        />
      </label>

      {/* Show Location */}
      <label className="flex items-center justify-between">
        <span className="text-sm">Show Location</span>
        <input
          type="checkbox"
          checked={config.showLocation as boolean ?? true}
          onChange={(e) => onChange("showLocation", e.target.checked)}
          className="rounded"
        />
      </label>

      {/* Show Calendar Name */}
      <label className="flex items-center justify-between">
        <span className="text-sm">Show Calendar Name</span>
        <input
          type="checkbox"
          checked={config.showCalendarName as boolean ?? true}
          onChange={(e) => onChange("showCalendarName", e.target.checked)}
          className="rounded"
        />
      </label>

      {/* Show Description */}
      <label className="flex items-center justify-between">
        <span className="text-sm">Show Description</span>
        <input
          type="checkbox"
          checked={config.showDescription as boolean ?? false}
          onChange={(e) => onChange("showDescription", e.target.checked)}
          className="rounded"
        />
      </label>

      {/* Hide Blank Events */}
      <label className="flex items-center justify-between">
        <span className="text-sm">Hide Blank Events</span>
        <input
          type="checkbox"
          checked={config.hideBlankEvents as boolean ?? false}
          onChange={(e) => onChange("hideBlankEvents", e.target.checked)}
          className="rounded"
        />
      </label>

      {/* Hide Duplicates */}
      <label className="flex items-center justify-between">
        <span className="text-sm">Hide Duplicates</span>
        <input
          type="checkbox"
          checked={config.hideDuplicates as boolean ?? false}
          onChange={(e) => onChange("hideDuplicates", e.target.checked)}
          className="rounded"
        />
      </label>

      {/* Hide All Day Events */}
      <label className="flex items-center justify-between">
        <span className="text-sm">Hide All Day Events</span>
        <input
          type="checkbox"
          checked={config.hideAllDayEvents as boolean ?? false}
          onChange={(e) => onChange("hideAllDayEvents", e.target.checked)}
          className="rounded"
        />
      </label>

      {/* Calendar Selection */}
      <div className="block">
        <span className="text-sm">Calendars</span>
        <span className="text-xs text-muted-foreground ml-2">
          {selectedCalendarIds.length === 0 ? "(all visible)" : `(${selectedCalendarIds.length} selected)`}
        </span>
        <div className="mt-2 space-y-1 max-h-40 overflow-y-auto rounded border border-border bg-background p-2">
          {sortedCalendars.length === 0 ? (
            <span className="text-xs text-muted-foreground">No calendars found</span>
          ) : (
            sortedCalendars.map((cal: CalendarType) => (
              <label key={cal.id} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-muted/50 rounded px-1">
                <input
                  type="checkbox"
                  checked={selectedCalendarIds.includes(cal.id)}
                  onChange={() => toggleCalendar(cal.id)}
                  className="rounded"
                />
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cal.color }}
                />
                <span className="text-sm truncate flex-1">
                  {cal.name}
                  {(cal.accountLabel || cal.provider) && (
                    <span className="text-muted-foreground ml-1">({cal.accountLabel || cal.provider})</span>
                  )}
                </span>
                {cal.isFavorite && (
                  <span className="text-yellow-500 text-xs">★</span>
                )}
              </label>
            ))
          )}
        </div>
      </div>
    </>
  );
}
