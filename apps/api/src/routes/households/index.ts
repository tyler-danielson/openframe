import type { FastifyPluginAsync } from "fastify";
import { eq, and } from "drizzle-orm";
import { households, householdMembers } from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";

export const householdRoutes: FastifyPluginAsync = async (fastify) => {
  // Get user's household(s)
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Get current user's household",
        tags: ["Households"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const memberships = await fastify.db
        .select({
          householdId: householdMembers.householdId,
          role: householdMembers.role,
          householdName: households.name,
        })
        .from(householdMembers)
        .innerJoin(households, eq(households.id, householdMembers.householdId))
        .where(eq(householdMembers.userId, user.id));

      if (memberships.length === 0) {
        return { success: true, household: null };
      }

      const membership = memberships[0]!;

      // Get all members of this household
      const members = await fastify.db
        .select({
          userId: householdMembers.userId,
          role: householdMembers.role,
          createdAt: householdMembers.createdAt,
        })
        .from(householdMembers)
        .where(eq(householdMembers.householdId, membership.householdId));

      return {
        success: true,
        household: {
          id: membership.householdId,
          name: membership.householdName,
          role: membership.role,
          members,
        },
      };
    }
  );

  // Create a household
  fastify.post(
    "/",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Create a new household",
        tags: ["Households"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const { name } = request.body as { name: string };

      const [household] = await fastify.db
        .insert(households)
        .values({ name })
        .returning();

      await fastify.db.insert(householdMembers).values({
        householdId: household!.id,
        userId: user.id,
        role: "owner",
      });

      return { success: true, household: household! };
    }
  );

  // Update household name
  fastify.patch(
    "/:id",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Update household",
        tags: ["Households"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const { id } = request.params as { id: string };
      const { name } = request.body as { name?: string };

      // Verify membership
      const [membership] = await fastify.db
        .select()
        .from(householdMembers)
        .where(
          and(
            eq(householdMembers.householdId, id),
            eq(householdMembers.userId, user.id)
          )
        )
        .limit(1);

      if (!membership) {
        throw fastify.httpErrors.forbidden("Not a member of this household");
      }

      if (name) {
        await fastify.db
          .update(households)
          .set({ name, updatedAt: new Date() })
          .where(eq(households.id, id));
      }

      return { success: true };
    }
  );
};
