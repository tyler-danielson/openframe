import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, LogOut, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../services/api";
import { useAuthStore } from "../../../stores/auth";
import { Card } from "../../../components/ui/Card";
import { CompanionPageHeader } from "../components/CompanionPageHeader";

export function CompanionSettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const { data: calendars, isLoading } = useQuery({
    queryKey: ["companion-calendars"],
    queryFn: () => api.getCalendars(),
    staleTime: 120_000,
  });

  const toggleVisibility = useMutation({
    mutationFn: (cal: any) => api.updateCalendar(cal.id, { isVisible: !cal.isVisible }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companion-calendars"] });
    },
  });

  const handleLogout = () => {
    logout();
    navigate("/companion/login", { replace: true });
  };

  return (
    <div className="flex flex-col h-full">
      <CompanionPageHeader title="Settings" backTo="/companion/more" />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Account */}
        <div>
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wide px-1 mb-2">Account</h3>
          <Card className="p-4">
            <div className="text-sm font-medium text-foreground">{user?.name || "User"}</div>
            <div className="text-xs text-muted-foreground">{user?.email || ""}</div>
          </Card>
        </div>

        {/* Calendar visibility */}
        <div>
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wide px-1 mb-2">
            Calendar Visibility
          </h3>
          <Card className="divide-y divide-border">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : (
              (calendars || []).map((cal: any) => (
                <div key={cal.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: cal.color || "hsl(var(--primary))" }}
                    />
                    <span className="text-sm text-foreground">{cal.name}</span>
                  </div>
                  <button
                    onClick={() => toggleVisibility.mutate(cal)}
                    className="p-1.5 rounded-lg hover:bg-primary/10 transition-colors"
                  >
                    {cal.isVisible ? (
                      <Eye className="h-4 w-4 text-primary" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
              ))
            )}
          </Card>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-xl border border-destructive/30 text-destructive font-medium text-sm hover:bg-destructive/5 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
