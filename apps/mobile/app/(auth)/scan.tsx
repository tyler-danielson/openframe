import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../stores/auth";
import { api } from "../../services/api";

export default function ScanScreen() {
  const router = useRouter();
  const { setApiKey, setServerUrl, setUser } = useAuthStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleBarCodeScanned = async ({
    type,
    data,
  }: {
    type: string;
    data: string;
  }) => {
    if (scanned || isProcessing) return;

    setScanned(true);
    setIsProcessing(true);

    try {
      // Parse the QR code data
      // Expected format: openframe://connect?server=URL&apiKey=KEY
      // Or just a URL with query params: https://example.com?apiKey=KEY
      let serverUrl: string | null = null;
      let apiKey: string | null = null;

      if (data.startsWith("openframe://")) {
        // Custom scheme
        const url = new URL(data.replace("openframe://", "https://"));
        serverUrl = url.searchParams.get("server");
        apiKey = url.searchParams.get("apiKey");
      } else if (data.startsWith("http")) {
        // Regular URL - the server URL is the base, apiKey in params
        const url = new URL(data);
        apiKey = url.searchParams.get("apiKey");
        // Remove the apiKey param to get the server URL
        url.searchParams.delete("apiKey");
        serverUrl = url.origin;
      } else {
        // Try parsing as JSON
        try {
          const parsed = JSON.parse(data);
          serverUrl = parsed.server || parsed.serverUrl || parsed.url;
          apiKey = parsed.apiKey || parsed.key;
        } catch {
          throw new Error("Invalid QR code format");
        }
      }

      if (!serverUrl || !apiKey) {
        throw new Error("QR code missing server URL or API key");
      }

      // Store credentials
      setServerUrl(serverUrl);
      setApiKey(apiKey);

      // Validate
      const user = await api.validateApiKey();
      setUser(user);

      // Navigate to main app
      router.replace("/(tabs)");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect";
      Alert.alert("Connection Failed", message, [
        {
          text: "Try Again",
          onPress: () => {
            setScanned(false);
            setIsProcessing(false);
          },
        },
        {
          text: "Enter Manually",
          onPress: () => router.back(),
        },
      ]);
    }
  };

  if (!permission) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-foreground">Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-6">
        <Ionicons name="camera-outline" size={64} color="#71717A" />
        <Text className="text-foreground text-xl font-semibold mt-4 text-center">
          Camera Access Required
        </Text>
        <Text className="text-muted-foreground text-center mt-2">
          We need camera access to scan QR codes for quick login
        </Text>
        <TouchableOpacity
          className="bg-primary rounded-xl py-3 px-8 mt-6"
          onPress={requestPermission}
        >
          <Text className="text-primary-foreground font-semibold">
            Grant Access
          </Text>
        </TouchableOpacity>
        <TouchableOpacity className="mt-4 py-2" onPress={() => router.back()}>
          <Text className="text-muted-foreground">Enter manually instead</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <CameraView
        style={StyleSheet.absoluteFillObject}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
      />

      {/* Overlay */}
      <View className="flex-1">
        {/* Top bar */}
        <View className="pt-12 px-4 flex-row items-center justify-between">
          <TouchableOpacity
            className="w-10 h-10 bg-black/50 rounded-full items-center justify-center"
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Center frame */}
        <View className="flex-1 items-center justify-center">
          <View className="w-64 h-64 border-2 border-white/50 rounded-3xl">
            <View className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl" />
            <View className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl" />
            <View className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl" />
            <View className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl" />
          </View>
        </View>

        {/* Bottom text */}
        <View className="pb-20 px-6">
          <Text className="text-white text-center text-lg font-medium">
            Scan QR Code
          </Text>
          <Text className="text-white/70 text-center mt-2">
            Point your camera at the QR code in your OpenFrame Settings
          </Text>
        </View>
      </View>
    </View>
  );
}
