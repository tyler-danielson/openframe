// Type definitions for Multi-View Dashboard

export type ViewType =
  | "camera"
  | "map"
  | "media"
  | "calendar"
  | "image"
  | "weather"
  | "iptv"
  | "youtube"
  // Home Assistant widgets
  | "ha-entity"
  | "ha-gauge"
  | "ha-graph"
  | "ha-camera"
  // Schedule & info widgets
  | "clock"
  | "forecast"
  | "up-next"
  | "tasks"
  | "sports"
  | "news"
  | "day-schedule"
  | "week-schedule"
  | "countdown"
  | "text"
  | "photo-feed";

export interface MultiViewItem {
  id: string;
  type: ViewType;
  name: string;
  config: MultiViewItemConfig;
}

export interface MultiViewItemConfig {
  // For cameras (standalone + HA camera via CameraViewer)
  entityId?: string; // HA camera entity ID
  cameraId?: string; // Standalone camera ID
  cameraType?: "standalone" | "ha";

  // For photo albums/images
  albumId?: string;
  source?: "album" | "reddit" | "custom-url";
  subreddit?: string;
  customUrl?: string;

  // For calendar
  calendarIds?: string[];

  // For IPTV
  channelId?: string;

  // For HA widgets (entity, gauge, graph, ha-camera)
  // entityId already declared above
  refreshInterval?: number;
  min?: number;
  max?: number;
  unit?: string;
  warningValue?: number;
  criticalValue?: number;
  hours?: number; // graph time range
  lineColor?: string;

  // For countdown
  targetDate?: string;
  label?: string;

  // For text
  text?: string;

  // For photo-feed
  // albumId already declared above
  // source already declared above

  // Generic — passes through to widget as Record<string, unknown>
  [key: string]: unknown;
}

export interface AvailableItem {
  id: string;
  type: ViewType;
  name: string;
  config: MultiViewItemConfig;
  icon?: string;
  description?: string;
}

// Storage key for persisting selections
export const MULTIVIEW_STORAGE_KEY = "multiview-selection";

// Tab configuration
export const VIEW_TYPE_TABS: { type: ViewType | "home-assistant" | "schedule"; label: string; isGroup?: boolean }[] = [
  { type: "camera", label: "Cameras" },
  { type: "home-assistant", label: "Home Assistant", isGroup: true },
  { type: "media", label: "Media" },
  { type: "calendar", label: "Calendar" },
  { type: "schedule", label: "Schedule", isGroup: true },
  { type: "image", label: "Images" },
  { type: "weather", label: "Weather" },
];

// Tab type that includes group tabs
export type TabType = ViewType | "home-assistant" | "schedule";
