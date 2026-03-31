import { cn } from "../../../lib/utils";
import { REDDIT_PRESETS } from "../../widgets/PhotoAlbumWidget";
import type { WidgetConfigProps } from "./types";

export function PhotoAlbumConfig({
  config,
  onChange,
  openEntityBrowser,
  openAlbumPicker,
}: WidgetConfigProps) {
  const photoSource = config.source as string ?? "album";
  const activeFitStyle = config.fitStyle as string ?? "";
  const activeCropStyle = config.cropStyle as string ?? "crop";
  // Determine effective display style for radio buttons
  const displayStyle = activeFitStyle || activeCropStyle;

  return (
    <>
      {/* Source Selection - DAKboard style */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-muted-foreground w-24 shrink-0">Source</span>
        <select
          value={photoSource}
          onChange={(e) => onChange("source", e.target.value)}
          className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="album">Local Album</option>
          <option value="reddit">Nature / Reddit</option>
          <option value="ha-camera">HA Camera</option>
          <option value="custom-url">Custom URL</option>
        </select>
      </div>

      {/* Source-specific fields */}
      {photoSource === "album" && (
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-muted-foreground w-24 shrink-0">Album</span>
          <div className="flex gap-2 flex-1">
            <input type="text" value={config.albumId as string ?? ""} readOnly
              className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm"
              placeholder="Select album..." />
            <button onClick={() => openAlbumPicker?.()}
              className="px-3 py-2 rounded border border-border bg-muted hover:bg-muted/80 text-sm">
              Browse
            </button>
          </div>
        </div>
      )}

      {photoSource === "ha-camera" && (
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-muted-foreground w-24 shrink-0">Entity</span>
          <div className="flex gap-2 flex-1">
            <input type="text" value={config.entityId as string ?? ""}
              onChange={(e) => onChange("entityId", e.target.value)}
              className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm"
              placeholder="camera.front_door" />
            <button onClick={() => openEntityBrowser?.("entityId")}
              className="px-3 py-2 rounded border border-border bg-muted hover:bg-muted/80 text-sm">
              Browse
            </button>
          </div>
        </div>
      )}

      {photoSource === "reddit" && (
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-muted-foreground w-24 shrink-0">Feed</span>
          <select value={config.subreddit as string ?? "EarthPorn"}
            onChange={(e) => onChange("subreddit", e.target.value)}
            className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm">
            {REDDIT_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>r/{p.id} - {p.description}</option>
            ))}
          </select>
        </div>
      )}

      {photoSource === "custom-url" && (
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-muted-foreground w-24 shrink-0">URL</span>
          <input type="url" value={config.customUrl as string ?? ""}
            onChange={(e) => onChange("customUrl", e.target.value)}
            className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm"
            placeholder="https://example.com/image.jpg" />
        </div>
      )}

      {/* Change Photo interval */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-muted-foreground w-24 shrink-0">Change Photo</span>
        <select value={config.interval as number ?? 30}
          onChange={(e) => onChange("interval", parseInt(e.target.value))}
          className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm">
          <option value={5}>Every 5 seconds</option>
          <option value={10}>Every 10 seconds</option>
          <option value={30}>Every 30 seconds</option>
          <option value={60}>Every 1 minute</option>
          <option value={300}>Every 5 minutes</option>
          <option value={600}>Every 10 minutes</option>
          <option value={1800}>Every 30 minutes</option>
        </select>
      </div>

      {/* Brightness slider */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-muted-foreground w-24 shrink-0">Brightness</span>
        <div className="flex items-center gap-2 flex-1">
          <span className="text-muted-foreground text-xs">Dark</span>
          <input type="range" min={20} max={100} value={config.brightness as number ?? 100}
            onChange={(e) => onChange("brightness", parseInt(e.target.value))}
            className="flex-1" />
          <span className="text-muted-foreground text-xs">Full</span>
          <span className="text-xs text-muted-foreground w-8 text-right">{config.brightness as number ?? 100}%</span>
        </div>
      </div>

      {/* Style - visual radio buttons */}
      <div className="flex items-start gap-4">
        <span className="text-sm font-medium text-muted-foreground w-24 shrink-0 pt-1">Style</span>
        <div className="flex gap-3">
          {[
            { id: "fit", label: "Fit" },
            { id: "fit-blur", label: "Fit & Blur" },
            { id: "crop", label: "Crop" },
            { id: "circle", label: "Circle" },
          ].map((s) => (
            <button key={s.id} onClick={() => {
              if (s.id === "fit-blur" || s.id === "circle") {
                onChange("fitStyle", s.id);
              } else {
                onChange("fitStyle", "");
                onChange("cropStyle", s.id);
              }
            }}
            className="flex flex-col items-center gap-1.5">
              <div className={cn(
                "w-14 h-10 rounded border-2 flex items-center justify-center bg-muted/30 transition-colors",
                displayStyle === s.id ? "border-primary bg-primary/10" : "border-border"
              )}>
                {s.id === "fit" && <div className="w-6 h-8 border border-muted-foreground/40 rounded-sm" />}
                {s.id === "fit-blur" && <div className="relative w-full h-full rounded overflow-hidden">
                  <div className="absolute inset-0 bg-muted-foreground/20 blur-sm" />
                  <div className="relative w-6 h-8 border border-muted-foreground/40 rounded-sm mx-auto mt-0.5" />
                </div>}
                {s.id === "crop" && <div className="w-full h-full bg-muted-foreground/20 rounded" />}
                {s.id === "circle" && <div className="w-8 h-8 rounded-full bg-muted-foreground/20" />}
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[10px]">{s.label}</span>
                <div className={cn(
                  "w-3 h-3 rounded-full border-2 mt-0.5",
                  displayStyle === s.id ? "border-primary bg-primary" : "border-muted-foreground/40"
                )} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Orientation filter */}
      {photoSource !== "ha-camera" && photoSource !== "custom-url" && (
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-muted-foreground w-24 shrink-0">Orientation</span>
          <select value={config.orientation as string ?? "all"}
            onChange={(e) => onChange("orientation", e.target.value)}
            className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm">
            <option value="all">All Photos</option>
            <option value="landscape">Landscape Only</option>
            <option value="portrait">Portrait Only</option>
          </select>
        </div>
      )}

      {/* Toggle rows - DAKboard style */}
      {photoSource !== "ha-camera" && (
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-muted-foreground w-24 shrink-0">Transitions</span>
          <div className="flex items-center gap-3 flex-1">
            <input type="checkbox" checked={(config.transition as string ?? "fade") !== "none"}
              onChange={(e) => onChange("transition", e.target.checked ? "fade" : "none")}
              className="rounded" />
            <span className="text-sm text-muted-foreground">Gradually fade photos in and out</span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-muted-foreground w-24 shrink-0">Vignette</span>
        <div className="flex items-center gap-3 flex-1">
          <input type="checkbox" checked={config.vignette as boolean ?? false}
            onChange={(e) => onChange("vignette", e.target.checked)}
            className="rounded" />
          <span className="text-sm text-muted-foreground">Darken photos around the edges</span>
        </div>
      </div>

      {photoSource !== "ha-camera" && photoSource !== "custom-url" && (
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-muted-foreground w-24 shrink-0">Shuffle</span>
          <div className="flex items-center gap-3 flex-1">
            <input type="checkbox" checked={config.shuffle as boolean ?? true}
              onChange={(e) => onChange("shuffle", e.target.checked)}
              className="rounded" />
            <span className="text-sm text-muted-foreground">Randomize photo order</span>
          </div>
        </div>
      )}
    </>
  );
}
