import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { format, isSameDay, set as setDate } from "date-fns";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  useUpdateEvent,
  useDeleteEvent,
  useCalendars,
} from "../../hooks/useCalendarData";
import { useSelectedEventStore } from "../../stores/selectedEvent";
import { useThemeColors } from "../../hooks/useColorScheme";

type PickerMode = "startDate" | "startTime" | "endDate" | "endTime" | null;

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const event = useSelectedEventStore((s) => s.event);
  const { data: calendars } = useCalendars();
  const isLoading = false;
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();

  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [editedLocation, setEditedLocation] = useState("");
  const [editedStart, setEditedStart] = useState(new Date());
  const [editedEnd, setEditedEnd] = useState(new Date());
  const [editedAllDay, setEditedAllDay] = useState(false);
  const [activePicker, setActivePicker] = useState<PickerMode>(null);

  const calendar = calendars?.find((c) => c.id === event?.calendarId);
  const canEdit = calendar && !calendar.isReadOnly;

  const handleEdit = () => {
    if (event) {
      setEditedTitle(event.title);
      setEditedDescription(event.description || "");
      setEditedLocation(event.location || "");
      setEditedStart(new Date(event.startTime));
      setEditedEnd(new Date(event.endTime));
      setEditedAllDay(event.isAllDay);
      setActivePicker(null);
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
          startTime: editedStart,
          endTime: editedEnd,
          isAllDay: editedAllDay,
        },
      });
      setIsEditing(false);
    } catch {
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
          } catch {
            Alert.alert("Error", "Failed to delete event");
          }
        },
      },
    ]);
  };

  const onPickerChange = (pickerMode: PickerMode, _event: any, date?: Date) => {
    if (Platform.OS === "android") {
      setActivePicker(null);
    }
    if (!date) return;

    if (pickerMode === "startDate") {
      const updated = setDate(editedStart, {
        year: date.getFullYear(),
        month: date.getMonth(),
        date: date.getDate(),
      });
      setEditedStart(updated);
      // If end is before start, bump it
      if (updated > editedEnd) {
        const newEnd = new Date(updated);
        newEnd.setHours(editedEnd.getHours(), editedEnd.getMinutes());
        if (newEnd <= updated) newEnd.setHours(updated.getHours() + 1);
        setEditedEnd(newEnd);
      }
    } else if (pickerMode === "startTime") {
      const updated = setDate(editedStart, {
        hours: date.getHours(),
        minutes: date.getMinutes(),
      });
      setEditedStart(updated);
      if (updated >= editedEnd) {
        const newEnd = new Date(updated);
        newEnd.setHours(updated.getHours() + 1, updated.getMinutes());
        setEditedEnd(newEnd);
      }
    } else if (pickerMode === "endDate") {
      const updated = setDate(editedEnd, {
        year: date.getFullYear(),
        month: date.getMonth(),
        date: date.getDate(),
      });
      setEditedEnd(updated < editedStart ? editedStart : updated);
    } else if (pickerMode === "endTime") {
      const updated = setDate(editedEnd, {
        hours: date.getHours(),
        minutes: date.getMinutes(),
      });
      setEditedEnd(updated);
    }
  };

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!event) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Ionicons
          name="calendar-outline"
          size={48}
          color={colors.mutedForeground}
        />
        <Text
          style={{
            color: colors.foreground,
            fontSize: 18,
            fontWeight: "600",
            marginTop: 16,
          }}
        >
          Event not found
        </Text>
        <TouchableOpacity style={{ marginTop: 16 }} onPress={() => router.back()}>
          <Text style={{ color: colors.primary }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const displayStart = isEditing ? editedStart : new Date(event.startTime);
  const displayEnd = isEditing ? editedEnd : new Date(event.endTime);
  const displayAllDay = isEditing ? editedAllDay : event.isAllDay;
  const sameDay = isSameDay(displayStart, displayEnd);

  const formatDate = () => {
    if (displayAllDay) {
      if (sameDay) return format(displayStart, "EEEE, MMMM d, yyyy");
      return `${format(displayStart, "EEE, MMM d")} – ${format(displayEnd, "EEE, MMM d, yyyy")}`;
    }
    return format(displayStart, "EEEE, MMMM d, yyyy");
  };

  const formatTime = () => {
    if (displayAllDay) return "All day";
    if (sameDay)
      return `${format(displayStart, "h:mm a")} – ${format(displayEnd, "h:mm a")}`;
    return `${format(displayStart, "EEE h:mm a")} – ${format(displayEnd, "EEE h:mm a")}`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          backgroundColor: colors.background,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={24} color={colors.foreground} />
        </TouchableOpacity>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          {isEditing ? (
            <>
              <TouchableOpacity onPress={() => setIsEditing(false)}>
                <Text style={{ color: colors.mutedForeground, fontSize: 16 }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                disabled={updateEvent.isPending}
              >
                {updateEvent.isPending ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text
                    style={{
                      color: colors.primary,
                      fontSize: 16,
                      fontWeight: "600",
                    }}
                  >
                    Save
                  </Text>
                )}
              </TouchableOpacity>
            </>
          ) : canEdit ? (
            <>
              <TouchableOpacity
                onPress={handleEdit}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="pencil" size={20} color={colors.foreground} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDelete}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                disabled={deleteEvent.isPending}
              >
                {deleteEvent.isPending ? (
                  <ActivityIndicator size="small" color={colors.destructive} />
                ) : (
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={colors.mutedForeground}
                  />
                )}
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 20 }}
      >
        {/* Color bar + Title */}
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <View
            style={{
              width: 4,
              borderRadius: 2,
              backgroundColor: calendar?.color || colors.primary,
              alignSelf: "stretch",
              marginRight: 14,
              marginTop: 2,
            }}
          />
          <View style={{ flex: 1 }}>
            {isEditing ? (
              <TextInput
                style={{
                  color: colors.foreground,
                  fontSize: 22,
                  fontWeight: "700",
                  padding: 8,
                  backgroundColor: colors.card,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                value={editedTitle}
                onChangeText={setEditedTitle}
                placeholder="Event title"
                placeholderTextColor={colors.mutedForeground}
              />
            ) : (
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 22,
                  fontWeight: "700",
                  lineHeight: 28,
                }}
              >
                {event.title}
              </Text>
            )}

            {/* Date & Time — view mode or edit mode */}
            {isEditing ? (
              <View style={{ marginTop: 12, gap: 4 }}>
                {/* All-day toggle */}
                <TouchableOpacity
                  onPress={() => setEditedAllDay(!editedAllDay)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 6,
                  }}
                >
                  <Ionicons
                    name={editedAllDay ? "checkbox" : "square-outline"}
                    size={20}
                    color={editedAllDay ? colors.primary : colors.mutedForeground}
                  />
                  <Text
                    style={{
                      color: colors.foreground,
                      fontSize: 14,
                      marginLeft: 8,
                    }}
                  >
                    All day
                  </Text>
                </TouchableOpacity>

                {/* Start row */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 4,
                  }}
                >
                  <TimeChip
                    label={format(editedStart, "EEE, MMM d")}
                    active={activePicker === "startDate"}
                    onPress={() =>
                      setActivePicker(
                        activePicker === "startDate" ? null : "startDate"
                      )
                    }
                    colors={colors}
                  />
                  {!editedAllDay && (
                    <TimeChip
                      label={format(editedStart, "h:mm a")}
                      active={activePicker === "startTime"}
                      onPress={() =>
                        setActivePicker(
                          activePicker === "startTime" ? null : "startTime"
                        )
                      }
                      colors={colors}
                    />
                  )}
                </View>

                {/* End row */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 4,
                  }}
                >
                  <Text
                    style={{
                      color: colors.mutedForeground,
                      fontSize: 13,
                      marginRight: 2,
                    }}
                  >
                    to
                  </Text>
                  <TimeChip
                    label={format(editedEnd, "EEE, MMM d")}
                    active={activePicker === "endDate"}
                    onPress={() =>
                      setActivePicker(
                        activePicker === "endDate" ? null : "endDate"
                      )
                    }
                    colors={colors}
                  />
                  {!editedAllDay && (
                    <TimeChip
                      label={format(editedEnd, "h:mm a")}
                      active={activePicker === "endTime"}
                      onPress={() =>
                        setActivePicker(
                          activePicker === "endTime" ? null : "endTime"
                        )
                      }
                      colors={colors}
                    />
                  )}
                </View>

                {/* Native picker */}
                {activePicker && (
                  <View
                    style={{
                      marginTop: 8,
                      backgroundColor: colors.card,
                      borderRadius: 12,
                      overflow: "hidden",
                    }}
                  >
                    <DateTimePicker
                      value={
                        activePicker === "startDate" ||
                        activePicker === "startTime"
                          ? editedStart
                          : editedEnd
                      }
                      mode={
                        activePicker === "startDate" ||
                        activePicker === "endDate"
                          ? "date"
                          : "time"
                      }
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      onChange={(e, date) => onPickerChange(activePicker, e, date)}
                      minuteInterval={5}
                      themeVariant="dark"
                    />
                  </View>
                )}
              </View>
            ) : (
              <>
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 15,
                    marginTop: 6,
                  }}
                >
                  {formatDate()}
                </Text>
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontSize: 14,
                    marginTop: 2,
                  }}
                >
                  {formatTime()}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Details section */}
        <View style={{ marginTop: 24, gap: 16 }}>
          {/* Calendar */}
          {calendar && (
            <DetailRow icon="ellipse" iconColor={calendar.color} colors={colors}>
              <Text style={{ color: colors.foreground, fontSize: 15 }}>
                {calendar.name}
              </Text>
            </DetailRow>
          )}

          {/* Location */}
          {isEditing ? (
            <DetailRow icon="location-outline" colors={colors}>
              <TextInput
                style={{
                  flex: 1,
                  color: colors.foreground,
                  fontSize: 15,
                  padding: 8,
                  backgroundColor: colors.card,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                value={editedLocation}
                onChangeText={setEditedLocation}
                placeholder="Add location"
                placeholderTextColor={colors.mutedForeground}
              />
            </DetailRow>
          ) : event.location ? (
            <DetailRow icon="location-outline" colors={colors}>
              <Text style={{ color: colors.foreground, fontSize: 15, flex: 1 }}>
                {event.location}
              </Text>
            </DetailRow>
          ) : null}

          {/* Description */}
          {isEditing ? (
            <DetailRow icon="document-text-outline" colors={colors}>
              <TextInput
                style={{
                  flex: 1,
                  color: colors.foreground,
                  fontSize: 15,
                  padding: 8,
                  backgroundColor: colors.card,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                  minHeight: 80,
                  textAlignVertical: "top",
                }}
                value={editedDescription}
                onChangeText={setEditedDescription}
                placeholder="Add description"
                placeholderTextColor={colors.mutedForeground}
                multiline
              />
            </DetailRow>
          ) : event.description ? (
            <DetailRow icon="document-text-outline" colors={colors}>
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 15,
                  flex: 1,
                  lineHeight: 22,
                }}
              >
                {event.description}
              </Text>
            </DetailRow>
          ) : null}

          {/* Status (if not confirmed) */}
          {event.status && event.status !== "confirmed" && (
            <DetailRow icon="information-circle-outline" colors={colors}>
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontSize: 14,
                  textTransform: "capitalize",
                }}
              >
                {event.status}
              </Text>
            </DetailRow>
          )}

          {/* Recurring */}
          {event.recurringEventId && (
            <DetailRow icon="repeat" colors={colors}>
              <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
                Recurring event
              </Text>
            </DetailRow>
          )}

          {/* Attendees */}
          {event.attendees && event.attendees.length > 0 && (
            <DetailRow icon="people-outline" colors={colors}>
              <View style={{ flex: 1, gap: 6 }}>
                {event.attendees.map((attendee, i) => (
                  <View
                    key={i}
                    style={{ flexDirection: "row", alignItems: "center" }}
                  >
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: colors.primary + "20",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 8,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.primary,
                          fontSize: 12,
                          fontWeight: "600",
                        }}
                      >
                        {(attendee.name || attendee.email)?.[0]?.toUpperCase() ||
                          "?"}
                      </Text>
                    </View>
                    <Text style={{ color: colors.foreground, fontSize: 14 }}>
                      {attendee.name || attendee.email}
                    </Text>
                    {attendee.organizer && (
                      <Text
                        style={{
                          color: colors.mutedForeground,
                          fontSize: 12,
                          marginLeft: 6,
                        }}
                      >
                        (organizer)
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            </DetailRow>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function TimeChip({
  label,
  active,
  onPress,
  colors,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: active ? colors.primary + "20" : colors.card,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
      }}
    >
      <Text
        style={{
          color: active ? colors.primary : colors.foreground,
          fontSize: 14,
          fontWeight: "500",
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function DetailRow({
  icon,
  iconColor,
  colors,
  children,
}: {
  icon: string;
  iconColor?: string;
  colors: ReturnType<typeof useThemeColors>;
  children: React.ReactNode;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
      <View style={{ width: 36, alignItems: "center", paddingTop: 2 }}>
        <Ionicons
          name={icon as any}
          size={icon === "ellipse" ? 12 : 20}
          color={iconColor || colors.mutedForeground}
        />
      </View>
      {children}
    </View>
  );
}
