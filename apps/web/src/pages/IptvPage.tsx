import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Search,
  RefreshCw,
  Server,
  Trash2,
  Settings,
  X,
} from "lucide-react";
import { api } from "../services/api";
import { useIptvStore } from "../stores/iptv";
import { Button } from "../components/ui/Button";
import { VideoPlayer } from "../components/iptv/VideoPlayer";
import { ChannelGrid } from "../components/iptv/ChannelGrid";
import { CategorySidebar } from "../components/iptv/CategorySidebar";
import { EpgBar } from "../components/iptv/EpgBar";
import { cn } from "../lib/utils";
import type { IptvChannel } from "@openframe/shared";

type SpecialView = "all" | "favorites" | "history";

export function IptvPage() {
  const queryClient = useQueryClient();
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [activeSpecialView, setActiveSpecialView] = useState<SpecialView>("all");
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

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ["iptv-categories"],
    queryFn: () => api.getIptvCategories(),
    enabled: servers.length > 0,
  });

  // Fetch channels based on view
  const { data: channels = [], isLoading: loadingChannels } = useQuery({
    queryKey: ["iptv-channels", selectedCategoryId, searchQuery, activeSpecialView],
    queryFn: async () => {
      if (activeSpecialView === "favorites") {
        return api.getIptvFavorites();
      }
      if (activeSpecialView === "history") {
        return api.getIptvHistory(50);
      }
      return api.getIptvChannels({
        categoryId: selectedCategoryId || undefined,
        search: searchQuery || undefined,
      });
    },
    enabled: servers.length > 0,
  });

  // Fetch EPG for current channel
  const { data: epgEntries = [], isLoading: loadingEpg } = useQuery({
    queryKey: ["iptv-epg", currentChannel?.id],
    queryFn: () => api.getIptvChannelEpg(currentChannel!.id),
    enabled: !!currentChannel,
    refetchInterval: 60000, // Refresh every minute
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["iptv-categories"] });
      queryClient.invalidateQueries({ queryKey: ["iptv-channels"] });
      queryClient.invalidateQueries({ queryKey: ["iptv-servers"] });
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
    } catch (error) {
      setStreamError("Failed to load stream");
      setStreamUrl(null);
    }
  };

  // Handle special view selection
  const handleSpecialViewSelect = (view: SpecialView) => {
    setActiveSpecialView(view);
    if (view !== "all") {
      setSelectedCategoryId(null);
    }
  };

  // Handle category selection
  const handleCategorySelect = (categoryId: string | null) => {
    setSelectedCategoryId(categoryId);
    setActiveSpecialView("all");
  };

  // No servers state
  if (servers.length === 0 && !loadingServers) {
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
        <h1 className="text-xl font-semibold">Live TV</h1>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search channels..."
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
        </div>
      </header>

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
      <div className="flex flex-1 overflow-hidden">
        {/* Category sidebar */}
        {!isFullscreen && (
          <CategorySidebar
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={handleCategorySelect}
            specialViews={{ favorites: true, history: true }}
            onSelectSpecialView={handleSpecialViewSelect}
            activeSpecialView={activeSpecialView}
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

          {/* Channel grid */}
          {!isFullscreen && (
            <div className="flex-1 overflow-y-auto">
              {loadingChannels ? (
                <div className="flex h-full items-center justify-center">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ChannelGrid
                  channels={channels}
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

    </div>
  );
}
