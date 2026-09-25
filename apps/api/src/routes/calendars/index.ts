import type { FastifyPluginAsync } from "fastify";
import { eq, and } from "drizzle-orm";
import { calendars, oauthTokens } from "@openframe/database/schema";
import { calendarQuerySchema, syncCalendarSchema } from "@openframe/shared/validators";
import { getCurrentUser } from "../../plugins/auth.js";
import { MissingCalendarScopeError, syncAllForUser, syncCalendarNow } from "../../services/calendar-sync/index.js";
import { CalendarSyncError, describeSyncError } from "../../services/calendar-sync/errors.js";
import { fetchIcsFeed, normalizeFeedUrl } from "../../services/calendar-sync/ics.js";
import { parseIcs } from "../../services/calendar-sync/ics-parser.js";
import { SHOWN_CALENDAR_VISIBILITY } from "../../lib/calendar-visibility.js";

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
            provider: { type: "string", enum: ["google", "microsoft", "caldav", "ics", "sports", "homeassistant", "local"] },
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

      const conditions = query.provider
        ? and(eq(calendars.userId, user.id), eq(calendars.provider, query.provider))
        : eq(calendars.userId, user.id);

      const results = await fastify.db
        .select({
          calendar: calendars,
          accountName: oauthTokens.accountName,
          accountEmail: oauthTokens.externalAccountId,
        })
        .from(calendars)
        .leftJoin(
          oauthTokens,
          and(eq(calendars.oauthTokenId, oauthTokens.id), eq(oauthTokens.userId, calendars.userId))
        )
        .where(conditions);

      const filtered = query.includeHidden
        ? results
        : results.filter((r) => r.calendar.isVisible);

      return {
        success: true,
        data: filtered.map((r) => ({
          id: r.calendar.id,
          provider: r.calendar.provider,
          name: r.calendar.displayName || r.calendar.name,
          displayName: r.calendar.displayName,
          originalName: r.calendar.displayName ? r.calendar.name : null,
          description: r.calendar.description,
          color: r.calendar.color,
          isVisible: r.calendar.isVisible,
          isPrimary: r.calendar.isPrimary,
          isFavorite: r.calendar.isFavorite,
          isReadOnly: r.calendar.isReadOnly,
          syncEnabled: r.calendar.syncEnabled,
          showOnDashboard: r.calendar.showOnDashboard,
          kioskEnabled: r.calendar.kioskEnabled,
          lastSyncAt: r.calendar.lastSyncAt,
          lastSyncError: r.calendar.lastSyncError,
          lastSyncErrorAt: r.calendar.lastSyncErrorAt,
          visibility: r.calendar.visibility ?? { week: false, month: false, day: false, popup: true, screensaver: false },
          oauthTokenId: r.calendar.oauthTokenId,
          accountLabel: r.accountName || r.accountEmail || null,
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
            name: { type: "string", minLength: 1, maxLength: 100 },
            displayName: { type: ["string", "null"], maxLength: 100 },
            color: { type: "string" },
            isVisible: { type: "boolean" },
            syncEnabled: { type: "boolean" },
            syncInterval: { type: ["integer", "null"], minimum: 1, maximum: 1440 },
            isPrimary: { type: "boolean" },
            isFavorite: { type: "boolean" },
            showOnDashboard: { type: "boolean" },
            kioskEnabled: { type: "boolean" },
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
      const body = request.body as Partial<{
        name: string;
        displayName: string | null;
        color: string;
        isVisible: boolean;
        syncEnabled: boolean;
        syncInterval: number | null;
        isPrimary: boolean;
        isFavorite: boolean;
        showOnDashboard: boolean;
        kioskEnabled: boolean;
        visibility: { week: boolean; month: boolean; day: boolean; popup: boolean; screensaver: boolean };
      }>;

      // Only the settings above: the body schema doesn't strip other properties
      const updates: Partial<typeof calendars.$inferInsert> = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.displayName !== undefined) updates.displayName = body.displayName;
      if (body.color !== undefined) updates.color = body.color;
      if (body.isVisible !== undefined) updates.isVisible = body.isVisible;
      if (body.syncEnabled !== undefined) updates.syncEnabled = body.syncEnabled;
      if (body.syncInterval !== undefined) updates.syncInterval = body.syncInterval;
      if (body.isPrimary !== undefined) updates.isPrimary = body.isPrimary;
      if (body.isFavorite !== undefined) updates.isFavorite = body.isFavorite;
      if (body.showOnDashboard !== undefined) updates.showOnDashboard = body.showOnDashboard;
      if (body.kioskEnabled !== undefined) updates.kioskEnabled = body.kioskEnabled;
      if (body.visibility !== undefined) updates.visibility = body.visibility;

      // Only allow name updates on local calendars
      if (updates.name !== undefined) {
        const [existing] = await fastify.db
          .select()
          .from(calendars)
          .where(and(eq(calendars.id, id), eq(calendars.userId, user.id)))
          .limit(1);
        if (!existing || existing.provider !== "local") {
          throw fastify.httpErrors.badRequest("Name can only be updated on local calendars");
        }
      }

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
        data: {
          ...calendar,
          name: calendar.displayName || calendar.name,
          originalName: calendar.displayName ? calendar.name : null,
        },
      };
    }
  );

  // Create a local calendar
  fastify.post(
    "/local",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Create a local calendar",
        tags: ["Calendars"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            color: { type: "string" },
          },
          required: ["name"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { name, color } = request.body as { name: string; color?: string };

      const [calendar] = await fastify.db
        .insert(calendars)
        .values({
          userId: user.id,
          provider: "local",
          externalId: `local_${crypto.randomUUID()}`,
          name,
          color: color || "#3b82f6",
          isVisible: true,
          visibility: SHOWN_CALENDAR_VISIBILITY,
          syncEnabled: false,
          isReadOnly: false,
        })
        .returning();

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

      let outcome;
      try {
        outcome = await syncCalendarNow(fastify.db, calendar, { fullSync });
      } catch (err) {
        if (err instanceof MissingCalendarScopeError) {
          return reply.code(403).send({
            success: false,
            error: "insufficient_scope",
            provider: err.provider,
            requiredFeature: "calendar",
            message: err.message,
          });
        }
        if (err instanceof CalendarSyncError && err.status === 400) {
          return reply.badRequest(err.message);
        }
        throw err;
      }

      if (outcome.error) {
        // 502: the provider failed, not this request (and never 401, which
        // clients treat as an expired session)
        return reply.code(502).send({ success: false, error: "sync_failed", message: outcome.error });
      }

      const [updated] = await fastify.db
        .select({ lastSyncAt: calendars.lastSyncAt })
        .from(calendars)
        .where(eq(calendars.id, id))
        .limit(1);

      return {
        success: true,
        message: "Calendar synced",
        data: { id, lastSyncAt: updated?.lastSyncAt ?? null },
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

      const outcomes = await syncAllForUser(fastify.db, user.id);
      const failed = outcomes.filter((o) => o.error);

      return {
        success: true,
        message:
          failed.length === 0
            ? "All calendars synced"
            : `${failed.length} of ${outcomes.length} calendars failed to sync`,
        data: { synced: outcomes.length - failed.length, failed },
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

      const normalizedUrl = normalizeFeedUrl(url);

      // Check if already subscribed to this URL
      const existing = await fastify.db
        .select()
        .from(calendars)
        .where(
          and(
            eq(calendars.userId, user.id),
            eq(calendars.provider, "ics"),
            eq(calendars.sourceUrl, normalizedUrl)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return reply.badRequest("Already subscribed to this calendar");
      }

      // Fetch the feed to validate it and read its name
      let calendarName = name?.trim() || "ICS Calendar";
      try {
        const feed = parseIcs(await fetchIcsFeed(normalizedUrl));
        if (!name?.trim() && feed.name) calendarName = feed.name;
      } catch (err) {
        return reply.badRequest(`Failed to fetch calendar: ${describeSyncError(err)}`);
      }

      const [calendar] = await fastify.db
        .insert(calendars)
        .values({
          userId: user.id,
          provider: "ics",
          externalId: normalizedUrl, // the URL identifies an ICS subscription
          name: calendarName,
          sourceUrl: normalizedUrl,
          isVisible: true,
          visibility: SHOWN_CALENDAR_VISIBILITY,
          syncEnabled: true,
          isReadOnly: true, // ICS feeds are read-only
        })
        .returning();

      if (!calendar) {
        return reply.internalServerError("Failed to create calendar");
      }

      // Initial sync; a failure is recorded on the calendar and retried
      await syncCalendarNow(fastify.db, calendar);

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
        .where(and(eq(calendars.id, id), eq(calendars.userId, user.id)))
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
