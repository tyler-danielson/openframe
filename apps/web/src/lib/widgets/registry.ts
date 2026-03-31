import type { BuilderWidgetType } from "../../stores/screensaver";

export interface WidgetDefinition {
  name: string;
  description?: string;
  icon: string;
  category: "time" | "weather" | "schedule" | "media" | "homeassistant" | "custom" | "photos";
  defaultSize: { width: number; height: number };
  minSize: { width: number; height: number };
  maxSize: { width: number; height: number };
  defaultConfig: Record<string, unknown>;
  moduleId: string | null; // null = core widget (always available)
  deprecated?: boolean;
}

export interface WidgetPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  widgetType: BuilderWidgetType;
  configOverrides: Record<string, unknown>;
}

export const WIDGET_REGISTRY: Record<BuilderWidgetType, WidgetDefinition> = {
  clock: {
    name: "Clock",
    description: "Display the current time and date",
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
    description: "Count down to an event or date",
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
      autoDiscover: false,   // Auto-discover nearest countdown-enabled event
    },
    moduleId: null,
  },
  weather: {
    name: "Current Weather",
    description: "Current conditions, temperature, and details",
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
    description: "Multi-day forecast with highs and lows",
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
    description: "Monthly calendar grid with event dots",
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
    description: "Upcoming events agenda list",
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
    description: "To-do items and checklists",
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
    description: "Live scores for your favorite teams",
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
    description: "Now playing with album art and controls",
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
    description: "Display or control a Home Assistant entity",
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
    deprecated: true,
  },
  "ha-gauge": {
    name: "HA Gauge",
    description: "Circular gauge for HA sensor values",
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
    deprecated: true,
  },
  "ha-graph": {
    name: "HA Graph",
    description: "Time-series graph for HA sensor history",
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
    deprecated: true,
  },
  "ha-camera": {
    name: "HA Camera",
    description: "Live camera feed from Home Assistant",
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
    deprecated: true,
  },
  text: {
    name: "Text",
    description: "Custom text and notes with markdown",
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
    description: "Display a static image from URL",
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
    description: "Rotating photo slideshow from albums or feeds",
    icon: "Images",
    category: "photos",
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
    description: "Button to toggle fullscreen mode",
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
    description: "Today's events in a timeline view",
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
    description: "RSS news feed with scrolling ticker",
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
    description: "Map with Home Assistant device locations",
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
    deprecated: true,
  },
  ha: {
    name: "Home Assistant",
    description: "Display and control Home Assistant entities",
    icon: "Zap",
    category: "homeassistant",
    defaultSize: { width: 3, height: 3 },
    minSize: { width: 1, height: 1 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      entityId: "",
      displayMode: "auto",
      // Entity mode
      showIcon: true,
      showName: true,
      showState: true,
      showLastChanged: false,
      // Gauge mode
      min: 0,
      max: 100,
      unit: "",
      warningValue: 70,
      criticalValue: 90,
      // Graph mode
      hours: 24,
      showLabels: true,
      showGrid: true,
      lineColor: "#3B82F6",
      // Camera mode
      refreshInterval: 10,
      // Map mode
      showDeviceNames: true,
      darkMode: true,
      autoFitBounds: true,
      selectedDevices: [],
      selectedZones: [],
    },
    moduleId: "homeassistant",
  },
  iptv: {
    name: "Live TV",
    description: "Stream live TV channels via IPTV",
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
    description: "Weekly calendar with colored event blocks",
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
    description: "Photo grid or rotating single display",
    icon: "LayoutGrid",
    category: "photos",
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
    description: "Embed YouTube videos or livestreams",
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
    description: "Now playing from your Plex server",
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
    description: "Music playback from PlexAmp",
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
    description: "Now playing from Audiobookshelf",
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
  "countdown-holder": {
    name: "Countdown Holder",
    icon: "ListOrdered",
    category: "time",
    defaultSize: { width: 4, height: 3 },
    minSize: { width: 2, height: 2 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      expandDirection: "fill",  // "expand-up" | "expand-down" | "fill"
    },
    moduleId: null,
  },
  "multi-clock": {
    name: "Multi-Timezone Clock",
    description: "Show clocks for multiple timezones side by side",
    icon: "Clock",
    category: "time",
    defaultSize: { width: 8, height: 2 },
    minSize: { width: 3, height: 1 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      timezones: [
        { label: "Pacific", timezone: "America/Los_Angeles" },
        { label: "Central", timezone: "America/Chicago" },
        { label: "Eastern", timezone: "America/New_York" },
      ],
      showSeconds: true,
      showDate: true,
      highlightLocal: true,
    },
    moduleId: null,
  },
  "notes": {
    name: "Notes / Checklist",
    description: "Notes, bullets, and checkbox items",
    icon: "StickyNote",
    category: "custom",
    defaultSize: { width: 4, height: 4 },
    minSize: { width: 2, height: 2 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      content: "",
      showCheckboxes: false,
      headerText: "Notes",
    },
    moduleId: null,
  },
  "stock-quote": {
    name: "Stock Quotes",
    description: "View live stock quotes and price changes",
    icon: "TrendingUp",
    category: "custom",
    defaultSize: { width: 4, height: 4 },
    minSize: { width: 2, height: 2 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      symbols: "AAPL,GOOGL,MSFT,AMZN,TSLA",
      layout: "list",
    },
    moduleId: null,
  },
  "atmospheric-map": {
    name: "Atmospheric Map",
    description: "Animated map of wind, temperature, or UV index",
    icon: "Map",
    category: "weather",
    defaultSize: { width: 6, height: 4 },
    minSize: { width: 3, height: 2 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      layer: "wind",
      latitude: 40,
      longitude: -105,
      zoom: 5,
    },
    moduleId: "weather",
  },
  "weather-alerts": {
    name: "Weather Alerts",
    description: "Active severe weather alerts for your area",
    icon: "AlertTriangle",
    category: "weather",
    defaultSize: { width: 4, height: 3 },
    minSize: { width: 2, height: 2 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {},
    moduleId: "weather",
  },
  "ocean-tides": {
    name: "Ocean Tides",
    description: "High and low tide times from nearest station",
    icon: "Waves",
    category: "weather",
    defaultSize: { width: 3, height: 4 },
    minSize: { width: 2, height: 2 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {},
    moduleId: "weather",
  },
  "air-quality": {
    name: "Air Quality",
    description: "Outdoor air quality index and pollutant levels",
    icon: "Wind",
    category: "weather",
    defaultSize: { width: 3, height: 3 },
    minSize: { width: 2, height: 2 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      showComponents: true,
    },
    moduleId: "weather",
  },
  "exchange-rate": {
    name: "Exchange Rates",
    description: "Currency and cryptocurrency exchange rates",
    icon: "ArrowRightLeft",
    category: "custom",
    defaultSize: { width: 3, height: 4 },
    minSize: { width: 2, height: 2 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      baseCurrency: "USD",
      targetCurrencies: "EUR,GBP,JPY,CAD,AUD,CHF,CNY",
    },
    moduleId: null,
  },
  chores: {
    name: "Chores",
    description: "Rotating chore assignments for the family",
    icon: "ClipboardList",
    category: "schedule",
    defaultSize: { width: 3, height: 3 },
    minSize: { width: 2, height: 2 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      maxItems: 6,
      showCompleted: false,
      showDueDate: true,
      showAssignee: true,
      groupBy: "none",
    },
    moduleId: null,
  },
  "sticky-notes": {
    name: "Sticky Notes",
    description: "Shared family sticky notes board",
    icon: "StickyNote",
    category: "custom",
    defaultSize: { width: 3, height: 3 },
    minSize: { width: 2, height: 2 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      maxNotes: 6,
      showAuthor: true,
      showTimestamp: false,
      defaultColor: "#FEF3C7",
      columns: 2,
    },
    moduleId: null,
  },
  "package-tracking": {
    name: "Packages",
    description: "Track incoming package deliveries",
    icon: "Package",
    category: "schedule",
    defaultSize: { width: 3, height: 3 },
    minSize: { width: 2, height: 2 },
    maxSize: { width: 99, height: 99 },
    defaultConfig: {
      maxItems: 5,
      showDelivered: false,
      showCarrierIcon: true,
      showETA: true,
      autoArchiveDays: 2,
      displayMode: "list",
    },
    moduleId: "packages",
  },
};

export const WIDGET_CATEGORIES = [
  { id: "time", name: "Time", icon: "Clock" },
  { id: "weather", name: "Weather", icon: "Cloud" },
  { id: "schedule", name: "Schedule", icon: "Calendar" },
  { id: "photos", name: "Photos & Backgrounds", icon: "Image" },
  { id: "media", name: "Media", icon: "Music" },
  { id: "homeassistant", name: "Home Assistant", icon: "Zap" },
  { id: "custom", name: "Custom", icon: "Shapes" },
] as const;

// Presets are pre-configured widget entries that appear in the Add Block modal
// They add a specific widget type with pre-set config overrides
export const WIDGET_PRESETS: WidgetPreset[] = [
  {
    id: "nature-landscape",
    name: "Nature & Landscape",
    description: "Beautiful nature and landscape photos",
    icon: "Mountain",
    category: "photos",
    widgetType: "photo-album",
    configOverrides: { source: "reddit", subreddit: "EarthPorn" },
  },
  {
    id: "city-urban",
    name: "City & Urban",
    description: "Urban photography and cityscapes",
    icon: "Building2",
    category: "photos",
    widgetType: "photo-album",
    configOverrides: { source: "reddit", subreddit: "CityPorn" },
  },
  {
    id: "space-astronomy",
    name: "Space & Astronomy",
    description: "Space, stars, and astronomy photos",
    icon: "Orbit",
    category: "photos",
    widgetType: "photo-album",
    configOverrides: { source: "reddit", subreddit: "SpacePorn" },
  },
  {
    id: "architecture",
    name: "Architecture",
    description: "Stunning buildings and architecture",
    icon: "Landmark",
    category: "photos",
    widgetType: "photo-album",
    configOverrides: { source: "reddit", subreddit: "ArchitecturePorn" },
  },
  {
    id: "cozy-places",
    name: "Cozy Places",
    description: "Warm, cozy interior spaces",
    icon: "Sofa",
    category: "photos",
    widgetType: "photo-album",
    configOverrides: { source: "reddit", subreddit: "CozyPlaces" },
  },
  {
    id: "sky-clouds",
    name: "Sky & Clouds",
    description: "Skies, sunsets, and cloud photography",
    icon: "CloudSun",
    category: "photos",
    widgetType: "photo-album",
    configOverrides: { source: "reddit", subreddit: "SkyPorn" },
  },
  {
    id: "water-ocean",
    name: "Water & Ocean",
    description: "Oceans, lakes, rivers, and waterfalls",
    icon: "Waves",
    category: "photos",
    widgetType: "photo-album",
    configOverrides: { source: "reddit", subreddit: "WaterPorn" },
  },
  {
    id: "botanical",
    name: "Plants & Flowers",
    description: "Botanical and plant photography",
    icon: "Flower2",
    category: "photos",
    widgetType: "photo-album",
    configOverrides: { source: "reddit", subreddit: "BotanicalPorn" },
  },
];

export function getWidgetsByCategory(category: string, isModuleEnabled?: (id: string) => boolean): BuilderWidgetType[] {
  return (Object.keys(WIDGET_REGISTRY) as BuilderWidgetType[]).filter(
    (type) => {
      const def = WIDGET_REGISTRY[type];
      if (def.deprecated) return false;
      if (def.category !== category) return false;
      if (isModuleEnabled && def.moduleId && !isModuleEnabled(def.moduleId)) return false;
      return true;
    }
  );
}

export function getWidgetDefinition(type: BuilderWidgetType): WidgetDefinition {
  return WIDGET_REGISTRY[type];
}
