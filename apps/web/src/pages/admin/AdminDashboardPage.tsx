import { useQuery } from "@tanstack/react-query";
import { api, type AdminStats } from "../../services/api";
import { Card } from "../../components/ui/Card";
import { Users, UserCheck, UserPlus, MessageSquare, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { cn } from "../../lib/utils";

const PLAN_COLORS: Record<string, string> = {
  free: "bg-muted-foreground/60",
  starter: "bg-blue-500",
  pro: "bg-primary",
  enterprise: "bg-amber-500",
};

export function AdminDashboardPage() {
  const { data: stats, isLoading, isError, error, refetch } = useQuery<AdminStats>({
    queryKey: ["admin", "stats"],
    queryFn: () => api.getAdminStats(),
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-primary mb-6">Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="h-4 bg-muted rounded w-24 mb-3" />
              <div className="h-8 bg-muted rounded w-16" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-primary mb-6">Dashboard</h1>
        <Card className="p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-1">Failed to load dashboard stats</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {(error as Error)?.message || "The admin stats endpoint returned no data. The database may need migrations."}
          </p>
          <Button variant="outline" className="gap-2" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  const statCards = [
    { label: "Total Users", value: stats.totalUsers, icon: Users },
    { label: "Active (30d)", value: stats.activeUsersLast30d, icon: UserCheck },
    { label: "New (7d)", value: stats.newUsersLast7d, icon: UserPlus },
    { label: "Open Tickets", value: stats.ticketStats.open, icon: MessageSquare },
  ];

  const totalPlanUsers = stats.planDistribution.reduce((sum, p) => sum + p.count, 0);
  const maxSignup = Math.max(...stats.recentSignups.map((s) => s.count), 1);

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-2xl font-bold text-primary mb-6">Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">{stat.label}</span>
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="text-3xl font-bold">{stat.value.toLocaleString()}</div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan Distribution */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-primary mb-4">Plan Distribution</h2>
          <div className="space-y-3">
            {stats.planDistribution.map((plan) => {
              const pct = totalPlanUsers > 0 ? (plan.count / totalPlanUsers) * 100 : 0;
              return (
                <div key={plan.planId}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium capitalize">{plan.planName}</span>
                    <span className="text-muted-foreground">
                      {plan.count} ({pct.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", PLAN_COLORS[plan.planId] || "bg-primary")}
                      style={{ width: `${Math.max(pct, 1)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Recent Signups */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-primary mb-4">Recent Signups (30 days)</h2>
          {stats.recentSignups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No signups in the last 30 days.</p>
          ) : (
            <div className="flex items-end gap-[2px] h-32">
              {stats.recentSignups.map((day) => {
                const height = (day.count / maxSignup) * 100;
                return (
                  <div
                    key={day.date}
                    className="flex-1 bg-primary/70 hover:bg-primary rounded-t transition-colors"
                    style={{ height: `${Math.max(height, 4)}%` }}
                    title={`${day.date}: ${day.count} signup${day.count !== 1 ? "s" : ""}`}
                  />
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Ticket Summary */}
      <Card className="p-5 mt-6">
        <h2 className="text-sm font-semibold text-primary mb-4">Support Tickets</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-amber-500">{stats.ticketStats.open}</div>
            <div className="text-xs text-muted-foreground mt-1">Open</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-500">{stats.ticketStats.inProgress}</div>
            <div className="text-xs text-muted-foreground mt-1">In Progress</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-500">{stats.ticketStats.resolved}</div>
            <div className="text-xs text-muted-foreground mt-1">Resolved</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
