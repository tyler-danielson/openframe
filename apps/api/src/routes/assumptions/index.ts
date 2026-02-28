import type { FastifyPluginAsync } from "fastify";
import { eq, and, asc } from "drizzle-orm";
import { assumptions } from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";

export const assumptionRoutes: FastifyPluginAsync = async (fastify) => {
  // GET / — List all assumptions for current user
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "List all AI assumptions",
        tags: ["Assumptions"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const rows = await fastify.db
        .select()
        .from(assumptions)
        .where(eq(assumptions.userId, user.id))
        .orderBy(asc(assumptions.sortOrder), asc(assumptions.createdAt));

      return { success: true, data: rows };
    }
  );

  // POST / — Create assumption
  fastify.post(
    "/",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Create a new AI assumption",
        tags: ["Assumptions"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        body: {
          type: "object",
          properties: {
            text: { type: "string", minLength: 1 },
          },
          required: ["text"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { text } = request.body as { text: string };

      // Get max sortOrder for this user
      const existing = await fastify.db
        .select({ sortOrder: assumptions.sortOrder })
        .from(assumptions)
        .where(eq(assumptions.userId, user.id))
        .orderBy(asc(assumptions.sortOrder));

      const nextOrder = existing.length > 0
        ? Math.max(...existing.map((r) => r.sortOrder)) + 1
        : 0;

      const [row] = await fastify.db
        .insert(assumptions)
        .values({
          userId: user.id,
          text,
          sortOrder: nextOrder,
        })
        .returning();

      return reply.status(201).send({ success: true, data: row });
    }
  );

  // PATCH /:id — Update assumption
  fastify.patch(
    "/:id",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Update an AI assumption",
        tags: ["Assumptions"],
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
        text: string;
        enabled: boolean;
        sortOrder: number;
      }>;

      // Verify ownership
      const [existing] = await fastify.db
        .select()
        .from(assumptions)
        .where(and(eq(assumptions.id, id), eq(assumptions.userId, user.id)))
        .limit(1);

      if (!existing) throw fastify.httpErrors.notFound("Assumption not found");

      const [updated] = await fastify.db
        .update(assumptions)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(assumptions.id, id))
        .returning();

      return { success: true, data: updated };
    }
  );

  // DELETE /:id — Delete assumption
  fastify.delete(
    "/:id",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Delete an AI assumption",
        tags: ["Assumptions"],
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
        .delete(assumptions)
        .where(and(eq(assumptions.id, id), eq(assumptions.userId, user.id)))
        .returning();

      if (!deleted) throw fastify.httpErrors.notFound("Assumption not found");

      return { success: true };
    }
  );

  // PUT /reorder — Bulk update sort order
  fastify.put(
    "/reorder",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Reorder AI assumptions",
        tags: ["Assumptions"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        body: {
          type: "object",
          properties: {
            ids: { type: "array", items: { type: "string", format: "uuid" } },
          },
          required: ["ids"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { ids } = request.body as { ids: string[] };

      for (let i = 0; i < ids.length; i++) {
        const id = ids[i]!;
        await fastify.db
          .update(assumptions)
          .set({ sortOrder: i, updatedAt: new Date() })
          .where(
            and(eq(assumptions.id, id), eq(assumptions.userId, user.id))
          );
      }

      return { success: true };
    }
  );
};
