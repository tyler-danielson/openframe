import { useMemo } from "react";
import { getYouTubeEmbedUrl } from "../../lib/youtube-utils";

interface YouTubePlayerProps {
  videoId: string;
  autoPlay?: boolean;
  muted?: boolean;
  showControls?: boolean;
  playlistId?: string;
  className?: string;
}

export function YouTubePlayer({
  videoId,
  autoPlay = true,
  muted = false,
  showControls = true,
  playlistId,
  className = "",
}: YouTubePlayerProps) {
  const embedUrl = useMemo(
    () => getYouTubeEmbedUrl(videoId, { autoPlay, muted, showControls, playlistId }),
    [videoId, autoPlay, muted, showControls, playlistId]
  );

  return (
    <iframe
      src={embedUrl}
      className={`w-full h-full ${className}`}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      title="YouTube video player"
      style={{ border: "none" }}
    />
  );
}
