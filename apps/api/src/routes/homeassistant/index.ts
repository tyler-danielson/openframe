import type { FastifyPluginAsync } from "fastify";
import { eq, and, asc, isNull, lte } from "drizzle-orm";
import { networkInterfaces } from "os";
import {
  homeAssistantConfig,
  homeAssistantEntities,
  homeAssistantRooms,
  haEntityTimers,
} from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";

// Helper to check if a URL is a Home Assistant instance
async function checkHomeAssistant(url: string, timeout = 2000): Promise<{ url: string; name?: string } | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`${url}/api/`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    // HA returns 401 for unauthenticated requests to /api/, which confirms it's HA
    if (response.status === 401 || response.status === 200) {
      return { url };
    }
    return null;
  } catch {
    return null;
  }
}

// Get local network info
function getLocalNetworkPrefixes(): string[] {
  const prefixes: string[] = [];
  const interfaces = networkInterfaces();

  for (const name in interfaces) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        // Extract network prefix (e.g., 192.168.1)
        const parts = iface.address.split(".");
        if (parts.length === 4) {
          prefixes.push(`${parts[0]}.${parts[1]}.${parts[2]}`);
        }
      }
    }
  }

  return [...new Set(prefixes)];
}

interface HAEntityState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

async function fetchFromHA(
  url: string,
  token: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const baseUrl = url.replace(/\/+$/, "");
  return fetch(`${baseUrl}/api${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

export const homeAssistantRoutes: FastifyPluginAsync = async (fastify) => {
  // ==================== DISCOVERY ====================

  // Discover Home Assistant instances on the network (public - doesn't access user data)
  fastify.get(
    "/discover",
    {
      schema: {
        description: "Discover Home Assistant instances on the local network",
        tags: ["Home Assistant"],
      },
    },
    async (request, reply) => {
      const discovered: { url: string; source: string }[] = [];

      // 1. Try homeassistant.local (mDNS default)
      const mdnsResult = await checkHomeAssistant("http://homeassistant.local:8123");
      if (mdnsResult) {
        discovered.push({ url: mdnsResult.url, source: "mDNS" });
      }

      // 2. Try homeassistant:8123 (Docker/hostname)
      const hostnameResult = await checkHomeAssistant("http://homeassistant:8123");
      if (hostnameResult && !discovered.some(d => d.url === hostnameResult.url)) {
        discovered.push({ url: hostnameResult.url, source: "hostname" });
      }

      // 3. Scan local network for common IPs
      const prefixes = getLocalNetworkPrefixes();
      const commonSuffixes = [1, 2, 100, 101, 102, 150, 200, 254]; // Common router/device IPs

      const scanPromises: Promise<{ url: string; source: string } | null>[] = [];

      for (const prefix of prefixes) {
        for (const suffix of commonSuffixes) {
          const ip = `${prefix}.${suffix}`;
          scanPromises.push(
            checkHomeAssistant(`http://${ip}:8123`).then(result =>
              result ? { url: result.url, source: "network scan" } : null
            )
          );
        }
      }

      // Wait for all scans (with timeout)
      const scanResults = await Promise.all(scanPromises);
      for (const result of scanResults) {
        if (result && !discovered.some(d => d.url === result.url)) {
          discovered.push(result);
        }
      }

      return {
        success: true,
        data: discovered,
      };
    }
  );

  // ==================== CONFIG ====================

  // Get HA config
  fastify.get(
    "/config",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get Home Assistant configuration",
        tags: ["Home Assistant"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);

      const [config] = await fastify.db
        .select()
        .from(homeAssistantConfig)
        .where(eq(homeAssistantConfig.userId, user.id))
        .limit(1);

      if (!config) {
        return {
          success: true,
          data: null,
        };
      }

      return {
        success: true,
        data: {
          id: config.id,
          userId: config.userId,
          url: config.url,
          isConnected: config.isConnected,
          lastConnectedAt: config.lastConnectedAt,
          createdAt: config.createdAt,
          updatedAt: config.updatedAt,
        },
      };
    }
  );

  // Get HA WebSocket config (includes accessToken for direct WebSocket connection)
  fastify.get(
    "/config/websocket",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get Home Assistant WebSocket configuration (includes access token)",
        tags: ["Home Assistant"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);

      const [config] = await fastify.db
        .select()
        .from(homeAssistantConfig)
        .where(eq(homeAssistantConfig.userId, user.id))
        .limit(1);

      if (!config) {
        return {
          success: true,
          data: null,
        };
      }

      return {
        success: true,
        data: {
          url: config.url,
          accessToken: config.accessToken,
        },
      };
    }
  );

  // Save/update HA config
  fastify.post(
    "/config",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Save Home Assistant configuration",
        tags: ["Home Assistant"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            url: { type: "string" },
            accessToken: { type: "string" },
          },
          required: ["url", "accessToken"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      const { url, accessToken } = request.body as {
        url: string;
        accessToken: string;
      };

      // Test connection
      try {
        const response = await fetchFromHA(url, accessToken, "/");
        if (!response.ok) {
          return reply.badRequest("Failed to connect to Home Assistant. Check URL and token.");
        }
      } catch (error) {
        console.error("HA connection test failed:", error);
        return reply.badRequest("Failed to connect to Home Assistant. Check URL and network.");
      }

      // Check if config exists
      const [existing] = await fastify.db
        .select()
        .from(homeAssistantConfig)
        .where(eq(homeAssistantConfig.userId, user.id))
        .limit(1);

      let config;
      if (existing) {
        [config] = await fastify.db
          .update(homeAssistantConfig)
          .set({
            url,
            accessToken,
            isConnected: true,
            lastConnectedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(homeAssistantConfig.id, existing.id))
          .returning();
      } else {
        [config] = await fastify.db
          .insert(homeAssistantConfig)
          .values({
            userId: user.id,
            url,
            accessToken,
            isConnected: true,
            lastConnectedAt: new Date(),
          })
          .returning();
      }

      return {
        success: true,
        data: {
          id: config!.id,
          userId: config!.userId,
          url: config!.url,
          isConnected: config!.isConnected,
          lastConnectedAt: config!.lastConnectedAt,
          createdAt: config!.createdAt,
          updatedAt: config!.updatedAt,
        },
      };
    }
  );

  // Delete HA config
  fastify.delete(
    "/config",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Delete Home Assistant configuration",
        tags: ["Home Assistant"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);

      await fastify.db
        .delete(homeAssistantConfig)
        .where(eq(homeAssistantConfig.userId, user.id));

      // Also delete selected entities
      await fastify.db
        .delete(homeAssistantEntities)
        .where(eq(homeAssistantEntities.userId, user.id));

      return { success: true };
    }
  );

  // ==================== ROOMS ====================

  // Get all rooms
  fastify.get(
    "/rooms",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get all Home Assistant rooms",
        tags: ["Home Assistant"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);

      const rooms = await fastify.db
        .select()
        .from(homeAssistantRooms)
        .where(eq(homeAssistantRooms.userId, user.id))
        .orderBy(asc(homeAssistantRooms.sortOrder));

      return {
        success: true,
        data: rooms,
      };
    }
  );

  // Create a room
  fastify.post(
    "/rooms",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Create a Home Assistant room",
        tags: ["Home Assistant"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            temperatureSensorId: { type: "string" },
            humiditySensorId: { type: "string" },
            windowSensorId: { type: "string" },
          },
          required: ["name"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      const body = request.body as {
        name: string;
        temperatureSensorId?: string;
        humiditySensorId?: string;
        windowSensorId?: string;
      };

      // Get max sort order
      const allRooms = await fastify.db
        .select({ sortOrder: homeAssistantRooms.sortOrder })
        .from(homeAssistantRooms)
        .where(eq(homeAssistantRooms.userId, user.id));
      const maxOrder = Math.max(0, ...allRooms.map((r) => r.sortOrder));

      const [room] = await fastify.db
        .insert(homeAssistantRooms)
        .values({
          userId: user.id,
          name: body.name,
          sortOrder: maxOrder + 1,
          temperatureSensorId: body.temperatureSensorId || null,
          humiditySensorId: body.humiditySensorId || null,
          windowSensorId: body.windowSensorId || null,
        })
        .returning();

      return reply.status(201).send({
        success: true,
        data: room,
      });
    }
  );

  // Update a room
  fastify.patch(
    "/rooms/:id",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Update a Home Assistant room",
        tags: ["Home Assistant"],
        security: [{ bearerAuth: [] }],
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
      const { id } = request.params as { id: string };
      const body = request.body as {
        name?: string;
        sortOrder?: number;
        temperatureSensorId?: string | null;
        humiditySensorId?: string | null;
        windowSensorId?: string | null;
      };

      const [existing] = await fastify.db
        .select()
        .from(homeAssistantRooms)
        .where(
          and(
            eq(homeAssistantRooms.id, id),
            eq(homeAssistantRooms.userId, user.id)
          )
        )
        .limit(1);

      if (!existing) {
        return reply.notFound("Room not found");
      }

      const updates: Record<string, unknown> = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;
      if (body.temperatureSensorId !== undefined) updates.temperatureSensorId = body.temperatureSensorId;
      if (body.humiditySensorId !== undefined) updates.humiditySensorId = body.humiditySensorId;
      if (body.windowSensorId !== undefined) updates.windowSensorId = body.windowSensorId;

      const [room] = await fastify.db
        .update(homeAssistantRooms)
        .set(updates)
        .where(eq(homeAssistantRooms.id, id))
        .returning();

      return {
        success: true,
        data: room,
      };
    }
  );

  // Delete a room
  fastify.delete(
    "/rooms/:id",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Delete a Home Assistant room",
        tags: ["Home Assistant"],
        security: [{ bearerAuth: [] }],
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
      const { id } = request.params as { id: string };

      const [room] = await fastify.db
        .select()
        .from(homeAssistantRooms)
        .where(
          and(
            eq(homeAssistantRooms.id, id),
            eq(homeAssistantRooms.userId, user.id)
          )
        )
        .limit(1);

      if (!room) {
        return reply.notFound("Room not found");
      }

      // Clear roomId from all entities in this room
      await fastify.db
        .update(homeAssistantEntities)
        .set({ roomId: null })
        .where(eq(homeAssistantEntities.roomId, id));

      await fastify.db
        .delete(homeAssistantRooms)
        .where(eq(homeAssistantRooms.id, id));

      return { success: true };
    }
  );

  // Reorder rooms
  fastify.post(
    "/rooms/reorder",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Reorder Home Assistant rooms",
        tags: ["Home Assistant"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            roomIds: {
              type: "array",
              items: { type: "string", format: "uuid" },
            },
          },
          required: ["roomIds"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      const { roomIds } = request.body as { roomIds: string[] };

      // Update sort order for each room
      for (let i = 0; i < roomIds.length; i++) {
        await fastify.db
          .update(homeAssistantRooms)
          .set({ sortOrder: i })
          .where(
            and(
              eq(homeAssistantRooms.id, roomIds[i]!),
              eq(homeAssistantRooms.userId, user.id)
            )
          );
      }

      return { success: true };
    }
  );

  // Assign entity to room
  fastify.patch(
    "/entities/:id/room",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Assign entity to a room",
        tags: ["Home Assistant"],
        security: [{ bearerAuth: [] }],
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
            roomId: { type: "string", format: "uuid", nullable: true },
          },
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      const { id } = request.params as { id: string };
      const body = request.body as { roomId?: string | null };

      const [existing] = await fastify.db
        .select()
        .from(homeAssistantEntities)
        .where(
          and(
            eq(homeAssistantEntities.id, id),
            eq(homeAssistantEntities.userId, user.id)
          )
        )
        .limit(1);

      if (!existing) {
        return reply.notFound("Entity not found");
      }

      // Verify room exists if roomId is provided
      if (body.roomId) {
        const [room] = await fastify.db
          .select()
          .from(homeAssistantRooms)
          .where(
            and(
              eq(homeAssistantRooms.id, body.roomId),
              eq(homeAssistantRooms.userId, user.id)
            )
          )
          .limit(1);

        if (!room) {
          return reply.notFound("Room not found");
        }
      }

      const [entity] = await fastify.db
        .update(homeAssistantEntities)
        .set({ roomId: body.roomId ?? null })
        .where(eq(homeAssistantEntities.id, id))
        .returning();

      return {
        success: true,
        data: entity,
      };
    }
  );

  // ==================== ENTITIES FROM HA ====================

  // Get all entities from Home Assistant
  fastify.get(
    "/states",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get all entity states from Home Assistant",
        tags: ["Home Assistant"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);

      const [config] = await fastify.db
        .select()
        .from(homeAssistantConfig)
        .where(eq(homeAssistantConfig.userId, user.id))
        .limit(1);

      if (!config) {
        return reply.badRequest("Home Assistant not configured");
      }

      try {
        const response = await fetchFromHA(config.url, config.accessToken, "/states");
        if (!response.ok) {
          return reply.internalServerError("Failed to fetch states from Home Assistant");
        }

        const states = await response.json() as HAEntityState[];
        return {
          success: true,
          data: states,
        };
      } catch (error) {
        console.error("Failed to fetch HA states:", error);
        return reply.internalServerError("Failed to connect to Home Assistant");
      }
    }
  );

  // Get single entity state
  fastify.get(
    "/states/:entityId",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get single entity state from Home Assistant",
        tags: ["Home Assistant"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: {
            entityId: { type: "string" },
          },
          required: ["entityId"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      const { entityId } = request.params as { entityId: string };

      const [config] = await fastify.db
        .select()
        .from(homeAssistantConfig)
        .where(eq(homeAssistantConfig.userId, user.id))
        .limit(1);

      if (!config) {
        return reply.badRequest("Home Assistant not configured");
      }

      try {
        const response = await fetchFromHA(
          config.url,
          config.accessToken,
          `/states/${entityId}`
        );
        if (!response.ok) {
          return reply.notFound("Entity not found");
        }

        const state = await response.json() as HAEntityState;
        return {
          success: true,
          data: state,
        };
      } catch (error) {
        console.error("Failed to fetch HA state:", error);
        return reply.internalServerError("Failed to connect to Home Assistant");
      }
    }
  );

  // Get locations (device_tracker and person entities with lat/long)
  fastify.get(
    "/locations",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get device tracker and person locations from Home Assistant",
        tags: ["Home Assistant"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);

      const [config] = await fastify.db
        .select()
        .from(homeAssistantConfig)
        .where(eq(homeAssistantConfig.userId, user.id))
        .limit(1);

      if (!config) {
        return reply.badRequest("Home Assistant not configured");
      }

      try {
        const response = await fetchFromHA(config.url, config.accessToken, "/states");
        if (!response.ok) {
          return reply.internalServerError("Failed to fetch states from Home Assistant");
        }

        const states = await response.json() as HAEntityState[];

        // Filter for device_tracker and person entities with valid coordinates
        const locationEntities = states.filter((state) => {
          const domain = state.entity_id.split(".")[0];
          if (domain !== "device_tracker" && domain !== "person") {
            return false;
          }

          // Must have valid latitude and longitude
          const lat = state.attributes.latitude as number | undefined;
          const lon = state.attributes.longitude as number | undefined;
          return typeof lat === "number" && typeof lon === "number" &&
                 !isNaN(lat) && !isNaN(lon);
        });

        // Transform to location objects
        const locations = locationEntities.map((state) => ({
          entityId: state.entity_id,
          name: (state.attributes.friendly_name as string) || state.entity_id,
          latitude: state.attributes.latitude as number,
          longitude: state.attributes.longitude as number,
          state: state.state, // home, not_home, zone name, etc.
          icon: state.attributes.icon as string | undefined,
          entityPictureUrl: state.attributes.entity_picture as string | undefined,
          gpsAccuracy: state.attributes.gps_accuracy as number | undefined,
          lastUpdated: state.last_updated,
          source: state.attributes.source as string | undefined,
          batteryLevel: state.attributes.battery_level as number | undefined,
        }));

        return {
          success: true,
          data: locations,
        };
      } catch (error) {
        console.error("Failed to fetch HA locations:", error);
        return reply.internalServerError("Failed to connect to Home Assistant");
      }
    }
  );

  // Get zones (for map display)
  fastify.get(
    "/zones",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get zones from Home Assistant",
        tags: ["Home Assistant"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);

      const [config] = await fastify.db
        .select()
        .from(homeAssistantConfig)
        .where(eq(homeAssistantConfig.userId, user.id))
        .limit(1);

      if (!config) {
        return reply.badRequest("Home Assistant not configured");
      }

      try {
        const response = await fetchFromHA(config.url, config.accessToken, "/states");
        if (!response.ok) {
          return reply.internalServerError("Failed to fetch states from Home Assistant");
        }

        const states = await response.json() as HAEntityState[];

        // Filter for zone entities
        const zoneEntities = states.filter((state) => {
          return state.entity_id.startsWith("zone.");
        });

        // Transform to zone objects
        const zones = zoneEntities.map((state) => ({
          entityId: state.entity_id,
          name: (state.attributes.friendly_name as string) || state.entity_id.replace("zone.", ""),
          latitude: state.attributes.latitude as number,
          longitude: state.attributes.longitude as number,
          radius: state.attributes.radius as number || 100,
          icon: state.attributes.icon as string | undefined,
          isPassive: state.attributes.passive as boolean | undefined,
        }));

        return {
          success: true,
          data: zones,
        };
      } catch (error) {
        console.error("Failed to fetch HA zones:", error);
        return reply.internalServerError("Failed to connect to Home Assistant");
      }
    }
  );

  // Call a service
  fastify.post(
    "/services/:domain/:service",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Call a Home Assistant service",
        tags: ["Home Assistant"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: {
            domain: { type: "string" },
            service: { type: "string" },
          },
          required: ["domain", "service"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      const { domain, service } = request.params as {
        domain: string;
        service: string;
      };
      const body = request.body as Record<string, unknown> | undefined;

      const [config] = await fastify.db
        .select()
        .from(homeAssistantConfig)
        .where(eq(homeAssistantConfig.userId, user.id))
        .limit(1);

      if (!config) {
        return reply.badRequest("Home Assistant not configured");
      }

      try {
        const response = await fetchFromHA(
          config.url,
          config.accessToken,
          `/services/${domain}/${service}`,
          {
            method: "POST",
            body: JSON.stringify(body || {}),
          }
        );

        if (!response.ok) {
          const error = await response.text();
          console.error("HA service call failed:", error);
          return reply.internalServerError("Service call failed");
        }

        const result = await response.json();
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        console.error("Failed to call HA service:", error);
        return reply.internalServerError("Failed to connect to Home Assistant");
      }
    }
  );

  // ==================== SELECTED ENTITIES ====================

  // Get selected entities (with optional room filter)
  fastify.get(
    "/entities",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get user's selected Home Assistant entities",
        tags: ["Home Assistant"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        querystring: {
          type: "object",
          properties: {
            roomId: { type: "string", format: "uuid" },
            unassigned: { type: "boolean" },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      const query = request.query as { roomId?: string; unassigned?: boolean };

      let whereClause;
      if (query.roomId) {
        whereClause = and(
          eq(homeAssistantEntities.userId, user.id),
          eq(homeAssistantEntities.roomId, query.roomId)
        );
      } else if (query.unassigned) {
        whereClause = and(
          eq(homeAssistantEntities.userId, user.id),
          isNull(homeAssistantEntities.roomId)
        );
      } else {
        whereClause = eq(homeAssistantEntities.userId, user.id);
      }

      const entities = await fastify.db
        .select()
        .from(homeAssistantEntities)
        .where(whereClause)
        .orderBy(asc(homeAssistantEntities.sortOrder));

      return {
        success: true,
        data: entities,
      };
    }
  );

  // Add entity to selection
  fastify.post(
    "/entities",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Add an entity to selection",
        tags: ["Home Assistant"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            entityId: { type: "string" },
            displayName: { type: "string" },
            showInDashboard: { type: "boolean" },
            settings: { type: "object" },
          },
          required: ["entityId"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      const body = request.body as {
        entityId: string;
        displayName?: string;
        showInDashboard?: boolean;
        settings?: Record<string, unknown>;
      };

      // Check if already added
      const [existing] = await fastify.db
        .select()
        .from(homeAssistantEntities)
        .where(
          and(
            eq(homeAssistantEntities.userId, user.id),
            eq(homeAssistantEntities.entityId, body.entityId)
          )
        )
        .limit(1);

      if (existing) {
        return reply.badRequest("Entity already added");
      }

      // Get max sort order
      const allEntities = await fastify.db
        .select({ sortOrder: homeAssistantEntities.sortOrder })
        .from(homeAssistantEntities)
        .where(eq(homeAssistantEntities.userId, user.id));
      const maxOrder = Math.max(0, ...allEntities.map((e) => e.sortOrder));

      const [entity] = await fastify.db
        .insert(homeAssistantEntities)
        .values({
          userId: user.id,
          entityId: body.entityId,
          displayName: body.displayName || null,
          showInDashboard: body.showInDashboard ?? false,
          settings: body.settings || {},
          sortOrder: maxOrder + 1,
        })
        .returning();

      return reply.status(201).send({
        success: true,
        data: entity,
      });
    }
  );

  // Update entity
  fastify.patch(
    "/entities/:id",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Update a selected entity",
        tags: ["Home Assistant"],
        security: [{ bearerAuth: [] }],
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
      const { id } = request.params as { id: string };
      const body = request.body as {
        displayName?: string | null;
        sortOrder?: number;
        showInDashboard?: boolean;
        settings?: Record<string, unknown>;
      };

      const [existing] = await fastify.db
        .select()
        .from(homeAssistantEntities)
        .where(
          and(
            eq(homeAssistantEntities.id, id),
            eq(homeAssistantEntities.userId, user.id)
          )
        )
        .limit(1);

      if (!existing) {
        return reply.notFound("Entity not found");
      }

      const updates: Record<string, unknown> = {};
      if (body.displayName !== undefined) updates.displayName = body.displayName;
      if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;
      if (body.showInDashboard !== undefined) updates.showInDashboard = body.showInDashboard;
      if (body.settings !== undefined) {
        updates.settings = { ...existing.settings, ...body.settings };
      }

      const [entity] = await fastify.db
        .update(homeAssistantEntities)
        .set(updates)
        .where(eq(homeAssistantEntities.id, id))
        .returning();

      return {
        success: true,
        data: entity,
      };
    }
  );

  // Remove entity from selection
  fastify.delete(
    "/entities/:id",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Remove an entity from selection",
        tags: ["Home Assistant"],
        security: [{ bearerAuth: [] }],
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
      const { id } = request.params as { id: string };

      const [entity] = await fastify.db
        .select()
        .from(homeAssistantEntities)
        .where(
          and(
            eq(homeAssistantEntities.id, id),
            eq(homeAssistantEntities.userId, user.id)
          )
        )
        .limit(1);

      if (!entity) {
        return reply.notFound("Entity not found");
      }

      await fastify.db
        .delete(homeAssistantEntities)
        .where(eq(homeAssistantEntities.id, id));

      return { success: true };
    }
  );

  // ==================== CAMERA PROXIES ====================

  // Proxy camera snapshot from Home Assistant
  fastify.get(
    "/camera/:entityId/snapshot",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Proxy camera snapshot from Home Assistant",
        tags: ["Home Assistant"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: {
            entityId: { type: "string" },
          },
          required: ["entityId"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      const { entityId } = request.params as { entityId: string };

      const [config] = await fastify.db
        .select()
        .from(homeAssistantConfig)
        .where(eq(homeAssistantConfig.userId, user.id))
        .limit(1);

      if (!config) {
        return reply.badRequest("Home Assistant not configured");
      }

      try {
        const response = await fetchFromHA(
          config.url,
          config.accessToken,
          `/camera_proxy/${entityId}`
        );

        if (!response.ok) {
          return reply.status(response.status).send("Failed to fetch camera snapshot");
        }

        const contentType = response.headers.get("content-type") ?? "image/jpeg";
        const buffer = await response.arrayBuffer();

        return reply
          .header("Content-Type", contentType)
          .header("Cache-Control", "no-cache, no-store, must-revalidate")
          .send(Buffer.from(buffer));
      } catch (error) {
        console.error("Failed to fetch HA camera snapshot:", error);
        return reply.internalServerError("Failed to fetch camera snapshot");
      }
    }
  );

  // Proxy camera MJPEG stream from Home Assistant
  fastify.get(
    "/camera/:entityId/stream",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Proxy camera MJPEG stream from Home Assistant",
        tags: ["Home Assistant"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: {
            entityId: { type: "string" },
          },
          required: ["entityId"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      const { entityId } = request.params as { entityId: string };

      const [config] = await fastify.db
        .select()
        .from(homeAssistantConfig)
        .where(eq(homeAssistantConfig.userId, user.id))
        .limit(1);

      if (!config) {
        return reply.badRequest("Home Assistant not configured");
      }

      try {
        const baseUrl = config.url.replace(/\/+$/, "");
        const response = await fetch(
          `${baseUrl}/api/camera_proxy_stream/${entityId}`,
          {
            headers: {
              Authorization: `Bearer ${config.accessToken}`,
            },
          }
        );

        if (!response.ok) {
          return reply.status(response.status).send("Failed to connect to camera stream");
        }

        const contentType = response.headers.get("content-type") ?? "multipart/x-mixed-replace";

        // Stream the response
        reply.raw.writeHead(200, {
          "Content-Type": contentType,
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Connection: "close",
        });

        // Pipe the stream
        if (response.body) {
          const reader = response.body.getReader();
          const pump = async () => {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                reply.raw.write(value);
              }
            } catch {
              // Stream closed
            } finally {
              reply.raw.end();
            }
          };
          pump();
        }
      } catch (error) {
        console.error("Failed to proxy HA camera stream:", error);
        return reply.internalServerError("Failed to connect to camera stream");
      }
    }
  );

  // Get enabled camera entities (configured by user in HA settings)
  fastify.get(
    "/cameras",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get user's enabled Home Assistant cameras with settings",
        tags: ["Home Assistant"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);

      const [config] = await fastify.db
        .select()
        .from(homeAssistantConfig)
        .where(eq(homeAssistantConfig.userId, user.id))
        .limit(1);

      if (!config) {
        return reply.badRequest("Home Assistant not configured");
      }

      // Get enabled camera entities from database
      const enabledCameras = await fastify.db
        .select()
        .from(homeAssistantEntities)
        .where(eq(homeAssistantEntities.userId, user.id))
        .orderBy(asc(homeAssistantEntities.sortOrder));

      // Filter to only camera entities
      const cameraEntities = enabledCameras.filter((e) =>
        e.entityId.startsWith("camera.")
      );

      if (cameraEntities.length === 0) {
        return { success: true, data: [] };
      }

      try {
        // Fetch current states from HA
        const response = await fetchFromHA(config.url, config.accessToken, "/states");
        if (!response.ok) {
          return reply.internalServerError("Failed to fetch states from Home Assistant");
        }

        const states = (await response.json()) as HAEntityState[];
        const stateMap = new Map(states.map((s) => [s.entity_id, s]));

        // Merge database settings with HA state
        const cameras = cameraEntities.map((entity) => {
          const state = stateMap.get(entity.entityId);
          const settings = entity.settings as {
            refreshInterval?: number;
            aspectRatio?: "16:9" | "4:3" | "1:1";
          };
          return {
            id: entity.id,
            entityId: entity.entityId,
            name: entity.displayName || (state?.attributes.friendly_name as string) || entity.entityId,
            isStreaming: state?.state === "streaming" || state?.state === "idle",
            state: state?.state || "unavailable",
            attributes: state?.attributes || {},
            refreshInterval: settings?.refreshInterval ?? 5,
            aspectRatio: settings?.aspectRatio ?? "16:9",
          };
        });

        return {
          success: true,
          data: cameras,
        };
      } catch (error) {
        console.error("Failed to fetch HA cameras:", error);
        return reply.internalServerError("Failed to connect to Home Assistant");
      }
    }
  );

  // Get all available camera entities from Home Assistant (for picker)
  fastify.get(
    "/cameras/available",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Get all available camera entities from Home Assistant",
        tags: ["Home Assistant"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);

      const [config] = await fastify.db
        .select()
        .from(homeAssistantConfig)
        .where(eq(homeAssistantConfig.userId, user.id))
        .limit(1);

      if (!config) {
        return reply.badRequest("Home Assistant not configured");
      }

      // Get already enabled camera entities
      const enabledEntities = await fastify.db
        .select({ entityId: homeAssistantEntities.entityId })
        .from(homeAssistantEntities)
        .where(eq(homeAssistantEntities.userId, user.id));

      const enabledIds = new Set(enabledEntities.map((e) => e.entityId));

      try {
        const response = await fetchFromHA(config.url, config.accessToken, "/states");
        if (!response.ok) {
          return reply.internalServerError("Failed to fetch states from Home Assistant");
        }

        const states = (await response.json()) as HAEntityState[];

        // Filter to only camera entities
        const cameras = states
          .filter((s) => s.entity_id.startsWith("camera."))
          .map((s) => ({
            entityId: s.entity_id,
            name: (s.attributes.friendly_name as string) || s.entity_id,
            isEnabled: enabledIds.has(s.entity_id),
            state: s.state,
          }));

        return {
          success: true,
          data: cameras,
        };
      } catch (error) {
        console.error("Failed to fetch HA cameras:", error);
        return reply.internalServerError("Failed to connect to Home Assistant");
      }
    }
  );

  // Bulk update entity order
  fastify.post(
    "/entities/reorder",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Reorder selected entities",
        tags: ["Home Assistant"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            entityIds: {
              type: "array",
              items: { type: "string", format: "uuid" },
            },
          },
          required: ["entityIds"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      const { entityIds } = request.body as { entityIds: string[] };

      // Update sort order for each entity
      for (let i = 0; i < entityIds.length; i++) {
        await fastify.db
          .update(homeAssistantEntities)
          .set({ sortOrder: i })
          .where(
            and(
              eq(homeAssistantEntities.id, entityIds[i]!),
              eq(homeAssistantEntities.userId, user.id)
            )
          );
      }

      return { success: true };
    }
  );

  // ==================== ENTITY TIMERS ====================

  // Get active timers for user
  fastify.get(
    "/timers",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get active entity timers",
        tags: ["Home Assistant"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);

      const timers = await fastify.db
        .select()
        .from(haEntityTimers)
        .where(eq(haEntityTimers.userId, user.id))
        .orderBy(asc(haEntityTimers.triggerAt));

      return {
        success: true,
        data: timers,
      };
    }
  );

  // Create a new timer
  fastify.post(
    "/timers",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Create a new entity timer",
        tags: ["Home Assistant"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            entityId: { type: "string" },
            action: { type: "string", enum: ["turn_on", "turn_off"] },
            triggerAt: { type: "string", format: "date-time" },
            fadeEnabled: { type: "boolean" },
            fadeDuration: { type: "integer", minimum: 0 },
          },
          required: ["entityId", "action", "triggerAt"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      const body = request.body as {
        entityId: string;
        action: "turn_on" | "turn_off";
        triggerAt: string;
        fadeEnabled?: boolean;
        fadeDuration?: number;
      };

      // Validate entity is a light or switch
      const domain = body.entityId.split(".")[0];
      if (domain !== "light" && domain !== "switch") {
        return reply.badRequest("Timers are only supported for lights and switches");
      }

      // Delete any existing timer for this entity
      await fastify.db
        .delete(haEntityTimers)
        .where(
          and(
            eq(haEntityTimers.userId, user.id),
            eq(haEntityTimers.entityId, body.entityId)
          )
        );

      const [timer] = await fastify.db
        .insert(haEntityTimers)
        .values({
          userId: user.id,
          entityId: body.entityId,
          action: body.action,
          triggerAt: new Date(body.triggerAt),
          fadeEnabled: body.fadeEnabled ?? false,
          fadeDuration: body.fadeDuration ?? 0,
        })
        .returning();

      return reply.status(201).send({
        success: true,
        data: timer,
      });
    }
  );

  // Cancel/delete a timer
  fastify.delete(
    "/timers/:id",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Cancel an entity timer",
        tags: ["Home Assistant"],
        security: [{ bearerAuth: [] }],
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
      const { id } = request.params as { id: string };

      const [timer] = await fastify.db
        .select()
        .from(haEntityTimers)
        .where(
          and(
            eq(haEntityTimers.id, id),
            eq(haEntityTimers.userId, user.id)
          )
        )
        .limit(1);

      if (!timer) {
        return reply.notFound("Timer not found");
      }

      await fastify.db
        .delete(haEntityTimers)
        .where(eq(haEntityTimers.id, id));

      return { success: true };
    }
  );
};
