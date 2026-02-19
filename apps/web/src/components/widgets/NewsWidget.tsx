import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Newspaper } from "lucide-react";
import { api } from "../../services/api";
import type { WidgetStyle, FontSizePreset } from "../../stores/screensaver";
import { getFontSizeConfig } from "../../lib/font-size";
import type { NewsHeadline } from "@openframe/shared";
import { cn } from "../../lib/utils";
import { useDataFreshness } from "../../hooks/useDataFreshness";
import { STALE_THRESHOLDS } from "../../lib/stale-thresholds";
import { StaleDataOverlay } from "./StaleDataOverlay";

interface NewsWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
  widgetId?: string;
}

const FONT_SIZE_CLASSES: Record<Exclude<FontSizePreset, "custom">, { title: string; meta: string }> = {
  xs: { title: "text-[10px]", meta: "text-[8px]" },
  sm: { title: "text-xs", meta: "text-[9px]" },
  md: { title: "text-sm", meta: "text-[10px]" },
  lg: { title: "text-base", meta: "text-xs" },
  xl: { title: "text-lg", meta: "text-sm" },
};

const CUSTOM_SCALE = {
  title: 1,
  meta: 0.7,
};

export function NewsWidget({ config, style, isBuilder }: NewsWidgetProps) {
  const maxItems = (config.maxItems as number) ?? 5;
  const showImages = (config.showImages as boolean) ?? true;
  const showSource = (config.showSource as boolean) ?? true;
  const showTime = (config.showTime as boolean) ?? true;

  const { preset, isCustom, customValue } = getFontSizeConfig(style);
  const sizeClasses = isCustom ? null : FONT_SIZE_CLASSES[preset as Exclude<FontSizePreset, "custom">];

  const getCustomFontSize = (scale: number) => {
    if (!customValue) return undefined;
    const value = parseFloat(customValue);
    const unit = customValue.replace(/[\d.]/g, "") || "px";
    return `${value * scale}${unit}`;
  };

  const { data: headlines = [], isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ["news-headlines-widget", maxItems],
    queryFn: () => api.getNewsHeadlines(maxItems),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
    enabled: !isBuilder,
    retry: false,
  });
  const { isStale, ageLabel } = useDataFreshness(dataUpdatedAt, STALE_THRESHOLDS.news);

  // Mock data for builder preview
  const mockHeadlines = [
    { id: "1", title: "Breaking: Major Tech Conference Announces New Features", feedName: "Tech News", publishedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), imageUrl: null },
    { id: "2", title: "Scientists Discover New Species in Deep Ocean", feedName: "Science Daily", publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), imageUrl: null },
    { id: "3", title: "Markets React to Economic Policy Changes", feedName: "Finance Today", publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), imageUrl: null },
  ];

  const displayHeadlines = isBuilder ? mockHeadlines : headlines;

  if (!isBuilder && isLoading) {
    return (
      <div
        className="flex h-full items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <span className="text-sm opacity-50">Loading news...</span>
      </div>
    );
  }

  if (!isBuilder && (error || displayHeadlines.length === 0)) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <Newspaper className="h-8 w-8 opacity-30 mb-2" />
        <span className="text-sm opacity-50">No news configured</span>
        <span className="text-xs opacity-30 mt-1">Add feeds in Settings</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex h-full flex-col p-4 rounded-lg overflow-hidden",
        "bg-black/40 backdrop-blur-sm"
      )}
      style={{ color: style?.textColor || "#ffffff" }}
    >
      {isStale && <StaleDataOverlay ageLabel={ageLabel} textColor={style?.textColor} />}
      <div className="flex-1 space-y-2 overflow-hidden">
        {displayHeadlines.slice(0, maxItems).map((headline: NewsHeadline | typeof mockHeadlines[0]) => {
          const timeAgo = headline.publishedAt
            ? formatDistanceToNow(new Date(headline.publishedAt), { addSuffix: true })
            : null;

          return (
            <div key={headline.id} className="flex items-start gap-2">
              {showImages && headline.imageUrl && (
                <img
                  src={headline.imageUrl}
                  alt=""
                  className="w-12 h-9 object-cover rounded flex-shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              <div className="flex-1 min-w-0">
                <p
                  className={cn(sizeClasses?.title, "line-clamp-2 leading-tight")}
                  style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.title) } : undefined}
                >
                  {headline.title}
                </p>
                {(showSource || showTime) && (
                  <div
                    className={cn(sizeClasses?.meta, "opacity-50 mt-0.5 flex items-center gap-1")}
                    style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.meta) } : undefined}
                  >
                    {showSource && <span className="truncate">{headline.feedName}</span>}
                    {showSource && showTime && timeAgo && <span>·</span>}
                    {showTime && timeAgo && <span className="flex-shrink-0">{timeAgo}</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
