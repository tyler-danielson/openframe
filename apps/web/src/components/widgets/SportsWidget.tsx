import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import type { WidgetStyle, FontSizePreset } from "../../stores/screensaver";
import { getFontSizeConfig } from "../../lib/font-size";
import type { SportsGame } from "@openframe/shared";
import { cn } from "../../lib/utils";

interface SportsWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
}

const FONT_SIZE_CLASSES: Record<Exclude<FontSizePreset, "custom">, { team: string; score: string; status: string }> = {
  xs: { team: "text-[10px]", score: "text-xs", status: "text-[8px]" },
  sm: { team: "text-xs", score: "text-sm", status: "text-[10px]" },
  md: { team: "text-sm", score: "text-base", status: "text-xs" },
  lg: { team: "text-base", score: "text-lg", status: "text-sm" },
  xl: { team: "text-lg", score: "text-xl", status: "text-base" },
};

// Scale factors for custom font sizes
const CUSTOM_SCALE = {
  team: 1,
  score: 1.15,
  status: 0.75,
};

export function SportsWidget({ config, style, isBuilder }: SportsWidgetProps) {
  const maxItems = config.maxItems as number ?? 5;
  const showLiveOnly = config.showLiveOnly as boolean ?? false;
  const showScheduled = config.showScheduled as boolean ?? true;
  const headerMode = config.headerMode as string ?? "default";
  const customHeader = config.customHeader as string ?? "";

  // Determine header text based on mode
  const getHeaderText = () => {
    if (headerMode === "hidden") return null;
    if (headerMode === "custom") return customHeader || null;
    return "Sports Scores";
  };
  const headerText = getHeaderText();

  const { data: games = [], isLoading } = useQuery({
    queryKey: ["widget-sports"],
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
    enabled: !isBuilder,
  });

  const filteredGames = games
    .filter((game: SportsGame) => {
      if (showLiveOnly) {
        return game.status === "in_progress" || game.status === "halftime";
      }
      if (!showScheduled && game.status === "scheduled") {
        return false;
      }
      return true;
    })
    .slice(0, maxItems);

  const { preset, isCustom, customValue } = getFontSizeConfig(style);
  const sizeClasses = isCustom ? null : FONT_SIZE_CLASSES[preset];

  // Calculate custom font sizes if using custom mode
  const getCustomFontSize = (scale: number) => {
    if (!customValue) return undefined;
    const value = parseFloat(customValue);
    const unit = customValue.replace(/[\d.]/g, "") || "px";
    return `${value * scale}${unit}`;
  };

  // Mock data for builder preview
  const mockGames = [
    {
      id: "1",
      away: "NYY",
      home: "BOS",
      awayScore: 5,
      homeScore: 3,
      status: "Final",
      isLive: false,
    },
    {
      id: "2",
      away: "LAL",
      home: "GSW",
      awayScore: 98,
      homeScore: 102,
      status: "Q4 2:30",
      isLive: true,
    },
    {
      id: "3",
      away: "KC",
      home: "SF",
      awayScore: null,
      homeScore: null,
      status: "7:00 PM",
      isLive: false,
    },
  ];

  if (isBuilder) {
    return (
      <div
        className={cn(
          "flex h-full flex-col p-4 rounded-lg",
          "bg-black/40 backdrop-blur-sm"
        )}
        style={{ color: style?.textColor || "#ffffff" }}
      >
        {headerText && (
          <div
            className={cn(sizeClasses?.status, "opacity-50 uppercase tracking-wide mb-3")}
            style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.status) } : undefined}
          >
            {headerText}
          </div>
        )}
        <div className="flex-1 space-y-2 overflow-hidden">
          {mockGames.slice(0, maxItems).map((game) => (
            <div key={game.id} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1">
                <span
                  className={cn(sizeClasses?.team, "font-medium")}
                  style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.team) } : undefined}
                >
                  {game.away}
                </span>
                {game.awayScore !== null && (
                  <span
                    className={cn(sizeClasses?.score, "font-bold")}
                    style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.score) } : undefined}
                  >
                    {game.awayScore}
                  </span>
                )}
                <span className="opacity-50">@</span>
                {game.homeScore !== null && (
                  <span
                    className={cn(sizeClasses?.score, "font-bold")}
                    style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.score) } : undefined}
                  >
                    {game.homeScore}
                  </span>
                )}
                <span
                  className={cn(sizeClasses?.team, "font-medium")}
                  style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.team) } : undefined}
                >
                  {game.home}
                </span>
              </div>
              <span
                className={cn(
                  sizeClasses?.status,
                  "flex-shrink-0",
                  game.isLive ? "text-red-400" : "opacity-60"
                )}
                style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.status) } : undefined}
              >
                {game.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className="flex h-full items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <span className="text-sm opacity-50">Loading sports...</span>
      </div>
    );
  }

  if (filteredGames.length === 0) {
    return (
      <div
        className="flex h-full items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <span className="text-sm opacity-50">No games today</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full flex-col p-4 rounded-lg",
        "bg-black/40 backdrop-blur-sm"
      )}
      style={{ color: style?.textColor || "#ffffff" }}
    >
      {headerText && (
        <div
          className={cn(sizeClasses?.status, "opacity-50 uppercase tracking-wide mb-3")}
          style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.status) } : undefined}
        >
          {headerText}
        </div>
      )}
      <div className="flex-1 space-y-2 overflow-hidden">
        {filteredGames.map((game: SportsGame) => {
          const isLive = game.status === "in_progress" || game.status === "halftime";
          const isScheduled = game.status === "scheduled";

          return (
            <div key={game.externalId} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1">
                <span
                  className={cn(sizeClasses?.team, "font-medium")}
                  style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.team) } : undefined}
                >
                  {game.awayTeam.abbreviation}
                </span>
                {!isScheduled && (
                  <span
                    className={cn(sizeClasses?.score, "font-bold")}
                    style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.score) } : undefined}
                  >
                    {game.awayTeam.score ?? 0}
                  </span>
                )}
                <span className="opacity-50">@</span>
                {!isScheduled && (
                  <span
                    className={cn(sizeClasses?.score, "font-bold")}
                    style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.score) } : undefined}
                  >
                    {game.homeTeam.score ?? 0}
                  </span>
                )}
                <span
                  className={cn(sizeClasses?.team, "font-medium")}
                  style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.team) } : undefined}
                >
                  {game.homeTeam.abbreviation}
                </span>
              </div>
              <span
                className={cn(
                  sizeClasses?.status,
                  "flex-shrink-0",
                  isLive ? "text-red-400" : "opacity-60"
                )}
                style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.status) } : undefined}
              >
                {isScheduled
                  ? new Date(game.startTime).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : game.statusDetail || (game.status === "final" ? "Final" : "")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
