/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Dark theme colors matching web app
        background: "#0A0A0A",
        foreground: "#FAFAFA",
        card: "#18181B",
        "card-foreground": "#FAFAFA",
        primary: "#3B82F6",
        "primary-foreground": "#FFFFFF",
        secondary: "#27272A",
        "secondary-foreground": "#FAFAFA",
        muted: "#27272A",
        "muted-foreground": "#A1A1AA",
        accent: "#27272A",
        "accent-foreground": "#FAFAFA",
        destructive: "#EF4444",
        "destructive-foreground": "#FAFAFA",
        border: "#27272A",
        ring: "#3B82F6",
        // Color scheme accents
        "scheme-default": "#3B82F6",
        "scheme-homio": "#C4A77D",
        "scheme-ocean": "#14B8A6",
        "scheme-forest": "#22C55E",
        "scheme-sunset": "#F97316",
        "scheme-lavender": "#A855F7",
      },
      fontFamily: {
        sans: ["Inter", "System"],
      },
    },
  },
  plugins: [],
};
