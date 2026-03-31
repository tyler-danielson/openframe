import { HAMapConfig } from "./HAMapConfig";
import type { WidgetConfigProps } from "./types";

type HADisplayMode = "auto" | "entity" | "gauge" | "graph" | "camera" | "map";

const DISPLAY_MODES: { value: HADisplayMode; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "entity", label: "Entity" },
  { value: "gauge", label: "Gauge" },
  { value: "graph", label: "Graph" },
  { value: "camera", label: "Camera" },
  { value: "map", label: "Map" },
];

const DOMAIN_DISPLAY_DEFAULTS: Record<string, HADisplayMode> = {
  sensor: "graph",
  camera: "camera",
  climate: "gauge",
  input_number: "gauge",
  fan: "gauge",
  person: "map",
  device_tracker: "map",
};

function resolveAutoMode(entityId: string): HADisplayMode {
  const domain = entityId.split(".")[0] ?? "";
  return DOMAIN_DISPLAY_DEFAULTS[domain] ?? "entity";
}

export function HAWidgetConfig({
  config,
  onChange,
  widgetId,
  openEntityBrowser,
  openAlbumPicker,
}: WidgetConfigProps) {
  const entityId = (config.entityId as string) ?? "";
  const displayMode = (config.displayMode as HADisplayMode) ?? "auto";
  const effectiveMode = displayMode === "auto" ? resolveAutoMode(entityId) : displayMode;

  return (
    <>
      {/* Entity picker */}
      <label className="block">
        <span className="text-sm">Entity ID</span>
        <div className="flex gap-2 mt-1">
          <input
            type="text"
            value={entityId}
            onChange={(e) => onChange("entityId", e.target.value)}
            className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm"
            placeholder="sensor.temperature"
          />
          <button
            onClick={() => openEntityBrowser?.("entityId")}
            className="px-3 py-2 rounded border border-border bg-muted hover:bg-muted/80 text-sm"
          >
            Browse
          </button>
        </div>
      </label>

      {/* Display mode selector */}
      <div>
        <span className="text-sm block mb-1.5">Display Mode</span>
        <div className="flex rounded-lg border border-border overflow-hidden">
          {DISPLAY_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => onChange("displayMode", mode.value)}
              className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                displayMode === mode.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted text-foreground"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
        {displayMode === "auto" && entityId && (
          <p className="text-xs text-muted-foreground mt-1">
            Resolved to: <span className="text-primary font-medium">{effectiveMode}</span>
          </p>
        )}
      </div>

      {/* Mode-specific fields */}
      {effectiveMode === "entity" && (
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
            <span className="text-sm">Show Name</span>
            <input
              type="checkbox"
              checked={config.showName as boolean ?? true}
              onChange={(e) => onChange("showName", e.target.checked)}
              className="rounded"
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm">Show State</span>
            <input
              type="checkbox"
              checked={config.showState as boolean ?? true}
              onChange={(e) => onChange("showState", e.target.checked)}
              className="rounded"
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm">Show Last Changed</span>
            <input
              type="checkbox"
              checked={config.showLastChanged as boolean ?? false}
              onChange={(e) => onChange("showLastChanged", e.target.checked)}
              className="rounded"
            />
          </label>
        </>
      )}

      {effectiveMode === "gauge" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-sm">Min</span>
              <input
                type="number"
                value={config.min as number ?? 0}
                onChange={(e) => onChange("min", parseFloat(e.target.value) || 0)}
                className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm">Max</span>
              <input
                type="number"
                value={config.max as number ?? 100}
                onChange={(e) => onChange("max", parseFloat(e.target.value) || 100)}
                className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-sm">Unit</span>
            <input
              type="text"
              value={config.unit as string ?? ""}
              onChange={(e) => onChange("unit", e.target.value)}
              className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
              placeholder="°F"
            />
          </label>
        </>
      )}

      {effectiveMode === "graph" && (
        <label className="block">
          <span className="text-sm">Hours to Show</span>
          <input
            type="number"
            min={1}
            max={168}
            value={config.hours as number ?? 24}
            onChange={(e) => onChange("hours", parseInt(e.target.value) || 24)}
            className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
      )}

      {effectiveMode === "camera" && (
        <label className="block">
          <span className="text-sm">Refresh Interval (seconds)</span>
          <input
            type="number"
            min={1}
            max={300}
            value={config.refreshInterval as number ?? 10}
            onChange={(e) => onChange("refreshInterval", parseInt(e.target.value) || 10)}
            className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
      )}

      {effectiveMode === "map" && (
        <HAMapConfig
          config={config}
          onChange={onChange}
          widgetId={widgetId}
          openEntityBrowser={openEntityBrowser}
          openAlbumPicker={openAlbumPicker}
        />
      )}
    </>
  );
}
