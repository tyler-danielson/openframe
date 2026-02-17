import { useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Tv,
  Music,
  Zap,
  Image,
  LayoutGrid,
  ChevronRight,
  Loader2,
  RefreshCw,
  Maximize,
  Moon,
} from "lucide-react";
import { api, type Kiosk } from "../../services/api";

// Controllable widget types
const CONTROLLABLE_TYPES = new Set(["iptv", "spotify", "ha-entity", "photo-album", "photo-feed"]);

const WIDGET_ICONS: Record<string, React.ElementType> = {
  iptv: Tv,
  spotify: Music,
  "ha-entity": Zap,
  "photo-album": Image,
  "photo-feed": LayoutGrid,
};

const WIDGET_LABELS: Record<string, string> = {
  iptv: "IPTV",
  spotify: "Spotify",
  "ha-entity": "HA Entity",
  "photo-album": "Photo Album",
  "photo-feed": "Photo Feed",
};

interface WidgetInfo {
  id: string;
  type: string;
  label: string;
  config: Record<string, unknown>;
}

function extractControllableWidgets(kiosk: Kiosk): WidgetInfo[] {
  const config = kiosk.screensaverLayoutConfig as {
    widgets?: Array<{ id?: string; type?: string; config?: Record<string, unknown>; label?: string }>;
  } | null;
  if (!config?.widgets) return [];

  return config.widgets
    .filter((w) => w.type && w.id && CONTROLLABLE_TYPES.has(w.type))
    .map((w) => ({
      id: w.id!,
      type: w.type!,
      label: w.label || WIDGET_LABELS[w.type!] || w.type!,
      config: w.config || {},
    }));
}

// Features that can be controlled at the page level (not just screensaver widgets)
function getPageLevelControls(kiosk: Kiosk): WidgetInfo[] {
  const features = kiosk.enabledFeatures;
  if (!features) return [];

  const controls: WidgetInfo[] = [];

  if (features.iptv) {
    controls.push({
      id: "__page-iptv",
      type: "iptv",
      label: "IPTV (Full Page)",
      config: {},
    });
  }

  if (features.spotify) {
    controls.push({
      id: "__page-spotify",
      type: "spotify",
      label: "Spotify Player",
      config: {},
    });
  }

  return controls;
}

export function CompanionKioskPage() {
  const { kioskId } = useParams<{ kioskId: string }>();
  const navigate = useNavigate();
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: kiosk, isLoading } = useQuery({
    queryKey: ["companion-kiosk", kioskId],
    queryFn: () => api.getKiosk(kioskId!),
    enabled: !!kioskId,
    staleTime: 30_000,
  });

  const { data: widgetStates } = useQuery({
    queryKey: ["companion-widget-state", kioskId],
    queryFn: () => api.getKioskWidgetState(kioskId!),
    enabled: !!kioskId,
    refetchInterval: 3000,
  });

  // Send companion ping every 30s to activate fast polling on kiosk
  useEffect(() => {
    if (!kioskId) return;

    // Initial ping
    api.companionPing(kioskId).catch(() => {});

    pingRef.current = setInterval(() => {
      api.companionPing(kioskId).catch(() => {});
    }, 30000);

    return () => {
      if (pingRef.current) clearInterval(pingRef.current);
    };
  }, [kioskId]);

  if (isLoading || !kiosk) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const widgets = extractControllableWidgets(kiosk);
  const pageControls = getPageLevelControls(kiosk);
  // Merge, avoiding duplicates (e.g., if there's already an IPTV widget, don't show page-level IPTV)
  const widgetTypes = new Set(widgets.map((w) => w.type));
  const filteredPageControls = pageControls.filter((pc) => !widgetTypes.has(pc.type));

  const allControls = [...widgets, ...filteredPageControls];

  // Build a state lookup
  const stateMap = new Map(
    (widgetStates || []).map((s) => [s.widgetId, s])
  );

  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">{kiosk.name}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {allControls.length} controllable{" "}
          {allControls.length === 1 ? "item" : "items"}
        </p>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2">
        <button
          onClick={() => api.sendKioskCommand(kioskId!, { type: "refresh" }).catch(() => {})}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-card border border-border text-sm font-medium text-foreground hover:bg-primary/5 transition-colors min-h-[44px]"
        >
          <RefreshCw className="h-4 w-4 text-primary" />
          Refresh
        </button>
        <button
          onClick={() => api.sendKioskCommand(kioskId!, { type: "fullscreen" }).catch(() => {})}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-card border border-border text-sm font-medium text-foreground hover:bg-primary/5 transition-colors min-h-[44px]"
        >
          <Maximize className="h-4 w-4 text-primary" />
          Fullscreen
        </button>
        <button
          onClick={() => api.sendKioskCommand(kioskId!, { type: "screensaver" }).catch(() => {})}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-card border border-border text-sm font-medium text-foreground hover:bg-primary/5 transition-colors min-h-[44px]"
        >
          <Moon className="h-4 w-4 text-primary" />
          Screen
        </button>
      </div>

      {allControls.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No controllable widgets on this kiosk.</p>
          <p className="text-sm mt-1">
            Add IPTV, Spotify, HA Entity, or Photo widgets in the screensaver builder.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {allControls.map((widget) => {
            const Icon = WIDGET_ICONS[widget.type] || Tv;
            const ws = stateMap.get(widget.id);
            const statePreview = getStatePreview(widget.type, ws?.state);

            return (
              <button
                key={widget.id}
                onClick={() =>
                  navigate(`/companion/kiosks/${kioskId}/widget/${widget.id}`)
                }
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-primary/20 bg-card hover:bg-primary/5 transition-colors text-left"
              >
                <div className="flex items-center justify-center h-11 w-11 rounded-lg bg-primary/10 shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground truncate">
                    {widget.label}
                  </div>
                  {statePreview && (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {statePreview}
                    </div>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getStatePreview(
  type: string,
  state: Record<string, unknown> | undefined
): string | null {
  if (!state) return null;

  switch (type) {
    case "iptv":
      return state.channelName
        ? `${state.channelName}${state.isMuted ? " (muted)" : ""}`
        : null;
    case "spotify":
      return state.trackName
        ? `${state.trackName} - ${state.artistName}`
        : null;
    case "ha-entity":
      return state.friendlyName
        ? `${state.friendlyName}: ${state.state}`
        : null;
    case "photo-album":
    case "photo-feed":
      return state.currentIndex != null
        ? `Photo ${Number(state.currentIndex) + 1} of ${state.totalPhotos}`
        : null;
    default:
      return null;
  }
}
