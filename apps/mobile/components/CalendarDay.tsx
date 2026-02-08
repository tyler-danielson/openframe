import { View, Text, TouchableOpacity } from "react-native";

interface CalendarDayProps {
  date: Date;
  isSelected: boolean;
  isToday: boolean;
  events: Array<{ id: string; color: string }>;
  onPress: () => void;
}

export function CalendarDay({
  date,
  isSelected,
  isToday,
  events,
  onPress,
}: CalendarDayProps) {
  const day = date.getDate();

  return (
    <TouchableOpacity
      className={`w-10 h-12 items-center justify-center rounded-lg ${
        isSelected ? "bg-primary" : isToday ? "bg-primary/20" : ""
      }`}
      onPress={onPress}
    >
      <Text
        className={`text-sm font-medium ${
          isSelected
            ? "text-primary-foreground"
            : isToday
            ? "text-primary"
            : "text-foreground"
        }`}
      >
        {day}
      </Text>

      {/* Event dots */}
      {events.length > 0 && (
        <View className="flex-row items-center justify-center mt-1 space-x-0.5">
          {events.slice(0, 3).map((event) => (
            <View
              key={event.id}
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: isSelected ? "#FFFFFF" : event.color }}
            />
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}
