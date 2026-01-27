import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  integer,
  jsonb,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const oauthProviderEnum = pgEnum("oauth_provider", [
  "google",
  "microsoft",
]);

export const calendarProviderEnum = pgEnum("calendar_provider", [
  "google",
  "microsoft",
  "caldav",
]);

export const eventStatusEnum = pgEnum("event_status", [
  "confirmed",
  "tentative",
  "cancelled",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "needsAction",
  "completed",
]);

// Users table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  timezone: text("timezone").default("UTC").notNull(),
  preferences: jsonb("preferences").$type<UserPreferences>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export interface UserPreferences {
  defaultCalendarView?: "month" | "week" | "day" | "agenda";
  weekStartsOn?: 0 | 1 | 6; // Sunday, Monday, Saturday
  showWeekNumbers?: boolean;
  theme?: "light" | "dark" | "auto";
}

// OAuth tokens (encrypted at rest)
export const oauthTokens = pgTable(
  "oauth_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: oauthProviderEnum("provider").notNull(),
    accessToken: text("access_token").notNull(), // encrypted
    refreshToken: text("refresh_token"), // encrypted
    tokenType: text("token_type").default("Bearer"),
    scope: text("scope"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("oauth_tokens_user_provider_idx").on(table.userId, table.provider),
  ]
);

// API keys for automation
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull(), // hashed, prefix stored for identification
    keyPrefix: text("key_prefix").notNull(), // e.g., "openframe_abc123"
    scopes: text("scopes").array().default([]).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("api_keys_key_prefix_idx").on(table.keyPrefix)]
);

// Refresh tokens for session management
export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    familyId: uuid("family_id").notNull(), // for rotation detection
    deviceInfo: text("device_info"),
    ipAddress: text("ip_address"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("refresh_tokens_user_idx").on(table.userId),
    index("refresh_tokens_family_idx").on(table.familyId),
  ]
);

// Calendars
export const calendars = pgTable(
  "calendars",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: calendarProviderEnum("provider").notNull(),
    externalId: text("external_id").notNull(), // provider's calendar ID
    name: text("name").notNull(),
    description: text("description"),
    color: text("color").default("#3B82F6"),
    icon: text("icon"), // emoji or icon identifier for the calendar
    isVisible: boolean("is_visible").default(true).notNull(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    isReadOnly: boolean("is_read_only").default(false).notNull(),
    syncEnabled: boolean("sync_enabled").default(true).notNull(),
    syncToken: text("sync_token"), // for incremental sync
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("calendars_user_idx").on(table.userId),
    index("calendars_external_idx").on(table.provider, table.externalId),
  ]
);

// Calendar events
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    calendarId: uuid("calendar_id")
      .notNull()
      .references(() => calendars.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(), // provider's event ID
    title: text("title").notNull(),
    description: text("description"),
    location: text("location"),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }).notNull(),
    isAllDay: boolean("is_all_day").default(false).notNull(),
    status: eventStatusEnum("status").default("confirmed").notNull(),
    recurrenceRule: text("recurrence_rule"), // RRULE string
    recurringEventId: text("recurring_event_id"), // parent event for instances
    originalStartTime: timestamp("original_start_time", { withTimezone: true }), // for recurring instances
    attendees: jsonb("attendees").$type<EventAttendee[]>().default([]),
    reminders: jsonb("reminders").$type<EventReminder[]>().default([]),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    etag: text("etag"), // for conflict detection
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("events_calendar_idx").on(table.calendarId),
    index("events_time_idx").on(table.startTime, table.endTime),
    index("events_external_idx").on(table.calendarId, table.externalId),
  ]
);

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

// Task lists
export const taskLists = pgTable(
  "task_lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: oauthProviderEnum("provider").notNull(),
    externalId: text("external_id").notNull(),
    name: text("name").notNull(),
    isVisible: boolean("is_visible").default(true).notNull(),
    syncToken: text("sync_token"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("task_lists_user_idx").on(table.userId)]
);

