import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Image } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../../hooks/useColorScheme";
import { api, type Recipe } from "../../services/api";

export default function RecipesScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { data: recipes, isLoading, refetch } = useQuery({
    queryKey: ["recipes"],
    queryFn: () => api.getRecipes(),
    staleTime: 5 * 60 * 1000,
  });

  if (!recipes?.length && !isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center p-6">
        <Ionicons name="book-outline" size={48} color={colors.mutedForeground} />
        <Text className="text-muted-foreground mt-4 text-center">No recipes yet</Text>
        <TouchableOpacity
          className="mt-4 bg-primary px-6 py-3 rounded-xl"
          onPress={() => router.push("/more/recipe/add")}
        >
          <Text className="text-white font-medium">Add Recipe</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />
        }
      >
        {/* Action buttons */}
        <View className="flex-row mb-4 gap-3">
          <TouchableOpacity
            className="flex-1 bg-card rounded-xl p-3 flex-row items-center justify-center border border-border"
            onPress={() => router.push("/more/recipe/add")}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
            <Text className="text-primary font-medium ml-2">Add</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-card rounded-xl p-3 flex-row items-center justify-center border border-border"
            onPress={() => router.push("/more/recipe/scan")}
          >
            <Ionicons name="camera-outline" size={20} color={colors.primary} />
            <Text className="text-primary font-medium ml-2">Scan</Text>
          </TouchableOpacity>
        </View>

        {/* Recipe grid */}
        <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
          {recipes?.map((recipe) => (
            <View key={recipe.id} style={{ width: "50%", paddingHorizontal: 6, marginBottom: 12 }}>
              <TouchableOpacity
                className="bg-card rounded-xl overflow-hidden"
                onPress={() => router.push(`/more/recipe/${recipe.id}`)}
                activeOpacity={0.7}
              >
                {recipe.imageUrl ? (
                  <Image
                    source={{ uri: api.getPhotoUrl(recipe.imageUrl) ?? recipe.imageUrl }}
                    className="w-full h-32"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="w-full h-32 bg-secondary items-center justify-center">
                    <Ionicons name="restaurant-outline" size={32} color={colors.mutedForeground} />
                  </View>
                )}
                <View className="p-3">
                  <Text className="text-foreground font-medium text-sm" numberOfLines={2}>
                    {recipe.title}
                  </Text>
                  {(recipe.prepTime || recipe.cookTime) && (
                    <Text className="text-muted-foreground text-xs mt-1">
                      {recipe.prepTime ? `Prep: ${recipe.prepTime}m` : ""}
                      {recipe.prepTime && recipe.cookTime ? " · " : ""}
                      {recipe.cookTime ? `Cook: ${recipe.cookTime}m` : ""}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
