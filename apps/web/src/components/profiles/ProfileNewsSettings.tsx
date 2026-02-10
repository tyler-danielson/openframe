import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Newspaper } from "lucide-react";
import { api } from "../../services/api";
import { Button } from "../ui/Button";

interface ProfileNewsSettingsProps {
  profileId: string;
}

export function ProfileNewsSettings({ profileId }: ProfileNewsSettingsProps) {
  const queryClient = useQueryClient();

  // Fetch news feed settings
  const { data: feedSettings = [], isLoading } = useQuery({
    queryKey: ["profile-news", profileId],
    queryFn: () => api.getProfileNews(profileId),
    enabled: !!profileId,
  });

  // Update visibility mutation
  const updateVisibility = useMutation({
    mutationFn: (updates: Array<{ feedId: string; isVisible: boolean }>) =>
      api.updateProfileNews(profileId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-news", profileId] });
    },
  });

  const handleToggle = (feedId: string, currentlyVisible: boolean) => {
    updateVisibility.mutate([{ feedId, isVisible: !currentlyVisible }]);
  };

  const handleSelectAll = () => {
    const updates = feedSettings.map((s) => ({
      feedId: s.feed.id,
      isVisible: true,
    }));
    updateVisibility.mutate(updates);
  };

  const handleSelectNone = () => {
    const updates = feedSettings.map((s) => ({
      feedId: s.feed.id,
      isVisible: false,
    }));
    updateVisibility.mutate(updates);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium">News Feeds</h3>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleSelectAll}>
            Select All
          </Button>
          <Button variant="ghost" size="sm" onClick={handleSelectNone}>
            Select None
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Choose which news feeds to show in this profile's planner.
      </p>

      {feedSettings.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-4">
          No news feeds available. Add RSS feeds in Settings.
        </p>
      ) : (
        <div className="space-y-2">
          {feedSettings.map(({ feed, isVisible }) => (
            <label
              key={feed.id}
              className="flex items-center gap-3 p-3 rounded-md border border-border hover:bg-muted/50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={isVisible}
                onChange={() => handleToggle(feed.id, isVisible)}
                className="rounded border-border"
              />
              <div className="flex-1">
                <span className="font-medium">{feed.name}</span>
                {feed.category && (
                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded ml-2">
                    {feed.category}
                  </span>
                )}
              </div>
              {!feed.isActive && (
                <span className="text-xs text-muted-foreground">Inactive</span>
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
