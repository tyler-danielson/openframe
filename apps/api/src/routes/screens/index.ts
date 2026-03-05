import type { FastifyPluginAsync } from "fastify";
import { eq, and, asc, desc } from "drizzle-orm";
import { customScreens } from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "screen";
}

export const screenRoutes: FastifyPluginAsync = async (fastify) => {
  // GET / — List all custom screens
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "List all custom screens",
        tags: ["Screens"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const rows = await fastify.db
        .select()
        .from(customScreens)
        .where(eq(customScreens.userId, user.id))
        .orderBy(asc(customScreens.sortOrder), asc(customScreens.createdAt));

      return { success: true, data: rows };
    }
  );

  // POST / — Create a custom screen
  fastify.post(
    "/",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Create a new custom screen",
        tags: ["Screens"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1 },
            icon: { type: "string" },
            layoutConfig: { type: "object" },
          },
          required: ["name"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { name, icon, layoutConfig } = request.body as {
        name: string;
        icon?: string;
        layoutConfig?: Record<string, unknown>;
      };

      // Generate unique slug
      let baseSlug = slugify(name);
      let slug = baseSlug;
      let counter = 1;
      while (true) {
        const [existing] = await fastify.db
          .select({ id: customScreens.id })
          .from(customScreens)
          .where(
            and(eq(customScreens.userId, user.id), eq(customScreens.slug, slug))
          )
          .limit(1);
        if (!existing) break;
        slug = `${baseSlug}-${counter++}`;
      }

      // Get max sortOrder
      const maxSort = await fastify.db
        .select({ sortOrder: customScreens.sortOrder })
        .from(customScreens)
        .where(eq(customScreens.userId, user.id))
        .orderBy(desc(customScreens.sortOrder))
        .limit(1);

      const nextOrder = maxSort.length > 0 ? maxSort[0]!.sortOrder + 1 : 0;

      const [row] = await fastify.db
        .insert(customScreens)
        .values({
          userId: user.id,
          name,
          icon: icon || "LayoutDashboard",
          slug,
          layoutConfig: layoutConfig || {},
          sortOrder: nextOrder,
        })
        .returning();

      return reply.status(201).send({ success: true, data: row });
    }
  );

  // GET /:id — Get single screen
  fastify.get(
    "/:id",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Get a custom screen by ID",
        tags: ["Screens"],
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

      const [row] = await fastify.db
        .select()
        .from(customScreens)
        .where(
          and(eq(customScreens.id, id), eq(customScreens.userId, user.id))
        )
        .limit(1);

      if (!row) throw fastify.httpErrors.notFound("Screen not found");

      return { success: true, data: row };
    }
  );

  // GET /by-slug/:slug — Get screen by slug
  fastify.get(
    "/by-slug/:slug",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Get a custom screen by slug",
        tags: ["Screens"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: { slug: { type: "string" } },
          required: ["slug"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("Not authenticated");

      const { slug } = request.params as { slug: string };

      const [row] = await fastify.db
        .select()
        .from(customScreens)
        .where(
          and(eq(customScreens.slug, slug), eq(customScreens.userId, user.id))
        )
        .limit(1);

      if (!row) throw fastify.httpErrors.notFound("Screen not found");

      return { success: true, data: row };
    }
  );

  // PUT /:id — Update screen
  fastify.put(
    "/:id",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Update a custom screen",
        tags: ["Screens"],
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
        icon: string;
        layoutConfig: Record<string, unknown>;
        sortOrder: number;
      }>;

      // Verify ownership
      const [existing] = await fastify.db
        .select()
        .from(customScreens)
        .where(
          and(eq(customScreens.id, id), eq(customScreens.userId, user.id))
        )
        .limit(1);

      if (!existing) throw fastify.httpErrors.notFound("Screen not found");

      const [updated] = await fastify.db
        .update(customScreens)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(customScreens.id, id))
        .returning();

      return { success: true, data: updated };
    }
  );

  // DELETE /:id — Delete screen
  fastify.delete(
    "/:id",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Delete a custom screen",
        tags: ["Screens"],
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
        .delete(customScreens)
        .where(
          and(eq(customScreens.id, id), eq(customScreens.userId, user.id))
        )
        .returning();

      if (!deleted) throw fastify.httpErrors.notFound("Screen not found");

      return { success: true };
    }
  );
};
