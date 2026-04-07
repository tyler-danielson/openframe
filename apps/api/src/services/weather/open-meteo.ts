import type { WeatherProvider, WeatherData, HourlyForecast, ForecastDay } from "./types.js";
import { WMO_CODES } from "./types.js";

export class OpenMeteoProvider implements WeatherProvider {
  async fetchAll(
    lat: number,
    lon: number,
    units: "imperial" | "metric",
    timezone: string
  ) {
    const tempUnit = units === "imperial" ? "fahrenheit" : "celsius";
    const windUnit = units === "imperial" ? "mph" : "kmh";
    const precipUnit = units === "imperial" ? "inch" : "mm";

    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", lat.toFixed(2));
    url.searchParams.set("longitude", lon.toFixed(2));
    url.searchParams.set(
      "current",
      "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day"
    );
    url.searchParams.set(
      "hourly",
      "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation_probability,precipitation,snowfall,is_day"
    );
    url.searchParams.set(
      "daily",
      "temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum"
    );
    url.searchParams.set("temperature_unit", tempUnit);
    url.searchParams.set("wind_speed_unit", windUnit);
    url.searchParams.set("precipitation_unit", precipUnit);
    url.searchParams.set("timezone", timezone || "auto");
    url.searchParams.set("forecast_days", "7");

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Open-Meteo error: ${response.status}`);
    }
    const data = await response.json();

    // Parse current conditions
    const weatherCode = data.current.weather_code ?? 0;
    const isDay = data.current.is_day === 1;
    const wmo = WMO_CODES[weatherCode] ?? WMO_CODES[0]!;

    const current: WeatherData = {
      temp: Math.round(data.current.temperature_2m),
      feels_like: Math.round(data.current.apparent_temperature),
      temp_min: Math.round(data.daily.temperature_2m_min[0]),
      temp_max: Math.round(data.daily.temperature_2m_max[0]),
      humidity: data.current.relative_humidity_2m,
      description: wmo.description,
      icon: isDay ? wmo.icon_day : wmo.icon_night,
      wind_speed: Math.round(data.current.wind_speed_10m),
      city: "", // Resolved separately via geocoding
      units,
    };

    // Parse hourly — next 24 hours from now
    const now = new Date();
    const hourly: HourlyForecast[] = [];
    for (let i = 0; i < data.hourly.time.length && hourly.length < 24; i++) {
      const hourTime = new Date(data.hourly.time[i]);
      if (hourTime < now) continue;

      const hCode = data.hourly.weather_code[i] ?? 0;
      const hIsDay = data.hourly.is_day?.[i] === 1;
      const hWmo = WMO_CODES[hCode] ?? WMO_CODES[0]!;

      hourly.push({
        time: data.hourly.time[i],
        temp: Math.round(data.hourly.temperature_2m[i]),
        description: hWmo.description,
        icon: hIsDay ? hWmo.icon_day : hWmo.icon_night,
        humidity: data.hourly.relative_humidity_2m[i],
        wind_speed: Math.round(data.hourly.wind_speed_10m[i]),
        pop: data.hourly.precipitation_probability[i] ?? 0,
        rain: data.hourly.precipitation[i] || undefined,
        snow: data.hourly.snowfall[i] || undefined,
        units,
      });
    }

    // Parse daily
    const daily: ForecastDay[] = data.daily.time.map(
      (date: string, i: number) => {
        const dCode = data.daily.weather_code[i] ?? 0;
        const dWmo = WMO_CODES[dCode] ?? WMO_CODES[0]!;
        return {
          date,
          temp_min: Math.round(data.daily.temperature_2m_min[i]),
          temp_max: Math.round(data.daily.temperature_2m_max[i]),
          description: dWmo.description,
          icon: dWmo.icon_day,
          units,
        };
      }
    );

    return { current, hourly, daily };
  }
}
