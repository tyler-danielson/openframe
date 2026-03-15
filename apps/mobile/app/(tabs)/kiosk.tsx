import { useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { useThemeColors } from "../../hooks/useColorScheme";
import type { Kiosk } from "../../services/api";

export default function KioskTab() {
  const router = useRouter();
  const colors = useThemeColors();

  const { data: kiosks, isLoading } = useQuery({
    queryKey: ["kiosks"],
    queryFn: () => api.getKiosks(),
  });

  // Auto-navigate if there's exactly one kiosk
  useEffect(() => {
    if (kiosks && kiosks.length === 1) {
      router.push(`/kiosk/${kiosks[0].id}`);
    }
  }, [kiosks, router]);

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

  if (!kiosks || kiosks.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
        }}
      >
        <Ionicons name="tv-outline" size={64} color={colors.mutedForeground} />
        <Text
          style={{
            color: colors.mutedForeground,
            fontSize: 16,
            marginTop: 12,
            textAlign: "center",
          }}
        >
          No kiosks configured
        </Text>
      </View>
    );
  }

  // Multiple kiosks - show list
  const renderKiosk = ({ item }: { item: Kiosk }) => (
    <TouchableOpacity
      onPress={() => router.push(`/kiosk/${item.id}`)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        marginHorizontal: 16,
        marginTop: 12,
        backgroundColor: colors.card,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Ionicons name="tv" size={28} color={colors.primary} />
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text
          style={{
            color: colors.foreground,
            fontSize: 16,
            fontWeight: "600",
          }}
        >
          {item.name}
        </Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 2 }}>
          {item.displayType} · {item.displayMode}
        </Text>
      </View>
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: item.isActive ? "#22C55E" : colors.mutedForeground,
          marginRight: 10,
        }}
      />
      <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={kiosks}
        keyExtractor={(item) => item.id}
        renderItem={renderKiosk}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}
