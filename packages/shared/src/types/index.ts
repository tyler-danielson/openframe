// User types
export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: "admin" | "member" | "viewer";
  timezone: string;
  preferences: UserPreferences;
  linkedProviders?: string[];
  grantedScopes?: Record<string, string>;
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
export type CalendarProvider = "google" | "microsoft" | "caldav" | "ics" | "sports" | "homeassistant";

export interface CalendarVisibility {
  week: boolean;
  month: boolean;
  day: boolean;
  popup: boolean;
  screensaver: boolean;
}

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
  isFavorite: boolean;
  isReadOnly: boolean;
  syncEnabled: boolean;
  showOnDashboard: boolean;
  lastSyncAt: Date | null;
  visibility: CalendarVisibility;
  sourceUrl?: string | null; // URL for ICS subscriptions
  oauthTokenId?: string | null; // Links to the OAuth account this calendar came from
  accountLabel?: string | null; // Account name or email for display (e.g. "Work" or "user@company.com")
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
  isFavorite?: boolean;
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

export interface HomeAssistantRoom {
  id: string;
  userId: string;
  name: string;
  sortOrder: number;
  temperatureSensorId: string | null;
  humiditySensorId: string | null;
  windowSensorId: string | null;
  createdAt: Date;
}

export interface HomeAssistantEntity {
  id: string;
  userId: string;
  entityId: string;
  displayName: string | null;
  roomId: string | null;
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
  // Camera-specific fields
  refreshInterval?: number; // seconds (default 5)
  aspectRatio?: "16:9" | "4:3" | "1:1";
  // Duration alert settings
  durationAlert?: {
    enabled: boolean;
    thresholdMinutes: number;      // e.g., 30
    repeatIntervalMinutes?: number; // How often to re-alert (default: 15)
  };
  // Vacuum-specific settings
  vacuum?: {
    mapCameraEntityId?: string; // Override auto-detection for map camera
  };
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

// Automation types
export type AutomationTriggerType = "time" | "state" | "duration";
export type AutomationActionType = "service_call" | "notification";

export interface TimeTriggerConfig {
  time: string; // "07:00" or "sunset" or "sunrise"
  sunOffset?: number; // minutes offset for sunset/sunrise
  days?: number[]; // 0-6 (Sunday-Saturday), empty = every day
}

export interface StateTriggerConfig {
  entityId: string;
  fromState?: string;
  toState: string;
}

export interface DurationTriggerConfig {
  entityId: string;
  targetState: string;
  durationMinutes: number;
}

export type AutomationTriggerConfig =
  | TimeTriggerConfig
  | StateTriggerConfig
  | DurationTriggerConfig;

export interface ServiceCallActionConfig {
  domain: string;
  service: string;
  entityId: string;
  serviceData?: Record<string, unknown>;
}

export interface NotificationActionConfig {
  title: string;
  message: string;
}

export type AutomationActionConfig =
  | ServiceCallActionConfig
  | NotificationActionConfig;

export interface Automation {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  enabled: boolean;
  triggerType: AutomationTriggerType;
  triggerConfig: AutomationTriggerConfig;
  actionType: AutomationActionType;
  actionConfig: AutomationActionConfig;
  lastTriggeredAt: Date | null;
  triggerCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationParseResult {
  name: string;
  trigger: {
    type: AutomationTriggerType;
    config: AutomationTriggerConfig;
  };
  action: {
    type: AutomationActionType;
    config: AutomationActionConfig;
  };
  confidence: number;
}

export interface AutomationNotification {
  id: string;
  automationId: string;
  automationName: string;
  title: string;
  message: string;
  triggeredAt: string;
  dismissed: boolean;
}

// Assumptions - AI behavior rules
export interface Assumption {
  id: string;
  userId: string;
  text: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

// News types
export interface NewsFeed {
  id: string;
  userId: string;
  name: string;
  feedUrl: string;
  category: string | null;
  isActive: boolean;
  lastFetchedAt: Date | null;
  createdAt: Date;
  articleCount?: number;
}

export interface NewsArticle {
  id: string;
  feedId: string;
  guid: string;
  title: string;
  description: string | null;
  link: string;
  imageUrl: string | null;
  author: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  feedName?: string;
  feedCategory?: string | null;
}

export interface NewsHeadline {
  id: string;
  title: string;
  link: string;
  imageUrl: string | null;
  publishedAt: Date | null;
  feedName: string;
  feedCategory: string | null;
}

export interface PresetFeed {
  name: string;
  url: string;
  category: string;
}

// AI Briefing types
export interface DailyBriefing {
  summary: string;        // "Good morning! You have 3 meetings today..."
  highlights: string[];   // Bullet points
  generatedAt: string;
}

// Email types
export interface EmailHighlight {
  id: string;
  from: string;           // "John Smith" or "john@example.com"
  subject: string;
  snippet: string;        // Preview text
  receivedAt: string;
  isUnread: boolean;
}

// Sports types
export type SportsProvider = "espn";
export type GameStatus = "scheduled" | "in_progress" | "halftime" | "final" | "postponed" | "cancelled";

export interface SportsLeague {
  sport: string; // e.g., "football", "basketball", "hockey", "baseball"
  league: string; // e.g., "nfl", "nba", "nhl", "mlb"
  displayName: string; // e.g., "NFL", "NBA", "NHL", "MLB"
}

export interface SportsTeam {
  id: string;
  name: string;
  abbreviation: string;
  logo: string | null;
  color: string | null;
  sport: string;
  league: string;
}

export interface FavoriteSportsTeam {
  id: string;
  userId: string;
  provider: SportsProvider;
  sport: string;
  league: string;
  teamId: string;
  teamName: string;
  teamAbbreviation: string;
  teamLogo: string | null;
  teamColor: string | null;
  isVisible: boolean;
  showOnDashboard: boolean;
  visibility: CalendarVisibility;
  createdAt: Date;
}

export interface SportsGame {
  id: string;
  externalId: string;
  provider: SportsProvider;
  sport: string;
  league: string;
  homeTeam: {
    id: string;
    name: string;
    abbreviation: string;
    logo: string | null;
    color: string | null;
    score: number | null;
  };
  awayTeam: {
    id: string;
    name: string;
    abbreviation: string;
    logo: string | null;
    color: string | null;
    score: number | null;
  };
  startTime: Date;
  status: GameStatus;
  statusDetail: string | null;
  period: number | null;
  clock: string | null;
  venue: string | null;
  broadcast: string | null;
}

// Capacities types
export interface CapacitiesSpace {
  id: string;
  title: string;
  icon?: string | { name: string; color: string };
  isDefault?: boolean;
}

export interface CapacitiesSpaceInfo {
  id: string;
  title: string;
  structures: CapacitiesStructure[];
}

export interface CapacitiesStructure {
  id: string;
  pluralName: string;
  icon?: string;
}

export interface CapacitiesLookupResult {
  id: string;
  structureId: string;
  title: string;
}

export interface CapacitiesSavedObject {
  id: string;
  title: string;
  structureId: string;
}

export interface CapacitiesConfig {
  connected: boolean;
  defaultSpaceId: string | null;
  lastSyncAt: string | null;
  spaces: CapacitiesSpace[];
}

export interface CapacitiesSaveToDailyNoteInput {
  spaceId?: string;
  mdText: string;
  noTimeStamp?: boolean;
}

export interface CapacitiesSaveWeblinkInput {
  spaceId?: string;
  url: string;
  title?: string;
  mdText?: string;
  tags?: string[];
}

// Telegram types
export interface TelegramBotInfo {
  username: string;
  firstName: string;
}

export interface TelegramChat {
  id: string;
  chatId: string;
  chatType: "private" | "group" | "supergroup" | "channel";
  name: string;
  username: string | null;
  isActive: boolean;
  linkedAt: string;
  lastMessageAt: string | null;
}

export interface TelegramSettings {
  dailyAgendaEnabled: boolean;
  dailyAgendaTime: string;
  eventRemindersEnabled: boolean;
  eventReminderMinutes: number;
}

export interface TelegramConfig {
  connected: boolean;
  botUsername: string | null;
  settings: TelegramSettings;
  chats: TelegramChat[];
}

export interface TelegramWebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
}

// Settings Export/Import types
export interface ExportedSettings {
  version: "1.0";
  exportedAt: string; // ISO timestamp

