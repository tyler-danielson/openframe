import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Hls from "hls.js";
import { Tv, Volume2, VolumeX, ChevronDown, Star, Clock, AlertCircle, Loader2 } from "lucide-react";
import { api } from "../../services/api";
import type { WidgetStyle } from "../../stores/screensaver";
import { useBlockControls } from "../../hooks/useBlockControls";

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

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(defaultMuted);
  const [showPicker, setShowPicker] = useState(false);
  const [activeChannelId, setActiveChannelId] = useState(channelId);
  const [channelName, setChannelName] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null!)

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

  // Fetch favorites for channel picker
  const { data: favorites = [] } = useQuery({
    queryKey: ["widget-iptv-favorites"],
    queryFn: () => api.getIptvFavorites(),
    enabled: !isBuilder && showPicker,
    staleTime: 60_000,
  });

  // Fetch recent history for channel picker
  const { data: history = [] } = useQuery({
    queryKey: ["widget-iptv-history"],
    queryFn: () => api.getIptvHistory(10),
    enabled: !isBuilder && showPicker,
    staleTime: 60_000,
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

  // Close picker on outside click
  useEffect(() => {
    if (!showPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPicker]);

  const handleChannelSwitch = useCallback((newChannelId: string) => {
    setActiveChannelId(newChannelId);
    setShowPicker(false);
    // Record the watch in history
    api.recordIptvWatch(newChannelId).catch(() => {});
  }, []);

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
          label: isMuted ? "Unmute" : "Mute",
          action: () => setIsMuted((m) => !m),
        },
      ],
    };
  }, [isBuilder, widgetId, favorites, history, activeChannelId, isMuted, handleChannelSwitch]);
  useBlockControls(widgetId, blockControls);

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
        {/* Still allow channel picker in error/empty state */}
        <ChannelPickerButton
          showPicker={showPicker}
          setShowPicker={setShowPicker}
          pickerRef={pickerRef}
          favorites={favorites}
          history={history}
          onSelect={handleChannelSwitch}
          activeChannelId={activeChannelId}
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
        <ChannelPickerButton
          showPicker={showPicker}
          setShowPicker={setShowPicker}
          pickerRef={pickerRef}
          favorites={favorites}
          history={history}
          onSelect={handleChannelSwitch}
          activeChannelId={activeChannelId}
        />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
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

      {/* Channel picker */}
      <ChannelPickerButton
        showPicker={showPicker}
        setShowPicker={setShowPicker}
        pickerRef={pickerRef}
        favorites={favorites}
        history={history}
        onSelect={handleChannelSwitch}
        activeChannelId={activeChannelId}
      />
    </div>
  );
}

// Channel picker overlay button + dropdown
function ChannelPickerButton({
  showPicker,
  setShowPicker,
  pickerRef,
  favorites,
  history,
  onSelect,
  activeChannelId,
}: {
  showPicker: boolean;
  setShowPicker: (v: boolean) => void;
  pickerRef: React.RefObject<HTMLDivElement>;
  favorites: { id: string; name: string; logoUrl: string | null }[];
  history: { id: string; name: string; logoUrl: string | null }[];
  onSelect: (channelId: string) => void;
  activeChannelId: string;
}) {
  // Filter history to exclude items already in favorites
  const favoriteIds = new Set(favorites.map((f) => f.id));
  const filteredHistory = history.filter((h) => !favoriteIds.has(h.id));

  return (
    <>
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="absolute top-2 right-2 z-10 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors"
      >
        <ChevronDown className="h-4 w-4" />
      </button>

      {showPicker && (
        <div
          ref={pickerRef}
          className="absolute top-10 right-2 z-20 w-56 max-h-64 overflow-y-auto bg-black/95 border border-white/20 rounded-lg shadow-xl"
        >
          {favorites.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] font-semibold text-white/40 uppercase tracking-wider flex items-center gap-1">
                <Star className="h-3 w-3" /> Favorites
              </div>
              {favorites.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => onSelect(ch.id)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-colors flex items-center gap-2 ${
                    ch.id === activeChannelId ? "text-blue-400" : "text-white/80"
                  }`}
                >
                  {ch.logoUrl ? (
                    <img src={ch.logoUrl} alt="" className="h-5 w-5 rounded object-contain bg-white/10" />
                  ) : (
                    <Tv className="h-4 w-4 text-white/40" />
                  )}
                  <span className="truncate">{ch.name}</span>
                </button>
              ))}
            </>
          )}

          {filteredHistory.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] font-semibold text-white/40 uppercase tracking-wider flex items-center gap-1">
                <Clock className="h-3 w-3" /> Recent
              </div>
              {filteredHistory.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => onSelect(ch.id)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-colors flex items-center gap-2 ${
                    ch.id === activeChannelId ? "text-blue-400" : "text-white/80"
                  }`}
                >
                  {ch.logoUrl ? (
                    <img src={ch.logoUrl} alt="" className="h-5 w-5 rounded object-contain bg-white/10" />
                  ) : (
                    <Tv className="h-4 w-4 text-white/40" />
                  )}
                  <span className="truncate">{ch.name}</span>
                </button>
              ))}
            </>
          )}

          {favorites.length === 0 && filteredHistory.length === 0 && (
            <div className="px-3 py-4 text-sm text-white/40 text-center">
              No favorites or recent channels
            </div>
          )}
        </div>
      )}
    </>
  );
}
