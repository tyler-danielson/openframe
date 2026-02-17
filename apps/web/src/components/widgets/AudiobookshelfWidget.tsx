import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Menu, Search as SearchIcon } from "lucide-react";
import { api } from "../../services/api";
import type { AudiobookshelfLibrary, AudiobookshelfItem } from "../../services/api";
import type { WidgetStyle } from "../../stores/screensaver";
import { useBlockControls } from "../../hooks/useBlockControls";
import { useWidgetStateReporter } from "../../hooks/useWidgetStateReporter";

interface AudiobookshelfWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
  widgetId?: string;
}

export function AudiobookshelfWidget({ config, isBuilder, widgetId }: AudiobookshelfWidgetProps) {
  const serverId = config.serverId as string ?? "";
  const itemId = config.itemId as string ?? "";
  const autoPlay = config.autoPlay as boolean ?? true;

  const [activeItemId, setActiveItemId] = useState(itemId);
  const [activeTitle, setActiveTitle] = useState("");
  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    if (itemId) setActiveItemId(itemId);
  }, [itemId]);

  // Fetch server info for web player URL
  const { data: servers = [] } = useQuery({
    queryKey: ["audiobookshelf-servers"],
    queryFn: () => api.getAudiobookshelfServers(),
    enabled: !isBuilder && !!serverId,
    staleTime: 300_000,
  });

  const server = servers.find((s) => s.id === serverId);

  const handleItemSelect = useCallback((id: string, title?: string) => {
    setActiveItemId(id);
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
          label: "Change Book",
          execute: (data?: Record<string, unknown>) => {
            const id = data?.itemId as string;
            const title = data?.title as string;
            if (id) handleItemSelect(id, title);
          },
        },
      ],
    };
  }, [isBuilder, widgetId, showOverlay, handleItemSelect]);
  useBlockControls(widgetId, blockControls);

  useWidgetStateReporter(
    isBuilder ? undefined : widgetId,
    "audiobookshelf",
    useMemo(() => ({ activeItemId, activeTitle }), [activeItemId, activeTitle])
  );

  // Builder preview
  if (isBuilder) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-black/60 text-white/70 gap-2">
        <BookOpen className="h-8 w-8 text-primary" />
        <span className="text-sm font-medium">Audiobookshelf</span>
        {itemId ? (
          <span className="text-xs text-white/40">Content configured</span>
        ) : (
          <span className="text-xs text-white/40">No content set</span>
        )}
      </div>
    );
  }

  // No content configured
  if (!activeItemId || !serverId) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center bg-black text-white/50 gap-2">
        <BookOpen className="h-8 w-8" />
        <span className="text-sm">No audiobook configured</span>
        {serverId && (
          <button
            onClick={() => setShowOverlay(true)}
            className="absolute left-2 top-2 z-10 rounded-full bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}
        {showOverlay && serverId && (
          <AudiobookshelfOverlay
            serverId={serverId}
            onSelect={handleItemSelect}
            onClose={() => setShowOverlay(false)}
          />
        )}
      </div>
    );
  }

  // Build player URL
  const playerUrl = server ? `${server.serverUrl}/item/${activeItemId}` : "";

  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      {playerUrl ? (
        <iframe
          src={playerUrl}
          className="h-full w-full border-0"
          allow="autoplay; fullscreen"
          title="Audiobookshelf Player"
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
        <AudiobookshelfOverlay
          serverId={serverId}
          onSelect={handleItemSelect}
          onClose={() => setShowOverlay(false)}
        />
      )}
    </div>
  );
}

function AudiobookshelfOverlay({
  serverId,
  onSelect,
  onClose,
}: {
  serverId: string;
  onSelect: (itemId: string, title?: string) => void;
  onClose: () => void;
}) {
  const [selectedLibrary, setSelectedLibrary] = useState<string>("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: libraries = [] } = useQuery({
    queryKey: ["abs-libraries", serverId],
    queryFn: () => api.getAudiobookshelfLibraries(serverId),
    staleTime: 300_000,
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["abs-library-items", serverId, selectedLibrary, searchQuery],
    queryFn: () => api.getAudiobookshelfItems(serverId, selectedLibrary, searchQuery || undefined),
    enabled: !!selectedLibrary,
    staleTime: 60_000,
  });

  const handleSearch = () => {
    setSearchQuery(searchInput.trim());
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-black/95 text-white">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="text-sm font-medium">Select Audiobook</span>
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
          placeholder="Search..."
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
        {libraries.map((lib) => (
          <button
            key={lib.id}
            onClick={() => { setSelectedLibrary(lib.id); setSearchQuery(""); }}
            className={`whitespace-nowrap rounded px-2 py-1 text-xs transition-colors ${
              selectedLibrary === lib.id ? "bg-white/20 text-white" : "text-white/50 hover:text-white"
            }`}
          >
            {lib.name}
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
                key={item.id}
                onClick={() => onSelect(item.id, item.title)}
                className="flex flex-col items-center gap-1 rounded p-2 text-left hover:bg-white/10"
              >
                {item.coverUrl && (
                  <img
                    src={api.getAudiobookshelfCoverUrl(serverId, item.id)}
                    alt=""
                    className="h-24 w-full rounded object-cover"
                  />
                )}
                <span className="line-clamp-2 w-full text-xs">{item.title}</span>
                {item.authorName && (
                  <span className="text-xs text-white/40">{item.authorName}</span>
                )}
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
