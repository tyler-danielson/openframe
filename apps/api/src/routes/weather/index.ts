import type { FastifyPluginAsync } from "fastify";
import { getCategorySettings } from "../settings/index.js";

interface WeatherData {
  temp: number;
  feels_like: number;
  temp_min: number;
  temp_max: number;
  humidity: number;
  description: string;
  icon: string;
  wind_speed: number;
  city: string;
  units: "imperial" | "metric";
}

interface ForecastDay {
  date: string;
  temp_min: number;
  temp_max: number;
  description: string;
  icon: string;
  units: "imperial" | "metric";
}

interface HourlyForecast {
  time: string;
  temp: number;
  description: string;
  icon: string;
  humidity: number;
  wind_speed: number;
  pop: number; // Probability of precipitation (0-100%)
  rain?: number; // Rain volume in mm
  snow?: number; // Snow volume in mm
  units: "imperial" | "metric";
}

interface OpenWeatherResponse {
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    humidity: number;
  };
  weather: Array<{
    description: string;
    icon: string;
  }>;
  wind: {
    speed: number;
  };
  name: string;
}

interface OpenWeatherForecastResponse {
  list: Array<{
    dt: number;
    main: {
      temp: number;
      temp_min: number;
      temp_max: number;
      humidity: number;
    };
    weather: Array<{
      description: string;
      icon: string;
    }>;
    wind: {
      speed: number;
    };
    pop: number; // Probability of precipitation (0-1)
    rain?: {
      "3h": number; // Rain volume for last 3 hours in mm
    };
    snow?: {
      "3h": number; // Snow volume for last 3 hours in mm
    };
  }>;
}

