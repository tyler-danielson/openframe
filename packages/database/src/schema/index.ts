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
  date,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import type {
  PlannerLayoutConfig,
  PlannerWidgetInstance,
  PlannerWidgetType,
} from "@openframe/shared";

// Re-export shared types for convenience
export type { PlannerLayoutConfig, PlannerWidgetInstance, PlannerWidgetType };

// Enums
export const userRoleEnum = pgEnum("user_role", ["admin", "member", "viewer"]);

export const oauthProviderEnum = pgEnum("oauth_provider", [
  "google",
  "microsoft",
  "spotify",
]);

export const sportsProviderEnum = pgEnum("sports_provider", ["espn"]);

export const gameStatusEnum = pgEnum("game_status", [
  "scheduled",
  "in_progress",
  "halftime",
  "final",
  "postponed",
  "cancelled",
]);

export const calendarProviderEnum = pgEnum("calendar_provider", [
  "google",
  "microsoft",
  "caldav",
  "ics",
  "sports",
  "homeassistant",
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
  passwordHash: text("password_hash"),
  role: userRoleEnum("role").notNull().default("member"),
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

// Plan limits for hosted/cloud mode (synced from cloud platform during provisioning)
export interface PlanLimits {
  maxKiosks: number;
  maxCalendars: number;
  maxCameras: number;
  features: {
    iptv: boolean;
    spotify: boolean;
    ai: boolean;
    homeAssistant: boolean;
    automations: boolean;
    companion: boolean;
  };
}

export const userPlans = pgTable("user_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  planId: text("plan_id").notNull().default("free"),
  planName: text("plan_name").notNull().default("Free"),
  limits: jsonb("limits").$type<PlanLimits>().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

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
    // Multi-account support fields
    accountName: text("account_name"), // User-provided name like "Dad's Spotify"
    externalAccountId: text("external_account_id"), // Provider's user ID (e.g., Spotify user ID)
    isPrimary: boolean("is_primary").default(false).notNull(), // Default account for this provider
    icon: text("icon"), // Emoji icon for the account (e.g., "👨", "👩", "🎸")
    // Spotify device preferences
    defaultDeviceId: text("default_device_id"), // ID of the default playback device
    favoriteDeviceIds: text("favorite_device_ids").array(), // Array of favorite device IDs
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("oauth_tokens_user_provider_idx").on(table.userId, table.provider),
    index("oauth_tokens_external_account_idx").on(table.userId, table.provider, table.externalAccountId),
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

// Companion access - links companion users to owner with granular permissions
export const companionAccess = pgTable(
  "companion_access",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label"), // Display name for the owner to identify this user

    // Feature access: "none" | "view" | "edit"
    accessCalendar: text("access_calendar").notNull().default("view"),
    accessTasks: text("access_tasks").notNull().default("view"),

    // Feature access: boolean (view-only features)
    accessKiosks: boolean("access_kiosks").notNull().default(false),
    accessPhotos: boolean("access_photos").notNull().default(false),
    accessIptv: boolean("access_iptv").notNull().default(false),
    accessHomeAssistant: boolean("access_home_assistant").notNull().default(false),
    accessNews: boolean("access_news").notNull().default(true),
    accessWeather: boolean("access_weather").notNull().default(true),
    accessRecipes: boolean("access_recipes").notNull().default(true),

    // Scoped access (null = all)
    allowedCalendarIds: jsonb("allowed_calendar_ids").$type<string[] | null>().default(null),
    allowedTaskListIds: jsonb("allowed_task_list_ids").$type<string[] | null>().default(null),

    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("companion_access_owner_idx").on(table.ownerId),
    index("companion_access_user_idx").on(table.userId),
  ]
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
    oauthTokenId: uuid("oauth_token_id").references(() => oauthTokens.id, { onDelete: "set null" }),
    icon: text("icon"), // emoji or icon identifier for the calendar
    isVisible: boolean("is_visible").default(true).notNull(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    isFavorite: boolean("is_favorite").default(false).notNull(),
    isReadOnly: boolean("is_read_only").default(false).notNull(),
    syncEnabled: boolean("sync_enabled").default(true).notNull(),
    showOnDashboard: boolean("show_on_dashboard").default(true).notNull(),
    visibility: jsonb("visibility").$type<{ week: boolean; month: boolean; day: boolean; popup: boolean; screensaver: boolean }>().default({ week: false, month: false, day: false, popup: true, screensaver: false }).notNull(),
    syncToken: text("sync_token"), // for incremental sync
    sourceUrl: text("source_url"), // for ICS subscriptions - the URL to fetch from
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
    uniqueIndex("calendars_user_provider_external_idx").on(table.userId, table.provider, table.externalId),
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

// Color scheme enum
export const colorSchemeEnum = pgEnum("color_scheme", [
  "default",
  "homio",
  "ocean",
  "forest",
  "sunset",
  "lavender",
]);

// Screensaver layout enum
export const screensaverLayoutEnum = pgEnum("screensaver_layout", [
  "fullscreen",
  "informational",
  "quad",
  "scatter",
  "builder",
  "skylight",
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

// Kiosk display type enum (device interaction model)
export const kioskDisplayTypeEnum = pgEnum("kiosk_display_type", [
  "touch",    // Touch Screen (default)
  "tv",       // Samsung TV / remote-controlled
  "display",  // Display Only (no interaction)
]);

export type KioskDisplayType = "touch" | "tv" | "display";

// Kiosk display mode enum
export const kioskDisplayModeEnum = pgEnum("kiosk_display_mode", [
  "full",              // Full app with navigation
  "screensaver-only",  // Only screensaver, no app UI
  "calendar-only",     // Only calendar page
  "dashboard-only",    // Only dashboard page
]);

// Kiosk enabled features type
export interface KioskEnabledFeatures {
  calendar?: boolean;
  dashboard?: boolean;
  tasks?: boolean;
  photos?: boolean;
  spotify?: boolean;
  iptv?: boolean;
  youtube?: boolean;
  cameras?: boolean;
  homeassistant?: boolean;
  map?: boolean;
  recipes?: boolean;
  chat?: boolean;
  screensaver?: boolean;
}

// Kiosk configuration
export const kioskConfig = pgTable("kiosk_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").default(false).notNull(),
  // Color scheme
  colorScheme: colorSchemeEnum("color_scheme").default("default").notNull(),
  // Screensaver settings
  screensaverEnabled: boolean("screensaver_enabled").default(true).notNull(),
  screensaverTimeout: integer("screensaver_timeout").default(300).notNull(), // seconds
  screensaverInterval: integer("screensaver_interval").default(15).notNull(), // seconds between slides
  screensaverLayout: screensaverLayoutEnum("screensaver_layout").default("fullscreen").notNull(),
  screensaverTransition: screensaverTransitionEnum("screensaver_transition").default("fade").notNull(),
  screensaverLayoutConfig: jsonb("screensaver_layout_config"), // Custom builder layout config (widgets, grid, etc.)
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Kiosks (multi-kiosk support with token-based URLs)
export const kiosks = pgTable(
  "kiosks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: uuid("token").notNull().unique().defaultRandom(), // URL token for public access
    name: text("name").notNull().default("My Kiosk"),
    isActive: boolean("is_active").default(true).notNull(),
    // Color scheme
    colorScheme: colorSchemeEnum("color_scheme").default("default").notNull(),
    // Display mode settings
    displayMode: kioskDisplayModeEnum("display_mode").default("full").notNull(),
    displayType: kioskDisplayTypeEnum("display_type").notNull().default("touch"),
    homePage: text("home_page").default("calendar"),
    selectedCalendarIds: text("selected_calendar_ids").array(),
    enabledFeatures: jsonb("enabled_features").$type<KioskEnabledFeatures>(),
    // Screensaver settings
    screensaverEnabled: boolean("screensaver_enabled").default(true).notNull(),
    screensaverTimeout: integer("screensaver_timeout").default(300).notNull(), // seconds
    screensaverInterval: integer("screensaver_interval").default(15).notNull(), // seconds between slides
    screensaverLayout: screensaverLayoutEnum("screensaver_layout")
      .default("builder")
      .notNull(),
    screensaverTransition: screensaverTransitionEnum("screensaver_transition")
      .default("fade")
      .notNull(),
    screensaverLayoutConfig: jsonb("screensaver_layout_config"), // Custom builder layout config
    screensaverBehavior: text("screensaver_behavior").default("screensaver").notNull(), // "screensaver" | "hide-toolbar"
    startFullscreen: boolean("start_fullscreen").default(false).notNull(), // Auto-enter fullscreen on load
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("kiosks_user_idx").on(table.userId),
    index("kiosks_token_idx").on(table.token),
  ]
);

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
  kiosks: many(kiosks),
}));

export const companionAccessRelations = relations(companionAccess, ({ one }) => ({
  owner: one(users, {
    fields: [companionAccess.ownerId],
    references: [users.id],
    relationName: "companionAccessOwner",
  }),
  user: one(users, {
    fields: [companionAccess.userId],
    references: [users.id],
    relationName: "companionAccessUser",
  }),
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
  oauthToken: one(oauthTokens, {
    fields: [calendars.oauthTokenId],
    references: [oauthTokens.id],
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

export const kiosksRelations = relations(kiosks, ({ one }) => ({
  user: one(users, {
    fields: [kiosks.userId],
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
  isFavorite?: boolean;
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

// Home Assistant rooms for HOMIO-style organization
export const homeAssistantRooms = pgTable(
  "home_assistant_rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    temperatureSensorId: text("temperature_sensor_id"), // entity_id of temp sensor
    humiditySensorId: text("humidity_sensor_id"), // entity_id of humidity sensor
    windowSensorId: text("window_sensor_id"), // entity_id of window sensor (binary_sensor)
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("ha_rooms_user_idx").on(table.userId),
  ]
);

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
    roomId: uuid("room_id").references(() => homeAssistantRooms.id, { onDelete: "set null" }), // Optional room assignment
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
    index("ha_entities_room_idx").on(table.roomId),
  ]
);

export interface HomeAssistantEntitySettings {
  showIcon?: boolean;
  customIcon?: string;
  // Camera-specific fields
  refreshInterval?: number; // seconds (default 5)
  aspectRatio?: "16:9" | "4:3" | "1:1";
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

export const homeAssistantRoomsRelations = relations(
  homeAssistantRooms,
  ({ one, many }) => ({
    user: one(users, {
      fields: [homeAssistantRooms.userId],
      references: [users.id],
    }),
    entities: many(homeAssistantEntities),
  })
);

export const homeAssistantEntitiesRelations = relations(
  homeAssistantEntities,
  ({ one }) => ({
    user: one(users, {
      fields: [homeAssistantEntities.userId],
      references: [users.id],
    }),
    room: one(homeAssistantRooms, {
      fields: [homeAssistantEntities.roomId],
      references: [homeAssistantRooms.id],
    }),
  })
);

// System Settings - stores global and per-user configuration (API keys, etc.)
// userId = null means global/instance-level (self-hosted), non-null = per-user (SaaS hosted)
export const systemSettings = pgTable(
  "system_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    category: text("category").notNull(), // e.g., "weather", "google", "spotify"
    key: text("key").notNull(), // e.g., "api_key", "client_id", "latitude"
    value: text("value"), // Stored as text, encrypted for sensitive values
    isSecret: boolean("is_secret").default(false).notNull(), // If true, value is encrypted
    description: text("description"), // Optional description for UI
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("system_settings_category_idx").on(table.category),
    index("system_settings_key_idx").on(table.category, table.key),
    uniqueIndex("system_settings_user_category_key_idx").on(
      table.userId,
      table.category,
      table.key
    ),
  ]
);

// Favorite Sports Teams
export const favoriteSportsTeams = pgTable(
  "favorite_sports_teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: sportsProviderEnum("provider").notNull().default("espn"),
    sport: text("sport").notNull(), // e.g., "football", "basketball", "hockey", "baseball"
    league: text("league").notNull(), // e.g., "nfl", "nba", "nhl", "mlb"
    teamId: text("team_id").notNull(), // ESPN team ID
    teamName: text("team_name").notNull(),
    teamAbbreviation: text("team_abbreviation").notNull(),
    teamLogo: text("team_logo"), // URL to team logo
    teamColor: text("team_color"), // Primary team color (hex)
    isVisible: boolean("is_visible").default(true).notNull(),
    showOnDashboard: boolean("show_on_dashboard").default(true).notNull(),
    visibility: jsonb("visibility").$type<{ week: boolean; month: boolean; day: boolean; popup: boolean; screensaver: boolean }>().default({ week: false, month: false, day: false, popup: true, screensaver: false }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("favorite_sports_teams_user_idx").on(table.userId),
    index("favorite_sports_teams_team_idx").on(table.userId, table.league, table.teamId),
  ]
);

// Sports Games (cached from ESPN)
export const sportsGames = pgTable(
  "sports_games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalId: text("external_id").notNull(), // ESPN game ID
    provider: sportsProviderEnum("provider").notNull().default("espn"),
    sport: text("sport").notNull(),
    league: text("league").notNull(),
    homeTeamId: text("home_team_id").notNull(),
    homeTeamName: text("home_team_name").notNull(),
    homeTeamAbbreviation: text("home_team_abbreviation").notNull(),
    homeTeamLogo: text("home_team_logo"),
    homeTeamColor: text("home_team_color"),
    homeTeamScore: integer("home_team_score"),
    awayTeamId: text("away_team_id").notNull(),
    awayTeamName: text("away_team_name").notNull(),
    awayTeamAbbreviation: text("away_team_abbreviation").notNull(),
    awayTeamLogo: text("away_team_logo"),
    awayTeamColor: text("away_team_color"),
    awayTeamScore: integer("away_team_score"),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    status: gameStatusEnum("status").notNull().default("scheduled"),
    statusDetail: text("status_detail"), // e.g., "Q4 2:34", "Final", "1st 5:00"
    period: integer("period"), // Current period/quarter/inning
    clock: text("clock"), // Game clock e.g., "2:34"
    venue: text("venue"),
    broadcast: text("broadcast"), // TV broadcast info
    lastUpdated: timestamp("last_updated", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("sports_games_external_idx").on(table.provider, table.externalId),
    index("sports_games_time_idx").on(table.startTime),
    index("sports_games_status_idx").on(table.status),
    index("sports_games_teams_idx").on(table.homeTeamId, table.awayTeamId),
  ]
);

// Relations for sports tables
export const favoriteSportsTeamsRelations = relations(
  favoriteSportsTeams,
  ({ one }) => ({
    user: one(users, {
      fields: [favoriteSportsTeams.userId],
      references: [users.id],
    }),
  })
);

// Home Assistant Entity Timers - one-time timers for light/switch actions
export const haTimerActionEnum = pgEnum("ha_timer_action", ["turn_on", "turn_off"]);

export const haEntityTimers = pgTable(
  "ha_entity_timers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    entityId: text("entity_id").notNull(), // e.g., "light.living_room"
    action: haTimerActionEnum("action").notNull(), // "turn_on" or "turn_off"
    triggerAt: timestamp("trigger_at", { withTimezone: true }).notNull(), // when to execute
    fadeEnabled: boolean("fade_enabled").default(false).notNull(), // whether to fade (lights only)
    fadeDuration: integer("fade_duration").default(0).notNull(), // fade duration in seconds
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("ha_entity_timers_user_idx").on(table.userId),
    index("ha_entity_timers_trigger_idx").on(table.triggerAt),
    index("ha_entity_timers_entity_idx").on(table.userId, table.entityId),
  ]
);

export const haEntityTimersRelations = relations(haEntityTimers, ({ one }) => ({
  user: one(users, {
    fields: [haEntityTimers.userId],
    references: [users.id],
  }),
}));

// Automation enums
export const automationTriggerTypeEnum = pgEnum("automation_trigger_type", [
  "time",
  "state",
  "duration",
]);

export const automationActionTypeEnum = pgEnum("automation_action_type", [
  "service_call",
  "notification",
]);

// Home Assistant Automations - AI-powered smart home automations
export const haAutomations = pgTable(
  "ha_automations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"), // Original NL request
    enabled: boolean("enabled").default(true).notNull(),
    triggerType: automationTriggerTypeEnum("trigger_type").notNull(),
    triggerConfig: jsonb("trigger_config").$type<AutomationTriggerConfig>().notNull(),
    actionType: automationActionTypeEnum("action_type").notNull(),
    actionConfig: jsonb("action_config").$type<AutomationActionConfig>().notNull(),
    lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
    triggerCount: integer("trigger_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("ha_automations_user_idx").on(table.userId),
    index("ha_automations_enabled_idx").on(table.userId, table.enabled),
    index("ha_automations_trigger_type_idx").on(table.triggerType),
  ]
);

// Trigger config types
export interface TimeTriggerConfig {
  time: string; // "07:00" or "sunset" or "sunrise"
  sunOffset?: number; // minutes offset for sunset/sunrise
  days?: number[]; // 0-6 (Sunday-Saturday), empty = every day
}

export interface StateTriggerConfig {
  entityId: string;
  fromState?: string; // Optional "from" state
  toState: string; // Required "to" state
}

export interface DurationTriggerConfig {
  entityId: string;
  targetState: string; // State to monitor (e.g., "on", "open")
  durationMinutes: number;
}

export type AutomationTriggerConfig =
  | TimeTriggerConfig
  | StateTriggerConfig
  | DurationTriggerConfig;

// Action config types
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

export const haAutomationsRelations = relations(haAutomations, ({ one }) => ({
  user: one(users, {
    fields: [haAutomations.userId],
    references: [users.id],
  }),
}));

// Assumptions - AI behavior rules
export const assumptions = pgTable(
  "assumptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("assumptions_user_idx").on(table.userId),
  ]
);

export const assumptionsRelations = relations(assumptions, ({ one }) => ({
  user: one(users, {
    fields: [assumptions.userId],
    references: [users.id],
  }),
}));

// News Feeds - RSS feed subscriptions
export const newsFeeds = pgTable(
  "news_feeds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    feedUrl: text("feed_url").notNull(),
    category: text("category"),
    isActive: boolean("is_active").default(true).notNull(),
    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("news_feeds_user_idx").on(table.userId)]
);

// News Articles - Cached articles from feeds
export const newsArticles = pgTable(
  "news_articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    feedId: uuid("feed_id")
      .notNull()
      .references(() => newsFeeds.id, { onDelete: "cascade" }),
    guid: text("guid").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    link: text("link").notNull(),
    imageUrl: text("image_url"),
    author: text("author"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("news_articles_feed_idx").on(table.feedId),
    index("news_articles_published_idx").on(table.publishedAt),
  ]
);

// News Feed Relations
export const newsFeedsRelations = relations(newsFeeds, ({ one, many }) => ({
  user: one(users, {
    fields: [newsFeeds.userId],
    references: [users.id],
  }),
  articles: many(newsArticles),
}));

export const newsArticlesRelations = relations(newsArticles, ({ one }) => ({
  feed: one(newsFeeds, {
    fields: [newsArticles.feedId],
    references: [newsFeeds.id],
  }),
}));

// reMarkable Configuration - stores device token and connection info
export const remarkableConfig = pgTable("remarkable_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  deviceToken: text("device_token").notNull(), // Encrypted device token from registration
  userToken: text("user_token"), // Short-lived user token (refreshed automatically)
  userTokenExpiresAt: timestamp("user_token_expires_at", { withTimezone: true }),
  isConnected: boolean("is_connected").default(true).notNull(),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// reMarkable Agenda Settings - configures daily agenda push
export const remarkableAgendaSettings = pgTable("remarkable_agenda_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").default(true).notNull(),
  pushTime: text("push_time").default("06:00").notNull(), // HH:mm format
  folderPath: text("folder_path").default("/Calendar/Daily Agenda").notNull(),
  includeCalendarIds: text("include_calendar_ids").array(), // null = all visible calendars
  templateStyle: text("template_style").default("default").notNull(), // template variant
  showLocation: boolean("show_location").default(true).notNull(),
  showDescription: boolean("show_description").default(false).notNull(),
  notesLines: integer("notes_lines").default(20).notNull(), // number of lined note lines
  lastPushAt: timestamp("last_push_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// reMarkable Documents - tracks synced documents to avoid re-processing
export const remarkableDocuments = pgTable(
  "remarkable_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    documentId: text("document_id").notNull(), // reMarkable document ID
    documentVersion: integer("document_version").notNull(),
    documentName: text("document_name").notNull(),
    documentType: text("document_type").notNull(), // "notebook", "pdf", "epub"
    folderPath: text("folder_path"), // Path in reMarkable folder structure
    contentHash: text("content_hash"), // Hash of content for change detection
    isAgenda: boolean("is_agenda").default(false).notNull(), // True if this is a pushed agenda
    isProcessed: boolean("is_processed").default(false).notNull(), // True if notes have been processed
    processedAt: timestamp("processed_at", { withTimezone: true }),
    recognizedText: text("recognized_text"), // Extracted handwritten text
    lastModifiedAt: timestamp("last_modified_at", { withTimezone: true }), // From reMarkable
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("remarkable_documents_user_idx").on(table.userId),
    index("remarkable_documents_document_idx").on(table.userId, table.documentId),
    index("remarkable_documents_processed_idx").on(table.userId, table.isProcessed),
  ]
);

// reMarkable Event Source - links calendar events to source documents
export const remarkableEventSource = pgTable(
  "remarkable_event_source",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => remarkableDocuments.id, { onDelete: "cascade" }),
    extractedText: text("extracted_text").notNull(), // The text that was recognized
    confidence: integer("confidence"), // OCR confidence score (0-100)
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("remarkable_event_source_event_idx").on(table.eventId),
    index("remarkable_event_source_document_idx").on(table.documentId),
  ]
);

// reMarkable Relations
export const remarkableConfigRelations = relations(
  remarkableConfig,
  ({ one }) => ({
    user: one(users, {
      fields: [remarkableConfig.userId],
      references: [users.id],
    }),
  })
);

export const remarkableAgendaSettingsRelations = relations(
  remarkableAgendaSettings,
  ({ one }) => ({
    user: one(users, {
      fields: [remarkableAgendaSettings.userId],
      references: [users.id],
    }),
  })
);

export const remarkableDocumentsRelations = relations(
  remarkableDocuments,
  ({ one, many }) => ({
    user: one(users, {
      fields: [remarkableDocuments.userId],
      references: [users.id],
    }),
    eventSources: many(remarkableEventSource),
  })
);

export const remarkableEventSourceRelations = relations(
  remarkableEventSource,
  ({ one }) => ({
    event: one(events, {
      fields: [remarkableEventSource.eventId],
      references: [events.id],
    }),
    document: one(remarkableDocuments, {
      fields: [remarkableEventSource.documentId],
      references: [remarkableDocuments.id],
    }),
  })
);

// Capacities Configuration - stores API token for Capacities integration
export const capacitiesConfig = pgTable("capacities_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  apiToken: text("api_token").notNull(), // Encrypted API token
  defaultSpaceId: text("default_space_id"), // User's preferred space
  isConnected: boolean("is_connected").default(true).notNull(),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Capacities Spaces - cached spaces for faster lookups
export const capacitiesSpaces = pgTable(
  "capacities_spaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    spaceId: text("space_id").notNull(), // Capacities space ID
    title: text("title").notNull(),
    icon: text("icon"), // Emoji or icon data (JSON string)
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("capacities_spaces_user_idx").on(table.userId),
    index("capacities_spaces_space_idx").on(table.userId, table.spaceId),
  ]
);

// Capacities Relations
export const capacitiesConfigRelations = relations(
  capacitiesConfig,
  ({ one }) => ({
    user: one(users, {
      fields: [capacitiesConfig.userId],
      references: [users.id],
    }),
  })
);

export const capacitiesSpacesRelations = relations(
  capacitiesSpaces,
  ({ one }) => ({
    user: one(users, {
      fields: [capacitiesSpaces.userId],
      references: [users.id],
    }),
  })
);

// Telegram Bot Configuration - stores bot token and settings
export const telegramConfig = pgTable("telegram_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  botToken: text("bot_token").notNull(), // Encrypted bot token
  botUsername: text("bot_username"), // Bot username (e.g., @mybot)
  webhookSecret: text("webhook_secret"), // Secret for webhook validation
  isConnected: boolean("is_connected").default(true).notNull(),
  // Notification settings
  dailyAgendaEnabled: boolean("daily_agenda_enabled").default(true).notNull(),
  dailyAgendaTime: text("daily_agenda_time").default("07:00").notNull(), // HH:mm format
  eventRemindersEnabled: boolean("event_reminders_enabled").default(true).notNull(),
  eventReminderMinutes: integer("event_reminder_minutes").default(15).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Telegram Chat Links - links Telegram chats to users for notifications
export const telegramChats = pgTable(
  "telegram_chats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    chatId: text("chat_id").notNull(), // Telegram chat ID (can be user or group)
    chatType: text("chat_type").notNull().default("private"), // private, group, supergroup, channel
    chatTitle: text("chat_title"), // For groups/channels
    firstName: text("first_name"), // For private chats
    lastName: text("last_name"), // For private chats
    username: text("username"), // Telegram username
    isActive: boolean("is_active").default(true).notNull(),
    linkedAt: timestamp("linked_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  },
  (table) => [
    index("telegram_chats_user_idx").on(table.userId),
    index("telegram_chats_chat_idx").on(table.chatId),
  ]
);

// Telegram Relations
export const telegramConfigRelations = relations(
  telegramConfig,
  ({ one }) => ({
    user: one(users, {
      fields: [telegramConfig.userId],
      references: [users.id],
    }),
  })
);

export const telegramChatsRelations = relations(
  telegramChats,
  ({ one }) => ({
    user: one(users, {
      fields: [telegramChats.userId],
      references: [users.id],
    }),
  })
);

// Type exports for use in services
export type OAuthToken = typeof oauthTokens.$inferSelect;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type FavoriteSportsTeam = typeof favoriteSportsTeams.$inferSelect;
export type SportsGame = typeof sportsGames.$inferSelect;
export type HAEntityTimer = typeof haEntityTimers.$inferSelect;
export type HAAutomation = typeof haAutomations.$inferSelect;
export type Assumption = typeof assumptions.$inferSelect;
export type NewsFeed = typeof newsFeeds.$inferSelect;
export type NewsArticle = typeof newsArticles.$inferSelect;
export type RemarkableConfig = typeof remarkableConfig.$inferSelect;
export type RemarkableAgendaSettings = typeof remarkableAgendaSettings.$inferSelect;
export type RemarkableDocument = typeof remarkableDocuments.$inferSelect;
export type RemarkableEventSource = typeof remarkableEventSource.$inferSelect;
export type CapacitiesConfig = typeof capacitiesConfig.$inferSelect;
export type CapacitiesSpace = typeof capacitiesSpaces.$inferSelect;
export type TelegramConfig = typeof telegramConfig.$inferSelect;
export type TelegramChat = typeof telegramChats.$inferSelect;
export type Kiosk = typeof kiosks.$inferSelect;
export type CompanionAccess = typeof companionAccess.$inferSelect;
export type UserRole = "admin" | "member" | "viewer";

// reMarkable Template Enums
export const remarkableTemplateTypeEnum = pgEnum("remarkable_template_type", [
  "weekly_planner",
  "habit_tracker",
  "custom_agenda",
  "user_designed",
]);

export const remarkableScheduleTypeEnum = pgEnum("remarkable_schedule_type", [
  "daily",
  "weekly",
  "monthly",
  "manual",
]);

// reMarkable Templates - stores template configurations
export const remarkableTemplates = pgTable(
  "remarkable_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    templateType: remarkableTemplateTypeEnum("template_type").notNull(),
    config: jsonb("config").$type<RemarkableTemplateConfig>().default({}).notNull(),
    pdfTemplate: text("pdf_template"), // Base64 encoded for user-uploaded PDF templates
    mergeFields: jsonb("merge_fields").$type<RemarkableMergeField[]>(),
    folderPath: text("folder_path").default("/Calendar").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("remarkable_templates_user_idx").on(table.userId),
    index("remarkable_templates_type_idx").on(table.userId, table.templateType),
    index("remarkable_templates_active_idx").on(table.userId, table.isActive),
  ]
);

// reMarkable Schedules - unified scheduling for templates and default agenda
export const remarkableSchedules = pgTable(
  "remarkable_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    templateId: uuid("template_id").references(() => remarkableTemplates.id, {
      onDelete: "cascade",
    }), // null for default agenda
    scheduleType: remarkableScheduleTypeEnum("schedule_type").notNull().default("daily"),
    enabled: boolean("enabled").default(true).notNull(),
    pushTime: text("push_time").default("06:00").notNull(), // HH:mm format
    pushDay: integer("push_day"), // 0-6 for weekly (Sunday=0), 1-31 for monthly
    timezone: text("timezone").default("UTC").notNull(),
    lastPushAt: timestamp("last_push_at", { withTimezone: true }),
    nextPushAt: timestamp("next_push_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("remarkable_schedules_user_idx").on(table.userId),
    index("remarkable_schedules_template_idx").on(table.templateId),
    index("remarkable_schedules_enabled_idx").on(table.userId, table.enabled),
    index("remarkable_schedules_next_push_idx").on(table.nextPushAt),
  ]
);

// reMarkable Processed Confirmations - tracks confirmations sent back after note processing
export const remarkableProcessedConfirmations = pgTable(
  "remarkable_processed_confirmations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => remarkableDocuments.id, { onDelete: "cascade" }),
    confirmationType: text("confirmation_type").default("events_created").notNull(),
    confirmationDocumentId: text("confirmation_document_id"), // document ID of pushed confirmation
    eventsConfirmed: jsonb("events_confirmed").$type<ConfirmedEventSummary[]>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("remarkable_processed_confirmations_user_idx").on(table.userId),
    index("remarkable_processed_confirmations_document_idx").on(table.documentId),
    index("remarkable_processed_confirmations_created_idx").on(table.userId, table.createdAt),
  ]
);

// Template config types
export interface RemarkableTemplateConfig {
  // Weekly planner config
  weekStartsOn?: 0 | 1 | 6; // Sunday, Monday, Saturday
  showNotes?: boolean;
  notesPosition?: "per-day" | "shared";

  // Habit tracker config
  habits?: string[];
  trackerMonth?: string; // YYYY-MM format

  // Custom agenda config
  layout?: "timeline" | "list" | "blocks";
  fontFamily?: string;
  showDecorations?: boolean;
  customSections?: { name: string; position: "top" | "bottom" }[];

  // Common config
  includeCalendarIds?: string[];
  showLocation?: boolean;
  showDescription?: boolean;
  notesLines?: number;
}

export interface RemarkableMergeField {
  name: string;
  type: "date" | "events" | "weather" | "text" | "custom";
  x: number; // X position in PDF
  y: number; // Y position in PDF
  width?: number;
  height?: number;
  fontSize?: number;
  format?: string; // Date format or custom format string
}

export interface ConfirmedEventSummary {
  eventId: string;
  title: string;
  startTime: string;
  endTime?: string;
  isAllDay: boolean;
}

// reMarkable Template Relations
export const remarkableTemplatesRelations = relations(
  remarkableTemplates,
  ({ one, many }) => ({
    user: one(users, {
      fields: [remarkableTemplates.userId],
      references: [users.id],
    }),
    schedules: many(remarkableSchedules),
  })
);

export const remarkableSchedulesRelations = relations(
  remarkableSchedules,
  ({ one }) => ({
    user: one(users, {
      fields: [remarkableSchedules.userId],
      references: [users.id],
    }),
    template: one(remarkableTemplates, {
      fields: [remarkableSchedules.templateId],
      references: [remarkableTemplates.id],
    }),
  })
);

export const remarkableProcessedConfirmationsRelations = relations(
  remarkableProcessedConfirmations,
  ({ one }) => ({
    user: one(users, {
      fields: [remarkableProcessedConfirmations.userId],
      references: [users.id],
    }),
    document: one(remarkableDocuments, {
      fields: [remarkableProcessedConfirmations.documentId],
      references: [remarkableDocuments.id],
    }),
  })
);

// Type exports for new reMarkable tables
export type RemarkableTemplate = typeof remarkableTemplates.$inferSelect;
export type RemarkableSchedule = typeof remarkableSchedules.$inferSelect;
export type RemarkableProcessedConfirmation = typeof remarkableProcessedConfirmations.$inferSelect;

// Recipe ingredient interface
export interface RecipeIngredient {
  name: string;
  amount: string;  // "2", "1/2", etc.
  unit: string;    // "cups", "tbsp", etc.
}

// Recipes table
export const recipes = pgTable(
  "recipes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    servings: integer("servings"),
    prepTime: integer("prep_time"),      // minutes
    cookTime: integer("cook_time"),      // minutes
    ingredients: jsonb("ingredients").$type<RecipeIngredient[]>().default([]),
    instructions: jsonb("instructions").$type<string[]>().default([]),
    tags: text("tags").array().default([]),
    notes: text("notes"),
    sourceImagePath: text("source_image_path"),  // Original uploaded image
    thumbnailPath: text("thumbnail_path"),
    isFavorite: boolean("is_favorite").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("recipes_user_idx").on(table.userId),
    index("recipes_favorite_idx").on(table.userId, table.isFavorite),
    index("recipes_created_idx").on(table.userId, table.createdAt),
  ]
);

// Recipe upload tokens for QR code mobile uploads
export const recipeUploadTokens = pgTable(
  "recipe_upload_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("recipe_upload_tokens_token_idx").on(table.token),
    index("recipe_upload_tokens_expires_idx").on(table.expiresAt),
  ]
);

