import type { WidgetConfigProps } from "./types";

export function HAEntityConfig({
  config,
  onChange,
  openEntityBrowser,
}: WidgetConfigProps) {
  return (
    <>
      <label className="block">
        <span className="text-sm">Entity ID</span>
        <div className="flex gap-2 mt-1">
          <input
            type="text"
            value={config.entityId as string ?? ""}
            onChange={(e) => onChange("entityId", e.target.value)}
            className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm"
            placeholder="sensor.temperature"
          />
          <button
            onClick={() => openEntityBrowser?.("entityId")}
            className="px-3 py-2 rounded border border-border bg-muted hover:bg-muted/80 text-sm"
          >
            Browse
          </button>
        </div>
      </label>
      {/* Gauge fields (min/max/unit) — shown for ha-gauge widgets */}
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-sm">Min</span>
          <input
            type="number"
            value={config.min as number ?? 0}
            onChange={(e) => onChange("min", parseFloat(e.target.value) || 0)}
            className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm">Max</span>
          <input
            type="number"
            value={config.max as number ?? 100}
            onChange={(e) => onChange("max", parseFloat(e.target.value) || 100)}
            className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-sm">Unit</span>
        <input
          type="text"
          value={config.unit as string ?? ""}
          onChange={(e) => onChange("unit", e.target.value)}
          className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
          placeholder="°F"
        />
      </label>
      {/* Graph fields (hours) — shown for ha-graph widgets */}
      <label className="block">
        <span className="text-sm">Hours to Show</span>
        <input
          type="number"
          min={1}
          max={168}
          value={config.hours as number ?? 24}
          onChange={(e) => onChange("hours", parseInt(e.target.value) || 24)}
          className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
        />
      </label>
    </>
  );
}
