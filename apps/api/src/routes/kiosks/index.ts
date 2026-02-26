import type { FastifyPluginAsync } from "fastify";
import { eq, and } from "drizzle-orm";
import {
  kiosks,
  photoAlbums,
  photos,
  calendars,
  events,
} from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";
import { randomUUID } from "crypto";
import type { UploadTokenData } from "../photos/index.js";
import { getSystemSetting } from "../settings/index.js";

// Extend Fastify with upload tokens (shared with photos routes)
declare module "fastify" {
  interface FastifyInstance {
    uploadTokens: Map<string, UploadTokenData>;
  }
}

// In-memory kiosk command store
// Commands expire after 60 seconds (kiosks should poll every 10 seconds)
type KioskCommandType =
  | "refresh"
  | "reload-photos"
  | "navigate"
  | "fullscreen"
  | "multiview-add"
  | "multiview-remove"
  | "multiview-clear"
  | "multiview-set"
  | "screensaver"
  | "widget-control"
  | "iptv-play"
  | "camera-view";

export interface KioskCommand {
  type: KioskCommandType;
  payload?: Record<string, unknown>;
  timestamp: number;
}
export const kioskCommands = new Map<string, KioskCommand[]>();

// All valid command types for schema validation
const VALID_COMMAND_TYPES: KioskCommandType[] = [
  "refresh",
  "reload-photos",
  "navigate",
  "fullscreen",
  "multiview-add",
  "multiview-remove",
  "multiview-clear",
  "multiview-set",
  "screensaver",
  "widget-control",
  "iptv-play",
  "camera-view",
];

// In-memory widget state store (kioskId -> widgetId -> state)
interface WidgetStateReport {
  widgetId: string;
  widgetType: string;
  state: Record<string, unknown>;
  updatedAt: number;
}
const kioskWidgetState = new Map<string, Map<string, WidgetStateReport>>();

// In-memory fast-poll tracking (kioskId -> expiry timestamp)
const kioskFastPoll = new Map<string, number>();

// Clean up expired commands every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [kioskId, commands] of kioskCommands.entries()) {
    const validCommands = commands.filter((cmd) => now - cmd.timestamp < 60000);
    if (validCommands.length === 0) {
      kioskCommands.delete(kioskId);
    } else {
      kioskCommands.set(kioskId, validCommands);
    }
  }
}, 5 * 60 * 1000);

