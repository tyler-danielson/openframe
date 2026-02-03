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
}

interface ForecastDay {
  date: string;
  temp_min: number;
  temp_max: number;
  description: string;
  icon: string;
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
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      // Try database settings first, fall back to env vars
      const dbSettings = await getCategorySettings(fastify.db, "weather");

      const apiKey = dbSettings.api_key || process.env.OPENWEATHERMAP_API_KEY;
      const lat = dbSettings.latitude || process.env.OPENWEATHERMAP_LAT;
      const lon = dbSettings.longitude || process.env.OPENWEATHERMAP_LON;
      const units = dbSettings.units || "imperial";

      if (!apiKey || !lat || !lon) {
        return reply.status(400).send({
          success: false,
          error: "Weather API not configured. Configure in Settings → System Settings → Weather.",
        });
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
        };

        // Update cache
        weatherCache = { data: weatherData, timestamp: Date.now() };

        return { success: true, data: weatherData };
      } catch (error) {
        fastify.log.error("Failed to fetch weather:", error);
        return reply.status(500).send({
          success: false,
          error: "Failed to fetch weather data",
        });
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
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      // Try database settings first, fall back to env vars
      const dbSettings = await getCategorySettings(fastify.db, "weather");

      const apiKey = dbSettings.api_key || process.env.OPENWEATHERMAP_API_KEY;
      const lat = dbSettings.latitude || process.env.OPENWEATHERMAP_LAT;
      const lon = dbSettings.longitude || process.env.OPENWEATHERMAP_LON;
      const units = dbSettings.units || "imperial";

      if (!apiKey || !lat || !lon) {
        return reply.status(400).send({
          success: false,
          error: "Weather API not configured",
        });
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
            });
          }
        }

        const forecast = Array.from(dailyData.values()).slice(0, 5);

        // Update cache
        forecastCache = { data: forecast, timestamp: Date.now() };

        return { success: true, data: forecast };
      } catch (error) {
        fastify.log.error("Failed to fetch forecast:", error);
        return reply.status(500).send({
          success: false,
          error: "Failed to fetch forecast data",
        });
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
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const dbSettings = await getCategorySettings(fastify.db, "weather");

      const apiKey = dbSettings.api_key || process.env.OPENWEATHERMAP_API_KEY;
      const lat = dbSettings.latitude || process.env.OPENWEATHERMAP_LAT;
      const lon = dbSettings.longitude || process.env.OPENWEATHERMAP_LON;
      const units = dbSettings.units || "imperial";

      if (!apiKey || !lat || !lon) {
        return reply.status(400).send({
          success: false,
          error: "Weather API not configured",
        });
      }

      // Check cache
      if (hourlyCache && Date.now() - hourlyCache.timestamp < CACHE_DURATION) {
        return { success: true, data: hourlyCache.data };
      }

      try {
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${units}`
        );

        if (!response.ok) {
          throw new Error(`OpenWeatherMap API error: ${response.status}`);
        }

        const data = (await response.json()) as OpenWeatherForecastResponse;

        // Get today's date at midnight for comparison
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Filter to only today's forecast entries
        const hourlyData: HourlyForecast[] = data.list
          .filter((item) => {
            const itemDate = new Date(item.dt * 1000);
            return itemDate >= today && itemDate < tomorrow;
          })
          .map((item) => ({
            time: new Date(item.dt * 1000).toLocaleTimeString("en-US", {
              hour: "numeric",
              hour12: true,
            }),
            temp: Math.round(item.main.temp),
            description: item.weather[0]?.description || "Unknown",
            icon: item.weather[0]?.icon || "01d",
            humidity: item.main.humidity,
            wind_speed: Math.round(item.wind.speed),
            pop: Math.round(item.pop * 100), // Convert 0-1 to percentage
            rain: item.rain?.["3h"],
            snow: item.snow?.["3h"],
          }));

        // Update cache
        hourlyCache = { data: hourlyData, timestamp: Date.now() };

        return { success: true, data: hourlyData };
      } catch (error) {
        fastify.log.error("Failed to fetch hourly forecast:", error);
        return reply.status(500).send({
          success: false,
          error: "Failed to fetch hourly forecast data",
        });
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
      // Check database settings first
      const dbSettings = await getCategorySettings(fastify.db, "weather");

      const apiKey = dbSettings.api_key || process.env.OPENWEATHERMAP_API_KEY;
      const lat = dbSettings.latitude || process.env.OPENWEATHERMAP_LAT;
      const lon = dbSettings.longitude || process.env.OPENWEATHERMAP_LON;

      return {
        success: true,
        configured: !!(apiKey && lat && lon),
      };
    }
  );
};