// Recipe relations
export const recipesRelations = relations(recipes, ({ one }) => ({
  user: one(users, {
    fields: [recipes.userId],
    references: [users.id],
  }),
}));

export const recipeUploadTokensRelations = relations(recipeUploadTokens, ({ one }) => ({
  user: one(users, {
    fields: [recipeUploadTokens.userId],
    references: [users.id],
  }),
}));

// Type exports for recipes
export type Recipe = typeof recipes.$inferSelect;
export type RecipeUploadToken = typeof recipeUploadTokens.$inferSelect;

// ============ Kitchen Timers ============

export const kitchenTimerStatusEnum = pgEnum("kitchen_timer_status", [
  "running",
  "paused",
  "completed",
  "cancelled",
]);

// Saved timer presets (e.g. "Boil eggs - 10 min")
export const kitchenTimerPresets = pgTable(
  "kitchen_timer_presets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    durationSeconds: integer("duration_seconds").notNull(),
    recipeId: uuid("recipe_id").references(() => recipes.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("kitchen_timer_presets_user_idx").on(table.userId)]
);

// Active (running/paused/completed) timers
export const kitchenActiveTimers = pgTable(
  "kitchen_active_timers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    presetId: uuid("preset_id").references(() => kitchenTimerPresets.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    durationSeconds: integer("duration_seconds").notNull(),
    remainingSeconds: integer("remaining_seconds").notNull(),
    status: kitchenTimerStatusEnum("status").notNull().default("running"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("kitchen_active_timers_user_idx").on(table.userId),
    index("kitchen_active_timers_user_status_idx").on(
      table.userId,
      table.status
    ),
  ]
);

