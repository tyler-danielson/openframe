import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Search,
  RefreshCw,
  Server,
  Trash2,
  Settings,
  X,
  CheckCircle,
  LayoutDashboard,
  Star,
  Layers,
  Clock,
  Calendar,
  Youtube,
} from "lucide-react";
import { api } from "../services/api";
import { useIptvStore } from "../stores/iptv";
import { Button } from "../components/ui/Button";
import { VideoPlayer } from "../components/iptv/VideoPlayer";
import { ChannelGrid } from "../components/iptv/ChannelGrid";
import { CategorySidebar } from "../components/iptv/CategorySidebar";
import { EpgBar } from "../components/iptv/EpgBar";
import { IptvDashboard } from "../components/iptv/IptvDashboard";
import { ChannelGuide } from "../components/iptv/ChannelGuide";
import { cn } from "../lib/utils";
import { useRemoteControlStore } from "../stores/remote-control";
import { YouTubeTab } from "../components/youtube/YouTubeTab";
import type { IptvChannel } from "@openframe/shared";

type TabView = "dashboard" | "guide" | "favorites" | "all" | "history" | "youtube";

const TABS: { id: TabView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "dashboard", label: "Now Playing", icon: LayoutDashboard },
  { id: "guide", label: "Guide", icon: Calendar },
  { id: "favorites", label: "Favorites", icon: Star },
  { id: "all", label: "All Channels", icon: Layers },
  { id: "history", label: "Recently Watched", icon: Clock },
  { id: "youtube", label: "YouTube", icon: Youtube },
];

