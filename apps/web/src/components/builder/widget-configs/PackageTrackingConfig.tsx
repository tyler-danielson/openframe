import type { WidgetConfigProps } from "./types";

export function PackageTrackingConfig({
  config,
  onChange,
}: WidgetConfigProps) {
  return (
    <>
      <label className="block">
        <span className="text-sm">Display Mode</span>
        <select
          value={config.displayMode as string ?? "list"}
          onChange={(e) => onChange("displayMode", e.target.value)}
          className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="list">List</option>
          <option value="summary">Summary</option>
        </select>
      </label>
      <label className="block">
        <span className="text-sm">Max Items <span className="text-xs text-muted-foreground">(0 = all)</span></span>
        <input
          type="number"
          min={0}
          max={20}
          value={config.maxItems as number ?? 5}
          onChange={(e) => { const v = parseInt(e.target.value); onChange("maxItems", Number.isNaN(v) ? 5 : v); }}
          className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
        />
      </label>
      <label className="flex items-center justify-between">
        <span className="text-sm">Show Delivered</span>
        <input
          type="checkbox"
          checked={config.showDelivered as boolean ?? false}
          onChange={(e) => onChange("showDelivered", e.target.checked)}
          className="rounded"
        />
      </label>
      <label className="flex items-center justify-between">
        <span className="text-sm">Show Carrier Icon</span>
        <input
          type="checkbox"
          checked={config.showCarrierIcon as boolean ?? true}
          onChange={(e) => onChange("showCarrierIcon", e.target.checked)}
          className="rounded"
        />
      </label>
      <label className="flex items-center justify-between">
        <span className="text-sm">Show ETA</span>
        <input
          type="checkbox"
          checked={config.showETA as boolean ?? true}
          onChange={(e) => onChange("showETA", e.target.checked)}
          className="rounded"
        />
      </label>
    </>
  );
}
