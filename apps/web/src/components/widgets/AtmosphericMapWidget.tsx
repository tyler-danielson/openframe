import type { WidgetStyle } from "../../stores/screensaver";
import { cn } from "../../lib/utils";

interface AtmosphericMapWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
}

export function AtmosphericMapWidget({ config, style, isBuilder }: AtmosphericMapWidgetProps) {
  const layer = (config.layer as string) || "wind";
  const lat = (config.latitude as number) || 40;
  const lon = (config.longitude as number) || -105;
  const zoom = (config.zoom as number) || 5;

  if (isBuilder) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}>
        <span className="text-3xl mb-2">🌊</span>
        <span className="text-sm opacity-70">Atmospheric Map</span>
        <span className="text-xs opacity-50 mt-1">{layer} layer</span>
      </div>
    );
  }

  // Windy.com embeddable map
  const windyUrl = `https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=in&metricTemp=°F&metricWind=mph&zoom=${zoom}&overlay=${layer}&product=ecmwf&level=surface&lat=${lat}&lon=${lon}&detailLat=${lat}&detailLon=${lon}&marker=true&message=true`;

  return (
    <div className="h-full w-full rounded-lg overflow-hidden bg-black/40">
      <iframe
        src={windyUrl}
        className="w-full h-full border-0"
        title="Atmospheric Map"
        allowFullScreen
      />
    </div>
  );
}
