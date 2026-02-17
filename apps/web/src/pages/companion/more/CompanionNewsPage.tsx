import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Newspaper, ExternalLink } from "lucide-react";
import { api } from "../../../services/api";
import { Card } from "../../../components/ui/Card";
import { CompanionPageHeader } from "../components/CompanionPageHeader";

export function CompanionNewsPage() {
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null);

  const { data: feeds } = useQuery({
    queryKey: ["companion-news-feeds"],
    queryFn: () => api.getNewsFeeds(),
    staleTime: 300_000,
  });

  const { data: articles, isLoading } = useQuery({
    queryKey: ["companion-news-articles", selectedFeedId],
    queryFn: () => api.getNewsArticles({ feedId: selectedFeedId || undefined, limit: 50 }),
    staleTime: 60_000,
  });

  return (
    <div className="flex flex-col h-full">
      <CompanionPageHeader title="News" backTo="/companion/more" />

      {/* Feed filter tabs */}
      <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-none shrink-0">
        <button
          onClick={() => setSelectedFeedId(null)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            selectedFeedId === null
              ? "bg-primary text-primary-foreground"
              : "bg-card border border-border text-foreground hover:bg-primary/5"
          }`}
        >
          All
        </button>
        {(feeds || []).map((feed: any) => (
          <button
            key={feed.id}
            onClick={() => setSelectedFeedId(feed.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedFeedId === feed.id
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-foreground hover:bg-primary/5"
            }`}
          >
            {feed.name}
          </button>
        ))}
      </div>

      {/* Articles */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !articles || (articles as any[]).length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Newspaper className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No articles</p>
          </div>
        ) : (
          (articles as any[]).map((article: any) => (
            <a
              key={article.id}
              href={article.link || article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Card className="p-4 hover:bg-primary/5 transition-colors">
                <div className="flex gap-3">
                  {article.imageUrl && (
                    <img
                      src={article.imageUrl}
                      alt=""
                      className="h-16 w-16 rounded-lg object-cover shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
                      {article.title}
                    </h3>
                    {article.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {article.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      {article.feedName && (
                        <span className="text-xs text-primary">{article.feedName}</span>
                      )}
                      {article.publishedAt && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(article.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                </div>
              </Card>
            </a>
          ))
        )}
      </div>
    </div>
  );
}
