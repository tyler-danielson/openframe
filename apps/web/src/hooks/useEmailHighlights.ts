import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { api } from "../services/api";
import type { EmailHighlight } from "@openframe/shared";

interface UseEmailHighlightsOptions {
  limit?: number;
}

/**
 * Hook to fetch Gmail email highlights.
 */
export function useEmailHighlights(options: UseEmailHighlightsOptions = {}) {
  const { limit = 5 } = options;

  return useQuery({
    queryKey: ["email-highlights", limit],
    queryFn: async () => {
      return api.getGmailHighlights(limit);
    },
    staleTime: 2 * 60 * 1000, // Consider fresh for 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    retry: false, // Don't retry failed requests (might be config issue)
  });
}

/**
 * Hook to check Gmail connection status.
 */
export function useGmailStatus() {
  return useQuery({
    queryKey: ["gmail-status"],
    queryFn: async () => {
      return api.getGmailStatus();
    },
    staleTime: 5 * 60 * 1000, // Check every 5 minutes
  });
}

/**
 * Format email received time for display.
 * Returns relative time like "2 hours ago".
 */
export function formatEmailTime(receivedAt: string): string {
  const date = new Date(receivedAt);
  return formatDistanceToNow(date, { addSuffix: true });
}
