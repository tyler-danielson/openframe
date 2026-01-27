// User types
export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  timezone: string;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  defaultCalendarView?: "month" | "week" | "day" | "agenda";
  weekStartsOn?: 0 | 1 | 6;
  showWeekNumbers?: boolean;
  theme?: "light" | "dark" | "auto";
}

// Auth types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface ApiKeyInfo {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export type OAuthProvider = "google" | "microsoft";

// Calendar types
export type CalendarProvider = "google" | "microsoft" | "caldav";

export interface Calendar {
  id: string;
  provider: CalendarProvider;
  externalId: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  isVisible: boolean;
  isPrimary: boolean;
  isReadOnly: boolean;
  syncEnabled: boolean;
  lastSyncAt: Date | null;
}

export interface CalendarEvent {
  id: string;
  calendarId: string;
  externalId: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  status: "confirmed" | "tentative" | "cancelled";
  recurrenceRule: string | null;
  recurringEventId: string | null;
  attendees: EventAttendee[];
  reminders: EventReminder[];
}

export interface EventAttendee {
  email: string;
  name?: string;
  responseStatus?: "needsAction" | "accepted" | "declined" | "tentative";
  organizer?: boolean;
}

export interface EventReminder {
  method: "email" | "popup";
  minutes: number;
}

// Task types
export interface TaskList {
  id: string;
  name: string;
  isVisible: boolean;
}

export interface Task {
  id: string;
  taskListId: string;
  title: string;
  notes: string | null;
  status: "needsAction" | "completed";
  dueDate: Date | null;
  completedAt: Date | null;
}

// Photo types
export type PhotoSource = "local" | "google" | "facebook";

export interface PhotoAlbum {
  id: string;
  name: string;
  description: string | null;
  coverPhotoId: string | null;
  isActive: boolean;
  slideshowInterval: number;
  photoCount?: number;
}

export interface Photo {
  id: string;
  albumId: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  size: number;
  thumbnailUrl: string | null;
  mediumUrl: string | null;
  originalUrl: string;
  takenAt: Date | null;
  sourceType?: PhotoSource | null;
  externalId?: string | null;
}

// Display config types
export type LayoutType = "calendar-photos" | "full-calendar" | "dashboard";

export interface DisplayLayout {
  type: LayoutType;
  calendarPosition?: "left" | "right" | "center";
  photoPosition?: "left" | "right";
  showClock?: boolean;
  showWeather?: boolean;
  showTasks?: boolean;
  widgets?: WidgetConfig[];
}

export interface WidgetConfig {
  type: "clock" | "weather" | "tasks" | "ha-entity" | "custom";
  position: { x: number; y: number; w: number; h: number };
  config: Record<string, unknown>;
}

export interface ScreenSettings {
  brightness?: number;
  autoSleep?: boolean;
  sleepStartTime?: string;
  sleepEndTime?: string;
  orientation?: "landscape" | "portrait";
}

export interface DisplayConfig {
  id: string;
  name: string;
  isActive: boolean;
  layout: DisplayLayout;
  screenSettings: ScreenSettings;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Bot types
export interface BotEventSummary {
  date: string;
  events: Array<{
    title: string;
    time: string;
    calendar: string;
    location?: string;
  }>;
}

export interface QuickEventInput {
  text: string;
  calendarId?: string;
}

// IPTV types
export interface IptvServer {
  id: string;
  userId: string;
  name: string;
  serverUrl: string;
  username: string;
  isActive: boolean;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  categoryCount?: number;
  channelCount?: number;
}

export interface IptvCategory {
  id: string;
  serverId: string;
  externalId: string;
  name: string;
  channelCount?: number;
}

export interface IptvChannel {
  id: string;
  serverId: string;
  categoryId: string | null;
  externalId: string;
  name: string;
  streamUrl: string;
  logoUrl: string | null;
  epgChannelId: string | null;
  streamIcon: string | null;
  isFavorite?: boolean;
  categoryName?: string;
}

export interface IptvEpgEntry {
  id: string;
  channelId: string;
  title: string;
  description: string | null;
  startTime: Date;
  endTime: Date;
}

export interface IptvWatchHistoryEntry {
  id: string;
  channelId: string;
  watchedAt: Date;
  channel?: IptvChannel;
}

// Camera types
export interface Camera {
  id: string;
  userId: string;
  name: string;
  rtspUrl: string | null;
  mjpegUrl: string | null;
  snapshotUrl: string | null;
  username: string | null;
  password: string | null;
  isEnabled: boolean;
  sortOrder: number;
  settings: CameraSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface CameraSettings {
  refreshInterval?: number;
  aspectRatio?: "16:9" | "4:3" | "1:1";
  showInDashboard?: boolean;
}

// Home Assistant types
export interface HomeAssistantConfig {
  id: string;
  userId: string;
  url: string;
  isConnected: boolean;
  lastConnectedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface HomeAssistantEntity {
  id: string;
  userId: string;
  entityId: string;
  displayName: string | null;
  sortOrder: number;
  showInDashboard: boolean;
  settings: HomeAssistantEntitySettings;
  createdAt: Date;
  // Runtime state (populated from HA API)
  state?: HomeAssistantEntityState;
}

export interface HomeAssistantEntitySettings {
  showIcon?: boolean;
  customIcon?: string;
  groupId?: string;
}

export interface HomeAssistantEntityState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

export type HomeAssistantDomain =
  | "light"
  | "switch"
  | "sensor"
  | "binary_sensor"
  | "climate"
  | "cover"
  | "fan"
  | "media_player"
  | "lock"
  | "scene"
  | "script"
  | "automation"
  | "input_boolean"
  | "input_number"
  | "input_select"
  | "vacuum"
  | "camera";