// Kitchen timer relations
export const kitchenTimerPresetsRelations = relations(
  kitchenTimerPresets,
  ({ one }) => ({
    user: one(users, {
      fields: [kitchenTimerPresets.userId],
      references: [users.id],
    }),
    recipe: one(recipes, {
      fields: [kitchenTimerPresets.recipeId],
      references: [recipes.id],
    }),
  })
);

export const kitchenActiveTimersRelations = relations(
  kitchenActiveTimers,
  ({ one }) => ({
    user: one(users, {
      fields: [kitchenActiveTimers.userId],
      references: [users.id],
    }),
    preset: one(kitchenTimerPresets, {
      fields: [kitchenActiveTimers.presetId],
      references: [kitchenTimerPresets.id],
    }),
  })
);

// Type exports for kitchen timers
export type KitchenTimerPreset = typeof kitchenTimerPresets.$inferSelect;
export type KitchenActiveTimer = typeof kitchenActiveTimers.$inferSelect;

// ============ Family Profiles ============

// Family profiles table
export const familyProfiles = pgTable(
  "family_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    icon: text("icon"),
    color: text("color"),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("family_profiles_user_idx").on(table.userId)]
);

// Per-profile calendar visibility
export const profileCalendars = pgTable(
  "profile_calendars",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => familyProfiles.id, { onDelete: "cascade" }),
    calendarId: uuid("calendar_id")
      .notNull()
      .references(() => calendars.id, { onDelete: "cascade" }),
    isVisible: boolean("is_visible").default(true).notNull(),
  },
  (table) => [
    index("profile_calendars_profile_idx").on(table.profileId),
    index("profile_calendars_calendar_idx").on(table.calendarId),
  ]
);

