import { Trash2 } from "lucide-react";
import type { WidgetConfigProps } from "./types";

export function MultiClockConfig({ config, onChange }: WidgetConfigProps) {
  const tzList = (config.timezones as { label: string; timezone: string }[]) || [
    { label: "Pacific", timezone: "America/Los_Angeles" },
    { label: "Central", timezone: "America/Chicago" },
    { label: "Eastern", timezone: "America/New_York" },
  ];
  return (
    <>
      <div className="flex items-center gap-4 mb-2">
        <span className="text-sm font-medium text-muted-foreground w-28 shrink-0">Timezones</span>
        <button
          onClick={() => onChange("timezones", [...tzList, { label: "UTC", timezone: "UTC" }])}
          className="text-xs text-primary hover:text-primary/80"
        >
          + Add timezone
        </button>
      </div>
      {tzList.map((tz, i) => (
        <div key={i} className="flex items-center gap-2 mb-2">
          <input
            type="text"
            value={tz.label}
            onChange={(e) => {
              const updated = tzList.map((t, j) => j === i ? { label: e.target.value, timezone: t.timezone } : t);
              onChange("timezones", updated);
            }}
            className="w-24 rounded border border-border bg-background px-2 py-1.5 text-sm"
            placeholder="Label"
          />
          <select
            value={tz.timezone}
            onChange={(e) => {
              const updated = tzList.map((t, j) => j === i ? { label: t.label, timezone: e.target.value } : t);
              onChange("timezones", updated);
            }}
            className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="America/New_York">Eastern (New York)</option>
            <option value="America/Chicago">Central (Chicago)</option>
            <option value="America/Denver">Mountain (Denver)</option>
            <option value="America/Los_Angeles">Pacific (Los Angeles)</option>
            <option value="America/Anchorage">Alaska</option>
            <option value="Pacific/Honolulu">Hawaii</option>
            <option value="UTC">UTC</option>
            <option value="Europe/London">London</option>
            <option value="Europe/Paris">Paris</option>
            <option value="Europe/Berlin">Berlin</option>
            <option value="Asia/Tokyo">Tokyo</option>
            <option value="Asia/Shanghai">Shanghai</option>
            <option value="Asia/Kolkata">Mumbai</option>
            <option value="Australia/Sydney">Sydney</option>
          </select>
          {tzList.length > 1 && (
            <button
              onClick={() => onChange("timezones", tzList.filter((_, j) => j !== i))}
              className="p-1 text-muted-foreground hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
      <div className="flex items-center gap-4 mt-3">
        <span className="text-sm font-medium text-muted-foreground w-28 shrink-0">Show Seconds</span>
        <input
          type="checkbox"
          checked={config.showSeconds as boolean ?? true}
          onChange={(e) => onChange("showSeconds", e.target.checked)}
          className="rounded"
        />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-muted-foreground w-28 shrink-0">Show Date</span>
        <input
          type="checkbox"
          checked={config.showDate as boolean ?? true}
          onChange={(e) => onChange("showDate", e.target.checked)}
          className="rounded"
        />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-muted-foreground w-28 shrink-0">Highlight Local</span>
        <input
          type="checkbox"
          checked={config.highlightLocal as boolean ?? true}
          onChange={(e) => onChange("highlightLocal", e.target.checked)}
          className="rounded"
        />
      </div>
    </>
  );
}
