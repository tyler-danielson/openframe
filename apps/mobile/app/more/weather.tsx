import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../../hooks/useColorScheme";
import { api } from "../../services/api";
import { WeatherIcon } from "../../components/WeatherIcon";

export default function WeatherScreen() {
  const colors = useThemeColors();
  const { data: weather, isLoading, refetch } = useQuery({
    queryKey: ["weather"],
    queryFn: () => api.getWeather(),
    staleTime: 15 * 60 * 1000,
  });

  if (!weather && !isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center p-6">
        <Ionicons name="cloud-offline-outline" size={48} color={colors.mutedForeground} />
        <Text className="text-muted-foreground mt-4 text-center">Weather data not available</Text>
      </View>
    );
  }

  const current = weather?.current;
  const forecast = weather?.forecast ?? [];

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />
      }
    >
      {/* Current Conditions */}
      {current && (
        <View className="bg-card rounded-2xl p-6 items-center mb-6">
          <WeatherIcon icon={current.icon} size={64} color={colors.primary} />
          <Text className="text-foreground text-6xl font-bold mt-2">
            {Math.round(current.temp)}°
          </Text>
          <Text className="text-muted-foreground text-lg mt-1 capitalize">
            {current.description}
          </Text>
          {weather?.location && (
            <Text className="text-muted-foreground text-sm mt-1">{weather.location}</Text>
          )}

          {/* Details row */}
          <View className="flex-row mt-6 w-full justify-around">
            <DetailItem icon="thermometer-outline" label="Feels Like" value={`${Math.round(current.feelsLike)}°`} colors={colors} />
            <DetailItem icon="water-outline" label="Humidity" value={`${Math.round(current.humidity)}%`} colors={colors} />
            <DetailItem icon="speedometer-outline" label="Wind" value={`${Math.round(current.windSpeed)} mph`} colors={colors} />
          </View>

          {(current.tempMax != null && current.tempMin != null) && (
            <View className="flex-row mt-4">
              <Text className="text-foreground font-medium">
                H: {Math.round(current.tempMax)}°
              </Text>
              <Text className="text-muted-foreground mx-2">|</Text>
              <Text className="text-muted-foreground">
                L: {Math.round(current.tempMin)}°
              </Text>
            </View>
          )}
        </View>
      )}

      {/* 5-Day Forecast */}
      {forecast.length > 0 && (
        <View>
          <Text className="text-foreground font-semibold text-lg mb-3">Forecast</Text>
          <View className="bg-card rounded-2xl overflow-hidden">
            {forecast.map((day, index) => {
              const high = day.high ?? day.maxTemp ?? 0;
              const low = day.low ?? day.minTemp ?? 0;
              const dateStr = formatDay(day.date);

              return (
                <View
                  key={day.date}
                  className={`flex-row items-center px-4 py-3 ${
                    index < forecast.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <Text className="text-foreground w-16">{dateStr}</Text>
                  <WeatherIcon icon={day.icon} size={24} color={colors.primary} />
                  <Text className="text-muted-foreground text-sm flex-1 ml-3 capitalize" numberOfLines={1}>
                    {day.description}
                  </Text>
                  <Text className="text-foreground font-medium w-10 text-right">
                    {Math.round(high)}°
                  </Text>
                  <Text className="text-muted-foreground w-10 text-right">
                    {Math.round(low)}°
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function DetailItem({
  icon,
  label,
  value,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View className="items-center">
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text className="text-foreground font-medium mt-1">{value}</Text>
      <Text className="text-muted-foreground text-xs">{label}</Text>
    </View>
  );
}

function formatDay(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return "Today";
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === tomorrow.toDateString()) return "Tmrw";
    return date.toLocaleDateString("en-US", { weekday: "short" });
  } catch {
    return dateStr;
  }
}
