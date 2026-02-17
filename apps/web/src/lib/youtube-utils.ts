/** Parse a YouTube URL into a type and ID */
export function parseYouTubeUrl(url: string): { type: string; youtubeId: string } | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace("www.", "");

    if (hostname === "youtu.be") {
      return { type: "video", youtubeId: parsed.pathname.slice(1) };
    }

    if (hostname === "youtube.com" || hostname === "m.youtube.com") {
      if (parsed.pathname === "/watch") {
        const id = parsed.searchParams.get("v");
        if (id) return { type: "video", youtubeId: id };
      } else if (parsed.pathname.startsWith("/playlist")) {
        const id = parsed.searchParams.get("list");
        if (id) return { type: "playlist", youtubeId: id };
      } else if (parsed.pathname.startsWith("/channel/")) {
        const id = parsed.pathname.split("/channel/")[1]?.split("/")[0];
        if (id) return { type: "channel", youtubeId: id };
      } else if (parsed.pathname.startsWith("/@")) {
        return { type: "channel", youtubeId: parsed.pathname.slice(1) };
      } else if (parsed.pathname.startsWith("/live/")) {
        const id = parsed.pathname.split("/live/")[1]?.split("/")[0];
        if (id) return { type: "live", youtubeId: id };
      } else if (parsed.pathname.startsWith("/shorts/")) {
        const id = parsed.pathname.split("/shorts/")[1]?.split("/")[0];
        if (id) return { type: "video", youtubeId: id };
      }
    }
  } catch {
    // Not a valid URL
  }
  return null;
}

/** Build a YouTube embed URL */
export function getYouTubeEmbedUrl(
  videoId: string,
  options: {
    autoPlay?: boolean;
    muted?: boolean;
    showControls?: boolean;
    loop?: boolean;
    playlistId?: string;
  } = {}
): string {
  const { autoPlay = true, muted = true, showControls = true, loop = false, playlistId } = options;

  const params = new URLSearchParams();
  if (autoPlay) params.set("autoplay", "1");
  if (muted) params.set("mute", "1");
  params.set("controls", showControls ? "1" : "0");
  if (loop) {
    params.set("loop", "1");
    params.set("playlist", videoId);
  }
  if (playlistId) {
    params.set("list", playlistId);
  }
  params.set("rel", "0");
  params.set("modestbranding", "1");
  params.set("enablejsapi", "1");

  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

/** Get YouTube thumbnail URL */
export function getYouTubeThumbnailUrl(
  videoId: string,
  quality: "default" | "mq" | "hq" | "sd" | "maxres" = "hq"
): string {
  const qualityMap = {
    default: "default",
    mq: "mqdefault",
    hq: "hqdefault",
    sd: "sddefault",
    maxres: "maxresdefault",
  };
  return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
}

/** Format ISO 8601 duration to human-readable string: "PT5M30S" → "5:30" */
export function formatYouTubeDuration(isoDuration: string | null | undefined): string {
  if (!isoDuration) return "";

  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return isoDuration;

  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** Format view count: "1234567" → "1.2M" */
export function formatViewCount(count: string | undefined): string {
  if (!count) return "";
  const num = parseInt(count, 10);
  if (isNaN(num)) return count;

  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

/** Format relative time: "2024-01-01T00:00:00Z" → "3 months ago" */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffYears > 0) return `${diffYears}y ago`;
  if (diffMonths > 0) return `${diffMonths}mo ago`;
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return "just now";
}
