import { useQuery } from "@tanstack/react-query";
import { api } from "../../../services/api";
import type { WidgetConfigProps } from "./types";

export function IptvConfig({
  config,
  onChange,
}: WidgetConfigProps) {
  const { data: favorites = [] } = useQuery({
    queryKey: ["iptv-favorites"],
    queryFn: () => api.getIptvFavorites(),
    staleTime: 60_000,
  });

  const { data: channels = [] } = useQuery({
    queryKey: ["iptv-channels-all"],
    queryFn: () => api.getIptvChannels(),
    staleTime: 60_000,
  });

  const currentChannelId = config.channelId as string ?? "";
  const favoriteIds = new Set(favorites.map((f) => f.id));
  const nonFavoriteChannels = channels.filter((ch) => !favoriteIds.has(ch.id));

  return (
    <>
      <label className="block">
        <span className="text-sm">Channel</span>
        <select
          value={currentChannelId}
          onChange={(e) => onChange("channelId", e.target.value)}
          className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">Select a channel...</option>
          {favorites.length > 0 && (
            <optgroup label="Favorites">
              {favorites.map((ch) => (
                <option key={ch.id} value={ch.id}>{ch.name}</option>
              ))}
            </optgroup>
          )}
          {nonFavoriteChannels.length > 0 && (
            <optgroup label="All Channels">
              {nonFavoriteChannels.map((ch) => (
                <option key={ch.id} value={ch.id}>{ch.name}</option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      <label className="flex items-center justify-between">
        <span className="text-sm">Show Controls</span>
        <input
          type="checkbox"
          checked={config.showControls as boolean ?? true}
          onChange={(e) => onChange("showControls", e.target.checked)}
          className="rounded"
        />
      </label>
      <label className="flex items-center justify-between">
        <span className="text-sm">Auto Play</span>
        <input
          type="checkbox"
          checked={config.autoPlay as boolean ?? true}
          onChange={(e) => onChange("autoPlay", e.target.checked)}
          className="rounded"
        />
      </label>
      <label className="flex items-center justify-between">
        <span className="text-sm">Muted</span>
        <input
          type="checkbox"
          checked={config.muted as boolean ?? true}
          onChange={(e) => onChange("muted", e.target.checked)}
          className="rounded"
        />
      </label>
    </>
  );
}
