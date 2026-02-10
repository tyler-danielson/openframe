import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import type { DailyBriefing } from "@openframe/shared";

/**
 * Hook to fetch the AI-generated daily briefing.
 */
export function useDailyBriefing() {
  return useQuery({
    queryKey: ["daily-briefing"],
    queryFn: async () => {
      return api.getDailyBriefing();
    },
    staleTime: 10 * 60 * 1000, // Consider fresh for 10 minutes
    refetchInterval: 30 * 60 * 1000, // Refetch every 30 minutes
    retry: false, // Don't retry failed requests (might be config issue)
  });
}

/**
 * Hook to check if AI briefing is configured.
 */
export function useBriefingStatus() {
  return useQuery({
    queryKey: ["briefing-status"],
    queryFn: async () => {
      return api.getBriefingStatus();
    },
    staleTime: 5 * 60 * 1000, // Check every 5 minutes
  });
}
