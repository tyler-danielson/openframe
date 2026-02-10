import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { api } from "../services/api";
import type { NewsHeadline } from "@openframe/shared";

interface UsePlannerHeadlinesOptions {
  limit?: number;
  categories?: string[];
}

/**
 * Hook to fetch headlines for the planner widgets.
 * Returns headlines filtered by the specified categories.
 */
export function usePlannerHeadlines(options: UsePlannerHeadlinesOptions = {}) {
  const { limit = 20, categories = [] } = options;

  return useQuery({
    queryKey: ["planner-headlines", limit, categories],
    queryFn: async () => {
      // Fetch headlines from the API
      const headlines = await api.getNewsHeadlines(limit * 2); // Fetch extra for filtering

      // Filter by categories if specified (client-side)
      let filtered = headlines;
      if (categories.length > 0) {
        filtered = headlines.filter(
          (h) => h.feedCategory && categories.includes(h.feedCategory)
        );
      }

      // Limit to requested number
      return filtered.slice(0, limit);
    },
    staleTime: 2 * 60 * 1000, // Consider fresh for 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    retry: false,
  });
}

/**
 * Format headline published date for display.
 * Returns relative time like "2 hours ago".
 */
export function formatHeadlineTime(publishedAt: Date | string | null): string | null {
  if (!publishedAt) return null;

  const date = typeof publishedAt === "string" ? new Date(publishedAt) : publishedAt;
  return formatDistanceToNow(date, { addSuffix: true });
}
