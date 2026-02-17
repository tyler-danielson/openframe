import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Music, Menu } from "lucide-react";
import { api } from "../../services/api";
import type { WidgetStyle } from "../../stores/screensaver";
import { useBlockControls } from "../../hooks/useBlockControls";
import { useWidgetStateReporter } from "../../hooks/useWidgetStateReporter";
import { PlexOverlay } from "./PlexWidget";

interface PlexAmpWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
  widgetId?: string;
}

export function PlexAmpWidget({ config, isBuilder, widgetId }: PlexAmpWidgetProps) {
  const serverId = config.serverId as string ?? "";
  const ratingKey = config.ratingKey as string ?? "";
  const autoPlay = config.autoPlay as boolean ?? true;

  const [activeRatingKey, setActiveRatingKey] = useState(ratingKey);
  const [activeTitle, setActiveTitle] = useState("");
  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    if (ratingKey) setActiveRatingKey(ratingKey);
  }, [ratingKey]);

  // Fetch server info
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
          label: "Change Track",
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
    "plexamp",
    useMemo(() => ({ activeRatingKey, activeTitle }), [activeRatingKey, activeTitle])
  );

  // Builder preview
  if (isBuilder) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-black/60 text-white/70 gap-2">
        <Music className="h-8 w-8 text-primary" />
        <span className="text-sm font-medium">PlexAmp</span>
        {ratingKey ? (
          <span className="text-xs text-white/40">Music configured</span>
        ) : (
          <span className="text-xs text-white/40">No music set</span>
        )}
      </div>
    );
  }

  // No content configured
  if (!activeRatingKey || !serverId) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center bg-black text-white/50 gap-2">
        <Music className="h-8 w-8" />
        <span className="text-sm">No music configured</span>
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
            libraryFilter="artist"
          />
        )}
      </div>
    );
  }

  // Build music player URL - uses Plex web with music context
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
          title="PlexAmp Player"
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
          libraryFilter="artist"
        />
      )}
    </div>
  );
}
