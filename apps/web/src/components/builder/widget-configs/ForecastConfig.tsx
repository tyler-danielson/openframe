import type { WidgetConfigProps } from "./types";

export function ForecastConfig({ config, onChange }: WidgetConfigProps) {
  return (
    <label className="block">
      <span className="text-sm">Days to Show</span>
      <input
        type="number"
        min={1}
        max={10}
        value={config.days as number ?? 5}
        onChange={(e) => onChange("days", parseInt(e.target.value) || 5)}
        className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
      />
    </label>
  );
}
