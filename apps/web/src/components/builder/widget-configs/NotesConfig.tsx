import type { WidgetConfigProps } from "./types";

export function NotesConfig({
  config,
  onChange,
}: WidgetConfigProps) {
  return (
    <>
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-muted-foreground w-28 shrink-0">Show Checkboxes</span>
        <input
          type="checkbox"
          checked={config.showCheckboxes as boolean ?? false}
          onChange={(e) => onChange("showCheckboxes", e.target.checked)}
          className="rounded"
        />
      </div>
      <label className="block">
        <span className="text-sm font-medium text-muted-foreground">Content</span>
        <textarea
          value={config.content as string || ""}
          onChange={(e) => onChange("content", e.target.value)}
          className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm font-mono"
          rows={10}
          placeholder={"Use markdown-style formatting:\n- Bullet point\n- [x] Completed task\n- [ ] Pending task\n- [Link text](https://url)\n\nEach line is a separate item."}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Supports: bullets (- item), checkboxes (- [x] done / - [ ] todo), and links ([text](url))
        </p>
      </label>
    </>
  );
}
