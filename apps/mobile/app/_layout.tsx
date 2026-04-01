import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { View, ActivityIndicator } from "react-native";
import { useAuthStore } from "../stores/auth";
import { useCompanionStore } from "../stores/companion";
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
  const { fetchContext } = useCompanionStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inOAuthCallback = segments[0] === "auth" && segments[1] === "callback";
    const needsAuth = !isAuthenticated || !serverUrl;

    // Don't redirect while the OAuth callback is processing
    if (inOAuthCallback) return;

    if (needsAuth && !inAuthGroup) {
      // Redirect to login
      router.replace("/(auth)/login");
    } else if (!needsAuth && inAuthGroup) {
      // Redirect to main app
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, isLoading, serverUrl, segments, router]);

  // Fetch companion permissions on auth
  useEffect(() => {
    if (isAuthenticated && serverUrl) {
      fetchContext();
    }
  }, [isAuthenticated, serverUrl]);

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
          <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="event/[id]"
            options={{
              headerShown: false,
              presentation: "modal",
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
          <Stack.Screen
            name="album/[id]"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="kiosk/[id]"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="kiosk/split-screen"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen name="more/recipes" options={{ headerShown: true, title: "Recipes" }} />
          <Stack.Screen name="more/recipe/[id]" options={{ headerShown: true, title: "Recipe" }} />
          <Stack.Screen name="more/recipe/add" options={{ headerShown: true, title: "Add Recipe", presentation: "modal" }} />
          <Stack.Screen name="more/recipe/scan" options={{ headerShown: true, title: "Scan Recipe", presentation: "modal" }} />
          <Stack.Screen name="more/weather" options={{ headerShown: true, title: "Weather" }} />
          <Stack.Screen name="more/news" options={{ headerShown: true, title: "News" }} />
          <Stack.Screen name="more/homeassistant" options={{ headerShown: true, title: "Home Assistant" }} />
          <Stack.Screen name="more/iptv" options={{ headerShown: true, title: "IPTV" }} />
          <Stack.Screen name="more/fileshare" options={{ headerShown: true, title: "Shared Files" }} />
          <Stack.Screen name="more/join-requests" options={{ headerShown: true, title: "Companion Invites" }} />
        </Stack>
      </AuthGate>
    </QueryClientProvider>
  );
}
