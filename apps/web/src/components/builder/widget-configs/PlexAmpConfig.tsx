import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../services/api";
import type { WidgetConfigProps } from "./types";

export function PlexAmpConfig({
  config,
  onChange,
}: WidgetConfigProps) {
  const { data: servers = [] } = useQuery({
    queryKey: ["plex-servers"],
    queryFn: () => api.getPlexServers(),
    staleTime: 60_000,
  });

  const serverId = config.serverId as string ?? "";
  const ratingKey = config.ratingKey as string ?? "";

  const { data: libraries = [] } = useQuery({
    queryKey: ["plex-libraries", serverId],
    queryFn: () => api.getPlexLibraries(serverId),
    enabled: !!serverId,
    staleTime: 60_000,
  });

  const musicLibraries = libraries.filter((l) => l.type === "artist");

  const [selectedLibrary, setSelectedLibrary] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["plex-library-items-config", serverId, selectedLibrary],
    queryFn: () => api.getPlexLibraryItems(serverId, selectedLibrary),
    enabled: !!serverId && !!selectedLibrary,
    staleTime: 60_000,
  });

  return (
    <>
      <label className="block">
        <span className="text-sm">Plex Server</span>
        <select
          value={serverId}
          onChange={(e) => { onChange("serverId", e.target.value); onChange("ratingKey", ""); }}
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
          <span className="text-sm">Music Library</span>
          <select
            value={selectedLibrary}
            onChange={(e) => setSelectedLibrary(e.target.value)}
            className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Select a library...</option>
            {musicLibraries.map((lib) => (
              <option key={lib.key} value={lib.key}>{lib.title}</option>
            ))}
          </select>
        </label>
      )}
      {selectedLibrary && items.length > 0 && (
        <label className="block">
          <span className="text-sm">Artist / Album</span>
          <select
            value={ratingKey}
            onChange={(e) => onChange("ratingKey", e.target.value)}
            className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Select music...</option>
            {items.map((item) => (
              <option key={item.ratingKey} value={item.ratingKey}>
                {item.title}
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
