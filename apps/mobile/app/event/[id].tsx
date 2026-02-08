import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { useEvent, useUpdateEvent, useDeleteEvent, useCalendars } from "../../hooks/useCalendarData";
import { useThemeColors } from "../../hooks/useColorScheme";

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();

  const { data: event, isLoading } = useEvent(id);
  const { data: calendars } = useCalendars();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();

  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [editedLocation, setEditedLocation] = useState("");

  const calendar = calendars?.find((c) => c.id === event?.calendarId);

  const handleEdit = () => {
    if (event) {
      setEditedTitle(event.title);
      setEditedDescription(event.description || "");
      setEditedLocation(event.location || "");
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    if (!event) return;

    try {
      await updateEvent.mutateAsync({
        id: event.id,
        data: {
          title: editedTitle,
          description: editedDescription || null,
          location: editedLocation || null,
        },
      });
      setIsEditing(false);
    } catch (error) {
      Alert.alert("Error", "Failed to update event");
    }
  };

  const handleDelete = () => {
    Alert.alert("Delete Event", "Are you sure you want to delete this event?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteEvent.mutateAsync(id);
            router.back();
          } catch (error) {
            Alert.alert("Error", "Failed to delete event");
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!event) {
    return (
      <View className="flex-1 bg-background items-center justify-center p-6">
        <Ionicons name="calendar-outline" size={48} color={colors.mutedForeground} />
        <Text className="text-foreground text-lg font-semibold mt-4">Event not found</Text>
        <TouchableOpacity className="mt-4" onPress={() => router.back()}>
          <Text className="text-primary">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const formatEventTime = () => {
    const start = new Date(event.startTime);
    const end = new Date(event.endTime);

    if (event.isAllDay) {
      return format(start, "EEEE, MMMM d, yyyy");
    }

    const sameDay = format(start, "yyyy-MM-dd") === format(end, "yyyy-MM-dd");

    if (sameDay) {
      return `${format(start, "EEEE, MMMM d, yyyy")}\n${format(start, "h:mm a")} - ${format(end, "h:mm a")}`;
    }

    return `${format(start, "MMM d, h:mm a")} - ${format(end, "MMM d, h:mm a")}`;
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () =>
            isEditing ? (
              <View className="flex-row">
                <TouchableOpacity onPress={() => setIsEditing(false)} className="mr-4">
                  <Text className="text-muted-foreground">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSave} disabled={updateEvent.isPending}>
                  {updateEvent.isPending ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text className="text-primary font-semibold">Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={handleEdit}>
                <Text className="text-primary">Edit</Text>
              </TouchableOpacity>
            ),
        }}
      />

      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16 }}>
        {/* Calendar Badge */}
        {calendar && (
          <View className="flex-row items-center mb-4">
            <View
              className="w-3 h-3 rounded-full mr-2"
              style={{ backgroundColor: calendar.color }}
            />
            <Text className="text-muted-foreground">{calendar.name}</Text>
          </View>
        )}

        {/* Title */}
        {isEditing ? (
          <TextInput
            className="text-foreground text-2xl font-bold mb-4 p-3 bg-card rounded-xl border border-border"
            value={editedTitle}
            onChangeText={setEditedTitle}
            placeholder="Event title"
            placeholderTextColor={colors.mutedForeground}
          />
        ) : (
          <Text className="text-foreground text-2xl font-bold mb-4">{event.title}</Text>
        )}

        {/* Time */}
        <View className="flex-row items-start mb-4">
          <View className="w-10 items-center">
            <Ionicons name="time-outline" size={20} color={colors.mutedForeground} />
          </View>
          <View className="flex-1">
            <Text className="text-foreground">{formatEventTime()}</Text>
            {event.isAllDay && (
              <Text className="text-muted-foreground text-sm mt-1">All day</Text>
            )}
          </View>
        </View>

        {/* Location */}
        {isEditing ? (
          <View className="flex-row items-start mb-4">
            <View className="w-10 items-center pt-3">
              <Ionicons name="location-outline" size={20} color={colors.mutedForeground} />
            </View>
            <TextInput
              className="flex-1 text-foreground p-3 bg-card rounded-xl border border-border"
              value={editedLocation}
              onChangeText={setEditedLocation}
              placeholder="Add location"
              placeholderTextColor={colors.mutedForeground}
            />
          </View>
        ) : event.location ? (
          <View className="flex-row items-start mb-4">
            <View className="w-10 items-center">
              <Ionicons name="location-outline" size={20} color={colors.mutedForeground} />
            </View>
            <Text className="text-foreground flex-1">{event.location}</Text>
          </View>
        ) : null}

        {/* Description */}
        {isEditing ? (
          <View className="flex-row items-start mb-4">
            <View className="w-10 items-center pt-3">
              <Ionicons name="document-text-outline" size={20} color={colors.mutedForeground} />
            </View>
            <TextInput
              className="flex-1 text-foreground p-3 bg-card rounded-xl border border-border min-h-[100px]"
              value={editedDescription}
              onChangeText={setEditedDescription}
              placeholder="Add description"
              placeholderTextColor={colors.mutedForeground}
              multiline
              textAlignVertical="top"
            />
          </View>
        ) : event.description ? (
          <View className="flex-row items-start mb-4">
            <View className="w-10 items-center">
              <Ionicons name="document-text-outline" size={20} color={colors.mutedForeground} />
            </View>
            <Text className="text-foreground flex-1">{event.description}</Text>
          </View>
        ) : null}

        {/* Attendees */}
        {event.attendees && event.attendees.length > 0 && (
          <View className="mb-4">
            <View className="flex-row items-center mb-2">
              <View className="w-10 items-center">
                <Ionicons name="people-outline" size={20} color={colors.mutedForeground} />
              </View>
              <Text className="text-foreground font-medium">
                {event.attendees.length} attendee{event.attendees.length !== 1 ? "s" : ""}
              </Text>
            </View>
            <View className="ml-10">
              {event.attendees.map((attendee, index) => (
                <View key={index} className="flex-row items-center py-1">
                  <Text className="text-foreground">{attendee.name || attendee.email}</Text>
                  {attendee.organizer && (
                    <Text className="text-muted-foreground text-sm ml-2">(organizer)</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Delete Button */}
        {!isEditing && (
          <TouchableOpacity
            className="bg-destructive/10 border border-destructive/20 rounded-xl py-3 mt-6 flex-row items-center justify-center"
            onPress={handleDelete}
            disabled={deleteEvent.isPending}
          >
            {deleteEvent.isPending ? (
              <ActivityIndicator size="small" color={colors.destructive} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={20} color={colors.destructive} />
                <Text className="text-destructive font-medium ml-2">Delete Event</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </>
  );
}
