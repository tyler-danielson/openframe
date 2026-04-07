import { useQuery } from "@tanstack/react-query";
import { Trophy, Flame, Check, Circle } from "lucide-react";
import { api } from "../services/api";
import { LevelProgress } from "../components/gamification/LevelProgress";

export function ScoreboardPage() {
  const { data: scoreboard, isLoading } = useQuery({
    queryKey: ["scoreboard"],
    queryFn: () => api.getScoreboard(),
    refetchInterval: 30000, // Auto-refresh every 30s
  });

  if (isLoading || !scoreboard) {
    return (
      <div className="h-screen bg-background flex items-center justify-center text-muted-foreground text-xl">
        Loading scoreboard...
      </div>
    );
  }

  const { familyName, weekLabel, profiles, todayHabits, recentBadges } =
    scoreboard;

  return (
    <div className="h-screen bg-background text-foreground p-6 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Trophy className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold text-primary">
            {familyName} Scoreboard
          </h1>
        </div>
        <span className="text-lg text-muted-foreground">{weekLabel}</span>
      </div>

      <div className="flex-1 grid grid-cols-[1fr_auto] gap-6 min-h-0">
        {/* Left: Profiles + habits */}
        <div className="flex flex-col gap-6 min-h-0">
          {/* Profile cards row */}
          <div className="flex gap-4">
            {profiles.map((profile: any) => (
              <div
                key={profile.profileId}
                className="flex-1 bg-card border border-border rounded-xl p-5 text-center"
              >
                {/* Avatar */}
                <div
                  className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-white text-2xl font-bold mb-3"
                  style={{
                    backgroundColor: profile.profileColor || "#6366f1",
                  }}
                >
                  {profile.profileIcon || profile.profileName?.charAt(0)}
                </div>

                <p className="font-semibold text-lg">{profile.profileName}</p>
                <p className="text-xs text-muted-foreground mb-2">
                  Lv{profile.level} · {profile.levelName}
                </p>

                {/* Points — large */}
                <p className="text-3xl font-bold text-primary mb-2">
                  {profile.points.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mb-3">pts</p>

                {/* Level progress */}
                <LevelProgress
                  level={profile.level}
                  levelName={profile.levelName}
                  progress={profile.levelProgress}
                  compact
                />

                {/* Streak placeholder */}
                {profile.longestStreak > 0 && (
                  <div className="mt-3 flex items-center justify-center gap-1 text-orange-500">
                    <Flame className="h-5 w-5" />
                    <span className="font-semibold">
                      {profile.longestStreak}d streak
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Today's Habits */}
          {todayHabits.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5 flex-1 min-h-0 overflow-auto">
              <h2 className="text-sm font-semibold text-primary mb-3">
                Today's Habits
              </h2>
              <div className="space-y-2">
                {todayHabits.map((habit: any) => (
                  <div
                    key={habit.habitId}
                    className="flex items-center gap-3 py-2"
                  >
                    <span className="text-lg w-8">
                      {habit.habitIcon || "📋"}
                    </span>
                    <span className="font-medium flex-1 min-w-0 truncate">
                      {habit.habitName}
                    </span>
                    <div className="flex gap-2">
                      {habit.completions.map((c: any) => {
                        const profile = profiles.find(
                          (p: any) => p.profileId === c.profileId
                        );
                        return (
                          <div
                            key={c.profileId}
                            className="flex items-center gap-1"
                            title={profile?.profileName}
                          >
                            <span className="text-xs font-medium w-4 text-center">
                              {profile?.profileName?.charAt(0)}
                            </span>
                            {c.completed ? (
                              <Check className="h-4 w-4 text-primary" />
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground/40" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Recent badges */}
        <div className="w-72 bg-card border border-border rounded-xl p-5 overflow-auto">
          <h2 className="text-sm font-semibold text-primary mb-3">
            Recent Badges
          </h2>
          {recentBadges.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No badges earned this week
            </p>
          ) : (
            <div className="space-y-3">
              {recentBadges.map((entry: any, i: number) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg"
                >
                  <span className="text-2xl">{entry.badge.icon}</span>
                  <div>
                    <p className="font-medium text-sm">
                      {entry.profileName}
                    </p>
                    <p className="text-xs text-primary">
                      {entry.badge.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTimeAgo(entry.earnedAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  return "just now";
}
