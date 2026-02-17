import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import type { WidgetStyle, FontSizePreset } from "../../stores/screensaver";
import { getFontSizeConfig } from "../../lib/font-size";
import { cn } from "../../lib/utils";
import { useBlockControls } from "../../hooks/useBlockControls";
import { useWidgetStateReporter } from "../../hooks/useWidgetStateReporter";

interface SpotifyWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
  widgetId?: string;
}

const FONT_SIZE_CLASSES: Record<Exclude<FontSizePreset, "custom">, { title: string; artist: string; label: string }> = {
  xs: { title: "text-[10px]", artist: "text-[8px]", label: "text-[8px]" },
  sm: { title: "text-xs", artist: "text-[10px]", label: "text-[10px]" },
  md: { title: "text-sm", artist: "text-xs", label: "text-xs" },
  lg: { title: "text-base", artist: "text-sm", label: "text-sm" },
  xl: { title: "text-lg", artist: "text-base", label: "text-base" },
};

// Scale factors for custom font sizes
const CUSTOM_SCALE = {
  title: 1,
  artist: 0.85,
  label: 0.75,
};

// Album size classes based on preset
const ALBUM_SIZE_CLASSES: Record<Exclude<FontSizePreset, "custom">, string> = {
  xs: "w-8 h-8",
  sm: "w-10 h-10",
  md: "w-14 h-14",
  lg: "w-16 h-16",
  xl: "w-20 h-20",
};

