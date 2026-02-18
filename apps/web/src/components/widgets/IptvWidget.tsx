import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Hls from "hls.js";
import { Tv, Volume2, VolumeX, Menu, AlertCircle, Loader2 } from "lucide-react";
import { api } from "../../services/api";
import type { WidgetStyle } from "../../stores/screensaver";
import { useBlockControls } from "../../hooks/useBlockControls";
import { useWidgetStateReporter } from "../../hooks/useWidgetStateReporter";
import { IptvTileOverlay } from "../iptv/IptvTileOverlay";

type FullscreenMode = "normal" | "over" | "under";

interface IptvWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
  widgetId?: string;
}

export function IptvWidget({ config, isBuilder, widgetId }: IptvWidgetProps) {
  const channelId = config.channelId as string ?? "";
  const showControls = config.showControls as boolean ?? true;
  const autoPlay = config.autoPlay as boolean ?? true;
  const defaultMuted = config.muted as boolean ?? true;

  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(defaultMuted);
  const [showOverlay, setShowOverlay] = useState(false);
  const [activeChannelId, setActiveChannelId] = useState(channelId);
  const [channelName, setChannelName] = useState("");
  const [fullscreenMode, setFullscreenMode] = useState<FullscreenMode>("normal");

  // Sync activeChannelId when config changes
  useEffect(() => {
    if (channelId) {
      setActiveChannelId(channelId);
    }
  }, [channelId]);

  // Fetch stream URL for active channel
  const { data: streamData } = useQuery({
    queryKey: ["widget-iptv-stream", activeChannelId],
    queryFn: () => api.getIptvChannelStream(activeChannelId),
    enabled: !isBuilder && !!activeChannelId,
    retry: 2,
  });

  // Fetch favorites for block controls (channel up/down)
  const { data: favorites = [] } = useQuery({
    queryKey: ["widget-iptv-favorites"],
    queryFn: () => api.getIptvFavorites(),
    enabled: !isBuilder,
    staleTime: 60_000,
  });

  // Fetch recent history for block controls
  const { data: history = [] } = useQuery({
    queryKey: ["widget-iptv-history"],
    queryFn: () => api.getIptvHistory(10),
    enabled: !isBuilder,
    staleTime: 60_000,
  });

  // Toggle favorite mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ channelId: chId, isFavorite }: { channelId: string; isFavorite: boolean }) => {
      if (isFavorite) {
        await api.removeIptvFavorite(chId);
      } else {
        await api.addIptvFavorite(chId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["widget-iptv-favorites"] });
      queryClient.invalidateQueries({ queryKey: ["iptv-favorites"] });
      queryClient.invalidateQueries({ queryKey: ["overlay-guide"] });
    },
  });

  // Update channel name when stream data loads
  useEffect(() => {
    if (streamData?.channelName) {
      setChannelName(streamData.channelName);
    }
  }, [streamData]);

  // Initialize HLS.js - self-contained (no shared store)
  useEffect(() => {
    if (isBuilder || !streamData?.streamUrl || !videoRef.current) return;

    const video = videoRef.current;
    setIsLoading(true);
    setError(null);

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
      });

      hlsRef.current = hls;
      hls.loadSource(streamData.streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        if (autoPlay) {
          video.play().catch(() => {});
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setError("Channel unavailable");
              setIsLoading(false);
              hls.destroy();
              break;
          }
        }
      });

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = streamData.streamUrl;
      video.addEventListener("loadedmetadata", () => {
        setIsLoading(false);
        if (autoPlay) {
          video.play().catch(() => {});
        }
      });
    }
  }, [streamData?.streamUrl, isBuilder, autoPlay]);

  // Update muted state
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const handleChannelSwitch = useCallback((newChannelId: string) => {
    setActiveChannelId(newChannelId);
    setShowOverlay(false);
    // Record the watch in history
    api.recordIptvWatch(newChannelId).catch(() => {});
  }, []);

  const handleToggleFavorite = useCallback(
    (chId: string, isFavorite: boolean) => {
      toggleFavoriteMutation.mutate({ channelId: chId, isFavorite });
    },
    [toggleFavoriteMutation]
  );

  // TV block navigation controls
  const blockControls = useMemo(() => {
    if (isBuilder || !widgetId) return null;
    const favs = favorites || [];
    const allChannels = [...favs, ...(history || []).filter((h) => !favs.some((f) => f.id === h.id))];

    const currentIdx = allChannels.findIndex((ch) => ch.id === activeChannelId);

    return {
      actions: [
        {
          key: "up",
          label: "Channel Up",
          action: () => {
            if (allChannels.length === 0) return;
            const nextIdx = currentIdx <= 0 ? allChannels.length - 1 : currentIdx - 1;
            const ch = allChannels[nextIdx];
            if (ch) handleChannelSwitch(ch.id);
          },
        },
        {
          key: "down",
          label: "Channel Down",
          action: () => {
            if (allChannels.length === 0) return;
            const nextIdx = (currentIdx + 1) % allChannels.length;
            const ch = allChannels[nextIdx];
            if (ch) handleChannelSwitch(ch.id);
          },
        },
        {
          key: "enter",
          label: showOverlay ? "Close Menu" : "Open Menu",
          action: () => setShowOverlay((v) => !v),
        },
      ],
      remoteActions: [
        {
          key: "channel-change",
          label: "Change Channel",
          execute: (data?: Record<string, unknown>) => {
            const chId = data?.channelId as string;
            if (chId) handleChannelSwitch(chId);
          },
        },
        {
          key: "mute-toggle",
          label: "Toggle Mute",
          execute: () => setIsMuted((m) => !m),
        },
        {
          key: "fullscreen-mode",
          label: "Fullscreen Mode",
          execute: (data?: Record<string, unknown>) => {
            const mode = data?.mode as FullscreenMode;
            if (mode && ["normal", "over", "under"].includes(mode)) {
              setFullscreenMode(mode);
            }
          },
        },
      ],
    };
  }, [isBuilder, widgetId, favorites, history, activeChannelId, showOverlay, handleChannelSwitch, fullscreenMode]);
  useBlockControls(widgetId, blockControls);

  // Report state for companion app
  useWidgetStateReporter(
    isBuilder ? undefined : widgetId,
    "iptv",
    useMemo(() => ({ activeChannelId, channelName, isMuted, fullscreenMode }), [activeChannelId, channelName, isMuted, fullscreenMode])
  );

  // Manage data-iptv-backdrop attribute for "under" mode
  useEffect(() => {
    if (fullscreenMode === "under") {
      document.documentElement.dataset.iptvBackdrop = "true";
    } else {
      delete document.documentElement.dataset.iptvBackdrop;
    }
    return () => {
      delete document.documentElement.dataset.iptvBackdrop;
    };
  }, [fullscreenMode]);

  // Builder preview - static placeholder
  if (isBuilder) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-black/60 text-white/70 gap-2">
        <Tv className="h-8 w-8" />
        <span className="text-sm font-medium">Live TV</span>
        {channelId ? (
          <span className="text-xs text-white/40">Channel configured</span>
        ) : (
          <span className="text-xs text-white/40">No channel set</span>
        )}
      </div>
    );
  }

  // No channel configured
  if (!activeChannelId) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-black text-white/50 gap-2 relative">
        <Tv className="h-8 w-8" />
        <span className="text-sm">No channel configured</span>
        <button
          onClick={() => setShowOverlay(true)}
          className="absolute top-2 left-2 z-10 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors"
        >
          <Menu className="h-4 w-4" />
        </button>
        <IptvTileOverlay
          isOpen={showOverlay}
          onClose={() => setShowOverlay(false)}
          activeChannelId={activeChannelId}
          channelName={channelName}
          onChannelSelect={handleChannelSwitch}
          onToggleFavorite={handleToggleFavorite}
          isMuted={isMuted}
          onToggleMute={() => setIsMuted((m) => !m)}
        />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-black text-white/50 gap-2 relative">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <span className="text-sm">{error}</span>
        <button
          onClick={() => setShowOverlay(true)}
          className="absolute top-2 left-2 z-10 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors"
        >
          <Menu className="h-4 w-4" />
        </button>
        <IptvTileOverlay
          isOpen={showOverlay}
          onClose={() => setShowOverlay(false)}
          activeChannelId={activeChannelId}
          channelName={channelName}
          onChannelSelect={handleChannelSwitch}
          onToggleFavorite={handleToggleFavorite}
          isMuted={isMuted}
          onToggleMute={() => setIsMuted((m) => !m)}
        />
      </div>
    );
  }

  // Video + controls content shared between normal and fullscreen modes
  const videoContent = (
    <>
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        playsInline
        muted={isMuted}
      />

      {/* Loading spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <Loader2 className="h-8 w-8 text-white animate-spin" />
        </div>
      )}

      {/* Controls overlay */}
      {showControls && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 flex items-center justify-between">
          <span className="text-white text-xs truncate max-w-[60%]">{channelName}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="text-white/80 hover:text-white p-1"
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Menu button to open overlay */}
      <button
        onClick={() => setShowOverlay(true)}
        className="absolute top-2 left-2 z-10 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Tile overlay */}
      <IptvTileOverlay
        isOpen={showOverlay}
        onClose={() => setShowOverlay(false)}
        activeChannelId={activeChannelId}
        channelName={channelName}
        onChannelSelect={handleChannelSwitch}
        onToggleFavorite={handleToggleFavorite}
        isMuted={isMuted}
        onToggleMute={() => setIsMuted((m) => !m)}
      />
    </>
  );

  // Fullscreen portal (over or under modes)
  if (fullscreenMode !== "normal") {
    const zIndex = fullscreenMode === "over" ? 9000 : 1;
    return (
      <>
        {/* Placeholder in the widget tile */}
        <div className={`relative h-full w-full bg-black overflow-hidden flex items-center justify-center ${fullscreenMode === "under" ? "widget-tile-iptv-active" : ""}`}>
          <div className="text-white/40 text-sm flex flex-col items-center gap-2">
            <Tv className="h-6 w-6" />
            <span>Playing fullscreen</span>
          </div>
        </div>
        {/* Portal to body for fullscreen video */}
        {createPortal(
          <div
            style={{ position: "fixed", inset: 0, zIndex }}
            className="bg-black"
          >
            <div className="relative h-full w-full">
              {videoContent}
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }

  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      {videoContent}
    </div>
  );
}
