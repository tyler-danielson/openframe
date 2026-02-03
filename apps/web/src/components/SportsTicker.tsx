import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import type { SportsGame } from "@openframe/shared";

interface SportsTickerProps {
  className?: string;
  variant?: "light" | "dark";
}

function formatGame(game: SportsGame): string {
  const isLive = game.status === "in_progress" || game.status === "halftime";
  const isScheduled = game.status === "scheduled";
  const isFinal = game.status === "final";

  if (isScheduled) {
    const gameTime = new Date(game.startTime).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
    return `${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation} ${gameTime}`;
  }

  if (isLive) {
    const statusText = game.statusDetail || (game.status === "halftime" ? "Half" : "");
    return `🔴 ${game.awayTeam.abbreviation} ${game.awayTeam.score ?? 0} - ${game.homeTeam.abbreviation} ${game.homeTeam.score ?? 0} (${statusText})`;
  }

  if (isFinal) {
    return `${game.awayTeam.abbreviation} ${game.awayTeam.score ?? 0} - ${game.homeTeam.abbreviation} ${game.homeTeam.score ?? 0} (Final)`;
  }

  // Postponed/cancelled
  return `${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation} (${game.status})`;
}

export function SportsTicker({ className = "", variant = "light" }: SportsTickerProps) {
  const { data: games = [] } = useQuery({
    queryKey: ["sports-ticker"],
    queryFn: () => api.getTodaySportsScores(),
    refetchInterval: (query) => {
      const data = query.state.data as SportsGame[] | undefined;
      const hasLiveGames = data?.some(
        (g) => g.status === "in_progress" || g.status === "halftime"
      );
      return hasLiveGames ? 30 * 1000 : 5 * 60 * 1000;
    },
    staleTime: 15 * 1000,
    retry: false,
  });

  if (games.length === 0) {
    return null;
  }

  const bgClass = variant === "dark"
    ? "bg-black/60 backdrop-blur-sm"
    : "bg-muted/80";

  const textClass = variant === "dark"
    ? "text-white/90"
    : "text-foreground";

  return (
    <div className={`overflow-hidden ${bgClass} ${className}`}>
      <div className="ticker-container relative h-7 flex items-center">
        <div
          className={`ticker-content whitespace-nowrap text-sm font-medium ${textClass}`}
          style={{
            animation: `ticker-scroll ${Math.max(40, games.length * 12)}s linear infinite`,
            willChange: "transform",
            paddingLeft: "100vw",
          }}
        >
          {games.map((game, i) => (
            <span key={game.externalId} className="inline-block">
              {formatGame(game)}
              {i < games.length - 1 && <span className="mx-12 text-muted-foreground">•</span>}
            </span>
          ))}
          <span className="inline-block mx-24" />
          {games.map((game, i) => (
            <span key={`dup-${game.externalId}`} className="inline-block">
              {formatGame(game)}
              {i < games.length - 1 && <span className="mx-12 text-muted-foreground">•</span>}
            </span>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes ticker-scroll {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(-50%, 0, 0);
          }
        }
        .ticker-container:hover .ticker-content {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
