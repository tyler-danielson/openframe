import { useState, useEffect, useRef } from "react";
import {
  Maximize2,
  Minimize2,
  RefreshCw,
  Settings,
  Trash2,
  Video,
  VideoOff,
  AlertCircle,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { api } from "../../services/api";
import { useAuthStore } from "../../stores/auth";
import type { Camera } from "@openframe/shared";

interface CameraFeedProps {
  camera: Camera;
  onEdit?: () => void;
  onDelete?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export function CameraFeed({
  camera,
  onEdit,
  onDelete,
  isFullscreen,
  onToggleFullscreen,
}: CameraFeedProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [useMjpeg, setUseMjpeg] = useState(!!camera.mjpegUrl);
  const imgRef = useRef<HTMLImageElement>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const { accessToken } = useAuthStore();

  const refreshInterval = camera.settings?.refreshInterval || 5;
  const aspectRatio = camera.settings?.aspectRatio || "16:9";

  // Get the appropriate URL based on mode
  const getImageUrl = () => {
    if (useMjpeg && camera.mjpegUrl) {
      return `${api.getCameraStreamUrl(camera.id)}?token=${accessToken}`;
    }
    if (camera.snapshotUrl) {
      return `${api.getCameraSnapshotUrl(camera.id)}?token=${accessToken}&t=${Date.now()}`;
    }
    return null;
  };

  // Refresh snapshot periodically
  useEffect(() => {
    if (useMjpeg || !camera.snapshotUrl) return;

    const refresh = () => {
      if (imgRef.current) {
        const newUrl = `${api.getCameraSnapshotUrl(camera.id)}?token=${accessToken}&t=${Date.now()}`;
        imgRef.current.src = newUrl;
      }
    };

    refreshIntervalRef.current = setInterval(refresh, refreshInterval * 1000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [camera.id, camera.snapshotUrl, refreshInterval, useMjpeg, accessToken]);

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
      imgRef.current.src = getImageUrl() || "";
    }
  };

  const toggleStreamMode = () => {
    if (camera.mjpegUrl && camera.snapshotUrl) {
      setUseMjpeg(!useMjpeg);
      setIsLoading(true);
      setHasError(false);
    }
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
        {imageUrl ? (
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
        ) : (
          <div className="flex h-full items-center justify-center">
            <VideoOff className="h-12 w-12 text-muted-foreground" />
          </div>
        )}

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

          {!isFullscreen && (
            <div className="flex items-center gap-1">
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="rounded p-1.5 text-white/80 hover:bg-white/20 hover:text-white"
                  title="Settings"
                >
                  <Settings className="h-4 w-4" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={onDelete}
                  className="rounded p-1.5 text-white/80 hover:bg-red-500/50 hover:text-white"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            {/* Stream mode toggle */}
            {camera.mjpegUrl && camera.snapshotUrl && (
              <button
                onClick={toggleStreamMode}
                className={cn(
                  "flex items-center gap-1 rounded px-2 py-1 text-xs text-white",
                  useMjpeg ? "bg-green-500/50" : "bg-white/20"
                )}
                title={useMjpeg ? "Streaming live" : "Snapshot mode"}
              >
                <Video className="h-3 w-3" />
                {useMjpeg ? "LIVE" : "SNAP"}
              </button>
            )}

            {/* Refresh button (snapshot mode only) */}
            {!useMjpeg && camera.snapshotUrl && (
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
