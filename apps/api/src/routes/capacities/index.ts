/**
 * Capacities Integration Routes
 *
 * Provides endpoints for:
 * - API token connection/disconnection
 * - Space management
 * - Search content
 * - Save to daily note
 * - Save weblinks
 */

import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { capacitiesConfig, capacitiesSpaces } from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";
import { CapacitiesService } from "../../services/capacities.js";

export const capacitiesRoutes: FastifyPluginAsync = async (fastify) => {
  const { authenticate } = fastify;

  // POST /api/v1/capacities/connect - Connect with API token
  fastify.post<{
    Body: { apiToken: string };
  }>(
    "/connect",
    {
      preHandler: [authenticate],
      schema: {
        description: "Connect to Capacities using API token",
        tags: ["Capacities"],
        body: {
          type: "object",
          properties: {
            apiToken: {
              type: "string",
              description: "API token from Capacities settings",
            },
          },
          required: ["apiToken"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        return reply.unauthorized("Not authenticated");
      }
      const { apiToken } = request.body;

      if (!apiToken || apiToken.trim().length === 0) {
        return reply.badRequest("API token is required");
      }

      try {
        const result = await CapacitiesService.connect(
          fastify,
          user.id,
          apiToken.trim()
        );

        return {
          success: true,
          data: {
            connected: true,
            message: "Successfully connected to Capacities",
            spaces: result.spaces.map((s) => ({
              id: s.id,
              title: s.title,
              icon: s.icon,
            })),
          },
        };
      } catch (error) {
        fastify.log.error({ err: error }, "Failed to connect to Capacities");
        return reply.badRequest(
          error instanceof Error ? error.message : "Failed to connect to Capacities"
        );
      }
    }
  );

  // DELETE /api/v1/capacities/disconnect - Disconnect account
  fastify.delete(
    "/disconnect",
    {
      preHandler: [authenticate],
      schema: {
        description: "Disconnect from Capacities",
        tags: ["Capacities"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      await CapacitiesService.disconnect(fastify, user.id);

      return {
        success: true,
        data: {
          message: "Disconnected from Capacities",
        },
      };
    }
  );

  // GET /api/v1/capacities/status - Get connection status
  fastify.get(
    "/status",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get Capacities connection status",
        tags: ["Capacities"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const config = await CapacitiesService.getConfig(fastify, user.id);

      if (!config) {
        return {
          success: true,
          data: {
            connected: false,
          },
        };
      }

      // Test the connection
      const isConnected = await CapacitiesService.testConnection(
        fastify,
        user.id
      );

      // Get cached spaces
      const spaces = await CapacitiesService.getCachedSpaces(fastify, user.id);

      return {
        success: true,
        data: {
          connected: isConnected,
          defaultSpaceId: config.defaultSpaceId,
          lastSyncAt: config.lastSyncAt?.toISOString() ?? null,
          spaces: spaces.map((s) => ({
            id: s.spaceId,
            title: s.title,
            icon: s.icon,
            isDefault: s.isDefault,
          })),
        },
      };
    }
  );

  // GET /api/v1/capacities/spaces - List spaces
  fastify.get(
    "/spaces",
    {
      preHandler: [authenticate],
      schema: {
        description: "List Capacities spaces",
        tags: ["Capacities"],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const config = await CapacitiesService.getConfig(fastify, user.id);
      if (!config) {
        return reply.badRequest("Capacities not connected");
      }

      try {
        const service = new CapacitiesService(fastify, user.id);
        const spaces = await service.refreshSpaces();

        // Get updated cached spaces (with isDefault)
        const cachedSpaces = await CapacitiesService.getCachedSpaces(
          fastify,
          user.id
        );

        return {
          success: true,
          data: cachedSpaces.map((s) => ({
            id: s.spaceId,
            title: s.title,
            icon: s.icon,
            isDefault: s.isDefault,
          })),
        };
      } catch (error) {
        fastify.log.error({ err: error }, "Failed to get Capacities spaces");
        return reply.badRequest(
          error instanceof Error ? error.message : "Failed to get spaces"
        );
      }
    }
  );

  // PATCH /api/v1/capacities/spaces/:id - Set default space
  fastify.patch<{
    Params: { id: string };
    Body: { isDefault?: boolean };
  }>(
    "/spaces/:id",
    {
      preHandler: [authenticate],
      schema: {
        description: "Update space settings (set as default)",
        tags: ["Capacities"],
        params: {
          type: "object",
          properties: {
            id: { type: "string", description: "Space ID" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            isDefault: { type: "boolean" },
          },
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id: spaceId } = request.params;
      const { isDefault } = request.body;

      const config = await CapacitiesService.getConfig(fastify, user.id);
      if (!config) {
        return reply.badRequest("Capacities not connected");
      }

      if (isDefault) {
        await CapacitiesService.setDefaultSpace(fastify, user.id, spaceId);
      }

      return {
        success: true,
        data: {
          message: "Space updated",
        },
      };
    }
  );

  // GET /api/v1/capacities/spaces/:id/info - Get space info (structures)
  fastify.get<{
    Params: { id: string };
  }>(
    "/spaces/:id/info",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get space structures/content types",
        tags: ["Capacities"],
        params: {
          type: "object",
          properties: {
            id: { type: "string", description: "Space ID" },
          },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id: spaceId } = request.params;

      const config = await CapacitiesService.getConfig(fastify, user.id);
      if (!config) {
        return reply.badRequest("Capacities not connected");
      }

      try {
        const service = new CapacitiesService(fastify, user.id);
        const info = await service.getSpaceInfo(spaceId);

        return {
          success: true,
          data: info,
        };
      } catch (error) {
        fastify.log.error({ err: error }, "Failed to get space info");
        return reply.badRequest(
          error instanceof Error ? error.message : "Failed to get space info"
        );
      }
    }
  );

  // POST /api/v1/capacities/search - Search content
  fastify.post<{
    Body: {
      spaceId: string;
      searchTerm: string;
      structureId?: string;
    };
  }>(
    "/search",
    {
      preHandler: [authenticate],
      schema: {
        description: "Search content in Capacities by title",
        tags: ["Capacities"],
        body: {
          type: "object",
          properties: {
            spaceId: { type: "string", description: "Space ID to search in" },
            searchTerm: { type: "string", description: "Search term" },
            structureId: {
              type: "string",
              description: "Optional structure ID to filter by",
            },
          },
          required: ["spaceId", "searchTerm"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { spaceId, searchTerm, structureId } = request.body;

      const config = await CapacitiesService.getConfig(fastify, user.id);
      if (!config) {
        return reply.badRequest("Capacities not connected");
      }

      try {
        const service = new CapacitiesService(fastify, user.id);
        const results = await service.lookup(spaceId, searchTerm, structureId);

        return {
          success: true,
          data: results,
        };
      } catch (error) {
        fastify.log.error({ err: error }, "Failed to search Capacities");
        return reply.badRequest(
          error instanceof Error ? error.message : "Search failed"
        );
      }
    }
  );

  // POST /api/v1/capacities/daily-note - Save to daily note
  fastify.post<{
    Body: {
      spaceId?: string;
      mdText: string;
      noTimeStamp?: boolean;
    };
  }>(
    "/daily-note",
    {
      preHandler: [authenticate],
      schema: {
        description: "Save text to today's daily note",
        tags: ["Capacities"],
        body: {
          type: "object",
          properties: {
            spaceId: {
              type: "string",
              description: "Space ID (uses default if not provided)",
            },
            mdText: {
              type: "string",
              description: "Markdown text to save",
            },
            noTimeStamp: {
              type: "boolean",
              description: "Skip adding timestamp",
            },
          },
          required: ["mdText"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { spaceId, mdText, noTimeStamp } = request.body;

      const config = await CapacitiesService.getConfig(fastify, user.id);
      if (!config) {
        return reply.badRequest("Capacities not connected");
      }

      // Use provided spaceId or default
      const targetSpaceId = spaceId || config.defaultSpaceId;
      if (!targetSpaceId) {
        return reply.badRequest(
          "No space ID provided and no default space configured"
        );
      }

      try {
        const service = new CapacitiesService(fastify, user.id);
        await service.saveToDailyNote(targetSpaceId, mdText, {
          noTimeStamp,
          origin: "OpenFrame Calendar",
        });

        return {
          success: true,
          data: {
            message: "Saved to daily note",
          },
        };
      } catch (error) {
        fastify.log.error({ err: error }, "Failed to save to daily note");
        return reply.badRequest(
          error instanceof Error ? error.message : "Failed to save to daily note"
        );
      }
    }
  );

  // POST /api/v1/capacities/weblink - Save weblink
  fastify.post<{
    Body: {
      spaceId?: string;
      url: string;
      title?: string;
      mdText?: string;
      tags?: string[];
    };
  }>(
    "/weblink",
    {
      preHandler: [authenticate],
      schema: {
        description: "Save a weblink as an object in Capacities",
        tags: ["Capacities"],
        body: {
          type: "object",
          properties: {
            spaceId: {
              type: "string",
              description: "Space ID (uses default if not provided)",
            },
            url: {
              type: "string",
              description: "URL to save",
            },
            title: {
              type: "string",
              description: "Custom title for the link",
            },
            mdText: {
              type: "string",
              description: "Additional markdown text/notes",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Tags to apply",
            },
          },
          required: ["url"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { spaceId, url, title, mdText, tags } = request.body;

      const config = await CapacitiesService.getConfig(fastify, user.id);
      if (!config) {
        return reply.badRequest("Capacities not connected");
      }

      // Use provided spaceId or default
      const targetSpaceId = spaceId || config.defaultSpaceId;
      if (!targetSpaceId) {
        return reply.badRequest(
          "No space ID provided and no default space configured"
        );
      }

      try {
        const service = new CapacitiesService(fastify, user.id);
        const result = await service.saveWeblink(targetSpaceId, url, {
          title,
          mdText,
          tags,
          origin: "OpenFrame Calendar",
        });

        return {
          success: true,
          data: result,
        };
      } catch (error) {
        fastify.log.error({ err: error }, "Failed to save weblink");
        return reply.badRequest(
          error instanceof Error ? error.message : "Failed to save weblink"
        );
      }
    }
  );

  // POST /api/v1/capacities/test - Test connection
  fastify.post(
    "/test",
    {
      preHandler: [authenticate],
      schema: {
        description: "Test Capacities API connection",
        tags: ["Capacities"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const isConnected = await CapacitiesService.testConnection(
        fastify,
        user.id
      );

      return {
        success: true,
        data: {
          connected: isConnected,
          message: isConnected
            ? "Connection successful"
            : "Connection failed. Please reconnect.",
        },
      };
    }
  );
};