export const kiosksRoutes: FastifyPluginAsync = async (fastify) => {
  // ========== PROTECTED ENDPOINTS (require auth) ==========

  // List user's kiosks
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "List all kiosks for the current user",
        tags: ["Kiosks"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("User not found");
      }

      const userKiosks = await fastify.db
        .select()
        .from(kiosks)
        .where(eq(kiosks.userId, user.id))
        .orderBy(kiosks.createdAt);

      return {
        success: true,
        data: userKiosks,
      };
    }
  );

  // Get a specific kiosk by ID
  fastify.get(
    "/:id",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Get a specific kiosk by ID",
        tags: ["Kiosks"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        return reply.unauthorized("User not found");
      }
      const { id } = request.params as { id: string };

      const [kiosk] = await fastify.db
        .select()
        .from(kiosks)
        .where(and(eq(kiosks.id, id), eq(kiosks.userId, user.id)))
        .limit(1);

      if (!kiosk) {
        return reply.notFound("Kiosk not found");
      }

      return {
        success: true,
        data: kiosk,
      };
    }
  );

  // Create a new kiosk
  fastify.post(
    "/",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Create a new kiosk",
        tags: ["Kiosks"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            colorScheme: {
              type: "string",
              enum: ["default", "homio", "ocean", "forest", "sunset", "lavender"],
            },
            screensaverEnabled: { type: "boolean" },
            screensaverTimeout: { type: "number", minimum: 30, maximum: 3600 },
            screensaverInterval: { type: "number", minimum: 3, maximum: 300 },
            screensaverLayout: {
              type: "string",
              enum: ["fullscreen", "informational", "quad", "scatter", "builder", "skylight"],
            },
            screensaverTransition: {
              type: "string",
              enum: ["fade", "slide-left", "slide-right", "slide-up", "slide-down", "zoom"],
            },
            screensaverLayoutConfig: { type: "object" },
          },
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        return reply.unauthorized("User not found");
      }

      const body = request.body as {
        name?: string;
        colorScheme?: string;
        screensaverEnabled?: boolean;
        screensaverTimeout?: number;
        screensaverInterval?: number;
        screensaverLayout?: string;
        screensaverTransition?: string;
        screensaverLayoutConfig?: Record<string, unknown>;
      };

      const [kiosk] = await fastify.db
        .insert(kiosks)
        .values({
          userId: user.id,
          name: body.name ?? "My Kiosk",
          colorScheme: (body.colorScheme as any) ?? "default",
          screensaverEnabled: body.screensaverEnabled ?? true,
          screensaverTimeout: body.screensaverTimeout ?? 300,
          screensaverInterval: body.screensaverInterval ?? 15,
          screensaverLayout: (body.screensaverLayout as any) ?? "builder",
          screensaverTransition: (body.screensaverTransition as any) ?? "fade",
          screensaverLayoutConfig: body.screensaverLayoutConfig ?? null,
        })
        .returning();

      // Sync to cloud if connected
      fastify.cloudRelay?.syncKiosks();

      return reply.status(201).send({
        success: true,
        data: kiosk,
      });
    }
  );

  // Update a kiosk
  fastify.put(
    "/:id",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Update a kiosk",
        tags: ["Kiosks"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            isActive: { type: "boolean" },
            colorScheme: {
              type: "string",
              enum: ["default", "homio", "ocean", "forest", "sunset", "lavender"],
            },
            displayMode: {
              type: "string",
              enum: ["full", "screensaver-only", "calendar-only", "dashboard-only"],
            },
            displayType: {
              type: "string",
              enum: ["touch", "tv", "display"],
            },
            homePage: { type: "string" },
            selectedCalendarIds: {
              type: "array",
              items: { type: "string" },
              nullable: true,
            },
            enabledFeatures: {
              type: "object",
              properties: {
                calendar: { type: "boolean" },
                dashboard: { type: "boolean" },
                tasks: { type: "boolean" },
                photos: { type: "boolean" },
                spotify: { type: "boolean" },
                iptv: { type: "boolean" },
                cameras: { type: "boolean" },
                homeassistant: { type: "boolean" },
                map: { type: "boolean" },
                recipes: { type: "boolean" },
              },
              nullable: true,
            },
            screensaverEnabled: { type: "boolean" },
            screensaverTimeout: { type: "number", minimum: 30, maximum: 3600 },
            screensaverInterval: { type: "number", minimum: 3, maximum: 300 },
            screensaverLayout: {
              type: "string",
              enum: ["fullscreen", "informational", "quad", "scatter", "builder", "skylight"],
            },
            screensaverTransition: {
              type: "string",
              enum: ["fade", "slide-left", "slide-right", "slide-up", "slide-down", "zoom"],
            },
            screensaverLayoutConfig: { type: "object" },
            screensaverBehavior: { type: "string", enum: ["screensaver", "hide-toolbar"] },
            startFullscreen: { type: "boolean" },
          },
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        return reply.unauthorized("User not found");
      }
      const { id } = request.params as { id: string };

      const body = request.body as {
        name?: string;
        isActive?: boolean;
        colorScheme?: string;
        displayMode?: string;
        displayType?: string;
        homePage?: string;
        selectedCalendarIds?: string[] | null;
        enabledFeatures?: Record<string, boolean> | null;
        screensaverEnabled?: boolean;
        screensaverTimeout?: number;
        screensaverInterval?: number;
        screensaverLayout?: string;
        screensaverTransition?: string;
        screensaverLayoutConfig?: Record<string, unknown>;
        screensaverBehavior?: string;
        startFullscreen?: boolean;
      };

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (body.name !== undefined) updates.name = body.name;
      if (body.isActive !== undefined) updates.isActive = body.isActive;
      if (body.colorScheme !== undefined) updates.colorScheme = body.colorScheme;
      if (body.displayMode !== undefined) updates.displayMode = body.displayMode;
      if (body.displayType !== undefined) updates.displayType = body.displayType;
      if (body.homePage !== undefined) updates.homePage = body.homePage;
      if (body.selectedCalendarIds !== undefined) updates.selectedCalendarIds = body.selectedCalendarIds;
      if (body.enabledFeatures !== undefined) updates.enabledFeatures = body.enabledFeatures;
      if (body.screensaverEnabled !== undefined) updates.screensaverEnabled = body.screensaverEnabled;
      if (body.screensaverTimeout !== undefined) updates.screensaverTimeout = body.screensaverTimeout;
      if (body.screensaverInterval !== undefined) updates.screensaverInterval = body.screensaverInterval;
      if (body.screensaverLayout !== undefined) updates.screensaverLayout = body.screensaverLayout;
      if (body.screensaverTransition !== undefined) updates.screensaverTransition = body.screensaverTransition;
      if (body.screensaverLayoutConfig !== undefined) updates.screensaverLayoutConfig = body.screensaverLayoutConfig;
      if (body.screensaverBehavior !== undefined) updates.screensaverBehavior = body.screensaverBehavior;
      if (body.startFullscreen !== undefined) updates.startFullscreen = body.startFullscreen;

      const [kiosk] = await fastify.db
        .update(kiosks)
        .set(updates)
        .where(and(eq(kiosks.id, id), eq(kiosks.userId, user.id)))
        .returning();

      if (!kiosk) {
        return reply.notFound("Kiosk not found");
      }

      // Sync to cloud if connected
      fastify.cloudRelay?.syncKiosks();

      return {
        success: true,
        data: kiosk,
      };
    }
  );

  // Delete a kiosk
  fastify.delete(
    "/:id",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Delete a kiosk",
        tags: ["Kiosks"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        return reply.unauthorized("User not found");
      }
      const { id } = request.params as { id: string };

      const result = await fastify.db
        .delete(kiosks)
        .where(and(eq(kiosks.id, id), eq(kiosks.userId, user.id)));

      if (!result) {
        return reply.notFound("Kiosk not found");
      }

      // Sync to cloud if connected
      fastify.cloudRelay?.syncKiosks();

      return { success: true };
    }
  );

  // Regenerate token (invalidates old URL)
  fastify.post(
    "/:id/regenerate-token",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Regenerate the kiosk token (invalidates the old URL)",
        tags: ["Kiosks"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        return reply.unauthorized("User not found");
      }
      const { id } = request.params as { id: string };

      const newToken = randomUUID();

      const [kiosk] = await fastify.db
        .update(kiosks)
        .set({ token: newToken, updatedAt: new Date() })
        .where(and(eq(kiosks.id, id), eq(kiosks.userId, user.id)))
        .returning();

      if (!kiosk) {
        return reply.notFound("Kiosk not found");
      }

      return {
        success: true,
        data: kiosk,
      };
    }
  );

  // Send refresh command to a kiosk (shorthand for command with type: "refresh")
  fastify.post(
    "/:id/refresh",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Send a refresh command to a kiosk",
        tags: ["Kiosks"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        return reply.unauthorized("User not found");
      }
      const { id } = request.params as { id: string };

      // Verify ownership
      const [kiosk] = await fastify.db
        .select()
        .from(kiosks)
        .where(and(eq(kiosks.id, id), eq(kiosks.userId, user.id)))
        .limit(1);

      if (!kiosk) {
        return reply.notFound("Kiosk not found");
      }

      // Add refresh command for this kiosk
      const existingCommands = kioskCommands.get(id) ?? [];
      existingCommands.push({
        type: "refresh",
        timestamp: Date.now(),
      });
      kioskCommands.set(id, existingCommands);

      fastify.log.info(`Kiosk refresh triggered for kiosk ${id}`);

      return { success: true };
    }
  );

  // Send a command to a kiosk (generic command endpoint)
  fastify.post(
    "/:id/command",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Send a command to a kiosk for remote control",
        tags: ["Kiosks"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          required: ["type"],
          properties: {
            type: {
              type: "string",
              enum: VALID_COMMAND_TYPES,
              description: "The command type to send",
            },
            payload: {
              type: "object",
              additionalProperties: true,
              description: "Optional payload data for the command",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        return reply.unauthorized("User not found");
      }
      const { id } = request.params as { id: string };
      const { type, payload } = request.body as {
        type: KioskCommandType;
        payload?: Record<string, unknown>;
      };

      // Verify ownership
      const [kiosk] = await fastify.db
        .select()
        .from(kiosks)
        .where(and(eq(kiosks.id, id), eq(kiosks.userId, user.id)))
        .limit(1);

      if (!kiosk) {
        return reply.notFound("Kiosk not found");
      }

      // Add command for this kiosk
      const existingCommands = kioskCommands.get(id) ?? [];
      existingCommands.push({
        type,
        payload,
        timestamp: Date.now(),
      });
      kioskCommands.set(id, existingCommands);

      fastify.log.info(`Kiosk command '${type}' sent to kiosk ${id}`);

      return { success: true };
    }
  );

  // ========== PUBLIC ENDPOINTS (accessed by token, no auth) ==========

  // Get kiosk config by token
  fastify.get(
    "/public/:token",
    {
      schema: {
        description: "Get kiosk configuration by token (public, no auth required)",
        tags: ["Kiosks", "Public"],
        params: {
          type: "object",
          properties: {
            token: { type: "string", format: "uuid" },
          },
          required: ["token"],
        },
      },
    },
    async (request, reply) => {
      const { token } = request.params as { token: string };

      const [kiosk] = await fastify.db
        .select()
        .from(kiosks)
        .where(eq(kiosks.token, token))
        .limit(1);

      if (!kiosk) {
        return reply.notFound("Kiosk not found");
      }

      if (!kiosk.isActive) {
        return reply.forbidden("Kiosk is disabled");
      }

      // Update last accessed time
      await fastify.db
        .update(kiosks)
        .set({ lastAccessedAt: new Date() })
        .where(eq(kiosks.id, kiosk.id));

      // Return config without sensitive data (userId, id)
      return {
        success: true,
        data: {
          name: kiosk.name,
          colorScheme: kiosk.colorScheme,
          displayMode: kiosk.displayMode,
          displayType: kiosk.displayType,
          homePage: kiosk.homePage,
          selectedCalendarIds: kiosk.selectedCalendarIds,
          enabledFeatures: kiosk.enabledFeatures,
          screensaverEnabled: kiosk.screensaverEnabled,
          screensaverTimeout: kiosk.screensaverTimeout,
          screensaverInterval: kiosk.screensaverInterval,
          screensaverLayout: kiosk.screensaverLayout,
          screensaverTransition: kiosk.screensaverTransition,
          screensaverLayoutConfig: kiosk.screensaverLayoutConfig,
        },
      };
    }
  );

  // Poll for commands by token
  fastify.get(
    "/public/:token/commands",
    {
      schema: {
        description: "Poll for kiosk commands (public, no auth required)",
        tags: ["Kiosks", "Public"],
        params: {
          type: "object",
          properties: {
            token: { type: "string", format: "uuid" },
          },
          required: ["token"],
        },
        querystring: {
          type: "object",
          properties: {
            since: { type: "number", description: "Timestamp to get commands since" },
          },
        },
      },
    },
    async (request, reply) => {
      const { token } = request.params as { token: string };
      const { since } = request.query as { since?: number };
      const sinceTimestamp = since ?? 0;

      const [kiosk] = await fastify.db
        .select()
        .from(kiosks)
        .where(eq(kiosks.token, token))
        .limit(1);

      if (!kiosk) {
        return reply.notFound("Kiosk not found");
      }

      if (!kiosk.isActive) {
        return reply.forbidden("Kiosk is disabled");
      }

      // Get commands for this kiosk newer than 'since' timestamp
      const commands = kioskCommands.get(kiosk.id) ?? [];
      const newCommands = commands.filter((cmd) => cmd.timestamp > sinceTimestamp);

      // Check if fast poll is active for this kiosk
      const fastPollExpiry = kioskFastPoll.get(kiosk.id);
      const fastPoll = fastPollExpiry ? Date.now() < fastPollExpiry : false;

      return {
        success: true,
        data: { commands: newCommands, fastPoll },
      };
    }
  );

  // Report widget state from kiosk (public, token-based)
  fastify.put(
    "/public/:token/widget-state",
    {
      schema: {
        description: "Report widget state from kiosk (public, no auth required)",
        tags: ["Kiosks", "Public"],
        params: {
          type: "object",
          properties: {
            token: { type: "string", format: "uuid" },
          },
          required: ["token"],
        },
        body: {
          type: "object",
          required: ["states"],
          properties: {
            states: {
              type: "array",
              items: {
                type: "object",
                required: ["widgetId", "widgetType", "state"],
                properties: {
                  widgetId: { type: "string" },
                  widgetType: { type: "string" },
                  state: { type: "object", additionalProperties: true },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { token } = request.params as { token: string };
      const { states } = request.body as {
        states: Array<{ widgetId: string; widgetType: string; state: Record<string, unknown> }>;
      };

      const [kiosk] = await fastify.db
        .select()
        .from(kiosks)
        .where(eq(kiosks.token, token))
        .limit(1);

      if (!kiosk) {
        return reply.notFound("Kiosk not found");
      }

      if (!kiosk.isActive) {
        return reply.forbidden("Kiosk is disabled");
      }

      // Upsert widget states for this kiosk
      let stateMap = kioskWidgetState.get(kiosk.id);
      if (!stateMap) {
        stateMap = new Map();
        kioskWidgetState.set(kiosk.id, stateMap);
      }

      const now = Date.now();
      for (const s of states) {
        stateMap.set(s.widgetId, {
          widgetId: s.widgetId,
          widgetType: s.widgetType,
          state: s.state,
          updatedAt: now,
        });
      }

      return { success: true };
    }
  );

  // Get widget state for a kiosk (authenticated, for companion app)
  fastify.get(
    "/:id/widget-state",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Get widget state for a kiosk (for companion app)",
        tags: ["Kiosks"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        return reply.unauthorized("User not found");
      }
      const { id } = request.params as { id: string };

      // Verify ownership
      const [kiosk] = await fastify.db
        .select()
        .from(kiosks)
        .where(and(eq(kiosks.id, id), eq(kiosks.userId, user.id)))
        .limit(1);

      if (!kiosk) {
        return reply.notFound("Kiosk not found");
      }

      const stateMap = kioskWidgetState.get(id);
      const states = stateMap ? Array.from(stateMap.values()) : [];

      return {
        success: true,
        data: states,
      };
    }
  );

  // Companion ping - activates fast polling on the kiosk
  fastify.post(
    "/:id/companion-ping",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Signal that a companion app is active, enabling fast polling on the kiosk",
        tags: ["Kiosks"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        return reply.unauthorized("User not found");
      }
      const { id } = request.params as { id: string };

      // Verify ownership
      const [kiosk] = await fastify.db
        .select()
        .from(kiosks)
        .where(and(eq(kiosks.id, id), eq(kiosks.userId, user.id)))
        .limit(1);

      if (!kiosk) {
        return reply.notFound("Kiosk not found");
      }

      // Set fast poll for 60 seconds
      kioskFastPoll.set(id, Date.now() + 60000);

      return { success: true };
    }
  );

  // Get photos for a kiosk by token
  fastify.get(
    "/public/:token/photos",
    {
      schema: {
        description: "Get photos for kiosk slideshow (public, no auth required)",
        tags: ["Kiosks", "Public"],
        params: {
          type: "object",
          properties: {
            token: { type: "string", format: "uuid" },
          },
          required: ["token"],
        },
        querystring: {
          type: "object",
          properties: {
            albumId: { type: "string", format: "uuid" },
            orientation: { type: "string", enum: ["all", "landscape", "portrait"] },
          },
        },
      },
    },
    async (request, reply) => {
      const { token } = request.params as { token: string };
      const { albumId, orientation } = request.query as {
        albumId?: string;
        orientation?: "all" | "landscape" | "portrait";
      };

      const [kiosk] = await fastify.db
        .select()
        .from(kiosks)
        .where(eq(kiosks.token, token))
        .limit(1);

      if (!kiosk) {
        return reply.notFound("Kiosk not found");
      }

      if (!kiosk.isActive) {
        return reply.forbidden("Kiosk is disabled");
      }

      // Get active albums for this user
      let albumsQuery = fastify.db
        .select()
        .from(photoAlbums)
        .where(
          and(
            eq(photoAlbums.userId, kiosk.userId),
            eq(photoAlbums.isActive, true)
          )
        );

      if (albumId) {
        albumsQuery = fastify.db
          .select()
          .from(photoAlbums)
          .where(
            and(
              eq(photoAlbums.id, albumId),
              eq(photoAlbums.userId, kiosk.userId),
              eq(photoAlbums.isActive, true)
            )
          );
      }

      const albums = await albumsQuery;

      if (albums.length === 0) {
        return {
          success: true,
          data: {
            photos: [],
            interval: kiosk.screensaverInterval,
          },
        };
      }

      // Get photos from all active albums
      const allPhotos: Array<{
        id: string;
        url: string;
        width?: number | null;
        height?: number | null;
      }> = [];

      for (const album of albums) {
        const albumPhotos = await fastify.db
          .select()
          .from(photos)
          .where(eq(photos.albumId, album.id));

        for (const photo of albumPhotos) {
          // Filter by orientation if specified
          if (orientation && orientation !== "all" && photo.width && photo.height) {
            const isLandscape = photo.width > photo.height;
            if (orientation === "landscape" && !isLandscape) continue;
            if (orientation === "portrait" && isLandscape) continue;
          }

          allPhotos.push({
            id: photo.id,
            url: `/api/v1/photos/files/${(photo.mediumPath ?? photo.originalPath).replace(/\\/g, "/")}`,
            width: photo.width,
            height: photo.height,
          });
        }
      }

      // Shuffle photos
      for (let i = allPhotos.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allPhotos[i], allPhotos[j]] = [allPhotos[j]!, allPhotos[i]!];
      }

      return {
        success: true,
        data: {
          photos: allPhotos,
          interval: kiosk.screensaverInterval,
        },
      };
    }
  );

  // Get events for a kiosk by token
  fastify.get(
    "/public/:token/events",
    {
      schema: {
        description: "Get calendar events for kiosk (public, no auth required)",
        tags: ["Kiosks", "Public"],
        params: {
          type: "object",
          properties: {
            token: { type: "string", format: "uuid" },
          },
          required: ["token"],
        },
        querystring: {
          type: "object",
          properties: {
            start: { type: "string", format: "date-time" },
            end: { type: "string", format: "date-time" },
          },
        },
      },
    },
    async (request, reply) => {
      const { token } = request.params as { token: string };
      const { start, end } = request.query as { start?: string; end?: string };

      const [kiosk] = await fastify.db
        .select()
        .from(kiosks)
        .where(eq(kiosks.token, token))
        .limit(1);

      if (!kiosk) {
        return reply.notFound("Kiosk not found");
      }

      if (!kiosk.isActive) {
        return reply.forbidden("Kiosk is disabled");
      }

      // Get visible calendars
      const userCalendars = await fastify.db
        .select()
        .from(calendars)
        .where(
          and(
            eq(calendars.userId, kiosk.userId),
            eq(calendars.isVisible, true)
          )
        );

      // Filter calendars based on kiosk-specific selection or screensaver visibility
      let filteredCalendars = userCalendars;

      if (kiosk.selectedCalendarIds && kiosk.selectedCalendarIds.length > 0) {
        // Use kiosk-specific calendar selection
        filteredCalendars = userCalendars.filter((cal) =>
          kiosk.selectedCalendarIds!.includes(cal.id)
        );
      } else {
        // Fall back to screensaver visibility setting
        filteredCalendars = userCalendars.filter((cal) => {
          const visibility = cal.visibility as { screensaver?: boolean } | null;
          return visibility?.screensaver === true;
        });
      }

      if (filteredCalendars.length === 0) {
        return {
          success: true,
          data: [],
        };
      }

      // Get events from those calendars
      const calendarIds = filteredCalendars.map((c) => c.id);
      const now = new Date();
      const startDate = start ? new Date(start) : now;
      const endDate = end ? new Date(end) : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const allEvents = await fastify.db
        .select()
        .from(events)
        .where(
          and(
            // Filter by calendar IDs - note: drizzle doesn't have an in() helper for this case
            // so we'll filter in JS
          )
        );

      const filteredEvents = allEvents.filter((event) => {
        if (!calendarIds.includes(event.calendarId)) return false;
        const eventStart = new Date(event.startTime);
        const eventEnd = new Date(event.endTime);
        return eventEnd >= startDate && eventStart <= endDate;
      });

      // Return events without sensitive data
      return {
        success: true,
        data: filteredEvents.map((event) => ({
          id: event.id,
          title: event.title,
          description: event.description,
          location: event.location,
          startTime: event.startTime,
          endTime: event.endTime,
          isAllDay: event.isAllDay,
          status: event.status,
        })),
      };
    }
  );

  // Exchange kiosk token for API key (allows full app access)
  fastify.post(
    "/public/:token/auth",
    {
      schema: {
        description: "Exchange kiosk token for an API key to enable full app access",
        tags: ["Kiosks", "Public"],
        params: {
          type: "object",
          properties: {
            token: { type: "string", format: "uuid" },
          },
          required: ["token"],
        },
      },
    },
    async (request, reply) => {
      const { token } = request.params as { token: string };

      const [kiosk] = await fastify.db
        .select()
        .from(kiosks)
        .where(eq(kiosks.token, token))
        .limit(1);

      if (!kiosk) {
        return reply.notFound("Kiosk not found");
      }

      if (!kiosk.isActive) {
        return reply.forbidden("Kiosk is disabled");
      }

      // Generate a session token for this kiosk
      // This is a simple approach - the token is the kiosk token itself
      // The API key header will be checked against kiosk tokens
      return {
        success: true,
        data: {
          apiKey: `kiosk_${token}`,
          userId: kiosk.userId,
        },
      };
    }
  );

  // Get weather for a kiosk by token
  fastify.get(
    "/public/:token/weather",
    {
      schema: {
        description: "Get weather data for kiosk (public, no auth required)",
        tags: ["Kiosks", "Public"],
        params: {
          type: "object",
          properties: {
            token: { type: "string", format: "uuid" },
          },
          required: ["token"],
        },
      },
    },
    async (request, reply) => {
      const { token } = request.params as { token: string };

      const [kiosk] = await fastify.db
        .select()
        .from(kiosks)
        .where(eq(kiosks.token, token))
        .limit(1);

      if (!kiosk) {
        return reply.notFound("Kiosk not found");
      }

      if (!kiosk.isActive) {
        return reply.forbidden("Kiosk is disabled");
      }

      // Weather is fetched from the weather service using system settings
      // Redirect to the weather endpoint with the kiosk user context
      // For now, return a placeholder - the frontend can call the weather API directly
      // since weather doesn't require user-specific data beyond location settings
      return {
        success: true,
        data: {
          message: "Use /api/v1/weather endpoints for weather data",
        },
      };
    }
  );

  // Generate upload token for kiosk photo uploads
  fastify.post(
    "/public/:token/upload-token",
    {
      schema: {
        description: "Generate an upload token for mobile photo uploads via kiosk QR code",
        tags: ["Kiosks", "Public"],
        params: {
          type: "object",
          properties: {
            token: { type: "string", format: "uuid" },
          },
          required: ["token"],
        },
      },
    },
    async (request, reply) => {
      const { token } = request.params as { token: string };

      const [kiosk] = await fastify.db
        .select()
        .from(kiosks)
        .where(eq(kiosks.token, token))
        .limit(1);

      if (!kiosk) {
        return reply.notFound("Kiosk not found");
      }

      if (!kiosk.isActive) {
        return reply.forbidden("Kiosk is disabled");
      }

      // Find or create "Kiosk Uploads" album for this user
      const KIOSK_ALBUM_NAME = "Kiosk Uploads";
      let [album] = await fastify.db
        .select()
        .from(photoAlbums)
        .where(
          and(
            eq(photoAlbums.userId, kiosk.userId),
            eq(photoAlbums.name, KIOSK_ALBUM_NAME)
          )
        )
        .limit(1);

      // Create the album if it doesn't exist
      if (!album) {
        [album] = await fastify.db
          .insert(photoAlbums)
          .values({
            userId: kiosk.userId,
            name: KIOSK_ALBUM_NAME,
            description: "Photos uploaded via kiosk QR code",
            isActive: true,
          })
          .returning();
      }

      if (!album) {
        return reply.internalServerError("Failed to create upload album");
      }

      // Generate upload token (valid for 30 minutes)
      // Use the shared uploadTokens Map from the photos routes
      const uploadToken = randomUUID();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);

      // Upload tokens Map is shared across routes (initialized in app.ts via decorate)
      fastify.uploadTokens.set(uploadToken, {
        userId: kiosk.userId,
        albumId: album.id,
        createdAt: now,
        expiresAt,
      });

      // Build full upload URL - prefer configured external URL, fall back to request host
      let baseUrl = await getSystemSetting(fastify.db, "server", "external_url");
      if (!baseUrl) {
        // Use X-Forwarded-Host if behind a proxy (like vite dev server), otherwise use Host header
        const forwardedHost = request.headers["x-forwarded-host"];
        const host = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost)
          || request.headers.host
          || request.headers[":authority"]
          || "localhost:3000";
        const protocol = request.headers["x-forwarded-proto"] || (request.protocol ?? "http");
        baseUrl = `${protocol}://${host}`;
      }
      // Remove trailing slash if present
      baseUrl = baseUrl.replace(/\/$/, "");
      const uploadUrl = `${baseUrl}/upload/${uploadToken}`;

      return {
        success: true,
        data: {
          token: uploadToken,
          expiresAt: expiresAt.toISOString(),
          albumName: album.name,
          uploadUrl,
        },
      };
    }
  );
};
