import { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../../../hooks/useColorScheme";
import { api } from "../../../services/api";

export default function ScanRecipeScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) {
    return <View className="flex-1 bg-background" />;
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 bg-background items-center justify-center p-6">
        <Ionicons name="camera-outline" size={48} color={colors.mutedForeground} />
        <Text className="text-foreground text-lg font-medium mt-4 text-center">
          Camera Access Required
        </Text>
        <Text className="text-muted-foreground mt-2 text-center">
          We need camera access to scan recipes from photos
        </Text>
        <TouchableOpacity
          className="mt-6 bg-primary px-6 py-3 rounded-xl"
          onPress={requestPermission}
        >
          <Text className="text-white font-medium">Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleCapture = async () => {
    if (!cameraRef.current || isScanning) return;

    setIsScanning(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
      });

      if (!photo?.base64) {
        Alert.alert("Error", "Failed to capture photo");
        setIsScanning(false);
        return;
      }

      const recipe = await api.scanRecipe(photo.base64);
      // Navigate to add screen with pre-filled data
      // For now, navigate to the recipe detail if it was created
      if (recipe?.id) {
        router.replace(`/more/recipe/${recipe.id}`);
      } else {
        router.back();
      }
    } catch (error: any) {
      Alert.alert("Scan Failed", error.message ?? "Could not analyze the recipe. Try again.");
      setIsScanning(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <CameraView
        ref={cameraRef}
        className="flex-1"
        facing="back"
      >
        {/* Overlay */}
        <View className="flex-1 items-center justify-end pb-12">
          {isScanning ? (
            <View className="bg-black/70 rounded-2xl px-6 py-4 items-center">
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text className="text-white mt-3 font-medium">Analyzing recipe...</Text>
            </View>
          ) : (
            <>
              <Text className="text-white text-center mb-6 bg-black/50 px-4 py-2 rounded-lg">
                Point camera at a recipe and tap capture
              </Text>
              <TouchableOpacity
                className="w-20 h-20 rounded-full border-4 border-white items-center justify-center"
                style={{ backgroundColor: "rgba(255,255,255,0.3)" }}
                onPress={handleCapture}
              >
                <View className="w-16 h-16 rounded-full bg-white" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </CameraView>
    </View>
  );
}
