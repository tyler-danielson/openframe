import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  X,
  Volume2,
  VolumeX,
  Tv,
  Star,
  Clock,
  Search,
  Radio,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { api } from "../../services/api";
import { EpgBar } from "./EpgBar";
import { MiniChannelList } from "./MiniChannelList";
import type { IptvChannel } from "@openframe/shared";

type TabId = "now-playing" | "channels" | "guide";
type ChannelFilter = "favorites" | "recent" | "search";

interface IptvTileOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  activeChannelId: string;
  channelName: string;
  onChannelSelect: (channelId: string) => void;
  onToggleFavorite: (channelId: string, isFavorite: boolean) => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export function IptvTileOverlay({
  isOpen,
  onClose,
  activeChannelId,
  channelName,
  onChannelSelect,
  onToggleFavorite,
  isMuted,
  onToggleMute,
}: IptvTileOverlayProps) {
  const [activeTab, setActiveTab] = useState<TabId>("now-playing");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("favorites");
  const [searchQuery, setSearchQuery] = useState("");

  // --- Data fetching (only when open) ---

  const { data: epgEntries = [], isLoading: loadingEpg } = useQuery({
    queryKey: ["overlay-epg", activeChannelId],
    queryFn: () => api.getIptvChannelEpg(activeChannelId),
    enabled: isOpen && !!activeChannelId,
    staleTime: 60_000,
  });

  const { data: favorites = [], isLoading: loadingFavorites } = useQuery({
    queryKey: ["widget-iptv-favorites"],
    queryFn: () => api.getIptvFavorites(),
    enabled: isOpen,
    staleTime: 60_000,
  });

  const { data: history = [], isLoading: loadingHistory } = useQuery({
    queryKey: ["widget-iptv-history"],
    queryFn: () => api.getIptvHistory(20),
    enabled: isOpen,
    staleTime: 60_000,
  });

  const { data: guideData, isLoading: loadingGuide } = useQuery({
    queryKey: ["overlay-guide"],
    queryFn: () => api.getIptvGuide(),
    enabled: isOpen && activeTab === "guide",
    staleTime: 120_000,
  });

  const { data: searchResults = [], isLoading: loadingSearch } = useQuery({
    queryKey: ["overlay-search", searchQuery],
    queryFn: () => api.getIptvChannels({ search: searchQuery }),
    enabled: isOpen && channelFilter === "search" && searchQuery.length >= 2,
    staleTime: 30_000,
  });

  // Mark favorites in search results and history
  const favoriteIds = useMemo(
    () => new Set(favorites.map((f) => f.id)),
    [favorites]
  );

  const enrichedHistory = useMemo(
    () =>
      history.map((ch) => ({
        ...ch,
        isFavorite: favoriteIds.has(ch.id),
      })),
    [history, favoriteIds]
  );

  const enrichedSearch = useMemo(
    () =>
      searchResults.map((ch) => ({
        ...ch,
        isFavorite: favoriteIds.has(ch.id),
      })),
    [searchResults, favoriteIds]
  );

  const enrichedFavorites = useMemo(
    () => favorites.map((ch) => ({ ...ch, isFavorite: true })),
    [favorites]
  );

  // Guide: "what's on now" for favorite channels
  const guideNowPlaying = useMemo(() => {
    if (!guideData) return [];
    const now = new Date();
    const favChannels = guideData.channels.filter((ch) =>
      favoriteIds.has(ch.id)
    );

    return favChannels.map((ch) => {
      const epg = guideData.epg[ch.id] || [];
      const currentProgram = epg.find((entry) => {
        const start = new Date(entry.startTime);
        const end = new Date(entry.endTime);
        return now >= start && now < end;
      });

      let progress = 0;
      if (currentProgram) {
        const start = new Date(currentProgram.startTime).getTime();
        const end = new Date(currentProgram.endTime).getTime();
        progress = ((now.getTime() - start) / (end - start)) * 100;
      }

      return { channel: ch, currentProgram, progress };
    });
  }, [guideData, favoriteIds]);

  const handleChannelSelect = (channelId: string) => {
    onChannelSelect(channelId);
    onClose();
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "now-playing", label: "Now Playing" },
    { id: "channels", label: "Channels" },
    { id: "guide", label: "Guide" },
  ];

  const filterPills: { id: ChannelFilter; label: string; icon: typeof Star }[] =
    [
      { id: "favorites", label: "Favorites", icon: Star },
      { id: "recent", label: "Recent", icon: Clock },
      { id: "search", label: "Search", icon: Search },
    ];

  return (
    <div
      className={cn(
        "absolute inset-0 z-30 flex flex-col justify-end transition-opacity duration-200",
        isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
    >
      {/* Backdrop - click to close */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div
        className={cn(
          "relative flex flex-col bg-black/90 backdrop-blur-sm rounded-t-xl max-h-[70%] transition-transform duration-200",
          isOpen ? "translate-y-0" : "translate-y-full"
        )}
      >
        {/* Tab bar */}
        <div className="flex items-center border-b border-white/10 px-2 flex-shrink-0">
          <div className="flex flex-1 items-center gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "text-white border-b-2 border-white"
                    : "text-white/50 hover:text-white/80"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={onToggleMute}
              className="p-3 text-white/60 hover:text-white transition-colors"
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-3 text-white/60 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {activeTab === "now-playing" && (
            <NowPlayingTab
              activeChannelId={activeChannelId}
              channelName={channelName}
              epgEntries={epgEntries}
              isLoading={loadingEpg}
              favorites={favorites}
            />
          )}

          {activeTab === "channels" && (
            <ChannelsTab
              channelFilter={channelFilter}
              setChannelFilter={setChannelFilter}
              filterPills={filterPills}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              favorites={enrichedFavorites}
              history={enrichedHistory}
              searchResults={enrichedSearch}
              activeChannelId={activeChannelId}
              onChannelSelect={handleChannelSelect}
              onToggleFavorite={onToggleFavorite}
              loadingFavorites={loadingFavorites}
              loadingHistory={loadingHistory}
              loadingSearch={loadingSearch}
            />
          )}

          {activeTab === "guide" && (
            <GuideTab
              guideNowPlaying={guideNowPlaying}
              isLoading={loadingGuide}
              activeChannelId={activeChannelId}
              onChannelSelect={handleChannelSelect}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// --- Now Playing Tab ---

function NowPlayingTab({
  activeChannelId,
  channelName,
  epgEntries,
  isLoading,
  favorites,
}: {
  activeChannelId: string;
  channelName: string;
  epgEntries: Array<{ id: string; channelId: string; title: string; description: string | null; startTime: Date; endTime: Date }>;
  isLoading: boolean;
  favorites: IptvChannel[];
}) {
  const [imgError, setImgError] = useState(false);
  const channel = favorites.find((f) => f.id === activeChannelId);
  const logoUrl = channel?.logoUrl || channel?.streamIcon;

  return (
    <div className="p-4">
      {/* Channel info */}
      <div className="flex items-center gap-3 mb-3">
        <div className="h-8 w-8 flex-shrink-0 rounded overflow-hidden bg-white/10">
          {logoUrl && !imgError ? (
            <img
              src={logoUrl}
              alt=""
              className="h-full w-full object-contain"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Tv className="h-4 w-4 text-white/40" />
            </div>
          )}
        </div>
        <div>
          <h3 className="text-sm font-medium text-white">{channelName || "Unknown Channel"}</h3>
          <span className="text-xs text-white/40">Currently watching</span>
        </div>
      </div>

      {/* EPG info */}
      <div className="rounded-lg overflow-hidden bg-white/5 border border-white/10">
        <EpgBar epgEntries={epgEntries} isLoading={isLoading} />
      </div>
    </div>
  );
}

// --- Channels Tab ---

function ChannelsTab({
  channelFilter,
  setChannelFilter,
  filterPills,
  searchQuery,
  setSearchQuery,
  favorites,
  history,
  searchResults,
  activeChannelId,
  onChannelSelect,
  onToggleFavorite,
  loadingFavorites,
  loadingHistory,
  loadingSearch,
}: {
  channelFilter: ChannelFilter;
  setChannelFilter: (f: ChannelFilter) => void;
  filterPills: { id: ChannelFilter; label: string; icon: typeof Star }[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  favorites: IptvChannel[];
  history: IptvChannel[];
  searchResults: IptvChannel[];
  activeChannelId: string;
  onChannelSelect: (channelId: string) => void;
  onToggleFavorite: (channelId: string, isFavorite: boolean) => void;
  loadingFavorites: boolean;
  loadingHistory: boolean;
  loadingSearch: boolean;
}) {
  const channels =
    channelFilter === "favorites"
      ? favorites
      : channelFilter === "recent"
        ? history
        : searchResults;

  const isLoading =
    channelFilter === "favorites"
      ? loadingFavorites
      : channelFilter === "recent"
        ? loadingHistory
        : loadingSearch;

  const emptyMessage =
    channelFilter === "favorites"
      ? "No favorite channels yet"
      : channelFilter === "recent"
        ? "No recently watched channels"
        : searchQuery.length < 2
          ? "Type at least 2 characters to search"
          : "No channels found";

  return (
    <div>
      {/* Filter pills */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
        {filterPills.map((pill) => {
          const Icon = pill.icon;
          return (
            <button
              key={pill.id}
              onClick={() => setChannelFilter(pill.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                channelFilter === pill.id
                  ? "bg-white/20 text-white"
                  : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"
              )}
            >
              <Icon className="h-3 w-3" />
              {pill.label}
            </button>
          );
        })}
      </div>

      {/* Search input */}
      {channelFilter === "search" && (
        <div className="px-4 py-2 border-b border-white/10">
          <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
            <Search className="h-4 w-4 text-white/40 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search channels..."
              className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Channel list */}
      <MiniChannelList
        channels={channels}
        activeChannelId={activeChannelId}
        onChannelSelect={onChannelSelect}
        onToggleFavorite={onToggleFavorite}
        isLoading={isLoading}
        emptyMessage={emptyMessage}
      />
    </div>
  );
}

// --- Guide Tab ---

function GuideTab({
  guideNowPlaying,
  isLoading,
  activeChannelId,
  onChannelSelect,
}: {
  guideNowPlaying: Array<{
    channel: IptvChannel;
    currentProgram:
      | { id: string; title: string; description: string | null; startTime: string; endTime: string }
      | undefined;
    progress: number;
  }>;
  isLoading: boolean;
  activeChannelId: string;
  onChannelSelect: (channelId: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Radio className="h-5 w-5 animate-pulse text-white/50" />
      </div>
    );
  }

  if (guideNowPlaying.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-white/40">
        Add favorite channels to see what's on now
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="px-4 py-2 border-b border-white/10">
        <span className="text-xs font-medium text-white/40 uppercase tracking-wider">
          What's On Now
        </span>
      </div>
      {guideNowPlaying.map(({ channel, currentProgram, progress }) => (
        <GuideRow
          key={channel.id}
          channel={channel}
          currentProgram={currentProgram}
          progress={progress}
          isActive={channel.id === activeChannelId}
          onSelect={() => onChannelSelect(channel.id)}
        />
      ))}
    </div>
  );
}

function GuideRow({
  channel,
  currentProgram,
  progress,
  isActive,
  onSelect,
}: {
  channel: IptvChannel;
  currentProgram:
    | { id: string; title: string; description: string | null; startTime: string; endTime: string }
    | undefined;
  progress: number;
  isActive: boolean;
  onSelect: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const logoUrl = channel.logoUrl || channel.streamIcon;

  const endTime = currentProgram
    ? new Date(currentProgram.endTime).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors min-h-[44px]",
        isActive ? "bg-white/15" : "hover:bg-white/10"
      )}
      onClick={onSelect}
    >
      {/* Logo */}
      <div className="h-6 w-6 flex-shrink-0 rounded overflow-hidden bg-white/10">
        {logoUrl && !imgError ? (
          <img
            src={logoUrl}
            alt=""
            className="h-full w-full object-contain"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Tv className="h-3.5 w-3.5 text-white/40" />
          </div>
        )}
      </div>

      {/* Channel name + program */}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-white/50 truncate">{channel.name}</div>
        <div className="text-sm text-white truncate">
          {currentProgram?.title || "No program info"}
        </div>
        {/* Progress bar */}
        {currentProgram && (
          <div className="mt-1 h-1 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-white/50 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* End time */}
      {endTime && (
        <span className="flex-shrink-0 text-xs text-white/40">
          ends {endTime}
        </span>
      )}
    </div>
  );
}
