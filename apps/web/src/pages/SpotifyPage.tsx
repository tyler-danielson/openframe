import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Smartphone,
  Speaker,
  Monitor,
  Music,
  ListMusic,
  Search,
  ExternalLink,
} from "lucide-react";
import { api } from "../services/api";
import { Button } from "../components/ui/Button";
import { cn } from "../lib/utils";

export function SpotifyPage() {
  const queryClient = useQueryClient();
  const [volume, setVolume] = useState(50);
  const [progress, setProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"player" | "playlists" | "search">("player");
  const [isSeeking, setIsSeeking] = useState(false);

  // Check connection status
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["spotify-status"],
    queryFn: () => api.getSpotifyStatus(),
  });

  // Get playback state
  const { data: playback, isLoading: playbackLoading } = useQuery({
    queryKey: ["spotify-playback"],
    queryFn: () => api.getSpotifyPlayback(),
    enabled: status?.connected === true,
    refetchInterval: 1000,
  });

  // Get devices
  const { data: devices = [] } = useQuery({
    queryKey: ["spotify-devices"],
    queryFn: () => api.getSpotifyDevices(),
    enabled: status?.connected === true,
    refetchInterval: 5000,
  });

  // Get playlists
  const { data: playlists } = useQuery({
    queryKey: ["spotify-playlists"],
    queryFn: () => api.getSpotifyPlaylists(50),
    enabled: status?.connected === true && activeTab === "playlists",
  });

  // Search
  const { data: searchResults, isLoading: searching } = useQuery({
    queryKey: ["spotify-search", searchQuery],
    queryFn: () => api.searchSpotify(searchQuery, ["track", "playlist"], 20),
    enabled: status?.connected === true && searchQuery.length > 2,
  });

  // Mutations
  const playMutation = useMutation({
    mutationFn: (options?: { contextUri?: string; uris?: string[] }) =>
      api.spotifyPlay(options),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["spotify-playback"] }),
  });

  const pauseMutation = useMutation({
    mutationFn: () => api.spotifyPause(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["spotify-playback"] }),
  });

  const nextMutation = useMutation({
    mutationFn: () => api.spotifyNext(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["spotify-playback"] }),
  });

  const previousMutation = useMutation({
    mutationFn: () => api.spotifyPrevious(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["spotify-playback"] }),
  });

  const shuffleMutation = useMutation({
    mutationFn: (state: boolean) => api.spotifySetShuffle(state),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["spotify-playback"] }),
  });

  const repeatMutation = useMutation({
    mutationFn: (state: "off" | "track" | "context") => api.spotifySetRepeat(state),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["spotify-playback"] }),
  });

  const volumeMutation = useMutation({
    mutationFn: (vol: number) => api.spotifySetVolume(vol),
  });

  const seekMutation = useMutation({
    mutationFn: (positionMs: number) => api.spotifySeek(positionMs),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["spotify-playback"] }),
  });

  const transferMutation = useMutation({
    mutationFn: (deviceId: string) => api.spotifyTransferPlayback(deviceId, true),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["spotify-playback"] }),
  });

  // Update progress bar
  useEffect(() => {
    if (playback?.item && !isSeeking) {
      setProgress(playback.progress_ms);
    }
    if (playback?.device) {
      setVolume(playback.device.volume_percent);
    }
  }, [playback, isSeeking]);

  // Progress tick while playing
  useEffect(() => {
    if (playback?.is_playing && !isSeeking) {
      const interval = setInterval(() => {
        setProgress((p) => p + 1000);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [playback?.is_playing, isSeeking]);

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newPosition = parseInt(e.target.value);
      setProgress(newPosition);
    },
    []
  );

  const handleSeekCommit = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      setIsSeeking(false);
      seekMutation.mutate(progress);
    },
    [progress, seekMutation]
  );

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const cycleRepeat = () => {
    const states: ("off" | "context" | "track")[] = ["off", "context", "track"];
    const currentIndex = states.indexOf(playback?.repeat_state || "off");
    const nextState = states[(currentIndex + 1) % states.length];
    repeatMutation.mutate(nextState);
  };

  const getDeviceIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "smartphone":
        return Smartphone;
      case "speaker":
        return Speaker;
      default:
        return Monitor;
    }
  };

  // Not connected state
  if (statusLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!status?.connected) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10">
          <Music className="h-10 w-10 text-green-500" />
        </div>
        <h2 className="mt-6 text-2xl font-semibold">Connect Spotify</h2>
        <p className="mt-2 text-center text-muted-foreground">
          Connect your Spotify account to control playback from this dashboard.
        </p>
        <a
          href={api.getSpotifyAuthUrl()}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-green-500 px-6 py-3 font-semibold text-white hover:bg-green-600 transition-colors"
        >
          <Music className="h-5 w-5" />
          Connect with Spotify
        </a>
      </div>
    );
  }

  const currentTrack = playback?.item;
  const albumArt = currentTrack?.album?.images?.[0]?.url;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
        <div className="flex items-center gap-3">
          <Music className="h-5 w-5 text-green-500" />
          <h1 className="text-lg font-semibold">Spotify</h1>
          {status.user && (
            <span className="text-sm text-muted-foreground">
              {status.user.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Tabs */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setActiveTab("player")}
              className={cn(
                "px-3 py-1.5 text-sm transition-colors",
                activeTab === "player"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
            >
              Player
            </button>
            <button
              onClick={() => setActiveTab("playlists")}
              className={cn(
                "px-3 py-1.5 text-sm transition-colors",
                activeTab === "playlists"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
            >
              Playlists
            </button>
            <button
              onClick={() => setActiveTab("search")}
              className={cn(
                "px-3 py-1.5 text-sm transition-colors",
                activeTab === "search"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
            >
              Search
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === "player" && (
          <div className="mx-auto max-w-2xl">
            {/* Now Playing */}
            <div className="rounded-xl bg-gradient-to-br from-green-500/10 to-green-500/5 p-6">
              <div className="flex flex-col items-center gap-6 md:flex-row">
                {/* Album Art */}
                <div className="relative h-48 w-48 shrink-0 overflow-hidden rounded-lg shadow-lg">
                  {albumArt ? (
                    <img
                      src={albumArt}
                      alt={currentTrack?.album?.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted">
                      <Music className="h-16 w-16 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Track Info */}
                <div className="flex-1 text-center md:text-left">
                  <h2 className="text-2xl font-bold">
                    {currentTrack?.name || "No track playing"}
                  </h2>
                  <p className="mt-1 text-lg text-muted-foreground">
                    {currentTrack?.artists?.map((a) => a.name).join(", ") || "—"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {currentTrack?.album?.name}
                  </p>

                  {/* Progress Bar */}
                  <div className="mt-4">
                    <input
                      type="range"
                      min={0}
                      max={currentTrack?.duration_ms || 100}
                      value={progress}
                      onChange={handleSeek}
                      onMouseDown={() => setIsSeeking(true)}
                      onMouseUp={handleSeekCommit}
                      onTouchStart={() => setIsSeeking(true)}
                      onTouchEnd={handleSeekCommit}
                      className="w-full accent-green-500"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatTime(progress)}</span>
                      <span>{formatTime(currentTrack?.duration_ms || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Playback Controls */}
              <div className="mt-6 flex items-center justify-center gap-4">
                <button
                  onClick={() => shuffleMutation.mutate(!playback?.shuffle_state)}
                  className={cn(
                    "p-2 rounded-full transition-colors",
                    playback?.shuffle_state
                      ? "text-green-500"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Shuffle className="h-5 w-5" />
                </button>

                <button
                  onClick={() => previousMutation.mutate()}
                  className="p-2 rounded-full text-foreground hover:bg-muted"
                >
                  <SkipBack className="h-6 w-6" />
                </button>

                <button
                  onClick={() =>
                    playback?.is_playing
                      ? pauseMutation.mutate()
                      : playMutation.mutate()
                  }
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors"
                >
                  {playback?.is_playing ? (
                    <Pause className="h-7 w-7" />
                  ) : (
                    <Play className="h-7 w-7 ml-1" />
                  )}
                </button>

                <button
                  onClick={() => nextMutation.mutate()}
                  className="p-2 rounded-full text-foreground hover:bg-muted"
                >
                  <SkipForward className="h-6 w-6" />
                </button>

                <button
                  onClick={cycleRepeat}
                  className={cn(
                    "p-2 rounded-full transition-colors",
                    playback?.repeat_state !== "off"
                      ? "text-green-500"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {playback?.repeat_state === "track" ? (
                    <Repeat1 className="h-5 w-5" />
                  ) : (
                    <Repeat className="h-5 w-5" />
                  )}
                </button>
              </div>

              {/* Volume */}
              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  onClick={() => volumeMutation.mutate(volume === 0 ? 50 : 0)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {volume === 0 ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volume}
                  onChange={(e) => {
                    const newVol = parseInt(e.target.value);
                    setVolume(newVol);
                    volumeMutation.mutate(newVol);
                  }}
                  className="w-32 accent-green-500"
                />
                <span className="w-8 text-xs text-muted-foreground">
                  {volume}%
                </span>
              </div>
            </div>

            {/* Devices */}
            {devices.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-3 font-medium">Available Devices</h3>
                <div className="grid gap-2">
                  {devices.map((device) => {
                    const Icon = getDeviceIcon(device.type);
                    return (
                      <button
                        key={device.id}
                        onClick={() =>
                          !device.is_active && transferMutation.mutate(device.id)
                        }
                        className={cn(
                          "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                          device.is_active
                            ? "border-green-500 bg-green-500/10"
                            : "border-border hover:bg-muted"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-5 w-5",
                            device.is_active ? "text-green-500" : "text-muted-foreground"
                          )}
                        />
                        <span className="flex-1 text-left">{device.name}</span>
                        {device.is_active && (
                          <span className="text-xs text-green-500">Active</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "playlists" && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {playlists?.items?.map((playlist) => (
              <button
                key={playlist.id}
                onClick={() => playMutation.mutate({ contextUri: playlist.uri })}
                className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted transition-colors text-left"
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-muted">
                  {playlist.images?.[0]?.url ? (
                    <img
                      src={playlist.images[0].url}
                      alt={playlist.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ListMusic className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{playlist.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {playlist.tracks.total} tracks
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {activeTab === "search" && (
          <div className="mx-auto max-w-2xl">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for songs or playlists..."
                className="w-full rounded-lg border border-border bg-background py-3 pl-10 pr-4 outline-none focus:border-green-500"
              />
            </div>

            {/* Search Results */}
            {searching && (
              <div className="mt-8 text-center text-muted-foreground">
                Searching...
              </div>
            )}

            {searchResults && (
              <div className="mt-6 space-y-6">
                {/* Tracks */}
                {searchResults.tracks?.items && searchResults.tracks.items.length > 0 && (
                  <div>
                    <h3 className="mb-3 font-medium">Songs</h3>
                    <div className="space-y-2">
                      {searchResults.tracks.items.map((track) => (
                        <button
                          key={track.id}
                          onClick={() =>
                            playMutation.mutate({ uris: [track.uri] })
                          }
                          className="flex w-full items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted transition-colors text-left"
                        >
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
                            {track.album?.images?.[0]?.url ? (
                              <img
                                src={track.album.images[0].url}
                                alt={track.album.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <Music className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium">{track.name}</p>
                            <p className="truncate text-sm text-muted-foreground">
                              {track.artists?.map((a) => a.name).join(", ")}
                            </p>
                          </div>
                          <Play className="h-5 w-5 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Playlists */}
                {searchResults.playlists?.items && searchResults.playlists.items.length > 0 && (
                  <div>
                    <h3 className="mb-3 font-medium">Playlists</h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {searchResults.playlists.items.map((playlist) => (
                        <button
                          key={playlist.id}
                          onClick={() =>
                            playMutation.mutate({ contextUri: playlist.uri })
                          }
                          className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted transition-colors text-left"
                        >
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
                            {playlist.images?.[0]?.url ? (
                              <img
                                src={playlist.images[0].url}
                                alt={playlist.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <ListMusic className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <p className="truncate font-medium flex-1">
                            {playlist.name}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
