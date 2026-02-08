import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/auth";
import { useCalendarStore } from "../../stores/calendar";
import { useCalendars, useUpdateCalendar, useSyncCalendars } from "../../hooks/useCalendarData";
import { useThemeColors } from "../../hooks/useColorScheme";
import { api } from "../../services/api";

export default function SettingsScreen() {
  const colors = useThemeColors();
  const { user, serverUrl, logout } = useAuthStore();
  const { data: calendars, isLoading, refetch } = useCalendars();
  const updateCalendar = useUpdateCalendar();
  const syncCalendars = useSyncCalendars();

  const refreshKiosk = useMutation({
    mutationFn: () => api.refreshKiosk(),
    onSuccess: () => {
      Alert.alert("Success", "Kiosk refresh command sent");
    },
    onError: (error: Error) => {
      Alert.alert("Error", error.message);
    },
  });

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to disconnect from this server?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: () => logout(),
      },
    ]);
  };

  const handleToggleCalendar = (calendarId: string, currentValue: boolean) => {
    updateCalendar.mutate({
      id: calendarId,
      data: { isVisible: !currentValue },
    });
  };

  const handleSync = () => {
    syncCalendars.mutate();
  };

  const renderSection = (
    title: string,
    children: React.ReactNode,
    icon?: keyof typeof Ionicons.glyphMap
  ) => (
    <View className="mb-6">
      <View className="flex-row items-center mb-3 px-4">
        {icon && (
          <Ionicons name={icon} size={20} color={colors.mutedForeground} />
        )}
        <Text className="text-muted-foreground font-semibold text-sm uppercase tracking-wide ml-2">
          {title}
        </Text>
      </View>
      <View className="bg-card rounded-xl mx-4 overflow-hidden">{children}</View>
    </View>
  );

  const renderSettingRow = (
    label: string,
    value?: string | React.ReactNode,
    onPress?: () => void,
    showArrow = true
  ) => (
    <TouchableOpacity
      className="flex-row items-center justify-between px-4 py-3 border-b border-border"
      onPress={onPress}
      disabled={!onPress}
    >
      <Text className="text-foreground">{label}</Text>
      <View className="flex-row items-center">
        {typeof value === "string" ? (
          <Text className="text-muted-foreground mr-2">{value}</Text>
        ) : (
          value
        )}
        {onPress && showArrow && (
          <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingVertical: 16 }}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={refetch}
          tintColor={colors.primary}
        />
      }
    >
      {/* Account Section */}
      {renderSection(
        "Account",
        <>
          {renderSettingRow("Email", user?.email || "Unknown")}
          {renderSettingRow("Name", user?.name || "Not set")}
          {renderSettingRow("Server", serverUrl?.replace(/^https?:\/\//, ""))}
        </>,
        "person-circle-outline"
      )}

      {/* Calendars Section */}
      {renderSection(
        "Calendars",
        <>
          {calendars?.map((calendar, index) => (
            <View
              key={calendar.id}
              className={`flex-row items-center justify-between px-4 py-3 ${
                index < (calendars?.length || 0) - 1 ? "border-b border-border" : ""
              }`}
            >
              <View className="flex-row items-center flex-1">
                <View
                  className="w-3 h-3 rounded-full mr-3"
                  style={{ backgroundColor: calendar.color }}
                />
                <Text className="text-foreground flex-1" numberOfLines={1}>
                  {calendar.name}
                </Text>
              </View>
              <Switch
                value={calendar.isVisible}
                onValueChange={() => handleToggleCalendar(calendar.id, calendar.isVisible)}
                trackColor={{ false: colors.border, true: colors.primary + "80" }}
                thumbColor={calendar.isVisible ? colors.primary : colors.mutedForeground}
              />
            </View>
          ))}
          <TouchableOpacity
            className="flex-row items-center justify-center px-4 py-3 border-t border-border"
            onPress={handleSync}
            disabled={syncCalendars.isPending}
          >
            {syncCalendars.isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Ionicons name="sync" size={18} color={colors.primary} />
                <Text className="text-primary font-medium ml-2">Sync All Calendars</Text>
              </>
            )}
          </TouchableOpacity>
        </>,
        "calendar-outline"
      )}

      {/* Quick Actions Section */}
      {renderSection(
        "Quick Actions",
        <>
          <TouchableOpacity
            className="flex-row items-center px-4 py-3 border-b border-border"
            onPress={() => refreshKiosk.mutate()}
            disabled={refreshKiosk.isPending}
          >
            <Ionicons name="tv-outline" size={20} color={colors.foreground} />
            <Text className="text-foreground ml-3 flex-1">Refresh Kiosk Display</Text>
            {refreshKiosk.isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
            )}
          </TouchableOpacity>
        </>,
        "flash-outline"
      )}

      {/* Danger Zone */}
      {renderSection(
        "Session",
        <TouchableOpacity
          className="flex-row items-center justify-center px-4 py-4"
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.destructive} />
          <Text className="text-destructive font-medium ml-2">Disconnect</Text>
        </TouchableOpacity>,
        "shield-outline"
      )}

      {/* App Info */}
      <View className="items-center mt-4 mb-8">
        <Text className="text-muted-foreground text-sm">OpenFrame Mobile v1.0.0</Text>
      </View>
    </ScrollView>
  );
}
