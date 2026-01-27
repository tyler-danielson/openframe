import { z } from "zod";

const configSchema = z.object({
  nodeEnv: z.enum(["development", "production", "test"]).default("development"),
  port: z.coerce.number().default(3001),
  logLevel: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  databaseUrl: z.string().url(),
  redisUrl: z.string().url().default("redis://localhost:6379"),
  jwtSecret: z.string().min(32),
  cookieSecret: z.string().min(32),
  corsOrigins: z
    .string()
    .transform((s) => s.split(",").map((o) => o.trim()))
    .default("http://localhost:3000"),
  encryptionKey: z.string().length(64), // 32 bytes hex encoded for AES-256

  // OAuth credentials
  googleClientId: z.string().optional(),
  googleClientSecret: z.string().optional(),
  googleRedirectUri: z.string().url().optional(),
  microsoftClientId: z.string().optional(),
  microsoftClientSecret: z.string().optional(),
  microsoftRedirectUri: z.string().url().optional(),

  // Telegram bot
  telegramBotToken: z.string().optional(),

  // Home Assistant
  homeAssistantUrl: z.string().url().optional(),
  homeAssistantToken: z.string().optional(),

  // Storage
  uploadDir: z.string().default("./uploads"),
});

export type Config = z.infer<typeof configSchema>;

// Helper to convert empty strings to undefined
const emptyToUndefined = (val: string | undefined) =>
  val && val.trim() !== "" ? val : undefined;

export function loadConfig(): Config {
  const result = configSchema.safeParse({
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    logLevel: process.env.LOG_LEVEL,
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    jwtSecret: process.env.JWT_SECRET,
    cookieSecret: process.env.COOKIE_SECRET,
    corsOrigins: process.env.CORS_ORIGINS,
    encryptionKey: process.env.ENCRYPTION_KEY,
    googleClientId: emptyToUndefined(process.env.GOOGLE_CLIENT_ID),
    googleClientSecret: emptyToUndefined(process.env.GOOGLE_CLIENT_SECRET),
    googleRedirectUri: emptyToUndefined(process.env.GOOGLE_REDIRECT_URI),
    microsoftClientId: emptyToUndefined(process.env.MICROSOFT_CLIENT_ID),
    microsoftClientSecret: emptyToUndefined(process.env.MICROSOFT_CLIENT_SECRET),
    microsoftRedirectUri: emptyToUndefined(process.env.MICROSOFT_REDIRECT_URI),
    telegramBotToken: emptyToUndefined(process.env.TELEGRAM_BOT_TOKEN),
    homeAssistantUrl: emptyToUndefined(process.env.HOME_ASSISTANT_URL),
    homeAssistantToken: emptyToUndefined(process.env.HOME_ASSISTANT_TOKEN),
    uploadDir: process.env.UPLOAD_DIR,
  });

  if (!result.success) {
    console.error("Invalid configuration:", result.error.format());
    process.exit(1);
  }

  return result.data;
}
