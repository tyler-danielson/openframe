import type { WidgetConfigProps } from "./types";

export function NewsConfig({
  config,
  onChange,
}: WidgetConfigProps) {
  return (
    <>
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
        <span className="text-sm">Show Images</span>
        <input
          type="checkbox"
          checked={config.showImages as boolean ?? true}
          onChange={(e) => onChange("showImages", e.target.checked)}
          className="rounded"
        />
      </label>
      <label className="flex items-center justify-between">
        <span className="text-sm">Show Source</span>
        <input
          type="checkbox"
          checked={config.showSource as boolean ?? true}
          onChange={(e) => onChange("showSource", e.target.checked)}
          className="rounded"
        />
      </label>
      <label className="flex items-center justify-between">
        <span className="text-sm">Show Time</span>
        <input
          type="checkbox"
          checked={config.showTime as boolean ?? true}
          onChange={(e) => onChange("showTime", e.target.checked)}
          className="rounded"
        />
      </label>
    </>
  );
}
