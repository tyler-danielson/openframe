import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../../hooks/useColorScheme";
import { useCompanionStore } from "../../stores/companion";

interface MenuItem {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  permissionFn?: () => boolean;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

export default function MoreScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const companion = useCompanionStore();

  const sections: MenuSection[] = [
    {
      title: "Media",
      items: [
        { label: "Recipes", icon: "book-outline", route: "/more/recipes", permissionFn: companion.canViewRecipes },
        { label: "IPTV", icon: "tv-outline", route: "/more/iptv", permissionFn: companion.canViewIptv },
      ],
    },
    {
      title: "Smart Home",
      items: [
        { label: "Home Assistant", icon: "flash-outline", route: "/more/homeassistant", permissionFn: companion.canViewHA },
      ],
    },
    {
      title: "Information",
      items: [
        { label: "News", icon: "newspaper-outline", route: "/more/news", permissionFn: companion.canViewNews },
        { label: "Weather", icon: "cloud-outline", route: "/more/weather", permissionFn: companion.canViewWeather },
      ],
    },
    {
      title: "File Sharing",
      items: [
        { label: "Shared Files", icon: "folder-outline", route: "/more/fileshare" },
      ],
    },
    ...(companion.isOwner()
      ? [
          {
            title: "System",
            items: [
              { label: "Companion Invites", icon: "person-add-outline" as keyof typeof Ionicons.glyphMap, route: "/more/join-requests" },
            ],
          },
        ]
      : []),
  ];

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingVertical: 16 }}
    >
      {sections.map((section) => {
        const visibleItems = section.items.filter(
          (item) => !item.permissionFn || item.permissionFn()
        );
        if (visibleItems.length === 0) return null;

        return (
          <View key={section.title} className="mb-6">
            <Text className="text-muted-foreground font-semibold text-xs uppercase tracking-wide px-4 mb-2">
              {section.title}
            </Text>
            <View className="bg-card rounded-xl mx-4 overflow-hidden">
              {visibleItems.map((item, index) => (
                <TouchableOpacity
                  key={item.route}
                  className={`flex-row items-center px-4 py-3.5 ${
                    index < visibleItems.length - 1 ? "border-b border-border" : ""
                  }`}
                  onPress={() => router.push(item.route as any)}
                  activeOpacity={0.7}
                >
                  <View
                    className="w-8 h-8 rounded-lg items-center justify-center mr-3"
                    style={{ backgroundColor: colors.primary + "15" }}
                  >
                    <Ionicons name={item.icon} size={18} color={colors.primary} />
                  </View>
                  <Text className="text-foreground flex-1 text-base">{item.label}</Text>
                  <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}
