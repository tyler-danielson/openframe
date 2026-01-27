import type { FastifyPluginAsync } from "fastify";
import { eq, and, asc } from "drizzle-orm";
import {
  homeAssistantConfig,
  homeAssistantEntities,
} from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";

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
  // ==================== CONFIG ====================

  // Get HA config
  fastify.get(
    "/config",
    {
      onRequest: [fastify.authenticate],
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

  // Get selected entities
  fastify.get(
    "/entities",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get user's selected Home Assistant entities",
        tags: ["Home Assistant"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);

      const entities = await fastify.db
        .select()
        .from(homeAssistantEntities)
        .where(eq(homeAssistantEntities.userId, user.id))
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
};
