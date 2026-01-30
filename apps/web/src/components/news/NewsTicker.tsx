import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import type { NewsHeadline } from "@openframe/shared";

interface NewsTickerProps {
  className?: string;
  variant?: "light" | "dark";
}

export function NewsTicker({ className = "", variant = "light" }: NewsTickerProps) {
  const { data: headlines = [] } = useQuery({
    queryKey: ["news-ticker"],
    queryFn: () => api.getNewsHeadlines(20),
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  if (headlines.length === 0) {
    return null;
  }

  const bgClass = variant === "dark"
    ? "bg-black/60 backdrop-blur-sm"
    : "bg-muted/80";

  const textClass = variant === "dark"
    ? "text-white/90"
    : "text-foreground";

  return (
    <div className={`overflow-hidden ${bgClass} ${className}`}>
      <div className="ticker-container relative h-7 flex items-center">
        <div
          className={`ticker-content whitespace-nowrap text-sm font-medium ${textClass}`}
          style={{
            animation: `news-ticker-scroll ${Math.max(60, headlines.length * 8)}s linear infinite`,
            willChange: "transform",
            paddingLeft: "100vw",
          }}
        >
          {headlines.map((headline, i) => (
            <span key={headline.id} className="inline-block">
              <span className="text-muted-foreground text-xs mr-2">[{headline.feedName}]</span>
              {headline.title}
              {i < headlines.length - 1 && <span className="mx-8 text-muted-foreground">|</span>}
            </span>
          ))}
          <span className="inline-block mx-24" />
          {headlines.map((headline, i) => (
            <span key={`dup-${headline.id}`} className="inline-block">
              <span className="text-muted-foreground text-xs mr-2">[{headline.feedName}]</span>
              {headline.title}
              {i < headlines.length - 1 && <span className="mx-8 text-muted-foreground">|</span>}
            </span>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes news-ticker-scroll {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(-50%, 0, 0);
          }
        }
        .ticker-container:hover .ticker-content {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