// Per-profile news feed selection
export const profileNewsFeeds = pgTable(
  "profile_news_feeds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => familyProfiles.id, { onDelete: "cascade" }),
    newsFeedId: uuid("news_feed_id")
      .notNull()
      .references(() => newsFeeds.id, { onDelete: "cascade" }),
    isVisible: boolean("is_visible").default(true).notNull(),
  },
  (table) => [
    index("profile_news_feeds_profile_idx").on(table.profileId),
    index("profile_news_feeds_feed_idx").on(table.newsFeedId),
  ]
);

// Per-profile planner layout (widget-based)
export const profilePlannerConfig = pgTable("profile_planner_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .unique()
    .references(() => familyProfiles.id, { onDelete: "cascade" }),
  layoutConfig: jsonb("layout_config").$type<PlannerLayoutConfig>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Per-profile reMarkable settings
export const profileRemarkableSettings = pgTable("profile_remarkable_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .unique()
    .references(() => familyProfiles.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").default(true).notNull(),
  folderPath: text("folder_path").default("/Calendar"),
  scheduleType: remarkableScheduleTypeEnum("schedule_type").default("daily"),
  pushTime: text("push_time").default("06:00"),
  pushDay: integer("push_day"),
  timezone: text("timezone").default("America/New_York"),
  lastPushAt: timestamp("last_push_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Family profile relations
export const familyProfilesRelations = relations(familyProfiles, ({ one, many }) => ({
  user: one(users, {
    fields: [familyProfiles.userId],
    references: [users.id],
  }),
  calendars: many(profileCalendars),
  newsFeeds: many(profileNewsFeeds),
  plannerConfig: one(profilePlannerConfig),
  remarkableSettings: one(profileRemarkableSettings),
}));

export const profileCalendarsRelations = relations(profileCalendars, ({ one }) => ({
  profile: one(familyProfiles, {
    fields: [profileCalendars.profileId],
    references: [familyProfiles.id],
  }),
  calendar: one(calendars, {
    fields: [profileCalendars.calendarId],
    references: [calendars.id],
  }),
}));

export const profileNewsFeedsRelations = relations(profileNewsFeeds, ({ one }) => ({
  profile: one(familyProfiles, {
    fields: [profileNewsFeeds.profileId],
    references: [familyProfiles.id],
  }),
  newsFeed: one(newsFeeds, {
    fields: [profileNewsFeeds.newsFeedId],
    references: [newsFeeds.id],
  }),
}));

export const profilePlannerConfigRelations = relations(profilePlannerConfig, ({ one }) => ({
  profile: one(familyProfiles, {
    fields: [profilePlannerConfig.profileId],
    references: [familyProfiles.id],
  }),
}));

export const profileRemarkableSettingsRelations = relations(profileRemarkableSettings, ({ one }) => ({
  profile: one(familyProfiles, {
    fields: [profileRemarkableSettings.profileId],
    references: [familyProfiles.id],
  }),
}));

// ============ YouTube ============

export const youtubeBookmarkTypeEnum = pgEnum("youtube_bookmark_type", [
  "video",
  "live",
  "playlist",
  "channel",
]);

export const youtubeBookmarks = pgTable(
  "youtube_bookmarks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    youtubeId: text("youtube_id").notNull(),
    type: youtubeBookmarkTypeEnum("type").notNull().default("video"),
    title: text("title").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    channelTitle: text("channel_title"),
    channelId: text("channel_id"),
    duration: text("duration"),
    isLive: boolean("is_live").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("youtube_bookmarks_user_idx").on(table.userId),
    index("youtube_bookmarks_user_youtube_idx").on(table.userId, table.youtubeId),
  ]
);

export const youtubeWatchHistory = pgTable(
  "youtube_watch_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    youtubeId: text("youtube_id").notNull(),
    type: youtubeBookmarkTypeEnum("type").notNull().default("video"),
    title: text("title").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    channelTitle: text("channel_title"),
    watchedAt: timestamp("watched_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("youtube_watch_history_user_idx").on(table.userId),
    index("youtube_watch_history_user_youtube_idx").on(table.userId, table.youtubeId),
    index("youtube_watch_history_watched_idx").on(table.watchedAt),
  ]
);

export const youtubeBookmarksRelations = relations(youtubeBookmarks, ({ one }) => ({
  user: one(users, {
    fields: [youtubeBookmarks.userId],
    references: [users.id],
  }),
}));

export const youtubeWatchHistoryRelations = relations(youtubeWatchHistory, ({ one }) => ({
  user: one(users, {
    fields: [youtubeWatchHistory.userId],
    references: [users.id],
  }),
}));

export type YouTubeBookmark = typeof youtubeBookmarks.$inferSelect;
export type YouTubeWatchHistoryEntry = typeof youtubeWatchHistory.$inferSelect;

// ============ Chat History ============

// Chat conversations
export const chatConversations = pgTable(
  "chat_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("chat_conversations_user_idx").on(table.userId)]
);

// Chat messages
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => chatConversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // "user" | "assistant" | "system"
    content: text("content").notNull(),
    provider: text("provider"), // "claude" | "openai" | "gemini"
    model: text("model"),
    tokenUsage: jsonb("token_usage").$type<ChatTokenUsage>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("chat_messages_conversation_idx").on(table.conversationId),
    index("chat_messages_created_idx").on(table.conversationId, table.createdAt),
  ]
);

export interface ChatTokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

// Chat relations
export const chatConversationsRelations = relations(
  chatConversations,
  ({ one, many }) => ({
    user: one(users, {
      fields: [chatConversations.userId],
      references: [users.id],
    }),
    messages: many(chatMessages),
  })
);

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  conversation: one(chatConversations, {
    fields: [chatMessages.conversationId],
    references: [chatConversations.id],
  }),
}));

