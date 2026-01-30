import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink, Newspaper, RefreshCw } from "lucide-react";
import { api } from "../../services/api";
import type { NewsHeadline } from "@openframe/shared";

interface HeadlinesWidgetProps {
  limit?: number;
  className?: string;
}

export function HeadlinesWidget({ limit = 10, className = "" }: HeadlinesWidgetProps) {
  const {
    data: headlines = [],
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["news-headlines", limit],
    queryFn: () => api.getNewsHeadlines(limit),
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className={`flex flex-col items-center justify-center h-full text-muted-foreground ${className}`}>
        <RefreshCw className="h-8 w-8 animate-spin mb-2" />
        <p className="text-sm">Loading headlines...</p>
      </div>
    );
  }

  if (error || headlines.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center h-full text-muted-foreground ${className}`}>
        <Newspaper className="h-12 w-12 mb-2 opacity-50" />
        <p className="text-sm">No news configured</p>
        <p className="text-xs mt-1">Add feeds in Settings &gt; Entertainment &gt; News</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div className="flex-1 overflow-auto space-y-2 pr-1">
        {headlines.map((headline) => (
          <HeadlineItem key={headline.id} headline={headline} />
        ))}
      </div>
      <div className="flex items-center justify-end pt-2 border-t border-border mt-2">
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>
    </div>
  );
}

function HeadlineItem({ headline }: { headline: NewsHeadline }) {
  const timeAgo = headline.publishedAt
    ? formatDistanceToNow(new Date(headline.publishedAt), { addSuffix: true })
    : null;

  return (
    <a
      href={headline.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-start gap-3">
        {headline.imageUrl && (
          <img
            src={headline.imageUrl}
            alt=""
            className="w-16 h-12 object-cover rounded flex-shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {headline.title}
          </h4>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span className="truncate">{headline.feedName}</span>
            {timeAgo && (
              <>
                <span>·</span>
                <span className="flex-shrink-0">{timeAgo}</span>
              </>
            )}
            <ExternalLink className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </div>
        </div>
      </div>
    </a>
  );
}
