import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../services/api";
import type { WidgetConfigProps } from "./types";

export function AudiobookshelfConfig({
  config,
  onChange,
}: WidgetConfigProps) {
  const { data: servers = [] } = useQuery({
    queryKey: ["audiobookshelf-servers"],
    queryFn: () => api.getAudiobookshelfServers(),
    staleTime: 60_000,
  });

  const serverId = config.serverId as string ?? "";
  const itemId = config.itemId as string ?? "";

  const { data: libraries = [] } = useQuery({
    queryKey: ["abs-libraries", serverId],
    queryFn: () => api.getAudiobookshelfLibraries(serverId),
    enabled: !!serverId,
    staleTime: 60_000,
  });

  const [selectedLibrary, setSelectedLibrary] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["abs-library-items-config", serverId, selectedLibrary],
    queryFn: () => api.getAudiobookshelfItems(serverId, selectedLibrary),
    enabled: !!serverId && !!selectedLibrary,
    staleTime: 60_000,
  });

  return (
    <>
      <label className="block">
        <span className="text-sm">Audiobookshelf Server</span>
        <select
          value={serverId}
          onChange={(e) => { onChange("serverId", e.target.value); onChange("itemId", ""); }}
          className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">Select a server...</option>
          {servers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </label>
      {serverId && (
        <label className="block">
          <span className="text-sm">Library</span>
          <select
            value={selectedLibrary}
            onChange={(e) => setSelectedLibrary(e.target.value)}
            className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Select a library...</option>
            {libraries.map((lib) => (
              <option key={lib.id} value={lib.id}>{lib.name} ({lib.mediaType})</option>
            ))}
          </select>
        </label>
      )}
      {selectedLibrary && items.length > 0 && (
        <label className="block">
          <span className="text-sm">Content</span>
          <select
            value={itemId}
            onChange={(e) => onChange("itemId", e.target.value)}
            className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Select content...</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}{item.authorName ? ` - ${item.authorName}` : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex items-center justify-between">
        <span className="text-sm">Auto Play</span>
        <input
          type="checkbox"
          checked={config.autoPlay as boolean ?? true}
          onChange={(e) => onChange("autoPlay", e.target.checked)}
          className="rounded"
        />
      </label>
    </>
  );
}
