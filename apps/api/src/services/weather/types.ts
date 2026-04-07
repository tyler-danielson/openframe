// Weather provider types and WMO weather code mapping

export interface WeatherData {
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

export interface ForecastDay {
  date: string;
  temp_min: number;
  temp_max: number;
  description: string;
  icon: string;
  units: "imperial" | "metric";
}

export interface HourlyForecast {
  time: string;
  temp: number;
  description: string;
  icon: string;
  humidity: number;
  wind_speed: number;
  pop: number;
  rain?: number;
  snow?: number;
  units: "imperial" | "metric";
}

export interface WeatherProvider {
  fetchAll(
    lat: number,
    lon: number,
    units: "imperial" | "metric",
    timezone: string
  ): Promise<{
    current: WeatherData;
    hourly: HourlyForecast[];
    daily: ForecastDay[];
  }>;
}

export interface CachedWeather {
  current: WeatherData;
  hourly: HourlyForecast[];
  daily: ForecastDay[];
  fetchedAt: number;
}

// WMO Weather Interpretation Codes (WW)
// https://open-meteo.com/en/docs

interface WmoMapping {
  description: string;
  icon_day: string;
  icon_night: string;
}

export const WMO_CODES: Record<number, WmoMapping> = {
  0: { description: "Clear sky", icon_day: "01d", icon_night: "01n" },
  1: { description: "Mainly clear", icon_day: "01d", icon_night: "01n" },
  2: { description: "Partly cloudy", icon_day: "02d", icon_night: "02n" },
  3: { description: "Overcast", icon_day: "04d", icon_night: "04n" },
  45: { description: "Fog", icon_day: "50d", icon_night: "50n" },
  48: { description: "Depositing rime fog", icon_day: "50d", icon_night: "50n" },
  51: { description: "Light drizzle", icon_day: "09d", icon_night: "09n" },
  53: { description: "Moderate drizzle", icon_day: "09d", icon_night: "09n" },
  55: { description: "Dense drizzle", icon_day: "09d", icon_night: "09n" },
  56: { description: "Light freezing drizzle", icon_day: "13d", icon_night: "13n" },
  57: { description: "Dense freezing drizzle", icon_day: "13d", icon_night: "13n" },
  61: { description: "Slight rain", icon_day: "10d", icon_night: "10n" },
  63: { description: "Moderate rain", icon_day: "10d", icon_night: "10n" },
  65: { description: "Heavy rain", icon_day: "10d", icon_night: "10n" },
  66: { description: "Light freezing rain", icon_day: "13d", icon_night: "13n" },
  67: { description: "Heavy freezing rain", icon_day: "13d", icon_night: "13n" },
  71: { description: "Slight snow", icon_day: "13d", icon_night: "13n" },
  73: { description: "Moderate snow", icon_day: "13d", icon_night: "13n" },
  75: { description: "Heavy snow", icon_day: "13d", icon_night: "13n" },
  77: { description: "Snow grains", icon_day: "13d", icon_night: "13n" },
  80: { description: "Slight rain showers", icon_day: "09d", icon_night: "09n" },
  81: { description: "Moderate rain showers", icon_day: "09d", icon_night: "09n" },
  82: { description: "Violent rain showers", icon_day: "09d", icon_night: "09n" },
  85: { description: "Slight snow showers", icon_day: "13d", icon_night: "13n" },
  86: { description: "Heavy snow showers", icon_day: "13d", icon_night: "13n" },
  95: { description: "Thunderstorm", icon_day: "11d", icon_night: "11n" },
  96: { description: "Thunderstorm with slight hail", icon_day: "11d", icon_night: "11n" },
  99: { description: "Thunderstorm with heavy hail", icon_day: "11d", icon_night: "11n" },
};
