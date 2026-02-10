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
            provider: { type: "string", enum: ["google", "microsoft", "caldav", "ics", "sports"] },
            includeHidden: { type: "boolean" },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
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
          isFavorite: cal.isFavorite,
          isReadOnly: cal.isReadOnly,
          syncEnabled: cal.syncEnabled,
          showOnDashboard: cal.showOnDashboard,
          lastSyncAt: cal.lastSyncAt,
          visibility: cal.visibility ?? { week: false, month: false, day: false, popup: true, screensaver: false },
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
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
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
            isFavorite: { type: "boolean" },
            showOnDashboard: { type: "boolean" },
            visibility: {
              type: "object",
              properties: {
                week: { type: "boolean" },
                month: { type: "boolean" },
                day: { type: "boolean" },
                popup: { type: "boolean" },
                screensaver: { type: "boolean" },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id } = request.params as { id: string };
      const updates = request.body as Partial<{
        color: string;
        isVisible: boolean;
        syncEnabled: boolean;
        isPrimary: boolean;
        isFavorite: boolean;
        showOnDashboard: boolean;
        visibility: { week: boolean; month: boolean; day: boolean; popup: boolean; screensaver: boolean };
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
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
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

      // Get OAuth token for the provider (only google/microsoft have OAuth)
      const oauthProvider = calendar.provider === "caldav" ? "google" : calendar.provider as "google" | "microsoft";
      const [oauthToken] = await fastify.db
        .select()
        .from(oauthTokens)
        .where(
          and(
            eq(oauthTokens.userId, user.id),
            eq(oauthTokens.provider, oauthProvider)
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
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

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

  // Subscribe to ICS calendar feed
  fastify.post(
    "/ics/subscribe",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Subscribe to an ICS calendar feed",
        tags: ["Calendars"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        body: {
          type: "object",
          properties: {
            url: { type: "string", format: "uri" },
            name: { type: "string" },
          },
          required: ["url"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { url, name } = request.body as { url: string; name?: string };

      // Normalize webcal:// URLs to https://
      const normalizedUrl = url.replace(/^webcal:\/\//i, "https://");

      // Check if already subscribed to this URL
      const existing = await fastify.db
        .select()
        .from(calendars)
        .where(
          and(
            eq(calendars.userId, user!.id),
            eq(calendars.provider, "ics"),
            eq(calendars.sourceUrl, normalizedUrl)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return reply.badRequest("Already subscribed to this calendar");
      }

      // Fetch the ICS file to validate it and extract the calendar name
      let calendarName = name || "ICS Calendar";
      try {
        const response = await fetch(normalizedUrl, {
          headers: {
            "User-Agent": "OpenFrame/1.0",
          },
        });

        if (!response.ok) {
          return reply.badRequest(`Failed to fetch calendar: ${response.statusText}`);
        }

        const icsContent = await response.text();

        // Basic validation - check if it looks like an ICS file
        if (!icsContent.includes("BEGIN:VCALENDAR")) {
          return reply.badRequest("Invalid ICS file: Not a valid iCalendar format");
        }

        // Extract calendar name from X-WR-CALNAME if not provided
        if (!name) {
          const nameMatch = icsContent.match(/X-WR-CALNAME:(.+)/);
          if (nameMatch?.[1]) {
            calendarName = nameMatch[1].trim();
          }
        }
      } catch (err) {
        return reply.badRequest(`Failed to fetch calendar: ${err instanceof Error ? err.message : "Unknown error"}`);
      }

      // Create the calendar subscription
      const [calendar] = await fastify.db
        .insert(calendars)
        .values({
          userId: user!.id,
          provider: "ics",
          externalId: normalizedUrl, // Use URL as external ID for ICS
          name: calendarName,
          sourceUrl: normalizedUrl,
          isVisible: true,
          syncEnabled: true,
          isReadOnly: true, // ICS feeds are read-only
        })
        .returning();

      if (!calendar) {
        return reply.internalServerError("Failed to create calendar");
      }

      // Trigger initial sync
      const { syncICSCalendar } = await import("../../services/calendar-sync/ics.js");
      await syncICSCalendar(fastify.db, calendar.id, normalizedUrl);

      // Update last sync time
      await fastify.db
        .update(calendars)
        .set({ lastSyncAt: new Date() })
        .where(eq(calendars.id, calendar.id));

      return {
        success: true,
        data: {
          id: calendar.id,
          name: calendar.name,
          provider: calendar.provider,
          sourceUrl: calendar.sourceUrl,
        },
      };
    }
  );

  // Delete a calendar
  fastify.delete(
    "/:id",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Delete a calendar",
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
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id } = request.params as { id: string };

      const [deleted] = await fastify.db
        .delete(calendars)
        .where(and(eq(calendars.id, id), eq(calendars.userId, user!.id)))
        .returning();

      if (!deleted) {
        return reply.notFound("Calendar not found");
      }

      return {
        success: true,
        message: "Calendar deleted",
      };
    }
  );
};
