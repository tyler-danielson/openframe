import { useQuery } from "@tanstack/react-query";
import { Medal } from "lucide-react";
import { api } from "../../services/api";
import type { WidgetStyle } from "../../stores/screensaver";

interface LeaderboardWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
  widgetId?: string;
}

const RANK_MEDALS = ["🥇", "🥈", "🥉"];

export function LeaderboardWidget({
  config,
  style,
  isBuilder,
}: LeaderboardWidgetProps) {
  const period = (config.period as string) ?? "weekly";
  const showBadges = (config.showBadges as boolean) ?? true;

  const { data: entries = [] } = useQuery({
    queryKey: ["leaderboard", period],
    queryFn: () => api.getLeaderboard(period),
    enabled: !isBuilder,
  });

  if (isBuilder && entries.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
        <Medal className="h-8 w-8" />
        <span className="text-xs">Leaderboard</span>
      </div>
    );
  }

  return (
    <div className="h-full p-3 flex flex-col gap-2 overflow-hidden">
      <div className="flex items-center gap-1 mb-1">
        <Medal className="h-3 w-3 text-primary" />
        <span className="text-[10px] font-semibold text-primary uppercase">
          {period === "weekly"
            ? "This Week"
            : period === "monthly"
              ? "This Month"
              : "All Time"}
        </span>
      </div>

      {entries.map((entry: any) => (
        <div key={entry.profileId} className="flex items-center gap-2">
          <span className="text-sm w-5 text-center">
            {entry.rank <= 3 ? RANK_MEDALS[entry.rank - 1] : `${entry.rank}.`}
          </span>
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
            style={{ backgroundColor: entry.profileColor || "#6366f1" }}
          >
            {entry.profileIcon || entry.profileName?.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">
              {entry.profileName}
            </p>
            <p className="text-[9px] text-muted-foreground">
              Lv{entry.level}
            </p>
          </div>
          <span className="text-xs font-bold text-primary">
            {entry.points.toLocaleString()}
          </span>

          {showBadges && entry.badges?.length > 0 && (
            <div className="flex gap-0.5">
              {entry.badges.slice(0, 3).map((b: any, i: number) => (
                <span key={i} className="text-xs" title={b.name}>
                  {b.icon}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
