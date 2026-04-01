import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../../hooks/useColorScheme";
import { api, type IptvChannel } from "../../services/api";

export default function IptvScreen() {
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: favorites, refetch: refetchFav } = useQuery({
    queryKey: ["iptv-favorites"],
    queryFn: () => api.getIptvFavorites(),
  });

  const { data: channels, isLoading, refetch: refetchChannels } = useQuery({
    queryKey: ["iptv-channels", selectedCategory],
    queryFn: () => api.getIptvChannels(selectedCategory ?? undefined),
  });

  const { data: categories } = useQuery({
    queryKey: ["iptv-categories"],
    queryFn: () => api.getIptvCategories(),
  });

  const { data: kiosks } = useQuery({
    queryKey: ["kiosks"],
    queryFn: () => api.getKiosks(),
  });

  const toggleFav = useMutation({
    mutationFn: (channelId: string) => api.toggleIptvFavorite(channelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["iptv-favorites"] });
      queryClient.invalidateQueries({ queryKey: ["iptv-channels"] });
    },
  });

  const onRefresh = async () => {
    await Promise.all([refetchFav(), refetchChannels()]);
  };

  const castChannel = (channel: IptvChannel) => {
    const streamUrl = channel.streamUrl ?? channel.url;
    if (!streamUrl) return;

    if (!kiosks?.length) {
      Alert.alert("No Kiosks", "No kiosks available to cast to.");
      return;
    }

    if (kiosks.length === 1) {
      api.sendKioskCommand(kiosks[0].id, "cast", { url: streamUrl, type: "iptv" });
      Alert.alert("Casting", `Sending ${channel.name} to ${kiosks[0].name}`);
    } else {
      Alert.alert(
        "Select Kiosk",
        "Which kiosk should play this channel?",
        kiosks.map((k) => ({
          text: k.name,
          onPress: () => {
            api.sendKioskCommand(k.id, "cast", { url: streamUrl, type: "iptv" });
          },
        }))
      );
    }
  };

  if (!channels?.length && !favorites?.length && !isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center p-6">
        <Ionicons name="tv-outline" size={48} color={colors.mutedForeground} />
        <Text className="text-muted-foreground mt-4 text-center">IPTV not configured</Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {/* Favorites */}
      {favorites && favorites.length > 0 && (
        <View className="mb-6">
          <Text className="text-foreground font-semibold text-lg mb-3">Favorites</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {favorites.map((ch) => (
              <TouchableOpacity
                key={ch.id}
                className="bg-card rounded-xl p-3 mr-3 items-center"
                style={{ width: 90 }}
                onPress={() => castChannel(ch)}
              >
                {ch.logo ? (
                  <Image source={{ uri: ch.logo }} className="w-12 h-12 rounded-lg" resizeMode="contain" />
                ) : (
                  <View className="w-12 h-12 rounded-lg bg-secondary items-center justify-center">
                    <Ionicons name="tv-outline" size={20} color={colors.mutedForeground} />
                  </View>
                )}
                <Text className="text-foreground text-xs mt-2 text-center" numberOfLines={2}>
                  {ch.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Category filter */}
      {categories && categories.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
          <TouchableOpacity
            className={`px-4 py-2 rounded-full mr-2 ${
              selectedCategory === null ? "bg-primary" : "bg-secondary"
            }`}
            onPress={() => setSelectedCategory(null)}
          >
            <Text className={selectedCategory === null ? "text-white text-sm" : "text-foreground text-sm"}>
              All
            </Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              className={`px-4 py-2 rounded-full mr-2 ${
                selectedCategory === cat.id ? "bg-primary" : "bg-secondary"
              }`}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Text
                className={
                  selectedCategory === cat.id ? "text-white text-sm" : "text-foreground text-sm"
                }
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Channel list */}
      <View className="bg-card rounded-xl overflow-hidden">
        {channels?.map((channel, index) => (
          <TouchableOpacity
            key={channel.id}
            className={`flex-row items-center px-4 py-3 ${
              index < (channels?.length ?? 0) - 1 ? "border-b border-border" : ""
            }`}
            onPress={() => castChannel(channel)}
            onLongPress={() => toggleFav.mutate(channel.id)}
          >
            {channel.logo ? (
              <Image source={{ uri: channel.logo }} className="w-10 h-10 rounded-lg mr-3" resizeMode="contain" />
            ) : (
              <View className="w-10 h-10 rounded-lg bg-secondary items-center justify-center mr-3">
                <Ionicons name="tv-outline" size={16} color={colors.mutedForeground} />
              </View>
            )}
            <Text className="text-foreground flex-1" numberOfLines={1}>
              {channel.name}
            </Text>
            {channel.isFavorite && (
              <Ionicons name="star" size={16} color={colors.primary} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}
