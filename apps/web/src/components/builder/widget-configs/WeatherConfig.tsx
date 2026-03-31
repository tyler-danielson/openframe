import type { WidgetConfigProps } from "./types";

export function WeatherConfig({ config, onChange }: WidgetConfigProps) {
  return (
    <>
      <label className="flex items-center justify-between">
        <span className="text-sm">Show Icon</span>
        <input
          type="checkbox"
          checked={config.showIcon as boolean ?? true}
          onChange={(e) => onChange("showIcon", e.target.checked)}
          className="rounded"
        />
      </label>
      <label className="flex items-center justify-between">
        <span className="text-sm">Show Description</span>
        <input
          type="checkbox"
          checked={config.showDescription as boolean ?? true}
          onChange={(e) => onChange("showDescription", e.target.checked)}
          className="rounded"
        />
      </label>
      <label className="flex items-center justify-between">
        <span className="text-sm">Show Humidity</span>
        <input
          type="checkbox"
          checked={config.showHumidity as boolean ?? true}
          onChange={(e) => onChange("showHumidity", e.target.checked)}
          className="rounded"
        />
      </label>
    </>
  );
}
