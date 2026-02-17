import { useState, useEffect, useRef } from "react";
import { X, Maximize2, Home, RefreshCw, Video, AlertCircle } from "lucide-react";
import { cn } from "../../lib/utils";
import { api } from "../../services/api";
import { useAuthStore } from "../../stores/auth";
import type { Camera } from "@openframe/shared";
import type { HACamera } from "../../services/api";

interface CameraViewerProps {
  camera: Camera | HACamera;
  type: "standalone" | "ha";
  onRemove: () => void;
  onFullscreen?: () => void;
}

export function CameraViewer({
  camera,
  type,
  onRemove,
  onFullscreen,
}: CameraViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [useMjpeg, setUseMjpeg] = useState(true);
  const imgRef = useRef<HTMLImageElement>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const { accessToken } = useAuthStore();

  const name = type === "standalone"
    ? (camera as Camera).name
    : (camera as HACamera).name;

  const cameraId = type === "standalone"
    ? (camera as Camera).id
    : (camera as HACamera).entityId;

  // Get the appropriate URL based on mode and type
  const getImageUrl = () => {
    if (type === "standalone") {
      const cam = camera as Camera;
      if (useMjpeg && cam.mjpegUrl) {
        return `${api.getCameraStreamUrl(cam.id)}?token=${accessToken}`;
      }
      if (cam.snapshotUrl || cam.rtspUrl) {
        // Backend handles derivation of snapshot URL from RTSP URL
        return `${api.getCameraSnapshotUrl(cam.id)}?token=${accessToken}&t=${Date.now()}`;
      }
      // Fallback to stream if no snapshot
      if (cam.mjpegUrl) {
        return `${api.getCameraStreamUrl(cam.id)}?token=${accessToken}`;
      }
      return null;
    } else {
      // HA camera
      if (useMjpeg) {
        return `${api.getHACameraStreamUrl(cameraId)}?token=${accessToken}`;
      }
      return `${api.getHACameraSnapshotUrl(cameraId)}?token=${accessToken}&t=${Date.now()}`;
    }
  };

  // Determine initial mode
  useEffect(() => {
    if (type === "standalone") {
      const cam = camera as Camera;
      setUseMjpeg(!!cam.mjpegUrl);
    } else {
      setUseMjpeg(true); // HA cameras default to stream
    }
  }, [camera, type]);

  // Refresh snapshot periodically when not streaming
  useEffect(() => {
    if (useMjpeg) {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      return;
    }

    const refreshInterval = type === "standalone"
      ? ((camera as Camera).settings?.refreshInterval || 5) * 1000
      : ((camera as HACamera).refreshInterval || 5) * 1000;

    const refresh = () => {
      if (imgRef.current && !hasError) {
        const newUrl = getImageUrl();
        if (newUrl) {
          imgRef.current.src = newUrl;
        }
      }
    };

    refreshIntervalRef.current = setInterval(refresh, refreshInterval);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [cameraId, type, useMjpeg, accessToken, hasError]);

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
      const url = getImageUrl();
      if (url) {
        imgRef.current.src = url;
      }
    }
  };

  const toggleStreamMode = () => {
    setUseMjpeg(!useMjpeg);
    setIsLoading(true);
    setHasError(false);
  };

  const imageUrl = getImageUrl();

  // Check if we can toggle between modes
  const canToggleMode = type === "standalone"
    ? !!(camera as Camera).mjpegUrl && !!((camera as Camera).snapshotUrl || (camera as Camera).rtspUrl)
    : true; // HA cameras always support both

  return (
    <div className="relative group rounded-lg overflow-hidden border border-border bg-black h-full flex items-center justify-center">
      {/* Video container - fills the space */}
      <div className="absolute inset-0 flex items-center justify-center">
        {imageUrl ? (
          <img
            ref={imgRef}
            src={imageUrl}
            alt={name}
            className={cn(
              "max-h-full max-w-full object-contain",
              isLoading && "opacity-0"
            )}
            onLoad={handleLoad}
            onError={handleError}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-muted-foreground">
            <AlertCircle className="h-8 w-8 mb-2" />
            <span className="text-sm">No stream URL</span>
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

      {/* Live indicator - always visible */}
      <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 px-2 py-1 rounded bg-black/60">
        <div className={cn(
          "h-2 w-2 rounded-full",
          hasError ? "bg-red-500" : "bg-green-500 animate-pulse"
        )} />
        <span className="text-[10px] font-semibold text-white uppercase tracking-wide">
          {hasError ? "Error" : useMjpeg ? "Live" : "Snap"}
        </span>
      </div>

      {/* Remove button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className={cn(
          "absolute top-2 right-2 z-20",
          "rounded-full p-1.5 bg-black/60 text-white/80",
          "hover:bg-red-500/80 hover:text-white",
          "opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        )}
        title="Remove from view"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Fullscreen button */}
      {onFullscreen && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFullscreen();
          }}
          className={cn(
            "absolute top-2 right-10 z-20",
            "rounded-full p-1.5 bg-black/60 text-white/80",
            "hover:bg-white/20 hover:text-white",
            "opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          )}
          title="Fullscreen"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      )}

      {/* Bottom controls */}
      <div className={cn(
        "absolute bottom-0 left-0 right-0 z-10 p-2",
        "bg-gradient-to-t from-black/70 to-transparent",
        "opacity-0 group-hover:opacity-100 transition-opacity duration-200"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {type === "ha" && <Home className="h-3.5 w-3.5 text-blue-400" />}
            <span className="text-sm font-medium text-white drop-shadow truncate">
              {name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Stream mode toggle */}
            {canToggleMode && (
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
            {!useMjpeg && (
              <button
                onClick={handleRefresh}
                className="rounded p-1.5 text-white/80 hover:bg-white/20 hover:text-white"
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
