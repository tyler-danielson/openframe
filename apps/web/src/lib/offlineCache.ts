/**
 * Offline cache utility for localStorage with TTL support.
 * Used by kiosks to store weather data and config for offline fallback.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: 1;
}

// Cache key constants
export const CACHE_KEYS = {
  WEATHER_CURRENT: "openframe_weather_current",
  WEATHER_FORECAST: "openframe_weather_forecast",
  WEATHER_HOURLY: "openframe_weather_hourly",
  KIOSK_CONFIG: "openframe_kiosk_config",
} as const;

// Default max ages in milliseconds
export const CACHE_MAX_AGES = {
  WEATHER: 6 * 60 * 60 * 1000, // 6 hours
  KIOSK_CONFIG: 24 * 60 * 60 * 1000, // 24 hours
} as const;

export const offlineCache = {
  /**
   * Store data in cache with current timestamp.
   */
  set<T>(key: string, data: T): void {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        version: 1,
      };
      localStorage.setItem(key, JSON.stringify(entry));
    } catch (error) {
      // localStorage might be full or unavailable
      console.warn(`[offlineCache] Failed to set ${key}:`, error);
    }
  },

  /**
   * Get data from cache if it exists and hasn't expired.
   * Returns null if cache miss or expired.
   */
  get<T>(key: string, maxAgeMs: number): { data: T; age: number } | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;

      const entry = JSON.parse(raw) as CacheEntry<T>;

      // Validate structure
      if (!entry || typeof entry.timestamp !== "number" || entry.version !== 1) {
        this.clear(key);
        return null;
      }

      const age = Date.now() - entry.timestamp;

      // Check if expired
      if (age > maxAgeMs) {
        return null;
      }

      return { data: entry.data, age };
    } catch (error) {
      console.warn(`[offlineCache] Failed to get ${key}:`, error);
      return null;
    }
  },

  /**
   * Get data from cache even if expired (for offline fallback).
   * Returns null only if no cache exists.
   */
  getStale<T>(key: string): { data: T; age: number } | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;

      const entry = JSON.parse(raw) as CacheEntry<T>;

      // Validate structure
      if (!entry || typeof entry.timestamp !== "number" || entry.version !== 1) {
        this.clear(key);
        return null;
      }

      const age = Date.now() - entry.timestamp;
      return { data: entry.data, age };
    } catch (error) {
      console.warn(`[offlineCache] Failed to get stale ${key}:`, error);
      return null;
    }
  },

  /**
   * Remove a specific cache entry.
   */
  clear(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`[offlineCache] Failed to clear ${key}:`, error);
    }
  },

  /**
   * Clear all openframe cache entries.
   */
  clearAll(): void {
    try {
      Object.values(CACHE_KEYS).forEach((key) => {
        localStorage.removeItem(key);
      });
    } catch (error) {
      console.warn("[offlineCache] Failed to clear all:", error);
    }
  },
};
