import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { format, isToday, isTomorrow, addDays, startOfDay, endOfDay } from "date-fns";
import { useCalendars, useEvents } from "../../hooks/useCalendarData";
import { useCalendarStore } from "../../stores/calendar";
import { useThemeColors } from "../../hooks/useColorScheme";
import { EventCard } from "../../components/EventCard";
import type { CalendarEvent } from "@openframe/shared";

export default function TodayScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { data: calendars, isLoading: calendarsLoading, refetch: refetchCalendars } = useCalendars();
  const { data: events, isLoading: eventsLoading, refetch: refetchEvents } = useEvents(new Date());

  const isLoading = calendarsLoading || eventsLoading;

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
                onPress={() => router.push(`/event/${event.id}`)}
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
        <View className="mb-6">
          <Text className="text-muted-foreground text-sm">
            {format(new Date(), "EEEE")}
          </Text>
          <Text className="text-foreground text-3xl font-bold">
            {format(new Date(), "MMMM d, yyyy")}
          </Text>
        </View>

        {/* Events */}
        {renderEventSection("Today", todayEvents)}
        {renderEventSection("Tomorrow", tomorrowEvents, tomorrowEvents.length > 0)}
        {renderEventSection("Upcoming", upcomingEvents, upcomingEvents.length > 0)}
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
