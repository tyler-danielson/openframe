import { View, Text, ScrollView, Image, Alert, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useThemeColors } from "../../../hooks/useColorScheme";
import { api } from "../../../services/api";

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: recipe, isLoading } = useQuery({
    queryKey: ["recipe", id],
    queryFn: () => api.getRecipe(id),
    enabled: !!id,
  });

  const deleteRecipe = useMutation({
    mutationFn: () => api.deleteRecipe(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      router.back();
    },
  });

  const handleDelete = () => {
    Alert.alert("Delete Recipe", "Are you sure you want to delete this recipe?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteRecipe.mutate() },
    ]);
  };

  if (isLoading || !recipe) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-muted-foreground">Loading...</Text>
      </View>
    );
  }

  const ingredientName = (ing: { item?: string; name?: string; amount?: string; unit?: string }) =>
    ing.item || ing.name || "Unknown";

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Hero image */}
      {recipe.imageUrl ? (
        <Image
          source={{ uri: api.getPhotoUrl(recipe.imageUrl) ?? recipe.imageUrl }}
          className="w-full h-56"
          resizeMode="cover"
        />
      ) : (
        <View className="w-full h-40 bg-card items-center justify-center">
          <Ionicons name="restaurant-outline" size={48} color={colors.mutedForeground} />
        </View>
      )}

      <View className="p-4">
        {/* Title */}
        <Text className="text-foreground text-2xl font-bold">{recipe.title}</Text>
        {recipe.description && (
          <Text className="text-muted-foreground mt-2">{recipe.description}</Text>
        )}

        {/* Meta row */}
        <View className="flex-row mt-4 gap-4">
          {recipe.prepTime != null && (
            <MetaItem icon="timer-outline" label="Prep" value={`${recipe.prepTime}m`} colors={colors} />
          )}
          {recipe.cookTime != null && (
            <MetaItem icon="flame-outline" label="Cook" value={`${recipe.cookTime}m`} colors={colors} />
          )}
          {recipe.servings != null && (
            <MetaItem icon="people-outline" label="Servings" value={String(recipe.servings)} colors={colors} />
          )}
        </View>

        {/* Ingredients */}
        {recipe.ingredients?.length > 0 && (
          <View className="mt-6">
            <Text className="text-foreground font-semibold text-lg mb-3">Ingredients</Text>
            {recipe.ingredients.map((ing, i) => (
              <View key={i} className="flex-row items-start mb-2">
                <View className="w-2 h-2 rounded-full bg-primary mt-1.5 mr-3" />
                <Text className="text-foreground flex-1">
                  {ing.amount && `${ing.amount} `}
                  {ing.unit && `${ing.unit} `}
                  {ingredientName(ing)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Steps */}
        {recipe.steps?.length > 0 && (
          <View className="mt-6">
            <Text className="text-foreground font-semibold text-lg mb-3">Instructions</Text>
            {recipe.steps.map((step, i) => (
              <View key={i} className="flex-row items-start mb-3">
                <View
                  className="w-6 h-6 rounded-full items-center justify-center mr-3 mt-0.5"
                  style={{ backgroundColor: colors.primary + "20" }}
                >
                  <Text className="text-primary text-xs font-bold">{i + 1}</Text>
                </View>
                <Text className="text-foreground flex-1">{step}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Tags */}
        {recipe.tags && recipe.tags.length > 0 && (
          <View className="flex-row flex-wrap mt-4 gap-2">
            {recipe.tags.map((tag) => (
              <View key={tag} className="bg-secondary px-3 py-1 rounded-full">
                <Text className="text-muted-foreground text-xs">{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Notes */}
        {recipe.notes && (
          <View className="mt-6 bg-card rounded-xl p-4">
            <Text className="text-muted-foreground text-sm font-medium mb-1">Notes</Text>
            <Text className="text-foreground">{recipe.notes}</Text>
          </View>
        )}

        {/* Source URL */}
        {recipe.sourceUrl && (
          <TouchableOpacity
            className="mt-4 flex-row items-center"
            onPress={() => WebBrowser.openBrowserAsync(recipe.sourceUrl!)}
          >
            <Ionicons name="link-outline" size={16} color={colors.primary} />
            <Text className="text-primary text-sm ml-1">View Source</Text>
          </TouchableOpacity>
        )}

        {/* Delete */}
        <TouchableOpacity
          className="mt-8 bg-destructive/10 rounded-xl p-4 flex-row items-center justify-center"
          onPress={handleDelete}
        >
          <Ionicons name="trash-outline" size={18} color={colors.destructive} />
          <Text className="text-destructive font-medium ml-2">Delete Recipe</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function MetaItem({
  icon,
  label,
  value,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View className="bg-card rounded-xl px-4 py-3 items-center flex-1">
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text className="text-foreground font-medium mt-1">{value}</Text>
      <Text className="text-muted-foreground text-xs">{label}</Text>
    </View>
  );
}