// Type exports for chat
export type ChatConversation = typeof chatConversations.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;

// Type exports for family profiles
export type FamilyProfile = typeof familyProfiles.$inferSelect;
export type ProfileCalendar = typeof profileCalendars.$inferSelect;
export type ProfileNewsFeed = typeof profileNewsFeeds.$inferSelect;
export type ProfilePlannerConfig = typeof profilePlannerConfig.$inferSelect;
export type ProfileRemarkableSettings = typeof profileRemarkableSettings.$inferSelect;

// Plex Servers
export const plexServers = pgTable(
  "plex_servers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    serverUrl: text("server_url").notNull(),
    accessToken: text("access_token").notNull(),
    machineId: text("machine_id"),
    isActive: boolean("is_active").default(true).notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("plex_servers_user_idx").on(table.userId)]
);

export const plexServersRelations = relations(plexServers, ({ one }) => ({
  user: one(users, {
    fields: [plexServers.userId],
    references: [users.id],
  }),
}));

// Audiobookshelf Servers
export const audiobookshelfServers = pgTable(
  "audiobookshelf_servers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    serverUrl: text("server_url").notNull(),
    accessToken: text("access_token").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("audiobookshelf_servers_user_idx").on(table.userId)]
);

export const audiobookshelfServersRelations = relations(audiobookshelfServers, ({ one }) => ({
  user: one(users, {
    fields: [audiobookshelfServers.userId],
    references: [users.id],
  }),
}));

