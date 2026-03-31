import type { WidgetConfigProps } from "./types";
import { CalendarConfig } from "./CalendarConfig";

export function WeekScheduleConfig({
  config,
  onChange,
  widgetId,
}: WidgetConfigProps) {
  const viewMode = (config.viewMode as string) ?? "fixed";

  return (
    <>
      <CalendarConfig config={config} onChange={onChange} widgetId={widgetId} />

      {/* Number of Days */}
      <label className="block">
        <span className="text-sm">Number of Days</span>
        <select
          value={config.numberOfDays as number ?? 5}
          onChange={(e) => onChange("numberOfDays", parseInt(e.target.value))}
          className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
        >
          <option value={3}>3 days</option>
          <option value={4}>4 days</option>
          <option value={5}>5 days</option>
          <option value={6}>6 days</option>
          <option value={7}>7 days</option>
        </select>
      </label>

      {/* Start From */}
      <label className="block">
        <span className="text-sm">Start From</span>
        <select
          value={config.startDay as string ?? "today"}
          onChange={(e) => onChange("startDay", e.target.value)}
          className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="today">Today</option>
          <option value="weekStart">Week Start (Monday)</option>
        </select>
      </label>

      {/* View Mode */}
      <label className="block">
        <span className="text-sm">View Mode</span>
        <select
          value={viewMode}
          onChange={(e) => onChange("viewMode", e.target.value)}
          className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="fixed">Fixed Hours</option>
          <option value="rolling">Rolling Window</option>
        </select>
      </label>

      {/* Fixed mode options */}
      {viewMode === "fixed" && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm">Start Hour</span>
            <input
              type="number"
              min={0}
              max={23}
              value={config.startHour as number ?? 6}
              onChange={(e) => onChange("startHour", parseInt(e.target.value) || 6)}
              className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm">End Hour</span>
            <input
              type="number"
              min={0}
              max={23}
              value={config.endHour as number ?? 22}
              onChange={(e) => onChange("endHour", parseInt(e.target.value) || 22)}
              className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>
      )}

      {/* Rolling mode options */}
      {viewMode === "rolling" && (
        <>
          <label className="block">
            <span className="text-sm">Look Back</span>
            <p className="text-xs text-muted-foreground mb-1">How far before current time to show</p>
            <select
              value={config.rollingOffsetMinutes as number ?? 60}
              onChange={(e) => onChange("rollingOffsetMinutes", parseInt(e.target.value))}
              className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
            >
              <option value={0}>Current time (no offset)</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={120}>2 hours</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm">Window Duration</span>
            <p className="text-xs text-muted-foreground mb-1">Total hours to display</p>
            <select
              value={config.rollingDurationHours as number ?? 8}
              onChange={(e) => onChange("rollingDurationHours", parseInt(e.target.value))}
              className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
            >
              <option value={4}>4 hours</option>
              <option value={6}>6 hours</option>
              <option value={8}>8 hours</option>
              <option value={10}>10 hours</option>
              <option value={12}>12 hours</option>
            </select>
          </label>
        </>
      )}

      <label className="flex items-center justify-between">
        <span className="text-sm">Show All-Day Events</span>
        <input
          type="checkbox"
          checked={config.showAllDayEvents as boolean ?? true}
          onChange={(e) => onChange("showAllDayEvents", e.target.checked)}
          className="rounded"
        />
      </label>
      <label className="flex items-center justify-between">
        <span className="text-sm">Show Day Headers</span>
        <input
          type="checkbox"
          checked={config.showDayHeaders as boolean ?? true}
          onChange={(e) => onChange("showDayHeaders", e.target.checked)}
          className="rounded"
        />
      </label>
      <label className="flex items-center justify-between">
        <span className="text-sm">Show Current Time</span>
        <input
          type="checkbox"
          checked={config.showCurrentTime as boolean ?? true}
          onChange={(e) => onChange("showCurrentTime", e.target.checked)}
          className="rounded"
        />
      </label>
      <label className="flex items-center justify-between">
        <span className="text-sm">Show Hour Labels</span>
        <input
          type="checkbox"
          checked={config.showHourLabels as boolean ?? true}
          onChange={(e) => onChange("showHourLabels", e.target.checked)}
          className="rounded"
        />
      </label>
    </>
  );
}
