import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Youtube, Menu, Bookmark, Search as SearchIcon } from "lucide-react";
import { api } from "../../services/api";
import { YouTubePlayer } from "../youtube/YouTubePlayer";
import type { WidgetStyle } from "../../stores/screensaver";
import { useBlockControls } from "../../hooks/useBlockControls";
import { useWidgetStateReporter } from "../../hooks/useWidgetStateReporter";

interface YouTubeWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
  widgetId?: string;
}

export function YouTubeWidget({ config, isBuilder, widgetId }: YouTubeWidgetProps) {
  const videoId = config.videoId as string ?? "";
  const autoPlay = config.autoPlay as boolean ?? true;
  const muted = config.muted as boolean ?? true;
  const showControls = config.showControls as boolean ?? true;

  const [activeVideoId, setActiveVideoId] = useState(videoId);
  const [activeVideoTitle, setActiveVideoTitle] = useState("");
  const [showOverlay, setShowOverlay] = useState(false);

  // Fetch bookmarks for overlay selection
  const { data: bookmarks = [] } = useQuery({
    queryKey: ["youtube-bookmarks"],
    queryFn: () => api.getYoutubeBookmarks(),
    enabled: !isBuilder && showOverlay,
  });

  const handleVideoSelect = useCallback((id: string, title?: string) => {
    setActiveVideoId(id);
    setActiveVideoTitle(title || "");
    setShowOverlay(false);
    // Record watch
    if (title) {
      api.recordYoutubeWatch({ youtubeId: id, title }).catch(() => {});
    }
  }, []);

  // Block controls for TV remote
  const blockControls = useMemo(() => {
    if (isBuilder || !widgetId) return null;
    return {
      actions: [
        {
          key: "enter",
          label: showOverlay ? "Close Menu" : "Open Menu",
          action: () => setShowOverlay((v) => !v),
        },
      ],
      remoteActions: [
        {
          key: "video-change",
          label: "Change Video",
          execute: (data?: Record<string, unknown>) => {
            const vid = data?.videoId as string;
            const title = data?.title as string;
            if (vid) handleVideoSelect(vid, title);
          },
        },
      ],
    };
  }, [isBuilder, widgetId, showOverlay, handleVideoSelect]);
  useBlockControls(widgetId, blockControls);

  // Report state for companion app
  useWidgetStateReporter(
    isBuilder ? undefined : widgetId,
    "youtube",
    useMemo(() => ({ activeVideoId, activeVideoTitle }), [activeVideoId, activeVideoTitle])
  );

  // Builder preview
  if (isBuilder) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-black/60 text-white/70 gap-2">
        <Youtube className="h-8 w-8" />
        <span className="text-sm font-medium">YouTube</span>
        {videoId ? (
          <span className="text-xs text-white/40">Video configured</span>
        ) : (
          <span className="text-xs text-white/40">No video set</span>
        )}
      </div>
    );
  }

  // No video configured
  if (!activeVideoId) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center bg-black text-white/50 gap-2">
        <Youtube className="h-8 w-8" />
        <span className="text-sm">No video configured</span>
        <button
          onClick={() => setShowOverlay(true)}
          className="absolute left-2 top-2 z-10 rounded-full bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
        >
          <Menu className="h-4 w-4" />
        </button>
        {showOverlay && (
          <YouTubeOverlay
            bookmarks={bookmarks}
            onSelect={handleVideoSelect}
            onClose={() => setShowOverlay(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      <YouTubePlayer
        videoId={activeVideoId}
        autoPlay={autoPlay}
        muted={muted}
        showControls={showControls}
      />
      {/* Menu button */}
      <button
        onClick={() => setShowOverlay(true)}
        className="absolute left-2 top-2 z-10 rounded-full bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
      >
        <Menu className="h-4 w-4" />
      </button>
      {showOverlay && (
        <YouTubeOverlay
          bookmarks={bookmarks}
          onSelect={handleVideoSelect}
          onClose={() => setShowOverlay(false)}
        />
      )}
    </div>
  );
}

// Simple overlay for selecting a video from bookmarks
function YouTubeOverlay({
  bookmarks,
  onSelect,
  onClose,
}: {
  bookmarks: { youtubeId: string; title: string; thumbnailUrl?: string | null }[];
  onSelect: (id: string, title?: string) => void;
  onClose: () => void;
}) {
  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState<{ youtubeId: string; title: string; thumbnailUrl?: string }[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!searchInput.trim()) return;
    setSearching(true);
    try {
      const data = await api.youtubeSearch(searchInput.trim());
      setSearchResults(data.results || []);
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-black/95 text-white">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="text-sm font-medium">Select Video</span>
        <button onClick={onClose} className="rounded p-1 text-white/60 hover:text-white">
          ✕
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Search YouTube..."
          className="flex-1 rounded bg-white/10 px-2 py-1.5 text-sm text-white placeholder:text-white/40 focus:outline-none"
        />
        <button
          onClick={handleSearch}
          disabled={searching}
          className="rounded bg-white/10 p-1.5 text-white/60 hover:text-white"
        >
          <SearchIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Search results */}
        {searchResults.length > 0 && (
          <div className="border-b border-white/10 p-2">
            <div className="mb-1 flex items-center gap-1 px-1 text-xs text-white/40">
              <SearchIcon className="h-3 w-3" /> Search Results
            </div>
            {searchResults.map((item) => (
              <button
                key={item.youtubeId}
                onClick={() => onSelect(item.youtubeId, item.title)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-white/10"
              >
                {item.thumbnailUrl && (
                  <img src={item.thumbnailUrl} alt="" className="h-8 w-14 rounded object-cover" />
                )}
                <span className="line-clamp-2 flex-1">{item.title}</span>
              </button>
            ))}
          </div>
        )}

        {/* Bookmarks */}
        {bookmarks.length > 0 && (
          <div className="p-2">
            <div className="mb-1 flex items-center gap-1 px-1 text-xs text-white/40">
              <Bookmark className="h-3 w-3" /> Bookmarks
            </div>
            {bookmarks.map((item) => (
              <button
                key={item.youtubeId}
                onClick={() => onSelect(item.youtubeId, item.title)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-white/10"
              >
                {item.thumbnailUrl && (
                  <img src={item.thumbnailUrl} alt="" className="h-8 w-14 rounded object-cover" />
                )}
                <span className="line-clamp-2 flex-1">{item.title}</span>
              </button>
            ))}
          </div>
        )}

        {bookmarks.length === 0 && searchResults.length === 0 && (
          <div className="flex h-20 items-center justify-center text-sm text-white/40">
            Search for a video or bookmark videos first
          </div>
        )}
      </div>
    </div>
  );
}
