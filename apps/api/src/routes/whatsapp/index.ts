/**
 * WhatsApp Bot Integration Routes
 *
 * Provides endpoints for:
 * - Bot connection via QR code (SSE stream)
 * - Disconnection
 * - Status and chat management
 * - Settings management
 * - Manual message sending
 */

import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { whatsappConfig, whatsappChats } from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";
import { WhatsAppService } from "../../services/whatsapp.js";
import QRCode from "qrcode";

export const whatsappRoutes: FastifyPluginAsync = async (fastify) => {
  const { authenticate } = fastify;

  // GET /api/v1/whatsapp/connect?token=xxx - Start QR auth flow via SSE
  // Uses query param for auth since EventSource doesn't support custom headers
  fastify.get<{
    Querystring: { token?: string };
  }>(
    "/connect",
    {
      schema: {
        description: "Start WhatsApp QR code authentication (SSE stream)",
        tags: ["WhatsApp"],
        querystring: {
          type: "object",
          properties: {
            token: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      // Manual JWT verify from query param (EventSource can't send headers)
      const token = request.query.token;
      if (token) {
        try {
          request.headers.authorization = `Bearer ${token}`;
          await request.jwtVerify();
        } catch {
          return reply.unauthorized("Invalid token");
        }
      } else {
        // Try normal auth (cookie-based)
        try {
          await request.jwtVerify();
        } catch {
          return reply.unauthorized("Authentication required");
        }
      }

      const user = await getCurrentUser(request);
      if (!user) {
        return reply.unauthorized("Not authenticated");
      }

      // Set SSE headers
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      let closed = false;

      request.raw.on("close", () => {
        closed = true;
      });

      const sendSSE = (event: string, data: unknown) => {
        if (closed) return;
        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      try {
        await WhatsAppService.connect(
          fastify,
          user.id,
          async (qr: string | null, error?: string) => {
            if (closed) return;

            if (error) {
              sendSSE("error", { error });
              reply.raw.end();
              return;
            }

            if (qr === null) {
              // Connected
              const config = await WhatsAppService.getConfig(fastify, user.id);
              sendSSE("connected", {
                phoneNumber: config?.phoneNumber,
                displayName: config?.displayName,
              });
              reply.raw.end();
              return;
            }

            // Generate QR code as data URL
            try {
              const qrDataUrl = await QRCode.toDataURL(qr, {
                width: 256,
                margin: 2,
              });
              sendSSE("qr", { qr: qrDataUrl });
            } catch (err) {
              fastify.log.error({ err }, "Failed to generate QR code");
              sendSSE("error", { error: "Failed to generate QR code" });
            }
          }
        );
      } catch (error) {
        fastify.log.error({ err: error }, "Failed to start WhatsApp connection");
        sendSSE("error", {
          error: error instanceof Error ? error.message : "Failed to connect",
        });
        reply.raw.end();
      }
    }
  );

  // DELETE /api/v1/whatsapp/disconnect - Disconnect WhatsApp
  fastify.delete(
    "/disconnect",
    {
      preHandler: [authenticate],
      schema: {
        description: "Disconnect WhatsApp",
        tags: ["WhatsApp"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      await WhatsAppService.disconnect(fastify, user.id);

      return {
        success: true,
        data: {
          message: "WhatsApp disconnected",
        },
      };
    }
  );

  // GET /api/v1/whatsapp/status - Get connection status
  fastify.get(
    "/status",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get WhatsApp connection status",
        tags: ["WhatsApp"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const config = await WhatsAppService.getConfig(fastify, user.id);

      if (!config) {
        return {
          success: true,
          data: {
            connected: false,
          },
        };
      }

      const isConnected = WhatsAppService.isConnected(user.id);
      const chats = await WhatsAppService.getChats(fastify, user.id);

      return {
        success: true,
        data: {
          connected: isConnected && config.isConnected,
          phoneNumber: config.phoneNumber,
          displayName: config.displayName,
          settings: {
            dailyAgendaEnabled: config.dailyAgendaEnabled,
            dailyAgendaTime: config.dailyAgendaTime,
            eventRemindersEnabled: config.eventRemindersEnabled,
            eventReminderMinutes: config.eventReminderMinutes,
          },
          chats: chats.map((c) => ({
            id: c.id,
            jid: c.jid,
            chatType: c.chatType,
            name: c.chatName || c.jid.split("@")[0],
            isActive: c.isActive,
            linkedAt: c.linkedAt.toISOString(),
            lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
          })),
        },
      };
    }
  );

  // POST /api/v1/whatsapp/test - Test connection
  fastify.post(
    "/test",
    {
      preHandler: [authenticate],
      schema: {
        description: "Test WhatsApp connection",
        tags: ["WhatsApp"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const isConnected = WhatsAppService.isConnected(user.id);

      return {
        success: true,
        data: {
          connected: isConnected,
          message: isConnected
            ? "WhatsApp is connected"
            : "WhatsApp is not connected. Please scan the QR code.",
        },
      };
    }
  );

  // GET /api/v1/whatsapp/chats - List linked chats
  fastify.get(
    "/chats",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get linked WhatsApp chats",
        tags: ["WhatsApp"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const chats = await WhatsAppService.getChats(fastify, user.id);

      return {
        success: true,
        data: chats.map((c) => ({
          id: c.id,
          jid: c.jid,
          chatType: c.chatType,
          name: c.chatName || c.jid.split("@")[0],
          isActive: c.isActive,
          linkedAt: c.linkedAt.toISOString(),
          lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
        })),
      };
    }
  );

  // DELETE /api/v1/whatsapp/chats/:id - Unlink a chat
  fastify.delete<{
    Params: { id: string };
  }>(
    "/chats/:id",
    {
      preHandler: [authenticate],
      schema: {
        description: "Unlink a WhatsApp chat",
        tags: ["WhatsApp"],
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
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

      await fastify.db
        .delete(whatsappChats)
        .where(eq(whatsappChats.id, request.params.id));

      return {
        success: true,
        data: {
          message: "Chat unlinked",
        },
      };
    }
  );

  // PATCH /api/v1/whatsapp/settings - Update notification settings
  fastify.patch<{
    Body: {
      dailyAgendaEnabled?: boolean;
      dailyAgendaTime?: string;
      eventRemindersEnabled?: boolean;
      eventReminderMinutes?: number;
    };
  }>(
    "/settings",
    {
      preHandler: [authenticate],
      schema: {
        description: "Update WhatsApp notification settings",
        tags: ["WhatsApp"],
        body: {
          type: "object",
          properties: {
            dailyAgendaEnabled: { type: "boolean" },
            dailyAgendaTime: { type: "string" },
            eventRemindersEnabled: { type: "boolean" },
            eventReminderMinutes: { type: "number" },
          },
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const config = await WhatsAppService.getConfig(fastify, user.id);
      if (!config) {
        return reply.badRequest("WhatsApp not connected");
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      const body = request.body;

      if (body.dailyAgendaEnabled !== undefined) {
        updates.dailyAgendaEnabled = body.dailyAgendaEnabled;
      }
      if (body.dailyAgendaTime !== undefined) {
        updates.dailyAgendaTime = body.dailyAgendaTime;
      }
      if (body.eventRemindersEnabled !== undefined) {
        updates.eventRemindersEnabled = body.eventRemindersEnabled;
      }
      if (body.eventReminderMinutes !== undefined) {
        updates.eventReminderMinutes = body.eventReminderMinutes;
      }

      await fastify.db
        .update(whatsappConfig)
        .set(updates)
        .where(eq(whatsappConfig.userId, user.id));

      return {
        success: true,
        data: {
          message: "Settings updated",
        },
      };
    }
  );

  // POST /api/v1/whatsapp/send - Send message to chats
  fastify.post<{
    Body: { message: string; chatId?: string };
  }>(
    "/send",
    {
      preHandler: [authenticate],
      schema: {
        description: "Send a message to WhatsApp chats",
        tags: ["WhatsApp"],
        body: {
          type: "object",
          properties: {
            message: { type: "string" },
            chatId: { type: "string", description: "Specific chat ID, or all active chats if omitted" },
          },
          required: ["message"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const { message, chatId } = request.body;

      if (!message.trim()) {
        return reply.badRequest("Message is required");
      }

      try {
        if (chatId) {
          const service = new WhatsAppService(fastify, user.id);
          await service.sendMessage(chatId, message);
          return {
            success: true,
            data: { sent: 1, failed: 0 },
          };
        }

        const result = await WhatsAppService.broadcast(fastify, user.id, message);
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        fastify.log.error({ err: error }, "Failed to send WhatsApp message");
        return reply.badRequest(
          error instanceof Error ? error.message : "Failed to send message"
        );
      }
    }
  );
};
