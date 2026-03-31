import type { WidgetConfigProps } from "./types";
import { HeaderSettings } from "./shared/HeaderSettings";

export function SportsConfig({
  config,
  onChange,
}: WidgetConfigProps) {
  return (
    <>
      <HeaderSettings
        config={config}
        onChange={onChange}
        defaultHeaderText="Sports Scores"
      />
      <label className="block">
        <span className="text-sm">Max Items <span className="text-xs text-muted-foreground">(0 = all)</span></span>
        <input
          type="number"
          min={0}
          max={20}
          value={config.maxItems as number ?? 5}
          onChange={(e) => { const v = parseInt(e.target.value); onChange("maxItems", Number.isNaN(v) ? 5 : v); }}
          className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
        />
      </label>
    </>
  );
}
