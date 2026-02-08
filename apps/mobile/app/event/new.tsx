import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { format, addHours, startOfHour, setHours, setMinutes } from "date-fns";
import { useCreateEvent, useCreateQuickEvent, useCalendars } from "../../hooks/useCalendarData";
import { useCalendarStore } from "../../stores/calendar";
import { useThemeColors } from "../../hooks/useColorScheme";
import { CalendarPicker } from "../../components/CalendarPicker";
import { DateTimePicker } from "../../components/DateTimePicker";

export default function NewEventScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { data: calendars } = useCalendars();
  const { selectedDate } = useCalendarStore();
  const createEvent = useCreateEvent();
  const createQuickEvent = useCreateQuickEvent();

  // Quick input mode
  const [isQuickMode, setIsQuickMode] = useState(true);
  const [quickText, setQuickText] = useState("");

  // Manual mode
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);

  // Date/time - default to selected date at current hour + 1
  const defaultStart = setMinutes(setHours(selectedDate, new Date().getHours() + 1), 0);
  const [startTime, setStartTime] = useState(defaultStart);
  const [endTime, setEndTime] = useState(addHours(defaultStart, 1));

  // Calendar selection - default to primary or first writable calendar
  const defaultCalendar = calendars?.find((c) => c.isPrimary && !c.isReadOnly) ||
    calendars?.find((c) => !c.isReadOnly);
  const [selectedCalendarId, setSelectedCalendarId] = useState(defaultCalendar?.id || "");
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);

  // Date pickers
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const selectedCalendar = calendars?.find((c) => c.id === selectedCalendarId);

  const handleQuickCreate = async () => {
    if (!quickText.trim()) {
      Alert.alert("Error", "Please enter event details");
      return;
    }

    try {
      await createQuickEvent.mutateAsync({
        text: quickText,
        calendarId: selectedCalendarId || undefined,
      });
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create event";
      Alert.alert("Error", message);
    }
  };

  const handleManualCreate = async () => {
    if (!title.trim()) {
      Alert.alert("Error", "Please enter a title");
      return;
    }

    if (!selectedCalendarId) {
      Alert.alert("Error", "Please select a calendar");
      return;
    }

    try {
      await createEvent.mutateAsync({
        calendarId: selectedCalendarId,
        title: title.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        startTime,
        endTime,
        isAllDay,
      });
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create event";
      Alert.alert("Error", message);
    }
  };

  const isCreating = createEvent.isPending || createQuickEvent.isPending;

  return (
    <>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <Text className="text-primary">Cancel</Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={isQuickMode ? handleQuickCreate : handleManualCreate}
              disabled={isCreating}
            >
              {isCreating ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text className="text-primary font-semibold">Create</Text>
              )}
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16 }}>
        {/* Mode Toggle */}
        <View className="flex-row bg-card rounded-xl p-1 mb-6">
          <TouchableOpacity
            className={`flex-1 py-2 rounded-lg ${isQuickMode ? "bg-primary" : ""}`}
            onPress={() => setIsQuickMode(true)}
          >
            <Text
              className={`text-center font-medium ${
                isQuickMode ? "text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              Quick Input
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-2 rounded-lg ${!isQuickMode ? "bg-primary" : ""}`}
            onPress={() => setIsQuickMode(false)}
          >
            <Text
              className={`text-center font-medium ${
                !isQuickMode ? "text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              Manual
            </Text>
          </TouchableOpacity>
        </View>

        {/* Calendar Selector */}
        <TouchableOpacity
          className="flex-row items-center justify-between bg-card rounded-xl p-4 mb-4"
          onPress={() => setShowCalendarPicker(true)}
        >
          <View className="flex-row items-center">
            <View
              className="w-3 h-3 rounded-full mr-3"
              style={{ backgroundColor: selectedCalendar?.color || colors.primary }}
            />
            <Text className="text-foreground">
              {selectedCalendar?.name || "Select calendar"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>

        {isQuickMode ? (
          /* Quick Input Mode */
          <View>
            <Text className="text-muted-foreground mb-2">
              Describe your event in natural language
            </Text>
            <TextInput
              className="bg-card rounded-xl p-4 text-foreground min-h-[120px] border border-border"
              placeholder="e.g., Lunch with John tomorrow at noon at Cafe Blue"
              placeholderTextColor={colors.mutedForeground}
              value={quickText}
              onChangeText={setQuickText}
              multiline
              textAlignVertical="top"
              autoFocus
            />
            <Text className="text-muted-foreground text-sm mt-2">
              Try: "Team meeting next Monday at 2pm" or "Dentist appointment on Friday at 10:30am"
            </Text>
          </View>
        ) : (
          /* Manual Mode */
          <View className="space-y-4">
            {/* Title */}
            <TextInput
              className="bg-card rounded-xl p-4 text-foreground border border-border"
              placeholder="Event title"
              placeholderTextColor={colors.mutedForeground}
              value={title}
              onChangeText={setTitle}
              autoFocus
            />

            {/* All Day Toggle */}
            <View className="flex-row items-center justify-between bg-card rounded-xl p-4">
              <Text className="text-foreground">All-day</Text>
              <Switch
                value={isAllDay}
                onValueChange={setIsAllDay}
                trackColor={{ false: colors.border, true: colors.primary + "80" }}
                thumbColor={isAllDay ? colors.primary : colors.mutedForeground}
              />
            </View>

            {/* Start Time */}
            <TouchableOpacity
              className="flex-row items-center justify-between bg-card rounded-xl p-4"
              onPress={() => setShowStartPicker(true)}
            >
              <View className="flex-row items-center">
                <Ionicons name="time-outline" size={20} color={colors.mutedForeground} />
                <Text className="text-foreground ml-3">Starts</Text>
              </View>
              <Text className="text-primary">
                {isAllDay
                  ? format(startTime, "EEE, MMM d")
                  : format(startTime, "EEE, MMM d, h:mm a")}
              </Text>
            </TouchableOpacity>

            {/* End Time */}
            <TouchableOpacity
              className="flex-row items-center justify-between bg-card rounded-xl p-4"
              onPress={() => setShowEndPicker(true)}
            >
              <View className="flex-row items-center">
                <Ionicons name="time-outline" size={20} color={colors.mutedForeground} />
                <Text className="text-foreground ml-3">Ends</Text>
              </View>
              <Text className="text-primary">
                {isAllDay
                  ? format(endTime, "EEE, MMM d")
                  : format(endTime, "EEE, MMM d, h:mm a")}
              </Text>
            </TouchableOpacity>

            {/* Location */}
            <View className="flex-row items-center bg-card rounded-xl p-4 border border-border">
              <Ionicons name="location-outline" size={20} color={colors.mutedForeground} />
              <TextInput
                className="flex-1 text-foreground ml-3"
                placeholder="Add location"
                placeholderTextColor={colors.mutedForeground}
                value={location}
                onChangeText={setLocation}
              />
            </View>

            {/* Description */}
            <View className="bg-card rounded-xl p-4 border border-border">
              <View className="flex-row items-start">
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color={colors.mutedForeground}
                  style={{ marginTop: 2 }}
                />
                <TextInput
                  className="flex-1 text-foreground ml-3 min-h-[80px]"
                  placeholder="Add description"
                  placeholderTextColor={colors.mutedForeground}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  textAlignVertical="top"
                />
              </View>
            </View>
          </View>
        )}

        {/* Calendar Picker Modal */}
        <CalendarPicker
          visible={showCalendarPicker}
          onClose={() => setShowCalendarPicker(false)}
          calendars={calendars?.filter((c) => !c.isReadOnly) || []}
          selectedId={selectedCalendarId}
          onSelect={(id) => {
            setSelectedCalendarId(id);
            setShowCalendarPicker(false);
          }}
        />

        {/* Date Time Pickers */}
        <DateTimePicker
          visible={showStartPicker}
          value={startTime}
          mode={isAllDay ? "date" : "datetime"}
          onConfirm={(date) => {
            setStartTime(date);
            // Auto-adjust end time if it's before start
            if (date >= endTime) {
              setEndTime(addHours(date, 1));
            }
            setShowStartPicker(false);
          }}
          onCancel={() => setShowStartPicker(false)}
        />

        <DateTimePicker
          visible={showEndPicker}
          value={endTime}
          mode={isAllDay ? "date" : "datetime"}
          minimumDate={startTime}
          onConfirm={(date) => {
            setEndTime(date);
            setShowEndPicker(false);
          }}
          onCancel={() => setShowEndPicker(false)}
        />
      </ScrollView>
    </>
  );
}
