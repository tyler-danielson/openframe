import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { api, type Kiosk } from "../../services/api";
import { IptvControl } from "./controls/IptvControl";
import { SpotifyControl } from "./controls/SpotifyControl";
import { HAEntityControl } from "./controls/HAEntityControl";
import { PhotoControl } from "./controls/PhotoControl";

function findWidget(kiosk: Kiosk, widgetId: string) {
  const config = kiosk.screensaverLayoutConfig as {
    widgets?: Array<{ id?: string; type?: string; config?: Record<string, unknown>; label?: string }>;
  } | null;

  if (!config?.widgets) return null;
  return config.widgets.find((w) => w.id === widgetId) || null;
}

export function CompanionWidgetPage() {
  const { kioskId, widgetId } = useParams<{ kioskId: string; widgetId: string }>();

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

  if (isLoading || !kiosk) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Handle page-level controls (synthetic widget IDs)
  const isPageLevel = widgetId?.startsWith("__page-");
  const widgetType = isPageLevel ? widgetId!.replace("__page-", "") : null;

  // Get widget info from kiosk config
  const widget = isPageLevel ? null : findWidget(kiosk, widgetId!);
  const effectiveType = widgetType || widget?.type;

  // Get current state
  const currentState = (widgetStates || []).find((s) => s.widgetId === widgetId);

  if (!effectiveType) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Widget not found
      </div>
    );
  }

  const commonProps = {
    kioskId: kioskId!,
    widgetId: widgetId!,
    widgetState: currentState?.state,
    config: widget?.config || {},
  };

  switch (effectiveType) {
    case "iptv":
      return <IptvControl {...commonProps} />;
    case "spotify":
      return <SpotifyControl {...commonProps} />;
    case "ha-entity":
      return <HAEntityControl {...commonProps} />;
    case "photo-album":
    case "photo-feed":
      return <PhotoControl {...commonProps} widgetType={effectiveType} />;
    default:
      return (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          No controls available for this widget type
        </div>
      );
  }
}
