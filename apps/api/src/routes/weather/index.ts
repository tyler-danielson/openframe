import type { FastifyPluginAsync } from "fastify";
import { getCategorySettings } from "../settings/index.js";
import type { WeatherProvider, CachedWeather } from "../../services/weather/types.js";
import { OpenMeteoProvider } from "../../services/weather/open-meteo.js";
import { OpenWeatherMapProvider } from "../../services/weather/openweathermap.js";
import {
  toGridKey,
  getCachedWeather,
  setCachedWeather,
  getMemoryCachedWeather,
  setMemoryCachedWeather,
  resolveCityWithFallback,
} from "../../services/weather/cache.js";

function getWeatherProvider(weatherSettings: Record<string, string | null>): { provider: WeatherProvider; name: string } {
  const owmKey = weatherSettings.api_key;
  if (owmKey) {
    return { provider: new OpenWeatherMapProvider(owmKey), name: "openweathermap" };
  }
  return { provider: new OpenMeteoProvider(), name: "open-meteo" };
}

async function fetchWeatherData(
  fastify: any,
  lat: number,
  lon: number,
  units: "imperial" | "metric",
  timezone: string,
  provider: WeatherProvider
): Promise<CachedWeather> {
  const gridKey = toGridKey(lat, lon);
  const redis = fastify.redis;

  // 1. Check Redis cache
  if (redis) {
    try {
      const cached = await getCachedWeather(redis, gridKey, units);
      if (cached) return cached;
    } catch {
      // Redis error — fall through to memory cache
    }
  }

  // 2. Check in-memory fallback cache
  const memoryCached = getMemoryCachedWeather(gridKey, units);
  if (memoryCached) return memoryCached;

  // 3. Cache miss — fetch from provider
  const fresh = await provider.fetchAll(lat, lon, units, timezone);

  // 4. Resolve city name if provider didn't supply one
  if (!fresh.current.city) {
    fresh.current.city = await resolveCityWithFallback(redis, lat, lon);
  }

  const result: CachedWeather = {
    current: fresh.current,
    hourly: fresh.hourly,
    daily: fresh.daily,
    fetchedAt: Date.now(),
  };

  // 5. Store in cache (Redis + memory fallback)
  if (redis) {
    try {
      await setCachedWeather(redis, gridKey, units, result, 900);
    } catch {
      // Redis write failed — memory cache is the fallback
    }
  }
  setMemoryCachedWeather(gridKey, units, result);

  return result;
}

