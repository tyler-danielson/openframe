import type { WidgetConfigProps } from "./types";

export function StickyNotesConfig({
  config,
  onChange,
}: WidgetConfigProps) {
  return (
    <>
      <label className="block">
        <span className="text-sm">Max Notes <span className="text-xs text-muted-foreground">(0 = all)</span></span>
        <input
          type="number"
          min={0}
          max={20}
          value={config.maxNotes as number ?? 6}
          onChange={(e) => { const v = parseInt(e.target.value); onChange("maxNotes", Number.isNaN(v) ? 6 : v); }}
          className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-sm">Columns</span>
        <select
          value={config.columns as number ?? 2}
          onChange={(e) => onChange("columns", parseInt(e.target.value))}
          className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
        >
          <option value={1}>1 Column</option>
          <option value={2}>2 Columns</option>
          <option value={3}>3 Columns</option>
        </select>
      </label>
      <label className="flex items-center justify-between">
        <span className="text-sm">Show Author</span>
        <input
          type="checkbox"
          checked={config.showAuthor as boolean ?? true}
          onChange={(e) => onChange("showAuthor", e.target.checked)}
          className="rounded"
        />
      </label>
      <label className="flex items-center justify-between">
        <span className="text-sm">Show Timestamp</span>
        <input
          type="checkbox"
          checked={config.showTimestamp as boolean ?? false}
          onChange={(e) => onChange("showTimestamp", e.target.checked)}
          className="rounded"
        />
      </label>
      <label className="block">
        <span className="text-sm">Default Note Color</span>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="color"
            value={config.defaultColor as string ?? "#FEF3C7"}
            onChange={(e) => onChange("defaultColor", e.target.value)}
            className="h-8 w-8 rounded border border-border cursor-pointer"
          />
          <span className="text-xs text-muted-foreground">{config.defaultColor as string ?? "#FEF3C7"}</span>
        </div>
      </label>
    </>
  );
}
