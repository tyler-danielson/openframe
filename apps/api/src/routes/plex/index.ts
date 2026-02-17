import type { FastifyPluginAsync } from "fastify";
import { eq, desc } from "drizzle-orm";
import { plexServers } from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";
import { PlexClient } from "../../services/plex-client.js";

export const plexRoutes: FastifyPluginAsync = async (fastify) => {
  // ==================== SERVERS ====================

  // List Plex servers
  fastify.get(
    "/servers",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "List user's Plex servers",
        tags: ["Plex"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const servers = await fastify.db
        .select()
        .from(plexServers)
        .where(eq(plexServers.userId, user.id))
        .orderBy(desc(plexServers.createdAt));

      return {
        success: true,
        data: servers.map((s) => ({
          id: s.id,
          userId: s.userId,
          name: s.name,
          serverUrl: s.serverUrl,
          machineId: s.machineId,
          isActive: s.isActive,
          lastSyncedAt: s.lastSyncedAt,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        })),
      };
    }
  );

  // Add Plex server
  fastify.post(
    "/servers",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Add a new Plex server",
        tags: ["Plex"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            serverUrl: { type: "string" },
            accessToken: { type: "string" },
          },
          required: ["name", "serverUrl", "accessToken"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { name, serverUrl, accessToken } = request.body as {
        name: string;
        serverUrl: string;
        accessToken: string;
      };

      // Validate connection and get machineIdentifier
      const client = new PlexClient({ serverUrl, accessToken });
      let machineId: string;
      try {
        machineId = await client.authenticate();
      } catch (err) {
        throw fastify.httpErrors.badRequest(
          `Failed to connect to Plex server: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      }

      const [server] = await fastify.db
        .insert(plexServers)
        .values({
          userId: user.id,
          name,
          serverUrl: serverUrl.replace(/\/+$/, ""),
          accessToken,
          machineId,
        })
        .returning();

      if (!server) throw fastify.httpErrors.internalServerError("Failed to create server");

      return {
        success: true,
        data: {
          id: server.id,
          userId: server.userId,
          name: server.name,
          serverUrl: server.serverUrl,
          machineId: server.machineId,
          isActive: server.isActive,
          lastSyncedAt: server.lastSyncedAt,
          createdAt: server.createdAt,
          updatedAt: server.updatedAt,
        },
      };
    }
  );

  // Delete Plex server
  fastify.delete(
    "/servers/:id",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Delete a Plex server",
        tags: ["Plex"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { id } = request.params as { id: string };

      await fastify.db
        .delete(plexServers)
        .where(eq(plexServers.id, id));

      return reply.status(204).send();
    }
  );

  // ==================== LIBRARY PROXY ====================

  // Helper to get a Plex client for a server
  async function getPlexClientForServer(
    serverId: string,
    userId: string
  ): Promise<{ client: PlexClient; server: typeof plexServers.$inferSelect }> {
    const [server] = await fastify.db
      .select()
      .from(plexServers)
      .where(eq(plexServers.id, serverId))
      .limit(1);

    if (!server || server.userId !== userId) {
      throw fastify.httpErrors.notFound("Server not found");
    }

    const client = new PlexClient({
      serverUrl: server.serverUrl,
      accessToken: server.accessToken,
    });

    return { client, server };
  }

  // List libraries for a server
  fastify.get(
    "/servers/:id/libraries",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "List libraries on a Plex server",
        tags: ["Plex"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { id } = request.params as { id: string };
      const { client } = await getPlexClientForServer(id, user.id);
      const libraries = await client.getLibraries();

      return { success: true, data: libraries };
    }
  );

  // List library contents
  fastify.get(
    "/servers/:id/libraries/:key/items",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "List items in a Plex library",
        tags: ["Plex"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { id, key } = request.params as { id: string; key: string };
      const { search } = request.query as { search?: string };
      const { client } = await getPlexClientForServer(id, user.id);
      const items = await client.getLibraryContents(key, { search });

      return { success: true, data: items };
    }
  );

  // Get item details
  fastify.get(
    "/servers/:id/items/:ratingKey",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get Plex item details",
        tags: ["Plex"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { id, ratingKey } = request.params as { id: string; ratingKey: string };
      const { client } = await getPlexClientForServer(id, user.id);
      const item = await client.getItem(ratingKey);

      if (!item) throw fastify.httpErrors.notFound("Item not found");
      return { success: true, data: item };
    }
  );

  // Search across all libraries
  fastify.get(
    "/servers/:id/search",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Search Plex server",
        tags: ["Plex"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { id } = request.params as { id: string };
      const { query } = request.query as { query: string };
      if (!query) throw fastify.httpErrors.badRequest("Query is required");

      const { client } = await getPlexClientForServer(id, user.id);
      const items = await client.search(query);

      return { success: true, data: items };
    }
  );

  // Proxy thumbnail
  fastify.get(
    "/servers/:id/thumb",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Proxy Plex thumbnail",
        tags: ["Plex"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { id } = request.params as { id: string };
      const { path } = request.query as { path: string };
      if (!path) throw fastify.httpErrors.badRequest("Path is required");

      const { client } = await getPlexClientForServer(id, user.id);
      const url = client.getThumbUrl(path);

      const response = await fetch(url);
      if (!response.ok) {
        throw fastify.httpErrors.badGateway("Failed to fetch thumbnail");
      }

      const contentType = response.headers.get("content-type") || "image/jpeg";
      const buffer = Buffer.from(await response.arrayBuffer());

      return reply
        .header("content-type", contentType)
        .header("cache-control", "public, max-age=86400")
        .send(buffer);
    }
  );
};
