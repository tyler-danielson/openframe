/**
 * Telegram Bot Integration Routes
 *
 * Provides endpoints for:
 * - Bot connection/disconnection
 * - Webhook handling
 * - Chat management
 * - Settings management
 * - Manual message sending
 */

import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { telegramConfig, telegramChats } from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";
import { TelegramService, type TelegramUpdate } from "../../services/telegram.js";

export const telegramRoutes: FastifyPluginAsync = async (fastify) => {
  const { authenticate } = fastify;

  // POST /api/v1/telegram/connect - Connect bot with token
  fastify.post<{
    Body: { botToken: string };
  }>(
    "/connect",
    {
      preHandler: [authenticate],
      schema: {
        description: "Connect Telegram bot using bot token",
        tags: ["Telegram"],
        body: {
          type: "object",
          properties: {
            botToken: {
              type: "string",
              description: "Bot token from @BotFather",
            },
          },
          required: ["botToken"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      const { botToken } = request.body;

      if (!botToken || botToken.trim().length === 0) {
        return reply.badRequest("Bot token is required");
      }

      try {
        const result = await TelegramService.connect(
          fastify,
          user.id,
          botToken.trim()
        );

        return {
          success: true,
          data: {
            connected: true,
            message: "Bot connected successfully",
            bot: {
              username: result.botInfo.username,
              firstName: result.botInfo.first_name,
            },
          },
        };
      } catch (error) {
        fastify.log.error({ err: error }, "Failed to connect Telegram bot");
        return reply.badRequest(
          error instanceof Error ? error.message : "Failed to connect bot"
        );
      }
    }
  );

  // DELETE /api/v1/telegram/disconnect - Disconnect bot
  fastify.delete(
    "/disconnect",
    {
      preHandler: [authenticate],
      schema: {
        description: "Disconnect Telegram bot",
        tags: ["Telegram"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);

      await TelegramService.disconnect(fastify, user.id);

      return {
        success: true,
        data: {
          message: "Telegram bot disconnected",
        },
      };
    }
  );

  // GET /api/v1/telegram/status - Get connection status
  fastify.get(
    "/status",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get Telegram bot connection status",
        tags: ["Telegram"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);

      const config = await TelegramService.getConfig(fastify, user.id);

      if (!config) {
        return {
          success: true,
          data: {
            connected: false,
          },
        };
      }

      // Test connection
      const isConnected = await TelegramService.testConnection(fastify, user.id);

      // Get linked chats
      const chats = await TelegramService.getChats(fastify, user.id);

      return {
        success: true,
        data: {
          connected: isConnected,
          botUsername: config.botUsername,
          settings: {
            dailyAgendaEnabled: config.dailyAgendaEnabled,
            dailyAgendaTime: config.dailyAgendaTime,
            eventRemindersEnabled: config.eventRemindersEnabled,
            eventReminderMinutes: config.eventReminderMinutes,
          },
          chats: chats.map((c) => ({
            id: c.id,
            chatId: c.chatId,
            chatType: c.chatType,
            name: c.chatTitle || `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.username,
            isActive: c.isActive,
            linkedAt: c.linkedAt.toISOString(),
            lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
          })),
        },
      };
    }
  );

  // POST /api/v1/telegram/test - Test connection
  fastify.post(
    "/test",
    {
      preHandler: [authenticate],
      schema: {
        description: "Test Telegram bot connection",
        tags: ["Telegram"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);

      const isConnected = await TelegramService.testConnection(fastify, user.id);

      return {
        success: true,
        data: {
          connected: isConnected,
          message: isConnected
            ? "Connection successful"
            : "Connection failed. Please check your bot token.",
        },
      };
    }
  );

  // POST /api/v1/telegram/webhook/setup - Setup webhook
  fastify.post<{
    Body: { webhookUrl: string };
  }>(
    "/webhook/setup",
    {
      preHandler: [authenticate],
      schema: {
        description: "Setup webhook for receiving Telegram updates",
        tags: ["Telegram"],
        body: {
          type: "object",
          properties: {
            webhookUrl: {
              type: "string",
              description: "Public URL for webhook",
            },
          },
          required: ["webhookUrl"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      const { webhookUrl } = request.body;

      const config = await TelegramService.getConfig(fastify, user.id);
      if (!config) {
        return reply.badRequest("Telegram not connected");
      }

      try {
        const service = new TelegramService(fastify, user.id);
        await service.setWebhook(webhookUrl, {
          secretToken: config.webhookSecret || undefined,
        });

        return {
          success: true,
          data: {
            message: "Webhook configured successfully",
            webhookUrl,
          },
        };
      } catch (error) {
        fastify.log.error({ err: error }, "Failed to setup webhook");
        return reply.badRequest(
          error instanceof Error ? error.message : "Failed to setup webhook"
        );
      }
    }
  );

  // GET /api/v1/telegram/webhook/info - Get webhook info
  fastify.get(
    "/webhook/info",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get current webhook information",
        tags: ["Telegram"],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);

      const config = await TelegramService.getConfig(fastify, user.id);
      if (!config) {
        return reply.badRequest("Telegram not connected");
      }

      try {
        const service = new TelegramService(fastify, user.id);
        const info = await service.getWebhookInfo();

        return {
          success: true,
          data: info,
        };
      } catch (error) {
        fastify.log.error({ err: error }, "Failed to get webhook info");
        return reply.badRequest(
          error instanceof Error ? error.message : "Failed to get webhook info"
        );
      }
    }
  );

  // DELETE /api/v1/telegram/webhook - Delete webhook
  fastify.delete(
    "/webhook",
    {
      preHandler: [authenticate],
      schema: {
        description: "Delete webhook (switch to polling mode)",
        tags: ["Telegram"],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);

      const config = await TelegramService.getConfig(fastify, user.id);
      if (!config) {
        return reply.badRequest("Telegram not connected");
      }

      try {
        const service = new TelegramService(fastify, user.id);
        await service.deleteWebhook();

        return {
          success: true,
          data: {
            message: "Webhook deleted",
          },
        };
      } catch (error) {
        fastify.log.error({ err: error }, "Failed to delete webhook");
        return reply.badRequest(
          error instanceof Error ? error.message : "Failed to delete webhook"
        );
      }
    }
  );

  // POST /api/v1/telegram/webhook/:userId - Webhook endpoint (no auth - uses secret)
  fastify.post<{
    Params: { userId: string };
    Headers: { "x-telegram-bot-api-secret-token"?: string };
    Body: TelegramUpdate;
  }>(
    "/webhook/:userId",
    {
      schema: {
        description: "Webhook endpoint for Telegram updates",
        tags: ["Telegram"],
        params: {
          type: "object",
          properties: {
            userId: { type: "string", format: "uuid" },
          },
          required: ["userId"],
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.params;
      const secretToken = request.headers["x-telegram-bot-api-secret-token"];
      const update = request.body;

      // Get config and verify secret
      const config = await TelegramService.getConfig(fastify, userId);
      if (!config) {
        return reply.code(404).send({ error: "Not found" });
      }

      // Verify secret token if configured
      if (config.webhookSecret && secretToken !== config.webhookSecret) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      // Process update asynchronously
      try {
        const service = new TelegramService(fastify, userId);
        await service.handleUpdate(update);
      } catch (error) {
        fastify.log.error({ err: error, update }, "Error processing Telegram update");
      }

      // Always return 200 to Telegram
      return { ok: true };
    }
  );

  // GET /api/v1/telegram/chats - Get linked chats
  fastify.get(
    "/chats",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get linked Telegram chats",
        tags: ["Telegram"],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);

      const chats = await TelegramService.getChats(fastify, user.id);

      return {
        success: true,
        data: chats.map((c) => ({
          id: c.id,
          chatId: c.chatId,
          chatType: c.chatType,
          name: c.chatTitle || `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.username,
          username: c.username,
          isActive: c.isActive,
          linkedAt: c.linkedAt.toISOString(),
          lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
        })),
      };
    }
  );

  // DELETE /api/v1/telegram/chats/:id - Unlink a chat
  fastify.delete<{
    Params: { id: string };
  }>(
    "/chats/:id",
    {
      preHandler: [authenticate],
      schema: {
        description: "Unlink a Telegram chat",
        tags: ["Telegram"],
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
      const { id } = request.params;

      // Verify ownership
      const [chat] = await fastify.db
        .select()
        .from(telegramChats)
        .where(eq(telegramChats.id, id))
        .limit(1);

      if (!chat || chat.userId !== user.id) {
        return reply.notFound("Chat not found");
      }

      await fastify.db.delete(telegramChats).where(eq(telegramChats.id, id));

      return {
        success: true,
        data: {
          message: "Chat unlinked",
        },
      };
    }
  );

  // PATCH /api/v1/telegram/settings - Update notification settings
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
        description: "Update Telegram notification settings",
        tags: ["Telegram"],
        body: {
          type: "object",
          properties: {
            dailyAgendaEnabled: { type: "boolean" },
            dailyAgendaTime: { type: "string", pattern: "^\\d{2}:\\d{2}$" },
            eventRemindersEnabled: { type: "boolean" },
            eventReminderMinutes: { type: "number", minimum: 1, maximum: 1440 },
          },
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      const updates = request.body;

      const config = await TelegramService.getConfig(fastify, user.id);
      if (!config) {
        return reply.badRequest("Telegram not connected");
      }

      await fastify.db
        .update(telegramConfig)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(telegramConfig.userId, user.id));

      return {
        success: true,
        data: {
          message: "Settings updated",
        },
      };
    }
  );

  // POST /api/v1/telegram/send - Send a message to linked chats
  fastify.post<{
    Body: {
      message: string;
      chatId?: string;
    };
  }>(
    "/send",
    {
      preHandler: [authenticate],
      schema: {
        description: "Send a message to linked Telegram chats",
        tags: ["Telegram"],
        body: {
          type: "object",
          properties: {
            message: { type: "string", minLength: 1 },
            chatId: { type: "string", description: "Optional specific chat ID" },
          },
          required: ["message"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      const { message, chatId } = request.body;

      const config = await TelegramService.getConfig(fastify, user.id);
      if (!config) {
        return reply.badRequest("Telegram not connected");
      }

      try {
        if (chatId) {
          // Send to specific chat
          const service = new TelegramService(fastify, user.id);
          await service.sendMessage(chatId, message);
          return {
            success: true,
            data: { sent: 1, failed: 0 },
          };
        } else {
          // Broadcast to all chats
          const result = await TelegramService.broadcast(
            fastify,
            user.id,
            message
          );
          return {
            success: true,
            data: result,
          };
        }
      } catch (error) {
        fastify.log.error({ err: error }, "Failed to send Telegram message");
        return reply.badRequest(
          error instanceof Error ? error.message : "Failed to send message"
        );
      }
    }
  );

  // GET /api/v1/telegram/link-code - Get link code for connecting chats
  fastify.get(
    "/link-code",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get the bot start link for connecting chats",
        tags: ["Telegram"],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);

      const config = await TelegramService.getConfig(fastify, user.id);
      if (!config) {
        return reply.badRequest("Telegram not connected");
      }

      if (!config.botUsername) {
        return reply.badRequest("Bot username not available");
      }

      // Create deep link with user ID for identification
      const startLink = `https://t.me/${config.botUsername}?start=${user.id}`;

      return {
        success: true,
        data: {
          botUsername: config.botUsername,
          startLink,
          message: `Send /start to @${config.botUsername} to link your chat`,
        },
      };
    }
  );
};
