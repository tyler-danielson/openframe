import type { FastifyPluginAsync } from "fastify";
import { eq, and } from "drizzle-orm";
import { systemSettings } from "@openframe/database/schema";
import crypto from "crypto";

// Simple encryption for secrets (uses the ENCRYPTION_KEY from env)
const ALGORITHM = "aes-256-gcm";

function encrypt(text: string): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY not set");

  const keyBuffer = Buffer.from(key, "hex");
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

function decrypt(encryptedText: string): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY not set");

  const [ivHex, authTagHex, encrypted] = encryptedText.split(":");
  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error("Invalid encrypted format");
  }

  const keyBuffer = Buffer.from(key, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

// Setting definitions with metadata
interface SettingDefinition {
  key: string;
  label: string;
  description?: string;
  isSecret: boolean;
  placeholder?: string;
}

interface CategoryDefinition {
  category: string;
  label: string;
  description: string;
  settings: SettingDefinition[];
}

const SETTING_DEFINITIONS: CategoryDefinition[] = [
  {
    category: "weather",
    label: "Weather (OpenWeatherMap)",
    description: "Configure OpenWeatherMap API for weather display",
    settings: [
      {
        key: "api_key",
        label: "API Key",
        description: "Get your free API key from openweathermap.org",
        isSecret: true,
        placeholder: "Your OpenWeatherMap API key",
      },
      {
        key: "latitude",
        label: "Latitude",
        description: "Your location's latitude (e.g., 40.7128)",
        isSecret: false,
        placeholder: "40.7128",
      },
      {
        key: "longitude",
        label: "Longitude",
        description: "Your location's longitude (e.g., -74.0060)",
        isSecret: false,
        placeholder: "-74.0060",
      },
      {
        key: "units",
        label: "Temperature Units",
        description: "imperial (Fahrenheit) or metric (Celsius)",
        isSecret: false,
        placeholder: "imperial",
      },
    ],
  },
  {
    category: "google",
    label: "Google APIs",
    description: "Configure Google OAuth and Maps API",
    settings: [
      {
        key: "client_id",
        label: "OAuth Client ID",
        description: "Google OAuth 2.0 Client ID",
        isSecret: false,
        placeholder: "xxxxxx.apps.googleusercontent.com",
      },
      {
        key: "client_secret",
        label: "OAuth Client Secret",
        description: "Google OAuth 2.0 Client Secret",
        isSecret: true,
        placeholder: "GOCSPX-xxxxxx",
      },
      {
        key: "maps_api_key",
        label: "Maps API Key",
        description: "Google Maps API key for driving time estimates",
        isSecret: true,
        placeholder: "AIzaSy...",
      },
    ],
  },
  {
    category: "spotify",
    label: "Spotify",
    description: "Configure Spotify OAuth for music playback",
    settings: [
      {
        key: "client_id",
        label: "Client ID",
        description: "Spotify Developer App Client ID",
        isSecret: false,
        placeholder: "xxxxxx",
      },
      {
        key: "client_secret",
        label: "Client Secret",
        description: "Spotify Developer App Client Secret",
        isSecret: true,
        placeholder: "xxxxxx",
      },
    ],
  },
  {
    category: "telegram",
    label: "Telegram Bot",
    description: "Configure Telegram bot for notifications",
    settings: [
      {
        key: "bot_token",
        label: "Bot Token",
        description: "Telegram Bot API token from @BotFather",
        isSecret: true,
        placeholder: "123456:ABC-DEF...",
      },
    ],
  },
  {
    category: "homeassistant",
    label: "Home Assistant",
    description: "Home Assistant integration (alternative to per-user config)",
    settings: [
      {
        key: "url",
        label: "Server URL",
        description: "Home Assistant server URL",
        isSecret: false,
        placeholder: "http://homeassistant.local:8123",
      },
      {
        key: "token",
        label: "Long-Lived Access Token",
        description: "Generate in Home Assistant Profile → Long-Lived Access Tokens",
        isSecret: true,
        placeholder: "eyJ0eXAiOiJKV1...",
      },
    ],
  },
  {
    category: "handwriting",
    label: "Handwriting Recognition",
    description: "Configure AI provider for handwriting recognition",
    settings: [
      {
        key: "provider",
        label: "Recognition Provider",
        description: "tesseract (free/offline), gemini, openai, claude, or google_vision",
        isSecret: false,
        placeholder: "tesseract",
      },
      {
        key: "openai_api_key",
        label: "OpenAI API Key",
        description: "For GPT-4o vision (~$0.01-0.03 per recognition)",
        isSecret: true,
        placeholder: "sk-...",
      },
      {
        key: "anthropic_api_key",
        label: "Anthropic API Key",
        description: "For Claude vision (~$0.01-0.02 per recognition)",
        isSecret: true,
        placeholder: "sk-ant-...",
      },
      {
        key: "gemini_api_key",
        label: "Google Gemini API Key",
        description: "Recommended - best value (~$0.001 per recognition)",
        isSecret: true,
        placeholder: "AIza...",
      },
      {
        key: "google_vision_api_key",
        label: "Google Cloud Vision API Key",
        description: "For Cloud Vision OCR (~$0.0015 per recognition)",
        isSecret: true,
        placeholder: "AIza...",
      },
    ],
  },
];

export const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  const { authenticate } = fastify;

  // Get all setting definitions (categories and their settings)
  fastify.get(
    "/definitions",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get all setting category definitions",
        tags: ["Settings"],
      },
    },
    async () => {
      return {
        success: true,
        data: SETTING_DEFINITIONS,
      };
    }
  );

  // Get all settings with values
  fastify.get(
    "/",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get all system settings",
        tags: ["Settings"],
      },
    },
    async () => {
      const settings = await fastify.db
        .select()
        .from(systemSettings)
        .orderBy(systemSettings.category, systemSettings.key);

      // Mask secret values
      const maskedSettings = settings.map((setting) => ({
        ...setting,
        value: setting.isSecret && setting.value ? "••••••••" : setting.value,
      }));

      return {
        success: true,
        data: maskedSettings,
      };
    }
  );

  // Get settings for a specific category
  fastify.get<{ Params: { category: string } }>(
    "/category/:category",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get settings for a specific category",
        tags: ["Settings"],
        params: {
          type: "object",
          properties: {
            category: { type: "string" },
          },
          required: ["category"],
        },
      },
    },
    async (request) => {
      const { category } = request.params;

      const settings = await fastify.db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.category, category));

      // Mask secret values
      const maskedSettings = settings.map((setting) => ({
        ...setting,
        value: setting.isSecret && setting.value ? "••••••••" : setting.value,
      }));

      return {
        success: true,
        data: maskedSettings,
      };
    }
  );

  // Update a setting
  fastify.put<{
    Params: { category: string; key: string };
    Body: { value: string | null };
  }>(
    "/category/:category/:key",
    {
      preHandler: [authenticate],
      schema: {
        description: "Update a system setting",
        tags: ["Settings"],
        params: {
          type: "object",
          properties: {
            category: { type: "string" },
            key: { type: "string" },
          },
          required: ["category", "key"],
        },
        body: {
          type: "object",
          properties: {
            value: { type: ["string", "null"] },
          },
        },
      },
    },
    async (request) => {
      const { category, key } = request.params;
      const { value } = request.body;

      // Find the setting definition to check if it's a secret
      const categoryDef = SETTING_DEFINITIONS.find((c) => c.category === category);
      const settingDef = categoryDef?.settings.find((s) => s.key === key);
      const isSecret = settingDef?.isSecret ?? false;

      // Encrypt if it's a secret and has a value
      const storedValue = isSecret && value ? encrypt(value) : value;

      // Check if setting exists
      const [existing] = await fastify.db
        .select()
        .from(systemSettings)
        .where(
          and(
            eq(systemSettings.category, category),
            eq(systemSettings.key, key)
          )
        )
        .limit(1);

      if (existing) {
        // Update
        await fastify.db
          .update(systemSettings)
          .set({
            value: storedValue,
            isSecret,
            updatedAt: new Date(),
          })
          .where(eq(systemSettings.id, existing.id));
      } else {
        // Insert
        await fastify.db.insert(systemSettings).values({
          category,
          key,
          value: storedValue,
          isSecret,
          description: settingDef?.description,
        });
      }

      return {
        success: true,
        message: "Setting updated",
      };
    }
  );

  // Bulk update settings for a category
  fastify.put<{
    Params: { category: string };
    Body: { settings: Record<string, string | null> };
  }>(
    "/category/:category",
    {
      preHandler: [authenticate],
      schema: {
        description: "Bulk update settings for a category",
        tags: ["Settings"],
        params: {
          type: "object",
          properties: {
            category: { type: "string" },
          },
          required: ["category"],
        },
        body: {
          type: "object",
          properties: {
            settings: { type: "object" },
          },
          required: ["settings"],
        },
      },
    },
    async (request) => {
      const { category } = request.params;
      const { settings } = request.body;

      const categoryDef = SETTING_DEFINITIONS.find((c) => c.category === category);

      for (const [key, value] of Object.entries(settings)) {
        const settingDef = categoryDef?.settings.find((s) => s.key === key);
        const isSecret = settingDef?.isSecret ?? false;

        // Skip if value is the masked placeholder
        if (value === "••••••••") continue;

        const storedValue = isSecret && value ? encrypt(value) : value;

        const [existing] = await fastify.db
          .select()
          .from(systemSettings)
          .where(
            and(
              eq(systemSettings.category, category),
              eq(systemSettings.key, key)
            )
          )
          .limit(1);

        if (existing) {
          await fastify.db
            .update(systemSettings)
            .set({
              value: storedValue,
              isSecret,
              updatedAt: new Date(),
            })
            .where(eq(systemSettings.id, existing.id));
        } else {
          await fastify.db.insert(systemSettings).values({
            category,
            key,
            value: storedValue,
            isSecret,
            description: settingDef?.description,
          });
        }
      }

      return {
        success: true,
        message: "Settings updated",
      };
    }
  );

  // Delete a setting
  fastify.delete<{ Params: { category: string; key: string } }>(
    "/category/:category/:key",
    {
      preHandler: [authenticate],
      schema: {
        description: "Delete a system setting",
        tags: ["Settings"],
        params: {
          type: "object",
          properties: {
            category: { type: "string" },
            key: { type: "string" },
          },
          required: ["category", "key"],
        },
      },
    },
    async (request) => {
      const { category, key } = request.params;

      await fastify.db
        .delete(systemSettings)
        .where(
          and(
            eq(systemSettings.category, category),
            eq(systemSettings.key, key)
          )
        );

      return {
        success: true,
        message: "Setting deleted",
      };
    }
  );

  // Geocode an address using Google Maps API
  fastify.post<{
    Body: { address: string };
  }>(
    "/geocode",
    {
      preHandler: [authenticate],
      schema: {
        description: "Geocode an address to get latitude/longitude",
        tags: ["Settings"],
        body: {
          type: "object",
          properties: {
            address: { type: "string" },
          },
          required: ["address"],
        },
      },
    },
    async (request, reply) => {
      const { address } = request.body;

      // Get Google Maps API key from settings or env
      const googleSettings = await getCategorySettings(fastify.db, "google");
      const apiKey = googleSettings.maps_api_key || process.env.GOOGLE_MAPS_API_KEY;

      if (!apiKey) {
        return reply.status(400).send({
          success: false,
          error: "Google Maps API key not configured. Please add it in Google APIs settings first.",
        });
      }

      try {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
        );

        if (!response.ok) {
          throw new Error(`Geocoding API error: ${response.status}`);
        }

        const data = await response.json() as {
          status: string;
          results: Array<{
            formatted_address: string;
            geometry: {
              location: { lat: number; lng: number };
            };
          }>;
          error_message?: string;
        };

        if (data.status !== "OK" || !data.results?.length) {
          return reply.status(400).send({
            success: false,
            error: data.error_message || "No results found for this address",
          });
        }

        const result = data.results[0];
        return {
          success: true,
          data: {
            latitude: result.geometry.location.lat.toString(),
            longitude: result.geometry.location.lng.toString(),
            formattedAddress: result.formatted_address,
          },
        };
      } catch (error) {
        fastify.log.error("Geocoding error:", error);
        return reply.status(500).send({
          success: false,
          error: "Failed to geocode address",
        });
      }
    }
  );
};

// Helper function to get a setting value (for use in other services)
export async function getSystemSetting(
  db: any,
  category: string,
  key: string
): Promise<string | null> {
  const [setting] = await db
    .select()
    .from(systemSettings)
    .where(
      and(eq(systemSettings.category, category), eq(systemSettings.key, key))
    )
    .limit(1);

  if (!setting?.value) return null;

  // Decrypt if secret
  if (setting.isSecret) {
    try {
      return decrypt(setting.value);
    } catch {
      return null;
    }
  }

  return setting.value;
}

// Helper to get multiple settings for a category
export async function getCategorySettings(
  db: any,
  category: string
): Promise<Record<string, string | null>> {
  const settings = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.category, category));

  const result: Record<string, string | null> = {};

  for (const setting of settings) {
    if (setting.value && setting.isSecret) {
      try {
        result[setting.key] = decrypt(setting.value);
      } catch {
        result[setting.key] = null;
      }
    } else {
      result[setting.key] = setting.value;
    }
  }

  return result;
}
