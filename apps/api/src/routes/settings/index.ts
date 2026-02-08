import type { FastifyPluginAsync } from "fastify";
import { eq, and } from "drizzle-orm";
import {
  systemSettings,
  kiosks,
  cameras,
  iptvServers,
  homeAssistantRooms,
  homeAssistantEntities,
  favoriteSportsTeams,
  newsFeeds,
} from "@openframe/database/schema";
import type {
  ExportedSettings,
  ImportResult,
} from "@openframe/shared";
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
        key: "vision_api_key",
        label: "Cloud Vision API Key",
        description: "For Cloud Vision OCR (~$0.0015 per recognition)",
        isSecret: true,
        placeholder: "AIza...",
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
  fastify.get(
    "/export",
    {
      preHandler: [authenticate],
      schema: {
        description: "Export all settings to JSON (excludes passwords and API keys)",
        tags: ["Settings"],
      },
    },
    async (request) => {
      const user = (request as any).user;

      // Get system settings (non-secrets only)
      const systemSettingsData = await fastify.db
        .select({
          category: systemSettings.category,
          key: systemSettings.key,
          value: systemSettings.value,
        })
        .from(systemSettings)
        .where(eq(systemSettings.isSecret, false));

      // Get kiosks (exclude token)
      const kiosksData = await fastify.db
        .select({
          name: kiosks.name,
          colorScheme: kiosks.colorScheme,
          screensaverEnabled: kiosks.screensaverEnabled,
          screensaverTimeout: kiosks.screensaverTimeout,
          screensaverInterval: kiosks.screensaverInterval,
          screensaverLayout: kiosks.screensaverLayout,
          screensaverTransition: kiosks.screensaverTransition,
          screensaverLayoutConfig: kiosks.screensaverLayoutConfig,
        })
        .from(kiosks)
        .where(eq(kiosks.userId, user.id));

      // Get cameras (exclude password)
      const camerasData = await fastify.db
        .select({
          name: cameras.name,
          rtspUrl: cameras.rtspUrl,
          mjpegUrl: cameras.mjpegUrl,
          snapshotUrl: cameras.snapshotUrl,
          username: cameras.username,
          isEnabled: cameras.isEnabled,
          sortOrder: cameras.sortOrder,
          settings: cameras.settings,
        })
        .from(cameras)
        .where(eq(cameras.userId, user.id));

      // Get IPTV servers (exclude username/password)
      const iptvServersData = await fastify.db
        .select({
          name: iptvServers.name,
          serverUrl: iptvServers.serverUrl,
          isActive: iptvServers.isActive,
        })
        .from(iptvServers)
        .where(eq(iptvServers.userId, user.id));

      // Get Home Assistant rooms
      const haRoomsData = await fastify.db
        .select({
          name: homeAssistantRooms.name,
          sortOrder: homeAssistantRooms.sortOrder,
          temperatureSensorId: homeAssistantRooms.temperatureSensorId,
          humiditySensorId: homeAssistantRooms.humiditySensorId,
          windowSensorId: homeAssistantRooms.windowSensorId,
        })
        .from(homeAssistantRooms)
        .where(eq(homeAssistantRooms.userId, user.id));

      // Get Home Assistant entities
      const haEntitiesData = await fastify.db
        .select({
          entityId: homeAssistantEntities.entityId,
          displayName: homeAssistantEntities.displayName,
          sortOrder: homeAssistantEntities.sortOrder,
          showInDashboard: homeAssistantEntities.showInDashboard,
          settings: homeAssistantEntities.settings,
        })
        .from(homeAssistantEntities)
        .where(eq(homeAssistantEntities.userId, user.id));

      // Get favorite sports teams
      const favoriteTeamsData = await fastify.db
        .select({
          sport: favoriteSportsTeams.sport,
          league: favoriteSportsTeams.league,
          teamId: favoriteSportsTeams.teamId,
          teamName: favoriteSportsTeams.teamName,
          teamAbbreviation: favoriteSportsTeams.teamAbbreviation,
          teamLogo: favoriteSportsTeams.teamLogo,
          teamColor: favoriteSportsTeams.teamColor,
          isVisible: favoriteSportsTeams.isVisible,
          showOnDashboard: favoriteSportsTeams.showOnDashboard,
          visibility: favoriteSportsTeams.visibility,
        })
        .from(favoriteSportsTeams)
        .where(eq(favoriteSportsTeams.userId, user.id));

      // Get news feeds
      const newsFeedsData = await fastify.db
        .select({
          name: newsFeeds.name,
          feedUrl: newsFeeds.feedUrl,
          category: newsFeeds.category,
          isActive: newsFeeds.isActive,
        })
        .from(newsFeeds)
        .where(eq(newsFeeds.userId, user.id));

      const exportData: ExportedSettings = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        clientSettings: {
          calendar: null,
          screensaver: null,
          tasks: null,
          durationAlerts: null,
        },
        serverSettings: {
          systemSettings: systemSettingsData,
          kiosks: kiosksData as ExportedSettings["serverSettings"]["kiosks"],
          cameras: camerasData as ExportedSettings["serverSettings"]["cameras"],
          iptvServers: iptvServersData,
          homeAssistant: {
            rooms: haRoomsData,
            entities: haEntitiesData as ExportedSettings["serverSettings"]["homeAssistant"]["entities"],
          },
          favoriteTeams: favoriteTeamsData as ExportedSettings["serverSettings"]["favoriteTeams"],
          newsFeeds: newsFeedsData,
        },
      };

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
        description: "Import settings from exported JSON",
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
      const user = (request as any).user;
      const { settings, mode = "merge" } = request.body;

      // Validate version
      if (settings.version !== "1.0") {
        return reply.badRequest("Unsupported export version");
      }

      const result: ImportResult = {
        success: true,
        imported: {
          systemSettings: 0,
          kiosks: 0,
          cameras: 0,
          iptvServers: 0,
          homeAssistantRooms: 0,
          homeAssistantEntities: 0,
          favoriteTeams: 0,
          newsFeeds: 0,
        },
        errors: [],
      };

      try {
        // Import system settings (non-secrets only)
        for (const setting of settings.serverSettings?.systemSettings ?? []) {
          try {
            // Find if setting is a secret in our definitions
            const categoryDef = SETTING_DEFINITIONS.find((c) => c.category === setting.category);
            const settingDef = categoryDef?.settings.find((s) => s.key === setting.key);

            // Skip if this is a secret setting
            if (settingDef?.isSecret) {
              continue;
            }

            const [existing] = await fastify.db
              .select()
              .from(systemSettings)
              .where(
                and(
                  eq(systemSettings.category, setting.category),
                  eq(systemSettings.key, setting.key)
                )
              )
              .limit(1);

            if (existing) {
              await fastify.db
                .update(systemSettings)
                .set({
                  value: setting.value,
                  updatedAt: new Date(),
                })
                .where(eq(systemSettings.id, existing.id));
            } else {
              await fastify.db.insert(systemSettings).values({
                category: setting.category,
                key: setting.key,
                value: setting.value,
                isSecret: false,
                description: settingDef?.description,
              });
            }
            result.imported.systemSettings++;
          } catch (err) {
            result.errors.push(`Failed to import system setting ${setting.category}/${setting.key}`);
          }
        }

        // Import kiosks by name match (update if exists, insert if new)
        for (const kiosk of settings.serverSettings?.kiosks ?? []) {
          try {
            const [existing] = await fastify.db
              .select()
              .from(kiosks)
              .where(and(eq(kiosks.userId, user.id), eq(kiosks.name, kiosk.name)))
              .limit(1);

            if (existing) {
              await fastify.db
                .update(kiosks)
                .set({
                  colorScheme: kiosk.colorScheme as any,
                  screensaverEnabled: kiosk.screensaverEnabled,
                  screensaverTimeout: kiosk.screensaverTimeout,
                  screensaverInterval: kiosk.screensaverInterval,
                  screensaverLayout: kiosk.screensaverLayout as any,
                  screensaverTransition: kiosk.screensaverTransition as any,
                  screensaverLayoutConfig: kiosk.screensaverLayoutConfig,
                  updatedAt: new Date(),
                })
                .where(eq(kiosks.id, existing.id));
            } else {
              await fastify.db.insert(kiosks).values({
                userId: user.id,
                name: kiosk.name,
                colorScheme: kiosk.colorScheme as any,
                screensaverEnabled: kiosk.screensaverEnabled,
                screensaverTimeout: kiosk.screensaverTimeout,
                screensaverInterval: kiosk.screensaverInterval,
                screensaverLayout: kiosk.screensaverLayout as any,
                screensaverTransition: kiosk.screensaverTransition as any,
                screensaverLayoutConfig: kiosk.screensaverLayoutConfig,
              });
            }
            result.imported.kiosks++;
          } catch (err) {
            result.errors.push(`Failed to import kiosk "${kiosk.name}"`);
          }
        }

        // Import cameras by name match
        for (const camera of settings.serverSettings?.cameras ?? []) {
          try {
            const [existing] = await fastify.db
              .select()
              .from(cameras)
              .where(and(eq(cameras.userId, user.id), eq(cameras.name, camera.name)))
              .limit(1);

            if (existing) {
              await fastify.db
                .update(cameras)
                .set({
                  rtspUrl: camera.rtspUrl,
                  mjpegUrl: camera.mjpegUrl,
                  snapshotUrl: camera.snapshotUrl,
                  username: camera.username,
                  isEnabled: camera.isEnabled,
                  sortOrder: camera.sortOrder,
                  settings: camera.settings,
                  updatedAt: new Date(),
                })
                .where(eq(cameras.id, existing.id));
            } else {
              await fastify.db.insert(cameras).values({
                userId: user.id,
                name: camera.name,
                rtspUrl: camera.rtspUrl,
                mjpegUrl: camera.mjpegUrl,
                snapshotUrl: camera.snapshotUrl,
                username: camera.username,
                isEnabled: camera.isEnabled,
                sortOrder: camera.sortOrder,
                settings: camera.settings,
              });
            }
            result.imported.cameras++;
          } catch (err) {
            result.errors.push(`Failed to import camera "${camera.name}"`);
          }
        }

        // Import IPTV servers by name match (note: will need credentials re-entered)
        for (const server of settings.serverSettings?.iptvServers ?? []) {
          try {
            const [existing] = await fastify.db
              .select()
              .from(iptvServers)
              .where(and(eq(iptvServers.userId, user.id), eq(iptvServers.name, server.name)))
              .limit(1);

            if (existing) {
              await fastify.db
                .update(iptvServers)
                .set({
                  serverUrl: server.serverUrl,
                  isActive: server.isActive,
                  updatedAt: new Date(),
                })
                .where(eq(iptvServers.id, existing.id));
              result.imported.iptvServers++;
            }
            // Don't create new IPTV servers as they require credentials
          } catch (err) {
            result.errors.push(`Failed to import IPTV server "${server.name}"`);
          }
        }

        // Import Home Assistant rooms by name match
        for (const room of settings.serverSettings?.homeAssistant?.rooms ?? []) {
          try {
            const [existing] = await fastify.db
              .select()
              .from(homeAssistantRooms)
              .where(and(eq(homeAssistantRooms.userId, user.id), eq(homeAssistantRooms.name, room.name)))
              .limit(1);

            if (existing) {
              await fastify.db
                .update(homeAssistantRooms)
                .set({
                  sortOrder: room.sortOrder,
                  temperatureSensorId: room.temperatureSensorId,
                  humiditySensorId: room.humiditySensorId,
                  windowSensorId: room.windowSensorId,
                })
                .where(eq(homeAssistantRooms.id, existing.id));
            } else {
              await fastify.db.insert(homeAssistantRooms).values({
                userId: user.id,
                name: room.name,
                sortOrder: room.sortOrder,
                temperatureSensorId: room.temperatureSensorId,
                humiditySensorId: room.humiditySensorId,
                windowSensorId: room.windowSensorId,
              });
            }
            result.imported.homeAssistantRooms++;
          } catch (err) {
            result.errors.push(`Failed to import HA room "${room.name}"`);
          }
        }

        // Import Home Assistant entities by entityId match
        for (const entity of settings.serverSettings?.homeAssistant?.entities ?? []) {
          try {
            const [existing] = await fastify.db
              .select()
              .from(homeAssistantEntities)
              .where(and(eq(homeAssistantEntities.userId, user.id), eq(homeAssistantEntities.entityId, entity.entityId)))
              .limit(1);

            if (existing) {
              await fastify.db
                .update(homeAssistantEntities)
                .set({
                  displayName: entity.displayName,
                  sortOrder: entity.sortOrder,
                  showInDashboard: entity.showInDashboard,
                  settings: entity.settings,
                })
                .where(eq(homeAssistantEntities.id, existing.id));
            } else {
              await fastify.db.insert(homeAssistantEntities).values({
                userId: user.id,
                entityId: entity.entityId,
                displayName: entity.displayName,
                sortOrder: entity.sortOrder,
                showInDashboard: entity.showInDashboard,
                settings: entity.settings,
              });
            }
            result.imported.homeAssistantEntities++;
          } catch (err) {
            result.errors.push(`Failed to import HA entity "${entity.entityId}"`);
          }
        }

        // Import favorite teams by teamId match
        for (const team of settings.serverSettings?.favoriteTeams ?? []) {
          try {
            const [existing] = await fastify.db
              .select()
              .from(favoriteSportsTeams)
              .where(
                and(
                  eq(favoriteSportsTeams.userId, user.id),
                  eq(favoriteSportsTeams.league, team.league),
                  eq(favoriteSportsTeams.teamId, team.teamId)
                )
              )
              .limit(1);

            if (existing) {
              await fastify.db
                .update(favoriteSportsTeams)
                .set({
                  teamName: team.teamName,
                  teamAbbreviation: team.teamAbbreviation,
                  teamLogo: team.teamLogo,
                  teamColor: team.teamColor,
                  isVisible: team.isVisible,
                  showOnDashboard: team.showOnDashboard,
                  visibility: team.visibility,
                })
                .where(eq(favoriteSportsTeams.id, existing.id));
            } else {
              await fastify.db.insert(favoriteSportsTeams).values({
                userId: user.id,
                sport: team.sport,
                league: team.league,
                teamId: team.teamId,
                teamName: team.teamName,
                teamAbbreviation: team.teamAbbreviation,
                teamLogo: team.teamLogo,
                teamColor: team.teamColor,
                isVisible: team.isVisible,
                showOnDashboard: team.showOnDashboard,
                visibility: team.visibility,
              });
            }
            result.imported.favoriteTeams++;
          } catch (err) {
            result.errors.push(`Failed to import favorite team "${team.teamName}"`);
          }
        }

        // Import news feeds by feedUrl match
        for (const feed of settings.serverSettings?.newsFeeds ?? []) {
          try {
            const [existing] = await fastify.db
              .select()
              .from(newsFeeds)
              .where(and(eq(newsFeeds.userId, user.id), eq(newsFeeds.feedUrl, feed.feedUrl)))
              .limit(1);

            if (existing) {
              await fastify.db
                .update(newsFeeds)
                .set({
                  name: feed.name,
                  category: feed.category,
                  isActive: feed.isActive,
                })
                .where(eq(newsFeeds.id, existing.id));
            } else {
              await fastify.db.insert(newsFeeds).values({
                userId: user.id,
                name: feed.name,
                feedUrl: feed.feedUrl,
                category: feed.category,
                isActive: feed.isActive,
              });
            }
            result.imported.newsFeeds++;
          } catch (err) {
            result.errors.push(`Failed to import news feed "${feed.name}"`);
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
