import { z } from "zod";

// Auth validators
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).default([]),
  expiresInDays: z.number().int().positive().optional(),
});

// Calendar validators
export const calendarQuerySchema = z.object({
  provider: z.enum(["google", "microsoft", "caldav"]).optional(),
  includeHidden: z.coerce.boolean().default(false),
});

export const syncCalendarSchema = z.object({
  fullSync: z.coerce.boolean().default(false),
});

// Event validators
export const eventQuerySchema = z.object({
  start: z.coerce.date(),
  end: z.coerce.date(),
  calendarIds: z
    .string()
    .transform((s) => s.split(",").filter(Boolean))
    .optional(),
  includeAllDay: z.coerce.boolean().default(true),
});

export const createEventSchema = z.object({
  calendarId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  location: z.string().max(500).optional(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  isAllDay: z.boolean().default(false),
  recurrenceRule: z.string().optional(),
  attendees: z
    .array(
      z.object({
        email: z.string().email(),
        name: z.string().optional(),
      })
    )
    .default([]),
  reminders: z
    .array(
      z.object({
        method: z.enum(["email", "popup"]),
        minutes: z.number().int().min(0).max(40320), // up to 4 weeks
      })
    )
    .default([]),
});

export const quickEventSchema = z.object({
  text: z.string().min(1).max(500),
  calendarId: z.string().uuid().optional(),
});

// Task validators
export const taskQuerySchema = z.object({
  listId: z.string().uuid().optional(),
  status: z.enum(["needsAction", "completed"]).optional(),
  dueAfter: z.coerce.date().optional(),
  dueBefore: z.coerce.date().optional(),
});

export const createTaskSchema = z.object({
  taskListId: z.string().uuid(),
  title: z.string().min(1).max(500),
  notes: z.string().max(5000).optional(),
  dueDate: z.coerce.date().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  notes: z.string().max(5000).optional(),
  status: z.enum(["needsAction", "completed"]).optional(),
  dueDate: z.coerce.date().nullable().optional(),
});

// Photo validators
export const createAlbumSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  slideshowInterval: z.number().int().min(5).max(300).default(30),
});

export const updateAlbumSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
  slideshowInterval: z.number().int().min(5).max(300).optional(),
  coverPhotoId: z.string().uuid().nullable().optional(),
});

// Display config validators
export const widgetConfigSchema = z.object({
  type: z.enum(["clock", "weather", "tasks", "ha-entity", "custom"]),
  position: z.object({
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    w: z.number().int().min(1),
    h: z.number().int().min(1),
  }),
  config: z.record(z.unknown()).default({}),
});

export const displayLayoutSchema = z.object({
  type: z.enum(["calendar-photos", "full-calendar", "dashboard"]),
  calendarPosition: z.enum(["left", "right", "center"]).optional(),
  photoPosition: z.enum(["left", "right"]).optional(),
  showClock: z.boolean().optional(),
  showWeather: z.boolean().optional(),
  showTasks: z.boolean().optional(),
  widgets: z.array(widgetConfigSchema).optional(),
});

export const screenSettingsSchema = z.object({
  brightness: z.number().min(0).max(100).optional(),
  autoSleep: z.boolean().optional(),
  sleepStartTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  sleepEndTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  orientation: z.enum(["landscape", "portrait"]).optional(),
});

export const createDisplayConfigSchema = z.object({
  name: z.string().min(1).max(100),
  layout: displayLayoutSchema,
  screenSettings: screenSettingsSchema.default({}),
});

export const updateDisplayConfigSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  layout: displayLayoutSchema.optional(),
  screenSettings: screenSettingsSchema.optional(),
});

// User preferences validator
export const userPreferencesSchema = z.object({
  defaultCalendarView: z.enum(["month", "week", "day", "agenda"]).optional(),
  weekStartsOn: z.union([z.literal(0), z.literal(1), z.literal(6)]).optional(),
  showWeekNumbers: z.boolean().optional(),
  theme: z.enum(["light", "dark", "auto"]).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  timezone: z.string().optional(),
  preferences: userPreferencesSchema.optional(),
});

// Type exports (excluding types already defined in types/index.ts)
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
export type CalendarQuery = z.infer<typeof calendarQuerySchema>;
export type EventQuery = z.infer<typeof eventQuerySchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type TaskQuery = z.infer<typeof taskQuerySchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateAlbumInput = z.infer<typeof createAlbumSchema>;
export type UpdateAlbumInput = z.infer<typeof updateAlbumSchema>;
export type CreateDisplayConfigInput = z.infer<typeof createDisplayConfigSchema>;
export type UpdateDisplayConfigInput = z.infer<typeof updateDisplayConfigSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
