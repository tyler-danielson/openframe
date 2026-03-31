import type { FastifyPluginAsync } from "fastify";
import { eq, and, or, isNull, inArray } from "drizzle-orm";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import sharp from "sharp";
import {
  systemSettings,
  kiosks,
  cameras,
  iptvServers,
  homeAssistantRooms,
  homeAssistantEntities,
  favoriteSportsTeams,
  newsFeeds,
  shoppingItems,
  recipes,
  familyProfiles,
  routines,
  customScreens,
  displayConfigs,
  kitchenTimerPresets,
  youtubeBookmarks,
  assumptions,
  haAutomations,
  photoAlbums,
  photos,
  calendars,
  events,
  taskLists,
  tasks,
  oauthTokens,
  homeAssistantConfig,
  plexServers,
  audiobookshelfServers,
} from "@openframe/database/schema";
import type {
  ExportedSettings,
  ImportResult,
  ExportCategory,
} from "@openframe/shared";
import { getCurrentUser } from "../../plugins/auth.js";
import { encrypt, decrypt, decryptField, encryptField } from "../../lib/encryption.js";
import { processImage } from "../../services/photos/processor.js";

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
    category: "server",
    label: "Server",
    description: "Server configuration settings",
    settings: [
      {
        key: "external_url",
        label: "External URL",
        description: "The external URL of this server (e.g., http://192.168.1.100:3000). Used for QR codes and mobile uploads.",
        isSecret: false,
        placeholder: "http://192.168.1.100:3000",
      },
    ],
  },
  {
    category: "home",
    label: "Home Location",
    description: "Your home address/coordinates used for weather, navigation, and other location-based features",
    settings: [
      {
        key: "address",
        label: "Address",
        description: "Your home address (optional, for reference)",
        isSecret: false,
        placeholder: "123 Main St, City, State",
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
    ],
  },
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
    description: "Configure Google OAuth, Maps, Gemini, and Vision APIs",
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
      {
        key: "gemini_api_key",
        label: "Gemini API Key",
        description: "For Gemini vision - best value (~$0.001 per recognition)",
        isSecret: true,
        placeholder: "AIza...",
      },
      {
        key: "gemini_model",
        label: "Gemini Model",
        description: "Model to use for chat (e.g., gemini-2.5-flash, gemini-2.0-flash, gemini-1.5-pro)",
        isSecret: false,
        placeholder: "gemini-2.5-flash",
      },
      {
        key: "vision_api_key",
        label: "Cloud Vision API Key",
        description: "For Cloud Vision OCR (~$0.0015 per recognition)",
        isSecret: true,
        placeholder: "AIza...",
      },
      {
        key: "youtube_api_key",
        label: "YouTube Data API Key",
        description: "For YouTube search, trending, and video details",
        isSecret: true,
        placeholder: "AIza...",
      },
    ],
  },
  {
    category: "microsoft",
    label: "Microsoft OAuth",
    description: "Configure Microsoft OAuth for calendar and tasks sync",
    settings: [
      {
        key: "client_id",
        label: "Application (Client) ID",
        description: "Microsoft Entra App Registration Client ID",
        isSecret: false,
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      },
      {
        key: "client_secret",
        label: "Client Secret",
        description: "Microsoft Entra App Registration Client Secret",
        isSecret: true,
        placeholder: "Client secret value",
      },
      {
        key: "tenant_id",
        label: "Tenant ID",
        description: "Directory (Tenant) ID, or 'common' for multi-tenant",
        isSecret: false,
        placeholder: "common",
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
    description: "Select AI provider for handwriting recognition",
    settings: [
      {
        key: "provider",
        label: "Recognition Provider",
        description: "Select which AI service to use",
        isSecret: false,
        placeholder: "tesseract",
      },
    ],
  },
  {
    category: "openai",
    label: "OpenAI",
    description: "Configure OpenAI API for GPT-4o vision and other AI features",
    settings: [
      {
        key: "api_key",
        label: "API Key",
        description: "For GPT-4o vision (~$0.01-0.03 per recognition)",
        isSecret: true,
        placeholder: "sk-...",
      },
      {
        key: "model",
        label: "Model",
        description: "Model to use for chat (e.g., gpt-4o, gpt-4o-mini, gpt-4-turbo)",
        isSecret: false,
        placeholder: "gpt-4o",
      },
    ],
  },
  {
    category: "anthropic",
    label: "Anthropic",
    description: "Configure Anthropic API for Claude vision and other AI features",
    settings: [
      {
        key: "api_key",
        label: "API Key",
        description: "For Claude vision (~$0.01-0.02 per recognition)",
        isSecret: true,
        placeholder: "sk-ant-...",
      },
      {
        key: "model",
        label: "Model",
        description: "Model to use for chat (e.g., claude-sonnet-4-5-20250929, claude-3-5-haiku-latest)",
        isSecret: false,
        placeholder: "claude-sonnet-4-5-20250929",
      },
    ],
  },
  {
    category: "azure_openai",
    label: "Azure OpenAI",
    description: "Configure Azure OpenAI Service for AI chat",
    settings: [
      {
        key: "api_key",
        label: "API Key",
        description: "Azure OpenAI API key",
        isSecret: true,
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      },
      {
        key: "base_url",
        label: "Endpoint URL",
        description: "Azure OpenAI resource endpoint (e.g., https://myresource.openai.azure.com)",
        isSecret: false,
        placeholder: "https://myresource.openai.azure.com",
      },
      {
        key: "deployment_name",
        label: "Deployment Name",
        description: "The name of your model deployment",
        isSecret: false,
        placeholder: "gpt-4o",
      },
      {
        key: "api_version",
        label: "API Version",
        description: "Azure OpenAI API version",
        isSecret: false,
        placeholder: "2024-02-01",
      },
    ],
  },
  {
    category: "grok",
    label: "Grok (xAI)",
    description: "Configure xAI Grok API for AI chat",
    settings: [
      {
        key: "api_key",
        label: "API Key",
        description: "xAI API key for Grok",
        isSecret: true,
        placeholder: "xai-...",
      },
      {
        key: "model",
        label: "Model",
        description: "Model to use for chat (e.g., grok-3, grok-3-mini)",
        isSecret: false,
        placeholder: "grok-3-mini",
      },
    ],
  },
  {
    category: "openrouter",
    label: "OpenRouter",
    description: "Access 400+ AI models through a single API",
    settings: [
      {
        key: "api_key",
        label: "API Key",
        description: "OpenRouter API key",
        isSecret: true,
        placeholder: "sk-or-v1-...",
      },
      {
        key: "model",
        label: "Default Model",
        description: "Model to use (e.g., anthropic/claude-3.5-sonnet, openai/gpt-4o, google/gemini-2.0-flash)",
        isSecret: false,
        placeholder: "anthropic/claude-3.5-sonnet",
      },
    ],
  },
  {
    category: "local_llm",
    label: "Local LLM",
    description: "Configure a local LLM server (Ollama, LM Studio, etc.)",
    settings: [
      {
        key: "base_url",
        label: "Base URL",
        description: "OpenAI-compatible API endpoint. Use host.docker.internal instead of localhost if running in Docker.",
        isSecret: false,
        placeholder: "http://localhost:11434/v1",
      },
      {
        key: "api_key",
        label: "API Key (optional)",
        description: "API key if your local server requires one",
        isSecret: true,
        placeholder: "optional",
      },
      {
        key: "model",
        label: "Model Name",
        description: "Model to use (e.g., llama3, mistral, codellama)",
        isSecret: false,
        placeholder: "llama3",
      },
    ],
  },
  {
    category: "recipes",
    label: "Recipes",
    description: "Configure recipe parsing settings",
    settings: [
      {
        key: "ai_provider",
        label: "AI Provider for Recipe Parsing",
        description: "Which AI to use for extracting recipes from images (gemini, openai, or claude)",
        isSecret: false,
        placeholder: "gemini",
      },
    ],
  },
  {
    category: "chat",
    label: "AI Chat",
    description: "Configure AI chat assistant settings",
    settings: [
      {
        key: "provider",
        label: "Default Provider",
        description: "Which AI provider to use for chat (claude, openai, or gemini)",
        isSecret: false,
        placeholder: "claude",
      },
      {
        key: "model",
        label: "Model Override",
        description: "Override the default model (e.g., claude-sonnet-4-5-20250929, gpt-4o, gemini-2.5-flash)",
        isSecret: false,
        placeholder: "",
      },
      {
        key: "system_prompt_extra",
        label: "Custom Instructions",
        description: "Additional instructions appended to the chat system prompt",
        isSecret: false,
        placeholder: "Always respond in a casual, friendly tone...",
      },
    ],
  },
  {
    category: "cloud",
    label: "Cloud",
    description: "OpenFrame Cloud relay connection for remote management",
    settings: [
      {
        key: "enabled",
        label: "Enabled",
        description: "Whether the cloud relay connection is active",
        isSecret: false,
        placeholder: "false",
      },
      {
        key: "instance_id",
        label: "Instance ID",
        description: "Cloud instance identifier (set automatically during claim)",
        isSecret: false,
        placeholder: "",
      },
      {
        key: "relay_secret",
        label: "Relay Secret",
        description: "Shared secret for WebSocket authentication (set automatically)",
        isSecret: true,
        placeholder: "",
      },
      {
        key: "ws_endpoint",
        label: "WebSocket Endpoint",
        description: "Cloud relay WebSocket URL (set automatically)",
        isSecret: false,
        placeholder: "wss://openframe.us/relay",
      },
    ],
  },
  {
    category: "amazon",
    label: "Amazon",
    description: "Configure Amazon affiliate settings for the shopping list",
    settings: [
      {
        key: "affiliate_tag",
        label: "Affiliate Tag",
        description: "Your Amazon Associates tag (e.g., mystore-20)",
        isSecret: false,
        placeholder: "mystore-20",
      },
    ],
  },
];

// Categories fully hidden in hosted mode (platform-managed)
const HOSTED_HIDDEN_CATEGORIES = ["server", "cloud"];

// Per-category keys hidden in hosted mode (platform provides these)
const HOSTED_HIDDEN_KEYS: Record<string, string[]> = {
  google: ["client_id", "client_secret"],
  microsoft: ["client_id", "client_secret", "tenant_id"],
  spotify: ["client_id", "client_secret"],
};

function filterDefinitionsForHostedMode(
  definitions: CategoryDefinition[]
): CategoryDefinition[] {
  return definitions
    .filter((cat) => !HOSTED_HIDDEN_CATEGORIES.includes(cat.category))
    .map((cat) => {
      const hiddenKeys = HOSTED_HIDDEN_KEYS[cat.category];
      if (!hiddenKeys) return cat;
      return {
        ...cat,
        settings: cat.settings.filter((s) => !hiddenKeys.includes(s.key)),
      };
    });
}

function isCategoryProtectedInHostedMode(
  category: string,
  key?: string
): boolean {
  if (HOSTED_HIDDEN_CATEGORIES.includes(category)) return true;
  if (key && HOSTED_HIDDEN_KEYS[category]?.includes(key)) return true;
  return false;
}

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
      const definitions = fastify.hostedMode
        ? filterDefinitionsForHostedMode(SETTING_DEFINITIONS)
        : SETTING_DEFINITIONS;
      return {
        success: true,
        data: definitions,
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
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) return reply.unauthorized("User not found");

      // Only show user's own settings + global defaults (userId IS NULL)
      const settings = await fastify.db
        .select()
        .from(systemSettings)
        .where(
          or(
            eq(systemSettings.userId, user.id),
            isNull(systemSettings.userId)
          )
        )
        .orderBy(systemSettings.category, systemSettings.key);

      // Filter out platform-managed settings in hosted mode
      const filtered = fastify.hostedMode
        ? settings.filter(
            (s) => !isCategoryProtectedInHostedMode(s.category, s.key)
          )
        : settings;

      // Mask secret values
      const maskedSettings = filtered.map((setting) => ({
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
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) return reply.unauthorized("User not found");
      const { category } = request.params;

      // Only show user's own settings + global defaults for this category
      const settings = await fastify.db
        .select()
        .from(systemSettings)
        .where(
          and(
            eq(systemSettings.category, category),
            or(
              eq(systemSettings.userId, user.id),
              isNull(systemSettings.userId)
            )
          )
        );

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
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) return reply.unauthorized("User not found");
      const { category, key } = request.params;
      const { value } = request.body;

      // Block writes to platform-managed settings in hosted mode
      if (fastify.hostedMode && isCategoryProtectedInHostedMode(category, key)) {
        return reply.forbidden("This setting is managed by the platform");
      }

      // Find the setting definition to check if it's a secret
      const categoryDef = SETTING_DEFINITIONS.find((c) => c.category === category);
      const settingDef = categoryDef?.settings.find((s) => s.key === key);
      const isSecret = settingDef?.isSecret ?? false;

      // Encrypt if it's a secret and has a value
      const storedValue = isSecret && value ? encrypt(value) : value;

      // Check if user already has this setting (scoped to their userId)
      const [existing] = await fastify.db
        .select()
        .from(systemSettings)
        .where(
          and(
            eq(systemSettings.category, category),
            eq(systemSettings.key, key),
            eq(systemSettings.userId, user.id)
          )
        )
        .limit(1);

      if (existing) {
        // Update user's own setting
        await fastify.db
          .update(systemSettings)
          .set({
            value: storedValue,
            isSecret,
            updatedAt: new Date(),
          })
          .where(eq(systemSettings.id, existing.id));
      } else {
        // Insert as user-scoped setting
        await fastify.db.insert(systemSettings).values({
          category,
          key,
          value: storedValue,
          isSecret,
          userId: user.id,
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
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) return reply.unauthorized("User not found");
      const { category } = request.params;
      const { settings } = request.body;

      // Block writes to platform-managed categories in hosted mode
      if (fastify.hostedMode && HOSTED_HIDDEN_CATEGORIES.includes(category)) {
        return reply.forbidden("This category is managed by the platform");
      }

      const categoryDef = SETTING_DEFINITIONS.find((c) => c.category === category);
      const hiddenKeys = fastify.hostedMode
        ? HOSTED_HIDDEN_KEYS[category] || []
        : [];

      for (const [key, value] of Object.entries(settings)) {
        // Skip platform-managed keys in hosted mode
        if (hiddenKeys.includes(key)) continue;
        const settingDef = categoryDef?.settings.find((s) => s.key === key);
        const isSecret = settingDef?.isSecret ?? false;

        // Skip if value is the masked placeholder
        if (value === "••••••••") continue;

        const storedValue = isSecret && value ? encrypt(value) : value;

        // Check for user's own existing setting
        const [existing] = await fastify.db
          .select()
          .from(systemSettings)
          .where(
            and(
              eq(systemSettings.category, category),
              eq(systemSettings.key, key),
              eq(systemSettings.userId, user.id)
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
            userId: user.id,
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
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) return reply.unauthorized("User not found");
      const { category, key } = request.params;

      // Only delete user's own settings, never global defaults
      await fastify.db
        .delete(systemSettings)
        .where(
          and(
            eq(systemSettings.category, category),
            eq(systemSettings.key, key),
            eq(systemSettings.userId, user.id)
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
          throw fastify.httpErrors.badRequest(data.error_message || "No results found for this address");
        }

        const result = data.results[0]!;
        return {
          success: true,
          data: {
            latitude: result.geometry.location.lat.toString(),
            longitude: result.geometry.location.lng.toString(),
            formattedAddress: result.formatted_address,
          },
        };
      } catch (error) {
        fastify.log.error({ err: error }, "Geocoding error");
        throw fastify.httpErrors.internalServerError("Failed to geocode address");
      }
    }
  );

  // Export all settings (excludes secrets/sensitive data)
  fastify.get<{
    Querystring: { categories?: string; includeCredentials?: string; includePhotoFiles?: string };
  }>(
    "/export",
    {
      preHandler: [authenticate],
      schema: {
        description: "Export settings to JSON with optional categories and credentials",
        tags: ["Settings"],
        querystring: {
          type: "object",
          properties: {
            categories: { type: "string" },
            includeCredentials: { type: "string" },
            includePhotoFiles: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) return reply.unauthorized("User not found");

      const requestedCategories: ExportCategory[] = request.query.categories
        ? (request.query.categories.split(",") as ExportCategory[])
        : ["settings"];
      const includeCredentials = request.query.includeCredentials === "true";
      const includePhotoFiles = request.query.includePhotoFiles === "true";
      const uploadDir = process.env.UPLOAD_DIR ?? "./uploads";

      const hasCategory = (cat: ExportCategory) => requestedCategories.includes(cat);

      const exportData: ExportedSettings = {
        version: "2.0",
        exportedAt: new Date().toISOString(),
        categories: requestedCategories,
        includesCredentials: includeCredentials,
        clientSettings: {
          calendar: null,
          screensaver: null,
          tasks: null,
          durationAlerts: null,
        },
        serverSettings: {
          systemSettings: [],
          kiosks: [],
          cameras: [],
          iptvServers: [],
          homeAssistant: { rooms: [], entities: [] },
          favoriteTeams: [],
          newsFeeds: [],
        },
      };

      // ── Settings category ──
      if (hasCategory("settings")) {
        // System settings (non-secrets, scoped to user + global)
        exportData.serverSettings.systemSettings = await fastify.db
          .select({ category: systemSettings.category, key: systemSettings.key, value: systemSettings.value })
          .from(systemSettings)
          .where(and(eq(systemSettings.isSecret, false), or(eq(systemSettings.userId, user.id), isNull(systemSettings.userId))));

        // Include secret settings if credentials requested
        if (includeCredentials) {
          const secretSettings = await fastify.db
            .select({ category: systemSettings.category, key: systemSettings.key, value: systemSettings.value })
            .from(systemSettings)
            .where(and(eq(systemSettings.isSecret, true), or(eq(systemSettings.userId, user.id), isNull(systemSettings.userId))));
          for (const s of secretSettings) {
            try {
              exportData.serverSettings.systemSettings.push({
                category: s.category,
                key: s.key,
                value: s.value ? decrypt(s.value) : null,
              });
            } catch { /* skip if can't decrypt */ }
          }
        }

        // Kiosks (exclude token)
        exportData.serverSettings.kiosks = (await fastify.db
          .select({
            name: kiosks.name, colorScheme: kiosks.colorScheme,
            screensaverEnabled: kiosks.screensaverEnabled, screensaverTimeout: kiosks.screensaverTimeout,
            screensaverInterval: kiosks.screensaverInterval, screensaverLayout: kiosks.screensaverLayout,
            screensaverTransition: kiosks.screensaverTransition, screensaverLayoutConfig: kiosks.screensaverLayoutConfig,
          })
          .from(kiosks).where(eq(kiosks.userId, user.id))) as any;

        // Cameras (exclude password unless credentials)
        exportData.serverSettings.cameras = (await fastify.db
          .select({
            name: cameras.name, rtspUrl: cameras.rtspUrl, mjpegUrl: cameras.mjpegUrl,
            snapshotUrl: cameras.snapshotUrl, username: cameras.username,
            isEnabled: cameras.isEnabled, sortOrder: cameras.sortOrder, settings: cameras.settings,
          })
          .from(cameras).where(eq(cameras.userId, user.id))) as any;

        // IPTV servers (exclude credentials unless requested)
        exportData.serverSettings.iptvServers = await fastify.db
          .select({ name: iptvServers.name, serverUrl: iptvServers.serverUrl, isActive: iptvServers.isActive })
          .from(iptvServers).where(eq(iptvServers.userId, user.id));

        // HA rooms
        exportData.serverSettings.homeAssistant.rooms = await fastify.db
          .select({
            name: homeAssistantRooms.name, sortOrder: homeAssistantRooms.sortOrder,
            temperatureSensorId: homeAssistantRooms.temperatureSensorId,
            humiditySensorId: homeAssistantRooms.humiditySensorId,
            windowSensorId: homeAssistantRooms.windowSensorId,
          })
          .from(homeAssistantRooms).where(eq(homeAssistantRooms.userId, user.id));

        // HA entities
        exportData.serverSettings.homeAssistant.entities = (await fastify.db
          .select({
            entityId: homeAssistantEntities.entityId, displayName: homeAssistantEntities.displayName,
            sortOrder: homeAssistantEntities.sortOrder, showInDashboard: homeAssistantEntities.showInDashboard,
            settings: homeAssistantEntities.settings,
          })
          .from(homeAssistantEntities).where(eq(homeAssistantEntities.userId, user.id))) as any;

        // HA automations
        exportData.serverSettings.homeAssistant.automations = (await fastify.db
          .select({
            name: haAutomations.name, description: haAutomations.description,
            enabled: haAutomations.enabled, triggerType: haAutomations.triggerType,
            triggerConfig: haAutomations.triggerConfig, actionType: haAutomations.actionType,
            actionConfig: haAutomations.actionConfig,
          })
          .from(haAutomations).where(eq(haAutomations.userId, user.id))) as any;

        // Favorite teams
        exportData.serverSettings.favoriteTeams = (await fastify.db
          .select({
            sport: favoriteSportsTeams.sport, league: favoriteSportsTeams.league,
            teamId: favoriteSportsTeams.teamId, teamName: favoriteSportsTeams.teamName,
            teamAbbreviation: favoriteSportsTeams.teamAbbreviation, teamLogo: favoriteSportsTeams.teamLogo,
            teamColor: favoriteSportsTeams.teamColor, isVisible: favoriteSportsTeams.isVisible,
            showOnDashboard: favoriteSportsTeams.showOnDashboard, visibility: favoriteSportsTeams.visibility,
          })
          .from(favoriteSportsTeams).where(eq(favoriteSportsTeams.userId, user.id))) as any;

        // News feeds
        exportData.serverSettings.newsFeeds = await fastify.db
          .select({ name: newsFeeds.name, feedUrl: newsFeeds.feedUrl, category: newsFeeds.category, source: newsFeeds.source, isActive: newsFeeds.isActive })
          .from(newsFeeds).where(eq(newsFeeds.userId, user.id));

        // Shopping items
        exportData.serverSettings.shoppingItems = await fastify.db
          .select({ name: shoppingItems.name, amazonUrl: shoppingItems.amazonUrl, checked: shoppingItems.checked, sortOrder: shoppingItems.sortOrder })
          .from(shoppingItems).where(eq(shoppingItems.userId, user.id));

        // Recipes
        exportData.serverSettings.recipes = (await fastify.db
          .select({
            title: recipes.title, description: recipes.description, servings: recipes.servings,
            prepTime: recipes.prepTime, cookTime: recipes.cookTime, ingredients: recipes.ingredients,
            instructions: recipes.instructions, tags: recipes.tags, notes: recipes.notes, isFavorite: recipes.isFavorite,
          })
          .from(recipes).where(eq(recipes.userId, user.id))) as any;

        // Family profiles
        exportData.serverSettings.familyProfiles = await fastify.db
          .select({ name: familyProfiles.name, icon: familyProfiles.icon, color: familyProfiles.color, isDefault: familyProfiles.isDefault })
          .from(familyProfiles).where(eq(familyProfiles.userId, user.id));

        // Routines
        exportData.serverSettings.routines = (await fastify.db
          .select({
            title: routines.title, icon: routines.icon, category: routines.category,
            frequency: routines.frequency, daysOfWeek: routines.daysOfWeek,
            sortOrder: routines.sortOrder, isActive: routines.isActive,
          })
          .from(routines).where(eq(routines.userId, user.id))) as any;

        // Custom screens
        exportData.serverSettings.customScreens = (await fastify.db
          .select({
            name: customScreens.name, icon: customScreens.icon, slug: customScreens.slug,
            layoutConfig: customScreens.layoutConfig, sortOrder: customScreens.sortOrder,
          })
          .from(customScreens).where(eq(customScreens.userId, user.id))) as any;

        // Display configs
        exportData.serverSettings.displayConfigs = (await fastify.db
          .select({
            name: displayConfigs.name, isActive: displayConfigs.isActive,
            layout: displayConfigs.layout, screenSettings: displayConfigs.screenSettings,
          })
          .from(displayConfigs).where(eq(displayConfigs.userId, user.id))) as any;

        // Kitchen timer presets
        exportData.serverSettings.kitchenTimerPresets = await fastify.db
          .select({ name: kitchenTimerPresets.name, durationSeconds: kitchenTimerPresets.durationSeconds })
          .from(kitchenTimerPresets).where(eq(kitchenTimerPresets.userId, user.id));

        // YouTube bookmarks
        exportData.serverSettings.youtubeBookmarks = (await fastify.db
          .select({
            youtubeId: youtubeBookmarks.youtubeId, type: youtubeBookmarks.type,
            title: youtubeBookmarks.title, thumbnailUrl: youtubeBookmarks.thumbnailUrl,
            channelTitle: youtubeBookmarks.channelTitle, channelId: youtubeBookmarks.channelId,
            duration: youtubeBookmarks.duration, isLive: youtubeBookmarks.isLive,
          })
          .from(youtubeBookmarks).where(eq(youtubeBookmarks.userId, user.id))) as any;

        // Assumptions
        exportData.serverSettings.assumptions = await fastify.db
          .select({ text: assumptions.text, enabled: assumptions.enabled, sortOrder: assumptions.sortOrder })
          .from(assumptions).where(eq(assumptions.userId, user.id));
      }

      // ── Photos category ──
      if (hasCategory("photos")) {
        const albumsData = await fastify.db
          .select({
            id: photoAlbums.id, name: photoAlbums.name, description: photoAlbums.description,
            isActive: photoAlbums.isActive, slideshowInterval: photoAlbums.slideshowInterval,
          })
          .from(photoAlbums).where(eq(photoAlbums.userId, user.id));

        const albumIdToName = new Map(albumsData.map(a => [a.id, a.name]));

        const photosData = await fastify.db
          .select({
            albumId: photos.albumId, filename: photos.filename, originalFilename: photos.originalFilename,
            mimeType: photos.mimeType, width: photos.width, height: photos.height,
            takenAt: photos.takenAt, sortOrder: photos.sortOrder, sourceType: photos.sourceType,
            originalPath: photos.originalPath,
          })
          .from(photos)
          .innerJoin(photoAlbums, eq(photos.albumId, photoAlbums.id))
          .where(eq(photoAlbums.userId, user.id));

        // Read photo files if requested, resizing to max 1920x1080 for portability
        const photoEntries = [];
        for (const p of photosData) {
          let fileData: string | undefined;
          if (includePhotoFiles && p.originalPath) {
            try {
              const filePath = join(uploadDir, p.originalPath);
              const raw = await readFile(filePath);
              const resized = await sharp(raw)
                .resize(3840, 2160, { fit: "inside", withoutEnlargement: true })
                .jpeg({ quality: 85 })
                .toBuffer();
              fileData = resized.toString("base64");
            } catch {
              // File not found or processing error — skip file data
            }
          }
          photoEntries.push({
            albumName: albumIdToName.get(p.albumId) ?? "Unknown",
            filename: p.filename, originalFilename: p.originalFilename, mimeType: p.mimeType,
            width: p.width, height: p.height,
            takenAt: p.takenAt?.toISOString() ?? null,
            sortOrder: p.sortOrder, sourceType: p.sourceType,
            ...(fileData ? { fileData } : {}),
          });
        }

        exportData.photos = {
          albums: albumsData.map(a => ({
            name: a.name, description: a.description, isActive: a.isActive, slideshowInterval: a.slideshowInterval,
          })),
          photos: photoEntries,
        };
      }

      // ── Events category ──
      if (hasCategory("events")) {
        const calendarsData = await fastify.db
          .select({
            id: calendars.id, provider: calendars.provider, externalId: calendars.externalId,
            name: calendars.name, displayName: calendars.displayName, description: calendars.description,
            color: calendars.color, icon: calendars.icon, isVisible: calendars.isVisible,
            isPrimary: calendars.isPrimary, isFavorite: calendars.isFavorite, isReadOnly: calendars.isReadOnly,
            syncEnabled: calendars.syncEnabled, showOnDashboard: calendars.showOnDashboard,
            kioskEnabled: calendars.kioskEnabled, visibility: calendars.visibility,
            sourceUrl: calendars.sourceUrl,
          })
          .from(calendars).where(eq(calendars.userId, user.id));

        const calendarIdToExternalId = new Map(calendarsData.map(c => [c.id, c.externalId]));
        const calendarIds = calendarsData.map(c => c.id);

        let eventsData: any[] = [];
        if (calendarIds.length > 0) {
          eventsData = await fastify.db
            .select({
              calendarId: events.calendarId, externalId: events.externalId, title: events.title,
              description: events.description, location: events.location, startTime: events.startTime,
              endTime: events.endTime, isAllDay: events.isAllDay, status: events.status,
              recurrenceRule: events.recurrenceRule, recurringEventId: events.recurringEventId,
              attendees: events.attendees, reminders: events.reminders, metadata: events.metadata,
            })
            .from(events).where(inArray(events.calendarId, calendarIds));
        }

        const taskListsData = await fastify.db
          .select({
            id: taskLists.id, provider: taskLists.provider, externalId: taskLists.externalId,
            name: taskLists.name, isVisible: taskLists.isVisible,
          })
          .from(taskLists).where(eq(taskLists.userId, user.id));

        const taskListIdToExternalId = new Map(taskListsData.map(t => [t.id, t.externalId]));
        const taskListIds = taskListsData.map(t => t.id);

        let tasksData: any[] = [];
        if (taskListIds.length > 0) {
          tasksData = await fastify.db
            .select({
              taskListId: tasks.taskListId, externalId: tasks.externalId, title: tasks.title,
              notes: tasks.notes, status: tasks.status, dueDate: tasks.dueDate,
              completedAt: tasks.completedAt, position: tasks.position,
            })
            .from(tasks).where(inArray(tasks.taskListId, taskListIds));
        }

        exportData.events = {
          calendars: calendarsData.map(c => ({
            provider: c.provider as string, externalId: c.externalId, name: c.name, displayName: c.displayName,
            description: c.description, color: c.color ?? "#3B82F6", icon: c.icon, isVisible: c.isVisible,
            isPrimary: c.isPrimary, isFavorite: c.isFavorite, isReadOnly: c.isReadOnly,
            syncEnabled: c.syncEnabled, showOnDashboard: c.showOnDashboard, kioskEnabled: c.kioskEnabled,
            visibility: c.visibility as any, sourceUrl: c.sourceUrl ?? null, accountLabel: null,
          })),
          events: eventsData.map(e => ({
            calendarExternalId: calendarIdToExternalId.get(e.calendarId) ?? "",
            externalId: e.externalId,
            title: decryptField(e.title) ?? e.title,
            description: decryptField(e.description),
            location: decryptField(e.location),
            startTime: e.startTime.toISOString(), endTime: e.endTime.toISOString(),
            isAllDay: e.isAllDay, status: e.status, recurrenceRule: e.recurrenceRule,
            recurringEventId: e.recurringEventId, attendees: e.attendees ?? [], reminders: e.reminders ?? [],
            metadata: e.metadata ?? null,
          })),
          taskLists: taskListsData.map(t => ({
            provider: t.provider, externalId: t.externalId, name: t.name, isVisible: t.isVisible,
          })),
          tasks: tasksData.map(t => ({
            taskListExternalId: taskListIdToExternalId.get(t.taskListId) ?? "",
            externalId: t.externalId, title: t.title, notes: t.notes, status: t.status,
            dueDate: t.dueDate?.toISOString() ?? null, completedAt: t.completedAt?.toISOString() ?? null,
            position: t.position,
          })),
        };
      }

      // ── Connections category (requires includeCredentials) ──
      if (hasCategory("connections") && includeCredentials) {
        // OAuth tokens (decrypt access/refresh tokens)
        const oauthData = await fastify.db
          .select({
            provider: oauthTokens.provider, accessToken: oauthTokens.accessToken,
            refreshToken: oauthTokens.refreshToken, tokenType: oauthTokens.tokenType,
            scope: oauthTokens.scope, expiresAt: oauthTokens.expiresAt,
            accountName: oauthTokens.accountName, externalAccountId: oauthTokens.externalAccountId,
            isPrimary: oauthTokens.isPrimary, icon: oauthTokens.icon,
          })
          .from(oauthTokens).where(eq(oauthTokens.userId, user.id));

        const decryptedOAuth = [];
        for (const t of oauthData) {
          try {
            decryptedOAuth.push({
              provider: t.provider, tokenType: t.tokenType, scope: t.scope,
              expiresAt: t.expiresAt?.toISOString() ?? null,
              accountName: t.accountName, externalAccountId: t.externalAccountId,
              isPrimary: t.isPrimary, icon: t.icon,
              accessToken: t.accessToken ? decrypt(t.accessToken) : "",
              refreshToken: t.refreshToken ? decrypt(t.refreshToken) : null,
            });
          } catch { /* skip if can't decrypt */ }
        }

        // HA config
        const [haConfig] = await fastify.db
          .select({ url: homeAssistantConfig.url, accessToken: homeAssistantConfig.accessToken })
          .from(homeAssistantConfig).where(eq(homeAssistantConfig.userId, user.id)).limit(1);

        let decryptedHaConfig = null;
        if (haConfig) {
          try {
            decryptedHaConfig = {
              url: haConfig.url,
              accessToken: haConfig.accessToken ? decrypt(haConfig.accessToken) : "",
            };
          } catch { /* skip */ }
        }

        // Camera passwords
        const cameraCredsData = await fastify.db
          .select({ name: cameras.name, password: cameras.password })
          .from(cameras).where(eq(cameras.userId, user.id));
        const cameraCreds = cameraCredsData
          .filter(c => c.password)
          .map(c => ({ name: c.name, password: c.password! }));

        // IPTV credentials
        const iptvCredsData = await fastify.db
          .select({ name: iptvServers.name, username: iptvServers.username, password: iptvServers.password })
          .from(iptvServers).where(eq(iptvServers.userId, user.id));
        const iptvCreds = iptvCredsData
          .filter(c => c.password)
          .map(c => ({ name: c.name, username: c.username, password: c.password! }));

        // Plex servers
        const plexData = await fastify.db
          .select({ name: plexServers.name, serverUrl: plexServers.serverUrl, accessToken: plexServers.accessToken, isActive: plexServers.isActive })
          .from(plexServers).where(eq(plexServers.userId, user.id));

        // Audiobookshelf servers
        const abData = await fastify.db
          .select({ name: audiobookshelfServers.name, serverUrl: audiobookshelfServers.serverUrl, accessToken: audiobookshelfServers.accessToken, isActive: audiobookshelfServers.isActive })
          .from(audiobookshelfServers).where(eq(audiobookshelfServers.userId, user.id));

        exportData.connections = {
          oauthTokens: decryptedOAuth,
          homeAssistantConfig: decryptedHaConfig,
          cameraCredentials: cameraCreds,
          iptvCredentials: iptvCreds,
          plexServers: plexData,
          audiobookshelfServers: abData,
        };
      }

      return {
        success: true,
        data: exportData,
      };
    }
  );

  // Import settings from exported JSON
  fastify.post<{
    Body: { settings: ExportedSettings; mode?: "merge" | "replace" };
  }>(
    "/import",
    {
      preHandler: [authenticate],
      schema: {
        description: "Import settings from exported JSON (v1 or v2)",
        tags: ["Settings"],
        body: {
          type: "object",
          properties: {
            settings: { type: "object" },
            mode: { type: "string", enum: ["merge", "replace"] },
          },
          required: ["settings"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) return reply.unauthorized("User not found");
      const { settings, mode = "merge" } = request.body;

      if (settings.version !== "1.0" && settings.version !== "2.0") {
        return reply.badRequest("Unsupported export version");
      }

      const result: ImportResult = {
        success: true,
        imported: {
          systemSettings: 0, kiosks: 0, cameras: 0, iptvServers: 0,
          homeAssistantRooms: 0, homeAssistantEntities: 0, favoriteTeams: 0, newsFeeds: 0,
          shoppingItems: 0, recipes: 0, familyProfiles: 0, routines: 0,
          customScreens: 0, displayConfigs: 0, kitchenTimerPresets: 0,
          youtubeBookmarks: 0, assumptions: 0, haAutomations: 0,
          photoAlbums: 0, photos: 0, calendars: 0, calendarEvents: 0,
          taskLists: 0, tasks: 0, oauthTokens: 0, connections: 0,
        },
        errors: [],
      };

      // Helper: upsert by match condition
      const upsert = async <T extends Record<string, any>>(
        table: any, matchWhere: any, insertData: T, updateData: Partial<T>,
      ) => {
        const [existing] = await fastify.db.select().from(table).where(matchWhere).limit(1);
        if (existing) {
          const setData = table.updatedAt ? { ...updateData, updatedAt: new Date() } : updateData;
          await fastify.db.update(table).set(setData).where(eq(table.id, existing.id));
        } else {
          await fastify.db.insert(table).values(insertData);
        }
      };

      try {
        // ── System settings ──
        for (const setting of settings.serverSettings?.systemSettings ?? []) {
          try {
            const categoryDef = SETTING_DEFINITIONS.find((c) => c.category === setting.category);
            const settingDef = categoryDef?.settings.find((s) => s.key === setting.key);

            // For v1 imports, skip secrets. For v2 with credentials, allow them.
            const isSecret = settingDef?.isSecret ?? false;
            if (isSecret && !settings.includesCredentials) continue;

            const matchWhere = and(
              eq(systemSettings.category, setting.category),
              eq(systemSettings.key, setting.key),
              eq(systemSettings.userId, user.id),
            );
            const value = isSecret && setting.value ? encrypt(setting.value) : setting.value;

            const [existing] = await fastify.db.select().from(systemSettings).where(matchWhere).limit(1);
            if (existing) {
              await fastify.db.update(systemSettings).set({ value, updatedAt: new Date() }).where(eq(systemSettings.id, existing.id));
            } else {
              await fastify.db.insert(systemSettings).values({
                category: setting.category, key: setting.key, value,
                isSecret, userId: user.id, description: settingDef?.description,
              });
            }
            result.imported.systemSettings++;
          } catch (err) {
            result.errors.push(`Failed to import setting ${setting.category}/${setting.key}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }

        // ── Kiosks ──
        for (const kiosk of settings.serverSettings?.kiosks ?? []) {
          try {
            await upsert(kiosks,
              and(eq(kiosks.userId, user.id), eq(kiosks.name, kiosk.name)),
              {
                userId: user.id, name: kiosk.name, colorScheme: kiosk.colorScheme as any,
                screensaverEnabled: kiosk.screensaverEnabled, screensaverTimeout: kiosk.screensaverTimeout,
                screensaverInterval: kiosk.screensaverInterval, screensaverLayout: kiosk.screensaverLayout as any,
                screensaverTransition: kiosk.screensaverTransition as any, screensaverLayoutConfig: kiosk.screensaverLayoutConfig,
              },
              {
                colorScheme: kiosk.colorScheme as any, screensaverEnabled: kiosk.screensaverEnabled,
                screensaverTimeout: kiosk.screensaverTimeout, screensaverInterval: kiosk.screensaverInterval,
                screensaverLayout: kiosk.screensaverLayout as any, screensaverTransition: kiosk.screensaverTransition as any,
                screensaverLayoutConfig: kiosk.screensaverLayoutConfig,
              },
            );
            result.imported.kiosks++;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            result.errors.push(`Failed to import kiosk "${kiosk.name}": ${msg}`);
          }
        }

        // ── Cameras ──
        for (const camera of settings.serverSettings?.cameras ?? []) {
          try {
            await upsert(cameras,
              and(eq(cameras.userId, user.id), eq(cameras.name, camera.name)),
              {
                userId: user.id, name: camera.name, rtspUrl: camera.rtspUrl, mjpegUrl: camera.mjpegUrl,
                snapshotUrl: camera.snapshotUrl, username: camera.username, isEnabled: camera.isEnabled,
                sortOrder: camera.sortOrder, settings: camera.settings,
              },
              {
                rtspUrl: camera.rtspUrl, mjpegUrl: camera.mjpegUrl, snapshotUrl: camera.snapshotUrl,
                username: camera.username, isEnabled: camera.isEnabled, sortOrder: camera.sortOrder, settings: camera.settings,
              },
            );
            result.imported.cameras++;
          } catch (err) { result.errors.push(`Failed to import camera "${camera.name}": ${err instanceof Error ? err.message : String(err)}`); }
        }

        // ── IPTV servers ──
        for (const server of settings.serverSettings?.iptvServers ?? []) {
          try {
            const [existing] = await fastify.db.select().from(iptvServers)
              .where(and(eq(iptvServers.userId, user.id), eq(iptvServers.name, server.name))).limit(1);
            if (existing) {
              await fastify.db.update(iptvServers).set({ serverUrl: server.serverUrl, isActive: server.isActive, updatedAt: new Date() })
                .where(eq(iptvServers.id, existing.id));
              result.imported.iptvServers++;
            }
          } catch (err) { result.errors.push(`Failed to import IPTV server "${server.name}"` + ": " + (err instanceof Error ? err.message : String(err))); }
        }

        // ── HA rooms ──
        for (const room of settings.serverSettings?.homeAssistant?.rooms ?? []) {
          try {
            await upsert(homeAssistantRooms,
              and(eq(homeAssistantRooms.userId, user.id), eq(homeAssistantRooms.name, room.name)),
              { userId: user.id, name: room.name, sortOrder: room.sortOrder, temperatureSensorId: room.temperatureSensorId, humiditySensorId: room.humiditySensorId, windowSensorId: room.windowSensorId },
              { sortOrder: room.sortOrder, temperatureSensorId: room.temperatureSensorId, humiditySensorId: room.humiditySensorId, windowSensorId: room.windowSensorId },
            );
            result.imported.homeAssistantRooms++;
          } catch (err) { result.errors.push(`Failed to import HA room "${room.name}"` + ": " + (err instanceof Error ? err.message : String(err))); }
        }

        // ── HA entities ──
        for (const entity of settings.serverSettings?.homeAssistant?.entities ?? []) {
          try {
            await upsert(homeAssistantEntities,
              and(eq(homeAssistantEntities.userId, user.id), eq(homeAssistantEntities.entityId, entity.entityId)),
              { userId: user.id, entityId: entity.entityId, displayName: entity.displayName, sortOrder: entity.sortOrder, showInDashboard: entity.showInDashboard, settings: entity.settings },
              { displayName: entity.displayName, sortOrder: entity.sortOrder, showInDashboard: entity.showInDashboard, settings: entity.settings },
            );
            result.imported.homeAssistantEntities++;
          } catch (err) { result.errors.push(`Failed to import HA entity "${entity.entityId}"` + ": " + (err instanceof Error ? err.message : String(err))); }
        }

        // ── HA automations (v2) ──
        for (const auto of settings.serverSettings?.homeAssistant?.automations ?? []) {
          try {
            await upsert(haAutomations,
              and(eq(haAutomations.userId, user.id), eq(haAutomations.name, auto.name)),
              { userId: user.id, name: auto.name, description: auto.description, enabled: auto.enabled, triggerType: auto.triggerType as any, triggerConfig: auto.triggerConfig, actionType: auto.actionType as any, actionConfig: auto.actionConfig },
              { description: auto.description, enabled: auto.enabled, triggerType: auto.triggerType as any, triggerConfig: auto.triggerConfig, actionType: auto.actionType as any, actionConfig: auto.actionConfig },
            );
            result.imported.haAutomations++;
          } catch (err) { result.errors.push(`Failed to import HA automation "${auto.name}"` + ": " + (err instanceof Error ? err.message : String(err))); }
        }

        // ── Favorite teams ──
        for (const team of settings.serverSettings?.favoriteTeams ?? []) {
          try {
            await upsert(favoriteSportsTeams,
              and(eq(favoriteSportsTeams.userId, user.id), eq(favoriteSportsTeams.league, team.league), eq(favoriteSportsTeams.teamId, team.teamId)),
              { userId: user.id, sport: team.sport, league: team.league, teamId: team.teamId, teamName: team.teamName, teamAbbreviation: team.teamAbbreviation, teamLogo: team.teamLogo, teamColor: team.teamColor, isVisible: team.isVisible, showOnDashboard: team.showOnDashboard, visibility: team.visibility },
              { teamName: team.teamName, teamAbbreviation: team.teamAbbreviation, teamLogo: team.teamLogo, teamColor: team.teamColor, isVisible: team.isVisible, showOnDashboard: team.showOnDashboard, visibility: team.visibility },
            );
            result.imported.favoriteTeams++;
          } catch (err) { result.errors.push(`Failed to import team "${team.teamName}"` + ": " + (err instanceof Error ? err.message : String(err))); }
        }

        // ── News feeds ──
        for (const feed of settings.serverSettings?.newsFeeds ?? []) {
          try {
            await upsert(newsFeeds,
              and(eq(newsFeeds.userId, user.id), eq(newsFeeds.feedUrl, feed.feedUrl)),
              { userId: user.id, name: feed.name, feedUrl: feed.feedUrl, category: feed.category, source: feed.source ?? null, isActive: feed.isActive },
              { name: feed.name, category: feed.category, source: feed.source ?? null, isActive: feed.isActive },
            );
            result.imported.newsFeeds++;
          } catch (err) { result.errors.push(`Failed to import news feed "${feed.name}"` + ": " + (err instanceof Error ? err.message : String(err))); }
        }

        // ── Shopping items (v2) ──
        for (const item of settings.serverSettings?.shoppingItems ?? []) {
          try {
            await upsert(shoppingItems,
              and(eq(shoppingItems.userId, user.id), eq(shoppingItems.name, item.name)),
              { userId: user.id, name: item.name, amazonUrl: item.amazonUrl, checked: item.checked, sortOrder: item.sortOrder },
              { amazonUrl: item.amazonUrl, checked: item.checked, sortOrder: item.sortOrder },
            );
            result.imported.shoppingItems++;
          } catch (err) { result.errors.push(`Failed to import shopping item "${item.name}"` + ": " + (err instanceof Error ? err.message : String(err))); }
        }

        // ── Recipes (v2) ──
        for (const recipe of settings.serverSettings?.recipes ?? []) {
          try {
            await upsert(recipes,
              and(eq(recipes.userId, user.id), eq(recipes.title, recipe.title)),
              { userId: user.id, title: recipe.title, description: recipe.description, servings: recipe.servings as any, prepTime: recipe.prepTime as any, cookTime: recipe.cookTime as any, ingredients: recipe.ingredients, instructions: recipe.instructions, tags: recipe.tags, notes: recipe.notes, isFavorite: recipe.isFavorite },
              { description: recipe.description, servings: recipe.servings as any, prepTime: recipe.prepTime as any, cookTime: recipe.cookTime as any, ingredients: recipe.ingredients, instructions: recipe.instructions, tags: recipe.tags, notes: recipe.notes, isFavorite: recipe.isFavorite },
            );
            result.imported.recipes++;
          } catch (err) { result.errors.push(`Failed to import recipe "${recipe.title}"` + ": " + (err instanceof Error ? err.message : String(err))); }
        }

        // ── Family profiles (v2) ──
        for (const profile of settings.serverSettings?.familyProfiles ?? []) {
          try {
            await upsert(familyProfiles,
              and(eq(familyProfiles.userId, user.id), eq(familyProfiles.name, profile.name)),
              { userId: user.id, name: profile.name, icon: profile.icon, color: profile.color, isDefault: profile.isDefault },
              { icon: profile.icon, color: profile.color, isDefault: profile.isDefault },
            );
            result.imported.familyProfiles++;
          } catch (err) { result.errors.push(`Failed to import profile "${profile.name}"` + ": " + (err instanceof Error ? err.message : String(err))); }
        }

        // ── Routines (v2) ──
        for (const routine of settings.serverSettings?.routines ?? []) {
          try {
            await upsert(routines,
              and(eq(routines.userId, user.id), eq(routines.title, routine.title)),
              { userId: user.id, title: routine.title, icon: routine.icon, category: routine.category, frequency: routine.frequency as any, daysOfWeek: routine.daysOfWeek, sortOrder: routine.sortOrder, isActive: routine.isActive },
              { icon: routine.icon, category: routine.category, frequency: routine.frequency as any, daysOfWeek: routine.daysOfWeek, sortOrder: routine.sortOrder, isActive: routine.isActive },
            );
            result.imported.routines++;
          } catch (err) { result.errors.push(`Failed to import routine "${routine.title}"` + ": " + (err instanceof Error ? err.message : String(err))); }
        }

        // ── Custom screens (v2) ──
        for (const screen of settings.serverSettings?.customScreens ?? []) {
          try {
            await upsert(customScreens,
              and(eq(customScreens.userId, user.id), eq(customScreens.slug, screen.slug)),
              { userId: user.id, name: screen.name, icon: screen.icon, slug: screen.slug, layoutConfig: screen.layoutConfig, sortOrder: screen.sortOrder },
              { name: screen.name, icon: screen.icon, layoutConfig: screen.layoutConfig, sortOrder: screen.sortOrder },
            );
            result.imported.customScreens++;
          } catch (err) { result.errors.push(`Failed to import screen "${screen.name}"` + ": " + (err instanceof Error ? err.message : String(err))); }
        }

        // ── Display configs (v2) ──
        for (const config of settings.serverSettings?.displayConfigs ?? []) {
          try {
            await upsert(displayConfigs,
              and(eq(displayConfigs.userId, user.id), eq(displayConfigs.name, config.name)),
              { userId: user.id, name: config.name, isActive: config.isActive, layout: config.layout, screenSettings: config.screenSettings },
              { isActive: config.isActive, layout: config.layout, screenSettings: config.screenSettings },
            );
            result.imported.displayConfigs++;
          } catch (err) { result.errors.push(`Failed to import display config "${config.name}"` + ": " + (err instanceof Error ? err.message : String(err))); }
        }

        // ── Kitchen timer presets (v2) ──
        for (const preset of settings.serverSettings?.kitchenTimerPresets ?? []) {
          try {
            await upsert(kitchenTimerPresets,
              and(eq(kitchenTimerPresets.userId, user.id), eq(kitchenTimerPresets.name, preset.name)),
              { userId: user.id, name: preset.name, durationSeconds: preset.durationSeconds },
              { durationSeconds: preset.durationSeconds },
            );
            result.imported.kitchenTimerPresets++;
          } catch (err) { result.errors.push(`Failed to import timer preset "${preset.name}"` + ": " + (err instanceof Error ? err.message : String(err))); }
        }

        // ── YouTube bookmarks (v2) ──
        for (const bm of settings.serverSettings?.youtubeBookmarks ?? []) {
          try {
            await upsert(youtubeBookmarks,
              and(eq(youtubeBookmarks.userId, user.id), eq(youtubeBookmarks.youtubeId, bm.youtubeId)),
              { userId: user.id, youtubeId: bm.youtubeId, type: bm.type as any, title: bm.title, thumbnailUrl: bm.thumbnailUrl, channelTitle: bm.channelTitle, channelId: bm.channelId, duration: bm.duration, isLive: bm.isLive },
              { title: bm.title, thumbnailUrl: bm.thumbnailUrl, channelTitle: bm.channelTitle },
            );
            result.imported.youtubeBookmarks++;
          } catch (err) { result.errors.push(`Failed to import bookmark "${bm.title}"` + ": " + (err instanceof Error ? err.message : String(err))); }
        }

        // ── Assumptions (v2) ──
        for (const a of settings.serverSettings?.assumptions ?? []) {
          try {
            await upsert(assumptions,
              and(eq(assumptions.userId, user.id), eq(assumptions.text, a.text)),
              { userId: user.id, text: a.text, enabled: a.enabled, sortOrder: a.sortOrder },
              { enabled: a.enabled, sortOrder: a.sortOrder },
            );
            result.imported.assumptions++;
          } catch (err) { result.errors.push(`Failed to import assumption` + ": " + (err instanceof Error ? err.message : String(err))); }
        }

        // ── Photos (v2) ──
        if (settings.photos) {
          // Import albums first
          const albumNameToId = new Map<string, string>();
          for (const album of settings.photos.albums) {
            try {
              const [existing] = await fastify.db.select().from(photoAlbums)
                .where(and(eq(photoAlbums.userId, user.id), eq(photoAlbums.name, album.name))).limit(1);
              if (existing) {
                await fastify.db.update(photoAlbums).set({ description: album.description, isActive: album.isActive, slideshowInterval: album.slideshowInterval, updatedAt: new Date() })
                  .where(eq(photoAlbums.id, existing.id));
                albumNameToId.set(album.name, existing.id);
              } else {
                const [inserted] = await fastify.db.insert(photoAlbums).values({ userId: user.id, name: album.name, description: album.description, isActive: album.isActive, slideshowInterval: album.slideshowInterval }).returning({ id: photoAlbums.id });
                if (inserted) albumNameToId.set(album.name, inserted.id);
              }
              result.imported.photoAlbums++;
            } catch (err) { result.errors.push(`Failed to import album "${album.name}"` + ": " + (err instanceof Error ? err.message : String(err))); }
          }

          // Import photo metadata + files (references albums by name)
          const importUploadDir = process.env.UPLOAD_DIR ?? "./uploads";
          for (const photo of settings.photos.photos) {
            try {
              const albumId = albumNameToId.get(photo.albumName);
              if (!albumId) { result.errors.push(`Album "${photo.albumName}" not found for photo "${photo.filename}"`); continue; }
              const [existing] = await fastify.db.select().from(photos)
                .where(and(eq(photos.albumId, albumId), eq(photos.filename, photo.filename))).limit(1);
              if (!existing) {
                let originalPath = "";
                let thumbnailPath: string | null = null;
                let mediumPath: string | null = null;
                let fileSize = 0;
                let width = photo.width ?? 0;
                let height = photo.height ?? 0;
                // Process photo file if included (generates original + thumbnail + medium)
                if (photo.fileData) {
                  const buffer = Buffer.from(photo.fileData, "base64");
                  fileSize = buffer.length;
                  const userDir = join(importUploadDir, user.id);
                  await mkdir(join(userDir, "original"), { recursive: true });
                  await mkdir(join(userDir, "thumbnails"), { recursive: true });
                  await mkdir(join(userDir, "medium"), { recursive: true });
                  const result = await processImage(buffer, {
                    userDir,
                    filename: photo.filename,
                    generateThumbnail: true,
                    generateMedium: true,
                  });
                  originalPath = join(user.id, result.originalPath);
                  thumbnailPath = result.thumbnailPath ? join(user.id, result.thumbnailPath) : null;
                  mediumPath = result.mediumPath ? join(user.id, result.mediumPath) : null;
                  width = result.width;
                  height = result.height;
                }
                await fastify.db.insert(photos).values({
                  albumId, filename: photo.filename, originalFilename: photo.originalFilename ?? photo.filename,
                  mimeType: photo.mimeType, width, height,
                  size: fileSize, originalPath, thumbnailPath, mediumPath,
                  takenAt: photo.takenAt ? new Date(photo.takenAt) : null,
                  sortOrder: photo.sortOrder, sourceType: photo.sourceType as any,
                });
              }
              result.imported.photos++;
            } catch (err) { result.errors.push(`Failed to import photo "${photo.filename}"` + ": " + (err instanceof Error ? err.message : String(err))); }
          }
        }

        // ── Events (v2) ──
        if (settings.events) {
          // Import calendars
          const calExternalIdToId = new Map<string, string>();
          for (const cal of settings.events.calendars) {
            try {
              const [existing] = await fastify.db.select().from(calendars)
                .where(and(eq(calendars.userId, user.id), eq(calendars.externalId, cal.externalId))).limit(1);
              if (existing) {
                await fastify.db.update(calendars).set({
                  name: cal.name, displayName: cal.displayName, color: cal.color, icon: cal.icon,
                  isVisible: cal.isVisible, isPrimary: cal.isPrimary, isFavorite: cal.isFavorite,
                  syncEnabled: cal.syncEnabled, showOnDashboard: cal.showOnDashboard,
                  kioskEnabled: cal.kioskEnabled, visibility: cal.visibility, updatedAt: new Date(),
                }).where(eq(calendars.id, existing.id));
                calExternalIdToId.set(cal.externalId, existing.id);
              } else {
                const [inserted] = await fastify.db.insert(calendars).values({
                  userId: user.id, provider: cal.provider as any, externalId: cal.externalId,
                  name: cal.name, displayName: cal.displayName, description: cal.description,
                  color: cal.color, icon: cal.icon, isVisible: cal.isVisible, isPrimary: cal.isPrimary,
                  isFavorite: cal.isFavorite, isReadOnly: cal.isReadOnly, syncEnabled: cal.syncEnabled,
                  showOnDashboard: cal.showOnDashboard, kioskEnabled: cal.kioskEnabled,
                  visibility: cal.visibility, sourceUrl: cal.sourceUrl,
                }).returning({ id: calendars.id });
                if (inserted) calExternalIdToId.set(cal.externalId, inserted.id);
              }
              result.imported.calendars++;
            } catch (err) { result.errors.push(`Failed to import calendar "${cal.name}"` + ": " + (err instanceof Error ? err.message : String(err))); }
          }

          // Import events (encrypt sensitive fields with this instance's key)
          for (const evt of settings.events.events) {
            try {
              const calId = calExternalIdToId.get(evt.calendarExternalId);
              if (!calId) continue;
              const encTitle = encryptField(evt.title) ?? evt.title;
              const encDescription = evt.description ? (encryptField(evt.description) ?? evt.description) : null;
              const encLocation = evt.location ? (encryptField(evt.location) ?? evt.location) : null;
              const [existing] = await fastify.db.select().from(events)
                .where(and(eq(events.calendarId, calId), eq(events.externalId, evt.externalId))).limit(1);
              if (existing) {
                await fastify.db.update(events).set({
                  title: encTitle, description: encDescription, location: encLocation,
                  startTime: new Date(evt.startTime), endTime: new Date(evt.endTime),
                  isAllDay: evt.isAllDay, status: evt.status as any, recurrenceRule: evt.recurrenceRule,
                  attendees: evt.attendees as any, reminders: evt.reminders as any, metadata: evt.metadata as any,
                  updatedAt: new Date(),
                }).where(eq(events.id, existing.id));
              } else {
                await fastify.db.insert(events).values({
                  calendarId: calId, externalId: evt.externalId, title: encTitle,
                  description: encDescription, location: encLocation,
                  startTime: new Date(evt.startTime), endTime: new Date(evt.endTime),
                  isAllDay: evt.isAllDay, status: evt.status as any, recurrenceRule: evt.recurrenceRule,
                  recurringEventId: evt.recurringEventId, attendees: evt.attendees as any,
                  reminders: evt.reminders as any, metadata: evt.metadata as any,
                });
              }
              result.imported.calendarEvents++;
            } catch (err) { result.errors.push(`Failed to import event "${evt.title}"` + ": " + (err instanceof Error ? err.message : String(err))); }
          }

          // Import task lists
          const tlExternalIdToId = new Map<string, string>();
          for (const tl of settings.events.taskLists) {
            try {
              const [existing] = await fastify.db.select().from(taskLists)
                .where(and(eq(taskLists.userId, user.id), eq(taskLists.externalId, tl.externalId))).limit(1);
              if (existing) {
                await fastify.db.update(taskLists).set({ name: tl.name, isVisible: tl.isVisible, updatedAt: new Date() })
                  .where(eq(taskLists.id, existing.id));
                tlExternalIdToId.set(tl.externalId, existing.id);
              } else {
                const [inserted] = await fastify.db.insert(taskLists).values({
                  userId: user.id, provider: tl.provider as any, externalId: tl.externalId,
                  name: tl.name, isVisible: tl.isVisible,
                }).returning({ id: taskLists.id });
                if (inserted) tlExternalIdToId.set(tl.externalId, inserted.id);
              }
              result.imported.taskLists++;
            } catch (err) { result.errors.push(`Failed to import task list "${tl.name}"` + ": " + (err instanceof Error ? err.message : String(err))); }
          }

          // Import tasks
          for (const task of settings.events.tasks) {
            try {
              const tlId = tlExternalIdToId.get(task.taskListExternalId);
              if (!tlId) continue;
              const [existing] = await fastify.db.select().from(tasks)
                .where(and(eq(tasks.taskListId, tlId), eq(tasks.externalId, task.externalId))).limit(1);
              if (existing) {
                await fastify.db.update(tasks).set({
                  title: task.title, notes: task.notes, status: task.status as any,
                  dueDate: task.dueDate ? new Date(task.dueDate) : null,
                  completedAt: task.completedAt ? new Date(task.completedAt) : null,
                  position: task.position, updatedAt: new Date(),
                }).where(eq(tasks.id, existing.id));
              } else {
                await fastify.db.insert(tasks).values({
                  taskListId: tlId, externalId: task.externalId, title: task.title,
                  notes: task.notes, status: task.status as any,
                  dueDate: task.dueDate ? new Date(task.dueDate) : null,
                  completedAt: task.completedAt ? new Date(task.completedAt) : null,
                  position: task.position,
                });
              }
              result.imported.tasks++;
            } catch (err) { result.errors.push(`Failed to import task "${task.title}"` + ": " + (err instanceof Error ? err.message : String(err))); }
          }
        }

        // ── Connections (v2, credentials) ──
        if (settings.connections && settings.includesCredentials) {
          // OAuth tokens
          for (const token of settings.connections.oauthTokens ?? []) {
            try {
              // Match by provider + externalAccountId, or provider + accountName if no externalAccountId
              const matchCondition = token.externalAccountId
                ? and(eq(oauthTokens.userId, user.id), eq(oauthTokens.provider, token.provider as any), eq(oauthTokens.externalAccountId, token.externalAccountId))
                : token.accountName
                  ? and(eq(oauthTokens.userId, user.id), eq(oauthTokens.provider, token.provider as any), eq(oauthTokens.accountName, token.accountName))
                  : and(eq(oauthTokens.userId, user.id), eq(oauthTokens.provider, token.provider as any));
              const [existing] = await fastify.db.select().from(oauthTokens)
                .where(matchCondition).limit(1);
              const encAccessToken = encrypt(token.accessToken);
              const encRefreshToken = token.refreshToken ? encrypt(token.refreshToken) : null;
              if (existing) {
                await fastify.db.update(oauthTokens).set({
                  accessToken: encAccessToken, refreshToken: encRefreshToken,
                  tokenType: token.tokenType, scope: token.scope,
                  expiresAt: token.expiresAt ? new Date(token.expiresAt) : null,
                  accountName: token.accountName, isPrimary: token.isPrimary, icon: token.icon,
                  updatedAt: new Date(),
                }).where(eq(oauthTokens.id, existing.id));
              } else {
                await fastify.db.insert(oauthTokens).values({
                  userId: user.id, provider: token.provider as any,
                  accessToken: encAccessToken, refreshToken: encRefreshToken,
                  tokenType: token.tokenType, scope: token.scope,
                  expiresAt: token.expiresAt ? new Date(token.expiresAt) : null,
                  accountName: token.accountName, externalAccountId: token.externalAccountId,
                  isPrimary: token.isPrimary, icon: token.icon,
                });
              }
              result.imported.oauthTokens++;
            } catch (err) { result.errors.push(`Failed to import OAuth token for ${token.provider}` + ": " + (err instanceof Error ? err.message : String(err))); }
          }

          // HA config
          if (settings.connections.homeAssistantConfig) {
            try {
              const haCfg = settings.connections.homeAssistantConfig;
              const encToken = encrypt(haCfg.accessToken);
              const [existing] = await fastify.db.select().from(homeAssistantConfig)
                .where(eq(homeAssistantConfig.userId, user.id)).limit(1);
              if (existing) {
                await fastify.db.update(homeAssistantConfig).set({ url: haCfg.url, accessToken: encToken, updatedAt: new Date() })
                  .where(eq(homeAssistantConfig.id, existing.id));
              } else {
                await fastify.db.insert(homeAssistantConfig).values({ userId: user.id, url: haCfg.url, accessToken: encToken });
              }
              result.imported.connections++;
            } catch (err) { result.errors.push("Failed to import HA config"); }
          }

          // Camera passwords
          for (const cred of settings.connections.cameraCredentials ?? []) {
            try {
              const [cam] = await fastify.db.select().from(cameras)
                .where(and(eq(cameras.userId, user.id), eq(cameras.name, cred.name))).limit(1);
              if (cam) {
                await fastify.db.update(cameras).set({ password: cred.password, updatedAt: new Date() })
                  .where(eq(cameras.id, cam.id));
                result.imported.connections++;
              }
            } catch (err) { result.errors.push(`Failed to import camera password for "${cred.name}"` + ": " + (err instanceof Error ? err.message : String(err))); }
          }

          // IPTV credentials
          for (const cred of settings.connections.iptvCredentials ?? []) {
            try {
              const [srv] = await fastify.db.select().from(iptvServers)
                .where(and(eq(iptvServers.userId, user.id), eq(iptvServers.name, cred.name))).limit(1);
              if (srv) {
                await fastify.db.update(iptvServers).set({ username: cred.username ?? "", password: cred.password, updatedAt: new Date() })
                  .where(eq(iptvServers.id, srv.id));
                result.imported.connections++;
              }
            } catch (err) { result.errors.push(`Failed to import IPTV creds for "${cred.name}"` + ": " + (err instanceof Error ? err.message : String(err))); }
          }

          // Plex servers
          for (const srv of settings.connections.plexServers ?? []) {
            try {
              await upsert(plexServers,
                and(eq(plexServers.userId, user.id), eq(plexServers.name, srv.name)),
                { userId: user.id, name: srv.name, serverUrl: srv.serverUrl, accessToken: srv.accessToken, isActive: srv.isActive },
                { serverUrl: srv.serverUrl, accessToken: srv.accessToken, isActive: srv.isActive },
              );
              result.imported.connections++;
            } catch (err) { result.errors.push(`Failed to import Plex server "${srv.name}"` + ": " + (err instanceof Error ? err.message : String(err))); }
          }

          // Audiobookshelf servers
          for (const srv of settings.connections.audiobookshelfServers ?? []) {
            try {
              await upsert(audiobookshelfServers,
                and(eq(audiobookshelfServers.userId, user.id), eq(audiobookshelfServers.name, srv.name)),
                { userId: user.id, name: srv.name, serverUrl: srv.serverUrl, accessToken: srv.accessToken, isActive: srv.isActive },
                { serverUrl: srv.serverUrl, accessToken: srv.accessToken, isActive: srv.isActive },
              );
              result.imported.connections++;
            } catch (err) { result.errors.push(`Failed to import Audiobookshelf server "${srv.name}"` + ": " + (err instanceof Error ? err.message : String(err))); }
          }
        }

      } catch (error) {
        fastify.log.error({ err: error }, "Settings import error");
        result.success = false;
        result.errors.push("Unexpected error during import");
      }

      return { success: true, data: result };
    }
  );
};

// Helper function to get a setting value (for use in other services)
// In multi-tenant mode, tries user-scoped setting first, falls back to global (userId IS NULL)
export async function getSystemSetting(
  db: any,
  category: string,
  key: string,
  userId?: string
): Promise<string | null> {
  // If userId provided, try user-scoped first
  if (userId) {
    const [userSetting] = await db
      .select()
      .from(systemSettings)
      .where(
        and(
          eq(systemSettings.category, category),
          eq(systemSettings.key, key),
          eq(systemSettings.userId, userId)
        )
      )
      .limit(1);

    if (userSetting?.value) {
      if (userSetting.isSecret) {
        try {
          return decrypt(userSetting.value);
        } catch {
          return null;
        }
      }
      return userSetting.value;
    }
  }

  // Fall back to global setting (userId IS NULL)
  const [setting] = await db
    .select()
    .from(systemSettings)
    .where(
      and(
        eq(systemSettings.category, category),
        eq(systemSettings.key, key),
        isNull(systemSettings.userId)
      )
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
// In multi-tenant mode, merges user-scoped settings over global defaults
export async function getCategorySettings(
  db: any,
  category: string,
  userId?: string
): Promise<Record<string, string | null>> {
  // Get global settings (userId IS NULL)
  const globalSettings = await db
    .select()
    .from(systemSettings)
    .where(
      and(
        eq(systemSettings.category, category),
        isNull(systemSettings.userId)
      )
    );

  const result: Record<string, string | null> = {};

  for (const setting of globalSettings) {
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

  // If userId provided, overlay user-scoped settings
  if (userId) {
    const userSettings = await db
      .select()
      .from(systemSettings)
      .where(
        and(
          eq(systemSettings.category, category),
          eq(systemSettings.userId, userId)
        )
      );

    for (const setting of userSettings) {
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
  }

  return result;
}
