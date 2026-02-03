import { useState, useEffect } from "react";
import { Camera } from "lucide-react";
import { api } from "../../services/api";
import { useHAWebSocket } from "../../stores/homeassistant-ws";
import type { WidgetStyle } from "../../stores/screensaver";
import { cn } from "../../lib/utils";

interface HACameraWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
}

export function HACameraWidget({ config, style, isBuilder }: HACameraWidgetProps) {
  const entityId = config.entityId as string ?? "";
  const refreshInterval = config.refreshInterval as number ?? 10;

  const { connected } = useHAWebSocket();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!entityId || isBuilder || !connected) return;

    const fetchSnapshot = async () => {
      try {
        const blob = await api.getHomeAssistantCameraSnapshot(entityId);
        const url = URL.createObjectURL(blob);
        setImageUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        setError(null);
      } catch (err) {
        console.error("Failed to fetch camera snapshot:", err);
        setError("Failed to load camera");
      }
    };

    fetchSnapshot();
    const interval = setInterval(fetchSnapshot, refreshInterval * 1000);

    return () => {
      clearInterval(interval);
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [entityId, refreshInterval, isBuilder, connected]);

  if (isBuilder || !entityId) {
    return (
      <div
        className={cn(
          "flex h-full flex-col items-center justify-center p-4 rounded-lg",
          "bg-black/40 backdrop-blur-sm"
        )}
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <Camera className="h-12 w-12 opacity-50 mb-2" />
        <span className="text-sm opacity-70">{entityId || "HA Camera"}</span>
        {isBuilder && (
          <span className="text-xs opacity-50 mt-1">Live feed in preview mode</span>
        )}
      </div>
    );
  }

  if (!connected) {
    return (
      <div
        className="flex h-full items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <span className="text-sm opacity-50">HA not connected</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <Camera className="h-8 w-8 opacity-50 mb-2" />
        <span className="text-sm opacity-50">{error}</span>
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div
        className="flex h-full items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <span className="text-sm opacity-50">Loading camera...</span>
      </div>
    );
  }

  return (
    <div className="h-full w-full rounded-lg overflow-hidden">
      <img
        src={imageUrl}
        alt={entityId}
        className="w-full h-full object-cover"
      />
    </div>
  );
}
