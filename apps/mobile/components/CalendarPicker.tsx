import { View, Text, TouchableOpacity, Modal, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../hooks/useColorScheme";
import type { Calendar } from "@openframe/shared";

interface CalendarPickerProps {
  visible: boolean;
  onClose: () => void;
  calendars: Calendar[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function CalendarPicker({
  visible,
  onClose,
  calendars,
  selectedId,
  onSelect,
}: CalendarPickerProps) {
  const colors = useThemeColors();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-card rounded-t-3xl max-h-[60%]">
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
            <Text className="text-foreground text-lg font-semibold">
              Select Calendar
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* Calendar List */}
          <FlatList
            data={calendars}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 8 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                className={`flex-row items-center p-4 rounded-xl ${
                  item.id === selectedId ? "bg-primary/10" : ""
                }`}
                onPress={() => onSelect(item.id)}
              >
                <View
                  className="w-4 h-4 rounded-full mr-3"
                  style={{ backgroundColor: item.color }}
                />
                <Text
                  className={`flex-1 ${
                    item.id === selectedId
                      ? "text-primary font-medium"
                      : "text-foreground"
                  }`}
                >
                  {item.name}
                </Text>
                {item.id === selectedId && (
                  <Ionicons name="checkmark" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View className="items-center py-8">
                <Ionicons
                  name="calendar-outline"
                  size={40}
                  color={colors.mutedForeground}
                />
                <Text className="text-muted-foreground mt-2">
                  No calendars available
                </Text>
              </View>
            }
          />

          {/* Safe area bottom padding */}
          <View className="h-8" />
        </View>
      </View>
    </Modal>
  );
}
