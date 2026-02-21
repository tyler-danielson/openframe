export type ModuleId =
  | "weather"
  | "photos"
  | "cameras"
  | "homeassistant"
  | "automations"
  | "map"
  | "cast"
  | "spotify"
  | "iptv"
  | "youtube"
  | "plex"
  | "audiobookshelf"
  | "sports"
  | "news"
  | "routines"
  | "recipes"
  | "remarkable"
  | "planner"
  | "ai-chat"
  | "ai-briefing"
  | "gmail"
  | "telegram"
  | "capacities"
  | "matter"
  | "companion";

export type ModuleCategory =
  | "smart-home"
  | "entertainment"
  | "media"
  | "productivity"
  | "ai"
  | "communication"
  | "information"
  | "system";

export interface ModuleDefinition {
  id: ModuleId;
  name: string;
  description: string;
  icon: string;
  category: ModuleCategory;
  dependsOn: ModuleId[];
}

export const MODULE_REGISTRY: Record<ModuleId, ModuleDefinition> = {
  weather: {
    id: "weather",
    name: "Weather",
    description: "Current conditions, forecasts, and weather widgets",
    icon: "CloudSun",
    category: "information",
    dependsOn: [],
  },
  photos: {
    id: "photos",
    name: "Photos",
    description: "Photo albums, slideshows, and photo widgets",
    icon: "Image",
    category: "media",
    dependsOn: [],
  },
  cameras: {
    id: "cameras",
    name: "Cameras",
    description: "Live camera feeds and RTSP streams",
    icon: "Camera",
    category: "media",
    dependsOn: [],
  },
  homeassistant: {
    id: "homeassistant",
    name: "Home Assistant",
    description: "Smart home control and entity monitoring",
    icon: "Home",
    category: "smart-home",
    dependsOn: [],
  },
  automations: {
    id: "automations",
    name: "Automations",
    description: "Automated triggers and actions for your home",
    icon: "Zap",
    category: "smart-home",
    dependsOn: ["homeassistant"],
  },
  map: {
    id: "map",
    name: "Map & Location",
    description: "Device tracking and zone maps via Home Assistant",
    icon: "MapPin",
    category: "smart-home",
    dependsOn: ["homeassistant"],
  },
  cast: {
    id: "cast",
    name: "Chromecast",
    description: "Cast media to Chromecast devices",
    icon: "Cast",
    category: "smart-home",
    dependsOn: ["homeassistant"],
  },
  spotify: {
    id: "spotify",
    name: "Spotify",
    description: "Now playing, playback controls, and music widgets",
    icon: "Music",
    category: "entertainment",
    dependsOn: [],
  },
  iptv: {
    id: "iptv",
    name: "Live TV (IPTV)",
    description: "Live TV channels via IPTV/M3U streams",
    icon: "Tv",
    category: "entertainment",
    dependsOn: [],
  },
  youtube: {
    id: "youtube",
    name: "YouTube",
    description: "Embed YouTube videos and playlists",
    icon: "Youtube",
    category: "entertainment",
    dependsOn: [],
  },
  plex: {
    id: "plex",
    name: "Plex",
    description: "Browse and play Plex media library",
    icon: "Play",
    category: "entertainment",
    dependsOn: [],
  },
  audiobookshelf: {
    id: "audiobookshelf",
    name: "Audiobookshelf",
    description: "Audiobook and podcast player",
    icon: "BookOpen",
    category: "entertainment",
    dependsOn: [],
  },
  sports: {
    id: "sports",
    name: "Sports Scores",
    description: "Live scores and schedules for favorite teams",
    icon: "Trophy",
    category: "entertainment",
    dependsOn: [],
  },
  news: {
    id: "news",
    name: "News & RSS",
    description: "News headlines and RSS feed reader",
    icon: "Newspaper",
    category: "entertainment",
    dependsOn: [],
  },
  routines: {
    id: "routines",
    name: "Routines & Habits",
    description: "Daily routines and habit tracking",
    icon: "ListChecks",
    category: "productivity",
    dependsOn: [],
  },
  recipes: {
    id: "recipes",
    name: "Kitchen & Recipes",
    description: "Recipe manager and kitchen timers",
    icon: "ChefHat",
    category: "productivity",
    dependsOn: [],
  },
  remarkable: {
    id: "remarkable",
    name: "reMarkable",
    description: "Sync and view reMarkable tablet documents",
    icon: "PenTool",
    category: "productivity",
    dependsOn: [],
  },
  planner: {
    id: "planner",
    name: "Printable Planner",
    description: "Customizable printable daily and weekly planners",
    icon: "FileText",
    category: "productivity",
    dependsOn: [],
  },
  "ai-chat": {
    id: "ai-chat",
    name: "AI Chat",
    description: "Chat with an AI assistant about your schedule",
    icon: "MessageCircle",
    category: "ai",
    dependsOn: [],
  },
  "ai-briefing": {
    id: "ai-briefing",
    name: "Daily Briefing",
    description: "AI-generated daily summary and highlights",
    icon: "Sparkles",
    category: "ai",
    dependsOn: [],
  },
  gmail: {
    id: "gmail",
    name: "Gmail Highlights",
    description: "Recent email summaries from Gmail",
    icon: "Mail",
    category: "ai",
    dependsOn: [],
  },
  telegram: {
    id: "telegram",
    name: "Telegram Bot",
    description: "Control OpenFrame via Telegram bot commands",
    icon: "Send",
    category: "communication",
    dependsOn: [],
  },
  capacities: {
    id: "capacities",
    name: "Capacities",
    description: "Sync notes and content from Capacities",
    icon: "BookOpen",
    category: "communication",
    dependsOn: [],
  },
  matter: {
    id: "matter",
    name: "Matter",
    description: "Direct Matter smart home device control",
    icon: "Cpu",
    category: "smart-home",
    dependsOn: [],
  },
  companion: {
    id: "companion",
    name: "Companion App",
    description: "Mobile companion app for remote access",
    icon: "Smartphone",
    category: "system",
    dependsOn: [],
  },
};

export const MODULE_IDS = Object.keys(MODULE_REGISTRY) as ModuleId[];

export const MODULE_CATEGORIES: { id: ModuleCategory; label: string }[] = [
  { id: "information", label: "Information" },
  { id: "media", label: "Media" },
  { id: "smart-home", label: "Smart Home" },
  { id: "entertainment", label: "Entertainment" },
  { id: "productivity", label: "Productivity" },
  { id: "ai", label: "AI" },
  { id: "communication", label: "Communication" },
  { id: "system", label: "System" },
];

/**
 * Get all modules that depend on a given module (direct dependents).
 */
export function getModuleDependents(moduleId: ModuleId): ModuleId[] {
  return MODULE_IDS.filter((id) => MODULE_REGISTRY[id].dependsOn.includes(moduleId));
}

/**
 * Check if all dependencies for a module are satisfied.
 */
export function areDependenciesMet(moduleId: ModuleId, enabledModules: Set<string>): boolean {
  return MODULE_REGISTRY[moduleId].dependsOn.every((dep) => enabledModules.has(dep));
}
