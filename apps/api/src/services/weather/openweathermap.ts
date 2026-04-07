import type { WeatherProvider, WeatherData, HourlyForecast, ForecastDay } from "./types.js";

interface OWMCurrentResponse {
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    humidity: number;
  };
  weather: Array<{ description: string; icon: string }>;
  wind: { speed: number };
  name: string;
}

interface OWMForecastResponse {
  list: Array<{
    dt: number;
    main: {
      temp: number;
      temp_min: number;
      temp_max: number;
      humidity: number;
    };
    weather: Array<{ description: string; icon: string }>;
    wind: { speed: number };
    pop: number;
    rain?: { "3h": number };
    snow?: { "3h": number };
  }>;
}

export class OpenWeatherMapProvider implements WeatherProvider {
  constructor(private apiKey: string) {}

  async fetchAll(
    lat: number,
    lon: number,
    units: "imperial" | "metric",
    timezone: string
  ) {
    const [currentRes, forecastRes] = await Promise.all([
      fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=${units}`
      ),
      fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=${units}`
      ),
    ]);

    if (!currentRes.ok) {
      throw new Error(`OpenWeatherMap current error: ${currentRes.status}`);
    }
    if (!forecastRes.ok) {
      throw new Error(`OpenWeatherMap forecast error: ${forecastRes.status}`);
    }

    const currentData = (await currentRes.json()) as OWMCurrentResponse;
    const forecastData = (await forecastRes.json()) as OWMForecastResponse;

    // Current conditions
    const current: WeatherData = {
      temp: Math.round(currentData.main.temp),
      feels_like: Math.round(currentData.main.feels_like),
      temp_min: Math.round(currentData.main.temp_min),
      temp_max: Math.round(currentData.main.temp_max),
      humidity: currentData.main.humidity,
      description: currentData.weather[0]?.description || "Unknown",
      icon: currentData.weather[0]?.icon || "01d",
      wind_speed: Math.round(currentData.wind.speed),
      city: currentData.name,
      units,
    };

    // Hourly from 3-hour forecast — filter to future entries
    const tz = timezone || "UTC";
    const nowMs = Date.now();

    // Get today's date in user timezone
    const todayParts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(nowMs));
    const todayStr = `${todayParts.find((p) => p.type === "year")!.value}-${todayParts.find((p) => p.type === "month")!.value}-${todayParts.find((p) => p.type === "day")!.value}`;

    const dateInTz = (dtSec: number) => {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date(dtSec * 1000));
      return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}-${parts.find((p) => p.type === "day")!.value}`;
    };

    const hourLabel = (dtSec: number) =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "numeric",
        hour12: true,
      }).format(new Date(dtSec * 1000));

    const hourly: HourlyForecast[] = forecastData.list
      .filter((item) => item.dt * 1000 >= nowMs && dateInTz(item.dt) === todayStr)
      .slice(0, 12)
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

    // Daily — group 3-hour forecasts by day
    const dailyMap = new Map<string, ForecastDay>();
    for (const item of forecastData.list) {
      const d = new Date(item.dt * 1000);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const existing = dailyMap.get(date);
      if (existing) {
        existing.temp_min = Math.min(existing.temp_min, Math.round(item.main.temp_min));
        existing.temp_max = Math.max(existing.temp_max, Math.round(item.main.temp_max));
      } else {
        dailyMap.set(date, {
          date,
          temp_min: Math.round(item.main.temp_min),
          temp_max: Math.round(item.main.temp_max),
          description: item.weather[0]?.description || "Unknown",
          icon: item.weather[0]?.icon || "01d",
          units,
        });
      }
    }
    const daily = Array.from(dailyMap.values()).slice(0, 5);

    return { current, hourly, daily };
  }
}
