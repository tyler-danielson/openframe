import { useQuery } from "@tanstack/react-query";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Music,
  Loader2,
  Clock,
} from "lucide-react";
import { api } from "../../../services/api";

interface SpotifyControlProps {
  kioskId: string;
  widgetId: string;
  widgetState?: Record<string, unknown>;
  config: Record<string, unknown>;
}

export function SpotifyControl({ kioskId, widgetId, widgetState, config }: SpotifyControlProps) {
  // Poll Spotify playback state directly (server-side API)
  const { data: playback, isLoading } = useQuery({
    queryKey: ["companion-spotify-playback"],
    queryFn: () => api.getSpotifyPlayback(),
    refetchInterval: 5000,
  });

  // Fetch recently played tracks
  const { data: recentlyPlayed } = useQuery({
    queryKey: ["companion-spotify-recent"],
    queryFn: () => api.getSpotifyRecentlyPlayed(30),
    staleTime: 30_000,
  });

  const isPlaying = playback?.is_playing ?? false;
  const track = playback?.item;
  const currentTrackId = track?.id;
  const progress = track && playback?.progress_ms != null
    ? (playback.progress_ms / track.duration_ms) * 100
    : 0;

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const formatPlayedAt = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const handlePlay = () => {
    (isPlaying ? api.spotifyPause() : api.spotifyPlay()).catch(() => {});
  };

  const handleNext = () => {
    api.spotifyNext().catch(() => {});
  };

  const handlePrevious = () => {
    api.spotifyPrevious().catch(() => {});
  };

  const handlePlayTrack = (uri: string) => {
    api.spotifyPlay({ uris: [uri] }).catch(() => {});
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Now playing + controls */}
      <div className="flex flex-col items-center p-6 space-y-6 shrink-0">
        {/* Album art */}
        <div className="w-48 h-48 rounded-xl overflow-hidden bg-card shadow-lg">
          {track?.album.images[0] ? (
            <img
              src={track.album.images[0].url}
              alt={track.album.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary/10">
              <Music className="h-16 w-16 text-primary/30" />
            </div>
          )}
        </div>

        {/* Track info */}
        <div className="text-center w-full max-w-xs">
          <div className="font-semibold text-lg text-foreground truncate">
            {track?.name || "Nothing Playing"}
          </div>
          <div className="text-sm text-muted-foreground truncate mt-1">
            {track?.artists.map((a) => a.name).join(", ") || "No artist"}
          </div>
        </div>

        {/* Progress bar */}
        {track && (
          <div className="w-full max-w-xs space-y-1">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatTime(playback?.progress_ms || 0)}</span>
              <span>{formatTime(track.duration_ms)}</span>
            </div>
          </div>
        )}

        {/* Transport controls */}
        <div className="flex items-center gap-8">
          <button
            onClick={handlePrevious}
            className="flex items-center justify-center h-14 w-14 rounded-full bg-primary/10 hover:bg-primary/20 active:bg-primary/30 transition-colors"
          >
            <SkipBack className="h-6 w-6 text-primary" />
          </button>

          <button
            onClick={handlePlay}
            className="flex items-center justify-center h-16 w-16 rounded-full bg-primary hover:bg-primary/90 active:bg-primary/80 transition-colors shadow-lg"
          >
            {isPlaying ? (
              <Pause className="h-7 w-7 text-primary-foreground" />
            ) : (
              <Play className="h-7 w-7 text-primary-foreground ml-0.5" />
            )}
          </button>

          <button
            onClick={handleNext}
            className="flex items-center justify-center h-14 w-14 rounded-full bg-primary/10 hover:bg-primary/20 active:bg-primary/30 transition-colors"
          >
            <SkipForward className="h-6 w-6 text-primary" />
          </button>
        </div>
      </div>

      {/* Recently played section */}
      {recentlyPlayed?.items && recentlyPlayed.items.length > 0 && (
        <div className="flex-1 overflow-y-auto border-t border-border">
          <div className="px-4 py-3 flex items-center gap-2 text-sm font-medium text-muted-foreground sticky top-0 bg-background z-10">
            <Clock className="h-4 w-4" />
            Recently Played
          </div>
          {recentlyPlayed.items.map((item, idx) => {
            const albumArt = item.track.album.images[item.track.album.images.length - 1]?.url;
            const isCurrentTrack = item.track.id === currentTrackId;

            return (
              <button
                key={`${item.track.id}-${idx}`}
                onClick={() => handlePlayTrack(item.track.uri)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  isCurrentTrack
                    ? "bg-primary/10 border-l-2 border-primary"
                    : "hover:bg-primary/5 border-l-2 border-transparent"
                }`}
              >
                {albumArt ? (
                  <img
                    src={albumArt}
                    alt=""
                    className="h-10 w-10 rounded object-cover shrink-0"
                  />
                ) : (
                  <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center shrink-0">
                    <Music className="h-4 w-4 text-primary/60" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm truncate ${
                      isCurrentTrack ? "text-primary font-medium" : "text-foreground"
                    }`}
                  >
                    {item.track.name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {item.track.artists.map((a) => a.name).join(", ")}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatPlayedAt(item.played_at)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