// ============ Routines / Habit Tracker ============

export const routineFrequencyEnum = pgEnum("routine_frequency", [
  "daily",
  "weekly",
  "custom",
]);

export const routines = pgTable(
  "routines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    icon: text("icon"),
    category: text("category"),
    frequency: routineFrequencyEnum("frequency").notNull().default("daily"),
    daysOfWeek: integer("days_of_week").array(),
    assignedProfileId: uuid("assigned_profile_id").references(
      () => familyProfiles.id,
      { onDelete: "set null" }
    ),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("routines_user_idx").on(table.userId)]
);

export const routineCompletions = pgTable(
  "routine_completions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    routineId: uuid("routine_id")
      .notNull()
      .references(() => routines.id, { onDelete: "cascade" }),
    completedDate: date("completed_date").notNull(),
    completedByProfileId: uuid("completed_by_profile_id").references(
      () => familyProfiles.id,
      { onDelete: "set null" }
    ),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("routine_completions_routine_date_idx").on(
      table.routineId,
      table.completedDate
    ),
    index("routine_completions_date_idx").on(table.completedDate),
    uniqueIndex("routine_completions_unique_idx").on(
      table.routineId,
      table.completedDate,
      sql`COALESCE(${table.completedByProfileId}, '00000000-0000-0000-0000-000000000000')`
    ),
  ]
);

