import type { WidgetConfigProps } from "../types";

interface HeaderSettingsProps {
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  defaultHeaderText: string;
}

export function HeaderSettings({
  config,
  onChange,
  defaultHeaderText,
}: HeaderSettingsProps) {
  const headerMode = (config.headerMode as string) ?? "default";

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="text-sm">Header</span>
        <select
          value={headerMode}
          onChange={(e) => onChange("headerMode", e.target.value)}
          className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="default">Default ({defaultHeaderText})</option>
          <option value="custom">Custom</option>
          <option value="hidden">Hidden</option>
        </select>
      </label>
      {headerMode === "custom" && (
        <label className="block">
          <span className="text-sm">Custom Header Text</span>
          <input
            type="text"
            value={config.customHeader as string ?? ""}
            onChange={(e) => onChange("customHeader", e.target.value)}
            className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
            placeholder="Enter custom header..."
          />
        </label>
      )}
    </div>
  );
}
