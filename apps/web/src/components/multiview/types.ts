// Type definitions for Multi-View Dashboard

export type ViewType = "camera" | "map" | "media" | "calendar" | "image" | "weather";

export interface MultiViewItem {
  id: string;
  type: ViewType;
  name: string;
  config: MultiViewItemConfig;
}

export interface MultiViewItemConfig {
  // For cameras
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

  // For map, media, weather - no additional config needed
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
export const VIEW_TYPE_TABS: { type: ViewType; label: string }[] = [
  { type: "camera", label: "Cameras" },
  { type: "map", label: "Maps" },
  { type: "media", label: "Media" },
  { type: "calendar", label: "Calendar" },
  { type: "image", label: "Images" },
  { type: "weather", label: "Weather" },
];
