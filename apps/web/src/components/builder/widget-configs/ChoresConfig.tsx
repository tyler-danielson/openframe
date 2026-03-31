import type { WidgetConfigProps } from "./types";

export function ChoresConfig({
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
          value={config.maxItems as number ?? 6}
          onChange={(e) => { const v = parseInt(e.target.value); onChange("maxItems", Number.isNaN(v) ? 6 : v); }}
          className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-sm">Group By</span>
        <select
          value={config.groupBy as string ?? "none"}
          onChange={(e) => onChange("groupBy", e.target.value)}
          className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="none">No Grouping</option>
          <option value="assignee">Assignee</option>
          <option value="status">Status</option>
        </select>
      </label>
      <label className="flex items-center justify-between">
        <span className="text-sm">Show Completed</span>
        <input
          type="checkbox"
          checked={config.showCompleted as boolean ?? false}
          onChange={(e) => onChange("showCompleted", e.target.checked)}
          className="rounded"
        />
      </label>
      <label className="flex items-center justify-between">
        <span className="text-sm">Show Due Date</span>
        <input
          type="checkbox"
          checked={config.showDueDate as boolean ?? true}
          onChange={(e) => onChange("showDueDate", e.target.checked)}
          className="rounded"
        />
      </label>
      <label className="flex items-center justify-between">
        <span className="text-sm">Show Assignee</span>
        <input
          type="checkbox"
          checked={config.showAssignee as boolean ?? true}
          onChange={(e) => onChange("showAssignee", e.target.checked)}
          className="rounded"
        />
      </label>
    </>
  );
}
