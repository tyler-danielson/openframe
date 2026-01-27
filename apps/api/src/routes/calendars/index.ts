import type { FastifyPluginAsync } from "fastify";
import { eq, and } from "drizzle-orm";
import { calendars, oauthTokens } from "@openframe/database/schema";
import { calendarQuerySchema, syncCalendarSchema } from "@openframe/shared/validators";
import { getCurrentUser } from "../../plugins/auth.js";
import { syncGoogleCalendars } from "../../services/calendar-sync/google.js";

export const calendarRoutes: FastifyPluginAsync = async (fastify) => {
  // List calendars
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "List all calendars",
        tags: ["Calendars"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        querystring: {
          type: "object",
          properties: {
            provider: { type: "string", enum: ["google", "microsoft", "caldav"] },
            includeHidden: { type: "boolean" },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      const query = calendarQuerySchema.parse(request.query);

      let dbQuery = fastify.db
        .select()
        .from(calendars)
        .where(eq(calendars.userId, user.id));

      if (query.provider) {
        dbQuery = fastify.db
          .select()
          .from(calendars)
          .where(
            and(
              eq(calendars.userId, user.id),
              eq(calendars.provider, query.provider)
            )
          );
      }

      const results = await dbQuery;
      const filtered = query.includeHidden
        ? results
        : results.filter((c) => c.isVisible);

      return {
        success: true,
        data: filtered.map((cal) => ({
          id: cal.id,
          provider: cal.provider,
          name: cal.name,
          description: cal.description,
          color: cal.color,
          isVisible: cal.isVisible,
          isPrimary: cal.isPrimary,
          isReadOnly: cal.isReadOnly,
          syncEnabled: cal.syncEnabled,
          lastSyncAt: cal.lastSyncAt,
        })),
      };
    }
  );

  // Get single calendar
  fastify.get(
    "/:id",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get a single calendar",
        tags: ["Calendars"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      const { id } = request.params as { id: string };

      const [calendar] = await fastify.db
        .select()
        .from(calendars)
        .where(and(eq(calendars.id, id), eq(calendars.userId, user.id)))
        .limit(1);

      if (!calendar) {
        return reply.notFound("Calendar not found");
      }

      return {
        success: true,
        data: calendar,
      };
    }
  );

  // Update calendar settings
  fastify.patch(
    "/:id",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Update calendar settings",
        tags: ["Calendars"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            color: { type: "string" },
            isVisible: { type: "boolean" },
            syncEnabled: { type: "boolean" },
            isPrimary: { type: "boolean" },
          },
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      const { id } = request.params as { id: string };
      const updates = request.body as Partial<{
        color: string;
        isVisible: boolean;
        syncEnabled: boolean;
        isPrimary: boolean;
      }>;

      // If setting this calendar as primary, unset isPrimary on all other calendars first
      if (updates.isPrimary === true) {
        await fastify.db
          .update(calendars)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(eq(calendars.userId, user.id));
      }

      const [calendar] = await fastify.db
        .update(calendars)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(eq(calendars.id, id), eq(calendars.userId, user.id)))
        .returning();

      if (!calendar) {
        return reply.notFound("Calendar not found");
      }

      return {
        success: true,
        data: calendar,
      };
    }
  );

  // Trigger calendar sync
  fastify.post(
    "/:id/sync",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Trigger calendar sync",
        tags: ["Calendars"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            fullSync: { type: "boolean" },
          },
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      const { id } = request.params as { id: string };
      const { fullSync } = syncCalendarSchema.parse(request.body ?? {});

      const [calendar] = await fastify.db
        .select()
        .from(calendars)
        .where(and(eq(calendars.id, id), eq(calendars.userId, user.id)))
        .limit(1);

      if (!calendar) {
        return reply.notFound("Calendar not found");
      }

      // Get OAuth token for the provider
      const [oauthToken] = await fastify.db
        .select()
        .from(oauthTokens)
        .where(
          and(
            eq(oauthTokens.userId, user.id),
            eq(oauthTokens.provider, calendar.provider === "caldav" ? "google" : calendar.provider)
          )
        )
        .limit(1);

      if (!oauthToken) {
        return reply.badRequest("No OAuth token found for this calendar provider");
      }

      // Perform sync based on provider
      if (calendar.provider === "google") {
        await syncGoogleCalendars(
          fastify.db,
          user.id,
          oauthToken,
          fullSync ? undefined : calendar.syncToken ?? undefined,
          calendar.externalId
        );
      }

      // Update last sync time
      await fastify.db
        .update(calendars)
        .set({ lastSyncAt: new Date(), updatedAt: new Date() })
        .where(eq(calendars.id, id));

      return {
        success: true,
        message: "Sync triggered",
      };
    }
  );

  // Sync all calendars
  fastify.post(
    "/sync-all",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Sync all calendars",
        tags: ["Calendars"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);

      // Get all OAuth tokens
      const tokens = await fastify.db
        .select()
        .from(oauthTokens)
        .where(eq(oauthTokens.userId, user.id));

      for (const token of tokens) {
        if (token.provider === "google") {
          await syncGoogleCalendars(fastify.db, user.id, token);
        }
        // Add Microsoft sync here
      }

      return {
        success: true,
        message: "Sync started for all calendars",
      };
    }
  );
};
