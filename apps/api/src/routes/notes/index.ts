import type { FastifyPluginAsync } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import { stickyNotes } from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";
import { requireUserHouseholdId } from "../../lib/household.js";

export const noteRoutes: FastifyPluginAsync = async (fastify) => {
  // List sticky notes for household
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "List sticky notes for household",
        tags: ["Notes"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const householdId = await requireUserHouseholdId(fastify.db, user.id);

      const notes = await fastify.db
        .select()
        .from(stickyNotes)
        .where(eq(stickyNotes.householdId, householdId))
        .orderBy(desc(stickyNotes.pinned), desc(stickyNotes.createdAt));

      return { success: true, notes };
    }
  );

  // Create a sticky note
  fastify.post(
    "/",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Create a sticky note",
        tags: ["Notes"],
        body: {
          type: "object",
          required: ["content"],
          properties: {
            content: { type: "string", maxLength: 500 },
            color: { type: "string" },
            pinned: { type: "boolean" },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const householdId = await requireUserHouseholdId(fastify.db, user.id);
      const { content, color, pinned } = request.body as {
        content: string;
        color?: string;
        pinned?: boolean;
      };

      const [note] = await fastify.db
        .insert(stickyNotes)
        .values({
          householdId,
          authorUserId: user.id,
          content,
          color: color ?? "#FEF3C7",
          pinned: pinned ?? false,
        })
        .returning();

      return { success: true, note };
    }
  );

  // Update a sticky note
  fastify.put(
    "/:id",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Update a sticky note",
        tags: ["Notes"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: {
          type: "object",
          properties: {
            content: { type: "string", maxLength: 500 },
            color: { type: "string" },
            pinned: { type: "boolean" },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const householdId = await requireUserHouseholdId(fastify.db, user.id);
      const { id } = request.params as { id: string };
      const body = request.body as {
        content?: string;
        color?: string;
        pinned?: boolean;
      };

      // Verify note belongs to household
      const [existing] = await fastify.db
        .select()
        .from(stickyNotes)
        .where(and(eq(stickyNotes.id, id), eq(stickyNotes.householdId, householdId)))
        .limit(1);

      if (!existing) {
        throw fastify.httpErrors.notFound("Note not found");
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (body.content !== undefined) updates.content = body.content;
      if (body.color !== undefined) updates.color = body.color;
      if (body.pinned !== undefined) updates.pinned = body.pinned;

      const [note] = await fastify.db
        .update(stickyNotes)
        .set(updates)
        .where(eq(stickyNotes.id, id))
        .returning();

      return { success: true, note };
    }
  );

  // Delete a sticky note
  fastify.delete(
    "/:id",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Delete a sticky note",
        tags: ["Notes"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const householdId = await requireUserHouseholdId(fastify.db, user.id);
      const { id } = request.params as { id: string };

      const result = await fastify.db
        .delete(stickyNotes)
        .where(and(eq(stickyNotes.id, id), eq(stickyNotes.householdId, householdId)));

      return { success: true };
    }
  );

  // Toggle pin on a sticky note
  fastify.post(
    "/:id/pin",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Toggle pin on a sticky note",
        tags: ["Notes"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const householdId = await requireUserHouseholdId(fastify.db, user.id);
      const { id } = request.params as { id: string };

      const [existing] = await fastify.db
        .select()
        .from(stickyNotes)
        .where(and(eq(stickyNotes.id, id), eq(stickyNotes.householdId, householdId)))
        .limit(1);

      if (!existing) {
        throw fastify.httpErrors.notFound("Note not found");
      }

      const [note] = await fastify.db
        .update(stickyNotes)
        .set({ pinned: !existing.pinned, updatedAt: new Date() })
        .where(eq(stickyNotes.id, id))
        .returning();

      return { success: true, note };
    }
  );
};