export const weatherRoutes: FastifyPluginAsync = async (fastify) => {
  // Shared helper to load settings and fetch weather
  async function getWeatherForRequest(request: any) {
    const userId = request.user?.userId;
    const weatherSettings = await getCategorySettings(fastify.db, "weather", userId);
    const homeSettings = await getCategorySettings(fastify.db, "home", userId);

    // Check for premium weather service (BYOK fallback for cloud users)
    const serviceSettings = await getCategorySettings(fastify.db, "services", userId);
    const hasPremiumWeather = serviceSettings.weather_premium === "true";

    // Provider selection: user key → premium platform key → Open-Meteo (free)
    const userKey = weatherSettings.api_key;
    const platformKey = hasPremiumWeather ? process.env.OPENWEATHERMAP_PLATFORM_KEY : null;
    const effectiveSettings = { ...weatherSettings };
    if (!userKey && platformKey) {
      effectiveSettings.api_key = platformKey;
    }

    const lat = parseFloat(homeSettings.latitude || process.env.OPENWEATHERMAP_LAT || "");
    const lon = parseFloat(homeSettings.longitude || process.env.OPENWEATHERMAP_LON || "");
    const units = (weatherSettings.units || "imperial") as "imperial" | "metric";
    const timezone = (homeSettings.timezone as string) || "UTC";

    if (isNaN(lat) || isNaN(lon)) {
      throw fastify.httpErrors.badRequest(
        "Home location not configured. Set your location in Settings → System Settings → Home Location."
      );
    }

    const { provider } = getWeatherProvider(effectiveSettings);
    return fetchWeatherData(fastify, lat, lon, units, timezone, provider);
  }

  // GET /weather/current
  fastify.get(
    "/current",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get current weather data",
        tags: ["Weather"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const data = await getWeatherForRequest(request);
      return { success: true, data: data.current };
    }
  );

  // GET /weather/forecast
  fastify.get(
    "/forecast",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get weather forecast",
        tags: ["Weather"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const data = await getWeatherForRequest(request);
      return { success: true, data: data.daily };
    }
  );

  // GET /weather/hourly
  fastify.get(
    "/hourly",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get hourly weather forecast",
        tags: ["Weather"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const data = await getWeatherForRequest(request);
      return { success: true, data: data.hourly };
    }
  );

  // GET /weather/status
  fastify.get(
    "/status",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Check weather configuration status",
        tags: ["Weather"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const userId = (request as any).user?.userId;
      const weatherSettings = await getCategorySettings(fastify.db, "weather", userId);
      const homeSettings = await getCategorySettings(fastify.db, "home", userId);
      const serviceSettings = await getCategorySettings(fastify.db, "services", userId);
      const hasPremiumWeather = serviceSettings.weather_premium === "true";

      const lat = homeSettings.latitude || process.env.OPENWEATHERMAP_LAT;
      const lon = homeSettings.longitude || process.env.OPENWEATHERMAP_LON;

      const hasOwnKey = !!weatherSettings.api_key;
      const providerName = hasOwnKey || hasPremiumWeather ? "openweathermap" : "open-meteo";

      return {
        success: true,
        configured: !!(lat && lon), // No API key needed — Open-Meteo is free
        provider: providerName,
        premiumWeather: hasPremiumWeather,
      };
    }
  );

  // ─── Weather Alerts (via OWM One Call API 3.0) ────
  // Alerts require an OWM API key — return empty if not configured

  let alertsCache: { data: any[]; timestamp: number } | null = null;
  const ALERTS_CACHE_MS = 10 * 60 * 1000;

  fastify.get(
    "/alerts",
    { onRequest: [fastify.authenticateKioskOrAny] },
    async (request) => {
      const userId = (request as any).user?.userId;
      const weatherSettings = await getCategorySettings(fastify.db, "weather", userId);
      const homeSettings = await getCategorySettings(fastify.db, "home", userId);
      const serviceSettings = await getCategorySettings(fastify.db, "services", userId);
      const hasPremium = serviceSettings.weather_premium === "true";
      const apiKey = weatherSettings.api_key || (hasPremium ? process.env.OPENWEATHERMAP_PLATFORM_KEY : null) || process.env.OPENWEATHERMAP_API_KEY;
      const lat = homeSettings.latitude;
      const lon = homeSettings.longitude;

      if (!apiKey || !lat || !lon) {
        return { success: true, data: [] };
      }

      if (alertsCache && Date.now() - alertsCache.timestamp < ALERTS_CACHE_MS) {
        return { success: true, data: alertsCache.data };
      }

      try {
        const res = await fetch(
          `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=minutely,hourly,daily,current&appid=${apiKey}`
        );
        if (res.ok) {
          const json = (await res.json()) as { alerts?: any[] };
          const alerts = (json.alerts || []).map((a: any) => ({
            event: a.event,
            sender: a.sender_name,
            start: new Date(a.start * 1000).toISOString(),
            end: new Date(a.end * 1000).toISOString(),
            description: a.description,
            tags: a.tags || [],
          }));
          alertsCache = { data: alerts, timestamp: Date.now() };
          return { success: true, data: alerts };
        }
        alertsCache = { data: [], timestamp: Date.now() };
        return { success: true, data: [] };
      } catch {
        return { success: true, data: [] };
      }
    }
  );

  // ─── Air Quality (OWM Air Pollution API - free) ────

  let aqiCache: { data: any; timestamp: number } | null = null;
  const AQI_CACHE_MS = 30 * 60 * 1000;

  fastify.get(
    "/air-quality",
    { onRequest: [fastify.authenticateKioskOrAny] },
    async (request) => {
      const userId = (request as any).user?.userId;
      const weatherSettings = await getCategorySettings(fastify.db, "weather", userId);
      const homeSettings = await getCategorySettings(fastify.db, "home", userId);
      const serviceSettings = await getCategorySettings(fastify.db, "services", userId);
      const hasPremium = serviceSettings.weather_premium === "true";
      const apiKey = weatherSettings.api_key || (hasPremium ? process.env.OPENWEATHERMAP_PLATFORM_KEY : null) || process.env.OPENWEATHERMAP_API_KEY;
      const lat = homeSettings.latitude;
      const lon = homeSettings.longitude;

      if (!apiKey || !lat || !lon) {
        throw fastify.httpErrors.badRequest("Weather not configured — Air quality requires an OpenWeatherMap API key");
      }

      if (aqiCache && Date.now() - aqiCache.timestamp < AQI_CACHE_MS) {
        return { success: true, data: aqiCache.data };
      }

      try {
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`
        );
        if (!res.ok) throw new Error(`AQI API error: ${res.status}`);

        const json = (await res.json()) as { list: { main: { aqi: number }; components: Record<string, number>; dt: number }[] };
        const item = json.list[0];
        if (!item) throw new Error("No AQI data");

        const aqiLabels = ["", "Good", "Fair", "Moderate", "Poor", "Very Poor"];
        const data = {
          aqi: item.main.aqi,
          label: aqiLabels[item.main.aqi] || "Unknown",
          components: {
            co: item.components.co,
            no: item.components.no,
            no2: item.components.no2,
            o3: item.components.o3,
            so2: item.components.so2,
            pm2_5: item.components.pm2_5,
            pm10: item.components.pm10,
            nh3: item.components.nh3,
          },
          updatedAt: new Date(item.dt * 1000).toISOString(),
        };

        aqiCache = { data, timestamp: Date.now() };
        return { success: true, data };
      } catch (err: any) {
        throw fastify.httpErrors.serviceUnavailable(err.message);
      }
    }
  );

  // ─── Ocean Tides (NOAA CO-OPS API - free) ────

  let tidesCache: { data: any; timestamp: number; lat: string; lon: string } | null = null;
  const TIDES_CACHE_MS = 60 * 60 * 1000;

  fastify.get(
    "/tides",
    { onRequest: [fastify.authenticateKioskOrAny] },
    async (request) => {
      const userId = (request as any).user?.userId;
      const homeSettings = await getCategorySettings(fastify.db, "home", userId);
      const lat = homeSettings.latitude;
      const lon = homeSettings.longitude;

      if (!lat || !lon) {
        throw fastify.httpErrors.badRequest("Location not configured");
      }

      if (tidesCache && tidesCache.lat === lat && tidesCache.lon === lon && Date.now() - tidesCache.timestamp < TIDES_CACHE_MS) {
        return { success: true, data: tidesCache.data };
      }

      try {
        const stationRes = await fetch(
          `https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=tidepredictions&units=english`
        );

        if (stationRes.ok) {
          const stationsJson = (await stationRes.json()) as { stations: { id: string; name: string; lat: number; lng: number }[] };
          const stations = stationsJson.stations || [];

          const latNum = parseFloat(lat);
          const lonNum = parseFloat(lon);
          let nearest = stations[0];
          let minDist = Infinity;

          for (const s of stations) {
            const d = Math.pow(s.lat - latNum, 2) + Math.pow(s.lng - lonNum, 2);
            if (d < minDist) { minDist = d; nearest = s; }
          }

          if (nearest && minDist < 25) {
            const now = new Date();
            const begin = now.toISOString().slice(0, 10).replace(/-/g, "");
            const end = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString().slice(0, 10).replace(/-/g, "");

            const tideRes = await fetch(
              `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?begin_date=${begin}&end_date=${end}&station=${nearest.id}&product=predictions&datum=MLLW&time_zone=lst_ldt&interval=hilo&units=english&format=json`
            );

            if (tideRes.ok) {
              const tideJson = (await tideRes.json()) as { predictions: { t: string; v: string; type: string }[] };
              const tides = (tideJson.predictions || []).map((p) => ({
                time: p.t,
                height: parseFloat(p.v),
                type: p.type === "H" ? "high" : "low",
              }));

              const data = {
                station: { id: nearest.id, name: nearest.name, lat: nearest.lat, lon: nearest.lng },
                tides,
                source: "NOAA",
              };

              tidesCache = { data, timestamp: Date.now(), lat, lon };
              return { success: true, data };
            }
          }
        }

        return {
          success: true,
          data: { station: null, tides: [], source: "none", message: "No tide station found near your location" },
        };
      } catch (err: any) {
        return { success: true, data: { station: null, tides: [], source: "error", message: err.message } };
      }
    }
  );
};
