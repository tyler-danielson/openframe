import { useState } from "react";
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { format, addDays, startOfDay, endOfDay } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useCalendars, useEvents, useCreateQuickEvent } from "../../hooks/useCalendarData";
import { useSelectedEventStore } from "../../stores/selectedEvent";
import { useThemeColors } from "../../hooks/useColorScheme";
import { EventCard } from "../../components/EventCard";
import { QuickInput } from "../../components/QuickInput";
import { WeatherIcon } from "../../components/WeatherIcon";
import { api } from "../../services/api";
import type { CalendarEvent } from "@openframe/shared";

export default function TodayScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { data: calendars, isLoading: calendarsLoading, refetch: refetchCalendars } = useCalendars();
  const { data: events, isLoading: eventsLoading, refetch: refetchEvents } = useEvents(new Date());
  const createQuickEvent = useCreateQuickEvent();
  const [showNews, setShowNews] = useState(true);

  const isLoading = calendarsLoading || eventsLoading;

  const setSelectedEvent = useSelectedEventStore((s) => s.setEvent);

  // Weather data
  const { data: weather } = useQuery({
    queryKey: ["weather"],
    queryFn: () => api.getWeather(),
    staleTime: 15 * 60 * 1000,
  });

  // Tasks for today
  const { data: tasks } = useQuery({
    queryKey: ["tasks-today"],
    queryFn: () => api.getTasks({ status: "needsAction" }),
    staleTime: 5 * 60 * 1000,
  });

  // News headlines
  const { data: news } = useQuery({
    queryKey: ["news"],
    queryFn: () => api.getNews(5),
    staleTime: 10 * 60 * 1000,
  });

  const onRefresh = async () => {
    await Promise.all([refetchCalendars(), refetchEvents()]);
  };

  // Group events by day
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const dayAfter = addDays(today, 2);

  const groupEvents = (events: CalendarEvent[], dayStart: Date) => {
    const dayEnd = endOfDay(dayStart);
    return events
      .filter((event) => {
        const eventStart = new Date(event.startTime);
        return eventStart >= dayStart && eventStart < dayEnd;
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  };

  const todayEvents = groupEvents(events, today);
  const tomorrowEvents = groupEvents(events, tomorrow);
  const upcomingEvents = groupEvents(events, dayAfter);

  const getCalendarColor = (calendarId: string) => {
    const calendar = calendars?.find((c) => c.id === calendarId);
    return calendar?.color || colors.primary;
  };

  const renderEventSection = (
    title: string,
    sectionEvents: CalendarEvent[],
    showEmpty = true
  ) => {
    if (sectionEvents.length === 0 && !showEmpty) return null;

    return (
      <View className="mb-6">
        <Text className="text-foreground font-semibold text-lg mb-3">{title}</Text>
        {sectionEvents.length === 0 ? (
          <View className="bg-card rounded-xl p-4 items-center">
            <Ionicons name="calendar-outline" size={32} color={colors.mutedForeground} />
            <Text className="text-muted-foreground mt-2">No events</Text>
          </View>
        ) : (
          <View className="space-y-2">
            {sectionEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                color={getCalendarColor(event.calendarId)}
                onPress={() => { setSelectedEvent(event); router.push(`/event/${event.id}`); }}
              />
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Date Header */}
        <View className="mb-4">
          <Text className="text-muted-foreground text-sm">
            {format(new Date(), "EEEE")}
          </Text>
          <Text className="text-foreground text-3xl font-bold">
            {format(new Date(), "MMMM d, yyyy")}
          </Text>
        </View>

        {/* Quick Event Input */}
        <View className="mb-6">
          <QuickInput
            placeholder="Quick add event... (e.g., 'Soccer at 4pm Tuesday')"
            onSubmit={async (text) => {
              await createQuickEvent.mutateAsync({ text });
            }}
            isLoading={createQuickEvent.isPending}
          />
        </View>

        {/* Weather Card */}
        {weather?.current && (
          <TouchableOpacity
            className="bg-card rounded-xl p-4 mb-6 flex-row items-center"
            onPress={() => router.push("/more/weather")}
            activeOpacity={0.7}
          >
            <WeatherIcon icon={weather.current.icon} size={40} color={colors.primary} />
            <View className="ml-4 flex-1">
              <Text className="text-foreground text-2xl font-bold">
                {Math.round(weather.current.temp)}°
              </Text>
              <Text className="text-muted-foreground text-sm">
                {weather.current.description} · {weather.location}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}

        {/* Tasks Summary */}
        {tasks && tasks.length > 0 && (
          <View className="bg-card rounded-xl p-4 mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-foreground font-semibold text-lg">Tasks</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/tasks")}>
                <Text className="text-primary text-sm font-medium">See all</Text>
              </TouchableOpacity>
            </View>
            {tasks.slice(0, 3).map((task) => (
              <View key={task.id} className="flex-row items-center py-1.5">
                <Ionicons
                  name="checkbox-outline"
                  size={18}
                  color={colors.mutedForeground}
                />
                <Text className="text-foreground ml-2 flex-1" numberOfLines={1}>
                  {task.title}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Events */}
        {renderEventSection("Today", todayEvents)}
        {renderEventSection("Tomorrow", tomorrowEvents, tomorrowEvents.length > 0)}
        {renderEventSection("Upcoming", upcomingEvents, upcomingEvents.length > 0)}

        {/* News Headlines */}
        {news && news.length > 0 && (
          <View className="mb-6">
            <TouchableOpacity
              className="flex-row items-center justify-between mb-3"
              onPress={() => setShowNews(!showNews)}
            >
              <Text className="text-foreground font-semibold text-lg">Headlines</Text>
              <Ionicons
                name={showNews ? "chevron-up" : "chevron-down"}
                size={20}
                color={colors.mutedForeground}
              />
            </TouchableOpacity>
            {showNews && (
              <View className="bg-card rounded-xl overflow-hidden">
                {news.slice(0, 3).map((article, index) => (
                  <TouchableOpacity
                    key={article.id}
                    className={`px-4 py-3 ${
                      index < Math.min(news.length, 3) - 1 ? "border-b border-border" : ""
                    }`}
                    onPress={() => router.push("/more/news")}
                  >
                    <Text className="text-foreground text-sm" numberOfLines={2}>
                      {article.title}
                    </Text>
                    {article.source && (
                      <Text className="text-primary text-xs mt-1">{article.source}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        className="absolute bottom-6 right-6 w-14 h-14 bg-primary rounded-full items-center justify-center shadow-lg"
        style={{
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
        onPress={() => router.push("/event/new")}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}