// Tasks
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskListId: uuid("task_list_id")
      .notNull()
      .references(() => taskLists.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    notes: text("notes"),
    status: taskStatusEnum("status").default("needsAction").notNull(),
    dueDate: timestamp("due_date", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    parentTaskId: uuid("parent_task_id"),
    position: text("position"), // for ordering
    etag: text("etag"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("tasks_list_idx").on(table.taskListId),
    index("tasks_due_idx").on(table.dueDate),
  ]
);

// Photo albums
export const photoAlbums = pgTable(
  "photo_albums",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    coverPhotoId: uuid("cover_photo_id"),
    isActive: boolean("is_active").default(true).notNull(),
    slideshowInterval: integer("slideshow_interval").default(30), // seconds
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("photo_albums_user_idx").on(table.userId)]
);

// Photo source enum
export const photoSourceEnum = pgEnum("photo_source", [
  "local",
  "google",
  "facebook",
]);

// Photos
export const photos = pgTable(
  "photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    albumId: uuid("album_id")
      .notNull()
      .references(() => photoAlbums.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    width: integer("width"),
    height: integer("height"),
    size: integer("size").notNull(), // bytes
    thumbnailPath: text("thumbnail_path"),
    mediumPath: text("medium_path"),
    originalPath: text("original_path").notNull(),
    takenAt: timestamp("taken_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<PhotoMetadata>().default({}),
    sortOrder: integer("sort_order").default(0).notNull(),
    sourceType: photoSourceEnum("source_type"), // 'local' | 'google' | 'facebook' | null
    externalId: text("external_id"), // Original ID from source (for deduplication)
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("photos_album_idx").on(table.albumId),
    index("photos_sort_idx").on(table.albumId, table.sortOrder),
    index("photos_external_idx").on(table.sourceType, table.externalId),
  ]
);

export interface PhotoMetadata {
  camera?: string;
  lens?: string;
  iso?: number;
  focalLength?: string;
  aperture?: string;
  shutterSpeed?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
}

// Screensaver layout enum
export const screensaverLayoutEnum = pgEnum("screensaver_layout", [
  "fullscreen",
  "side-by-side",
  "quad",
  "scatter",
]);

// Screensaver transition enum
export const screensaverTransitionEnum = pgEnum("screensaver_transition", [
  "fade",
  "slide-left",
  "slide-right",
  "slide-up",
  "slide-down",
  "zoom",
]);

// Kiosk configuration
export const kioskConfig = pgTable("kiosk_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").default(false).notNull(),
  // Screensaver settings
  screensaverEnabled: boolean("screensaver_enabled").default(true).notNull(),
  screensaverTimeout: integer("screensaver_timeout").default(300).notNull(), // seconds
  screensaverInterval: integer("screensaver_interval").default(15).notNull(), // seconds between slides
  screensaverLayout: screensaverLayoutEnum("screensaver_layout").default("fullscreen").notNull(),
  screensaverTransition: screensaverTransitionEnum("screensaver_transition").default("fade").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Display configurations
export const displayConfigs = pgTable("display_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(false).notNull(),
  layout: jsonb("layout").$type<DisplayLayout>().notNull(),
  screenSettings: jsonb("screen_settings")
    .$type<ScreenSettings>()
    .default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export interface DisplayLayout {
  type: "calendar-photos" | "full-calendar" | "dashboard";
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
  sleepStartTime?: string; // HH:mm
  sleepEndTime?: string;
  orientation?: "landscape" | "portrait";
}

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  oauthTokens: many(oauthTokens),
  apiKeys: many(apiKeys),
  refreshTokens: many(refreshTokens),
  calendars: many(calendars),
  taskLists: many(taskLists),
  photoAlbums: many(photoAlbums),
  displayConfigs: many(displayConfigs),
  kioskConfig: one(kioskConfig),
}));

