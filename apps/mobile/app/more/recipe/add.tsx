import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../../../hooks/useColorScheme";
import { api } from "../../../services/api";

export default function AddRecipeScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ingredients, setIngredients] = useState<string[]>([""]);
  const [steps, setSteps] = useState<string[]>([""]);
  const [prepTime, setPrepTime] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [servings, setServings] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [notes, setNotes] = useState("");

  const createRecipe = useMutation({
    mutationFn: () =>
      api.createRecipe({
        title,
        description: description || undefined,
        ingredients: ingredients.filter(Boolean).map((name) => ({ name })),
        steps: steps.filter(Boolean),
        prepTime: prepTime ? parseInt(prepTime) : undefined,
        cookTime: cookTime ? parseInt(cookTime) : undefined,
        servings: servings ? parseInt(servings) : undefined,
        sourceUrl: sourceUrl || undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      router.back();
    },
    onError: (error) => {
      Alert.alert("Error", error.message);
    },
  });

  const addIngredient = () => setIngredients([...ingredients, ""]);
  const updateIngredient = (index: number, value: string) => {
    const updated = [...ingredients];
    updated[index] = value;
    setIngredients(updated);
  };
  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const addStep = () => setSteps([...steps, ""]);
  const updateStep = (index: number, value: string) => {
    const updated = [...steps];
    updated[index] = value;
    setSteps(updated);
  };
  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const inputStyle = {
    color: colors.foreground,
    borderColor: colors.border,
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Title */}
      <Text className="text-foreground font-medium mb-1">Title *</Text>
      <TextInput
        className="bg-card border border-border rounded-xl px-4 py-3 mb-4 text-foreground"
        style={inputStyle}
        placeholder="Recipe title"
        placeholderTextColor={colors.mutedForeground}
        value={title}
        onChangeText={setTitle}
      />

      {/* Description */}
      <Text className="text-foreground font-medium mb-1">Description</Text>
      <TextInput
        className="bg-card border border-border rounded-xl px-4 py-3 mb-4 text-foreground"
        style={inputStyle}
        placeholder="Brief description"
        placeholderTextColor={colors.mutedForeground}
        value={description}
        onChangeText={setDescription}
        multiline
      />

      {/* Time / Servings */}
      <View className="flex-row gap-3 mb-4">
        <View className="flex-1">
          <Text className="text-foreground font-medium mb-1">Prep (min)</Text>
          <TextInput
            className="bg-card border border-border rounded-xl px-4 py-3 text-foreground"
            style={inputStyle}
            placeholder="0"
            placeholderTextColor={colors.mutedForeground}
            value={prepTime}
            onChangeText={setPrepTime}
            keyboardType="numeric"
          />
        </View>
        <View className="flex-1">
          <Text className="text-foreground font-medium mb-1">Cook (min)</Text>
          <TextInput
            className="bg-card border border-border rounded-xl px-4 py-3 text-foreground"
            style={inputStyle}
            placeholder="0"
            placeholderTextColor={colors.mutedForeground}
            value={cookTime}
            onChangeText={setCookTime}
            keyboardType="numeric"
          />
        </View>
        <View className="flex-1">
          <Text className="text-foreground font-medium mb-1">Servings</Text>
          <TextInput
            className="bg-card border border-border rounded-xl px-4 py-3 text-foreground"
            style={inputStyle}
            placeholder="0"
            placeholderTextColor={colors.mutedForeground}
            value={servings}
            onChangeText={setServings}
            keyboardType="numeric"
          />
        </View>
      </View>

      {/* Ingredients */}
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-foreground font-medium">Ingredients</Text>
        <TouchableOpacity onPress={addIngredient}>
          <Ionicons name="add-circle" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>
      {ingredients.map((ing, i) => (
        <View key={i} className="flex-row items-center mb-2">
          <TextInput
            className="flex-1 bg-card border border-border rounded-xl px-4 py-3 text-foreground"
            style={inputStyle}
            placeholder={`Ingredient ${i + 1}`}
            placeholderTextColor={colors.mutedForeground}
            value={ing}
            onChangeText={(v) => updateIngredient(i, v)}
          />
          {ingredients.length > 1 && (
            <TouchableOpacity className="ml-2" onPress={() => removeIngredient(i)}>
              <Ionicons name="close-circle" size={22} color={colors.destructive} />
            </TouchableOpacity>
          )}
        </View>
      ))}

      {/* Steps */}
      <View className="flex-row items-center justify-between mb-2 mt-4">
        <Text className="text-foreground font-medium">Steps</Text>
        <TouchableOpacity onPress={addStep}>
          <Ionicons name="add-circle" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>
      {steps.map((step, i) => (
        <View key={i} className="flex-row items-center mb-2">
          <Text className="text-muted-foreground w-6">{i + 1}.</Text>
          <TextInput
            className="flex-1 bg-card border border-border rounded-xl px-4 py-3 text-foreground"
            style={inputStyle}
            placeholder={`Step ${i + 1}`}
            placeholderTextColor={colors.mutedForeground}
            value={step}
            onChangeText={(v) => updateStep(i, v)}
            multiline
          />
          {steps.length > 1 && (
            <TouchableOpacity className="ml-2" onPress={() => removeStep(i)}>
              <Ionicons name="close-circle" size={22} color={colors.destructive} />
            </TouchableOpacity>
          )}
        </View>
      ))}

      {/* Source URL */}
      <Text className="text-foreground font-medium mb-1 mt-4">Source URL</Text>
      <TextInput
        className="bg-card border border-border rounded-xl px-4 py-3 mb-4 text-foreground"
        style={inputStyle}
        placeholder="https://..."
        placeholderTextColor={colors.mutedForeground}
        value={sourceUrl}
        onChangeText={setSourceUrl}
        keyboardType="url"
        autoCapitalize="none"
      />

      {/* Notes */}
      <Text className="text-foreground font-medium mb-1">Notes</Text>
      <TextInput
        className="bg-card border border-border rounded-xl px-4 py-3 mb-6 text-foreground"
        style={inputStyle}
        placeholder="Additional notes..."
        placeholderTextColor={colors.mutedForeground}
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
      />

      {/* Save */}
      <TouchableOpacity
        className="bg-primary rounded-xl py-4 items-center"
        onPress={() => createRecipe.mutate()}
        disabled={!title.trim() || createRecipe.isPending}
      >
        {createRecipe.isPending ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text className="text-white font-semibold text-base">Save Recipe</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}
