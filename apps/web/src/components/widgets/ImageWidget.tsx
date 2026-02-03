import { useState, useEffect } from "react";
import { Image as ImageIcon } from "lucide-react";
import type { WidgetStyle } from "../../stores/screensaver";
import { cn } from "../../lib/utils";

interface ImageWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
}

export function ImageWidget({ config, style, isBuilder }: ImageWidgetProps) {
  const url = config.url as string ?? "";
  const fit = config.fit as "contain" | "cover" | "fill" ?? "contain";
  const refreshInterval = config.refreshInterval as number ?? 0;

  const [imageUrl, setImageUrl] = useState(url);
  const [error, setError] = useState(false);

  // Handle refresh interval for dynamic images
  useEffect(() => {
    if (!url || refreshInterval <= 0) {
      setImageUrl(url);
      return;
    }

    const addTimestamp = (baseUrl: string) => {
      const separator = baseUrl.includes("?") ? "&" : "?";
      return `${baseUrl}${separator}_t=${Date.now()}`;
    };

    setImageUrl(addTimestamp(url));

    const interval = setInterval(() => {
      setImageUrl(addTimestamp(url));
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [url, refreshInterval]);

  const fitClass = {
    contain: "object-contain",
    cover: "object-cover",
    fill: "object-fill",
  }[fit];

  if (!url) {
    return (
      <div
        className={cn(
          "flex h-full flex-col items-center justify-center p-4 rounded-lg",
          "bg-black/40 backdrop-blur-sm"
        )}
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <ImageIcon className="h-12 w-12 opacity-50 mb-2" />
        <span className="text-sm opacity-70">No image URL</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          "flex h-full flex-col items-center justify-center p-4 rounded-lg",
          "bg-black/40 backdrop-blur-sm"
        )}
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <ImageIcon className="h-8 w-8 opacity-50 mb-2" />
        <span className="text-sm opacity-50">Failed to load image</span>
      </div>
    );
  }

  return (
    <div className="h-full w-full rounded-lg overflow-hidden bg-black/40">
      <img
        src={imageUrl}
        alt=""
        className={cn("w-full h-full", fitClass)}
        onError={() => setError(true)}
        onLoad={() => setError(false)}
      />
    </div>
  );
}
