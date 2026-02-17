import type { FastifyPluginAsync } from "fastify";
import { eq, desc } from "drizzle-orm";
import { audiobookshelfServers } from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";
import { AudiobookshelfClient } from "../../services/audiobookshelf-client.js";

export const audiobookshelfRoutes: FastifyPluginAsync = async (fastify) => {
  // ==================== SERVERS ====================

  // List Audiobookshelf servers
  fastify.get(
    "/servers",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "List user's Audiobookshelf servers",
        tags: ["Audiobookshelf"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const servers = await fastify.db
        .select()
        .from(audiobookshelfServers)
        .where(eq(audiobookshelfServers.userId, user.id))
        .orderBy(desc(audiobookshelfServers.createdAt));

      return {
        success: true,
        data: servers.map((s) => ({
          id: s.id,
          userId: s.userId,
          name: s.name,
          serverUrl: s.serverUrl,
          isActive: s.isActive,
          lastSyncedAt: s.lastSyncedAt,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        })),
      };
    }
  );

  // Add Audiobookshelf server
  fastify.post(
    "/servers",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Add a new Audiobookshelf server",
        tags: ["Audiobookshelf"],
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

      // Validate connection
      const client = new AudiobookshelfClient({ serverUrl, accessToken });
      try {
        await client.authenticate();
      } catch (err) {
        throw fastify.httpErrors.badRequest(
          `Failed to connect to Audiobookshelf: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      }

      const [server] = await fastify.db
        .insert(audiobookshelfServers)
        .values({
          userId: user.id,
          name,
          serverUrl: serverUrl.replace(/\/+$/, ""),
          accessToken,
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
          isActive: server.isActive,
          lastSyncedAt: server.lastSyncedAt,
          createdAt: server.createdAt,
          updatedAt: server.updatedAt,
        },
      };
    }
  );

  // Delete Audiobookshelf server
  fastify.delete(
    "/servers/:id",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Delete an Audiobookshelf server",
        tags: ["Audiobookshelf"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { id } = request.params as { id: string };

      await fastify.db
        .delete(audiobookshelfServers)
        .where(eq(audiobookshelfServers.id, id));

      return reply.status(204).send();
    }
  );

  // ==================== LIBRARY PROXY ====================

  async function getAbsClientForServer(
    serverId: string,
    userId: string
  ): Promise<{ client: AudiobookshelfClient; server: typeof audiobookshelfServers.$inferSelect }> {
    const [server] = await fastify.db
      .select()
      .from(audiobookshelfServers)
      .where(eq(audiobookshelfServers.id, serverId))
      .limit(1);

    if (!server || server.userId !== userId) {
      throw fastify.httpErrors.notFound("Server not found");
    }

    const client = new AudiobookshelfClient({
      serverUrl: server.serverUrl,
      accessToken: server.accessToken,
    });

    return { client, server };
  }

  // List libraries
  fastify.get(
    "/servers/:id/libraries",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "List libraries on an Audiobookshelf server",
        tags: ["Audiobookshelf"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { id } = request.params as { id: string };
      const { client } = await getAbsClientForServer(id, user.id);
      const libraries = await client.getLibraries();

      return { success: true, data: libraries };
    }
  );

  // List library items
  fastify.get(
    "/servers/:id/libraries/:libId/items",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "List items in an Audiobookshelf library",
        tags: ["Audiobookshelf"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { id, libId } = request.params as { id: string; libId: string };
      const { search } = request.query as { search?: string };
      const { client } = await getAbsClientForServer(id, user.id);
      const items = await client.getLibraryItems(libId, { search });

      return { success: true, data: items };
    }
  );

  // Get item details
  fastify.get(
    "/servers/:id/items/:itemId",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get Audiobookshelf item details",
        tags: ["Audiobookshelf"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { id, itemId } = request.params as { id: string; itemId: string };
      const { client } = await getAbsClientForServer(id, user.id);
      const item = await client.getItem(itemId);

      if (!item) throw fastify.httpErrors.notFound("Item not found");
      return { success: true, data: item };
    }
  );

  // Proxy cover image
  fastify.get(
    "/servers/:id/cover",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Proxy Audiobookshelf cover image",
        tags: ["Audiobookshelf"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { id } = request.params as { id: string };
      const { itemId } = request.query as { itemId: string };
      if (!itemId) throw fastify.httpErrors.badRequest("itemId is required");

      const { client } = await getAbsClientForServer(id, user.id);
      const url = client.getCoverUrl(itemId);

      const response = await fetch(url);
      if (!response.ok) {
        throw fastify.httpErrors.badGateway("Failed to fetch cover");
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
