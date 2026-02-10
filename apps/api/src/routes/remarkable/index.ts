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
import { eq, and, desc } from "drizzle-orm";
import { format, startOfDay, endOfDay, addDays, startOfWeek } from "date-fns";
import {
  remarkableConfig,
  remarkableAgendaSettings,
  remarkableDocuments,
  remarkableEventSource,
  remarkableTemplates,
  remarkableSchedules,
  remarkableProcessedConfirmations,
  calendars,
  events,
  type RemarkableTemplateConfig,
  type RemarkableMergeField,
  type ConfirmedEventSummary,
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
import {
  generateTemplate,
  getDefaultTemplateConfig,
  validateTemplateConfig,
  type TemplateType,
  type TemplateEvent,
} from "../../services/remarkable/template-engine.js";
import {
  getRemarkableFolders,
  getFolderTree,
  createFolder as createRemarkableFolder,
  getSuggestedFolderPaths,
} from "../../services/remarkable/folder-service.js";
import {
  sendConfirmation,
  getConfirmationSettings,
  getConfirmations,
  DEFAULT_CONFIRMATION_SETTINGS,
} from "../../services/remarkable/confirmation-service.js";
import { validateMergeFields, getPdfTemplateDimensions } from "../../services/remarkable/generators/user-template.js";

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
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
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
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

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

      // Trust the database connection status
      // Live testing is done via /test endpoint to avoid slow status checks
      const isConnected = config.isConnected;

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
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

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
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

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
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
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
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
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
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
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
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
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
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
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
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
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
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

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

  // GET /api/v1/remarkable/documents/recent - Get recently modified documents from device
  fastify.get<{
    Querystring: { limit?: number };
  }>(
    "/documents/recent",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get recently modified documents from reMarkable device to verify connection",
        tags: ["reMarkable"],
        querystring: {
          type: "object",
          properties: {
            limit: { type: "number", minimum: 1, maximum: 50 },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { limit = 10 } = request.query;

      try {
        const client = getRemarkableClient(fastify, user.id);
        const documents = await client.getDocuments();

        // Filter to only actual documents (not folders) and sort by lastModified descending
        const recentDocs = documents
          .filter(d => d.type === "DocumentType")
          .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
          .slice(0, limit);

        // Build folder path map to show full paths
        const folders = documents.filter(d => d.type === "CollectionType");
        const folderNames = new Map<string, string>();

        function buildPath(parentId: string): string {
          if (!parentId) return "/";
          const folder = folders.find(f => f.id === parentId);
          if (!folder) return "/";
          const parentPath = buildPath(folder.parent);
          return parentPath === "/" ? `/${folder.name}` : `${parentPath}/${folder.name}`;
        }

        return {
          success: true,
          data: recentDocs.map(doc => ({
            id: doc.id,
            name: doc.name,
            folderPath: buildPath(doc.parent),
            lastModified: doc.lastModified,
            pinned: doc.pinned,
          })),
        };
      } catch (error) {
        fastify.log.error({ err: error }, "Failed to get recent documents");
        if (error instanceof Error && error.message.includes("not connected")) {
          return fastify.httpErrors.badRequest("reMarkable not connected. Please reconnect.");
        }
        throw error;
      }
    }
  );

  // ==================== TEMPLATE MANAGEMENT ====================

  // GET /api/v1/remarkable/templates - List all templates
  fastify.get(
    "/templates",
    {
      preHandler: [authenticate],
      schema: {
        description: "List all reMarkable templates",
        tags: ["reMarkable Templates"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const templates = await fastify.db
        .select()
        .from(remarkableTemplates)
        .where(eq(remarkableTemplates.userId, user.id))
        .orderBy(remarkableTemplates.createdAt);

      return {
        success: true,
        data: templates.map((t) => ({
          id: t.id,
          name: t.name,
          templateType: t.templateType,
          config: t.config,
          folderPath: t.folderPath,
          isActive: t.isActive,
          hasPdfTemplate: !!t.pdfTemplate,
          mergeFieldCount: t.mergeFields?.length ?? 0,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        })),
      };
    }
  );

  // POST /api/v1/remarkable/templates - Create template
  fastify.post<{
    Body: {
      name: string;
      templateType: string;
      config?: RemarkableTemplateConfig;
      folderPath?: string;
    };
  }>(
    "/templates",
    {
      preHandler: [authenticate],
      schema: {
        description: "Create a new reMarkable template",
        tags: ["reMarkable Templates"],
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            templateType: {
              type: "string",
              enum: ["weekly_planner", "habit_tracker", "custom_agenda", "user_designed"],
            },
            config: { type: "object" },
            folderPath: { type: "string" },
          },
          required: ["name", "templateType"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { name, templateType, config, folderPath } = request.body;

      // Get default config for template type
      const defaultConfig = await getDefaultTemplateConfig(templateType as TemplateType);
      const finalConfig = { ...defaultConfig, ...config };

      // Validate config
      const validation = await validateTemplateConfig(templateType as TemplateType, finalConfig);
      if (!validation.valid) {
        return fastify.httpErrors.badRequest(validation.errors.join(", "));
      }

      const [createdTemplate] = await fastify.db
        .insert(remarkableTemplates)
        .values({
          userId: user.id,
          name,
          templateType: templateType as "weekly_planner" | "habit_tracker" | "custom_agenda" | "user_designed",
          config: finalConfig,
          folderPath: folderPath || "/Calendar",
        })
        .returning();

      return {
        success: true,
        data: {
          id: createdTemplate!.id,
          name: createdTemplate!.name,
          templateType: createdTemplate!.templateType,
          config: createdTemplate!.config,
          folderPath: createdTemplate!.folderPath,
          isActive: createdTemplate!.isActive,
          createdAt: createdTemplate!.createdAt.toISOString(),
        },
      };
    }
  );

  // GET /api/v1/remarkable/templates/:id - Get template
  fastify.get<{
    Params: { id: string };
  }>(
    "/templates/:id",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get a template by ID",
        tags: ["reMarkable Templates"],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id } = request.params;

      const [template] = await fastify.db
        .select()
        .from(remarkableTemplates)
        .where(and(
          eq(remarkableTemplates.id, id),
          eq(remarkableTemplates.userId, user.id)
        ))
        .limit(1);

      if (!template) {
        return fastify.httpErrors.notFound("Template not found");
      }

      return {
        success: true,
        data: {
          id: template.id,
          name: template.name,
          templateType: template.templateType,
          config: template.config,
          mergeFields: template.mergeFields,
          folderPath: template.folderPath,
          isActive: template.isActive,
          hasPdfTemplate: !!template.pdfTemplate,
          createdAt: template.createdAt.toISOString(),
          updatedAt: template.updatedAt.toISOString(),
        },
      };
    }
  );

  // PATCH /api/v1/remarkable/templates/:id - Update template
  fastify.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      config?: RemarkableTemplateConfig;
      mergeFields?: RemarkableMergeField[];
      folderPath?: string;
      isActive?: boolean;
    };
  }>(
    "/templates/:id",
    {
      preHandler: [authenticate],
      schema: {
        description: "Update a template",
        tags: ["reMarkable Templates"],
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
            config: { type: "object" },
            mergeFields: { type: "array" },
            folderPath: { type: "string" },
            isActive: { type: "boolean" },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id } = request.params;
      const updates = request.body;

      // Verify ownership
      const [existing] = await fastify.db
        .select()
        .from(remarkableTemplates)
        .where(and(
          eq(remarkableTemplates.id, id),
          eq(remarkableTemplates.userId, user.id)
        ))
        .limit(1);

      if (!existing) {
        return fastify.httpErrors.notFound("Template not found");
      }

      // Validate config if provided
      if (updates.config) {
        const validation = await validateTemplateConfig(
          existing.templateType as TemplateType,
          { ...existing.config, ...updates.config }
        );
        if (!validation.valid) {
          return fastify.httpErrors.badRequest(validation.errors.join(", "));
        }
      }

      // Validate merge fields if provided
      if (updates.mergeFields) {
        const validation = validateMergeFields(updates.mergeFields);
        if (!validation.valid) {
          return fastify.httpErrors.badRequest(validation.errors.join(", "));
        }
      }

      const [updatedTemplate] = await fastify.db
        .update(remarkableTemplates)
        .set({
          ...updates,
          config: updates.config ? { ...existing.config, ...updates.config } : undefined,
          updatedAt: new Date(),
        })
        .where(eq(remarkableTemplates.id, id))
        .returning();

      return {
        success: true,
        data: {
          id: updatedTemplate!.id,
          name: updatedTemplate!.name,
          templateType: updatedTemplate!.templateType,
          config: updatedTemplate!.config,
          folderPath: updatedTemplate!.folderPath,
          isActive: updatedTemplate!.isActive,
          updatedAt: updatedTemplate!.updatedAt.toISOString(),
        },
      };
    }
  );

  // DELETE /api/v1/remarkable/templates/:id - Delete template
  fastify.delete<{
    Params: { id: string };
  }>(
    "/templates/:id",
    {
      preHandler: [authenticate],
      schema: {
        description: "Delete a template",
        tags: ["reMarkable Templates"],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id } = request.params;

      const result = await fastify.db
        .delete(remarkableTemplates)
        .where(and(
          eq(remarkableTemplates.id, id),
          eq(remarkableTemplates.userId, user.id)
        ))
        .returning();

      if (result.length === 0) {
        return fastify.httpErrors.notFound("Template not found");
      }

      return {
        success: true,
        data: { message: "Template deleted" },
      };
    }
  );

  // POST /api/v1/remarkable/templates/:id/preview - Generate preview
  fastify.post<{
    Params: { id: string };
    Body: { date?: string };
  }>(
    "/templates/:id/preview",
    {
      preHandler: [authenticate],
      schema: {
        description: "Generate a preview PDF for a template",
        tags: ["reMarkable Templates"],
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
            date: { type: "string", format: "date" },
          },
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id } = request.params;
      const { date: dateStr } = request.body;

      // Get template
      const [template] = await fastify.db
        .select()
        .from(remarkableTemplates)
        .where(and(
          eq(remarkableTemplates.id, id),
          eq(remarkableTemplates.userId, user.id)
        ))
        .limit(1);

      if (!template) {
        return fastify.httpErrors.notFound("Template not found");
      }

      const targetDate = dateStr ? new Date(dateStr) : new Date();

      // Get events for the date range based on template type
      let dateRange = { start: startOfDay(targetDate), end: endOfDay(targetDate) };
      if (template.templateType === "weekly_planner") {
        const weekStart = startOfWeek(targetDate, { weekStartsOn: template.config?.weekStartsOn ?? 1 });
        dateRange = { start: weekStart, end: addDays(weekStart, 7) };
      }

      // Get events
      const userCalendars = await fastify.db
        .select()
        .from(calendars)
        .where(and(eq(calendars.userId, user.id), eq(calendars.isVisible, true)));

      const calendarIds = template.config?.includeCalendarIds?.length
        ? template.config.includeCalendarIds
        : userCalendars.map((c) => c.id);

      const templateEvents: TemplateEvent[] = [];
      for (const calId of calendarIds) {
        const cal = userCalendars.find((c) => c.id === calId);
        if (!cal) continue;

        const calEvents = await fastify.db
          .select()
          .from(events)
          .where(eq(events.calendarId, calId));

        for (const event of calEvents) {
          if (event.startTime >= dateRange.start && event.startTime <= dateRange.end) {
            templateEvents.push({
              id: event.id,
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
      }

      // Generate template
      const result = await generateTemplate(template.templateType as TemplateType, {
        date: targetDate,
        dateRange,
        events: templateEvents,
        config: template.config || {},
        mergeFields: template.mergeFields || undefined,
        pdfTemplate: template.pdfTemplate ? Buffer.from(template.pdfTemplate, "base64") : undefined,
      });

      return reply
        .type("application/pdf")
        .header("Content-Disposition", `inline; filename="${result.filename}.pdf"`)
        .send(result.buffer);
    }
  );

  // POST /api/v1/remarkable/templates/:id/push - Push template to device
  fastify.post<{
    Params: { id: string };
    Body: { date?: string };
  }>(
    "/templates/:id/push",
    {
      preHandler: [authenticate],
      schema: {
        description: "Push a template to reMarkable device",
        tags: ["reMarkable Templates"],
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
            date: { type: "string", format: "date" },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id } = request.params;
      const { date: dateStr } = request.body;

      // Get template
      const [template] = await fastify.db
        .select()
        .from(remarkableTemplates)
        .where(and(
          eq(remarkableTemplates.id, id),
          eq(remarkableTemplates.userId, user.id)
        ))
        .limit(1);

      if (!template) {
        return fastify.httpErrors.notFound("Template not found");
      }

      const targetDate = dateStr ? new Date(dateStr) : new Date();

      // Get events (similar to preview)
      let dateRange = { start: startOfDay(targetDate), end: endOfDay(targetDate) };
      if (template.templateType === "weekly_planner") {
        const weekStart = startOfWeek(targetDate, { weekStartsOn: template.config?.weekStartsOn ?? 1 });
        dateRange = { start: weekStart, end: addDays(weekStart, 7) };
      }

      const userCalendars = await fastify.db
        .select()
        .from(calendars)
        .where(and(eq(calendars.userId, user.id), eq(calendars.isVisible, true)));

      const calendarIds = template.config?.includeCalendarIds?.length
        ? template.config.includeCalendarIds
        : userCalendars.map((c) => c.id);

      const templateEvents: TemplateEvent[] = [];
      for (const calId of calendarIds) {
        const cal = userCalendars.find((c) => c.id === calId);
        if (!cal) continue;

        const calEvents = await fastify.db
          .select()
          .from(events)
          .where(eq(events.calendarId, calId));

        for (const event of calEvents) {
          if (event.startTime >= dateRange.start && event.startTime <= dateRange.end) {
            templateEvents.push({
              id: event.id,
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
      }

      // Generate template
      const result = await generateTemplate(template.templateType as TemplateType, {
        date: targetDate,
        dateRange,
        events: templateEvents,
        config: template.config || {},
        mergeFields: template.mergeFields || undefined,
        pdfTemplate: template.pdfTemplate ? Buffer.from(template.pdfTemplate, "base64") : undefined,
      });

      // Upload to reMarkable
      const client = getRemarkableClient(fastify, user.id);
      const documentId = await client.uploadPdf(result.buffer, result.filename, template.folderPath);

      // Track the document
      await fastify.db.insert(remarkableDocuments).values({
        userId: user.id,
        documentId,
        documentVersion: 1,
        documentName: result.filename,
        documentType: "pdf",
        folderPath: template.folderPath,
        isAgenda: true,
        isProcessed: false,
      });

      return {
        success: true,
        data: {
          documentId,
          filename: result.filename,
          eventCount: templateEvents.length,
          message: `Pushed ${template.name} with ${templateEvents.length} events to reMarkable`,
        },
      };
    }
  );

  // POST /api/v1/remarkable/templates/upload-pdf - Upload custom PDF template
  fastify.post<{
    Body: {
      templateId: string;
      pdfBase64: string;
    };
  }>(
    "/templates/upload-pdf",
    {
      preHandler: [authenticate],
      schema: {
        description: "Upload a custom PDF template",
        tags: ["reMarkable Templates"],
        body: {
          type: "object",
          properties: {
            templateId: { type: "string", format: "uuid" },
            pdfBase64: { type: "string" },
          },
          required: ["templateId", "pdfBase64"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { templateId, pdfBase64 } = request.body;

      // Verify ownership
      const [template] = await fastify.db
        .select()
        .from(remarkableTemplates)
        .where(and(
          eq(remarkableTemplates.id, templateId),
          eq(remarkableTemplates.userId, user.id)
        ))
        .limit(1);

      if (!template) {
        return fastify.httpErrors.notFound("Template not found");
      }

      if (template.templateType !== "user_designed") {
        return fastify.httpErrors.badRequest("Only user_designed templates can have PDF uploads");
      }

      // Validate PDF
      try {
        const pdfBuffer = Buffer.from(pdfBase64, "base64");
        const dimensions = await getPdfTemplateDimensions(pdfBuffer);

        // Update template
        await fastify.db
          .update(remarkableTemplates)
          .set({
            pdfTemplate: pdfBase64,
            updatedAt: new Date(),
          })
          .where(eq(remarkableTemplates.id, templateId));

        return {
          success: true,
          data: {
            width: dimensions.width,
            height: dimensions.height,
            pageCount: dimensions.pageCount,
            message: "PDF template uploaded successfully",
          },
        };
      } catch (error) {
        return fastify.httpErrors.badRequest("Invalid PDF file");
      }
    }
  );

  // ==================== SCHEDULE MANAGEMENT ====================

  // GET /api/v1/remarkable/schedules - List schedules
  fastify.get(
    "/schedules",
    {
      preHandler: [authenticate],
      schema: {
        description: "List all schedules",
        tags: ["reMarkable Schedules"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const schedules = await fastify.db
        .select({
          schedule: remarkableSchedules,
          templateName: remarkableTemplates.name,
          templateType: remarkableTemplates.templateType,
        })
        .from(remarkableSchedules)
        .leftJoin(remarkableTemplates, eq(remarkableSchedules.templateId, remarkableTemplates.id))
        .where(eq(remarkableSchedules.userId, user.id))
        .orderBy(remarkableSchedules.createdAt);

      return {
        success: true,
        data: schedules.map((s) => ({
          id: s.schedule.id,
          templateId: s.schedule.templateId,
          templateName: s.templateName || "Default Agenda",
          templateType: s.templateType || "daily_agenda",
          scheduleType: s.schedule.scheduleType,
          enabled: s.schedule.enabled,
          pushTime: s.schedule.pushTime,
          pushDay: s.schedule.pushDay,
          timezone: s.schedule.timezone,
          lastPushAt: s.schedule.lastPushAt?.toISOString() ?? null,
          nextPushAt: s.schedule.nextPushAt?.toISOString() ?? null,
          createdAt: s.schedule.createdAt.toISOString(),
        })),
      };
    }
  );

  // POST /api/v1/remarkable/schedules - Create schedule
  fastify.post<{
    Body: {
      templateId?: string;
      scheduleType: string;
      pushTime?: string;
      pushDay?: number;
      timezone?: string;
    };
  }>(
    "/schedules",
    {
      preHandler: [authenticate],
      schema: {
        description: "Create a new schedule",
        tags: ["reMarkable Schedules"],
        body: {
          type: "object",
          properties: {
            templateId: { type: "string", format: "uuid" },
            scheduleType: { type: "string", enum: ["daily", "weekly", "monthly", "manual"] },
            pushTime: { type: "string", pattern: "^\\d{2}:\\d{2}$" },
            pushDay: { type: "number", minimum: 0, maximum: 31 },
            timezone: { type: "string" },
          },
          required: ["scheduleType"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { templateId, scheduleType, pushTime, pushDay, timezone } = request.body;

      // If templateId provided, verify ownership
      if (templateId) {
        const [template] = await fastify.db
          .select()
          .from(remarkableTemplates)
          .where(and(
            eq(remarkableTemplates.id, templateId),
            eq(remarkableTemplates.userId, user.id)
          ))
          .limit(1);

        if (!template) {
          return fastify.httpErrors.notFound("Template not found");
        }
      }

      const [createdSchedule] = await fastify.db
        .insert(remarkableSchedules)
        .values({
          userId: user.id,
          templateId: templateId || null,
          scheduleType: scheduleType as "daily" | "weekly" | "monthly" | "manual",
          pushTime: pushTime || "06:00",
          pushDay,
          timezone: timezone || user.timezone || "UTC",
        })
        .returning();

      return {
        success: true,
        data: {
          id: createdSchedule!.id,
          templateId: createdSchedule!.templateId,
          scheduleType: createdSchedule!.scheduleType,
          enabled: createdSchedule!.enabled,
          pushTime: createdSchedule!.pushTime,
          pushDay: createdSchedule!.pushDay,
          timezone: createdSchedule!.timezone,
          createdAt: createdSchedule!.createdAt.toISOString(),
        },
      };
    }
  );

  // PATCH /api/v1/remarkable/schedules/:id - Update schedule
  fastify.patch<{
    Params: { id: string };
    Body: {
      enabled?: boolean;
      pushTime?: string;
      pushDay?: number;
      timezone?: string;
    };
  }>(
    "/schedules/:id",
    {
      preHandler: [authenticate],
      schema: {
        description: "Update a schedule",
        tags: ["reMarkable Schedules"],
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
            enabled: { type: "boolean" },
            pushTime: { type: "string", pattern: "^\\d{2}:\\d{2}$" },
            pushDay: { type: "number", minimum: 0, maximum: 31 },
            timezone: { type: "string" },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id } = request.params;
      const updates = request.body;

      const [schedule] = await fastify.db
        .update(remarkableSchedules)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(and(
          eq(remarkableSchedules.id, id),
          eq(remarkableSchedules.userId, user.id)
        ))
        .returning();

      if (!schedule) {
        return fastify.httpErrors.notFound("Schedule not found");
      }

      return {
        success: true,
        data: {
          id: schedule.id,
          enabled: schedule.enabled,
          pushTime: schedule.pushTime,
          pushDay: schedule.pushDay,
          timezone: schedule.timezone,
          updatedAt: schedule.updatedAt.toISOString(),
        },
      };
    }
  );

  // DELETE /api/v1/remarkable/schedules/:id - Delete schedule
  fastify.delete<{
    Params: { id: string };
  }>(
    "/schedules/:id",
    {
      preHandler: [authenticate],
      schema: {
        description: "Delete a schedule",
        tags: ["reMarkable Schedules"],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id } = request.params;

      const result = await fastify.db
        .delete(remarkableSchedules)
        .where(and(
          eq(remarkableSchedules.id, id),
          eq(remarkableSchedules.userId, user.id)
        ))
        .returning();

      if (result.length === 0) {
        return fastify.httpErrors.notFound("Schedule not found");
      }

      return {
        success: true,
        data: { message: "Schedule deleted" },
      };
    }
  );

  // ==================== FOLDER MANAGEMENT ====================

  // GET /api/v1/remarkable/folders - List folders
  fastify.get(
    "/folders",
    {
      preHandler: [authenticate],
      schema: {
        description: "List all folders on reMarkable",
        tags: ["reMarkable Folders"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      try {
        const folders = await getRemarkableFolders(fastify, user.id);
        return {
          success: true,
          data: folders,
        };
      } catch (error) {
        fastify.log.error({ err: error }, "Failed to get folders");
        return fastify.httpErrors.internalServerError("Failed to retrieve folders");
      }
    }
  );

  // GET /api/v1/remarkable/folders/tree - Get folder tree
  fastify.get(
    "/folders/tree",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get folder tree structure",
        tags: ["reMarkable Folders"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      try {
        const tree = await getFolderTree(fastify, user.id);
        return {
          success: true,
          data: tree,
        };
      } catch (error) {
        fastify.log.error({ err: error }, "Failed to get folder tree");
        return fastify.httpErrors.internalServerError("Failed to retrieve folder tree");
      }
    }
  );

  // POST /api/v1/remarkable/folders - Create folder
  fastify.post<{
    Body: { path: string };
  }>(
    "/folders",
    {
      preHandler: [authenticate],
      schema: {
        description: "Create a new folder on reMarkable",
        tags: ["reMarkable Folders"],
        body: {
          type: "object",
          properties: {
            path: { type: "string", minLength: 1 },
          },
          required: ["path"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { path } = request.body;

      try {
        const result = await createRemarkableFolder(fastify, user.id, path);
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        fastify.log.error({ err: error }, "Failed to create folder");
        return fastify.httpErrors.internalServerError("Failed to create folder");
      }
    }
  );

  // GET /api/v1/remarkable/folders/suggestions - Get suggested folder paths
  fastify.get(
    "/folders/suggestions",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get suggested folder paths",
        tags: ["reMarkable Folders"],
      },
    },
    async () => {
      return {
        success: true,
        data: getSuggestedFolderPaths(),
      };
    }
  );

  // ==================== CONFIRMATIONS ====================

  // GET /api/v1/remarkable/confirmations/settings - Get confirmation settings
  fastify.get(
    "/confirmations/settings",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get confirmation settings",
        tags: ["reMarkable Confirmations"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const settings = await getConfirmationSettings(fastify, user.id);

      return {
        success: true,
        data: settings,
      };
    }
  );

  // PATCH /api/v1/remarkable/confirmations/settings - Update confirmation settings
  fastify.patch<{
    Body: {
      enabled?: boolean;
      folderPath?: string;
      includeEventDetails?: boolean;
      autoDelete?: boolean;
      autoDeleteDays?: number;
    };
  }>(
    "/confirmations/settings",
    {
      preHandler: [authenticate],
      schema: {
        description: "Update confirmation settings",
        tags: ["reMarkable Confirmations"],
        body: {
          type: "object",
          properties: {
            enabled: { type: "boolean" },
            folderPath: { type: "string" },
            includeEventDetails: { type: "boolean" },
            autoDelete: { type: "boolean" },
            autoDeleteDays: { type: "number", minimum: 1, maximum: 365 },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const updates = request.body;

      // For now, return the updated settings (in a real impl, save to DB)
      const settings = { ...DEFAULT_CONFIRMATION_SETTINGS, ...updates };

      return {
        success: true,
        data: settings,
      };
    }
  );

  // GET /api/v1/remarkable/confirmations - List confirmations
  fastify.get<{
    Querystring: { limit?: number };
  }>(
    "/confirmations",
    {
      preHandler: [authenticate],
      schema: {
        description: "List confirmations sent",
        tags: ["reMarkable Confirmations"],
        querystring: {
          type: "object",
          properties: {
            limit: { type: "number", minimum: 1, maximum: 100 },
          },
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { limit = 50 } = request.query;

      const confirmations = await getConfirmations(fastify, user.id, limit);

      return {
        success: true,
        data: confirmations.map((c) => ({
          id: c.id,
          documentId: c.documentId,
          documentName: c.documentName,
          confirmationType: c.confirmationType,
          confirmationDocumentId: c.confirmationDocumentId,
          eventsConfirmed: c.eventsConfirmed,
          createdAt: c.createdAt.toISOString(),
        })),
      };
    }
  );

  // POST /api/v1/remarkable/notes/:id/confirm - Send confirmation for processed note
  fastify.post<{
    Params: { id: string };
  }>(
    "/notes/:id/confirm",
    {
      preHandler: [authenticate],
      schema: {
        description: "Send a confirmation for a processed note",
        tags: ["reMarkable Confirmations"],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { id } = request.params;

      // Get the document and its created events
      const [document] = await fastify.db
        .select()
        .from(remarkableDocuments)
        .where(and(
          eq(remarkableDocuments.id, id),
          eq(remarkableDocuments.userId, user.id)
        ))
        .limit(1);

      if (!document) {
        return fastify.httpErrors.notFound("Document not found");
      }

      if (!document.isProcessed) {
        return fastify.httpErrors.badRequest("Document has not been processed");
      }

      // Get event sources for this document
      const eventSources = await fastify.db
        .select({
          eventSource: remarkableEventSource,
          event: events,
        })
        .from(remarkableEventSource)
        .innerJoin(events, eq(remarkableEventSource.eventId, events.id))
        .where(eq(remarkableEventSource.documentId, id));

      const confirmedEvents: ConfirmedEventSummary[] = eventSources.map((es) => ({
        eventId: es.event.id,
        title: es.event.title,
        startTime: es.event.startTime.toISOString(),
        endTime: es.event.endTime?.toISOString(),
        isAllDay: es.event.isAllDay,
      }));

      // Send confirmation
      const result = await sendConfirmation(fastify, user.id, id, confirmedEvents);

      return {
        success: true,
        data: {
          confirmationId: result.confirmationId,
          confirmationDocumentId: result.confirmationDocumentId,
          eventsConfirmed: confirmedEvents.length,
          message: `Confirmation sent with ${confirmedEvents.length} events`,
        },
      };
    }
  );
};
