import type { WidgetConfigProps } from "./types";

export function TextConfig({
  config,
  onChange,
}: WidgetConfigProps) {
  return (
    <>
      <label className="block">
        <span className="text-sm">Content</span>
        <textarea
          value={config.content as string ?? ""}
          onChange={(e) => onChange("content", e.target.value)}
          className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm resize-none"
          rows={3}
          placeholder="Enter text..."
        />
      </label>
      <label className="block">
        <span className="text-sm">Text Align</span>
        <select
          value={config.textAlign as string ?? "center"}
          onChange={(e) => onChange("textAlign", e.target.value)}
          className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </label>
    </>
  );
}
