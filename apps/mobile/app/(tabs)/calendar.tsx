import { useState, useMemo } from "react";
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Calendar, DateData } from "react-native-calendars";
import { Ionicons } from "@expo/vector-icons";
import { format, startOfDay, endOfDay, parseISO } from "date-fns";
import { useCalendars, useEvents } from "../../hooks/useCalendarData";
import { useCalendarStore } from "../../stores/calendar";
import { useThemeColors } from "../../hooks/useColorScheme";
import { EventCard } from "../../components/EventCard";
import type { CalendarEvent } from "@openframe/shared";

export default function CalendarScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { selectedDate, setSelectedDate } = useCalendarStore();
  const { data: calendars, isLoading: calendarsLoading, refetch: refetchCalendars } = useCalendars();
  const { data: events, isLoading: eventsLoading, refetch: refetchEvents } = useEvents(selectedDate);

  const isLoading = calendarsLoading || eventsLoading;

  const onRefresh = async () => {
    await Promise.all([refetchCalendars(), refetchEvents()]);
  };

  // Create marked dates object for the calendar
  const markedDates = useMemo(() => {
    const marked: Record<string, { dots: Array<{ key: string; color: string }> }> = {};

    events.forEach((event) => {
      const dateKey = format(new Date(event.startTime), "yyyy-MM-dd");
      const calendar = calendars?.find((c) => c.id === event.calendarId);
      const color = calendar?.color || colors.primary;

      if (!marked[dateKey]) {
        marked[dateKey] = { dots: [] };
      }

      // Limit to 3 dots per day
      if (marked[dateKey].dots.length < 3) {
        // Avoid duplicate colors
        if (!marked[dateKey].dots.some((d) => d.color === color)) {
          marked[dateKey].dots.push({ key: event.id, color });
        }
      }
    });

    // Add selected date marking
    const selectedKey = format(selectedDate, "yyyy-MM-dd");
    if (marked[selectedKey]) {
      (marked[selectedKey] as any).selected = true;
      (marked[selectedKey] as any).selectedColor = colors.primary;
    } else {
      (marked as any)[selectedKey] = {
        selected: true,
        selectedColor: colors.primary,
        dots: [],
      };
    }

    return marked;
  }, [events, calendars, selectedDate, colors.primary]);

  // Filter events for selected day
  const selectedDayEvents = useMemo(() => {
    const dayStart = startOfDay(selectedDate);
    const dayEnd = endOfDay(selectedDate);

    return events
      .filter((event) => {
        const eventStart = new Date(event.startTime);
        return eventStart >= dayStart && eventStart < dayEnd;
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [events, selectedDate]);

  const getCalendarColor = (calendarId: string) => {
    const calendar = calendars?.find((c) => c.id === calendarId);
    return calendar?.color || colors.primary;
  };

  const handleDayPress = (day: DateData) => {
    setSelectedDate(parseISO(day.dateString));
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Calendar */}
        <Calendar
          current={format(selectedDate, "yyyy-MM-dd")}
          onDayPress={handleDayPress}
          markingType="multi-dot"
          markedDates={markedDates}
          theme={{
            backgroundColor: colors.background,
            calendarBackground: colors.background,
            textSectionTitleColor: colors.mutedForeground,
            selectedDayBackgroundColor: colors.primary,
            selectedDayTextColor: "#FFFFFF",
            todayTextColor: colors.primary,
            dayTextColor: colors.foreground,
            textDisabledColor: colors.mutedForeground,
            monthTextColor: colors.foreground,
            arrowColor: colors.primary,
            textDayFontWeight: "500",
            textMonthFontWeight: "bold",
            textDayHeaderFontWeight: "600",
          }}
          enableSwipeMonths
        />

        {/* Selected Day Events */}
        <View className="px-4 py-4">
          <Text className="text-foreground font-semibold text-lg mb-3">
            {format(selectedDate, "EEEE, MMMM d")}
          </Text>

          {selectedDayEvents.length === 0 ? (
            <View className="bg-card rounded-xl p-6 items-center">
              <Ionicons name="calendar-outline" size={40} color={colors.mutedForeground} />
              <Text className="text-muted-foreground mt-3 text-center">
                No events scheduled
              </Text>
              <TouchableOpacity
                className="mt-4 bg-primary/10 rounded-lg px-4 py-2"
                onPress={() => router.push("/event/new")}
              >
                <Text className="text-primary font-medium">Add Event</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="space-y-2">
              {selectedDayEvents.map((event) => (
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
