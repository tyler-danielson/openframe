import { z } from "zod";
import crypto from "crypto";
import fs from "fs";
import path from "path";

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
function emptyToUndefined(val: string | undefined): string | undefined {
  if (!val || val.trim() === "") return undefined;
  return val;
}

// Path for persisted auto-generated secrets
const SECRETS_PATH = path.resolve(process.env.DATA_DIR || "./data", "secrets.json");

interface PersistedSecrets {
  jwtSecret: string;
  cookieSecret: string;
  encryptionKey: string;
}

function loadOrGenerateSecrets(): PersistedSecrets {
  // Try to read existing secrets
  try {
    if (fs.existsSync(SECRETS_PATH)) {
      const raw = fs.readFileSync(SECRETS_PATH, "utf-8");
      const secrets = JSON.parse(raw) as PersistedSecrets;
      if (secrets.jwtSecret && secrets.cookieSecret && secrets.encryptionKey) {
        return secrets;
      }
    }
  } catch {
    // Fall through to generation
  }

  // Generate new secrets
  const secrets: PersistedSecrets = {
    jwtSecret: crypto.randomBytes(48).toString("base64url"),
    cookieSecret: crypto.randomBytes(48).toString("base64url"),
    encryptionKey: crypto.randomBytes(32).toString("hex"), // 64 hex chars = 32 bytes
  };

  // Persist to disk
  try {
    const dir = path.dirname(SECRETS_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SECRETS_PATH, JSON.stringify(secrets, null, 2), { mode: 0o600 });
    console.log(`Auto-generated infrastructure secrets saved to ${SECRETS_PATH}`);
  } catch (err) {
    console.warn(`Warning: Could not persist secrets to ${SECRETS_PATH}:`, err);
  }

  return secrets;
}

export function loadConfig(): Config {
  // Auto-generate secrets if not provided via env
  const envJwt = emptyToUndefined(process.env.JWT_SECRET);
  const envCookie = emptyToUndefined(process.env.COOKIE_SECRET);
  const envEncryption = emptyToUndefined(process.env.ENCRYPTION_KEY);

  let autoSecrets: PersistedSecrets | null = null;
  if (!envJwt || !envCookie || !envEncryption) {
    autoSecrets = loadOrGenerateSecrets();
  }

  const result = configSchema.safeParse({
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    logLevel: process.env.LOG_LEVEL,
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    jwtSecret: envJwt || autoSecrets?.jwtSecret,
    cookieSecret: envCookie || autoSecrets?.cookieSecret,
    corsOrigins: process.env.CORS_ORIGINS,
    encryptionKey: envEncryption || autoSecrets?.encryptionKey,
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
