import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { useThemeColors } from "../../hooks/useColorScheme";
import type { WidgetState } from "../../services/api";

const DASHBOARD_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  calendar: "calendar",
  tasks: "checkbox-outline",
  photos: "images",
  spotify: "musical-notes",
  iptv: "tv",
  cameras: "videocam",
  multiview: "grid",
  homeassistant: "home",
  map: "map",
  kitchen: "restaurant",
  dashboard: "apps",
  screensaver: "desktop",
  chat: "chatbubble",
  custom: "cube",
  routines: "list",
  cardview: "albums",
  matter: "hardware-chip",
};

export default function KioskControlScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const {
    data: kiosk,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["kiosk", id],
    queryFn: () => api.getKiosk(id),
    enabled: !!id,
  });

  const { data: widgetStates } = useQuery({
    queryKey: ["kiosk-widget-state", id],
    queryFn: () => api.getKioskWidgetState(id),
    enabled: !!id,
    refetchInterval: 5000,
  });

  // Companion ping to enable fast polling on kiosk
  useEffect(() => {
    if (!id) return;
    api.companionPing(id).catch(() => {});
    const interval = setInterval(() => {
      api.companionPing(id).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [id]);

  const sendCommand = useMutation({
    mutationFn: ({
      type,
      payload,
    }: {
      type: string;
      payload?: Record<string, unknown>;
    }) => api.sendKioskCommand(id, type, payload),
  });

  const sendRefresh = useMutation({
    mutationFn: () => api.sendKioskRefresh(id),
    onSuccess: () => {},
    onError: (e: Error) => Alert.alert("Error", e.message),
  });

  const handleCommand = useCallback(
    (type: string, payload?: Record<string, unknown>, label?: string) => {
      sendCommand.mutate(
        { type, payload },
        {
          onSuccess: () => {
            // silent success
          },
          onError: (e: Error) => Alert.alert("Error", e.message),
        }
      );
    },
    [sendCommand, id]
  );

  const handleNavigate = useCallback(
    (path: string) => {
      if (screensaverOn) {
        handleCommand("screensaver", { enabled: false });
        setScreensaverOn(false);
      }
      handleCommand("navigate", { path }, path);
    },
    [handleCommand, screensaverOn]
  );

  const [screensaverOn, setScreensaverOn] = useState(false);

  const handleToggleScreensaver = useCallback(() => {
    const newState = !screensaverOn;
    setScreensaverOn(newState);
    handleCommand("screensaver", { enabled: newState });
  }, [screensaverOn, handleCommand]);

  const getWidgetState = (type: string): WidgetState | undefined => {
    return widgetStates?.find((w) => w.widgetType === type);
  };

  const iptvState = getWidgetState("iptv");
  const spotifyState = getWidgetState("spotify");

  const QuickActionButton = ({
    icon,
    label,
    onPress,
    color,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
    color?: string;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={sendCommand.isPending}
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 16,
        backgroundColor: colors.card,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 6,
      }}
    >
      <Ionicons name={icon} size={28} color={color || colors.primary} />
      <Text
        style={{
          color: colors.foreground,
          fontSize: 12,
          fontWeight: "500",
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
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
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 18,
              fontWeight: "600",
            }}
            numberOfLines={1}
          >
            {kiosk?.name || "Kiosk"}
          </Text>
          {kiosk && (
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
              {kiosk.isActive ? "Active" : "Inactive"} · {kiosk.displayType}
            </Text>
          )}
        </View>
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: kiosk?.isActive ? "#22C55E" : colors.mutedForeground,
          }}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
      >
        {/* Quick Actions */}
        <Text
          style={{
            color: colors.mutedForeground,
            fontSize: 13,
            fontWeight: "600",
            textTransform: "uppercase",
            letterSpacing: 0.5,
            marginBottom: 10,
          }}
        >
          Quick Actions
        </Text>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
          <QuickActionButton
            icon="refresh"
            label="Refresh"
            onPress={() => sendRefresh.mutate()}
          />
          <QuickActionButton
            icon="reload"
            label="Reload Photos"
            onPress={() => handleCommand("reload-photos")}
          />
          <QuickActionButton
            icon={screensaverOn ? "desktop" : "desktop-outline"}
            label={screensaverOn ? "Stop" : "Screensaver"}
            onPress={handleToggleScreensaver}
            color={screensaverOn ? colors.primary : undefined}
          />
        </View>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 24 }}>
          <QuickActionButton
            icon="resize"
            label="Split Screen"
            onPress={() =>
              router.push({
                pathname: "/kiosk/split-screen",
                params: {
                  kioskId: id,
                  dashboards: JSON.stringify(
                    (kiosk?.dashboards || []).map((d: { id: string; name: string; type: string }) => ({
                      id: d.id,
                      name: d.name,
                      type: d.type,
                    }))
                  ),
                },
              })
            }
          />
          <QuickActionButton
            icon="close-circle-outline"
            label="Exit Split"
            onPress={() => handleCommand("exit-split-screen")}
          />
          <View style={{ flex: 1 }} />
        </View>

        {/* Navigate to Pages */}
        {kiosk?.dashboards && kiosk.dashboards.length > 0 && (
          <>
            <Text
              style={{
                color: colors.mutedForeground,
                fontSize: 13,
                fontWeight: "600",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 10,
              }}
            >
              Navigate
            </Text>
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                overflow: "hidden",
                marginBottom: 24,
              }}
            >
              {kiosk.dashboards.map((dash, i) => (
                <TouchableOpacity
                  key={dash.id}
                  onPress={() => handleNavigate(dash.type === "custom" ? `screen/${dash.id}` : dash.type)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderBottomWidth:
                      i < kiosk.dashboards.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Ionicons
                    name={DASHBOARD_ICONS[dash.type] || "cube"}
                    size={20}
                    color={colors.primary}
                  />
                  <Text
                    style={{
                      color: colors.foreground,
                      fontSize: 15,
                      marginLeft: 12,
                      flex: 1,
                    }}
                  >
                    {dash.name}
                  </Text>
                  {dash.pinned && (
                    <Ionicons
                      name="pin"
                      size={14}
                      color={colors.mutedForeground}
                      style={{ marginRight: 8 }}
                    />
                  )}
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={colors.mutedForeground}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* IPTV Controls */}
        {iptvState && (
          <>
            <Text
              style={{
                color: colors.mutedForeground,
                fontSize: 13,
                fontWeight: "600",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 10,
              }}
            >
              TV Control
            </Text>
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 16,
                marginBottom: 24,
              }}
            >
              {iptvState.state.currentChannel && (
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 15,
                    fontWeight: "600",
                    marginBottom: 12,
                    textAlign: "center",
                  }}
                >
                  {String(iptvState.state.currentChannel)}
                </Text>
              )}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 12,
                }}
              >
                <TouchableOpacity
                  onPress={() =>
                    handleCommand("widget-control", {
                      widgetId: iptvState.widgetId,
                      action: "channel-down",
                    })
                  }
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: colors.background,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons
                    name="chevron-down"
                    size={28}
                    color={colors.foreground}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    handleCommand("widget-control", {
                      widgetId: iptvState.widgetId,
                      action: "mute",
                    })
                  }
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor:
                      iptvState.state.isMuted ? colors.primary : colors.background,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons
                    name={
                      iptvState.state.isMuted
                        ? "volume-mute"
                        : "volume-high"
                    }
                    size={24}
                    color={
                      iptvState.state.isMuted ? "#FFF" : colors.foreground
                    }
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    handleCommand("widget-control", {
                      widgetId: iptvState.widgetId,
                      action: "channel-up",
                    })
                  }
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: colors.background,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons
                    name="chevron-up"
                    size={28}
                    color={colors.foreground}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* Spotify Status */}
        {spotifyState && spotifyState.state.currentTrack && (
          <>
            <Text
              style={{
                color: colors.mutedForeground,
                fontSize: 13,
                fontWeight: "600",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 10,
              }}
            >
              Now Playing
            </Text>
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                marginBottom: 24,
              }}
            >
              <Ionicons
                name="musical-notes"
                size={24}
                color="#1DB954"
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 14,
                    fontWeight: "600",
                  }}
                  numberOfLines={1}
                >
                  {String(spotifyState.state.currentTrack)}
                </Text>
                {spotifyState.state.currentArtist && (
                  <Text
                    style={{
                      color: colors.mutedForeground,
                      fontSize: 13,
                    }}
                    numberOfLines={1}
                  >
                    {String(spotifyState.state.currentArtist)}
                  </Text>
                )}
              </View>
            </View>
          </>
        )}

        {/* Kiosk Info */}
        {kiosk && (
          <>
            <Text
              style={{
                color: colors.mutedForeground,
                fontSize: 13,
                fontWeight: "600",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 10,
              }}
            >
              Info
            </Text>
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                overflow: "hidden",
              }}
            >
              <InfoRow
                label="Display Mode"
                value={kiosk.displayMode}
                colors={colors}
              />
              <InfoRow
                label="Display Type"
                value={kiosk.displayType}
                colors={colors}
              />
              <InfoRow
                label="Theme"
                value={kiosk.colorScheme}
                colors={colors}
              />
              <InfoRow
                label="Screensaver"
                value={kiosk.screensaverEnabled ? "Enabled" : "Disabled"}
                colors={colors}
                last
              />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function InfoRow({
  label,
  value,
  colors,
  last,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useThemeColors>;
  last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <Text style={{ color: colors.foreground, fontSize: 14 }}>{label}</Text>
      <Text
        style={{
          color: colors.mutedForeground,
          fontSize: 14,
          textTransform: "capitalize",
        }}
      >
        {value}
      </Text>
    </View>
  );
}
