import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuthStore } from "../../stores/auth";
import { api } from "../../services/api";

export default function OAuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    accessToken?: string;
    refreshToken?: string;
  }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const { accessToken, refreshToken } = params;

      if (!accessToken || !refreshToken) {
        setError("Missing authentication tokens from OAuth callback");
        setTimeout(() => router.replace("/(auth)/login"), 2000);
        return;
      }

      try {
        useAuthStore.getState().setTokens(accessToken, refreshToken);
        await api.fetchCurrentUser();
        router.replace("/(tabs)");
      } catch {
        setError("Failed to complete sign in. Please try again.");
        useAuthStore.getState().logout();
        setTimeout(() => router.replace("/(auth)/login"), 2000);
      }
    };

    handleCallback();
  }, [params, router]);

  return (
    <View className="flex-1 bg-background items-center justify-center px-6">
      {error ? (
        <View className="items-center">
          <Text className="text-destructive text-lg text-center">{error}</Text>
          <Text className="text-muted-foreground mt-2 text-center">
            Redirecting to login...
          </Text>
        </View>
      ) : (
        <View className="items-center">
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text className="text-foreground mt-4 text-lg">
            Completing sign in...
          </Text>
        </View>
      )}
    </View>
  );
}