  clientSettings: {
    calendar: Record<string, unknown> | null;
    screensaver: Record<string, unknown> | null;
    tasks: Record<string, unknown> | null;
    durationAlerts: Record<string, unknown> | null;
  };

  serverSettings: {
    systemSettings: Array<{ category: string; key: string; value: string | null }>;
    kiosks: Array<ExportedKiosk>;
    cameras: Array<ExportedCamera>;
    iptvServers: Array<ExportedIptvServer>;
    homeAssistant: {
      rooms: Array<ExportedHomeAssistantRoom>;
      entities: Array<ExportedHomeAssistantEntity>;
    };
    favoriteTeams: Array<ExportedFavoriteSportsTeam>;
    newsFeeds: Array<ExportedNewsFeed>;
  };
}

export interface ExportedKiosk {
  name: string;
  colorScheme: string;
  screensaverEnabled: boolean;
  screensaverTimeout: number;
  screensaverInterval: number;
  screensaverLayout: string;
  screensaverTransition: string;
  screensaverLayoutConfig: Record<string, unknown> | null;
}

export interface ExportedCamera {
  name: string;
  rtspUrl: string | null;
  mjpegUrl: string | null;
  snapshotUrl: string | null;
  username: string | null;
  isEnabled: boolean;
  sortOrder: number;
  settings: CameraSettings;
}

export interface ExportedIptvServer {
  name: string;
  serverUrl: string;
  isActive: boolean;
}

export interface ExportedHomeAssistantRoom {
  name: string;
  sortOrder: number;
  temperatureSensorId: string | null;
  humiditySensorId: string | null;
  windowSensorId: string | null;
}

export interface ExportedHomeAssistantEntity {
  entityId: string;
  displayName: string | null;
  sortOrder: number;
  showInDashboard: boolean;
  settings: HomeAssistantEntitySettings;
}

export interface ExportedFavoriteSportsTeam {
  sport: string;
  league: string;
  teamId: string;
  teamName: string;
  teamAbbreviation: string;
  teamLogo: string | null;
  teamColor: string | null;
  isVisible: boolean;
  showOnDashboard: boolean;
  visibility: CalendarVisibility;
}

export interface ExportedNewsFeed {
  name: string;
  feedUrl: string;
  category: string | null;
  isActive: boolean;
}

export interface ImportResult {
  success: boolean;
  imported: {
    systemSettings: number;
    kiosks: number;
    cameras: number;
    iptvServers: number;
    homeAssistantRooms: number;
    homeAssistantEntities: number;
    favoriteTeams: number;
    newsFeeds: number;
  };
  errors: string[];
}

// Recipe types
export interface RecipeIngredient {
  name: string;
  amount: string;  // "2", "1/2", etc.
  unit: string;    // "cups", "tbsp", etc.
}

export interface Recipe {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  servings: number | null;
  prepTime: number | null;      // minutes
  cookTime: number | null;      // minutes
  ingredients: RecipeIngredient[];
  instructions: string[];
  tags: string[];
  notes: string | null;
  sourceImagePath: string | null;
  thumbnailPath: string | null;
  isFavorite: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecipeUploadToken {
  token: string;
  expiresAt: Date;
}

// ============ Kitchen Timer Types ============

export interface KitchenTimerPreset {
  id: string;
  userId: string;
  name: string;
  durationSeconds: number;
  recipeId: string | null;
  createdAt: Date;
}

export interface KitchenActiveTimer {
  id: string;
  userId: string;
  presetId: string | null;
  name: string;
  durationSeconds: number;
  remainingSeconds: number;
  status: "running" | "paused" | "completed" | "cancelled";
  startedAt: Date;
  pausedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

// ============ Family Profile Types ============

export interface FamilyProfile {
  id: string;
  userId: string;
  name: string;
  icon: string | null;
  color: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlannerLayoutConfig {
  gridColumns: number;          // Default: 12
  gridRows: number;             // Default: 12
  pageSize: string;             // Device preset ID (e.g., "remarkable2", "kindle-scribe", "letter", "a4")
  orientation: "portrait" | "landscape";
  widgets: PlannerWidgetInstance[];
  backgroundColor?: string;

  // Layout mode - "grid" for backward compat, "columns" for new live editor
  layoutMode?: "grid" | "columns";

  // Column-based layout structure (used when layoutMode === "columns")
  columns?: ColumnLayout;
}

// Column-based layout types for the live editor
export interface ColumnLayout {
  sections: LayoutSection[];
}

export interface LayoutSection {
  id: string;
  direction: "horizontal" | "vertical";
  children: LayoutChild[];
}

export interface LayoutChild {
  id: string;
  type: "section" | "widget";
  flex: number;              // Flex ratio (default 1)
  widgetId?: string;         // When type === "widget"
  section?: LayoutSection;   // When type === "section" (nested)
}

export interface PlannerWidgetInstance {
  id: string;
  type: PlannerWidgetType;
  x: number;
  y: number;
  width: number;
  height: number;
  config: Record<string, unknown>;
}

export type PlannerWidgetType =
  | "calendar-day"      // Single day schedule
  | "calendar-week"     // Week view
  | "calendar-month"    // Month grid
  | "tasks"             // Task list
  | "news-headlines"    // News ticker/list
  | "weather"           // Weather forecast
  | "notes"             // Blank notes area with lines
  | "text"              // Static text/header
  | "divider"           // Visual separator
  | "habits"            // Habit tracker grid
  | "ai-briefing"       // AI-generated daily briefing
  | "email-highlights"; // Gmail email highlights

export interface ProfileCalendar {
  id: string;
  profileId: string;
  calendarId: string;
  isVisible: boolean;
}

export interface ProfileNewsFeed {
  id: string;
  profileId: string;
  newsFeedId: string;
  isVisible: boolean;
}

export interface ProfilePlannerConfig {
  id: string;
  profileId: string;
  layoutConfig: PlannerLayoutConfig;
  createdAt: Date;
  updatedAt: Date;
}

export type RemarkableScheduleType = "daily" | "weekly" | "monthly" | "manual";

export interface ProfileRemarkableSettings {
  id: string;
  profileId: string;
  enabled: boolean;
  folderPath: string;
  scheduleType: RemarkableScheduleType;
  pushTime: string;
  pushDay: number | null;
  timezone: string;
  lastPushAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============ YouTube Types ============

export type YouTubeBookmarkType = "video" | "live" | "playlist" | "channel";

export interface YouTubeBookmark {
  id: string;
  userId: string;
  youtubeId: string;
  type: YouTubeBookmarkType;
  title: string;
  thumbnailUrl: string | null;
  channelTitle: string | null;
  channelId: string | null;
  duration: string | null;
  isLive: boolean;
  createdAt: Date;
}

export interface YouTubeSearchResult {
  youtubeId: string;
  type: YouTubeBookmarkType;
  title: string;
  description: string;
  thumbnailUrl: string;
  channelTitle: string;
  channelId: string;
  publishedAt: string;
  isLive: boolean;
  duration?: string;
  viewCount?: string;
}

export interface YouTubeVideoDetails {
  youtubeId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  channelTitle: string;
  channelId: string;
  publishedAt: string;
  duration: string;
  viewCount: string;
  likeCount: string;
  isLive: boolean;
  tags: string[];
}

export interface YouTubeChannel {
  channelId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  subscriberCount: string;
  videoCount: string;
}

export interface YouTubeWatchHistoryEntry {
  id: string;
  userId: string;
  youtubeId: string;
  type: YouTubeBookmarkType;
  title: string;
  thumbnailUrl: string | null;
  channelTitle: string | null;
  watchedAt: Date;
}

// ============ AI Chat Types ============

export type AIChatProvider = "claude" | "openai" | "gemini";

export interface ChatConversation {
  id: string;
  userId: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastMessage?: string;
  messageCount?: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  provider: AIChatProvider | null;
  model: string | null;
  tokenUsage: ChatTokenUsage | null;
  createdAt: Date;
}

export interface ChatTokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface ChatSendRequest {
  message: string;
  conversationId?: string;
  provider?: AIChatProvider;
  model?: string;
}

export interface ChatStreamEvent {
  type: "conversation_created" | "token" | "done" | "error";
  conversationId?: string;
  token?: string;
  messageId?: string;
  error?: string;
}

export interface ChatProviderStatus {
  claude: boolean;
  openai: boolean;
  gemini: boolean;
  defaultProvider: AIChatProvider;
}

export interface PlannerTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
  config: PlannerLayoutConfig;
}

// ============ Plex Types ============

export interface PlexServer {
  id: string;
  userId: string;
  name: string;
  serverUrl: string;
  machineId: string | null;
  isActive: boolean;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlexLibrary {
  key: string;
  title: string;
  type: string; // "movie" | "show" | "artist" | "photo"
  thumb?: string;
  count?: number;
}

export interface PlexItem {
  ratingKey: string;
  title: string;
  type: string;
  year?: number;
  thumb?: string;
  art?: string;
  duration?: number;
  summary?: string;
  grandparentTitle?: string;
  parentTitle?: string;
}

// ============ Audiobookshelf Types ============

export interface AudiobookshelfServer {
  id: string;
  userId: string;
  name: string;
  serverUrl: string;
  isActive: boolean;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AudiobookshelfLibrary {
  id: string;
  name: string;
  mediaType: string; // "book" | "podcast"
  folders: string[];
}

export interface AudiobookshelfItem {
  id: string;
  title: string;
  authorName?: string;
  duration?: number;
  coverUrl?: string;
  description?: string;
  progress?: number;
}

// ============ Routine/Habit Tracker Types ============

export type RoutineFrequency = "daily" | "weekly" | "custom";

export interface Routine {
  id: string;
  userId: string;
  title: string;
  icon: string | null;
  category: string | null;
  frequency: RoutineFrequency;
  daysOfWeek: number[] | null;
  assignedProfileId: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoutineCompletion {
  id: string;
  routineId: string;
  completedDate: string;
  completedByProfileId: string | null;
  completedAt: Date;
}

export interface RoutineWithCompletions extends Routine {
  completions: RoutineCompletion[];
  isCompletedToday?: boolean;
}

// ============ Support Ticket Types ============

// ============ Matter Types ============

export type MatterDeviceType =
  | "onOffLight"
  | "dimmableLight"
  | "colorTemperatureLight"
  | "thermostat"
  | "doorLock"
  | "contactSensor"
  | "occupancySensor"
  | "temperatureSensor"
  | "humiditySensor"
  | "onOffSwitch"
  | "windowCovering"
  | "fan"
  | "unknown";

export interface MatterDevice {
  id: string;
  userId: string;
  nodeId: string;
  vendorName: string | null;
  productName: string | null;
  deviceType: MatterDeviceType;
  displayName: string;
  roomId: string | null;
  sortOrder: number;
  isReachable: boolean;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MatterDeviceAttributes {
  onOff?: boolean;
  currentLevel?: number;
  colorTemperatureMireds?: number;
  localTemperature?: number;
  occupiedHeatingSetpoint?: number;
  occupiedCoolingSetpoint?: number;
  systemMode?: number;
  lockState?: number;
  contactState?: boolean;
  occupancy?: boolean;
  measuredTemperature?: number;
  measuredHumidity?: number;
  currentPosition?: number;
  fanMode?: number;
  fanSpeed?: number;
}

export interface MatterDeviceState {
  nodeId: string;
  deviceType: MatterDeviceType;
  isReachable: boolean;
  attributes: MatterDeviceAttributes;
}

export interface MatterCommissionRequest {
  pairingCode: string;
  displayName?: string;
}

export interface MatterCommandRequest {
  clusterId: string;
  commandId: string;
  payload?: Record<string, unknown>;
}

// ============ Support Ticket Types ============

export type TicketStatus = "open" | "in_progress" | "waiting_on_user" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type TicketCategory = "billing" | "bug" | "feature_request" | "account" | "general";