export function SpotifyWidget({ config, style, isBuilder, widgetId }: SpotifyWidgetProps) {
  const showAlbumArt = config.showAlbumArt as boolean ?? true;
  const showProgress = config.showProgress as boolean ?? true;
  const showArtist = config.showArtist as boolean ?? true;
  const headerMode = config.headerMode as string ?? "default";
  const customHeader = config.customHeader as string ?? "";

  // Determine header text based on mode
  const getHeaderText = () => {
    if (headerMode === "hidden") return null;
    if (headerMode === "custom") return customHeader || null;
    return "Now Playing";
  };
  const headerText = getHeaderText();

  const { data: playback, isLoading } = useQuery({
    queryKey: ["widget-spotify"],
    queryFn: () => api.getSpotifyPlayback(),
    staleTime: 10 * 1000,
    refetchInterval: 10 * 1000,
    enabled: !isBuilder,
  });

  // TV block navigation controls
  const isPlaying = playback?.is_playing ?? false;
  const blockControls = useMemo(() => {
    if (isBuilder || !widgetId) return null;
    return {
      actions: [
        {
          key: "enter",
          label: isPlaying ? "Pause" : "Play",
          action: () => { (isPlaying ? api.spotifyPause() : api.spotifyPlay()).catch(() => {}); },
        },
        {
          key: "play_pause",
          label: isPlaying ? "Pause" : "Play",
          action: () => { (isPlaying ? api.spotifyPause() : api.spotifyPlay()).catch(() => {}); },
        },
        {
          key: "right",
          label: "Next Track",
          action: () => { api.spotifyNext().catch(() => {}); },
        },
        {
          key: "left",
          label: "Previous Track",
          action: () => { api.spotifyPrevious().catch(() => {}); },
        },
      ],
    };
  }, [isBuilder, widgetId, isPlaying]);
  useBlockControls(widgetId, blockControls);

  // Report state for companion app
  useWidgetStateReporter(
    isBuilder ? undefined : widgetId,
    "spotify",
    useMemo(
      () => ({
        isPlaying,
        trackName: playback?.item?.name || null,
        artistName: playback?.item?.artists.map((a) => a.name).join(", ") || null,
        albumArt: playback?.item?.album.images[0]?.url || null,
      }),
      [isPlaying, playback?.item?.name, playback?.item?.artists, playback?.item?.album.images]
    )
  );

  const { preset, isCustom, customValue } = getFontSizeConfig(style);
  const presetKey = preset as Exclude<FontSizePreset, "custom">;
  const sizeClasses = isCustom ? null : FONT_SIZE_CLASSES[presetKey];
  const albumSize = isCustom ? "w-14 h-14" : ALBUM_SIZE_CLASSES[presetKey];

  // Calculate custom font sizes if using custom mode
  const getCustomFontSize = (scale: number) => {
    if (!customValue) return undefined;
    const value = parseFloat(customValue);
    const unit = customValue.replace(/[\d.]/g, "") || "px";
    return `${value * scale}${unit}`;
  };

  if (isBuilder) {
    return (
      <div
        className={cn(
          "flex h-full p-4 rounded-lg",
          "bg-black/40 backdrop-blur-sm"
        )}
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <div className="flex items-center gap-4 flex-1">
          {showAlbumArt && (
            <div className={cn(albumSize, "rounded bg-green-900/50 flex items-center justify-center flex-shrink-0")}>
              <span className="text-2xl">🎵</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            {headerText && (
              <div
                className={cn(sizeClasses?.label, "opacity-50 uppercase tracking-wide mb-1")}
                style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.label) } : undefined}
              >
                {headerText}
              </div>
            )}
            <div
              className={cn(sizeClasses?.title, "font-medium truncate")}
              style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.title) } : undefined}
            >
              Sample Track
            </div>
            {showArtist && (
              <div
                className={cn(sizeClasses?.artist, "opacity-70 truncate")}
                style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.artist) } : undefined}
              >
                Sample Artist
              </div>
            )}
            {showProgress && (
              <div className="mt-2 h-1 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: "45%" }}
                />
              </div>
            )}
          </div>
          <div className="flex gap-0.5 items-end h-4 flex-shrink-0">
            <div className="w-1 bg-green-500 rounded-full animate-pulse" style={{ height: "60%" }} />
            <div className="w-1 bg-green-500 rounded-full animate-pulse" style={{ height: "100%", animationDelay: "0.2s" }} />
            <div className="w-1 bg-green-500 rounded-full animate-pulse" style={{ height: "40%", animationDelay: "0.4s" }} />
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className="flex h-full items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <span className="text-sm opacity-50">Loading Spotify...</span>
      </div>
    );
  }

  if (!playback?.item) {
    return (
      <div
        className="flex h-full items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <span className="text-sm opacity-50">Nothing playing</span>
      </div>
    );
  }

  const progress = playback.progress_ms !== undefined
    ? (playback.progress_ms / playback.item.duration_ms) * 100
    : 0;

  return (
    <div
      className={cn(
        "flex h-full p-4 rounded-lg",
        "bg-black/40 backdrop-blur-sm"
      )}
      style={{ color: style?.textColor || "#ffffff" }}
    >
      <div className="flex items-center gap-4 flex-1">
        {showAlbumArt && playback.item.album.images[0] && (
          <img
            src={playback.item.album.images[0].url}
            alt=""
            className={cn(albumSize, "rounded shadow-lg flex-shrink-0")}
          />
        )}
        <div className="flex-1 min-w-0">
          {headerText && (
            <div
              className={cn(sizeClasses?.label, "opacity-50 uppercase tracking-wide mb-1")}
              style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.label) } : undefined}
            >
              {headerText}
            </div>
          )}
          <div
            className={cn(sizeClasses?.title, "font-medium truncate")}
            style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.title) } : undefined}
          >
            {playback.item.name}
          </div>
          {showArtist && (
            <div
              className={cn(sizeClasses?.artist, "opacity-70 truncate")}
              style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.artist) } : undefined}
            >
              {playback.item.artists.map((a) => a.name).join(", ")}
            </div>
          )}
          {showProgress && (
            <div className="mt-2 h-1 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
        {playback.is_playing && (
          <div className="flex gap-0.5 items-end h-4 flex-shrink-0">
            <div className="w-1 bg-green-500 rounded-full animate-pulse" style={{ height: "60%" }} />
            <div className="w-1 bg-green-500 rounded-full animate-pulse" style={{ height: "100%", animationDelay: "0.2s" }} />
            <div className="w-1 bg-green-500 rounded-full animate-pulse" style={{ height: "40%", animationDelay: "0.4s" }} />
          </div>
        )}
      </div>
    </div>
  );
}
