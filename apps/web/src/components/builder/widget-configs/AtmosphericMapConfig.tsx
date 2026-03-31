import type { WidgetConfigProps } from "./types";

export function AtmosphericMapConfig({ config, onChange }: WidgetConfigProps) {
  return (
    <>
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-muted-foreground w-28 shrink-0">Layer</span>
        <select
          value={config.layer as string ?? "wind"}
          onChange={(e) => onChange("layer", e.target.value)}
          className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="wind">Wind</option>
          <option value="temp">Temperature</option>
          <option value="pressure">Pressure</option>
          <option value="clouds">Clouds</option>
          <option value="rain">Rain / Snow</option>
          <option value="waves">Waves</option>
          <option value="pm2p5">PM2.5 (Air Quality)</option>
          <option value="uvindex">UV Index</option>
        </select>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-muted-foreground w-28 shrink-0">Latitude</span>
        <input type="number" step="0.01" value={config.latitude as number ?? 40}
          onChange={(e) => onChange("latitude", parseFloat(e.target.value) || 0)}
          className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-muted-foreground w-28 shrink-0">Longitude</span>
        <input type="number" step="0.01" value={config.longitude as number ?? -105}
          onChange={(e) => onChange("longitude", parseFloat(e.target.value) || 0)}
          className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-muted-foreground w-28 shrink-0">Zoom</span>
        <input type="range" min={3} max={12} value={config.zoom as number ?? 5}
          onChange={(e) => onChange("zoom", parseInt(e.target.value))}
          className="flex-1" />
        <span className="text-xs text-muted-foreground w-6">{config.zoom as number ?? 5}</span>
      </div>
      <p className="text-xs text-muted-foreground">Powered by Windy.com</p>
    </>
  );
}
