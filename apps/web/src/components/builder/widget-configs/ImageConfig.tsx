import type { WidgetConfigProps } from "./types";

export function ImageConfig({
  config,
  onChange,
}: WidgetConfigProps) {
  return (
    <>
      <label className="block">
        <span className="text-sm">Image URL</span>
        <input
          type="url"
          value={config.url as string ?? ""}
          onChange={(e) => onChange("url", e.target.value)}
          className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
          placeholder="https://..."
        />
      </label>
      <label className="block">
        <span className="text-sm">Fit</span>
        <select
          value={config.fit as string ?? "contain"}
          onChange={(e) => onChange("fit", e.target.value)}
          className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="contain">Contain</option>
          <option value="cover">Cover</option>
          <option value="fill">Fill</option>
        </select>
      </label>
    </>
  );
}
