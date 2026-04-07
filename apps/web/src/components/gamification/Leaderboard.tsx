import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { LevelProgress } from "./LevelProgress";
import { BadgeDisplay } from "./BadgeDisplay";

const PERIODS = [
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "alltime", label: "All Time" },
] as const;

const RANK_MEDALS = ["🥇", "🥈", "🥉"];

export function Leaderboard() {
  const [period, setPeriod] = useState<string>("weekly");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["leaderboard", period],
    queryFn: () => api.getLeaderboard(period),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading leaderboard...
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-primary">
          Family Leaderboard
        </h2>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                period === p.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-primary"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Entries */}
      {entries.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">No data yet</p>
          <p className="text-sm mt-1">
            Complete habits and goals to earn points!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry: any) => (
            <div
              key={entry.profileId}
              className="bg-card border border-border rounded-xl p-4"
            >
              <div className="flex items-center gap-3">
                {/* Rank */}
                <span className="text-2xl w-10 text-center">
                  {entry.rank <= 3
                    ? RANK_MEDALS[entry.rank - 1]
                    : `${entry.rank}.`}
                </span>

                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                  style={{
                    backgroundColor: entry.profileColor || "#6366f1",
                  }}
                >
                  {entry.profileIcon || entry.profileName?.charAt(0) || "?"}
                </div>

                {/* Name + level */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">
                    {entry.profileName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Level {entry.level} · {entry.levelName}
                  </p>
                </div>

                {/* Points */}
                <div className="text-right">
                  <p className="text-lg font-bold text-primary">
                    {entry.points.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">pts</p>
                </div>
              </div>

              {/* Level progress bar */}
              <div className="mt-3">
                <LevelProgress
                  level={entry.level}
                  levelName={entry.levelName}
                  progress={entry.levelProgress}
                  compact
                />
              </div>

              {/* Badges row */}
              {entry.badges && entry.badges.length > 0 && (
                <div className="mt-2">
                  <BadgeDisplay badges={entry.badges} compact />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
