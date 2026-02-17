import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, type CompanionPermissions } from "../../services/api";
import { useAuthStore } from "../../stores/auth";
import { LogOut, ShieldX, Loader2 } from "lucide-react";

interface CompanionContextValue {
  isOwner: boolean;
  permissions: CompanionPermissions | null;
  isLoading: boolean;
  hasAccess: boolean;
  canViewCalendar: boolean;
  canEditCalendar: boolean;
  canViewTasks: boolean;
  canEditTasks: boolean;
  canViewKiosks: boolean;
  canViewPhotos: boolean;
  canViewIptv: boolean;
  canViewHomeAssistant: boolean;
  canViewNews: boolean;
  canViewWeather: boolean;
  canViewRecipes: boolean;
}

const CompanionCtx = createContext<CompanionContextValue>({
  isOwner: false,
  permissions: null,
  isLoading: true,
  hasAccess: false,
  canViewCalendar: false,
  canEditCalendar: false,
  canViewTasks: false,
  canEditTasks: false,
  canViewKiosks: false,
  canViewPhotos: false,
  canViewIptv: false,
  canViewHomeAssistant: false,
  canViewNews: false,
  canViewWeather: false,
  canViewRecipes: false,
});

export function useCompanion() {
  return useContext(CompanionCtx);
}

export function CompanionProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const accessToken = useAuthStore((s) => s.accessToken);

  const { data, isLoading, error } = useQuery({
    queryKey: ["companion-access-me"],
    queryFn: () => api.getCompanionAccessMe(),
    staleTime: 300_000,
    retry: 1,
    enabled: !!accessToken,
  });

  const isOwner = data?.isOwner ?? false;
  const permissions = data?.permissions ?? null;
  const hasAccess = isOwner || permissions !== null;

  const value: CompanionContextValue = {
    isOwner,
    permissions,
    isLoading,
    hasAccess,
    canViewCalendar: isOwner || (permissions?.accessCalendar !== "none"),
    canEditCalendar: isOwner || (permissions?.accessCalendar === "edit"),
    canViewTasks: isOwner || (permissions?.accessTasks !== "none"),
    canEditTasks: isOwner || (permissions?.accessTasks === "edit"),
    canViewKiosks: isOwner || (permissions?.accessKiosks ?? false),
    canViewPhotos: isOwner || (permissions?.accessPhotos ?? false),
    canViewIptv: isOwner || (permissions?.accessIptv ?? false),
    canViewHomeAssistant: isOwner || (permissions?.accessHomeAssistant ?? false),
    canViewNews: isOwner || (permissions?.accessNews ?? false),
    canViewWeather: isOwner || (permissions?.accessWeather ?? false),
    canViewRecipes: isOwner || (permissions?.accessRecipes ?? false),
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-[100dvh] items-center justify-center bg-background text-foreground gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!hasAccess && !isLoading) {
    return (
      <div className="flex flex-col h-[100dvh] items-center justify-center bg-background text-foreground p-6 gap-4">
        <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldX className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Access Denied</h1>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          You don't have permission to use the companion app. Contact the account owner to request access.
        </p>
        <button
          onClick={() => {
            logout();
            navigate("/companion/login", { replace: true });
          }}
          className="flex items-center gap-2 px-6 py-3 rounded-xl border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/5 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <CompanionCtx.Provider value={value}>
      {children}
    </CompanionCtx.Provider>
  );
}
