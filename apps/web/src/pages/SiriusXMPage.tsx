import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Radio,
  Search,
  Star,
  Clock,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Music,
  Mic,
  Newspaper,
  Trophy,
  Laugh,
  Headphones,
  Loader2,
  AlertCircle,
  LogIn,
  LogOut,
  RefreshCw,
  X,
} from "lucide-react";
import Hls from "hls.js";
import { api } from "../services/api";
import { useToast } from "../components/ui/Toaster";
import { useSiriusXMStore } from "../stores/siriusxm";
import { Button } from "../components/ui/Button";
import { cn } from "../lib/utils";
import { useAuthStore } from "../stores/auth";
import type { SiriusXMChannel } from "@openframe/shared";

// Category icons
const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Music: Music,
  "Howard Stern": Mic,
  Sports: Trophy,
  "News & Issues": Newspaper,
  Talk: Mic,
  Entertainment: Laugh,
  Comedy: Laugh,
};

type TabView = "channels" | "favorites" | "history";

export function SiriusXMPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [activeTab, setActiveTab] = useState<TabView>("channels");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const {
    currentChannel,
    selectedCategory,
    searchQuery,
    volume,
    isMuted,
    isPlaying,
    setCurrentChannel,
    setSelectedCategory,
    setSearchQuery,
    setVolume,
    setIsMuted,
    toggleMute,
    setIsPlaying,
  } = useSiriusXMStore();

  // Account status
  const { data: account, isLoading: accountLoading } = useQuery({
    queryKey: ["siriusxm-account"],
    queryFn: () => api.getSiriusXMAccount(),
  });

  // Channels
  const {
    data: channelData,
    isLoading: channelsLoading,
    refetch: refetchChannels,
  } = useQuery({
    queryKey: ["siriusxm-channels", selectedCategory, searchQuery],
    queryFn: () =>
      api.getSiriusXMChannels({
        category: selectedCategory || undefined,
        search: searchQuery || undefined,
      }),
    enabled: !!account?.connected,
  });

  // Favorites
  const { data: favorites = [] } = useQuery({
    queryKey: ["siriusxm-favorites"],
    queryFn: () => api.getSiriusXMFavorites(),
    enabled: !!account?.connected,
  });

  // History
  const { data: history = [] } = useQuery({
    queryKey: ["siriusxm-history"],
    queryFn: () => api.getSiriusXMHistory(20),
    enabled: !!account?.connected,
  });

  const favoriteIds = useMemo(
    () => new Set(favorites.map((f) => f.channelId)),
    [favorites]
  );

  // Connect account
  const connectMutation = useMutation({
    mutationFn: (data: { username: string; password: string }) =>
      api.connectSiriusXM(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["siriusxm-account"] });
      queryClient.invalidateQueries({ queryKey: ["siriusxm-channels"] });
      toast({ title: "SiriusXM connected!" });
      setLoginUsername("");
      setLoginPassword("");
      setIsLoggingIn(false);
    },
    onError: (err: any) => {
      toast({
        title: "Connection failed",
        description: err.message || "Invalid credentials",
        type: "error",
      });
      setIsLoggingIn(false);
    },
  });

  // Disconnect account
  const disconnectMutation = useMutation({
    mutationFn: () => api.disconnectSiriusXM(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["siriusxm-account"] });
      setCurrentChannel(null);
      stopPlayback();
      toast({ title: "SiriusXM disconnected" });
    },
  });

  // Toggle favorite
  const toggleFavoriteMutation = useMutation({
    mutationFn: async (channel: SiriusXMChannel) => {
      if (favoriteIds.has(channel.channelId)) {
        await api.removeSiriusXMFavorite(channel.channelId);
      } else {
        await api.addSiriusXMFavorite(channel.channelId, channel.name);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["siriusxm-favorites"] });
    },
  });

  // HLS playback
  function stopPlayback() {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setIsPlaying(false);
  }

  async function playChannel(channel: SiriusXMChannel) {
    stopPlayback();
    setCurrentChannel(channel);

    try {
      const { streamUrl } = await api.getSiriusXMStreamUrl(channel.channelId);
      const fullUrl = streamUrl;

      // Record listen
      api.recordSiriusXMListen(channel.channelId, channel.name);
      queryClient.invalidateQueries({ queryKey: ["siriusxm-history"] });

      if (audioRef.current && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          xhrSetup: (xhr: XMLHttpRequest) => {
            const token = useAuthStore.getState().accessToken;
            if (token) {
              xhr.setRequestHeader("Authorization", `Bearer ${token}`);
            }
          },
        });

        hls.loadSource(fullUrl);
        hls.attachMedia(audioRef.current);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          audioRef.current?.play();
          setIsPlaying(true);
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            console.error("HLS fatal error:", data);
            toast({
              title: "Stream error",
              description: "Failed to load stream. Try again.",
              type: "error",
            });
            stopPlayback();
          }
        });

        hlsRef.current = hls;
      } else if (
        audioRef.current?.canPlayType("application/vnd.apple.mpegurl")
      ) {
        // Safari native HLS
        audioRef.current.src = fullUrl;
        audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (err: any) {
      toast({
        title: "Failed to play",
        description: err.message,
        type: "error",
      });
      setCurrentChannel(null);
    }
  }

  // Volume control
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, []);

  // Handle login
  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!loginUsername || !loginPassword) return;
    setIsLoggingIn(true);
    connectMutation.mutate({
      username: loginUsername,
      password: loginPassword,
    });
  }

  // Loading state
  if (accountLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Setup view (not connected)
  if (!account?.connected) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10">
              <Radio className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-primary">
              SiriusXM Radio
            </h1>
            <p className="text-muted-foreground">
              Connect your SiriusXM account to stream satellite radio
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Username / Email
              </label>
              <input
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-primary/30 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="your@email.com"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Password
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-primary/30 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Password"
                autoComplete="current-password"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={
                isLoggingIn || !loginUsername || !loginPassword
              }
            >
              {isLoggingIn ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <LogIn className="w-4 h-4 mr-2" />
              )}
              Connect SiriusXM
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // Get channels for display based on active tab
  const displayChannels = (() => {
    if (activeTab === "favorites") {
      // Match favorite channel IDs to full channel data
      if (!channelData?.channels) return [];
      return channelData.channels.filter((c) =>
        favoriteIds.has(c.channelId)
      );
    }
    if (activeTab === "history") {
      // Show history as channel list (may have duplicates)
      if (!channelData?.channels) return [];
      const historyChannelIds = history.map((h) => h.channelId);
      const seen = new Set<string>();
      return historyChannelIds
        .map((id) => channelData.channels.find((c) => c.channelId === id))
        .filter((c): c is SiriusXMChannel => {
          if (!c || seen.has(c.channelId)) return false;
          seen.add(c.channelId);
          return true;
        });
    }
    return channelData?.channels || [];
  })();

  const categories = channelData?.categories || [];

  return (
    <div className="flex flex-col h-full">
      {/* Hidden audio element */}
      <audio ref={audioRef} />

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-primary/10">
        <Radio className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold text-primary">SiriusXM</h1>

        {/* Tabs */}
        <div className="flex gap-1 ml-4">
          {(
            [
              { id: "channels" as TabView, label: "Channels", icon: Radio },
              { id: "favorites" as TabView, label: "Favorites", icon: Star },
              { id: "history" as TabView, label: "Recent", icon: Clock },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors",
                activeTab === tab.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-primary/5"
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search channels..."
            className="w-full pl-8 pr-8 py-1.5 rounded-lg border border-primary/20 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Refresh */}
        <button
          onClick={() => refetchChannels()}
          className="p-2 rounded-lg hover:bg-primary/10 text-muted-foreground"
          title="Refresh channels"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Disconnect */}
        <button
          onClick={() => disconnectMutation.mutate()}
          className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500"
          title="Disconnect account"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Category sidebar (only on channels tab) */}
        {activeTab === "channels" && categories.length > 0 && (
          <div className="w-48 border-r border-primary/10 overflow-y-auto shrink-0">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors",
                !selectedCategory
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-primary/5"
              )}
            >
              <Radio className="w-4 h-4" />
              All Channels
            </button>
            {categories.map((cat) => {
              const Icon = CATEGORY_ICONS[cat] || Headphones;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors",
                    selectedCategory === cat
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-primary/5"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="truncate">{cat}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Channel grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {channelsLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : displayChannels.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <AlertCircle className="w-8 h-8" />
              <p>
                {activeTab === "favorites"
                  ? "No favorites yet. Star channels to add them here."
                  : activeTab === "history"
                    ? "No listen history yet."
                    : "No channels found."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {displayChannels.map((channel) => (
                <ChannelCard
                  key={channel.channelId}
                  channel={channel}
                  isPlaying={
                    currentChannel?.channelId === channel.channelId &&
                    isPlaying
                  }
                  isFavorite={favoriteIds.has(channel.channelId)}
                  onPlay={() => playChannel(channel)}
                  onToggleFavorite={() =>
                    toggleFavoriteMutation.mutate(channel)
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Now Playing Bar */}
      {currentChannel && (
        <div className="flex items-center gap-4 px-4 py-3 border-t border-primary/10 bg-card">
          {/* Channel logo */}
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
            {currentChannel.logoUrl ? (
              <img
                src={currentChannel.logoUrl}
                alt={currentChannel.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Radio className="w-6 h-6 text-primary" />
            )}
          </div>

          {/* Channel info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-primary">
                Ch {currentChannel.channelNumber}
              </span>
              <span className="font-semibold truncate">
                {currentChannel.name}
              </span>
            </div>
            {currentChannel.nowPlaying && (
              <p className="text-sm text-muted-foreground truncate">
                {currentChannel.nowPlaying.artist
                  ? `${currentChannel.nowPlaying.artist} - ${currentChannel.nowPlaying.title}`
                  : currentChannel.nowPlaying.title}
              </p>
            )}
          </div>

          {/* Play/Pause */}
          <button
            onClick={() => {
              if (isPlaying) {
                audioRef.current?.pause();
                setIsPlaying(false);
              } else {
                audioRef.current?.play();
                setIsPlaying(true);
              }
            }}
            className="p-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" />
            )}
          </button>

          {/* Volume */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-24 accent-primary"
            />
          </div>

          {/* Favorite toggle */}
          <button
            onClick={() => toggleFavoriteMutation.mutate(currentChannel)}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              favoriteIds.has(currentChannel.channelId)
                ? "text-yellow-500"
                : "text-muted-foreground hover:text-yellow-500"
            )}
          >
            <Star
              className="w-4 h-4"
              fill={
                favoriteIds.has(currentChannel.channelId)
                  ? "currentColor"
                  : "none"
              }
            />
          </button>
        </div>
      )}
    </div>
  );
}

// Channel Card Component
function ChannelCard({
  channel,
  isPlaying,
  isFavorite,
  onPlay,
  onToggleFavorite,
}: {
  channel: SiriusXMChannel;
  isPlaying: boolean;
  isFavorite: boolean;
  onPlay: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <div
      onClick={onPlay}
      className={cn(
        "group relative flex flex-col rounded-xl border transition-all cursor-pointer overflow-hidden",
        isPlaying
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-primary/10 hover:border-primary/30 hover:bg-primary/5"
      )}
    >
      {/* Logo area */}
      <div className="relative aspect-square bg-primary/5 flex items-center justify-center">
        {channel.logoUrl ? (
          <img
            src={channel.logoUrl}
            alt={channel.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <Radio className="w-10 h-10 text-primary/30" />
        )}

        {/* Play overlay */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity",
            isPlaying
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100"
          )}
        >
          {isPlaying ? (
            <div className="flex items-center gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1 bg-white rounded-full animate-pulse"
                  style={{
                    height: `${12 + Math.random() * 12}px`,
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </div>
          ) : (
            <Play className="w-8 h-8 text-white" fill="white" />
          )}
        </div>

        {/* Channel number badge */}
        <span className="absolute top-1.5 left-1.5 text-[10px] font-mono bg-black/60 text-white px-1.5 py-0.5 rounded">
          {channel.channelNumber}
        </span>

        {/* Favorite button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className={cn(
            "absolute top-1.5 right-1.5 p-1 rounded-full transition-colors",
            isFavorite
              ? "text-yellow-500 bg-black/40"
              : "text-white/60 bg-black/30 opacity-0 group-hover:opacity-100 hover:text-yellow-500"
          )}
        >
          <Star
            className="w-3.5 h-3.5"
            fill={isFavorite ? "currentColor" : "none"}
          />
        </button>
      </div>

      {/* Info */}
      <div className="p-2 space-y-0.5">
        <p className="text-sm font-medium truncate">{channel.name}</p>
        {channel.nowPlaying ? (
          <p className="text-xs text-muted-foreground truncate">
            {channel.nowPlaying.artist
              ? `${channel.nowPlaying.artist} - ${channel.nowPlaying.title}`
              : channel.nowPlaying.title}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground truncate">
            {channel.genre || channel.category}
          </p>
        )}
      </div>
    </div>
  );
}
