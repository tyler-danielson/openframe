import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TrendingUp, Search, Bookmark, Clock, RefreshCw, X } from "lucide-react";
import { api } from "../../services/api";
import { useYouTubeStore, type YouTubeSubTab } from "../../stores/youtube";
import { YouTubePlayer } from "./YouTubePlayer";
import { YouTubeVideoCard } from "./YouTubeVideoCard";
import { YouTubeSearchBar } from "./YouTubeSearchBar";
import { cn } from "../../lib/utils";

const SUB_TABS: { id: YouTubeSubTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "trending", label: "Trending", icon: TrendingUp },
  { id: "search", label: "Search", icon: Search },
  { id: "bookmarks", label: "Bookmarks", icon: Bookmark },
  { id: "history", label: "History", icon: Clock },
];

export function YouTubeTab() {
  const queryClient = useQueryClient();
  const {
    currentVideoId,
    currentVideoTitle,
    searchQuery,
    activeSubTab,
    setCurrentVideo,
    setSearchQuery,
    setActiveSubTab,
  } = useYouTubeStore();

  const [searchInput, setSearchInput] = useState(searchQuery);

  // Fetch trending
  const { data: trendingData, isLoading: loadingTrending } = useQuery({
    queryKey: ["youtube-trending"],
    queryFn: () => api.getYoutubeTrending(),
    staleTime: 10 * 60 * 1000,
    enabled: activeSubTab === "trending",
  });

  // Fetch search results
  const { data: searchData, isLoading: loadingSearch } = useQuery({
    queryKey: ["youtube-search", searchQuery],
    queryFn: () => api.youtubeSearch(searchQuery),
    enabled: activeSubTab === "search" && !!searchQuery,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch bookmarks
  const { data: bookmarks = [], isLoading: loadingBookmarks } = useQuery({
    queryKey: ["youtube-bookmarks"],
    queryFn: () => api.getYoutubeBookmarks(),
    enabled: activeSubTab === "bookmarks",
  });

  // Fetch history
  const { data: history = [], isLoading: loadingHistory } = useQuery({
    queryKey: ["youtube-history"],
    queryFn: () => api.getYoutubeHistory(),
    enabled: activeSubTab === "history",
  });

  // Bookmark IDs set for quick lookup
  const bookmarkIds = useMemo(
    () => new Set(bookmarks.map((b) => b.youtubeId)),
    [bookmarks]
  );

  // Add bookmark mutation
  const addBookmarkMutation = useMutation({
    mutationFn: (data: {
      youtubeId: string;
      title: string;
      thumbnailUrl?: string;
      channelTitle?: string;
      duration?: string;
      isLive?: boolean;
    }) => api.addYoutubeBookmark(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["youtube-bookmarks"] }),
  });

  // Remove bookmark mutation
  const removeBookmarkMutation = useMutation({
    mutationFn: (youtubeId: string) => {
      const bookmark = bookmarks.find((b) => b.youtubeId === youtubeId);
      if (!bookmark) return Promise.resolve();
      return api.removeYoutubeBookmark(bookmark.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["youtube-bookmarks"] }),
  });

  // Record watch mutation
  const recordWatchMutation = useMutation({
    mutationFn: (data: {
      youtubeId: string;
      title: string;
      thumbnailUrl?: string;
      channelTitle?: string;
    }) => api.recordYoutubeWatch(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["youtube-history"] }),
  });

  // Handle playing a video
  const handlePlay = useCallback(
    (youtubeId: string, title?: string, thumbnailUrl?: string, channelTitle?: string) => {
      setCurrentVideo(youtubeId, title || null);
      recordWatchMutation.mutate({
        youtubeId,
        title: title || youtubeId,
        thumbnailUrl,
        channelTitle,
      });
    },
    [setCurrentVideo, recordWatchMutation]
  );

  // Handle toggling bookmark from video cards
  const handleToggleBookmark = useCallback(
    (youtubeId: string, title?: string, thumbnailUrl?: string, channelTitle?: string, duration?: string, isLive?: boolean) => {
      if (bookmarkIds.has(youtubeId)) {
        removeBookmarkMutation.mutate(youtubeId);
      } else {
        addBookmarkMutation.mutate({
          youtubeId,
          title: title || youtubeId,
          thumbnailUrl,
          channelTitle,
          duration,
          isLive,
        });
      }
    },
    [bookmarkIds, addBookmarkMutation, removeBookmarkMutation]
  );

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setActiveSubTab("search");
  };

  // Handle URL paste
  const handleUrlPaste = (parsed: { type: string; youtubeId: string }) => {
    if (parsed.type === "video" || parsed.type === "live") {
      handlePlay(parsed.youtubeId);
      setSearchInput("");
    }
  };

  // Determine content for the active sub-tab
  const renderContent = () => {
    switch (activeSubTab) {
      case "trending": {
        if (loadingTrending) return <LoadingSpinner />;
        const items = trendingData || [];
        if (items.length === 0) return <EmptyState message="No trending videos available" />;
        return (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <YouTubeVideoCard
                key={item.youtubeId}
                youtubeId={item.youtubeId}
                title={item.title}
                thumbnailUrl={item.thumbnailUrl}
                channelTitle={item.channelTitle}
                duration={item.duration}
                viewCount={item.viewCount}
                publishedAt={item.publishedAt}
                isLive={item.isLive}
                isBookmarked={bookmarkIds.has(item.youtubeId)}
                onPlay={() => handlePlay(item.youtubeId, item.title, item.thumbnailUrl, item.channelTitle)}
                onToggleBookmark={() =>
                  handleToggleBookmark(item.youtubeId, item.title, item.thumbnailUrl, item.channelTitle, item.duration, item.isLive)
                }
              />
            ))}
          </div>
        );
      }

      case "search": {
        if (!searchQuery) {
          return <EmptyState message="Enter a search query or paste a YouTube URL" />;
        }
        if (loadingSearch) return <LoadingSpinner />;
        const items = searchData?.results || [];
        if (items.length === 0) return <EmptyState message="No results found" />;
        return (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <YouTubeVideoCard
                key={item.youtubeId}
                youtubeId={item.youtubeId}
                title={item.title}
                thumbnailUrl={item.thumbnailUrl}
                channelTitle={item.channelTitle}
                duration={item.duration}
                viewCount={item.viewCount}
                publishedAt={item.publishedAt}
                isLive={item.isLive}
                isBookmarked={bookmarkIds.has(item.youtubeId)}
                onPlay={() => handlePlay(item.youtubeId, item.title, item.thumbnailUrl, item.channelTitle)}
                onToggleBookmark={() =>
                  handleToggleBookmark(item.youtubeId, item.title, item.thumbnailUrl, item.channelTitle, item.duration, item.isLive)
                }
              />
            ))}
          </div>
        );
      }

      case "bookmarks": {
        if (loadingBookmarks) return <LoadingSpinner />;
        if (bookmarks.length === 0) return <EmptyState message="No bookmarks yet. Save videos to watch later." />;
        return (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {bookmarks.map((item) => (
              <YouTubeVideoCard
                key={item.id}
                youtubeId={item.youtubeId}
                title={item.title}
                thumbnailUrl={item.thumbnailUrl || ""}
                channelTitle={item.channelTitle || undefined}
                duration={item.duration || undefined}
                isLive={item.isLive}
                isBookmarked
                onPlay={() => handlePlay(item.youtubeId, item.title, item.thumbnailUrl || undefined, item.channelTitle || undefined)}
                onToggleBookmark={() =>
                  handleToggleBookmark(item.youtubeId, item.title, item.thumbnailUrl || undefined, item.channelTitle || undefined, item.duration || undefined, item.isLive)
                }
              />
            ))}
          </div>
        );
      }

      case "history": {
        if (loadingHistory) return <LoadingSpinner />;
        if (history.length === 0) return <EmptyState message="No watch history yet" />;
        return (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {history.map((item) => (
              <YouTubeVideoCard
                key={item.id}
                youtubeId={item.youtubeId}
                title={item.title}
                thumbnailUrl={item.thumbnailUrl || ""}
                channelTitle={item.channelTitle || undefined}
                isBookmarked={bookmarkIds.has(item.youtubeId)}
                onPlay={() => handlePlay(item.youtubeId, item.title, item.thumbnailUrl || undefined, item.channelTitle || undefined)}
                onToggleBookmark={() =>
                  handleToggleBookmark(item.youtubeId, item.title, item.thumbnailUrl || undefined, item.channelTitle || undefined)
                }
              />
            ))}
          </div>
        );
      }
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Player area */}
      {currentVideoId && (
        <div className="relative bg-black">
          <div className="mx-auto aspect-video max-h-[400px]">
            <YouTubePlayer videoId={currentVideoId} autoPlay muted={false} showControls />
          </div>
          <button
            onClick={() => setCurrentVideo(null)}
            className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
          >
            <X className="h-4 w-4" />
          </button>
          {currentVideoTitle && (
            <div className="bg-card px-4 py-2">
              <h3 className="text-sm font-medium">{currentVideoTitle}</h3>
            </div>
          )}
        </div>
      )}

      {/* Search bar */}
      <div className="border-b border-border bg-card px-4 py-3">
        <YouTubeSearchBar
          value={searchInput}
          onChange={setSearchInput}
          onSearch={handleSearch}
          onUrlPaste={handleUrlPaste}
        />
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 border-b border-border bg-card px-4">
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.id === "bookmarks" && bookmarks.length > 0 && (
                <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full",
                  isActive ? "bg-primary/20" : "bg-muted"
                )}>
                  {bookmarks.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {renderContent()}
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex h-40 items-center justify-center">
      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-40 items-center justify-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
