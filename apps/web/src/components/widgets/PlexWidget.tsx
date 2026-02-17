import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play, Menu, Search as SearchIcon } from "lucide-react";
import { api } from "../../services/api";
import type { PlexLibrary, PlexItem } from "../../services/api";
import type { WidgetStyle } from "../../stores/screensaver";
import { useBlockControls } from "../../hooks/useBlockControls";
import { useWidgetStateReporter } from "../../hooks/useWidgetStateReporter";

interface PlexWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
  widgetId?: string;
}

export function PlexWidget({ config, isBuilder, widgetId }: PlexWidgetProps) {
  const serverId = config.serverId as string ?? "";
  const ratingKey = config.ratingKey as string ?? "";
  const autoPlay = config.autoPlay as boolean ?? true;

  const [activeRatingKey, setActiveRatingKey] = useState(ratingKey);
  const [activeTitle, setActiveTitle] = useState("");
  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    if (ratingKey) setActiveRatingKey(ratingKey);
  }, [ratingKey]);

  // Fetch server info to get machineId for web player URL
  const { data: servers = [] } = useQuery({
    queryKey: ["plex-servers"],
    queryFn: () => api.getPlexServers(),
    enabled: !isBuilder && !!serverId,
    staleTime: 300_000,
  });

  const server = servers.find((s) => s.id === serverId);

  const handleItemSelect = useCallback((key: string, title?: string) => {
    setActiveRatingKey(key);
    setActiveTitle(title || "");
    setShowOverlay(false);
  }, []);

  // Block controls
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
          label: "Change Content",
          execute: (data?: Record<string, unknown>) => {
            const key = data?.ratingKey as string;
            const title = data?.title as string;
            if (key) handleItemSelect(key, title);
          },
        },
      ],
    };
  }, [isBuilder, widgetId, showOverlay, handleItemSelect]);
  useBlockControls(widgetId, blockControls);

  useWidgetStateReporter(
    isBuilder ? undefined : widgetId,
    "plex",
    useMemo(() => ({ activeRatingKey, activeTitle }), [activeRatingKey, activeTitle])
  );

  // Builder preview
  if (isBuilder) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-black/60 text-white/70 gap-2">
        <Play className="h-8 w-8 text-primary" />
        <span className="text-sm font-medium">Plex</span>
        {ratingKey ? (
          <span className="text-xs text-white/40">Content configured</span>
        ) : (
          <span className="text-xs text-white/40">No content set</span>
        )}
      </div>
    );
  }

  // No content configured
  if (!activeRatingKey || !serverId) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center bg-black text-white/50 gap-2">
        <Play className="h-8 w-8" />
        <span className="text-sm">No content configured</span>
        {serverId && (
          <button
            onClick={() => setShowOverlay(true)}
            className="absolute left-2 top-2 z-10 rounded-full bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}
        {showOverlay && serverId && (
          <PlexOverlay
            serverId={serverId}
            onSelect={handleItemSelect}
            onClose={() => setShowOverlay(false)}
          />
        )}
      </div>
    );
  }

  // Build player URL
  const machineId = server?.machineId || "";
  const playerUrl = machineId
    ? `${server?.serverUrl}/web/index.html#!/server/${machineId}/details?key=${encodeURIComponent(`/library/metadata/${activeRatingKey}`)}${autoPlay ? "&autoplay=1" : ""}`
    : "";

  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      {playerUrl ? (
        <iframe
          src={playerUrl}
          className="h-full w-full border-0"
          allow="autoplay; fullscreen"
          title="Plex Player"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-white/50">
          <span className="text-sm">Loading player...</span>
        </div>
      )}
      <button
        onClick={() => setShowOverlay(true)}
        className="absolute left-2 top-2 z-10 rounded-full bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
      >
        <Menu className="h-4 w-4" />
      </button>
      {showOverlay && (
        <PlexOverlay
          serverId={serverId}
          onSelect={handleItemSelect}
          onClose={() => setShowOverlay(false)}
        />
      )}
    </div>
  );
}

function PlexOverlay({
  serverId,
  onSelect,
  onClose,
  libraryFilter,
}: {
  serverId: string;
  onSelect: (ratingKey: string, title?: string) => void;
  onClose: () => void;
  libraryFilter?: string;
}) {
  const [selectedLibrary, setSelectedLibrary] = useState<string>("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: libraries = [] } = useQuery({
    queryKey: ["plex-libraries", serverId],
    queryFn: () => api.getPlexLibraries(serverId),
    staleTime: 300_000,
  });

  const filteredLibraries = libraryFilter
    ? libraries.filter((l) => l.type === libraryFilter)
    : libraries;

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["plex-library-items", serverId, selectedLibrary, searchQuery],
    queryFn: () =>
      searchQuery && !selectedLibrary
        ? api.searchPlex(serverId, searchQuery)
        : api.getPlexLibraryItems(serverId, selectedLibrary, searchQuery || undefined),
    enabled: !!selectedLibrary || !!searchQuery,
    staleTime: 60_000,
  });

  const handleSearch = () => {
    setSearchQuery(searchInput.trim());
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-black/95 text-white">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="text-sm font-medium">Select Content</span>
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
          placeholder="Search Plex..."
          className="flex-1 rounded bg-white/10 px-2 py-1.5 text-sm text-white placeholder:text-white/40 focus:outline-none"
        />
        <button
          onClick={handleSearch}
          className="rounded bg-white/10 p-1.5 text-white/60 hover:text-white"
        >
          <SearchIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Library tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-white/10 px-3 py-1.5">
        {filteredLibraries.map((lib) => (
          <button
            key={lib.key}
            onClick={() => { setSelectedLibrary(lib.key); setSearchQuery(""); }}
            className={`whitespace-nowrap rounded px-2 py-1 text-xs transition-colors ${
              selectedLibrary === lib.key ? "bg-white/20 text-white" : "text-white/50 hover:text-white"
            }`}
          >
            {lib.title}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex h-20 items-center justify-center text-sm text-white/40">Loading...</div>
        ) : items.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {items.map((item) => (
              <button
                key={item.ratingKey}
                onClick={() => onSelect(item.ratingKey, item.title)}
                className="flex flex-col items-center gap-1 rounded p-2 text-left hover:bg-white/10"
              >
                {item.thumb && (
                  <img
                    src={api.getPlexThumbUrl(serverId, item.thumb)}
                    alt=""
                    className="h-20 w-full rounded object-cover"
                  />
                )}
                <span className="line-clamp-2 w-full text-xs">{item.title}</span>
                {item.year && <span className="text-xs text-white/40">{item.year}</span>}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex h-20 items-center justify-center text-sm text-white/40">
            {selectedLibrary ? "No items found" : "Select a library to browse"}
          </div>
        )}
      </div>
    </div>
  );
}

export { PlexOverlay };
