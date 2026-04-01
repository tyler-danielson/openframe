import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Image } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useThemeColors } from "../../hooks/useColorScheme";
import { api, type NewsArticle } from "../../services/api";

export default function NewsScreen() {
  const colors = useThemeColors();
  const { data: news, isLoading, refetch } = useQuery({
    queryKey: ["news"],
    queryFn: () => api.getNews(),
    staleTime: 10 * 60 * 1000,
  });

  if (!news?.length && !isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center p-6">
        <Ionicons name="newspaper-outline" size={48} color={colors.mutedForeground} />
        <Text className="text-muted-foreground mt-4 text-center">No news available</Text>
      </View>
    );
  }

  const openArticle = (article: NewsArticle) => {
    const url = article.url ?? article.link;
    if (url) {
      WebBrowser.openBrowserAsync(url);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />
      }
    >
      {news?.map((article) => (
        <NewsRow key={article.id} article={article} onPress={() => openArticle(article)} colors={colors} />
      ))}
    </ScrollView>
  );
}

function NewsRow({
  article,
  onPress,
  colors,
}: {
  article: NewsArticle;
  onPress: () => void;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <TouchableOpacity
      className="bg-card rounded-xl p-3 flex-row mb-3"
      onPress={onPress}
      activeOpacity={0.7}
    >
      {article.imageUrl && (
        <Image
          source={{ uri: article.imageUrl }}
          className="w-16 h-16 rounded-lg mr-3"
          resizeMode="cover"
        />
      )}
      <View className="flex-1 justify-center">
        <Text className="text-foreground font-medium text-sm" numberOfLines={3}>
          {article.title}
        </Text>
        <View className="flex-row items-center mt-1">
          {article.source && (
            <Text className="text-primary text-xs mr-2">{article.source}</Text>
          )}
          {article.publishedAt && (
            <Text className="text-muted-foreground text-xs">
              {formatRelative(article.publishedAt)}
            </Text>
          )}
        </View>
      </View>
      <View className="justify-center ml-2">
        <Ionicons name="open-outline" size={16} color={colors.mutedForeground} />
      </View>
    </TouchableOpacity>
  );
}

function formatRelative(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return "";
  }
}
