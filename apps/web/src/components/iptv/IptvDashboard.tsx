import { useMemo } from "react";
import { Star, Clock, Tv, Play, ChevronRight, Trophy } from "lucide-react";
import { cn } from "../../lib/utils";
import type { IptvChannel, SportsGame } from "@openframe/shared";

interface ChannelWithEpg extends IptvChannel {
  currentProgram?: {
    title: string;
    description: string | null;
    startTime: Date;
    endTime: Date;
    progress: number;
  };
  nextProgram?: {
    title: string;
    startTime: Date;
  };
}

interface IptvDashboardProps {
  favorites: IptvChannel[];
  history: IptvChannel[];
  channels: IptvChannel[];
  epg: Record<string, Array<{ id: string; title: string; description: string | null; startTime: string; endTime: string }>>;
  sportsGames: SportsGame[];
  onChannelSelect: (channel: IptvChannel) => void;
  onToggleFavorite: (channelId: string, isFavorite: boolean) => void;
  onViewAllFavorites: () => void;
  onViewAllHistory: () => void;
  onViewGuide: () => void;
}

export function IptvDashboard({
  favorites,
  history,
  channels,
  epg,
  sportsGames,
  onChannelSelect,
  onToggleFavorite,
  onViewAllFavorites,
  onViewAllHistory,
  onViewGuide,
}: IptvDashboardProps) {
  // Calculate what's on now for channels with EPG data
  const whatsOnNow = useMemo(() => {
    const now = new Date();
    const channelsWithEpg: ChannelWithEpg[] = [];
    const favoriteIds = new Set(favorites.map((f) => f.id));

    for (const channel of channels) {
      const channelEpg = epg[channel.id];
      if (!channelEpg || channelEpg.length === 0) continue;

      // Find current program
      const currentProgram = channelEpg.find((entry) => {
        const start = new Date(entry.startTime);
        const end = new Date(entry.endTime);
        return now >= start && now < end;
      });

      if (currentProgram) {
        const start = new Date(currentProgram.startTime);
        const end = new Date(currentProgram.endTime);
        const duration = end.getTime() - start.getTime();
        const elapsed = now.getTime() - start.getTime();
        const progress = Math.min(100, Math.max(0, (elapsed / duration) * 100));

        // Find next program
        const nextProgram = channelEpg.find((entry) => {
          const entryStart = new Date(entry.startTime);
          return entryStart >= end;
        });

        channelsWithEpg.push({
          ...channel,
          currentProgram: {
            title: currentProgram.title,
            description: currentProgram.description,
            startTime: start,
            endTime: end,
            progress,
          },
          nextProgram: nextProgram
            ? {
                title: nextProgram.title,
                startTime: new Date(nextProgram.startTime),
              }
            : undefined,
        });
      }
    }

    // Sort: favorites first, then alphabetically
    return channelsWithEpg
      .sort((a, b) => {
        const aIsFav = favoriteIds.has(a.id);
        const bIsFav = favoriteIds.has(b.id);
        if (aIsFav && !bIsFav) return -1;
        if (!aIsFav && bIsFav) return 1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 50);
  }, [channels, epg, favorites]);

  // Filter sports games to live or upcoming (within 2 hours)
  const relevantSportsGames = useMemo(() => {
    const now = new Date();
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    return sportsGames
      .filter((game) => {
        const startTime = new Date(game.startTime);
        const isLive = game.status === "in_progress" || game.status === "halftime";
        const isUpcoming = game.status === "scheduled" && startTime <= twoHoursFromNow;
        const isRecent = game.status === "final" && startTime >= new Date(now.getTime() - 60 * 60 * 1000);
        return isLive || isUpcoming || isRecent;
      })
      .sort((a, b) => {
        // Live games first
        if (a.status === "in_progress" && b.status !== "in_progress") return -1;
        if (b.status === "in_progress" && a.status !== "in_progress") return 1;
        // Then by start time
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      });
  }, [sportsGames]);

  const hasFavorites = favorites.length > 0;
  const hasHistory = history.length > 0;
  const hasWhatsOn = whatsOnNow.length > 0;
  const hasSports = relevantSportsGames.length > 0;

  if (!hasFavorites && !hasHistory && !hasWhatsOn && !hasSports) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <Tv className="h-16 w-16 text-muted-foreground/50" />
        <h2 className="mt-4 text-xl font-semibold">Welcome to Live TV</h2>
        <p className="mt-2 max-w-md text-muted-foreground">
          Browse channels using the categories on the left, or search for a specific channel.
          Star your favorites for quick access!
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-8">
      {/* Sports Section */}
      {hasSports && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="h-3 w-3 text-yellow-500" />
            <h2 className="text-lg font-semibold">Your Teams</h2>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {relevantSportsGames.map((game) => (
              <SportsGameCard key={game.id} game={game} />
            ))}
          </div>
        </section>
      )}

      {/* Favorites Section - Full Grid */}
      {hasFavorites && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Star className="h-3 w-3 text-yellow-500" />
            <h2 className="text-lg font-semibold">Favorites</h2>
            <span className="text-sm text-muted-foreground">({favorites.length})</span>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12">
            {favorites.map((channel) => (
              <FavoriteChannelCard
                key={channel.id}
                channel={channel}
                onSelect={() => onChannelSelect(channel)}
                onToggleFavorite={() => onToggleFavorite(channel.id, !!channel.isFavorite)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recently Watched Section */}
      {hasHistory && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-primary" />
              <h2 className="text-lg font-semibold">Recently Watched</h2>
            </div>
            <button
              onClick={onViewAllHistory}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              View All
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {history.slice(0, 10).map((channel) => (
              <DashboardChannelCard
                key={channel.id}
                channel={channel}
                onSelect={() => onChannelSelect(channel)}
                onToggleFavorite={() => onToggleFavorite(channel.id, !!channel.isFavorite)}
              />
            ))}
          </div>
        </section>
      )}

      {/* What's On Now Section - Compact List View */}
      {hasWhatsOn && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Tv className="h-3 w-3 text-green-500" />
              <h2 className="text-lg font-semibold">Now Playing</h2>
              <span className="text-sm text-muted-foreground">({whatsOnNow.length})</span>
            </div>
            <button
              onClick={onViewGuide}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              View Guide
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            {whatsOnNow.map((channel, idx) => (
              <NowPlayingRow
                key={channel.id}
                channel={channel}
                onSelect={() => onChannelSelect(channel)}
                isLast={idx === whatsOnNow.length - 1}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// Grid channel card for favorites (matches ChannelGrid style)
function FavoriteChannelCard({
  channel,
  onSelect,
  onToggleFavorite,
}: {
  channel: IptvChannel;
  onSelect: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-lg border bg-card transition-all hover:border-primary/50 hover:shadow-lg"
    >
      {/* Channel logo/image */}
      <button
        onClick={onSelect}
        className="relative aspect-video w-full overflow-hidden bg-muted"
      >
        {channel.logoUrl || channel.streamIcon ? (
          <img
            src={channel.logoUrl || channel.streamIcon || ""}
            alt={channel.name}
            className="h-full w-full object-contain p-2"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-2xl font-bold text-muted-foreground">
            {channel.name.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
          <Play className="h-3 w-3 text-white" />
        </div>
      </button>

      {/* Channel info */}
      <div className="flex items-start justify-between gap-2 p-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium" title={channel.name}>
            {channel.name}
          </h3>
          {channel.categoryName && (
            <p className="truncate text-xs text-muted-foreground">
              {channel.categoryName}
            </p>
          )}
        </div>

        {/* Favorite button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className="shrink-0 rounded p-1 transition-colors hover:bg-muted text-yellow-500"
          title="Remove from favorites"
        >
          <Star className="h-2 w-2 fill-current" />
        </button>
      </div>
    </div>
  );
}

// Horizontal scrolling channel card for history
function DashboardChannelCard({
  channel,
  onSelect,
  onToggleFavorite,
}: {
  channel: IptvChannel;
  onSelect: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <div
      className="group relative flex-shrink-0 w-20 overflow-hidden rounded-lg border bg-card transition-all hover:border-primary/50 hover:shadow-lg cursor-pointer"
      onClick={onSelect}
    >
      {/* Channel logo */}
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {channel.logoUrl || channel.streamIcon ? (
          <img
            src={channel.logoUrl || channel.streamIcon || ""}
            alt={channel.name}
            className="h-full w-full object-contain p-2"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-2xl font-bold text-muted-foreground">
            {channel.name.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
          <Play className="h-3 w-3 text-white" />
        </div>
      </div>

      {/* Channel info */}
      <div className="flex items-start justify-between gap-1 p-2">
        <h3 className="truncate text-sm font-medium flex-1" title={channel.name}>
          {channel.name}
        </h3>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className={cn(
            "shrink-0 rounded p-0.5 transition-colors hover:bg-muted",
            channel.isFavorite ? "text-yellow-500" : "text-muted-foreground"
          )}
        >
          <Star className={cn("h-2 w-2", channel.isFavorite && "fill-current")} />
        </button>
      </div>
    </div>
  );
}

// What's On card with EPG info
function WhatsOnCard({
  channel,
  onSelect,
}: {
  channel: ChannelWithEpg;
  onSelect: () => void;
}) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div
      className="group overflow-hidden rounded-lg border bg-card transition-all hover:border-primary/50 hover:shadow-lg cursor-pointer"
      onClick={onSelect}
    >
      <div className="flex gap-3 p-3">
        {/* Channel logo */}
        <div className="relative h-5 w-5 flex-shrink-0 overflow-hidden rounded-md bg-muted">
          {channel.logoUrl || channel.streamIcon ? (
            <img
              src={channel.logoUrl || channel.streamIcon || ""}
              alt={channel.name}
              className="h-full w-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs font-bold text-muted-foreground">
              {channel.name.charAt(0).toUpperCase()}
            </div>
          )}
          {/* Play overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 rounded-md">
            <Play className="h-2 w-2 text-white" />
          </div>
        </div>

        {/* Program info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">{channel.name}</h3>
          {channel.currentProgram && (
            <>
              <p className="text-sm truncate text-foreground mt-0.5">
                {channel.currentProgram.title}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">
                  {formatTime(channel.currentProgram.startTime)} - {formatTime(channel.currentProgram.endTime)}
                </span>
              </div>
              {/* Progress bar */}
              <div className="mt-2 h-1 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${channel.currentProgram.progress}%` }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Next program */}
      {channel.nextProgram && (
        <div className="border-t border-border px-3 py-2 bg-muted/30">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Next:</span> {channel.nextProgram.title} at{" "}
            {formatTime(channel.nextProgram.startTime)}
          </p>
        </div>
      )}
    </div>
  );
}

// Compact "Now Playing" row for the enhanced list view
function NowPlayingRow({
  channel,
  onSelect,
  isLast,
}: {
  channel: ChannelWithEpg;
  onSelect: () => void;
  isLast: boolean;
}) {
  const formatEndTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors",
        !isLast && "border-b border-border"
      )}
      onClick={onSelect}
    >
      {/* Channel logo */}
      <div className="relative h-2 w-2 flex-shrink-0 overflow-hidden rounded bg-muted">
        {channel.logoUrl || channel.streamIcon ? (
          <img
            src={channel.logoUrl || channel.streamIcon || ""}
            alt={channel.name}
            className="h-full w-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[6px] font-bold text-muted-foreground">
            {channel.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Channel name */}
      <span className="w-28 truncate text-sm font-medium flex-shrink-0">
        {channel.name}
      </span>

      {/* Program title */}
      <span className="flex-1 truncate text-sm text-foreground">
        {channel.currentProgram?.title || "No program info"}
      </span>

      {/* Progress bar */}
      {channel.currentProgram && (
        <div className="w-20 flex-shrink-0">
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${channel.currentProgram.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* End time */}
      {channel.currentProgram && (
        <span className="w-16 text-right text-xs text-muted-foreground flex-shrink-0">
          {formatEndTime(channel.currentProgram.endTime)}
        </span>
      )}

      {/* Play icon on hover */}
      <div className="w-5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Play className="h-2 w-2 text-primary" />
      </div>
    </div>
  );
}

// Sports game card
function SportsGameCard({ game }: { game: SportsGame }) {
  const isLive = game.status === "in_progress" || game.status === "halftime";
  const isFinal = game.status === "final";
  const startTime = new Date(game.startTime);

  const formatGameTime = () => {
    if (isLive) {
      return game.statusDetail || "LIVE";
    }
    if (isFinal) {
      return "Final";
    }
    return startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex-shrink-0 w-32 overflow-hidden rounded-lg border bg-card p-2">
      {/* Status badge */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase">
          {game.league}
        </span>
        <span
          className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full",
            isLive && "bg-red-500/20 text-red-500 animate-pulse",
            isFinal && "bg-muted text-muted-foreground",
            !isLive && !isFinal && "bg-primary/20 text-primary"
          )}
        >
          {formatGameTime()}
        </span>
      </div>

      {/* Teams */}
      <div className="space-y-2">
        {/* Away team */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {game.awayTeam.logo && (
              <img
                src={game.awayTeam.logo}
                alt={game.awayTeam.name}
                className="h-2 w-2 object-contain"
              />
            )}
            <span className="text-sm font-medium">{game.awayTeam.abbreviation}</span>
          </div>
          {(isLive || isFinal) && game.awayTeam.score !== null && (
            <span className="text-lg font-bold">{game.awayTeam.score}</span>
          )}
        </div>

        {/* Home team */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {game.homeTeam.logo && (
              <img
                src={game.homeTeam.logo}
                alt={game.homeTeam.name}
                className="h-2 w-2 object-contain"
              />
            )}
            <span className="text-sm font-medium">{game.homeTeam.abbreviation}</span>
          </div>
          {(isLive || isFinal) && game.homeTeam.score !== null && (
            <span className="text-lg font-bold">{game.homeTeam.score}</span>
          )}
        </div>
      </div>

      {/* Game details */}
      {game.broadcast && (
        <div className="mt-3 pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground truncate">
            <Tv className="inline h-1 w-1 mr-1" />
            {game.broadcast}
          </p>
        </div>
      )}
    </div>
  );
}
