import type { WidgetConfigProps } from "./types";

export function AirQualityConfig({ config, onChange }: WidgetConfigProps) {
  return (
    <>
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-muted-foreground w-28 shrink-0">Pollutants</span>
        <div className="flex items-center gap-3 flex-1">
          <input type="checkbox" checked={config.showComponents as boolean ?? true}
            onChange={(e) => onChange("showComponents", e.target.checked)}
            className="rounded" />
          <span className="text-sm text-muted-foreground">Show individual pollutant levels</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Air quality data from OpenWeatherMap. Make sure your weather API key and location are configured.
      </p>
    </>
  );
}
