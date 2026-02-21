import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type AdminUserDetail, type AdminPlan } from "../../services/api";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { ArrowLeft, Calendar, Monitor, Camera } from "lucide-react";
import { cn } from "../../lib/utils";
import { useState } from "react";

const ROLE_OPTIONS = ["admin", "member", "viewer"] as const;

export function AdminUserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery<AdminUserDetail>({
    queryKey: ["admin", "user", userId],
    queryFn: () => api.getAdminUser(userId!),
    enabled: !!userId,
  });

  const { data: plans } = useQuery<AdminPlan[]>({
    queryKey: ["admin", "plans"],
    queryFn: () => api.getAdminPlans(),
  });

  const roleMutation = useMutation({
    mutationFn: (role: string) => api.updateAdminUser(userId!, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "user", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });

  const planMutation = useMutation({
    mutationFn: (planId: string) => api.updateUserPlan(userId!, { planId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "user", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });

  if (isLoading || !user) {
    return (
      <div className="p-6">
        <div className="h-8 bg-muted rounded w-48 animate-pulse mb-6" />
        <div className="h-40 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  const usageItems = [
    { label: "Calendars", icon: Calendar, used: user.usage.calendars, max: user.plan.limits.maxCalendars },
    { label: "Kiosks", icon: Monitor, used: user.usage.kiosks, max: user.plan.limits.maxKiosks },
    { label: "Cameras", icon: Camera, used: user.usage.cameras, max: user.plan.limits.maxCameras },
  ];

  return (
    <div className="p-6 max-w-4xl">
      {/* Back button */}
      <button
        onClick={() => navigate("/admin/users")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Users
      </button>

      {/* User Header */}
      <Card className="p-5 mb-6">
        <div className="flex items-center gap-4">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
              {(user.name || user.email)[0]?.toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-xl font-bold">{user.name || "No name"}</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Member since {new Date(user.createdAt).toLocaleDateString()}
            </p>
          </div>
          {/* Role Selector */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Role</label>
            <select
              value={user.role}
              onChange={(e) => roleMutation.mutate(e.target.value)}
              disabled={roleMutation.isPending}
              className="h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan Card */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-primary mb-4">Plan</h2>
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium capitalize">{user.plan.planName}</span>
              {user.plan.expiresAt && (
                <span className="text-xs text-muted-foreground">
                  Expires: {new Date(user.plan.expiresAt).toLocaleDateString()}
                </span>
              )}
            </div>
            <select
              value={user.plan.planId}
              onChange={(e) => planMutation.mutate(e.target.value)}
              disabled={planMutation.isPending}
              className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {plans?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>Max Kiosks: {user.plan.limits.maxKiosks}</div>
            <div>Max Calendars: {user.plan.limits.maxCalendars}</div>
            <div>Max Cameras: {user.plan.limits.maxCameras}</div>
          </div>
        </Card>

        {/* Usage Card */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-primary mb-4">Usage</h2>
          <div className="space-y-4">
            {usageItems.map((item) => {
              const Icon = item.icon;
              const pct = item.max > 0 ? (item.used / item.max) * 100 : 0;
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span>{item.label}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {item.used} / {item.max}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-amber-500" : "bg-primary"
                      )}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Feature Flags */}
      <Card className="p-5 mt-6">
        <h2 className="text-sm font-semibold text-primary mb-4">Features</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Object.entries(user.plan.limits.features).map(([key, enabled]) => (
            <div
              key={key}
              className={cn(
                "px-3 py-2 rounded-lg text-sm border capitalize",
                enabled
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                  : "bg-muted text-muted-foreground border-border"
              )}
            >
              {key.replace(/([A-Z])/g, " $1").trim()}
              <span className="ml-2 text-xs">{enabled ? "ON" : "OFF"}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