// Cache weather data for 10 minutes to avoid excessive API calls
let weatherCache: { data: WeatherData; timestamp: number } | null = null;
let forecastCache: { data: ForecastDay[]; timestamp: number } | null = null;
let hourlyCache: { data: HourlyForecast[]; timestamp: number } | null = null;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export const weatherRoutes: FastifyPluginAsync = async (fastify) => {
  // Get current weather
  fastify.get(
    "/current",
    {
      schema: {
        description: "Get current weather data",
        tags: ["Weather"],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  temp: { type: "number" },
                  feels_like: { type: "number" },
                  temp_min: { type: "number" },
                  temp_max: { type: "number" },
                  humidity: { type: "number" },
                  description: { type: "string" },
                  icon: { type: "string" },
                  wind_speed: { type: "number" },
                  city: { type: "string" },
                  units: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      // Get weather settings and home location settings
      const weatherSettings = await getCategorySettings(fastify.db, "weather");
      const homeSettings = await getCategorySettings(fastify.db, "home");

      const apiKey = weatherSettings.api_key || process.env.OPENWEATHERMAP_API_KEY;
      const lat = homeSettings.latitude || process.env.OPENWEATHERMAP_LAT;
      const lon = homeSettings.longitude || process.env.OPENWEATHERMAP_LON;
      const units = weatherSettings.units || "imperial";

      if (!apiKey) {
        throw fastify.httpErrors.badRequest("Weather API not configured. Configure in Settings → System Settings → Weather.");
      }

      if (!lat || !lon) {
        throw fastify.httpErrors.badRequest("Home location not configured. Configure in Settings → System Settings → Home Location.");
      }

      // Check cache
      if (weatherCache && Date.now() - weatherCache.timestamp < CACHE_DURATION) {
        return { success: true, data: weatherCache.data };
      }

      try {
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${units}`
        );

        if (!response.ok) {
          throw new Error(`OpenWeatherMap API error: ${response.status}`);
        }

        const data = (await response.json()) as OpenWeatherResponse;

        const weatherData: WeatherData = {
          temp: Math.round(data.main.temp),
          feels_like: Math.round(data.main.feels_like),
          temp_min: Math.round(data.main.temp_min),
          temp_max: Math.round(data.main.temp_max),
          humidity: data.main.humidity,
          description: data.weather[0]?.description || "Unknown",
          icon: data.weather[0]?.icon || "01d",
          wind_speed: Math.round(data.wind.speed),
          city: data.name,
          units: units as "imperial" | "metric",
        };

        // Update cache
        weatherCache = { data: weatherData, timestamp: Date.now() };

        return { success: true, data: weatherData };
      } catch (error) {
        fastify.log.error({ err: error }, "Failed to fetch weather");
        throw fastify.httpErrors.internalServerError("Failed to fetch weather data");
      }
    }
  );

  // Get weather forecast (5 days)
  fastify.get(
    "/forecast",
    {
      schema: {
        description: "Get 5-day weather forecast",
        tags: ["Weather"],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    date: { type: "string" },
                    temp_min: { type: "number" },
                    temp_max: { type: "number" },
                    description: { type: "string" },
                    icon: { type: "string" },
                    units: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      // Get weather settings and home location settings
      const weatherSettings = await getCategorySettings(fastify.db, "weather");
      const homeSettings = await getCategorySettings(fastify.db, "home");

      const apiKey = weatherSettings.api_key || process.env.OPENWEATHERMAP_API_KEY;
      const lat = homeSettings.latitude || process.env.OPENWEATHERMAP_LAT;
      const lon = homeSettings.longitude || process.env.OPENWEATHERMAP_LON;
      const units = (weatherSettings.units || "imperial") as "imperial" | "metric";

      if (!apiKey) {
        throw fastify.httpErrors.badRequest("Weather API not configured");
      }

      if (!lat || !lon) {
        throw fastify.httpErrors.badRequest("Home location not configured");
      }

      // Check cache
      if (forecastCache && Date.now() - forecastCache.timestamp < CACHE_DURATION) {
        return { success: true, data: forecastCache.data };
      }

      try {
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${units}`
        );

        if (!response.ok) {
          throw new Error(`OpenWeatherMap API error: ${response.status}`);
        }

        const data = (await response.json()) as OpenWeatherForecastResponse;

        // Group by day and get min/max temps
        const dailyData = new Map<string, ForecastDay>();

        for (const item of data.list) {
          const date = new Date(item.dt * 1000).toLocaleDateString("en-US", {
            weekday: "short",
          });

          const existing = dailyData.get(date);
          if (existing) {
            existing.temp_min = Math.min(existing.temp_min, Math.round(item.main.temp_min));
            existing.temp_max = Math.max(existing.temp_max, Math.round(item.main.temp_max));
          } else {
            dailyData.set(date, {
              date,
              temp_min: Math.round(item.main.temp_min),
              temp_max: Math.round(item.main.temp_max),
              description: item.weather[0]?.description || "Unknown",
              icon: item.weather[0]?.icon || "01d",
              units,
            });
          }
        }

        const forecast = Array.from(dailyData.values()).slice(0, 5);

        // Update cache
        forecastCache = { data: forecast, timestamp: Date.now() };

        return { success: true, data: forecast };
      } catch (error) {
        fastify.log.error({ err: error }, "Failed to fetch forecast");
        throw fastify.httpErrors.internalServerError("Failed to fetch forecast data");
      }
    }
  );

  // Get hourly forecast for today
  fastify.get(
    "/hourly",
    {
      schema: {
        description: "Get hourly weather forecast for today",
        tags: ["Weather"],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    time: { type: "string" },
                    temp: { type: "number" },
                    description: { type: "string" },
                    icon: { type: "string" },
                    humidity: { type: "number" },
                    wind_speed: { type: "number" },
                    pop: { type: "number" },
                    rain: { type: "number" },
                    snow: { type: "number" },
                    units: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      // Get weather settings and home location settings
      const weatherSettings = await getCategorySettings(fastify.db, "weather");
      const homeSettings = await getCategorySettings(fastify.db, "home");

      const apiKey = weatherSettings.api_key || process.env.OPENWEATHERMAP_API_KEY;
      const lat = homeSettings.latitude || process.env.OPENWEATHERMAP_LAT;
      const lon = homeSettings.longitude || process.env.OPENWEATHERMAP_LON;
      const units = (weatherSettings.units || "imperial") as "imperial" | "metric";

      if (!apiKey) {
        throw fastify.httpErrors.badRequest("Weather API not configured");
      }

      if (!lat || !lon) {
        throw fastify.httpErrors.badRequest("Home location not configured");
      }

      // Check cache
      if (hourlyCache && Date.now() - hourlyCache.timestamp < CACHE_DURATION) {
        return { success: true, data: hourlyCache.data };
      }

      // Use the user's configured timezone (from home settings) for hour filtering/formatting
      const tz = (homeSettings.timezone as string) || "UTC";
      const nowMs = Date.now();

      // Get today's date string in the user's timezone (e.g. "2026-03-02")
      const todayParts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
      }).formatToParts(new Date(nowMs));
      const todayStr = `${todayParts.find((p) => p.type === "year")!.value}-${todayParts.find((p) => p.type === "month")!.value}-${todayParts.find((p) => p.type === "day")!.value}`;

      // Helper: get date string in user's TZ for a unix timestamp
      const dateInTz = (dtSec: number) => {
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
        }).formatToParts(new Date(dtSec * 1000));
        return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}-${parts.find((p) => p.type === "day")!.value}`;
      };

      // Helper: format hour label in user's TZ (e.g. "6 PM")
      const hourLabel = (dtSec: number) =>
        new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: true }).format(new Date(dtSec * 1000));

      // Try OneCall API 3.0 first (provides true hourly data, free for 1000 calls/day)
      try {
        const oneCallResponse = await fetch(
          `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${units}&exclude=minutely,daily,alerts`
        );

        if (oneCallResponse.ok) {
          const oneCallData = (await oneCallResponse.json()) as {
            hourly: Array<{
              dt: number;
              temp: number;
              humidity: number;
              wind_speed: number;
              weather: Array<{ description: string; icon: string }>;
              pop: number;
              rain?: { "1h": number };
              snow?: { "1h": number };
            }>;
          };

          const hourlyData: HourlyForecast[] = oneCallData.hourly
            .filter((item) => {
              // Only include future hours that are still "today" in the user's timezone
              return item.dt * 1000 >= nowMs && dateInTz(item.dt) === todayStr;
            })
            .slice(0, 12)
            .map((item) => ({
              time: hourLabel(item.dt),
              temp: Math.round(item.temp),
              description: item.weather[0]?.description || "Unknown",
              icon: item.weather[0]?.icon || "01d",
              humidity: item.humidity,
              wind_speed: Math.round(item.wind_speed),
              pop: Math.round(item.pop * 100),
              rain: item.rain?.["1h"],
              snow: item.snow?.["1h"],
              units,
            }));

          hourlyCache = { data: hourlyData, timestamp: Date.now() };
          return { success: true, data: hourlyData };
        }
        // OneCall not available (401/403), fall through to 3-hour forecast
      } catch {
        // OneCall failed, fall through to 3-hour forecast
      }

      // Fallback: 3-hour forecast API
      try {
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${units}`
        );

        if (!response.ok) {
          throw new Error(`OpenWeatherMap API error: ${response.status}`);
        }

        const data = (await response.json()) as OpenWeatherForecastResponse;

        // Filter to only future entries for the rest of today in user's timezone
        const hourlyData: HourlyForecast[] = data.list
          .filter((item) => {
            return item.dt * 1000 >= nowMs && dateInTz(item.dt) === todayStr;
          })
          .map((item) => ({
            time: hourLabel(item.dt),
            temp: Math.round(item.main.temp),
            description: item.weather[0]?.description || "Unknown",
            icon: item.weather[0]?.icon || "01d",
            humidity: item.main.humidity,
            wind_speed: Math.round(item.wind.speed),
            pop: Math.round(item.pop * 100),
            rain: item.rain?.["3h"],
            snow: item.snow?.["3h"],
            units,
          }));

        // Update cache
        hourlyCache = { data: hourlyData, timestamp: Date.now() };

        return { success: true, data: hourlyData };
      } catch (error) {
        fastify.log.error({ err: error }, "Failed to fetch hourly forecast");
        throw fastify.httpErrors.internalServerError("Failed to fetch hourly forecast data");
      }
    }
  );

  // Get weather configuration status
  fastify.get(
    "/status",
    {
      schema: {
        description: "Check if weather API is configured",
        tags: ["Weather"],
      },
    },
    async () => {
      // Check weather settings and home location settings
      const weatherSettings = await getCategorySettings(fastify.db, "weather");
      const homeSettings = await getCategorySettings(fastify.db, "home");

      const apiKey = weatherSettings.api_key || process.env.OPENWEATHERMAP_API_KEY;
      const lat = homeSettings.latitude || process.env.OPENWEATHERMAP_LAT;
      const lon = homeSettings.longitude || process.env.OPENWEATHERMAP_LON;

      return {
        success: true,
        configured: !!(apiKey && lat && lon),
      };
    }
  );
};
