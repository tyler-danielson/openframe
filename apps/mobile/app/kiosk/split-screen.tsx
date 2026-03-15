import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../services/api";
import { useThemeColors } from "../../hooks/useColorScheme";

type Position = "left" | "right";
type Ratio = "half" | "third";
type SourceType = "dashboard" | "url" | "text" | "widget";

const WIDGET_OPTIONS = [
  { type: "clock", label: "Clock", icon: "time" as const },
  { type: "weather", label: "Weather", icon: "cloudy" as const },
  { type: "calendar", label: "Calendar", icon: "calendar" as const },
  { type: "tasks", label: "Tasks", icon: "checkbox-outline" as const },
  { type: "up-next", label: "Up Next", icon: "arrow-forward-circle" as const },
  { type: "forecast", label: "Forecast", icon: "sunny" as const },
  { type: "news", label: "News", icon: "newspaper" as const },
  { type: "sports", label: "Sports", icon: "football" as const },
  { type: "countdown", label: "Countdown", icon: "timer" as const },
];

export default function SplitScreenConfigScreen() {
  const { kioskId, dashboards: dashboardsParam } = useLocalSearchParams<{
    kioskId: string;
    dashboards: string;
  }>();
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const dashboards: { id: string; name: string; type: string }[] = dashboardsParam
    ? JSON.parse(dashboardsParam)
    : [];

  const [step, setStep] = useState(1);
  const [position, setPosition] = useState<Position>("right");
  const [ratio, setRatio] = useState<Ratio>("half");
  const [sourceType, setSourceType] = useState<SourceType | null>(null);
  const [dashboardPath, setDashboardPath] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [widgetType, setWidgetType] = useState<string | null>(null);

  const sendCommand = useMutation({
    mutationFn: ({ type, payload }: { type: string; payload?: Record<string, unknown> }) =>
      api.sendKioskCommand(kioskId, type, payload),
    onSuccess: () => router.back(),
    onError: (e: Error) => Alert.alert("Error", e.message),
  });

  const handleConfirm = () => {
    if (!sourceType) return;

    const payload: Record<string, unknown> = {
      position,
      ratio,
      sourceType,
    };

    if (sourceType === "dashboard" && dashboardPath) {
      payload.dashboardPath = dashboardPath;
    } else if (sourceType === "url" && url) {
      payload.url = url.startsWith("http") ? url : `https://${url}`;
    } else if (sourceType === "text" && text) {
      payload.text = text;
    } else if (sourceType === "widget" && widgetType) {
      payload.widgetType = widgetType;
    } else {
      Alert.alert("Missing", "Please complete the source configuration.");
      return;
    }

    sendCommand.mutate({ type: "split-screen", payload });
  };

  const canConfirm =
    sourceType === "dashboard" ? !!dashboardPath :
    sourceType === "url" ? url.length > 0 :
    sourceType === "text" ? text.length > 0 :
    sourceType === "widget" ? !!widgetType :
    false;

  const SplitPreview = ({ pos, rat, primaryLabel, secondaryLabel }: {
    pos: Position; rat: Ratio; primaryLabel?: string; secondaryLabel?: string;
  }) => {
    const secondaryFlex = rat === "half" ? 1 : 0.5;
    const primaryFlex = rat === "half" ? 1 : 1.5;

    const primary = (
      <View style={{ flex: primaryFlex, backgroundColor: colors.card, borderRadius: 4, margin: 2, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>{primaryLabel || "Current Page"}</Text>
      </View>
    );
    const secondary = (
      <View style={{ flex: secondaryFlex, backgroundColor: colors.primary + "30", borderRadius: 4, margin: 2, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: colors.primary, fontSize: 10, fontWeight: "600" }}>{secondaryLabel || "New Source"}</Text>
      </View>
    );

    return (
      <View style={{ flexDirection: "row", height: 60, borderRadius: 8, borderWidth: 1, borderColor: colors.border, overflow: "hidden", backgroundColor: colors.background }}>
        {pos === "left" ? <>{secondary}{primary}</> : <>{primary}{secondary}</>}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{
        flexDirection: "row", alignItems: "center",
        paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 12,
        backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border,
      }}>
        <TouchableOpacity onPress={() => step > 1 ? setStep(step - 1) : router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={{ flex: 1, marginLeft: 12, color: colors.foreground, fontSize: 18, fontWeight: "600" }}>
          Split Screen
        </Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
          Step {step} of 3
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {/* Step 1: Position */}
        {step === 1 && (
          <>
            <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "700", marginBottom: 4 }}>
              Panel Position
            </Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 20 }}>
              Where should the new panel appear?
            </Text>

            <TouchableOpacity
              onPress={() => setPosition("right")}
              style={{
                backgroundColor: position === "right" ? colors.primary + "15" : colors.card,
                borderRadius: 12, borderWidth: 2,
                borderColor: position === "right" ? colors.primary : colors.border,
                padding: 16, marginBottom: 12,
              }}
            >
              <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "600", marginBottom: 8 }}>
                Right Side
              </Text>
              <SplitPreview pos="right" rat="half" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setPosition("left")}
              style={{
                backgroundColor: position === "left" ? colors.primary + "15" : colors.card,
                borderRadius: 12, borderWidth: 2,
                borderColor: position === "left" ? colors.primary : colors.border,
                padding: 16,
              }}
            >
              <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "600", marginBottom: 8 }}>
                Left Side
              </Text>
              <SplitPreview pos="left" rat="half" />
            </TouchableOpacity>
          </>
        )}

        {/* Step 2: Ratio */}
        {step === 2 && (
          <>
            <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "700", marginBottom: 4 }}>
              Split Ratio
            </Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 20 }}>
              How much space for the new panel?
            </Text>

            <TouchableOpacity
              onPress={() => setRatio("half")}
              style={{
                backgroundColor: ratio === "half" ? colors.primary + "15" : colors.card,
                borderRadius: 12, borderWidth: 2,
                borderColor: ratio === "half" ? colors.primary : colors.border,
                padding: 16, marginBottom: 12,
              }}
            >
              <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "600", marginBottom: 8 }}>
                50 / 50
              </Text>
              <SplitPreview pos={position} rat="half" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setRatio("third")}
              style={{
                backgroundColor: ratio === "third" ? colors.primary + "15" : colors.card,
                borderRadius: 12, borderWidth: 2,
                borderColor: ratio === "third" ? colors.primary : colors.border,
                padding: 16,
              }}
            >
              <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "600", marginBottom: 8 }}>
                67 / 33
              </Text>
              <SplitPreview pos={position} rat="third" />
            </TouchableOpacity>
          </>
        )}

        {/* Step 3: Source */}
        {step === 3 && (
          <>
            <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "700", marginBottom: 4 }}>
              Second Source
            </Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 20 }}>
              What to show in the new panel?
            </Text>

            {/* Dashboard option */}
            {dashboards.length > 0 && (
              <View style={{ marginBottom: 12 }}>
                <TouchableOpacity
                  onPress={() => setSourceType(sourceType === "dashboard" ? null : "dashboard")}
                  style={{
                    backgroundColor: sourceType === "dashboard" ? colors.primary + "15" : colors.card,
                    borderRadius: 12, borderWidth: 2,
                    borderColor: sourceType === "dashboard" ? colors.primary : colors.border,
                    padding: 16,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Ionicons name="apps" size={22} color={sourceType === "dashboard" ? colors.primary : colors.foreground} />
                    <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "600", flex: 1 }}>Dashboard</Text>
                    <Ionicons name={sourceType === "dashboard" ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
                  </View>
                </TouchableOpacity>
                {sourceType === "dashboard" && (
                  <View style={{ backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginTop: 8, overflow: "hidden" }}>
                    {dashboards.map((d, i) => (
                      <TouchableOpacity
                        key={d.id}
                        onPress={() => setDashboardPath(d.type)}
                        style={{
                          flexDirection: "row", alignItems: "center",
                          paddingVertical: 14, paddingHorizontal: 16,
                          borderBottomWidth: i < dashboards.length - 1 ? 1 : 0,
                          borderBottomColor: colors.border,
                          backgroundColor: dashboardPath === d.type ? colors.primary + "10" : undefined,
                        }}
                      >
                        <Ionicons
                          name={dashboardPath === d.type ? "radio-button-on" : "radio-button-off"}
                          size={20} color={dashboardPath === d.type ? colors.primary : colors.mutedForeground}
                        />
                        <Text style={{ color: colors.foreground, fontSize: 15, marginLeft: 12 }}>{d.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* URL option */}
            <View style={{ marginBottom: 12 }}>
              <TouchableOpacity
                onPress={() => setSourceType(sourceType === "url" ? null : "url")}
                style={{
                  backgroundColor: sourceType === "url" ? colors.primary + "15" : colors.card,
                  borderRadius: 12, borderWidth: 2,
                  borderColor: sourceType === "url" ? colors.primary : colors.border,
                  padding: 16,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Ionicons name="globe" size={22} color={sourceType === "url" ? colors.primary : colors.foreground} />
                  <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "600", flex: 1 }}>URL</Text>
                  <Ionicons name={sourceType === "url" ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
                </View>
              </TouchableOpacity>
              {sourceType === "url" && (
                <View style={{ marginTop: 8 }}>
                  <TextInput
                    value={url}
                    onChangeText={setUrl}
                    placeholder="https://example.com"
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    style={{
                      backgroundColor: colors.card, borderRadius: 12,
                      borderWidth: 1, borderColor: colors.border,
                      padding: 14, color: colors.foreground, fontSize: 15,
                    }}
                  />
                </View>
              )}
            </View>

            {/* Text option */}
            <View style={{ marginBottom: 12 }}>
              <TouchableOpacity
                onPress={() => setSourceType(sourceType === "text" ? null : "text")}
                style={{
                  backgroundColor: sourceType === "text" ? colors.primary + "15" : colors.card,
                  borderRadius: 12, borderWidth: 2,
                  borderColor: sourceType === "text" ? colors.primary : colors.border,
                  padding: 16,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Ionicons name="text" size={22} color={sourceType === "text" ? colors.primary : colors.foreground} />
                  <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "600", flex: 1 }}>Text</Text>
                  <Ionicons name={sourceType === "text" ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
                </View>
              </TouchableOpacity>
              {sourceType === "text" && (
                <View style={{ marginTop: 8 }}>
                  <TextInput
                    value={text}
                    onChangeText={setText}
                    placeholder="Enter text to display..."
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    style={{
                      backgroundColor: colors.card, borderRadius: 12,
                      borderWidth: 1, borderColor: colors.border,
                      padding: 14, color: colors.foreground, fontSize: 15,
                      minHeight: 100,
                    }}
                  />
                </View>
              )}
            </View>

            {/* Widget option */}
            <View style={{ marginBottom: 12 }}>
              <TouchableOpacity
                onPress={() => setSourceType(sourceType === "widget" ? null : "widget")}
                style={{
                  backgroundColor: sourceType === "widget" ? colors.primary + "15" : colors.card,
                  borderRadius: 12, borderWidth: 2,
                  borderColor: sourceType === "widget" ? colors.primary : colors.border,
                  padding: 16,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Ionicons name="grid" size={22} color={sourceType === "widget" ? colors.primary : colors.foreground} />
                  <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "600", flex: 1 }}>Widget</Text>
                  <Ionicons name={sourceType === "widget" ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
                </View>
              </TouchableOpacity>
              {sourceType === "widget" && (
                <View style={{ backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginTop: 8, overflow: "hidden" }}>
                  {WIDGET_OPTIONS.map((w, i) => (
                    <TouchableOpacity
                      key={w.type}
                      onPress={() => setWidgetType(w.type)}
                      style={{
                        flexDirection: "row", alignItems: "center",
                        paddingVertical: 14, paddingHorizontal: 16,
                        borderBottomWidth: i < WIDGET_OPTIONS.length - 1 ? 1 : 0,
                        borderBottomColor: colors.border,
                        backgroundColor: widgetType === w.type ? colors.primary + "10" : undefined,
                      }}
                    >
                      <Ionicons
                        name={w.icon}
                        size={20} color={widgetType === w.type ? colors.primary : colors.mutedForeground}
                      />
                      <Text style={{ color: colors.foreground, fontSize: 15, marginLeft: 12, flex: 1 }}>{w.label}</Text>
                      {widgetType === w.type && (
                        <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Bottom button */}
      <View style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        paddingHorizontal: 16, paddingBottom: insets.bottom + 16, paddingTop: 12,
        backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border,
      }}>
        {step < 3 ? (
          <TouchableOpacity
            onPress={() => setStep(step + 1)}
            style={{
              backgroundColor: colors.primary, borderRadius: 12,
              paddingVertical: 16, alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Next</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleConfirm}
            disabled={!canConfirm || sendCommand.isPending}
            style={{
              backgroundColor: canConfirm ? colors.primary : colors.mutedForeground,
              borderRadius: 12, paddingVertical: 16, alignItems: "center",
              opacity: canConfirm ? 1 : 0.5,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
              {sendCommand.isPending ? "Sending..." : "Start Split Screen"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
