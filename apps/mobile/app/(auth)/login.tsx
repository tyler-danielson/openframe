import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../stores/auth";
import { api } from "../../services/api";

export default function LoginScreen() {
  const router = useRouter();
  const { setApiKey, setServerUrl, setUser } = useAuthStore();
  const [serverUrl, setServerUrlInput] = useState("");
  const [apiKey, setApiKeyInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!serverUrl.trim()) {
      setError("Please enter your server URL");
      return;
    }
    if (!apiKey.trim()) {
      setError("Please enter your API key");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      // Clean up the server URL
      let cleanUrl = serverUrl.trim();
      if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
        cleanUrl = `https://${cleanUrl}`;
      }
      cleanUrl = cleanUrl.replace(/\/$/, "");

      // Store credentials temporarily for validation
      setServerUrl(cleanUrl);
      setApiKey(apiKey.trim());

      // Validate the API key
      const user = await api.validateApiKey();
      setUser(user);

      // Navigate to main app
      router.replace("/(tabs)");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect";
      setError(message);
      // Clear credentials on error
      useAuthStore.getState().logout();
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanQR = () => {
    router.push("/(auth)/scan");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-background"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 px-6 pt-20 pb-8">
          {/* Header */}
          <View className="items-center mb-12">
            <View className="w-20 h-20 bg-primary rounded-2xl items-center justify-center mb-4">
              <Ionicons name="calendar" size={40} color="#FFFFFF" />
            </View>
            <Text className="text-3xl font-bold text-foreground">
              OpenFrame
            </Text>
            <Text className="text-muted-foreground mt-2 text-center">
              Connect to your OpenFrame server
            </Text>
          </View>

          {/* Form */}
          <View className="space-y-4">
            {/* Server URL */}
            <View>
              <Text className="text-foreground font-medium mb-2">
                Server URL
              </Text>
              <TextInput
                className="bg-card border border-border rounded-xl px-4 py-3 text-foreground"
                placeholder="https://your-server.com"
                placeholderTextColor="#71717A"
                value={serverUrl}
                onChangeText={setServerUrlInput}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>

            {/* API Key */}
            <View className="mt-4">
              <Text className="text-foreground font-medium mb-2">API Key</Text>
              <TextInput
                className="bg-card border border-border rounded-xl px-4 py-3 text-foreground"
                placeholder="Your API key"
                placeholderTextColor="#71717A"
                value={apiKey}
                onChangeText={setApiKeyInput}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
              <Text className="text-muted-foreground text-sm mt-2">
                Generate an API key in your OpenFrame web app under Settings →
                API Keys
              </Text>
            </View>

            {/* Error Message */}
            {error && (
              <View className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 mt-4">
                <Text className="text-destructive">{error}</Text>
              </View>
            )}

            {/* Login Button */}
            <TouchableOpacity
              className={`bg-primary rounded-xl py-4 mt-6 ${
                isLoading ? "opacity-50" : ""
              }`}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-primary-foreground font-semibold text-center text-lg">
                  Connect
                </Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View className="flex-row items-center my-6">
              <View className="flex-1 h-px bg-border" />
              <Text className="text-muted-foreground mx-4">or</Text>
              <View className="flex-1 h-px bg-border" />
            </View>

            {/* Scan QR Button */}
            <TouchableOpacity
              className="bg-secondary border border-border rounded-xl py-4 flex-row items-center justify-center"
              onPress={handleScanQR}
            >
              <Ionicons name="qr-code" size={24} color="#FAFAFA" />
              <Text className="text-foreground font-semibold text-center text-lg ml-2">
                Scan QR Code
              </Text>
            </TouchableOpacity>

            <Text className="text-muted-foreground text-sm text-center mt-4">
              Scan the QR code from your OpenFrame web app Settings page for
              quick setup
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
