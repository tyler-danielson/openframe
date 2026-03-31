import type { FastifyPluginAsync } from "fastify";
import { eq, and, ne, desc, sql } from "drizzle-orm";
import { trackedPackages } from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";
import { requireUserHouseholdId } from "../../lib/household.js";

export const packageRoutes: FastifyPluginAsync = async (fastify) => {
  // List tracked packages
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "List tracked packages for household",
        tags: ["Packages"],
        querystring: {
          type: "object",
          properties: {
            status: { type: "string" },
            includeArchived: { type: "boolean" },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const householdId = await requireUserHouseholdId(fastify.db, user.id);
      const query = request.query as { status?: string; includeArchived?: boolean };

      let conditions = [eq(trackedPackages.householdId, householdId)];

      if (!query.includeArchived) {
        conditions.push(eq(trackedPackages.isArchived, false));
      }

      const packages = await fastify.db
        .select()
        .from(trackedPackages)
        .where(and(...conditions))
        .orderBy(desc(trackedPackages.updatedAt));

      // Filter by status in JS if requested (avoids dynamic SQL)
      const filtered = query.status
        ? packages.filter((p) => p.status === query.status)
        : packages;

      return { success: true, packages: filtered };
    }
  );

  // Get package summary (counts by status)
  fastify.get(
    "/summary",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get package count by status",
        tags: ["Packages"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const householdId = await requireUserHouseholdId(fastify.db, user.id);

      const packages = await fastify.db
        .select({
          status: trackedPackages.status,
        })
        .from(trackedPackages)
        .where(
          and(
            eq(trackedPackages.householdId, householdId),
            eq(trackedPackages.isArchived, false)
          )
        );

      const summary: Record<string, number> = {};
      for (const pkg of packages) {
        summary[pkg.status] = (summary[pkg.status] || 0) + 1;
      }

      return {
        success: true,
        summary,
        total: packages.length,
      };
    }
  );

  // Add a package (manual tracking)
  fastify.post(
    "/",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Add a package for tracking",
        tags: ["Packages"],
        body: {
          type: "object",
          required: ["trackingNumber", "carrier"],
          properties: {
            trackingNumber: { type: "string" },
            carrier: { type: "string", enum: ["usps", "ups", "fedex", "amazon", "dhl", "other"] },
            label: { type: "string" },
            expectedDelivery: { type: "string" },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized();

      const householdId = await requireUserHouseholdId(fastify.db, user.id);
      const body = request.body as {
        trackingNumber: string;
        carrier: "usps" | "ups" | "fedex" | "amazon" | "dhl" | "other";
        label?: string;
        expectedDelivery?: string;
      };

      const [pkg] = await fastify.db
        .insert(trackedPackages)
        .values({
          householdId,
          trackingNumber: body.trackingNumber,
          carrier: body.carrier,
          label: body.label,
          expectedDelivery: body.expectedDelivery,
          source: "manual",
        })
        .returning();

      return { success: true, package: pkg };
    }
  );

  // Update a package
  fastify.put(
    "/:id",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Update a tracked package",
        tags: ["Packages"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: {
          type: "object",
          properties: {
            label: { type: "string" },
            carrier: { type: "string" },
            isArchived: { type: "boolean" },
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
        label?: string;
        carrier?: string;
        isArchived?: boolean;
      };

      const [existing] = await fastify.db
        .select()
        .from(trackedPackages)
        .where(and(eq(trackedPackages.id, id), eq(trackedPackages.householdId, householdId)))
        .limit(1);

      if (!existing) {
        throw fastify.httpErrors.notFound("Package not found");
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (body.label !== undefined) updates.label = body.label;
      if (body.carrier !== undefined) updates.carrier = body.carrier;
      if (body.isArchived !== undefined) updates.isArchived = body.isArchived;

      const [pkg] = await fastify.db
        .update(trackedPackages)
        .set(updates)
        .where(eq(trackedPackages.id, id))
        .returning();

      return { success: true, package: pkg };
    }
  );

  // Delete a package
  fastify.delete(
    "/:id",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Remove a tracked package",
        tags: ["Packages"],
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
        .delete(trackedPackages)
        .where(and(eq(trackedPackages.id, id), eq(trackedPackages.householdId, householdId)));

      return { success: true };
    }
  );

  // Force refresh a package status (placeholder — actual carrier API integration TBD)
  fastify.post(
    "/:id/refresh",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Force refresh package tracking status",
        tags: ["Packages"],
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
        .from(trackedPackages)
        .where(and(eq(trackedPackages.id, id), eq(trackedPackages.householdId, householdId)))
        .limit(1);

      if (!existing) {
        throw fastify.httpErrors.notFound("Package not found");
      }

      // TODO: Implement actual carrier API lookup based on existing.carrier
      // For now, just update the timestamp
      await fastify.db
        .update(trackedPackages)
        .set({ updatedAt: new Date() })
        .where(eq(trackedPackages.id, id));

      return {
        success: true,
        message: "Carrier API integration pending. Status unchanged.",
      };
    }
  );
};
