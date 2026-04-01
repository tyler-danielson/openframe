import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Switch,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../../hooks/useColorScheme";
import { api, type HAEntity } from "../../services/api";

const DOMAIN_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  light: "bulb-outline",
  switch: "power-outline",
  fan: "leaf-outline",
  climate: "thermometer-outline",
  sensor: "pulse-outline",
  binary_sensor: "radio-button-on-outline",
  input_boolean: "toggle-outline",
  cover: "browsers-outline",
  media_player: "musical-notes-outline",
  camera: "videocam-outline",
  lock: "lock-closed-outline",
  automation: "cog-outline",
  scene: "color-palette-outline",
};

const TOGGLEABLE_DOMAINS = new Set(["light", "switch", "fan", "input_boolean"]);

export default function HomeAssistantScreen() {
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const { data: entities, isLoading, refetch } = useQuery({
    queryKey: ["ha-entities"],
    queryFn: () => api.getHAEntities(),
    staleTime: 30 * 1000,
  });

  const toggleEntity = useMutation({
    mutationFn: (entityId: string) => api.toggleHAEntity(entityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ha-entities"] });
    },
  });

  if (!entities?.length && !isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center p-6">
        <Ionicons name="flash-outline" size={48} color={colors.mutedForeground} />
        <Text className="text-muted-foreground mt-4 text-center">
          Home Assistant not connected
        </Text>
      </View>
    );
  }

  // Group entities by domain
  const grouped = (entities ?? []).reduce<Record<string, HAEntity[]>>((acc, entity) => {
    const domain = entity.domain || entity.entityId.split(".")[0];
    if (!acc[domain]) acc[domain] = [];
    acc[domain].push(entity);
    return acc;
  }, {});

  const domains = Object.keys(grouped).sort();

  const toggleCollapse = (domain: string) => {
    setCollapsed((prev) => ({ ...prev, [domain]: !prev[domain] }));
  };

  const stateColor = (state: string) => {
    if (state === "on") return "#22C55E";
    if (state === "unavailable") return "#F97316";
    return colors.mutedForeground;
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />
      }
    >
      {domains.map((domain) => {
        const entities = grouped[domain];
        const isCollapsed = collapsed[domain] ?? false;
        const icon = DOMAIN_ICONS[domain] ?? "cube-outline";

        return (
          <View key={domain} className="mb-4">
            <TouchableOpacity
              className="flex-row items-center justify-between py-2"
              onPress={() => toggleCollapse(domain)}
            >
              <View className="flex-row items-center">
                <Ionicons name={icon as any} size={18} color={colors.primary} />
                <Text className="text-foreground font-semibold ml-2 capitalize">
                  {domain.replace("_", " ")}
                </Text>
                <Text className="text-muted-foreground text-xs ml-2">
                  ({entities.length})
                </Text>
              </View>
              <Ionicons
                name={isCollapsed ? "chevron-down" : "chevron-up"}
                size={18}
                color={colors.mutedForeground}
              />
            </TouchableOpacity>

            {!isCollapsed && (
              <View className="bg-card rounded-xl overflow-hidden">
                {entities.map((entity, index) => {
                  const isToggleable = TOGGLEABLE_DOMAINS.has(domain);
                  const isOn = entity.state === "on";

                  return (
                    <View
                      key={entity.entityId}
                      className={`flex-row items-center px-4 py-3 ${
                        index < entities.length - 1 ? "border-b border-border" : ""
                      }`}
                    >
                      <View
                        className="w-2 h-2 rounded-full mr-3"
                        style={{ backgroundColor: stateColor(entity.state) }}
                      />
                      <View className="flex-1">
                        <Text className="text-foreground" numberOfLines={1}>
                          {entity.friendlyName || entity.entityId}
                        </Text>
                        {!isToggleable && (
                          <Text className="text-muted-foreground text-xs mt-0.5">
                            {entity.state}
                            {entity.attributes?.unit_of_measurement
                              ? ` ${entity.attributes.unit_of_measurement}`
                              : ""}
                          </Text>
                        )}
                      </View>
                      {isToggleable && (
                        <Switch
                          value={isOn}
                          onValueChange={() => toggleEntity.mutate(entity.entityId)}
                          trackColor={{ false: colors.border, true: colors.primary + "80" }}
                          thumbColor={isOn ? colors.primary : colors.mutedForeground}
                        />
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}
