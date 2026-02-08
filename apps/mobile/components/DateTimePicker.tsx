import { useState } from "react";
import { View, Text, TouchableOpacity, Modal, Platform } from "react-native";
import DateTimePickerRN from "@react-native-community/datetimepicker";
import { useThemeColors } from "../hooks/useColorScheme";

interface DateTimePickerProps {
  visible: boolean;
  value: Date;
  mode: "date" | "time" | "datetime";
  minimumDate?: Date;
  maximumDate?: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
}

export function DateTimePicker({
  visible,
  value,
  mode,
  minimumDate,
  maximumDate,
  onConfirm,
  onCancel,
}: DateTimePickerProps) {
  const colors = useThemeColors();
  const [tempDate, setTempDate] = useState(value);
  const [showMode, setShowMode] = useState<"date" | "time">(
    mode === "time" ? "time" : "date"
  );

  // For iOS, we show both date and time pickers in sequence for datetime mode
  const handleChange = (_: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      if (!selectedDate) {
        onCancel();
        return;
      }

      if (mode === "datetime" && showMode === "date") {
        // Android: Show time picker after date picker
        setTempDate(selectedDate);
        setShowMode("time");
      } else {
        onConfirm(selectedDate);
      }
    } else {
      // iOS: Just update the temp date
      if (selectedDate) {
        setTempDate(selectedDate);
      }
    }
  };

  const handleIOSConfirm = () => {
    onConfirm(tempDate);
  };

  // Reset state when becoming visible
  if (visible && tempDate.getTime() !== value.getTime()) {
    setTempDate(value);
    setShowMode(mode === "time" ? "time" : "date");
  }

  if (!visible) return null;

  // Android uses native modals
  if (Platform.OS === "android") {
    return (
      <DateTimePickerRN
        value={tempDate}
        mode={showMode}
        display="default"
        onChange={handleChange}
        minimumDate={showMode === "date" ? minimumDate : undefined}
        maximumDate={showMode === "date" ? maximumDate : undefined}
      />
    );
  }

  // iOS uses a modal with confirm/cancel
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onCancel}
    >
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-card rounded-t-3xl">
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
            <TouchableOpacity onPress={onCancel}>
              <Text className="text-muted-foreground">Cancel</Text>
            </TouchableOpacity>
            <Text className="text-foreground font-semibold">
              {mode === "time" ? "Select Time" : mode === "date" ? "Select Date" : "Select Date & Time"}
            </Text>
            <TouchableOpacity onPress={handleIOSConfirm}>
              <Text className="text-primary font-semibold">Done</Text>
            </TouchableOpacity>
          </View>

          {/* Picker */}
          <DateTimePickerRN
            value={tempDate}
            mode={mode === "datetime" ? "datetime" : mode}
            display="spinner"
            onChange={handleChange}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            textColor={colors.foreground}
            style={{ height: 200 }}
          />

          {/* Safe area bottom padding */}
          <View className="h-8" />
        </View>
      </View>
    </Modal>
  );
}
