import { Platform } from "react-native";
import { api } from "./api";

// Lazy imports for optional dependencies — these may not be installed yet
let Notifications: typeof import("expo-notifications") | null = null;
let Device: typeof import("expo-device") | null = null;

async function loadDeps() {
  if (!Notifications) {
    try {
      Notifications = await import("expo-notifications");
      Device = await import("expo-device");
    } catch {
      console.log("[Push] expo-notifications or expo-device not available");
    }
  }
}

export async function setupNotificationHandler() {
  await loadDeps();
  if (!Notifications) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export async function registerForPushNotifications(): Promise<string | null> {
  await loadDeps();
  if (!Notifications || !Device) return null;

  if (!Device.isDevice) {
    console.log("[Push] Push notifications require a physical device");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  // Android notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    const deviceId = Device.modelId ?? Device.deviceName ?? "unknown-device";
    const platform = Platform.OS === "ios" ? "ios" : "android";

    await api.registerPushToken(token, deviceId, platform);
    return token;
  } catch (error) {
    console.error("[Push] Failed to register push token:", error);
    return null;
  }
}

export function setupNotificationListeners(
  onNotificationTap: (data: Record<string, unknown>) => void
): () => void {
  if (!Notifications) return () => {};

  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      onNotificationTap(data);
    }
  );

  return () => subscription.remove();
}
