import type { Redis } from "ioredis";
import type { CachedWeather } from "./types.js";

const CACHE_TTL_SECONDS = 900; // 15 minutes
const CITY_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

/**
 * Round lat/lon to a 0.1° grid cell for cache keying.
 * Resolution: ~11km at the equator — everyone in the same city shares a cache entry.
 */
export function toGridKey(lat: number, lon: number): string {
  const gridLat = (Math.round(lat * 10) / 10).toFixed(1);
  const gridLon = (Math.round(lon * 10) / 10).toFixed(1);
  return `${gridLat}_${gridLon}`;
}

export async function getCachedWeather(
  redis: Redis,
  gridKey: string,
  units: string
): Promise<CachedWeather | null> {
  const key = `weather:all:${gridKey}:${units}`;
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CachedWeather;
  } catch {
    return null;
  }
}

export async function setCachedWeather(
  redis: Redis,
  gridKey: string,
  units: string,
  data: CachedWeather,
  ttlSeconds: number = CACHE_TTL_SECONDS
): Promise<void> {
  const key = `weather:all:${gridKey}:${units}`;
  await redis.setex(key, ttlSeconds, JSON.stringify(data));
}

/**
 * Resolve a city name for a lat/lon using BigDataCloud's free reverse geocoding.
 * Cached in Redis for 30 days per grid cell.
 */
export async function resolveCity(
  redis: Redis,
  lat: number,
  lon: number
): Promise<string> {
  const gridKey = toGridKey(lat, lon);
  const cacheKey = `weather:city:${gridKey}`;

  const cached = await redis.get(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
    );
    if (res.ok) {
      const data = await res.json();
      const city =
        data.city || data.locality || data.principalSubdivision || "";
      if (city) {
        await redis.setex(cacheKey, CITY_CACHE_TTL_SECONDS, city);
      }
      return city;
    }
  } catch {
    // Geocoding failed — return empty string
  }

  return "";
}

/**
 * In-memory fallback cache for when Redis is unavailable.
 * Single-instance, no grid keying — simple TTL cache like the old system.
 */
const memoryCache = new Map<string, { data: CachedWeather; expiresAt: number }>();

export function getMemoryCachedWeather(
  gridKey: string,
  units: string
): CachedWeather | null {
  const key = `${gridKey}:${units}`;
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data;
}

export function setMemoryCachedWeather(
  gridKey: string,
  units: string,
  data: CachedWeather,
  ttlMs: number = CACHE_TTL_SECONDS * 1000
): void {
  const key = `${gridKey}:${units}`;
  memoryCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// In-memory city cache fallback
const memoryCityCache = new Map<string, string>();

export async function resolveCityWithFallback(
  redis: Redis | null,
  lat: number,
  lon: number
): Promise<string> {
  const gridKey = toGridKey(lat, lon);

  // Try Redis first
  if (redis) {
    try {
      return await resolveCity(redis, lat, lon);
    } catch {
      // Redis unavailable, fall through to memory
    }
  }

  // Memory cache fallback
  if (memoryCityCache.has(gridKey)) {
    return memoryCityCache.get(gridKey)!;
  }

  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
    );
    if (res.ok) {
      const data = await res.json();
      const city =
        data.city || data.locality || data.principalSubdivision || "";
      if (city) {
        memoryCityCache.set(gridKey, city);
      }
      return city;
    }
  } catch {
    // Geocoding failed
  }

  return "";
}
