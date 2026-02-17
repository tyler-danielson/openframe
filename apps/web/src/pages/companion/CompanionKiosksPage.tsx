import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Monitor, ChevronRight, Loader2, Wifi } from "lucide-react";
import { api, type Kiosk } from "../../services/api";

const CONTROLLABLE_TYPES = new Set(["iptv", "spotify", "ha-entity", "photo-album", "photo-feed"]);

function countControllableWidgets(kiosk: Kiosk): number {
  const config = kiosk.screensaverLayoutConfig as { widgets?: Array<{ type?: string }> } | null;
  if (!config?.widgets) return 0;
  return config.widgets.filter((w) => w.type && CONTROLLABLE_TYPES.has(w.type)).length;
}

export function CompanionKiosksPage() {
  const navigate = useNavigate();

  const { data: kiosks, isLoading } = useQuery({
    queryKey: ["companion-kiosks"],
    queryFn: () => api.getKiosks(),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!kiosks || kiosks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground px-6 text-center">
        <Monitor className="h-12 w-12 mb-3 opacity-50" />
        <p className="text-lg font-medium">No Kiosks Found</p>
        <p className="text-sm mt-1">Create a kiosk in Settings to get started.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <p className="text-sm text-muted-foreground px-1">Select a kiosk to control</p>
      {kiosks
        .filter((k) => k.isActive)
        .map((kiosk) => {
          const widgetCount = countControllableWidgets(kiosk);
          return (
            <button
              key={kiosk.id}
              onClick={() => navigate(`/companion/kiosks/${kiosk.id}`)}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-primary/20 bg-card hover:bg-primary/5 transition-colors text-left"
            >
              <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-primary/10 shrink-0">
                <Monitor className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground truncate">{kiosk.name}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <Wifi className="h-3 w-3 text-green-500" />
                  <span className="text-xs text-muted-foreground">
                    {widgetCount > 0
                      ? `${widgetCount} controllable widget${widgetCount !== 1 ? "s" : ""}`
                      : "No controllable widgets"}
                  </span>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
            </button>
          );
        })}
    </div>
  );
}
