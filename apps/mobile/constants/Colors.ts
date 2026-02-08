export type ColorScheme = "default" | "homio" | "ocean" | "forest" | "sunset" | "lavender";

export const COLOR_SCHEMES: { value: ColorScheme; label: string; accent: string }[] = [
  { value: "default", label: "Blue (Default)", accent: "#3B82F6" },
  { value: "homio", label: "Gold (HOMIO)", accent: "#C4A77D" },
  { value: "ocean", label: "Teal Ocean", accent: "#14B8A6" },
  { value: "forest", label: "Green Forest", accent: "#22C55E" },
  { value: "sunset", label: "Orange Sunset", accent: "#F97316" },
  { value: "lavender", label: "Purple Lavender", accent: "#A855F7" },
];

export const Colors = {
  light: {
    background: "#FFFFFF",
    foreground: "#0A0A0A",
    card: "#F4F4F5",
    cardForeground: "#0A0A0A",
    primary: "#3B82F6",
    primaryForeground: "#FFFFFF",
    secondary: "#F4F4F5",
    secondaryForeground: "#0A0A0A",
    muted: "#F4F4F5",
    mutedForeground: "#71717A",
    accent: "#F4F4F5",
    accentForeground: "#0A0A0A",
    destructive: "#EF4444",
    destructiveForeground: "#FFFFFF",
    border: "#E4E4E7",
  },
  dark: {
    background: "#0A0A0A",
    foreground: "#FAFAFA",
    card: "#18181B",
    cardForeground: "#FAFAFA",
    primary: "#3B82F6",
    primaryForeground: "#FFFFFF",
    secondary: "#27272A",
    secondaryForeground: "#FAFAFA",
    muted: "#27272A",
    mutedForeground: "#A1A1AA",
    accent: "#27272A",
    accentForeground: "#FAFAFA",
    destructive: "#EF4444",
    destructiveForeground: "#FAFAFA",
    border: "#27272A",
  },
};
