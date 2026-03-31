import type { FastifyPluginAsync } from "fastify";
import { eq, and, desc, asc, isNull } from "drizzle-orm";
import {
  chores,
  choreAssignments,
  choreRotationOrder,
  familyProfiles,
} from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";
import { requireUserHouseholdId } from "../../lib/household.js";

export const choreRoutes: FastifyPluginAsync = async (fastify) => {
  // List all chores with current assignments
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "List all chores for household with current assignments",
        tags: ["Chores"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const householdId = await requireUserHouseholdId(fastify.db, user.id);

      const allChores = await fastify.db
        .select()
        .from(chores)
        .where(eq(chores.householdId, householdId))
        .orderBy(asc(chores.name));

      // Get current (most recent incomplete) assignments for each chore
      const assignments = await fastify.db
        .select({
          id: choreAssignments.id,
          choreId: choreAssignments.choreId,
          profileId: choreAssignments.profileId,
          assignedAt: choreAssignments.assignedAt,
          completedAt: choreAssignments.completedAt,
          dueDate: choreAssignments.dueDate,
          autoAssigned: choreAssignments.autoAssigned,
          profileName: familyProfiles.name,
          profileColor: familyProfiles.color,
          profileIcon: familyProfiles.icon,
        })
        .from(choreAssignments)
        .innerJoin(familyProfiles, eq(familyProfiles.id, choreAssignments.profileId))
        .innerJoin(chores, eq(chores.id, choreAssignments.choreId))
        .where(eq(chores.householdId, householdId))
        .orderBy(desc(choreAssignments.assignedAt));

      // Get rotation orders
      const rotations = await fastify.db
        .select({
          choreId: choreRotationOrder.choreId,
          profileId: choreRotationOrder.profileId,
          position: choreRotationOrder.position,
          profileName: familyProfiles.name,
          profileColor: familyProfiles.color,
        })
        .from(choreRotationOrder)
        .innerJoin(familyProfiles, eq(familyProfiles.id, choreRotationOrder.profileId))
        .innerJoin(chores, eq(chores.id, choreRotationOrder.choreId))
        .where(eq(chores.householdId, householdId))
        .orderBy(asc(choreRotationOrder.position));

      // Group assignments and rotations by chore
      const choreData = allChores.map((chore) => ({
        ...chore,
        assignments: assignments.filter((a) => a.choreId === chore.id),
        currentAssignment: assignments.find(
          (a) => a.choreId === chore.id && a.completedAt === null
        ),
        rotationOrder: rotations
          .filter((r) => r.choreId === chore.id)
          .sort((a, b) => a.position - b.position),
      }));

      return { success: true, chores: choreData };
    }
  );

  // Create a chore
  fastify.post(
    "/",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Create a new chore with rotation order",
        tags: ["Chores"],
        body: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
            icon: { type: "string" },
            frequency: { type: "string", enum: ["daily", "weekly", "biweekly", "monthly"] },
            rotateDay: { type: "number", minimum: 0, maximum: 6 },
            profileIds: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const householdId = await requireUserHouseholdId(fastify.db, user.id);
      const body = request.body as {
        name: string;
        icon?: string;
        frequency?: "daily" | "weekly" | "biweekly" | "monthly";
        rotateDay?: number;
        profileIds?: string[];
      };

      const [chore] = await fastify.db
        .insert(chores)
        .values({
          householdId,
          name: body.name,
          icon: body.icon,
          frequency: body.frequency ?? "weekly",
          rotateDay: body.rotateDay ?? 0,
        })
        .returning();

      // Set rotation order if profiles provided
      if (chore && body.profileIds && body.profileIds.length > 0) {
        await fastify.db.insert(choreRotationOrder).values(
          body.profileIds.map((profileId, index) => ({
            choreId: chore!.id,
            profileId,
            position: index,
          }))
        );

        // Create initial assignment for first profile
        const today = new Date().toISOString().split("T")[0]!;
        await fastify.db.insert(choreAssignments).values({
          choreId: chore!.id,
          profileId: body.profileIds[0]!,
          dueDate: today,
          autoAssigned: true,
        });
      }

      return { success: true, chore };
    }
  );

  // Update a chore
  fastify.put(
    "/:id",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Update a chore",
        tags: ["Chores"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            icon: { type: "string" },
            frequency: { type: "string" },
            rotateDay: { type: "number" },
            profileIds: { type: "array", items: { type: "string" } },
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
        name?: string;
        icon?: string;
        frequency?: "daily" | "weekly" | "biweekly" | "monthly";
        rotateDay?: number;
        profileIds?: string[];
      };

      // Verify chore belongs to household
      const [existing] = await fastify.db
        .select()
        .from(chores)
        .where(and(eq(chores.id, id), eq(chores.householdId, householdId)))
        .limit(1);

      if (!existing) {
        throw fastify.httpErrors.notFound("Chore not found");
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (body.name !== undefined) updates.name = body.name;
      if (body.icon !== undefined) updates.icon = body.icon;
      if (body.frequency !== undefined) updates.frequency = body.frequency;
      if (body.rotateDay !== undefined) updates.rotateDay = body.rotateDay;

      await fastify.db.update(chores).set(updates).where(eq(chores.id, id));

      // Update rotation order if provided
      if (body.profileIds) {
        await fastify.db
          .delete(choreRotationOrder)
          .where(eq(choreRotationOrder.choreId, id));

        if (body.profileIds.length > 0) {
          await fastify.db.insert(choreRotationOrder).values(
            body.profileIds.map((profileId, index) => ({
              choreId: id,
              profileId,
              position: index,
            }))
          );
        }
      }

      return { success: true };
    }
  );

  // Delete a chore
  fastify.delete(
    "/:id",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Delete a chore",
        tags: ["Chores"],
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

      await fastify.db
        .delete(chores)
        .where(and(eq(chores.id, id), eq(chores.householdId, householdId)));

      return { success: true };
    }
  );

  // Mark current assignment as complete
  fastify.post(
    "/:id/complete",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Mark current chore assignment as complete",
        tags: ["Chores"],
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

      // Verify chore belongs to household
      const [chore] = await fastify.db
        .select()
        .from(chores)
        .where(and(eq(chores.id, id), eq(chores.householdId, householdId)))
        .limit(1);

      if (!chore) {
        throw fastify.httpErrors.notFound("Chore not found");
      }

      // Find current incomplete assignment
      const [assignment] = await fastify.db
        .select()
        .from(choreAssignments)
        .where(
          and(
            eq(choreAssignments.choreId, id),
            isNull(choreAssignments.completedAt)
          )
        )
        .orderBy(desc(choreAssignments.assignedAt))
        .limit(1);

      if (!assignment) {
        throw fastify.httpErrors.notFound("No active assignment found");
      }

      await fastify.db
        .update(choreAssignments)
        .set({ completedAt: new Date() })
        .where(eq(choreAssignments.id, assignment.id));

      return { success: true };
    }
  );

  // Manual assign to a profile
  fastify.post(
    "/:id/assign",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Manually assign a chore to a profile",
        tags: ["Chores"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: {
          type: "object",
          required: ["profileId"],
          properties: {
            profileId: { type: "string" },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const householdId = await requireUserHouseholdId(fastify.db, user.id);
      const { id } = request.params as { id: string };
      const { profileId } = request.body as { profileId: string };

      // Verify chore belongs to household
      const [chore] = await fastify.db
        .select()
        .from(chores)
        .where(and(eq(chores.id, id), eq(chores.householdId, householdId)))
        .limit(1);

      if (!chore) {
        throw fastify.httpErrors.notFound("Chore not found");
      }

      const today = new Date().toISOString().split("T")[0]!;
      const [assignment] = await fastify.db
        .insert(choreAssignments)
        .values({
          choreId: id,
          profileId,
          dueDate: today,
          autoAssigned: false,
        })
        .returning();

      return { success: true, assignment };
    }
  );

  // Trigger rotation check
  fastify.post(
    "/rotate",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Trigger chore rotation check for all chores",
        tags: ["Chores"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const householdId = await requireUserHouseholdId(fastify.db, user.id);

      const allChores = await fastify.db
        .select()
        .from(chores)
        .where(eq(chores.householdId, householdId));

      let rotated = 0;

      for (const chore of allChores) {
        // Get current assignment
        const [currentAssignment] = await fastify.db
          .select()
          .from(choreAssignments)
          .where(eq(choreAssignments.choreId, chore.id))
          .orderBy(desc(choreAssignments.assignedAt))
          .limit(1);

        // Get rotation order
        const rotation = await fastify.db
          .select()
          .from(choreRotationOrder)
          .where(eq(choreRotationOrder.choreId, chore.id))
          .orderBy(asc(choreRotationOrder.position));

        if (rotation.length < 2) continue; // Need at least 2 profiles to rotate

        // Find the next profile in rotation
        const currentProfileId = currentAssignment?.profileId;
        const currentIndex = rotation.findIndex(
          (r) => r.profileId === currentProfileId
        );
        const nextIndex = (currentIndex + 1) % rotation.length;
        const nextProfileId = rotation[nextIndex]!.profileId;

        const today = new Date().toISOString().split("T")[0]!;

        await fastify.db.insert(choreAssignments).values({
          choreId: chore.id,
          profileId: nextProfileId,
          dueDate: today,
          autoAssigned: true,
        });

        rotated++;
      }

      return { success: true, rotated };
    }
  );
};
