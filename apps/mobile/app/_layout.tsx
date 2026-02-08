import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { View, ActivityIndicator } from "react-native";
import { useAuthStore } from "../stores/auth";
import { useColorScheme } from "../hooks/useColorScheme";
import "../global.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, serverUrl } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const needsAuth = !isAuthenticated || !serverUrl;

    if (needsAuth && !inAuthGroup) {
      // Redirect to login
      router.replace("/(auth)/login");
    } else if (!needsAuth && inAuthGroup) {
      // Redirect to main app
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, isLoading, serverUrl, segments, router]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      <AuthGate>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: colorScheme === "dark" ? "#0A0A0A" : "#FFFFFF",
            },
          }}
        >
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="event/[id]"
            options={{
              headerShown: true,
              presentation: "modal",
              title: "Event",
            }}
          />
          <Stack.Screen
            name="event/new"
            options={{
              headerShown: true,
              presentation: "modal",
              title: "New Event",
            }}
          />
        </Stack>
      </AuthGate>
    </QueryClientProvider>
  );
}
