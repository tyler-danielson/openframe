import { useState, useEffect, useCallback, useMemo } from "react";
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
  ChevronDown,
  User,
} from "lucide-react";
import { api, type SpotifyAccount } from "../services/api";
import { Button } from "../components/ui/Button";
import { cn } from "../lib/utils";
import { useAuthStore } from "../stores/auth";
import { useCalendarStore } from "../stores/calendar";

// Weather icon helper
function getWeatherIcon(iconCode: string): string {
  const iconMap: Record<string, string> = {
    "01d": "\u2600\uFE0F", "01n": "\uD83C\uDF19",
    "02d": "\u26C5", "02n": "\u26C5",
    "03d": "\u2601\uFE0F", "03n": "\u2601\uFE0F",
    "04d": "\u2601\uFE0F", "04n": "\u2601\uFE0F",
    "09d": "\uD83C\uDF27\uFE0F", "09n": "\uD83C\uDF27\uFE0F",
    "10d": "\uD83C\uDF26\uFE0F", "10n": "\uD83C\uDF27\uFE0F",
    "11d": "\u26C8\uFE0F", "11n": "\u26C8\uFE0F",
    "13d": "\uD83C\uDF28\uFE0F", "13n": "\uD83C\uDF28\uFE0F",
    "50d": "\uD83C\uDF2B\uFE0F", "50n": "\uD83C\uDF2B\uFE0F",
  };
  return iconMap[iconCode] || "\u2600\uFE0F";
}