export const routinesRelations = relations(routines, ({ one, many }) => ({
  user: one(users, {
    fields: [routines.userId],
    references: [users.id],
  }),
  assignedProfile: one(familyProfiles, {
    fields: [routines.assignedProfileId],
    references: [familyProfiles.id],
  }),
  completions: many(routineCompletions),
}));

export const routineCompletionsRelations = relations(
  routineCompletions,
  ({ one }) => ({
    routine: one(routines, {
      fields: [routineCompletions.routineId],
      references: [routines.id],
    }),
    completedByProfile: one(familyProfiles, {
      fields: [routineCompletions.completedByProfileId],
      references: [familyProfiles.id],
    }),
  })
);

export type Routine = typeof routines.$inferSelect;
export type RoutineCompletion = typeof routineCompletions.$inferSelect;

// ============ Support Tickets ============

export const ticketStatusEnum = pgEnum("ticket_status", [
  "open",
  "in_progress",
  "waiting_on_user",
  "resolved",
  "closed",
]);

export const ticketPriorityEnum = pgEnum("ticket_priority", [
  "low",
  "normal",
  "high",
  "urgent",
]);

export const ticketCategoryEnum = pgEnum("ticket_category", [
  "billing",
  "bug",
  "feature_request",
  "account",
  "general",
]);

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    status: ticketStatusEnum("status").notNull().default("open"),
    priority: ticketPriorityEnum("priority").notNull().default("normal"),
    category: ticketCategoryEnum("category").notNull().default("general"),
    assignedAdminId: uuid("assigned_admin_id").references(() => users.id, {
      onDelete: "set null",
    }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("support_tickets_user_idx").on(table.userId),
    index("support_tickets_status_idx").on(table.status),
    index("support_tickets_assigned_idx").on(table.assignedAdminId),
    index("support_tickets_created_idx").on(table.createdAt),
  ]
);

