import { useState, useEffect } from "react";
import { useConnection } from "../contexts/ConnectionContext";

interface DataFreshnessResult {
  isStale: boolean;
  ageMs: number;
  ageLabel: string;
  isOffline: boolean;
}

function formatAge(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Checks whether query data is stale while offline.
 * `isStale` is only true when BOTH offline AND data is older than maxAgeMs.
 */
export function useDataFreshness(
  dataUpdatedAt: number,
  maxAgeMs: number
): DataFreshnessResult {
  const { isOffline } = useConnection();
  const [now, setNow] = useState(Date.now());

  // Tick every 30s to keep age labels fresh
  useEffect(() => {
    if (!isOffline) return;
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, [isOffline]);

  const ageMs = dataUpdatedAt > 0 ? now - dataUpdatedAt : 0;
  const isStale = isOffline && dataUpdatedAt > 0 && ageMs > maxAgeMs;
  const ageLabel = dataUpdatedAt > 0 ? formatAge(ageMs) : "never";

  return { isStale, ageMs, ageLabel, isOffline };
}
