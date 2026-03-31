import type { WidgetConfigProps } from "./types";
import { HeaderSettings } from "./shared/HeaderSettings";

export function SpotifyConfig({
  config,
  onChange,
}: WidgetConfigProps) {
  return (
    <>
      <HeaderSettings
        config={config}
        onChange={onChange}
        defaultHeaderText="Now Playing"
      />
      <label className="flex items-center justify-between">
        <span className="text-sm">Show Album Art</span>
        <input
          type="checkbox"
          checked={config.showAlbumArt as boolean ?? true}
          onChange={(e) => onChange("showAlbumArt", e.target.checked)}
          className="rounded"
        />
      </label>
      <label className="flex items-center justify-between">
        <span className="text-sm">Show Progress</span>
        <input
          type="checkbox"
          checked={config.showProgress as boolean ?? true}
          onChange={(e) => onChange("showProgress", e.target.checked)}
          className="rounded"
        />
      </label>
    </>
  );
}