export function SpotifyPage() {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const kioskEnabled = useAuthStore((state) => state.kioskEnabled);
  const isKioskOnly = kioskEnabled && !isAuthenticated;

  const [volume, setVolume] = useState(50);
  const [progress, setProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(undefined);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timeFade, setTimeFade] = useState(true);

  const { familyName, timeFormat, cycleTimeFormat } = useCalendarStore();

  // Fetch weather data
  const { data: weather } = useQuery({
    queryKey: ["weather-current"],
    queryFn: () => api.getCurrentWeather(),
    refetchInterval: 10 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Fetch hourly forecast for header
  const { data: hourlyForecast } = useQuery({
    queryKey: ["weather-hourly"],
    queryFn: () => api.getHourlyForecast(),
    refetchInterval: 30 * 60 * 1000,
    staleTime: 15 * 60 * 1000,
    retry: false,
  });

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Handle time format change with fade effect
  const handleTimeFormatChange = () => {
    setTimeFade(false);
    setTimeout(() => {
      cycleTimeFormat();
      setTimeFade(true);
    }, 300);
  };

  // Format the time based on user preference
  const formattedTime = useMemo(() => {
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const seconds = currentTime.getSeconds();
    switch (timeFormat) {
      case "12h": {
        const h12 = hours % 12 || 12;
        const ampm = hours >= 12 ? "PM" : "AM";
        return `${h12}:${minutes.toString().padStart(2, "0")} ${ampm}`;
      }
      case "12h-seconds": {
        const h12 = hours % 12 || 12;
        const ampm = hours >= 12 ? "PM" : "AM";
        return `${h12}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")} ${ampm}`;
      }
      case "24h":
        return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
      case "24h-seconds":
        return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
      default:
        return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    }
  }, [currentTime, timeFormat]);

  // Check connection status
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["spotify-status"],
    queryFn: () => api.getSpotifyStatus(),
  });

  // Get all accounts
  const accounts = status?.accounts || [];
  const hasMultipleAccounts = accounts.length > 1;

  // Get selected account (or primary/first)
  const selectedAccount = selectedAccountId
    ? accounts.find((a) => a.id === selectedAccountId)
    : accounts.find((a) => a.isPrimary) || accounts[0];

  // Use selected account ID for API calls
  const accountIdForApi = hasMultipleAccounts ? selectedAccount?.id : undefined;

  // Get playback state
  const { data: playback, isLoading: playbackLoading } = useQuery({
    queryKey: ["spotify-playback", accountIdForApi],
    queryFn: () => api.getSpotifyPlayback(accountIdForApi),
    enabled: status?.connected === true,
    refetchInterval: 1000,
  });

  // Get devices
  const { data: devices = [] } = useQuery({
    queryKey: ["spotify-devices", accountIdForApi],
    queryFn: () => api.getSpotifyDevices(accountIdForApi),
    enabled: status?.connected === true,
    refetchInterval: 5000,
  });

  // Get playlists
  const { data: playlists } = useQuery({
    queryKey: ["spotify-playlists", accountIdForApi],
    queryFn: () => api.getSpotifyPlaylists(50, 0, accountIdForApi),
    enabled: status?.connected === true,
  });

  // Search
  const { data: searchResults, isLoading: searching } = useQuery({
    queryKey: ["spotify-search", searchQuery, accountIdForApi],
    queryFn: () => api.searchSpotify(searchQuery, ["track", "playlist"], 20, accountIdForApi),
    enabled: status?.connected === true && searchQuery.length > 2,
  });

  // Mutations
  const playMutation = useMutation({
    mutationFn: (options?: { contextUri?: string; uris?: string[] }) =>
      api.spotifyPlay({ ...options, accountId: accountIdForApi }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["spotify-playback", accountIdForApi] }),
  });

  const pauseMutation = useMutation({
    mutationFn: () => api.spotifyPause(accountIdForApi),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["spotify-playback", accountIdForApi] }),
  });

  const nextMutation = useMutation({
    mutationFn: () => api.spotifyNext(accountIdForApi),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["spotify-playback", accountIdForApi] }),
  });

  const previousMutation = useMutation({
    mutationFn: () => api.spotifyPrevious(accountIdForApi),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["spotify-playback", accountIdForApi] }),
  });

  const shuffleMutation = useMutation({
    mutationFn: (state: boolean) => api.spotifySetShuffle(state, accountIdForApi),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["spotify-playback", accountIdForApi] }),
  });

  const repeatMutation = useMutation({
    mutationFn: (state: "off" | "track" | "context") => api.spotifySetRepeat(state, accountIdForApi),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["spotify-playback", accountIdForApi] }),
  });

  const volumeMutation = useMutation({
    mutationFn: (vol: number) => api.spotifySetVolume(vol, accountIdForApi),
  });

  const seekMutation = useMutation({
    mutationFn: (positionMs: number) => api.spotifySeek(positionMs, accountIdForApi),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["spotify-playback", accountIdForApi] }),
  });

  const transferMutation = useMutation({
    mutationFn: (deviceId: string) => api.spotifyTransferPlayback(deviceId, true, accountIdForApi),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["spotify-playback", accountIdForApi] }),
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
    const states: readonly ["off", "context", "track"] = ["off", "context", "track"];
    const currentState = playback?.repeat_state ?? "off";
    const currentIndex = states.indexOf(currentState);
    const nextIndex = (currentIndex + 1) % states.length;
    const nextState = states[nextIndex] ?? "off";
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
        <div className="animate-pulse text-gray-600 dark:text-gray-300">Loading...</div>
      </div>
    );
  }

  if (!status?.connected) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10">
          <Music className="h-10 w-10 text-green-500" />
        </div>
        {isKioskOnly ? (
          <>
            <h2 className="mt-6 text-2xl font-semibold text-gray-900 dark:text-gray-100">Spotify Not Configured</h2>
            <p className="mt-2 text-center text-gray-600 dark:text-gray-300">
              Spotify needs to be connected in Settings by an administrator.
            </p>
          </>
        ) : (
          <>
            <h2 className="mt-6 text-2xl font-semibold text-gray-900 dark:text-gray-100">Connect Spotify</h2>
            <p className="mt-2 text-center text-gray-600 dark:text-gray-300">
              Connect your Spotify account to control playback from this dashboard.
            </p>
            <a
              href={api.getSpotifyAuthUrl()}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-green-500 px-6 py-3 font-semibold text-white hover:bg-green-600 transition-colors"
            >
              <Music className="h-5 w-5" />
              Connect with Spotify
            </a>
          </>
        )}
      </div>
    );
  }

  const currentTrack = playback?.item;
  const albumArt = currentTrack?.album?.images?.[0]?.url;

  // Filter devices to show only favorites/default/active
  const favoriteDevices = devices.filter((device) => {
    const isDefault = selectedAccount?.defaultDeviceId === device.id;
    const isFavorite = selectedAccount?.favoriteDeviceIds?.includes(device.id) || false;
    return device.is_active || isDefault || isFavorite;
  });

  return (
    <div className="flex h-full flex-col">
      {/* Main Navigation Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-1.5 shrink-0 overflow-hidden">
        <div className="flex items-center gap-[clamp(0.5rem,1vw,1rem)] min-w-0 flex-1 whitespace-nowrap">
          <button
            onClick={handleTimeFormatChange}
            className={`text-[clamp(0.875rem,2vw,1.5rem)] font-semibold text-muted-foreground hover:text-foreground transition-opacity duration-300 ${
              timeFade ? "opacity-100" : "opacity-0"
            }`}
            title="Click to change time format"
          >
            {formattedTime}
          </button>
          {weather && (
            <div className="flex items-center gap-[clamp(0.25rem,0.5vw,0.5rem)] text-muted-foreground" title={weather.description}>
              <span className="text-[clamp(1rem,2.5vw,1.75rem)]">{getWeatherIcon(weather.icon)}</span>
              <span className="text-[clamp(0.875rem,2vw,1.5rem)] font-semibold">{weather.temp}°</span>
            </div>
          )}
          {hourlyForecast && hourlyForecast.length > 0 && (
            <div className="flex items-center gap-[clamp(0.5rem,1vw,1rem)] text-muted-foreground">
              {hourlyForecast.slice(0, 4).map((hour, i) => (
                <div key={i} className="flex flex-col items-center text-[clamp(0.5rem,1vw,0.75rem)] leading-tight">
                  <div className="flex items-center gap-0.5">
                    <span className="text-[clamp(0.625rem,1.25vw,1rem)]">{getWeatherIcon(hour.icon)}</span>
                    <span>{hour.temp}°</span>
                  </div>
                  <span className="-mt-0.5">{hour.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <h2 className="text-[clamp(0.75rem,1.5vw,1.125rem)] font-semibold">Music</h2>
        </div>
      </div>

      {/* Spotify Controls Header */}
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
        <div className="flex items-center gap-3">
          <Music className="h-5 w-5 text-green-500" />
          <h1 className="text-lg font-semibold">Spotify</h1>

          {/* Account Selector */}
          {hasMultipleAccounts ? (
            <div className="relative">
              <button
                onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
              >
                {selectedAccount?.icon ? (
                  <span className="text-base">{selectedAccount.icon}</span>
                ) : selectedAccount?.spotifyUser?.images?.[0]?.url ? (
                  <img
                    src={selectedAccount.spotifyUser.images[0].url}
                    alt=""
                    className="h-5 w-5 rounded-full"
                  />
                ) : (
                  <User className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                )}
                <span>
                  {selectedAccount?.accountName ||
                    selectedAccount?.spotifyUser?.display_name ||
                    "Select Account"}
                </span>
                <ChevronDown className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              </button>

              {showAccountDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowAccountDropdown(false)}
                  />
                  <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-border bg-card shadow-lg">
                    {accounts.map((account) => (
                      <button
                        key={account.id}
                        onClick={() => {
                          setSelectedAccountId(account.id);
                          setShowAccountDropdown(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted transition-colors first:rounded-t-lg last:rounded-b-lg",
                          account.id === selectedAccount?.id && "bg-muted"
                        )}
                      >
                        {account.icon ? (
                          <span className="text-lg">{account.icon}</span>
                        ) : account.spotifyUser?.images?.[0]?.url ? (
                          <img
                            src={account.spotifyUser.images[0].url}
                            alt=""
                            className="h-6 w-6 rounded-full"
                          />
                        ) : (
                          <User className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium">
                            {account.accountName ||
                              account.spotifyUser?.display_name ||
                              "Unknown"}
                          </p>
                          {account.isPrimary && (
                            <p className="text-xs text-green-500">Primary</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : status.user ? (
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {status.user.name}
            </span>
          ) : null}
        </div>
      </header>

      {/* Content - Two column layout */}
      <div className="flex-1 overflow-auto p-4">
        <div className="flex gap-6 h-full">
          {/* Left Column - Player & Speakers */}
          <div className="w-80 shrink-0 flex flex-col gap-4">
            {/* Now Playing - Compact */}
            <div className="rounded-xl bg-gradient-to-br from-green-500/10 to-green-500/5 p-4">
              {/* Album Art & Track Info */}
              <div className="flex items-center gap-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg shadow-lg">
                  {albumArt ? (
                    <img
                      src={albumArt}
                      alt={currentTrack?.album?.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gray-200 dark:bg-gray-700">
                      <Music className="h-8 w-8 text-gray-500 dark:text-gray-400" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">
                    {currentTrack?.name || "No track playing"}
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                    {currentTrack?.artists?.map((a) => a.name).join(", ") || "—"}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-3">
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
                <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                  <span>{formatTime(progress)}</span>
                  <span>{formatTime(currentTrack?.duration_ms || 0)}</span>
                </div>
              </div>

              {/* Playback Controls */}
              <div className="mt-3 flex items-center justify-center gap-2">
                <button
                  onClick={() => shuffleMutation.mutate(!playback?.shuffle_state)}
                  className={cn(
                    "p-1.5 rounded-full transition-colors",
                    playback?.shuffle_state
                      ? "text-green-500"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                  )}
                >
                  <Shuffle className="h-4 w-4" />
                </button>

                <button
                  onClick={() => previousMutation.mutate()}
                  className="p-1.5 rounded-full text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  <SkipBack className="h-5 w-5" />
                </button>

                <button
                  onClick={() =>
                    playback?.is_playing
                      ? pauseMutation.mutate()
                      : playMutation.mutate({})
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors"
                >
                  {playback?.is_playing ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5 ml-0.5" />
                  )}
                </button>

                <button
                  onClick={() => nextMutation.mutate()}
                  className="p-1.5 rounded-full text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  <SkipForward className="h-5 w-5" />
                </button>

                <button
                  onClick={cycleRepeat}
                  className={cn(
                    "p-1.5 rounded-full transition-colors",
                    playback?.repeat_state !== "off"
                      ? "text-green-500"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                  )}
                >
                  {playback?.repeat_state === "track" ? (
                    <Repeat1 className="h-4 w-4" />
                  ) : (
                    <Repeat className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* Volume */}
              <div className="mt-3 flex items-center justify-center gap-2">
                <button
                  onClick={() => volumeMutation.mutate(volume === 0 ? 50 : 0)}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                >
                  {volume === 0 ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
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
                  className="w-24 accent-green-500"
                />
                <span className="w-8 text-xs text-gray-600 dark:text-gray-400">
                  {volume}%
                </span>
              </div>
            </div>

            {/* Speakers Grid */}
            {favoriteDevices.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">Speakers</h3>
                <div className="grid grid-cols-2 gap-2">
                  {favoriteDevices
                    .sort((a, b) => {
                      const aIsDefault = selectedAccount?.defaultDeviceId === a.id;
                      const bIsDefault = selectedAccount?.defaultDeviceId === b.id;
                      if (aIsDefault && !bIsDefault) return -1;
                      if (!aIsDefault && bIsDefault) return 1;
                      if (a.is_active && !b.is_active) return -1;
                      if (!a.is_active && b.is_active) return 1;
                      return a.name.localeCompare(b.name);
                    })
                    .map((device) => {
                      const Icon = getDeviceIcon(device.type);
                      return (
                        <button
                          key={device.id}
                          onClick={() =>
                            !device.is_active && transferMutation.mutate(device.id)
                          }
                          className={cn(
                            "flex flex-col items-center gap-1 rounded-lg border p-3 transition-colors text-center",
                            device.is_active
                              ? "border-green-500 bg-green-100 dark:bg-green-900/30"
                              : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-6 w-6",
                              device.is_active ? "text-green-500" : "text-gray-600 dark:text-gray-400"
                            )}
                          />
                          <span className="text-xs text-gray-900 dark:text-gray-100 truncate w-full">
                            {device.name}
                          </span>
                          {device.is_active && (
                            <span className="text-[10px] text-green-500">Playing</span>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Playlists & Search */}
          <div className="flex-1 min-w-0 flex flex-col">
            {/* Search Toggle & Input */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSearch(e.target.value.length > 0);
                  }}
                  placeholder="Search for songs or playlists..."
                  className="w-full rounded-lg border border-border bg-white dark:bg-gray-800 py-2 pl-10 pr-4 outline-none focus:border-green-500 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* Search Results or Playlists */}
            <div className="flex-1 overflow-auto">
              {showSearch && searchQuery.length > 2 ? (
                <div className="space-y-4">
                  {searching && (
                    <div className="text-center text-gray-600 dark:text-gray-300">
                      Searching...
                    </div>
                  )}

                  {searchResults && (
                    <>
                      {/* Tracks */}
                      {searchResults.tracks?.items && searchResults.tracks.items.length > 0 && (
                        <div>
                          <h3 className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">Songs</h3>
                          <div className="space-y-1">
                            {searchResults.tracks.items.slice(0, 10).map((track) => (
                              <button
                                key={track.id}
                                onClick={() =>
                                  playMutation.mutate({ uris: [track.uri] })
                                }
                                className="flex w-full items-center gap-3 rounded-lg border border-border bg-white dark:bg-gray-800 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                              >
                                <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-gray-200 dark:bg-gray-700">
                                  {track.album?.images?.[0]?.url ? (
                                    <img
                                      src={track.album.images[0].url}
                                      alt={track.album.name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center">
                                      <Music className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{track.name}</p>
                                  <p className="truncate text-xs text-gray-600 dark:text-gray-400">
                                    {track.artists?.map((a) => a.name).join(", ")}
                                  </p>
                                </div>
                                <Play className="h-4 w-4 text-gray-500 dark:text-gray-400 shrink-0" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Search Playlists */}
                      {searchResults.playlists?.items && searchResults.playlists.items.length > 0 && (
                        <div>
                          <h3 className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">Playlists</h3>
                          <div className="grid gap-2 grid-cols-2 lg:grid-cols-3">
                            {searchResults.playlists.items.slice(0, 6).map((playlist) => (
                              <button
                                key={playlist.id}
                                onClick={() =>
                                  playMutation.mutate({ contextUri: playlist.uri })
                                }
                                className="flex items-center gap-2 rounded-lg border border-border bg-white dark:bg-gray-800 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                              >
                                <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-gray-200 dark:bg-gray-700">
                                  {playlist.images?.[0]?.url ? (
                                    <img
                                      src={playlist.images[0].url}
                                      alt={playlist.name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center">
                                      <ListMusic className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                                    </div>
                                  )}
                                </div>
                                <p className="truncate text-sm font-medium flex-1 text-gray-900 dark:text-gray-100">
                                  {playlist.name}
                                </p>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                /* Playlists Grid */
                <div>
                  <h3 className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">Your Playlists</h3>
                  <div className="grid gap-2 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {playlists?.items?.map((playlist) => (
                      <button
                        key={playlist.id}
                        onClick={() => playMutation.mutate({ contextUri: playlist.uri })}
                        className="flex flex-col items-center gap-2 rounded-lg border border-border bg-white dark:bg-gray-800 p-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-center"
                      >
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded bg-gray-200 dark:bg-gray-700">
                          {playlist.images?.[0]?.url ? (
                            <img
                              src={playlist.images[0].url}
                              alt={playlist.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <ListMusic className="h-8 w-8 text-gray-500 dark:text-gray-400" />
                            </div>
                          )}
                        </div>
                        <div className="w-full min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{playlist.name}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {playlist.tracks.total} tracks
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
