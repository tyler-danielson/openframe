import { Ionicons } from "@expo/vector-icons";

const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
  "01d": "sunny",
  "01n": "moon",
  "02d": "partly-sunny",
  "02n": "cloudy-night",
  "03d": "cloud",
  "03n": "cloud",
  "04d": "cloud",
  "04n": "cloud",
  "09d": "rainy",
  "09n": "rainy",
  "10d": "rainy",
  "10n": "rainy",
  "11d": "thunderstorm",
  "11n": "thunderstorm",
  "13d": "snow",
  "13n": "snow",
  "50d": "cloud",
  "50n": "cloud",
  clear: "sunny",
  sunny: "sunny",
  "partly-cloudy": "partly-sunny",
  cloudy: "cloud",
  overcast: "cloud",
  rain: "rainy",
  drizzle: "rainy",
  snow: "snow",
  thunderstorm: "thunderstorm",
  fog: "cloud",
  mist: "cloud",
};

interface WeatherIconProps {
  icon: string;
  size?: number;
  color?: string;
}

export function WeatherIcon({ icon, size = 24, color }: WeatherIconProps) {
  const ionName = iconMap[icon] ?? "cloud";
  return <Ionicons name={ionName} size={size} color={color} />;
}
