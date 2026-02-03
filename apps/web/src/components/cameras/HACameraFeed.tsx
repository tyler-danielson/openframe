import { useState, useRef, useEffect } from "react";
import {
  Maximize2,
  Minimize2,
  RefreshCw,
  Video,
  VideoOff,
  AlertCircle,
  Home,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { api, type HACamera } from "../../services/api";
import { useAuthStore } from "../../stores/auth";

interface HACameraFeedProps {
  camera: HACamera;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export function HACameraFeed({
  camera,
  isFullscreen,
  onToggleFullscreen,
}: HACameraFeedProps) {
  // Use per-camera settings from the camera object
  const aspectRatio = camera.aspectRatio || "16:9";
  const refreshInterval = (camera.refreshInterval || 5) * 1000; // Convert to ms
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [useStream, setUseStream] = useState(true);
  const imgRef = useRef<HTMLImageElement>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const { accessToken } = useAuthStore();

  // Get the appropriate URL based on mode
  const getImageUrl = () => {
    if (useStream) {
      return `${api.getHACameraStreamUrl(camera.entityId)}?token=${accessToken}`;
    }
    return `${api.getHACameraSnapshotUrl(camera.entityId)}?token=${accessToken}&t=${Date.now()}`;
  };

  // Refresh snapshot periodically when not streaming
  useEffect(() => {
    if (useStream) return;

    const refresh = () => {
      if (imgRef.current) {
        const newUrl = `${api.getHACameraSnapshotUrl(camera.entityId)}?token=${accessToken}&t=${Date.now()}`;
        imgRef.current.src = newUrl;
      }
    };

    refreshIntervalRef.current = setInterval(refresh, refreshInterval);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [camera.entityId, useStream, accessToken, refreshInterval]);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setHasError(false);
    if (imgRef.current) {
      imgRef.current.src = getImageUrl();
    }
  };

  const toggleStreamMode = () => {
    setUseStream(!useStream);
    setIsLoading(true);
    setHasError(false);
  };

  const aspectRatioClass = {
    "16:9": "aspect-video",
    "4:3": "aspect-[4/3]",
    "1:1": "aspect-square",
  }[aspectRatio];

  const imageUrl = getImageUrl();

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border border-border bg-black",
        isFullscreen && "fixed inset-0 z-50 rounded-none border-0"
      )}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Video container */}
      <div className={cn(aspectRatioClass, isFullscreen && "h-full w-full aspect-auto")}>
        <img
          ref={imgRef}
          src={imageUrl}
          alt={camera.name}
          className={cn(
            "h-full w-full object-contain",
            isLoading && "opacity-0"
          )}
          onLoad={handleLoad}
          onError={handleError}
        />

        {/* Loading overlay */}
        {isLoading && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error overlay */}
        {hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
            <AlertCircle className="h-10 w-10 text-destructive mb-2" />
            <p className="text-sm text-muted-foreground">Failed to load feed</p>
            <button
              onClick={handleRefresh}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        )}
      </div>

      {/* Controls overlay */}
      <div
        className={cn(
          "absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/60 via-transparent to-black/40 transition-opacity duration-200",
          showControls || isFullscreen ? "opacity-100" : "opacity-0"
        )}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            <Home className="h-4 w-4 text-blue-400" />
            <div
              className={cn(
                "h-2 w-2 rounded-full",
                hasError ? "bg-red-500" : "bg-green-500 animate-pulse"
              )}
            />
            <span className="text-sm font-medium text-white drop-shadow">
              {camera.name}
            </span>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            {/* Stream mode toggle */}
            <button
              onClick={toggleStreamMode}
              className={cn(
                "flex items-center gap-1 rounded px-2 py-1 text-xs text-white",
                useStream ? "bg-green-500/50" : "bg-white/20"
              )}
              title={useStream ? "Streaming live" : "Snapshot mode"}
            >
              <Video className="h-3 w-3" />
              {useStream ? "LIVE" : "SNAP"}
            </button>

            {/* Refresh button (snapshot mode only) */}
            {!useStream && (
              <button
                onClick={handleRefresh}
                className="rounded p-1.5 text-white/80 hover:bg-white/20 hover:text-white"
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Fullscreen toggle */}
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className="rounded p-1.5 text-white/80 hover:bg-white/20 hover:text-white"
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