export const oauthTokensRelations = relations(oauthTokens, ({ one }) => ({
  user: one(users, {
    fields: [oauthTokens.userId],
    references: [users.id],
  }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const calendarsRelations = relations(calendars, ({ one, many }) => ({
  user: one(users, {
    fields: [calendars.userId],
    references: [users.id],
  }),
  events: many(events),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  calendar: one(calendars, {
    fields: [events.calendarId],
    references: [calendars.id],
  }),
}));

export const taskListsRelations = relations(taskLists, ({ one, many }) => ({
  user: one(users, {
    fields: [taskLists.userId],
    references: [users.id],
  }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  taskList: one(taskLists, {
    fields: [tasks.taskListId],
    references: [taskLists.id],
  }),
}));

export const photoAlbumsRelations = relations(photoAlbums, ({ one, many }) => ({
  user: one(users, {
    fields: [photoAlbums.userId],
    references: [users.id],
  }),
  photos: many(photos),
}));

export const photosRelations = relations(photos, ({ one }) => ({
  album: one(photoAlbums, {
    fields: [photos.albumId],
    references: [photoAlbums.id],
  }),
}));

export const displayConfigsRelations = relations(displayConfigs, ({ one }) => ({
  user: one(users, {
    fields: [displayConfigs.userId],
    references: [users.id],
  }),
}));

export const kioskConfigRelations = relations(kioskConfig, ({ one }) => ({
  user: one(users, {
    fields: [kioskConfig.userId],
    references: [users.id],
  }),
}));

// IPTV Servers - stores Xtreme Codes credentials
export const iptvServers = pgTable(
  "iptv_servers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    serverUrl: text("server_url").notNull(),
    username: text("username").notNull(),
    password: text("password").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("iptv_servers_user_idx").on(table.userId)]
);

// IPTV Categories
export const iptvCategories = pgTable(
  "iptv_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serverId: uuid("server_id")
      .notNull()
      .references(() => iptvServers.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("iptv_categories_server_idx").on(table.serverId),
    index("iptv_categories_external_idx").on(table.serverId, table.externalId),
  ]
);

// IPTV Channels
export const iptvChannels = pgTable(
  "iptv_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serverId: uuid("server_id")
      .notNull()
      .references(() => iptvServers.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => iptvCategories.id, {
      onDelete: "set null",
    }),
    externalId: text("external_id").notNull(),
    name: text("name").notNull(),
    streamUrl: text("stream_url").notNull(),
    logoUrl: text("logo_url"),
    epgChannelId: text("epg_channel_id"),
    streamIcon: text("stream_icon"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("iptv_channels_server_idx").on(table.serverId),
    index("iptv_channels_category_idx").on(table.categoryId),
    index("iptv_channels_external_idx").on(table.serverId, table.externalId),
  ]
);

// IPTV Favorites
export const iptvFavorites = pgTable(
  "iptv_favorites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => iptvChannels.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("iptv_favorites_user_idx").on(table.userId),
    index("iptv_favorites_channel_idx").on(table.channelId),
  ]
);

// IPTV Watch History
export const iptvWatchHistory = pgTable(
  "iptv_watch_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => iptvChannels.id, { onDelete: "cascade" }),
    watchedAt: timestamp("watched_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("iptv_watch_history_user_idx").on(table.userId),
    index("iptv_watch_history_watched_idx").on(table.watchedAt),
  ]
);

// IPTV EPG (Electronic Program Guide)
export const iptvEpg = pgTable(
  "iptv_epg",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => iptvChannels.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("iptv_epg_channel_idx").on(table.channelId),
    index("iptv_epg_time_idx").on(table.startTime, table.endTime),
  ]
);

// IPTV Relations
export const iptvServersRelations = relations(iptvServers, ({ one, many }) => ({
  user: one(users, {
    fields: [iptvServers.userId],
    references: [users.id],
  }),
  categories: many(iptvCategories),
  channels: many(iptvChannels),
}));

export const iptvCategoriesRelations = relations(
  iptvCategories,
  ({ one, many }) => ({
    server: one(iptvServers, {
      fields: [iptvCategories.serverId],
      references: [iptvServers.id],
    }),
    channels: many(iptvChannels),
  })
);

export const iptvChannelsRelations = relations(
  iptvChannels,
  ({ one, many }) => ({
    server: one(iptvServers, {
      fields: [iptvChannels.serverId],
      references: [iptvServers.id],
    }),
    category: one(iptvCategories, {
      fields: [iptvChannels.categoryId],
      references: [iptvCategories.id],
    }),
    favorites: many(iptvFavorites),
    watchHistory: many(iptvWatchHistory),
    epg: many(iptvEpg),
  })
);

export const iptvFavoritesRelations = relations(iptvFavorites, ({ one }) => ({
  user: one(users, {
    fields: [iptvFavorites.userId],
    references: [users.id],
  }),
  channel: one(iptvChannels, {
    fields: [iptvFavorites.channelId],
    references: [iptvChannels.id],
  }),
}));

export const iptvWatchHistoryRelations = relations(
  iptvWatchHistory,
  ({ one }) => ({
    user: one(users, {
      fields: [iptvWatchHistory.userId],
      references: [users.id],
    }),
    channel: one(iptvChannels, {
      fields: [iptvWatchHistory.channelId],
      references: [iptvChannels.id],
    }),
  })
);

export const iptvEpgRelations = relations(iptvEpg, ({ one }) => ({
  channel: one(iptvChannels, {
    fields: [iptvEpg.channelId],
    references: [iptvChannels.id],
  }),
}));

// Cameras
export const cameras = pgTable(
  "cameras",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    rtspUrl: text("rtsp_url"), // RTSP stream URL (requires proxy for browser)
    mjpegUrl: text("mjpeg_url"), // MJPEG stream URL (direct browser playback)
    snapshotUrl: text("snapshot_url"), // Static image URL for snapshots
    username: text("username"), // Camera auth username
    password: text("password"), // Camera auth password
    isEnabled: boolean("is_enabled").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    settings: jsonb("settings").$type<CameraSettings>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("cameras_user_idx").on(table.userId)]
);

export interface CameraSettings {
  refreshInterval?: number; // Snapshot refresh interval in seconds
  aspectRatio?: "16:9" | "4:3" | "1:1";
  showInDashboard?: boolean;
}

export const camerasRelations = relations(cameras, ({ one }) => ({
  user: one(users, {
    fields: [cameras.userId],
    references: [users.id],
  }),
}));

// Home Assistant configuration
export const homeAssistantConfig = pgTable("home_assistant_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  url: text("url").notNull(), // Home Assistant URL (e.g., http://homeassistant.local:8123)
  accessToken: text("access_token").notNull(), // Long-lived access token
  isConnected: boolean("is_connected").default(false).notNull(),
  lastConnectedAt: timestamp("last_connected_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Home Assistant selected entities
export const homeAssistantEntities = pgTable(
  "home_assistant_entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    entityId: text("entity_id").notNull(), // e.g., "light.living_room"
    displayName: text("display_name"), // Custom name override
    sortOrder: integer("sort_order").default(0).notNull(),
    showInDashboard: boolean("show_in_dashboard").default(false).notNull(),
    settings: jsonb("settings").$type<HomeAssistantEntitySettings>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("ha_entities_user_idx").on(table.userId),
    index("ha_entities_entity_idx").on(table.userId, table.entityId),
  ]
);

export interface HomeAssistantEntitySettings {
  showIcon?: boolean;
  customIcon?: string;
  groupId?: string;
}

export const homeAssistantConfigRelations = relations(
  homeAssistantConfig,
  ({ one }) => ({
    user: one(users, {
      fields: [homeAssistantConfig.userId],
      references: [users.id],
    }),
  })
);

export const homeAssistantEntitiesRelations = relations(
  homeAssistantEntities,
  ({ one }) => ({
    user: one(users, {
      fields: [homeAssistantEntities.userId],
      references: [users.id],
    }),
  })
);

// Type exports for use in services
export type OAuthToken = typeof oauthTokens.$inferSelect;
