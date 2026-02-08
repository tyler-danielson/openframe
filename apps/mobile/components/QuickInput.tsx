import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../hooks/useColorScheme";

interface QuickInputProps {
  placeholder?: string;
  onSubmit: (text: string) => Promise<void>;
  isLoading?: boolean;
}

export function QuickInput({
  placeholder = "Describe your event...",
  onSubmit,
  isLoading = false,
}: QuickInputProps) {
  const colors = useThemeColors();
  const [text, setText] = useState("");

  const handleSubmit = async () => {
    if (!text.trim() || isLoading) return;
    await onSubmit(text.trim());
    setText("");
  };

  return (
    <View className="flex-row items-center bg-card rounded-xl border border-border p-2">
      <TextInput
        className="flex-1 text-foreground px-3 py-2"
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        value={text}
        onChangeText={setText}
        onSubmitEditing={handleSubmit}
        returnKeyType="send"
        editable={!isLoading}
      />
      <TouchableOpacity
        className={`w-10 h-10 rounded-lg items-center justify-center ${
          text.trim() ? "bg-primary" : "bg-muted"
        }`}
        onPress={handleSubmit}
        disabled={!text.trim() || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Ionicons
            name="send"
            size={18}
            color={text.trim() ? "#FFFFFF" : colors.mutedForeground}
          />
        )}
      </TouchableOpacity>
    </View>
  );
}
