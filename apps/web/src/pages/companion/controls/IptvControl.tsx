import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Tv,
  ChevronUp,
  ChevronDown,
  VolumeX,
  Volume2,
  Star,
  Clock,
  Search,
  Loader2,
} from "lucide-react";
import { api } from "../../../services/api";

interface IptvControlProps {
  kioskId: string;
  widgetId: string;
  widgetState?: Record<string, unknown>;
  config: Record<string, unknown>;
}

export function IptvControl({ kioskId, widgetId, widgetState, config }: IptvControlProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"favorites" | "history" | "search">("favorites");

  const currentChannel = widgetState?.channelName as string | undefined;
  const currentChannelId = widgetState?.activeChannelId as string | undefined;
  const isMuted = widgetState?.isMuted as boolean | undefined;

  // Fetch favorites and history
  const { data: favorites = [] } = useQuery({
    queryKey: ["companion-iptv-favorites"],
    queryFn: () => api.getIptvFavorites(),
    staleTime: 60_000,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["companion-iptv-history"],
    queryFn: () => api.getIptvHistory(20),
    staleTime: 60_000,
  });

  // Search channels
  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ["companion-iptv-search", searchQuery],
    queryFn: () => api.getIptvChannels({ search: searchQuery }),
    enabled: activeTab === "search" && searchQuery.length >= 2,
    staleTime: 30_000,
  });

  // Combined channel list for up/down navigation
  const allChannels = useMemo(() => {
    const favIds = new Set(favorites.map((f) => f.id));
    return [...favorites, ...history.filter((h) => !favIds.has(h.id))];
  }, [favorites, history]);

  const sendCommand = (action: string, data?: Record<string, unknown>) => {
    api.sendKioskCommand(kioskId, {
      type: "widget-control",
      payload: { widgetId, action, data },
    }).catch(() => {});
  };

  const handleChannelSelect = (channelId: string) => {
    sendCommand("channel-change", { channelId });
  };

  const handleChannelUp = () => {
    if (allChannels.length === 0) return;
    const currentIdx = allChannels.findIndex((ch) => ch.id === currentChannelId);
    const nextIdx = currentIdx <= 0 ? allChannels.length - 1 : currentIdx - 1;
    const ch = allChannels[nextIdx];
    if (ch) handleChannelSelect(ch.id);
  };

  const handleChannelDown = () => {
    if (allChannels.length === 0) return;
    const currentIdx = allChannels.findIndex((ch) => ch.id === currentChannelId);
    const nextIdx = (currentIdx + 1) % allChannels.length;
    const ch = allChannels[nextIdx];
    if (ch) handleChannelSelect(ch.id);
  };

  const handleMuteToggle = () => {
    sendCommand("mute-toggle");
  };

  const displayChannels = activeTab === "search" ? searchResults : activeTab === "history" ? history : favorites;

  return (
    <div className="flex flex-col h-full">
      {/* Current channel display */}
      <div className="p-4 bg-card border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-primary/10 shrink-0">
            <Tv className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-muted-foreground">Now Playing</div>
            <div className="font-semibold text-foreground truncate">
              {currentChannel || "No channel"}
            </div>
          </div>
        </div>
      </div>

      {/* Main controls */}
      <div className="flex items-center justify-center gap-6 py-6 px-4 bg-card border-b border-border">
        <button
          onClick={handleChannelUp}
          className="flex items-center justify-center h-14 w-14 rounded-full bg-primary/10 hover:bg-primary/20 active:bg-primary/30 transition-colors"
        >
          <ChevronUp className="h-7 w-7 text-primary" />
        </button>

        <button
          onClick={handleMuteToggle}
          className={`flex items-center justify-center h-14 w-14 rounded-full transition-colors ${
            isMuted
              ? "bg-destructive/10 hover:bg-destructive/20 active:bg-destructive/30"
              : "bg-primary/10 hover:bg-primary/20 active:bg-primary/30"
          }`}
        >
          {isMuted ? (
            <VolumeX className="h-7 w-7 text-destructive" />
          ) : (
            <Volume2 className="h-7 w-7 text-primary" />
          )}
        </button>

        <button
          onClick={handleChannelDown}
          className="flex items-center justify-center h-14 w-14 rounded-full bg-primary/10 hover:bg-primary/20 active:bg-primary/30 transition-colors"
        >
          <ChevronDown className="h-7 w-7 text-primary" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-card shrink-0">
        <button
          onClick={() => setActiveTab("favorites")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
            activeTab === "favorites"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Star className="h-4 w-4" /> Favorites
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
            activeTab === "history"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clock className="h-4 w-4" /> Recent
        </button>
        <button
          onClick={() => setActiveTab("search")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
            activeTab === "search"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Search className="h-4 w-4" /> Search
        </button>
      </div>

      {/* Search input */}
      {activeTab === "search" && (
        <div className="px-4 py-3 bg-card border-b border-border shrink-0">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search channels..."
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            autoFocus
          />
        </div>
      )}

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto">
        {searching && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {!searching && displayChannels.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {activeTab === "search"
              ? searchQuery.length < 2
                ? "Type to search channels"
                : "No channels found"
              : `No ${activeTab} channels`}
          </div>
        )}

        {!searching &&
          displayChannels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => handleChannelSelect(channel.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                channel.id === currentChannelId
                  ? "bg-primary/10 border-l-2 border-primary"
                  : "hover:bg-primary/5 border-l-2 border-transparent"
              }`}
            >
              {channel.logoUrl ? (
                <img
                  src={channel.logoUrl}
                  alt=""
                  className="h-8 w-8 rounded object-contain bg-black/10 shrink-0"
                />
              ) : (
                <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                  <Tv className="h-4 w-4 text-primary/60" />
                </div>
              )}
              <span
                className={`text-sm truncate ${
                  channel.id === currentChannelId
                    ? "text-primary font-medium"
                    : "text-foreground"
                }`}
              >
                {channel.name}
              </span>
            </button>
          ))}
      </div>
    </div>
  );
}
