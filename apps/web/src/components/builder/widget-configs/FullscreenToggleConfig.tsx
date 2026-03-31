import type { WidgetConfigProps } from "./types";

export function FullscreenToggleConfig({ config, onChange }: WidgetConfigProps) {
  return (
    <>
      <label className="block">
        <span className="text-sm">Button Style</span>
        <select
          value={config.buttonStyle as string ?? "icon"}
          onChange={(e) => onChange("buttonStyle", e.target.value)}
          className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="icon">Icon Only</option>
          <option value="text">Text Only</option>
          <option value="both">Icon and Text</option>
        </select>
      </label>
      {(config.buttonStyle === "text" || config.buttonStyle === "both") && (
        <label className="block">
          <span className="text-sm">Button Label</span>
          <input
            type="text"
            value={config.label as string ?? "Fullscreen"}
            onChange={(e) => onChange("label", e.target.value)}
            className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
            placeholder="Fullscreen"
          />
        </label>
      )}
      <label className="block">
        <span className="text-sm">Icon Size</span>
        <select
          value={config.iconSize as string ?? "medium"}
          onChange={(e) => onChange("iconSize", e.target.value)}
          className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </label>
    </>
  );
}
