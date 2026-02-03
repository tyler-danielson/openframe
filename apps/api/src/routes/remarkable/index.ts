/**
 * reMarkable Integration Routes
 *
 * Provides endpoints for:
 * - Device connection/disconnection
 * - Daily agenda push
 * - Handwritten note processing
 * - Settings management
 */

import type { FastifyPluginAsync } from "fastify";
import { eq, and } from "drizzle-orm";
import { format, startOfDay, endOfDay } from "date-fns";
import {
  remarkableConfig,
  remarkableAgendaSettings,
  remarkableDocuments,
  remarkableEventSource,
  calendars,
  events,
} from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";
import { getRemarkableClient } from "../../services/remarkable/client.js";
import {
  generateAgendaPdf,
  getAgendaFilename,
  type AgendaEvent,
} from "../../services/remarkable/agenda-generator.js";
import {
  processRemarkableNote,
  syncRemarkableDocuments,
} from "../../services/remarkable/note-processor.js";

export const remarkableRoutes: FastifyPluginAsync = async (fastify) => {
  const { authenticate } = fastify;

  // POST /api/v1/remarkable/connect - Register with one-time code
  fastify.post<{
    Body: { code: string };
  }>(
    "/connect",
    {
      preHandler: [authenticate],
      schema: {
        description: "Connect to reMarkable cloud using one-time code from my.remarkable.com",
        tags: ["reMarkable"],
        body: {
          type: "object",
          properties: {
            code: {
              type: "string",
              description: "8-character one-time code from my.remarkable.com/device/desktop/connect",
            },
          },
          required: ["code"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      const { code } = request.body;

      // Validate code format (8 alphanumeric characters)
      if (!/^[a-zA-Z0-9]{8}$/.test(code)) {
        return reply.badRequest("Invalid code format. Expected 8-character code from my.remarkable.com");
      }

      try {
        const client = getRemarkableClient(fastify, user.id);
        await client.connect(code);

        // Create default agenda settings
        const [existingSettings] = await fastify.db
          .select()
          .from(remarkableAgendaSettings)
          .where(eq(remarkableAgendaSettings.userId, user.id))
          .limit(1);

        if (!existingSettings) {
          await fastify.db.insert(remarkableAgendaSettings).values({
            userId: user.id,
            enabled: true,
            pushTime: "06:00",
            folderPath: "/Calendar/Daily Agenda",
          });
        }

        return {
          success: true,
          data: {
            connected: true,
            message: "Successfully connected to reMarkable cloud",
          },
        };
      } catch (error) {
        fastify.log.error({ err: error }, "Failed to connect to reMarkable");
        return reply.badRequest(
          error instanceof Error ? error.message : "Failed to connect to reMarkable"
        );
      }
    }
  );

  // GET /api/v1/remarkable/status - Get connection status
  fastify.get(
    "/status",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get reMarkable connection status",
        tags: ["reMarkable"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);

      const [config] = await fastify.db
        .select()
        .from(remarkableConfig)
        .where(eq(remarkableConfig.userId, user.id))
        .limit(1);

      if (!config) {
        return {
          success: true,
          data: {
            connected: false,
          },
        };
      }

      // Test the connection
      const client = getRemarkableClient(fastify, user.id);
      let isConnected = false;

      try {
        isConnected = await client.testConnection();
      } catch {
        isConnected = false;
      }

      // Update connection status if changed
      if (config.isConnected !== isConnected) {
        await fastify.db
          .update(remarkableConfig)
          .set({ isConnected, updatedAt: new Date() })
          .where(eq(remarkableConfig.id, config.id));
      }

      // Get agenda settings
      const [agendaSettings] = await fastify.db
        .select()
        .from(remarkableAgendaSettings)
        .where(eq(remarkableAgendaSettings.userId, user.id))
        .limit(1);

      return {
        success: true,
        data: {
          connected: isConnected,
          lastSyncAt: config.lastSyncAt?.toISOString() ?? null,
          agendaSettings: agendaSettings
            ? {
                enabled: agendaSettings.enabled,
                pushTime: agendaSettings.pushTime,
                folderPath: agendaSettings.folderPath,
                lastPushAt: agendaSettings.lastPushAt?.toISOString() ?? null,
              }
            : null,
        },
      };
    }
  );

  // POST /api/v1/remarkable/disconnect - Clear connection
  fastify.post(
    "/disconnect",
    {
      preHandler: [authenticate],
      schema: {
        description: "Disconnect from reMarkable cloud",
        tags: ["reMarkable"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);

      const client = getRemarkableClient(fastify, user.id);
      await client.disconnect();

      // Also delete agenda settings
      await fastify.db
        .delete(remarkableAgendaSettings)
        .where(eq(remarkableAgendaSettings.userId, user.id));

      // Delete tracked documents
      await fastify.db
        .delete(remarkableDocuments)
        .where(eq(remarkableDocuments.userId, user.id));

      return {
        success: true,
        data: {
          message: "Disconnected from reMarkable cloud",
        },
      };
    }
  );

  // POST /api/v1/remarkable/test - Test connection
  fastify.post(
    "/test",
    {
      preHandler: [authenticate],
      schema: {
        description: "Test reMarkable cloud connection",
        tags: ["reMarkable"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);

      const client = getRemarkableClient(fastify, user.id);
      const isConnected = await client.testConnection();

      return {
        success: true,
        data: {
          connected: isConnected,
          message: isConnected
            ? "Connection successful"
            : "Connection failed. Please reconnect.",
        },
      };
    }
  );

  // POST /api/v1/remarkable/push-agenda - Manually push today's agenda
  fastify.post<{
    Body: { date?: string };
  }>(
    "/push-agenda",
    {
      preHandler: [authenticate],
      schema: {
        description: "Push daily agenda to reMarkable tablet",
        tags: ["reMarkable"],
        body: {
          type: "object",
          properties: {
            date: {
              type: "string",
              format: "date",
              description: "Date for agenda (defaults to today)",
            },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      const { date: dateStr } = request.body;

      const targetDate = dateStr ? new Date(dateStr) : new Date();
      const start = startOfDay(targetDate);
      const end = endOfDay(targetDate);

      // Get settings
      const [settings] = await fastify.db
        .select()
        .from(remarkableAgendaSettings)
        .where(eq(remarkableAgendaSettings.userId, user.id))
        .limit(1);

      if (!settings) {
        return fastify.httpErrors.badRequest("reMarkable not configured");
      }

      // Get calendars to include
      let calendarIds: string[];
      if (settings.includeCalendarIds && settings.includeCalendarIds.length > 0) {
        calendarIds = settings.includeCalendarIds;
      } else {
        // All visible calendars
        const userCalendars = await fastify.db
          .select()
          .from(calendars)
          .where(and(eq(calendars.userId, user.id), eq(calendars.isVisible, true)));
        calendarIds = userCalendars.map((c) => c.id);
      }

      // Get events for the date
      const dayEvents: AgendaEvent[] = [];
      const calendarMap = new Map<string, typeof calendars.$inferSelect>();

      for (const calId of calendarIds) {
        const [cal] = await fastify.db
          .select()
          .from(calendars)
          .where(eq(calendars.id, calId))
          .limit(1);

        if (cal) {
          calendarMap.set(calId, cal);
        }

        const calEvents = await fastify.db
          .select()
          .from(events)
          .where(
            and(
              eq(events.calendarId, calId),
              eq(events.startTime, start),
              eq(events.endTime, end)
            )
          );

        for (const event of calEvents) {
          dayEvents.push({
            title: event.title,
            startTime: event.startTime,
            endTime: event.endTime,
            isAllDay: event.isAllDay,
            location: event.location,
            description: event.description,
            calendarName: calendarMap.get(calId)?.name,
            calendarColor: calendarMap.get(calId)?.color ?? undefined,
          });
        }
      }

      // Generate PDF
      const pdfBuffer = await generateAgendaPdf({
        date: targetDate,
        events: dayEvents,
        showLocation: settings.showLocation,
        showDescription: settings.showDescription,
        notesLines: settings.notesLines,
        templateStyle: settings.templateStyle as "default" | "minimal" | "detailed",
      });

      // Upload to reMarkable
      const client = getRemarkableClient(fastify, user.id);
      const filename = getAgendaFilename(targetDate);
      const documentId = await client.uploadPdf(pdfBuffer, filename, settings.folderPath);

      // Track the document
      await fastify.db.insert(remarkableDocuments).values({
        userId: user.id,
        documentId,
        documentVersion: 1,
        documentName: filename,
        documentType: "pdf",
        folderPath: settings.folderPath,
        isAgenda: true,
        isProcessed: false,
      });

      // Update last push time
      await fastify.db
        .update(remarkableAgendaSettings)
        .set({ lastPushAt: new Date(), updatedAt: new Date() })
        .where(eq(remarkableAgendaSettings.id, settings.id));

      return {
        success: true,
        data: {
          documentId,
          filename,
          eventCount: dayEvents.length,
          message: `Pushed agenda with ${dayEvents.length} events to reMarkable`,
        },
      };
    }
  );

  // GET /api/v1/remarkable/agenda/preview - Preview agenda PDF
  fastify.get<{
    Querystring: { date?: string };
  }>(
    "/agenda/preview",
    {
      preHandler: [authenticate],
      schema: {
        description: "Generate and return agenda PDF for preview",
        tags: ["reMarkable"],
        querystring: {
          type: "object",
          properties: {
            date: { type: "string", format: "date" },
          },
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      const { date: dateStr } = request.query;

      const targetDate = dateStr ? new Date(dateStr) : new Date();
      const start = startOfDay(targetDate);
      const end = endOfDay(targetDate);

      // Get settings
      const [settings] = await fastify.db
        .select()
        .from(remarkableAgendaSettings)
        .where(eq(remarkableAgendaSettings.userId, user.id))
        .limit(1);

      // Get visible calendars
      const userCalendars = await fastify.db
        .select()
        .from(calendars)
        .where(and(eq(calendars.userId, user.id), eq(calendars.isVisible, true)));

      const calendarIds = userCalendars.map((c) => c.id);

      // Get events for the date
      const dayEvents: AgendaEvent[] = [];

      for (const cal of userCalendars) {
        const calEvents = await fastify.db
          .select()
          .from(events)
          .where(
            and(
              eq(events.calendarId, cal.id),
              eq(events.startTime, start),
              eq(events.endTime, end)
            )
          );

        for (const event of calEvents) {
          dayEvents.push({
            title: event.title,
            startTime: event.startTime,
            endTime: event.endTime,
            isAllDay: event.isAllDay,
            location: event.location,
            description: event.description,
            calendarName: cal.name,
            calendarColor: cal.color ?? undefined,
          });
        }
      }

      // Generate PDF
      const pdfBuffer = await generateAgendaPdf({
        date: targetDate,
        events: dayEvents,
        showLocation: settings?.showLocation ?? true,
        showDescription: settings?.showDescription ?? false,
        notesLines: settings?.notesLines ?? 20,
      });

      // Return PDF with appropriate headers
      return reply
        .type("application/pdf")
        .header(
          "Content-Disposition",
          `inline; filename="${getAgendaFilename(targetDate)}.pdf"`
        )
        .send(pdfBuffer);
    }
  );

  // PATCH /api/v1/remarkable/settings - Update settings
  fastify.patch<{
    Body: {
      enabled?: boolean;
      pushTime?: string;
      folderPath?: string;
      includeCalendarIds?: string[];
      showLocation?: boolean;
      showDescription?: boolean;
      notesLines?: number;
      templateStyle?: string;
    };
  }>(
    "/settings",
    {
      preHandler: [authenticate],
      schema: {
        description: "Update reMarkable agenda settings",
        tags: ["reMarkable"],
        body: {
          type: "object",
          properties: {
            enabled: { type: "boolean" },
            pushTime: { type: "string", pattern: "^\\d{2}:\\d{2}$" },
            folderPath: { type: "string" },
            includeCalendarIds: { type: "array", items: { type: "string" } },
            showLocation: { type: "boolean" },
            showDescription: { type: "boolean" },
            notesLines: { type: "number", minimum: 0, maximum: 50 },
            templateStyle: { type: "string", enum: ["default", "minimal", "detailed"] },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      const updates = request.body;

      const [existing] = await fastify.db
        .select()
        .from(remarkableAgendaSettings)
        .where(eq(remarkableAgendaSettings.userId, user.id))
        .limit(1);

      if (!existing) {
        // Create settings if they don't exist
        await fastify.db.insert(remarkableAgendaSettings).values({
          userId: user.id,
          ...updates,
        });
      } else {
        await fastify.db
          .update(remarkableAgendaSettings)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(remarkableAgendaSettings.id, existing.id));
      }

      // Return updated settings
      const [settings] = await fastify.db
        .select()
        .from(remarkableAgendaSettings)
        .where(eq(remarkableAgendaSettings.userId, user.id))
        .limit(1);

      return {
        success: true,
        data: settings,
      };
    }
  );

  // GET /api/v1/remarkable/notes - List unprocessed notes
  fastify.get<{
    Querystring: { includeProcessed?: boolean };
  }>(
    "/notes",
    {
      preHandler: [authenticate],
      schema: {
        description: "List notes from reMarkable",
        tags: ["reMarkable"],
        querystring: {
          type: "object",
          properties: {
            includeProcessed: { type: "boolean" },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      const { includeProcessed = false } = request.query;

      // First sync documents from reMarkable
      try {
        await syncRemarkableDocuments(fastify, user.id);
      } catch (error) {
        fastify.log.error({ err: error }, "Failed to sync reMarkable documents");
      }

      // Get documents from database
      let query = fastify.db
        .select()
        .from(remarkableDocuments)
        .where(
          and(
            eq(remarkableDocuments.userId, user.id),
            eq(remarkableDocuments.isAgenda, false)
          )
        );

      const documents = await query;

      // Filter by processed status if needed
      const filteredDocs = includeProcessed
        ? documents
        : documents.filter((d) => !d.isProcessed);

      return {
        success: true,
        data: filteredDocs.map((doc) => ({
          id: doc.id,
          documentId: doc.documentId,
          name: doc.documentName,
          type: doc.documentType,
          folderPath: doc.folderPath,
          isProcessed: doc.isProcessed,
          processedAt: doc.processedAt?.toISOString() ?? null,
          lastModifiedAt: doc.lastModifiedAt?.toISOString() ?? null,
          recognizedText: doc.recognizedText,
        })),
      };
    }
  );

  // POST /api/v1/remarkable/notes/:id/process - Process a single note
  fastify.post<{
    Params: { id: string };
    Body: { calendarId?: string; targetDate?: string; autoCreate?: boolean };
  }>(
    "/notes/:id/process",
    {
      preHandler: [authenticate],
      schema: {
        description: "Process handwritten notes and create calendar events",
        tags: ["reMarkable"],
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
            calendarId: { type: "string", format: "uuid" },
            targetDate: { type: "string", format: "date" },
            autoCreate: { type: "boolean" },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      const { id } = request.params;
      const { calendarId, targetDate: dateStr, autoCreate = true } = request.body;

      // Get the document
      const [doc] = await fastify.db
        .select()
        .from(remarkableDocuments)
        .where(
          and(eq(remarkableDocuments.id, id), eq(remarkableDocuments.userId, user.id))
        )
        .limit(1);

      if (!doc) {
        return fastify.httpErrors.notFound("Document not found");
      }

      const targetDate = dateStr ? new Date(dateStr) : new Date();

      const result = await processRemarkableNote(fastify, user.id, doc.documentId, {
        targetDate,
        autoCreate,
        calendarId,
      });

      return {
        success: true,
        data: {
          documentId: result.documentId,
          documentName: result.documentName,
          recognizedText: result.recognizedText,
          events: result.parsedEvents,
          createdCount: result.createdEventIds.length,
        },
      };
    }
  );

  // POST /api/v1/remarkable/notes/process-all - Batch process all unprocessed notes
  fastify.post<{
    Body: { calendarId?: string; autoCreate?: boolean };
  }>(
    "/notes/process-all",
    {
      preHandler: [authenticate],
      schema: {
        description: "Process all unprocessed handwritten notes",
        tags: ["reMarkable"],
        body: {
          type: "object",
          properties: {
            calendarId: { type: "string", format: "uuid" },
            autoCreate: { type: "boolean" },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      const { calendarId, autoCreate = true } = request.body;

      // Get unprocessed documents
      const documents = await fastify.db
        .select()
        .from(remarkableDocuments)
        .where(
          and(
            eq(remarkableDocuments.userId, user.id),
            eq(remarkableDocuments.isAgenda, false),
            eq(remarkableDocuments.isProcessed, false)
          )
        );

      const results = [];
      let totalCreated = 0;

      for (const doc of documents) {
        try {
          const result = await processRemarkableNote(fastify, user.id, doc.documentId, {
            autoCreate,
            calendarId,
          });

          results.push({
            documentId: doc.documentId,
            documentName: doc.documentName,
            createdCount: result.createdEventIds.length,
            success: true,
          });

          totalCreated += result.createdEventIds.length;
        } catch (error) {
          results.push({
            documentId: doc.documentId,
            documentName: doc.documentName,
            createdCount: 0,
            success: false,
            error: error instanceof Error ? error.message : "Processing failed",
          });
        }
      }

      return {
        success: true,
        data: {
          processedCount: documents.length,
          totalEventsCreated: totalCreated,
          results,
        },
      };
    }
  );

  // POST /api/v1/remarkable/sync - Manual sync
  fastify.post(
    "/sync",
    {
      preHandler: [authenticate],
      schema: {
        description: "Manually sync documents from reMarkable",
        tags: ["reMarkable"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);

      const result = await syncRemarkableDocuments(fastify, user.id);

      return {
        success: true,
        data: {
          added: result.added,
          updated: result.updated,
          removed: result.removed,
          message: `Synced documents: ${result.added} added, ${result.updated} updated, ${result.removed} removed`,
        },
      };
    }
  );
};
