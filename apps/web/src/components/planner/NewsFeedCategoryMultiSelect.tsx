import { useQuery } from "@tanstack/react-query";
import { Loader2, Newspaper } from "lucide-react";
import { api } from "../../services/api";

interface NewsFeedCategoryMultiSelectProps {
  selectedCategories: string[];
  onChange: (categories: string[]) => void;
}

export function NewsFeedCategoryMultiSelect({
  selectedCategories,
  onChange,
}: NewsFeedCategoryMultiSelectProps) {
  const {
    data: feeds,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["news-feeds"],
    queryFn: () => api.getNewsFeeds(),
  });

  const handleToggle = (category: string) => {
    if (selectedCategories.includes(category)) {
      onChange(selectedCategories.filter((c) => c !== category));
    } else {
      onChange([...selectedCategories, category]);
    }
  };

  const handleSelectAll = () => {
    if (!categories.length) return;
    onChange(categories);
  };

  const handleSelectNone = () => {
    onChange([]);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-destructive py-2">Failed to load news feeds</div>
    );
  }

  // Get unique categories from active feeds
  const activeFeeds = feeds?.filter((f) => f.isActive) || [];
  const categories = [
    ...new Set(activeFeeds.map((f) => f.category).filter((c): c is string => !!c)),
  ].sort();

  if (activeFeeds.length === 0) {
    return (
      <div className="text-xs text-muted-foreground py-2 flex items-center gap-2">
        <Newspaper className="h-3 w-3" />
        No active news feeds found
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="text-xs text-muted-foreground py-2">
        No categories found (feeds have no category set)
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Quick actions */}
      <div className="flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={handleSelectAll}
          className="text-primary hover:underline"
        >
          Select all
        </button>
        <span className="text-muted-foreground">|</span>
        <button
          type="button"
          onClick={handleSelectNone}
          className="text-primary hover:underline"
        >
          Clear
        </button>
      </div>

      {/* Category options */}
      <div className="border border-border rounded-md max-h-48 overflow-auto">
        {categories.map((category) => (
          <label
            key={category}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted/50 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selectedCategories.includes(category)}
              onChange={() => handleToggle(category)}
              className="rounded border-border"
            />
            <span className="text-sm truncate flex-1">{category}</span>
          </label>
        ))}
      </div>

      {selectedCategories.length > 0 ? (
        <div className="text-xs text-muted-foreground">
          {selectedCategories.length} categor{selectedCategories.length !== 1 ? "ies" : "y"}{" "}
          selected
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">
          No filter (showing all categories)
        </div>
      )}
    </div>
  );
}
