import { useState, useEffect, useRef, useCallback } from "react";
import {
  Maximize2,
  Minimize2,
  RefreshCw,
  Settings,
  Trash2,
  Video,
  VideoOff,
  AlertCircle,
  Radio,
  Tv,
  Image,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { api } from "../../services/api";
import { useAuthStore } from "../../stores/auth";
import { WebRTCPlayer } from "./WebRTCPlayer";
import type { Camera } from "@openframe/shared";

type StreamMode = "webrtc" | "hls" | "mjpeg" | "snapshot";

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
  const [streamMode, setStreamMode] = useState<StreamMode>(() => {
    // Default to WebRTC if RTSP available, otherwise MJPEG or snapshot
    if (camera.rtspUrl) return "webrtc";
    if (camera.mjpegUrl) return "mjpeg";
    return "snapshot";
  });
  const [mediamtxAvailable, setMediamtxAvailable] = useState<boolean | null>(null);
  const [streamUrls, setStreamUrls] = useState<{ webrtcUrl?: string; hlsUrl?: string } | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const { accessToken } = useAuthStore();

  const refreshInterval = camera.settings?.refreshInterval || 5;
  const aspectRatio = camera.settings?.aspectRatio || "16:9";

  // Check MediaMTX availability and start stream if RTSP available
  useEffect(() => {
    if (!camera.rtspUrl) {
      setMediamtxAvailable(false);
      return;
    }

    let cancelled = false;

    const checkAndStartStream = async () => {
      try {
        // Check MediaMTX status
        const status = await api.getMediaMTXStatus();
        if (cancelled) return;

        setMediamtxAvailable(status.available);

        if (status.available) {
          // Start the stream
          const result = await api.startCameraStream(camera.id);
          if (cancelled) return;

          setStreamUrls({
            webrtcUrl: result.webrtcUrl,
            hlsUrl: result.hlsUrl,
          });
        } else {
          // Fall back to MJPEG or snapshot
          setStreamMode(camera.mjpegUrl ? "mjpeg" : "snapshot");
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Failed to start camera stream:", error);
        if (!cancelled) {
          setMediamtxAvailable(false);
          setStreamMode(camera.mjpegUrl ? "mjpeg" : "snapshot");
          setIsLoading(false);
        }
      }
    };

    checkAndStartStream();

    return () => {
      cancelled = true;
    };
  }, [camera.id, camera.rtspUrl, camera.mjpegUrl]);

  // Get the appropriate URL for MJPEG/snapshot modes
  const getImageUrl = useCallback(() => {
    if (streamMode === "mjpeg" && camera.mjpegUrl) {
      return `${api.getCameraStreamUrl(camera.id)}?token=${accessToken}`;
    }
    if (camera.snapshotUrl || camera.rtspUrl) {
      // Backend handles derivation of snapshot URL from RTSP URL
      return `${api.getCameraSnapshotUrl(camera.id)}?token=${accessToken}&t=${Date.now()}`;
    }
    return null;
  }, [camera.id, camera.mjpegUrl, camera.snapshotUrl, camera.rtspUrl, streamMode, accessToken]);

  // Refresh snapshot periodically
  useEffect(() => {
    if (streamMode !== "snapshot" || (!camera.snapshotUrl && !camera.rtspUrl)) return;

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
  }, [camera.id, camera.snapshotUrl, camera.rtspUrl, refreshInterval, streamMode, accessToken]);

  // Safety net: clear loading state when there's no image URL and we're not in WebRTC mode
  useEffect(() => {
    const webrtcMode = streamMode === "webrtc" || streamMode === "hls";
    if (!webrtcMode && !getImageUrl()) {
      setIsLoading(false);
    }
  }, [streamMode, getImageUrl]);

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

  const cycleStreamMode = () => {
    const availableModes: StreamMode[] = [];

    // Add available modes based on camera configuration
    if (camera.rtspUrl && mediamtxAvailable) {
      availableModes.push("webrtc", "hls");
    }
    if (camera.mjpegUrl) {
      availableModes.push("mjpeg");
    }
    if (camera.snapshotUrl || camera.rtspUrl) {
      availableModes.push("snapshot");
    }

    if (availableModes.length <= 1) return;

    const currentIndex = availableModes.indexOf(streamMode);
    const nextIndex = (currentIndex + 1) % availableModes.length;
    const nextMode = availableModes[nextIndex]!;

    setStreamMode(nextMode);
    setIsLoading(true);
    setHasError(false);
  };

  const getStreamModeLabel = () => {
    switch (streamMode) {
      case "webrtc":
        return "WebRTC";
      case "hls":
        return "HLS";
      case "mjpeg":
        return "LIVE";
      case "snapshot":
        return "SNAP";
    }
  };

  const getStreamModeIcon = () => {
    switch (streamMode) {
      case "webrtc":
        return <Radio className="h-3 w-3" />;
      case "hls":
        return <Tv className="h-3 w-3" />;
      case "mjpeg":
        return <Video className="h-3 w-3" />;
      case "snapshot":
        return <Image className="h-3 w-3" />;
    }
  };

  const aspectRatioClass = {
    "16:9": "aspect-video",
    "4:3": "aspect-[4/3]",
    "1:1": "aspect-square",
  }[aspectRatio];

  const imageUrl = getImageUrl();
  const isWebRTCMode = streamMode === "webrtc" || streamMode === "hls";
  const canCycleMode = camera.rtspUrl || camera.mjpegUrl || camera.snapshotUrl;

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
        {/* WebRTC/HLS mode */}
        {isWebRTCMode && streamUrls && (
          <WebRTCPlayer
            webrtcUrl={streamUrls.webrtcUrl!}
            hlsUrl={streamUrls.hlsUrl}
            className="h-full w-full"
            onLoad={handleLoad}
            onError={() => {
              setHasError(true);
              setIsLoading(false);
            }}
          />
        )}

        {/* MJPEG/Snapshot mode */}
        {!isWebRTCMode && imageUrl && (
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
        )}

        {/* No source available */}
        {!isWebRTCMode && !imageUrl && (
          <div className="flex h-full items-center justify-center">
            <VideoOff className="h-12 w-12 text-muted-foreground" />
          </div>
        )}

        {/* Loading overlay (only for non-WebRTC modes, WebRTCPlayer handles its own) */}
        {!isWebRTCMode && isLoading && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error overlay (only for non-WebRTC modes) */}
        {!isWebRTCMode && hasError && (
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
            {canCycleMode && (
              <button
                onClick={cycleStreamMode}
                className={cn(
                  "flex items-center gap-1 rounded px-2 py-1 text-xs text-white",
                  streamMode === "webrtc" || streamMode === "hls"
                    ? "bg-blue-500/50"
                    : streamMode === "mjpeg"
                    ? "bg-green-500/50"
                    : "bg-white/20"
                )}
                title={`Current: ${getStreamModeLabel()}. Click to switch mode.`}
              >
                {getStreamModeIcon()}
                {getStreamModeLabel()}
              </button>
            )}

            {/* Refresh button (snapshot mode only) */}
            {streamMode === "snapshot" && (camera.snapshotUrl || camera.rtspUrl) && (
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
