import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Music, Pause, Play, SkipBack, SkipForward, X, Heart, Speaker } from "lucide-react";
import { api } from "../../services/api";
import { cn } from "../../lib/utils";

interface NowPlayingProps {
  className?: string;
}

export function NowPlaying({ className }: NowPlayingProps) {
  const queryClient = useQueryClient();
  const [isDismissed, setIsDismissed] = useState(false);
  const [lastTrackId, setLastTrackId] = useState<string | null>(null);

  // Fetch playback state
  const { data: playback } = useQuery({
    queryKey: ["spotify", "playback", "now-playing"],
    queryFn: () => api.getSpotifyPlayback(),
    refetchInterval: 5000, // Poll every 5 seconds
    staleTime: 3000,
  });

  // Reset dismissed state when track changes
  useEffect(() => {
    if (playback?.item?.id && playback.item.id !== lastTrackId) {
      setLastTrackId(playback.item.id);
      setIsDismissed(false);
    }
  }, [playback?.item?.id, lastTrackId]);

  // Check if current track is saved
  const { data: savedStatus } = useQuery({
    queryKey: ["spotify", "saved", playback?.item?.id],
    queryFn: () => playback?.item?.id ? api.spotifyCheckSavedTracks([playback.item.id]) : Promise.resolve([false]),
    enabled: !!playback?.item?.id,
    staleTime: 30000,
  });

  const isSaved = savedStatus?.[0] ?? false;

  // Playback controls
  const playMutation = useMutation({
    mutationFn: () => api.spotifyPlay(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["spotify", "playback"] }),
  });

  const pauseMutation = useMutation({
    mutationFn: () => api.spotifyPause(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["spotify", "playback"] }),
  });

  const nextMutation = useMutation({
    mutationFn: () => api.spotifyNext(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["spotify", "playback"] }),
  });

  const prevMutation = useMutation({
    mutationFn: () => api.spotifyPrevious(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["spotify", "playback"] }),
  });

  const saveMutation = useMutation({
    mutationFn: () => api.spotifySaveTrack(playback!.item!.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["spotify", "saved"] }),
  });

  const unsaveMutation = useMutation({
    mutationFn: () => api.spotifyUnsaveTrack(playback!.item!.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["spotify", "saved"] }),
  });

  const handleToggleSave = useCallback(() => {
    if (isSaved) {
      unsaveMutation.mutate();
    } else {
      saveMutation.mutate();
    }
  }, [isSaved, saveMutation, unsaveMutation]);

  const handlePlayPause = useCallback(() => {
    if (playback?.is_playing) {
      pauseMutation.mutate();
    } else {
      playMutation.mutate();
    }
  }, [playback?.is_playing, playMutation, pauseMutation]);

  // Don't show if nothing is playing, dismissed, or no track info
  if (!playback || !playback.item || isDismissed) {
    return null;
  }

  const { item, is_playing, progress_ms, device } = playback;
  const albumArt = item.album.images[0]?.url;
  const artistNames = item.artists.map((a) => a.name).join(", ");
  const progressPercent = (progress_ms / item.duration_ms) * 100;
  const deviceName = device?.name;

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-[9999] max-w-sm w-full animate-in slide-in-from-bottom-4 fade-in duration-300",
        className
      )}
    >
      <div className="bg-card/95 backdrop-blur-lg border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Progress bar at top */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-1000 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="p-4">
          <div className="flex items-center gap-4">
            {/* Album art */}
            {albumArt ? (
              <img
                src={albumArt}
                alt={item.album.name}
                className="w-16 h-16 rounded-lg shadow-md object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                <Music className="h-8 w-8 text-muted-foreground" />
              </div>
            )}

            {/* Track info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                {is_playing && (
                  <div className="flex items-center gap-0.5">
                    <span className="w-1 h-3 bg-primary rounded-full animate-pulse" style={{ animationDelay: "0ms" }} />
                    <span className="w-1 h-4 bg-primary rounded-full animate-pulse" style={{ animationDelay: "150ms" }} />
                    <span className="w-1 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: "300ms" }} />
                  </div>
                )}
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  {is_playing ? "Now Playing" : "Paused"}
                </span>
              </div>
              <h4 className="font-semibold text-sm truncate">{item.name}</h4>
              <p className="text-xs text-muted-foreground truncate">{artistNames}</p>
              {deviceName && (
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                  <Speaker className="h-3 w-3" />
                  {deviceName}
                </p>
              )}
            </div>

            {/* Save button */}
            <button
              onClick={handleToggleSave}
              className={`p-1.5 rounded-full transition-colors ${
                isSaved
                  ? "text-red-500 hover:text-red-600"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              aria-label={isSaved ? "Remove from Liked Songs" : "Save to Liked Songs"}
              disabled={saveMutation.isPending || unsaveMutation.isPending}
            >
              <Heart className={`h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
            </button>

            {/* Close button */}
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Playback controls */}
          <div className="flex items-center justify-center gap-2 mt-3">
            <button
              onClick={() => prevMutation.mutate()}
              className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors touch-manipulation"
              aria-label="Previous track"
              disabled={prevMutation.isPending}
            >
              <SkipBack className="h-5 w-5" />
            </button>

            <button
              onClick={handlePlayPause}
              className="p-3 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors touch-manipulation"
              aria-label={is_playing ? "Pause" : "Play"}
              disabled={playMutation.isPending || pauseMutation.isPending}
            >
              {is_playing ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </button>

            <button
              onClick={() => nextMutation.mutate()}
              className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors touch-manipulation"
              aria-label="Next track"
              disabled={nextMutation.isPending}
            >
              <SkipForward className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
