import { Stack } from "expo-router";
import { useColorScheme } from "../../hooks/useColorScheme";

export default function AuthLayout() {
  const colorScheme = useColorScheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colorScheme === "dark" ? "#0A0A0A" : "#FFFFFF",
        },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="scan" options={{ presentation: "modal" }} />
    </Stack>
  );
}