export const supportMessages = pgTable(
  "support_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    isAdminReply: boolean("is_admin_reply").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("support_messages_ticket_idx").on(table.ticketId),
    index("support_messages_created_idx").on(table.createdAt),
  ]
);

export const supportTicketsRelations = relations(
  supportTickets,
  ({ one, many }) => ({
    user: one(users, {
      fields: [supportTickets.userId],
      references: [users.id],
    }),
    assignedAdmin: one(users, {
      fields: [supportTickets.assignedAdminId],
      references: [users.id],
    }),
    messages: many(supportMessages),
  })
);

export const supportMessagesRelations = relations(
  supportMessages,
  ({ one }) => ({
    ticket: one(supportTickets, {
      fields: [supportMessages.ticketId],
      references: [supportTickets.id],
    }),
    sender: one(users, {
      fields: [supportMessages.senderId],
      references: [users.id],
    }),
  })
);

export type SupportTicket = typeof supportTickets.$inferSelect;
export type SupportMessage = typeof supportMessages.$inferSelect;

// ==================== Matter Devices ====================

export const matterDeviceTypeEnum = pgEnum("matter_device_type", [
  "onOffLight",
  "dimmableLight",
  "colorTemperatureLight",
  "thermostat",
  "doorLock",
  "contactSensor",
  "occupancySensor",
  "temperatureSensor",
  "humiditySensor",
  "onOffSwitch",
  "windowCovering",
  "fan",
  "unknown",
]);

export const matterDevices = pgTable(
  "matter_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    nodeId: text("node_id").notNull(),
    vendorName: text("vendor_name"),
    productName: text("product_name"),
    deviceType: matterDeviceTypeEnum("device_type").notNull().default("unknown"),
    displayName: text("display_name").notNull(),
    roomId: uuid("room_id").references(() => homeAssistantRooms.id, { onDelete: "set null" }),
    sortOrder: integer("sort_order").default(0).notNull(),
    isReachable: boolean("is_reachable").default(false).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("matter_devices_user_idx").on(table.userId),
    index("matter_devices_node_idx").on(table.nodeId),
  ]
);

export const matterDevicesRelations = relations(
  matterDevices,
  ({ one }) => ({
    user: one(users, {
      fields: [matterDevices.userId],
      references: [users.id],
    }),
    room: one(homeAssistantRooms, {
      fields: [matterDevices.roomId],
      references: [homeAssistantRooms.id],
    }),
  })
);

// Invitations - user invite links
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name"),
    role: userRoleEnum("role").notNull().default("member"),
    token: uuid("token").notNull().unique().defaultRandom(),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("invitations_token_idx").on(table.token)]
);

export const invitationsRelations = relations(invitations, ({ one }) => ({
  inviter: one(users, {
    fields: [invitations.invitedBy],
    references: [users.id],
  }),
}));

export type Invitation = typeof invitations.$inferSelect;
