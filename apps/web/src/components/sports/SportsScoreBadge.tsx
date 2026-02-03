import { format } from "date-fns";
import type { SportsGame } from "@openframe/shared";

interface SportsScoreBadgeProps {
  game: SportsGame;
  compact?: boolean;
}

// Format the game time for display
function formatGameTime(startTime: string | Date): string {
  const date = new Date(startTime);
  return format(date, "h:mm a");
}

export function SportsScoreBadge({ game, compact = false }: SportsScoreBadgeProps) {
  const isLive = game.status === "in_progress" || game.status === "halftime";
  const isFinal = game.status === "final";
  const isScheduled = game.status === "scheduled";

  if (compact) {
    // Compact format for calendar header
    // Scheduled: NYG @ PHI 7:00 PM
    // Live: NYG 24-17 PHI | Q4 2:34
    // Final: NYG 24-17 PHI | F
    return (
      <div className="flex items-center gap-1.5 text-sm">
        {/* Away team */}
        {game.awayTeam.logo ? (
          <img
            src={game.awayTeam.logo}
            alt={game.awayTeam.abbreviation}
            className="h-4 w-4 object-contain"
          />
        ) : null}
        <span className="font-medium">{game.awayTeam.abbreviation}</span>

        {isScheduled ? (
          // Scheduled game: show @ and time
          <>
            <span className="text-muted-foreground">@</span>
            <span className="font-medium">{game.homeTeam.abbreviation}</span>
            {game.homeTeam.logo ? (
              <img
                src={game.homeTeam.logo}
                alt={game.homeTeam.abbreviation}
                className="h-4 w-4 object-contain"
              />
            ) : null}
            <span className="ml-1 text-xs text-muted-foreground">
              {formatGameTime(game.startTime)}
            </span>
          </>
        ) : (
          // Live or final: show scores
          <>
            <span className="font-bold">{game.awayTeam.score ?? 0}</span>
            <span className="text-muted-foreground">-</span>
            <span className="font-bold">{game.homeTeam.score ?? 0}</span>
            <span className="font-medium">{game.homeTeam.abbreviation}</span>
            {game.homeTeam.logo ? (
              <img
                src={game.homeTeam.logo}
                alt={game.homeTeam.abbreviation}
                className="h-4 w-4 object-contain"
              />
            ) : null}
            <span
              className={`ml-1 text-xs ${
                isLive ? "text-red-500 font-semibold" : "text-muted-foreground"
              }`}
            >
              {isLive ? game.statusDetail || "LIVE" : isFinal ? "F" : ""}
            </span>
          </>
        )}
      </div>
    );
  }

  // Full format for screensaver
  // Scheduled: NYG @ PHI  7:00 PM
  // Live: NYG 24  Q4 2:34  PHI 17
  // Final: NYG 24  Final  PHI 17
  return (
    <div className="flex items-center justify-between gap-4">
      {/* Away team */}
      <div className="flex items-center gap-2">
        {game.awayTeam.logo ? (
          <img
            src={game.awayTeam.logo}
            alt={game.awayTeam.abbreviation}
            className="h-6 w-6 object-contain"
          />
        ) : (
          <div
            className="h-6 w-6 rounded-full"
            style={{ backgroundColor: game.awayTeam.color || "#6366F1" }}
          />
        )}
        <span className="font-semibold">{game.awayTeam.abbreviation}</span>
        {!isScheduled && (
          <span className="text-2xl font-bold">{game.awayTeam.score ?? 0}</span>
        )}
      </div>

      {/* Status in middle */}
      <div className="text-center">
        {isScheduled ? (
          <div className="text-sm font-medium text-white/70">
            {formatGameTime(game.startTime)}
          </div>
        ) : (
          <div
            className={`text-sm font-medium ${
              isLive ? "text-red-400" : "text-white/70"
            }`}
          >
            {isLive ? game.statusDetail || "LIVE" : isFinal ? "Final" : ""}
          </div>
        )}
      </div>

      {/* Home team */}
      <div className="flex items-center gap-2">
        {!isScheduled && (
          <span className="text-2xl font-bold">{game.homeTeam.score ?? 0}</span>
        )}
        <span className="font-semibold">{game.homeTeam.abbreviation}</span>
        {game.homeTeam.logo ? (
          <img
            src={game.homeTeam.logo}
            alt={game.homeTeam.abbreviation}
            className="h-6 w-6 object-contain"
          />
        ) : (
          <div
            className="h-6 w-6 rounded-full"
            style={{ backgroundColor: game.homeTeam.color || "#6366F1" }}
          />
        )}
      </div>
    </div>
  );
}

// Simplified score display for screensaver clock widget
interface ScreensaverScoreProps {
  game: SportsGame;
}

export function ScreensaverScore({ game }: ScreensaverScoreProps) {
  const isLive = game.status === "in_progress" || game.status === "halftime";
  const isFinal = game.status === "final";
  const isScheduled = game.status === "scheduled";

  if (isScheduled) {
    // Scheduled: NYG @ PHI 7:00 PM
    return (
      <div className="flex items-center justify-center gap-2 text-white">
        <span className="font-semibold">{game.awayTeam.abbreviation}</span>
        <span className="text-white/60">@</span>
        <span className="font-semibold">{game.homeTeam.abbreviation}</span>
        <span className="text-xs text-white/60 ml-1">
          {formatGameTime(game.startTime)}
        </span>
      </div>
    );
  }

  // Live or Final: NYG 24  Q4  PHI 17
  return (
    <div className="flex items-center justify-center gap-2 text-white">
      <span className="font-semibold">{game.awayTeam.abbreviation}</span>
      <span className="font-bold">{game.awayTeam.score ?? 0}</span>
      <span
        className={`text-xs px-2 ${
          isLive ? "text-red-400" : "text-white/60"
        }`}
      >
        {isLive ? game.statusDetail || "LIVE" : isFinal ? "F" : ""}
      </span>
      <span className="font-bold">{game.homeTeam.score ?? 0}</span>
      <span className="font-semibold">{game.homeTeam.abbreviation}</span>
    </div>
  );
}
