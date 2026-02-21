import type { FastifyPluginAsync } from "fastify";
import { eq, and, asc } from "drizzle-orm";
import { matterDevices, homeAssistantRooms } from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";
import type { MatterCommissionRequest, MatterCommandRequest, MatterDeviceAttributes } from "@openframe/shared";

export const matterRoutes: FastifyPluginAsync = async (fastify) => {
  // Helper: return 503 if Matter controller is not initialized
  function requireController() {
    if (!fastify.matterController.isInitialized()) {
      throw fastify.httpErrors.createError(503, "Matter controller is not initialized");
    }
  }

  // ==================== STATUS ====================

  fastify.get(
    "/status",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get Matter controller status",
        tags: ["Matter"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const devices = await fastify.db
        .select()
        .from(matterDevices)
        .where(eq(matterDevices.userId, user.id));

      return {
        success: true,
        data: {
          initialized: fastify.matterController.isInitialized(),
          deviceCount: devices.length,
        },
      };
    }
  );

  // ==================== COMMISSION ====================

  fastify.post(
    "/commission",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Commission (pair) a new Matter device",
        tags: ["Matter"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            pairingCode: { type: "string" },
            displayName: { type: "string" },
          },
          required: ["pairingCode"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      requireController();

      const { pairingCode, displayName } = request.body as MatterCommissionRequest;

      const result = await fastify.matterController.commissionDevice(pairingCode);

      const [device] = await fastify.db
        .insert(matterDevices)
        .values({
          userId: user.id,
          nodeId: result.nodeId,
          vendorName: result.vendorName,
          productName: result.productName,
          deviceType: result.deviceType,
          displayName: displayName || result.productName || `Device ${result.nodeId}`,
          isReachable: true,
          lastSeenAt: new Date(),
        })
        .returning();

      return reply.status(201).send({
        success: true,
        data: device,
      });
    }
  );

  // ==================== DEVICES ====================

  // List all devices with live state
  fastify.get(
    "/devices",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "List all Matter devices with live state",
        tags: ["Matter"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const devices = await fastify.db
        .select()
        .from(matterDevices)
        .where(eq(matterDevices.userId, user.id))
        .orderBy(asc(matterDevices.sortOrder));

      // If controller is available, enrich with live state
      let stateMap = new Map<string, { isReachable: boolean; attributes: MatterDeviceAttributes }>();
      if (fastify.matterController.isInitialized()) {
        try {
          const states = await fastify.matterController.getAllDeviceStates();
          for (const s of states) {
            stateMap.set(s.nodeId, { isReachable: s.isReachable, attributes: s.attributes });
          }
        } catch {
          // Non-fatal
        }
      }

      const enriched = devices.map((d) => {
        const live = stateMap.get(d.nodeId);
        return {
          ...d,
          state: live
            ? { isReachable: live.isReachable, attributes: live.attributes }
            : { isReachable: d.isReachable, attributes: {} },
        };
      });

      return {
        success: true,
        data: enriched,
      };
    }
  );

  // Get single device with live state
  fastify.get(
    "/devices/:id",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get a single Matter device with live state",
        tags: ["Matter"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: { id: { type: "string", format: "uuid" } },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id } = request.params as { id: string };

      const [device] = await fastify.db
        .select()
        .from(matterDevices)
        .where(and(eq(matterDevices.id, id), eq(matterDevices.userId, user.id)))
        .limit(1);

      if (!device) {
        return reply.notFound("Device not found");
      }

      let liveState = { isReachable: device.isReachable, attributes: {} as MatterDeviceAttributes };
      if (fastify.matterController.isInitialized()) {
        try {
          const state = await fastify.matterController.getDeviceState(device.nodeId);
          liveState = { isReachable: state.isReachable, attributes: state.attributes };
        } catch {
          // Non-fatal
        }
      }

      return {
        success: true,
        data: { ...device, state: liveState },
      };
    }
  );

  // Update device metadata
  fastify.patch(
    "/devices/:id",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Update Matter device metadata",
        tags: ["Matter"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: { id: { type: "string", format: "uuid" } },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id } = request.params as { id: string };
      const body = request.body as {
        displayName?: string;
        roomId?: string | null;
        sortOrder?: number;
      };

      const [existing] = await fastify.db
        .select()
        .from(matterDevices)
        .where(and(eq(matterDevices.id, id), eq(matterDevices.userId, user.id)))
        .limit(1);

      if (!existing) {
        return reply.notFound("Device not found");
      }

      // Verify room exists if provided
      if (body.roomId) {
        const [room] = await fastify.db
          .select()
          .from(homeAssistantRooms)
          .where(
            and(
              eq(homeAssistantRooms.id, body.roomId),
              eq(homeAssistantRooms.userId, user.id)
            )
          )
          .limit(1);

        if (!room) {
          return reply.notFound("Room not found");
        }
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (body.displayName !== undefined) updates.displayName = body.displayName;
      if (body.roomId !== undefined) updates.roomId = body.roomId;
      if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;

      const [updated] = await fastify.db
        .update(matterDevices)
        .set(updates)
        .where(eq(matterDevices.id, id))
        .returning();

      return {
        success: true,
        data: updated,
      };
    }
  );

  // Decommission and delete a device
  fastify.delete(
    "/devices/:id",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Decommission and remove a Matter device",
        tags: ["Matter"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: { id: { type: "string", format: "uuid" } },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id } = request.params as { id: string };

      const [device] = await fastify.db
        .select()
        .from(matterDevices)
        .where(and(eq(matterDevices.id, id), eq(matterDevices.userId, user.id)))
        .limit(1);

      if (!device) {
        return reply.notFound("Device not found");
      }

      // Try to decommission from fabric
      if (fastify.matterController.isInitialized()) {
        try {
          await fastify.matterController.decommissionDevice(device.nodeId);
        } catch (error) {
          fastify.log.warn(
            { err: error, nodeId: device.nodeId },
            "Failed to decommission device from fabric (may already be removed)"
          );
        }
      }

      // Remove from DB
      await fastify.db
        .delete(matterDevices)
        .where(eq(matterDevices.id, id));

      return { success: true };
    }
  );

  // Send command to a device
  fastify.post(
    "/devices/:id/command",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Send a command to a Matter device",
        tags: ["Matter"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: { id: { type: "string", format: "uuid" } },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            clusterId: { type: "string" },
            commandId: { type: "string" },
            payload: { type: "object" },
          },
          required: ["clusterId", "commandId"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      requireController();

      const { id } = request.params as { id: string };
      const { clusterId, commandId, payload } = request.body as MatterCommandRequest;

      const [device] = await fastify.db
        .select()
        .from(matterDevices)
        .where(and(eq(matterDevices.id, id), eq(matterDevices.userId, user.id)))
        .limit(1);

      if (!device) {
        return reply.notFound("Device not found");
      }

      await fastify.matterController.sendCommand(device.nodeId, clusterId, commandId, payload);

      return { success: true };
    }
  );

  // Bulk reorder devices
  fastify.post(
    "/devices/reorder",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Reorder Matter devices",
        tags: ["Matter"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            deviceIds: {
              type: "array",
              items: { type: "string", format: "uuid" },
            },
          },
          required: ["deviceIds"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { deviceIds } = request.body as { deviceIds: string[] };

      for (let i = 0; i < deviceIds.length; i++) {
        await fastify.db
          .update(matterDevices)
          .set({ sortOrder: i, updatedAt: new Date() })
          .where(
            and(
              eq(matterDevices.id, deviceIds[i]!),
              eq(matterDevices.userId, user.id)
            )
          );
      }

      return { success: true };
    }
  );
};
