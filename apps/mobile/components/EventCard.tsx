import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { format, isToday, isTomorrow } from "date-fns";
import type { CalendarEvent } from "@openframe/shared";

interface EventCardProps {
  event: CalendarEvent;
  color: string;
  onPress: () => void;
}

export function EventCard({ event, color, onPress }: EventCardProps) {
  const startTime = new Date(event.startTime);
  const endTime = new Date(event.endTime);

  const formatTime = () => {
    if (event.isAllDay) {
      return "All day";
    }
    return `${format(startTime, "h:mm a")} - ${format(endTime, "h:mm a")}`;
  };

  const getDateLabel = () => {
    if (isToday(startTime)) return null;
    if (isTomorrow(startTime)) return "Tomorrow";
    return format(startTime, "EEE, MMM d");
  };

  const dateLabel = getDateLabel();

  return (
    <TouchableOpacity
      className="bg-card rounded-xl p-4 flex-row items-start mb-2"
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Color indicator */}
      <View
        className="w-1 rounded-full mr-3 self-stretch"
        style={{ backgroundColor: color }}
      />

      {/* Content */}
      <View className="flex-1">
        <Text className="text-foreground font-medium text-base" numberOfLines={1}>
          {event.title}
        </Text>

        <View className="flex-row items-center mt-1">
          <Ionicons name="time-outline" size={14} color="#71717A" />
          <Text className="text-muted-foreground text-sm ml-1">
            {formatTime()}
            {dateLabel && ` • ${dateLabel}`}
          </Text>
        </View>

        {event.location && (
          <View className="flex-row items-center mt-1">
            <Ionicons name="location-outline" size={14} color="#71717A" />
            <Text
              className="text-muted-foreground text-sm ml-1 flex-1"
              numberOfLines={1}
            >
              {event.location}
            </Text>
          </View>
        )}
      </View>

      {/* Arrow */}
      <Ionicons name="chevron-forward" size={20} color="#71717A" />
    </TouchableOpacity>
  );
}
