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
} from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../stores/auth";
import { api } from "../../services/api";

type LoginStep = "serverUrl" | "credentials";

export default function LoginScreen() {
  const router = useRouter();
  const { setApiKey, setServerUrl, setTokens, setUser, serverUrl: storedServerUrl } =
    useAuthStore();

  const [step, setStep] = useState<LoginStep>(
    storedServerUrl ? "credentials" : "serverUrl"
  );
  const [serverUrl, setServerUrlInput] = useState(storedServerUrl ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [apiKey, setApiKeyInput] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanServerUrl = (url: string): string => {
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
      cleanUrl = `https://${cleanUrl}`;
    }
    return cleanUrl.replace(/\/$/, "");
  };

  const handleServerSubmit = async () => {
    if (!serverUrl.trim()) {
      setError("Please enter your server URL");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const cleanUrl = cleanServerUrl(serverUrl);
      const response = await fetch(`${cleanUrl}/api/v1/health`);
      if (!response.ok) {
        throw new Error("Could not reach server");
      }

      setServerUrl(cleanUrl);
      setServerUrlInput(cleanUrl);
      setStep("credentials");
    } catch {
      setError("Could not connect to server. Check the URL and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!email.trim()) {
      setError("Please enter your email");
      return;
    }
    if (!password.trim()) {
      setError("Please enter your password");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const currentServerUrl =
        useAuthStore.getState().serverUrl ?? cleanServerUrl(serverUrl);
      const result = await api.login(currentServerUrl, email.trim(), password);
      setTokens(result.accessToken, result.refreshToken);
      setUser(result.user);
      router.replace("/(tabs)");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApiKeyLogin = async () => {
    if (!apiKey.trim()) {
      setError("Please enter your API key");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      setApiKey(apiKey.trim());
      const user = await api.validateApiKey();
      setUser(user);
      router.replace("/(tabs)");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect";
      setError(message);
      useAuthStore.getState().logout();
      // Preserve server URL after API key failure
      const url = useAuthStore.getState().serverUrl ?? cleanServerUrl(serverUrl);
      setServerUrl(url);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuth = async (provider: "google" | "microsoft") => {
    setError(null);
    setIsLoading(true);

    try {
      const currentServerUrl = useAuthStore.getState().serverUrl;
      if (!currentServerUrl) {
        setError("Server URL not set");
        return;
      }

      const oauthBase = api.getOAuthUrl(provider);

      if (Platform.OS === "web") {
        // Web: redirect directly — callback page handles the return
        const returnUrl = window.location.origin;
        window.location.href = `${oauthBase}?returnUrl=${encodeURIComponent(returnUrl)}`;
        return;
      }

      // Native: use expo-web-browser
      const WebBrowser = await import("expo-web-browser");
      const redirectUrl = Linking.createURL("auth/callback");
      const authUrl = `${oauthBase}?callbackUrl=${encodeURIComponent(redirectUrl)}`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

      if (result.type === "success" && result.url) {
        const url = new URL(result.url);
        const accessToken = url.searchParams.get("accessToken");
        const refreshToken = url.searchParams.get("refreshToken");

        if (accessToken && refreshToken) {
          setTokens(accessToken, refreshToken);
          await api.fetchCurrentUser();
          router.replace("/(tabs)");
        } else {
          setError("OAuth login did not return valid tokens");
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "OAuth login failed";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeServer = () => {
    setStep("serverUrl");
    setError(null);
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
              {step === "serverUrl"
                ? "Connect to your OpenFrame server"
                : "Sign in to your account"}
            </Text>
          </View>

          {step === "serverUrl" ? (
            /* Step 1: Server URL */
            <View className="space-y-4">
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
                  onSubmitEditing={handleServerSubmit}
                  returnKeyType="next"
                />
              </View>

              {error && (
                <View className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 mt-4">
                  <Text className="text-destructive">{error}</Text>
                </View>
              )}

              <TouchableOpacity
                className={`bg-primary rounded-xl py-4 mt-6 ${
                  isLoading ? "opacity-50" : ""
                }`}
                onPress={handleServerSubmit}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-primary-foreground font-semibold text-center text-lg">
                    Continue
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            /* Step 2: Login methods */
            <View className="space-y-4">
              {/* Change server link */}
              <TouchableOpacity
                onPress={handleChangeServer}
                className="flex-row items-center mb-2"
              >
                <Ionicons name="server-outline" size={16} color="#71717A" />
                <Text className="text-muted-foreground text-sm ml-1">
                  {useAuthStore.getState().serverUrl}
                </Text>
                <Text className="text-primary text-sm ml-2">Change</Text>
              </TouchableOpacity>

              {/* Email */}
              <View>
                <Text className="text-foreground font-medium mb-2">Email</Text>
                <TextInput
                  className="bg-card border border-border rounded-xl px-4 py-3 text-foreground"
                  placeholder="you@example.com"
                  placeholderTextColor="#71717A"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                />
              </View>

              {/* Password */}
              <View className="mt-4">
                <Text className="text-foreground font-medium mb-2">
                  Password
                </Text>
                <TextInput
                  className="bg-card border border-border rounded-xl px-4 py-3 text-foreground"
                  placeholder="Your password"
                  placeholderTextColor="#71717A"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  textContentType="password"
                  onSubmitEditing={handleEmailLogin}
                  returnKeyType="go"
                />
              </View>

              {/* Error Message */}
              {error && (
                <View className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 mt-4">
                  <Text className="text-destructive">{error}</Text>
                </View>
              )}

              {/* Sign In Button */}
              <TouchableOpacity
                className={`bg-primary rounded-xl py-4 mt-6 ${
                  isLoading ? "opacity-50" : ""
                }`}
                onPress={handleEmailLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-primary-foreground font-semibold text-center text-lg">
                    Sign In
                  </Text>
                )}
              </TouchableOpacity>

              {/* OAuth Divider */}
              <View className="flex-row items-center my-6">
                <View className="flex-1 h-px bg-border" />
                <Text className="text-muted-foreground mx-4">or</Text>
                <View className="flex-1 h-px bg-border" />
              </View>

              {/* OAuth Buttons */}
              <TouchableOpacity
                className="bg-card border border-border rounded-xl py-3.5 flex-row items-center justify-center"
                onPress={() => handleOAuth("google")}
                disabled={isLoading}
              >
                <Ionicons name="logo-google" size={20} color="#FAFAFA" />
                <Text className="text-foreground font-semibold text-center ml-2">
                  Sign in with Google
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="bg-card border border-border rounded-xl py-3.5 flex-row items-center justify-center mt-3"
                onPress={() => handleOAuth("microsoft")}
                disabled={isLoading}
              >
                <Ionicons name="logo-microsoft" size={20} color="#FAFAFA" />
                <Text className="text-foreground font-semibold text-center ml-2">
                  Sign in with Microsoft
                </Text>
              </TouchableOpacity>

              {/* Advanced Section */}
              <View className="mt-6">
                <TouchableOpacity
                  onPress={() => setShowAdvanced(!showAdvanced)}
                  className="flex-row items-center justify-center py-2"
                >
                  <Text className="text-muted-foreground text-sm">
                    Advanced
                  </Text>
                  <Ionicons
                    name={showAdvanced ? "chevron-up" : "chevron-down"}
                    size={16}
                    color="#71717A"
                    style={{ marginLeft: 4 }}
                  />
                </TouchableOpacity>

                {showAdvanced && (
                  <View className="mt-3 space-y-3">
                    <View>
                      <Text className="text-foreground font-medium mb-2">
                        API Key
                      </Text>
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
                        Generate an API key in Settings → API Keys
                      </Text>
                    </View>

                    <TouchableOpacity
                      className={`bg-secondary border border-border rounded-xl py-3.5 mt-3 ${
                        isLoading ? "opacity-50" : ""
                      }`}
                      onPress={handleApiKeyLogin}
                      disabled={isLoading}
                    >
                      <Text className="text-foreground font-semibold text-center">
                        Connect with API Key
                      </Text>
                    </TouchableOpacity>

                    {/* Divider */}
                    <View className="flex-row items-center my-4">
                      <View className="flex-1 h-px bg-border" />
                      <Text className="text-muted-foreground mx-4">or</Text>
                      <View className="flex-1 h-px bg-border" />
                    </View>

                    {/* Scan QR Button */}
                    <TouchableOpacity
                      className="bg-secondary border border-border rounded-xl py-3.5 flex-row items-center justify-center"
                      onPress={handleScanQR}
                    >
                      <Ionicons name="qr-code" size={20} color="#FAFAFA" />
                      <Text className="text-foreground font-semibold text-center ml-2">
                        Scan QR Code
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
