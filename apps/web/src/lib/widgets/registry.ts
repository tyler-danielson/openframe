import type { BuilderWidgetType } from "../../stores/screensaver";

export interface WidgetDefinition {
  name: string;
  icon: string;
  category: "time" | "weather" | "schedule" | "media" | "homeassistant" | "custom";
  defaultSize: { width: number; height: number };
  minSize: { width: number; height: number };
  maxSize: { width: number; height: number };
  defaultConfig: Record<string, unknown>;
  moduleId: string | null; // null = core widget (always available)
}

export const WIDGET_REGISTRY: Record<BuilderWidgetType, WidgetDefinition> = {
  clock: {
    name: "Clock",
    icon: "Clock",
    category: "time",
    defaultSize: { width: 3, height: 2 },
    minSize: { width: 1, height: 1 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      showSeconds: false,
      showDate: true,
      format24h: false,
    },
    moduleId: null,
  },
  countdown: {
    name: "Countdown",
    icon: "Timer",
    category: "time",
    defaultSize: { width: 3, height: 2 },
    minSize: { width: 1, height: 1 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      targetDate: "",
      label: "Countdown",
      showDays: true,
      showHours: true,
      showMinutes: true,
      showSeconds: false,
      eventId: "",           // Selected event ID (takes precedence over targetDate)
      displayMode: "full",   // "full" | "days"
    },
    moduleId: null,
  },
  weather: {
    name: "Current Weather",
    icon: "Cloud",
    category: "weather",
    defaultSize: { width: 3, height: 2 },
    minSize: { width: 1, height: 1 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      showIcon: true,
      showDescription: true,
      showHumidity: true,
      showWind: true,
    },
    moduleId: "weather",
  },
  forecast: {
    name: "Weather Forecast",
    icon: "CloudSun",
    category: "weather",
    defaultSize: { width: 4, height: 2 },
    minSize: { width: 1, height: 1 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      days: 5,
      showHighLow: true,
      showIcons: true,
    },
    moduleId: "weather",
  },
  calendar: {
    name: "Calendar Events",
    icon: "Calendar",
    category: "schedule",
    defaultSize: { width: 4, height: 3 },
    minSize: { width: 1, height: 1 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      maxItems: 5,
      showTime: true,
      showCalendarName: false,
      daysAhead: 7,
      calendarIds: [],            // Empty = all screensaver-visible calendars
      showUpcomingOnly: true,     // Filter out past events
    },
    moduleId: null,
  },
  "up-next": {
    name: "Up Next",
    icon: "CalendarClock",
    category: "schedule",
    defaultSize: { width: 4, height: 2 },
    minSize: { width: 1, height: 1 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      showCountdown: true,
      showLocation: true,
      showCalendarName: true,
      showDescription: false,
      maxItems: 10,
      calendarIds: [],            // Empty = all screensaver-visible calendars
      hideBlankEvents: false,
      hideDuplicates: false,
      hideAllDayEvents: false,
    },
    moduleId: null,
  },
  tasks: {
    name: "Tasks",
    icon: "CheckSquare",
    category: "schedule",
    defaultSize: { width: 3, height: 3 },
    minSize: { width: 1, height: 1 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      maxItems: 5,
      showDueDate: true,
      showOverdue: true,
    },
    moduleId: null,
  },
  sports: {
    name: "Sports Scores",
    icon: "Trophy",
    category: "schedule",
    defaultSize: { width: 4, height: 3 },
    minSize: { width: 1, height: 1 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      maxItems: 5,
      showLiveOnly: false,
      showScheduled: true,
    },
    moduleId: "sports",
  },
  spotify: {
    name: "Spotify Now Playing",
    icon: "Music",
    category: "media",
    defaultSize: { width: 4, height: 2 },
    minSize: { width: 1, height: 1 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      showAlbumArt: true,
      showProgress: true,
      showArtist: true,
    },
    moduleId: "spotify",
  },
  "ha-entity": {
    name: "HA Entity",
    icon: "Zap",
    category: "homeassistant",
    defaultSize: { width: 2, height: 2 },
    minSize: { width: 1, height: 1 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      entityId: "",
      showIcon: true,
      showName: true,
      showState: true,
      showLastChanged: false,
    },
    moduleId: "homeassistant",
  },
  "ha-gauge": {
    name: "HA Gauge",
    icon: "Gauge",
    category: "homeassistant",
    defaultSize: { width: 2, height: 2 },
    minSize: { width: 1, height: 1 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      entityId: "",
      min: 0,
      max: 100,
      unit: "",
      showValue: true,
      showName: true,
      warningValue: 70,
      criticalValue: 90,
    },
    moduleId: "homeassistant",
  },
  "ha-graph": {
    name: "HA Graph",
    icon: "LineChart",
    category: "homeassistant",
    defaultSize: { width: 4, height: 3 },
    minSize: { width: 1, height: 1 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      entityId: "",
      hours: 24,
      showLabels: true,
      showGrid: true,
      lineColor: "#3B82F6",
    },
    moduleId: "homeassistant",
  },
  "ha-camera": {
    name: "HA Camera",
    icon: "Camera",
    category: "homeassistant",
    defaultSize: { width: 4, height: 3 },
    minSize: { width: 1, height: 1 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      entityId: "",
      refreshInterval: 10,
    },
    moduleId: "homeassistant",
  },
  text: {
    name: "Text",
    icon: "Type",
    category: "custom",
    defaultSize: { width: 3, height: 2 },
    minSize: { width: 1, height: 1 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      content: "Hello World",
      fontSize: "medium",
      textAlign: "center",
      fontWeight: "normal",
    },
    moduleId: null,
  },
  image: {
    name: "Image",
    icon: "Image",
    category: "custom",
    defaultSize: { width: 4, height: 3 },
    minSize: { width: 1, height: 1 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      url: "",
      fit: "contain",
      refreshInterval: 0,
    },
    moduleId: null,
  },
  "photo-album": {
    name: "Photo Album",
    icon: "Images",
    category: "media",
    defaultSize: { width: 6, height: 4 },
    minSize: { width: 1, height: 1 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      source: "album",           // "album" | "ha-camera" | "reddit" | "custom-url"
      albumId: "",               // For local albums
      entityId: "",              // For HA cameras
      subreddit: "EarthPorn",    // For Reddit
      customUrl: "",             // For custom image URL/feed
      orientation: "all",        // "all" | "landscape" | "portrait"
      interval: 30,              // Seconds between photos
      intervalOffset: 0,         // Seconds delay before first transition
      transition: "fade",        // "fade" | "slide" | "zoom" | "none"
      transitionDuration: 1000,  // ms
      fit: "cover",              // "cover" | "contain"
      shuffle: true,
    },
    moduleId: "photos",
  },
  "fullscreen-toggle": {
    name: "Fullscreen Toggle",
    icon: "Maximize",
    category: "custom",
    defaultSize: { width: 1, height: 1 },
    minSize: { width: 1, height: 1 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      buttonStyle: "icon",      // "icon" | "text" | "both"
      label: "Fullscreen",
      iconSize: "medium",       // "small" | "medium" | "large"
    },
    moduleId: null,
  },
  "day-schedule": {
    name: "Day Schedule",
    icon: "CalendarDays",
    category: "schedule",
    defaultSize: { width: 4, height: 4 },
    minSize: { width: 2, height: 2 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      calendarIds: [],          // Empty = all screensaver-visible calendars
      viewMode: "fixed",        // "fixed" | "rolling"
      startHour: 6,             // 6 AM (for fixed mode)
      endHour: 22,              // 10 PM (for fixed mode)
      rollingOffsetMinutes: 60, // Minutes before current time (for rolling mode)
      rollingDurationHours: 8,  // Total hours to display (for rolling mode)
      showCurrentTime: true,
      showHourLabels: true,
    },
    moduleId: null,
  },
  news: {
    name: "News Headlines",
    icon: "Newspaper",
    category: "schedule",
    defaultSize: { width: 4, height: 3 },
    minSize: { width: 2, height: 2 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      maxItems: 5,
      showImages: true,
      showSource: true,
      showTime: true,
    },
    moduleId: "news",
  },
  "ha-map": {
    name: "HA Map",
    icon: "Map",
    category: "homeassistant",
    defaultSize: { width: 4, height: 4 },
    minSize: { width: 2, height: 2 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      showDeviceNames: true,
      darkMode: true,
      autoFitBounds: true,
      showLastUpdated: false,
      showEta: false,
      selectedDevices: [],
      selectedZones: [],
      deviceIcons: {},
    },
    moduleId: "homeassistant",
  },
  iptv: {
    name: "Live TV",
    icon: "Tv",
    category: "media",
    defaultSize: { width: 6, height: 4 },
    minSize: { width: 3, height: 2 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      channelId: "",
      serverId: "",
      showControls: true,
      autoPlay: true,
      muted: true,
    },
    moduleId: "iptv",
  },
  "week-schedule": {
    name: "Week Schedule",
    icon: "CalendarDays",
    category: "schedule",
    defaultSize: { width: 8, height: 5 },
    minSize: { width: 4, height: 3 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      calendarIds: [],
      numberOfDays: 5,
      startDay: "today",
      viewMode: "fixed",
      startHour: 6,
      endHour: 22,
      rollingOffsetMinutes: 60,
      rollingDurationHours: 8,
      showCurrentTime: true,
      showHourLabels: true,
      showAllDayEvents: true,
      showDayHeaders: true,
    },
    moduleId: null,
  },
  "photo-feed": {
    name: "Photo Feed",
    icon: "LayoutGrid",
    category: "media",
    defaultSize: { width: 6, height: 4 },
    minSize: { width: 2, height: 2 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      source: "reddit",
      albumId: "",
      subreddit: "EarthPorn",
      customUrls: [],
      layout: "grid",
      numberOfImages: 6,
      refreshInterval: 300,
      orientation: "all",
      shuffle: true,
      gap: 4,
      showTitles: false,
      roundedCorners: true,
    },
    moduleId: "photos",
  },
  youtube: {
    name: "YouTube",
    icon: "Youtube",
    category: "media",
    defaultSize: { width: 6, height: 4 },
    minSize: { width: 3, height: 2 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      videoId: "",
      playlistId: "",
      autoPlay: true,
      muted: true,
      showControls: true,
    },
    moduleId: "youtube",
  },
  plex: {
    name: "Plex",
    icon: "Play",
    category: "media",
    defaultSize: { width: 8, height: 5 },
    minSize: { width: 4, height: 3 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      serverId: "",
      ratingKey: "",
      autoPlay: true,
      showControls: true,
    },
    moduleId: "plex",
  },
  plexamp: {
    name: "PlexAmp",
    icon: "Music",
    category: "media",
    defaultSize: { width: 4, height: 4 },
    minSize: { width: 3, height: 3 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      serverId: "",
      ratingKey: "",
      autoPlay: true,
    },
    moduleId: "plex",
  },
  audiobookshelf: {
    name: "Audiobookshelf",
    icon: "BookOpen",
    category: "media",
    defaultSize: { width: 6, height: 5 },
    minSize: { width: 4, height: 3 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      serverId: "",
      itemId: "",
      autoPlay: true,
    },
    moduleId: "audiobookshelf",
  },
  support: {
    name: "Support",
    icon: "Heart",
    category: "custom",
    defaultSize: { width: 2, height: 2 },
    minSize: { width: 1, height: 1 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      buttonStyle: "both",
      label: "Buy me a beer",
    },
    moduleId: null,
  },
};

export const WIDGET_CATEGORIES = [
  { id: "time", name: "Time", icon: "Clock" },
  { id: "weather", name: "Weather", icon: "Cloud" },
  { id: "schedule", name: "Schedule", icon: "Calendar" },
  { id: "media", name: "Media", icon: "Music" },
  { id: "homeassistant", name: "Home Assistant", icon: "Zap" },
  { id: "custom", name: "Custom", icon: "Shapes" },
] as const;

export function getWidgetsByCategory(category: string, isModuleEnabled?: (id: string) => boolean): BuilderWidgetType[] {
  return (Object.keys(WIDGET_REGISTRY) as BuilderWidgetType[]).filter(
    (type) => {
      const def = WIDGET_REGISTRY[type];
      if (def.category !== category) return false;
      if (isModuleEnabled && def.moduleId && !isModuleEnabled(def.moduleId)) return false;
      return true;
    }
  );
}

export function getWidgetDefinition(type: BuilderWidgetType): WidgetDefinition {
  return WIDGET_REGISTRY[type];
}