export function IptvPage() {
  const queryClient = useQueryClient();
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<TabView>("dashboard");
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);

  const {
    currentChannel,
    selectedCategoryId,
    searchQuery,
    isFullscreen,
    setCurrentChannel,
    setSelectedCategoryId,
    setSearchQuery,
  } = useIptvStore();

  // Fetch servers
  const { data: servers = [], isLoading: loadingServers } = useQuery({
    queryKey: ["iptv-servers"],
    queryFn: () => api.getIptvServers(),
  });

  // Fetch cached guide data (channels, categories, EPG all at once)
  const { data: guideData, isLoading: loadingGuide } = useQuery({
    queryKey: ["iptv-guide"],
    queryFn: () => api.getIptvGuide(),
    enabled: servers.length > 0,
    staleTime: 4 * 60 * 60 * 1000, // Consider fresh for 4 hours
  });

  // Extract categories from guide data
  const categories = guideData?.categories || [];

  // Filter channels from guide based on category and search (name + current program title)
  const guideChannels = useMemo(() => {
    if (!guideData?.channels) return [];
    let filtered = guideData.channels;
    if (selectedCategoryId) {
      filtered = filtered.filter((c) => c.categoryId === selectedCategoryId);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const now = new Date();
      filtered = filtered.filter((c) => {
        if (c.name.toLowerCase().includes(query)) return true;
        // Also match current program title
        const channelEpg = guideData.epg?.[c.id];
        if (channelEpg) {
          const currentProgram = channelEpg.find((e) => {
            const start = new Date(e.startTime);
            const end = new Date(e.endTime);
            return now >= start && now < end;
          });
          if (currentProgram?.title.toLowerCase().includes(query)) return true;
        }
        return false;
      });
    }
    return filtered;
  }, [guideData?.channels, guideData?.epg, selectedCategoryId, searchQuery]);

  // Fetch favorites
  const { data: favorites = [], isLoading: loadingFavorites } = useQuery({
    queryKey: ["iptv-favorites"],
    queryFn: () => api.getIptvFavorites(),
    enabled: servers.length > 0,
  });

  // Fetch history
  const { data: history = [], isLoading: loadingHistory } = useQuery({
    queryKey: ["iptv-history"],
    queryFn: () => api.getIptvHistory(50),
    enabled: servers.length > 0,
  });

  // Fetch favorite sports teams games for dashboard
  const { data: favoriteTeams = [] } = useQuery({
    queryKey: ["sports-favorites"],
    queryFn: () => api.getFavoriteTeams(),
  });

  const { data: sportsGames = [] } = useQuery({
    queryKey: ["sports-scores-today"],
    queryFn: () => api.getTodaySportsScores(),
    enabled: favoriteTeams.length > 0,
    refetchInterval: 60000, // Refresh every minute for live scores
  });

  // Filter sports games to only those involving favorite teams
  const relevantSportsGames = useMemo(() => {
    if (favoriteTeams.length === 0) return [];
    const favoriteTeamIds = new Set(favoriteTeams.map((t) => t.teamId));
    return sportsGames.filter(
      (game) =>
        favoriteTeamIds.has(game.homeTeam.id) || favoriteTeamIds.has(game.awayTeam.id)
    );
  }, [favoriteTeams, sportsGames]);

  // Determine which channels to display based on active tab (with search filtering)
  const displayedChannels = useMemo(() => {
    let channels: IptvChannel[];
    switch (activeTab) {
      case "favorites":
        channels = favorites;
        break;
      case "history":
        channels = history;
        break;
      case "all":
        return guideChannels; // Already filtered by search
      default:
        return [];
    }
    // Apply search filter to favorites/history tabs
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const now = new Date();
      channels = channels.filter((c) => {
        if (c.name.toLowerCase().includes(query)) return true;
        const channelEpg = guideData?.epg?.[c.id];
        if (channelEpg) {
          const currentProgram = channelEpg.find((e) => {
            const start = new Date(e.startTime);
            const end = new Date(e.endTime);
            return now >= start && now < end;
          });
          if (currentProgram?.title.toLowerCase().includes(query)) return true;
        }
        return false;
      });
    }
    return channels;
  }, [activeTab, favorites, history, guideChannels, searchQuery, guideData?.epg]);

  const loadingChannels = useMemo(() => {
    switch (activeTab) {
      case "favorites":
        return loadingFavorites;
      case "history":
        return loadingHistory;
      case "all":
        return loadingGuide;
      default:
        return false;
    }
  }, [activeTab, loadingFavorites, loadingHistory, loadingGuide]);

  // Get EPG for current channel from cache
  const cachedEpg = useMemo(() => {
    if (!currentChannel || !guideData?.epg) return [];
    const epg = guideData.epg[currentChannel.id];
    if (!epg) return [];
    return epg.map((e) => ({
      id: e.id,
      channelId: currentChannel.id,
      title: e.title,
      description: e.description,
      startTime: new Date(e.startTime),
      endTime: new Date(e.endTime),
    }));
  }, [currentChannel, guideData?.epg]);

  // Fallback: Fetch EPG from API if not in cache
  const { data: apiEpgEntries = [], isLoading: loadingApiEpg } = useQuery({
    queryKey: ["iptv-epg", currentChannel?.id],
    queryFn: () => api.getIptvChannelEpg(currentChannel!.id),
    enabled: !!currentChannel && cachedEpg.length === 0,
    refetchInterval: 60000, // Refresh every minute
  });

  // Use cached EPG if available, otherwise use API EPG
  const epgEntries = cachedEpg.length > 0 ? cachedEpg : apiEpgEntries;
  const loadingEpg = cachedEpg.length === 0 && loadingApiEpg;

  // Refresh cache mutation
  const refreshCacheMutation = useMutation({
    mutationFn: () => api.refreshIptvCache(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["iptv-guide"] });
    },
  });

  // Delete server mutation
  const deleteServerMutation = useMutation({
    mutationFn: api.deleteIptvServer.bind(api),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["iptv-servers"] });
      queryClient.invalidateQueries({ queryKey: ["iptv-categories"] });
      queryClient.invalidateQueries({ queryKey: ["iptv-channels"] });
    },
  });

  // Sync server mutation
  const syncServerMutation = useMutation({
    mutationFn: api.syncIptvServer.bind(api),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["iptv-categories"] });
      queryClient.invalidateQueries({ queryKey: ["iptv-channels"] });
      queryClient.invalidateQueries({ queryKey: ["iptv-servers"] });
      // Refresh cache after sync
      await api.refreshIptvCache();
      queryClient.invalidateQueries({ queryKey: ["iptv-guide"] });
    },
  });

  // Toggle favorite mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ channelId, isFavorite }: { channelId: string; isFavorite: boolean }) => {
      if (isFavorite) {
        await api.removeIptvFavorite(channelId);
      } else {
        await api.addIptvFavorite(channelId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["iptv-channels"] });
      queryClient.invalidateQueries({ queryKey: ["iptv-favorites"] });
      queryClient.invalidateQueries({ queryKey: ["iptv-guide"] });
      queryClient.invalidateQueries({ queryKey: ["iptv-history"] });
    },
  });

  // Handle channel selection
  const handleChannelSelect = async (channel: IptvChannel) => {
    setCurrentChannel(channel);
    setStreamError(null);

    try {
      const { streamUrl } = await api.getIptvChannelStream(channel.id);
      setStreamUrl(streamUrl);
      // Record watch history
      api.recordIptvWatch(channel.id).catch(() => {});
      // Invalidate history so it updates
      queryClient.invalidateQueries({ queryKey: ["iptv-history"] });
    } catch (error) {
      setStreamError("Failed to load stream");
      setStreamUrl(null);
    }
  };

  // Consume iptv-play commands from remote control (cast to kiosk)
  const consumeCommand = useRemoteControlStore((s) => s.consumeCommand);
  const pendingCount = useRemoteControlStore((s) => s.pendingCommands.length);

  useEffect(() => {
    if (pendingCount === 0) return;
    const cmd = consumeCommand();
    if (!cmd || cmd.type !== "iptv-play") return;
    const channelId = cmd.payload?.channelId as string;
    if (channelId && guideData?.channels) {
      const channel = guideData.channels.find((c) => c.id === channelId);
      if (channel) handleChannelSelect(channel);
    }
  }, [pendingCount]);

  // Handle tab selection
  const handleTabSelect = (tab: TabView) => {
    setActiveTab(tab);
    // Clear category selection when switching tabs
    if (tab !== "all") {
      setSelectedCategoryId(null);
    }
  };

  // Handle category selection (from sidebar)
  const handleCategorySelect = (categoryId: string | null) => {
    setSelectedCategoryId(categoryId);
  };

  // Show sidebar only on All Channels tab
  const showSidebar = activeTab === "all" && !isFullscreen;

  const isYouTubeTab = activeTab === "youtube";

  // No servers state (skip for YouTube tab)
  if (servers.length === 0 && !loadingServers && !isYouTubeTab) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <Server className="h-10 w-10 text-primary" />
        </div>
        <h2 className="mt-6 text-2xl font-semibold">No IPTV Servers</h2>
        <p className="mt-2 text-center text-muted-foreground">
          Add your first IPTV server to start watching live TV.
        </p>
        <Link to="/settings?tab=iptv">
          <Button className="mt-6">
            <Settings className="mr-2 h-4 w-4" />
            Add Server in Settings
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">{isYouTubeTab ? "YouTube" : "Live TV"}</h1>
          {/* Cache status indicator */}
          {!isYouTubeTab && guideData?.cached && guideData.lastUpdated && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span>
                Cached {new Date(guideData.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {!isYouTubeTab && (
            <>
              {/* Refresh cache button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refreshCacheMutation.mutate()}
                disabled={refreshCacheMutation.isPending}
                title="Refresh guide data"
              >
                <RefreshCw
                  className={cn(
                    "h-4 w-4",
                    refreshCacheMutation.isPending && "animate-spin"
                  )}
                />
              </Button>

              {/* Search - available on all tabs */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search channels & programs..."
                  className="h-9 w-64 rounded-md border border-border bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-muted"
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
              </div>

              {/* Server settings */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowServerSettings(!showServerSettings)}
              >
                <Settings className="mr-2 h-4 w-4" />
                Servers
              </Button>

              {/* Settings link */}
              <Link to="/settings?tab=iptv">
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Tab bar */}
      {!isFullscreen && (
        <div className="flex items-center gap-1 border-b border-border bg-card px-4">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabSelect(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {/* Show count badges */}
                {tab.id === "favorites" && favorites.length > 0 && (
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded-full",
                    isActive ? "bg-primary/20" : "bg-muted"
                  )}>
                    {favorites.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Server settings panel */}
      {showServerSettings && (
        <div className="border-b border-border bg-muted/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">IPTV Servers</h3>
            <button
              onClick={() => setShowServerSettings(false)}
              className="rounded p-1 hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2">
            {servers.map((server) => (
              <div
                key={server.id}
                className="flex items-center justify-between rounded-md border border-border bg-card p-3"
              >
                <div>
                  <h4 className="font-medium">{server.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {server.channelCount} channels in {server.categoryCount} categories
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncServerMutation.mutate(server.id)}
                    disabled={syncServerMutation.isPending}
                  >
                    <RefreshCw
                      className={cn(
                        "mr-2 h-4 w-4",
                        syncServerMutation.isPending && "animate-spin"
                      )}
                    />
                    Sync
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm("Delete this server and all its channels?")) {
                        deleteServerMutation.mutate(server.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      {isYouTubeTab ? (
        <div className="flex-1 overflow-hidden">
          <YouTubeTab />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Category sidebar - only on All Channels tab */}
          {showSidebar && (
            <CategorySidebar
              categories={categories}
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={handleCategorySelect}
              specialViews={{ favorites: false, history: false }}
              onSelectSpecialView={() => {}}
              activeSpecialView={null}
            />
          )}

          {/* Main area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Video player area */}
            {currentChannel && (
              <div className="relative">
                <div className={cn("bg-black", isFullscreen ? "h-screen" : "h-64 lg:h-80")}>
                  <VideoPlayer
                    streamUrl={streamUrl}
                    channelName={currentChannel.name}
                    channelId={currentChannel.id}
                    onError={setStreamError}
                  />
                </div>
                {streamError && (
                  <div className="absolute bottom-4 left-4 rounded-md bg-destructive/90 px-3 py-2 text-sm text-destructive-foreground">
                    {streamError}
                  </div>
                )}
              </div>
            )}

            {/* EPG bar */}
            {currentChannel && !isFullscreen && (
              <EpgBar epgEntries={epgEntries} isLoading={loadingEpg} />
            )}

            {/* Tab content */}
            {!isFullscreen && (
              <div className="flex-1 overflow-y-auto">
                {activeTab === "dashboard" ? (
                  <IptvDashboard
                    favorites={favorites}
                    history={history}
                    channels={guideData?.channels || []}
                    epg={guideData?.epg || {}}
                    sportsGames={relevantSportsGames}
                    searchQuery={searchQuery}
                    onChannelSelect={handleChannelSelect}
                    onToggleFavorite={(channelId, isFavorite) =>
                      toggleFavoriteMutation.mutate({ channelId, isFavorite })
                    }
                    onViewAllFavorites={() => handleTabSelect("favorites")}
                    onViewAllHistory={() => handleTabSelect("history")}
                    onViewGuide={() => handleTabSelect("guide")}
                  />
                ) : activeTab === "guide" ? (
                  <ChannelGuide
                    channels={guideData?.channels || []}
                    epg={guideData?.epg || {}}
                    favorites={favorites}
                    searchQuery={searchQuery}
                    onChannelSelect={handleChannelSelect}
                  />
                ) : loadingChannels ? (
                  <div className="flex h-full items-center justify-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <ChannelGrid
                    channels={displayedChannels}
                    currentChannelId={currentChannel?.id}
                    onChannelSelect={handleChannelSelect}
                    onToggleFavorite={(channelId, isFavorite) =>
                      toggleFavoriteMutation.mutate({ channelId, isFavorite })
                    }
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
