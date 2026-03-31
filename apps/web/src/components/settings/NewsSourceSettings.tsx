import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  Newspaper,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { api } from "../../services/api";
import { Button } from "../ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/Card";

interface NewsSourceSettingsProps {
  sourceId: string;
}

export function NewsSourceSettings({ sourceId }: NewsSourceSettingsProps) {
  const queryClient = useQueryClient();
  const isCustom = sourceId === "custom";

  // Custom feed form state
  const [customFeedUrl, setCustomFeedUrl] = useState("");
  const [customFeedName, setCustomFeedName] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Fetch presets (for non-custom sources)
  const { data: presets = [] } = useQuery({
    queryKey: ["news-presets"],
    queryFn: () => api.getNewsPresets(),
    enabled: !isCustom,
  });

  // Fetch source metadata
  const { data: sources = [] } = useQuery({
    queryKey: ["news-sources"],
    queryFn: () => api.getNewsSources(),
  });

  // Fetch user's feeds
  const { data: allFeeds = [], isLoading } = useQuery({
    queryKey: ["news-feeds"],
    queryFn: () => api.getNewsFeeds(),
  });

  // Filter to this source's presets and feeds
  const sourcePresets = presets.filter((p) => p.source === sourceId);
  const sourceFeeds = isCustom
    ? allFeeds.filter((f) => !f.source)
    : allFeeds.filter((f) => f.source === sourceId);
  const sourceMeta = sources.find((s) => s.id === sourceId);

  const addFeedMutation = useMutation({
    mutationFn: (data: { name: string; feedUrl: string; category?: string; source?: string }) =>
      api.addNewsFeed(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news-feeds"] });
      setCustomFeedUrl("");
      setCustomFeedName("");
      setValidationError(null);
    },
  });

  const updateFeedMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ name: string; isActive: boolean }> }) =>
      api.updateNewsFeed(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news-feeds"] });
    },
  });

  const deleteFeedMutation = useMutation({
    mutationFn: (id: string) => api.deleteNewsFeed(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news-feeds"] });
    },
  });

  const refreshMutation = useMutation({
    mutationFn: () => api.refreshNewsFeeds(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news-feeds"] });
      queryClient.invalidateQueries({ queryKey: ["news-headlines"] });
    },
  });

  const isPresetAdded = (url: string) => allFeeds.some((f) => f.feedUrl === url);

  const handleAddCustomFeed = async () => {
    if (!customFeedUrl) return;
    setIsValidating(true);
    setValidationError(null);
    try {
      const result = await api.validateNewsFeedUrl(customFeedUrl);
      if (!result.valid) {
        setValidationError(result.error || "Invalid feed URL");
        setIsValidating(false);
        return;
      }
      await addFeedMutation.mutateAsync({
        name: customFeedName || result.title || "Custom Feed",
        feedUrl: customFeedUrl,
        category: "custom",
      });
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "Failed to add feed");
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* Left: Available feeds or custom add form */}
      {isCustom ? (
        <Card className="border-2 border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Add Custom Feed
            </CardTitle>
            <CardDescription>Add any RSS or Atom feed URL</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Feed name (optional)"
                value={customFeedName}
                onChange={(e) => setCustomFeedName(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
              />
              <input
                type="url"
                placeholder="https://example.com/rss.xml"
                value={customFeedUrl}
                onChange={(e) => {
                  setCustomFeedUrl(e.target.value);
                  setValidationError(null);
                }}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
              />
              <Button
                onClick={handleAddCustomFeed}
                disabled={!customFeedUrl || isValidating || addFeedMutation.isPending}
                className="w-full"
              >
                {isValidating ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-1" />
                )}
                Add Feed
              </Button>
              {validationError && (
                <p className="text-sm text-destructive">{validationError}</p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2 border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {sourceMeta && <span className="text-xl">{sourceMeta.icon}</span>}
              Available Feeds
            </CardTitle>
            <CardDescription>
              {sourceMeta?.description || `Choose feeds from ${sourceMeta?.name || sourceId}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {sourcePresets.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No preset feeds available</p>
            ) : (
              sourcePresets.map((preset) => {
                const isAdded = isPresetAdded(preset.url);
                return (
                  <div
                    key={preset.url}
                    className="flex items-center justify-between p-3 rounded-lg border border-border"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{preset.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{preset.category}</p>
                    </div>
                    <Button
                      size="sm"
                      variant={isAdded ? "outline" : "default"}
                      disabled={isAdded || addFeedMutation.isPending}
                      onClick={() =>
                        addFeedMutation.mutate({
                          name: preset.name,
                          feedUrl: preset.url,
                          category: preset.category,
                          source: sourceId,
                        })
                      }
                      className="ml-2 flex-shrink-0"
                    >
                      {isAdded ? (
                        <>
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Added
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </>
                      )}
                    </Button>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}

      {/* Right: User's feeds from this source */}
      <Card className="border-2 border-primary/40">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your Feeds</CardTitle>
              <CardDescription>
                {isCustom ? "Manually-added feeds" : `Your ${sourceMeta?.name || sourceId} subscriptions`}
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sourceFeeds.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Newspaper className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No feeds subscribed</p>
              <p className="text-sm mt-1">
                {isCustom
                  ? "Add a feed URL to get started"
                  : "Add feeds from the available list"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sourceFeeds.map((feed) => (
                <div
                  key={feed.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() =>
                        updateFeedMutation.mutate({
                          id: feed.id,
                          data: { isActive: !feed.isActive },
                        })
                      }
                      className="flex-shrink-0"
                    >
                      {feed.isActive ? (
                        <Eye className="h-5 w-5 text-primary" />
                      ) : (
                        <EyeOff className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`font-medium text-sm truncate ${!feed.isActive ? "text-muted-foreground" : ""}`}>
                        {feed.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {feed.articleCount ?? 0} articles
                        {feed.lastFetchedAt &&
                          ` · Updated ${new Date(feed.lastFetchedAt).toLocaleTimeString()}`}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteFeedMutation.mutate(feed.id)}
                    disabled={deleteFeedMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
