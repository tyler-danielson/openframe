import { REDDIT_PRESETS } from "../../widgets/PhotoAlbumWidget";
import type { WidgetConfigProps } from "./types";

export function PhotoFeedConfig({
  config,
  onChange,
  openAlbumPicker,
}: WidgetConfigProps) {
  return (
    <>
      {/* Source Selection */}
      <label className="block">
        <span className="text-sm">Source</span>
        <select
          value={config.source as string ?? "reddit"}
          onChange={(e) => onChange("source", e.target.value)}
          className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="album">Local Album</option>
          <option value="reddit">Reddit</option>
          <option value="custom-urls">Custom URLs</option>
        </select>
      </label>

      {/* Source-specific fields */}
      {config.source === "album" && (
        <label className="block">
          <span className="text-sm">Album</span>
          <div className="flex gap-2 mt-1">
            <input
              type="text"
              value={config.albumId as string ?? ""}
              readOnly
              className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm"
              placeholder="Select album..."
            />
            <button
              onClick={() => openAlbumPicker?.()}
              className="px-3 py-2 rounded border border-border bg-muted hover:bg-muted/80 text-sm"
            >
              Browse
            </button>
          </div>
        </label>
      )}

      {(config.source === "reddit" || config.source === undefined) && (
        <label className="block">
          <span className="text-sm">Subreddit</span>
          <select
            value={config.subreddit as string ?? "EarthPorn"}
            onChange={(e) => onChange("subreddit", e.target.value)}
            className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
          >
            {REDDIT_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                r/{preset.id} - {preset.description}
              </option>
            ))}
          </select>
        </label>
      )}

      {config.source === "custom-urls" && (
        <label className="block">
          <span className="text-sm">Image URLs (one per line)</span>
          <textarea
            value={((config.customUrls as string[]) ?? []).join("\n")}
            onChange={(e) => onChange("customUrls", e.target.value.split("\n").filter((u) => u.trim()))}
            className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm resize-none"
            rows={4}
            placeholder={"https://example.com/image1.jpg\nhttps://example.com/image2.jpg"}
          />
        </label>
      )}

      {/* Layout */}
      <label className="block">
        <span className="text-sm">Layout</span>
        <select
          value={config.layout as string ?? "grid"}
          onChange={(e) => onChange("layout", e.target.value)}
          className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="grid">Grid</option>
          <option value="single">Single (Rotating)</option>
        </select>
      </label>

      {/* Number of images - grid only */}
      {(config.layout as string ?? "grid") === "grid" && (
        <label className="block">
          <span className="text-sm">Number of Images</span>
          <input
            type="number"
            min={2}
            max={20}
            value={config.numberOfImages as number ?? 6}
            onChange={(e) => onChange("numberOfImages", parseInt(e.target.value) || 6)}
            className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
      )}

      {/* Refresh Interval */}
      <label className="block">
        <span className="text-sm">Refresh Interval (seconds)</span>
        <input
          type="number"
          min={10}
          max={3600}
          value={config.refreshInterval as number ?? 300}
          onChange={(e) => onChange("refreshInterval", parseInt(e.target.value) || 300)}
          className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
        />
      </label>

      {/* Orientation filter */}
      <label className="block">
        <span className="text-sm">Orientation</span>
        <select
          value={config.orientation as string ?? "all"}
          onChange={(e) => onChange("orientation", e.target.value)}
          className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="all">All Photos</option>
          <option value="landscape">Landscape Only</option>
          <option value="portrait">Portrait Only</option>
        </select>
      </label>

      {/* Gap - grid only */}
      {(config.layout as string ?? "grid") === "grid" && (
        <label className="block">
          <span className="text-sm">Gap (px)</span>
          <input
            type="number"
            min={0}
            max={20}
            value={config.gap as number ?? 4}
            onChange={(e) => onChange("gap", parseInt(e.target.value) || 0)}
            className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
      )}

      {/* Toggles */}
      <label className="flex items-center justify-between">
        <span className="text-sm">Shuffle Photos</span>
        <input
          type="checkbox"
          checked={config.shuffle as boolean ?? true}
          onChange={(e) => onChange("shuffle", e.target.checked)}
          className="rounded"
        />
      </label>
      <label className="flex items-center justify-between">
        <span className="text-sm">Show Titles</span>
        <input
          type="checkbox"
          checked={config.showTitles as boolean ?? false}
          onChange={(e) => onChange("showTitles", e.target.checked)}
          className="rounded"
        />
      </label>
      <label className="flex items-center justify-between">
        <span className="text-sm">Rounded Corners</span>
        <input
          type="checkbox"
          checked={config.roundedCorners as boolean ?? true}
          onChange={(e) => onChange("roundedCorners", e.target.checked)}
          className="rounded"
        />
      </label>
    </>
  );
}
