import { useQuery } from "@tanstack/react-query";
import { api } from "../../../services/api";
import type { WidgetConfigProps } from "./types";

export function YouTubeConfig({
  config,
  onChange,
}: WidgetConfigProps) {
  const { data: bookmarks = [] } = useQuery({
    queryKey: ["youtube-bookmarks"],
    queryFn: () => api.getYoutubeBookmarks(),
    staleTime: 60_000,
  });

  const currentVideoId = config.videoId as string ?? "";

  return (
    <>
      <label className="block">
        <span className="text-sm">Video ID or URL</span>
        <input
          type="text"
          value={currentVideoId}
          onChange={(e) => {
            const val = e.target.value.trim();
            // Try to extract video ID from URL
            const match = val.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
            onChange("videoId", match ? match[1] : val);
          }}
          className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
          placeholder="Enter video ID or paste URL..."
        />
      </label>
      {bookmarks.length > 0 && (
        <label className="block">
          <span className="text-sm">Or select from bookmarks</span>
          <select
            value={currentVideoId}
            onChange={(e) => onChange("videoId", e.target.value)}
            className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Select a bookmark...</option>
            {bookmarks.map((b) => (
              <option key={b.youtubeId} value={b.youtubeId}>{b.title}</option>
            ))}
          </select>
        </label>
      )}
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
