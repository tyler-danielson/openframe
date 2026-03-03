import type { FastifyPluginAsync } from "fastify";
import { eq, and, asc, desc } from "drizzle-orm";
import { shoppingItems } from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";

export const shoppingRoutes: FastifyPluginAsync = async (fastify) => {
  // GET / — List all items (unchecked first, then checked)
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "List all shopping items",
        tags: ["Shopping"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const rows = await fastify.db
        .select()
        .from(shoppingItems)
        .where(eq(shoppingItems.userId, user.id))
        .orderBy(
          asc(shoppingItems.checked),
          asc(shoppingItems.sortOrder),
          asc(shoppingItems.createdAt)
        );

      return { success: true, data: rows };
    }
  );

  // POST / — Create item
  fastify.post(
    "/",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Create a new shopping item",
        tags: ["Shopping"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1 },
            amazonUrl: { type: "string" },
          },
          required: ["name"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { name, amazonUrl } = request.body as {
        name: string;
        amazonUrl?: string;
      };

      // Get max sortOrder for this user
      const existing = await fastify.db
        .select({ sortOrder: shoppingItems.sortOrder })
        .from(shoppingItems)
        .where(eq(shoppingItems.userId, user.id))
        .orderBy(desc(shoppingItems.sortOrder))
        .limit(1);

      const nextOrder =
        existing.length > 0 ? existing[0]!.sortOrder + 1 : 0;

      const [row] = await fastify.db
        .insert(shoppingItems)
        .values({
          userId: user.id,
          name,
          amazonUrl: amazonUrl || null,
          sortOrder: nextOrder,
        })
        .returning();

      return reply.status(201).send({ success: true, data: row });
    }
  );

  // PATCH /:id — Update item (toggle checked, edit name/url)
  fastify.patch(
    "/:id",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Update a shopping item",
        tags: ["Shopping"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: { id: { type: "string", format: "uuid" } },
          required: ["id"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { id } = request.params as { id: string };
      const body = request.body as Partial<{
        name: string;
        amazonUrl: string | null;
        checked: boolean;
        sortOrder: number;
      }>;

      // Verify ownership
      const [existing] = await fastify.db
        .select()
        .from(shoppingItems)
        .where(
          and(eq(shoppingItems.id, id), eq(shoppingItems.userId, user.id))
        )
        .limit(1);

      if (!existing)
        throw fastify.httpErrors.notFound("Shopping item not found");

      const [updated] = await fastify.db
        .update(shoppingItems)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(shoppingItems.id, id))
        .returning();

      return { success: true, data: updated };
    }
  );

  // DELETE /:id — Delete single item
  fastify.delete(
    "/:id",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Delete a shopping item",
        tags: ["Shopping"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: { id: { type: "string", format: "uuid" } },
          required: ["id"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { id } = request.params as { id: string };

      const [deleted] = await fastify.db
        .delete(shoppingItems)
        .where(
          and(eq(shoppingItems.id, id), eq(shoppingItems.userId, user.id))
        )
        .returning();

      if (!deleted)
        throw fastify.httpErrors.notFound("Shopping item not found");

      return { success: true };
    }
  );

  // DELETE /checked — Clear all checked items
  fastify.delete(
    "/checked",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Clear all checked shopping items",
        tags: ["Shopping"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      await fastify.db
        .delete(shoppingItems)
        .where(
          and(
            eq(shoppingItems.userId, user.id),
            eq(shoppingItems.checked, true)
          )
        );

      return { success: true };
    }
  );
};
