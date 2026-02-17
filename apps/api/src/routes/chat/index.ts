import type { FastifyPluginAsync } from "fastify";
import { eq, desc, sql } from "drizzle-orm";
import {
  chatConversations,
  chatMessages,
} from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";
import { getSystemSetting } from "../settings/index.js";
import { buildChatContext, streamChat } from "../../services/ai-chat.js";
import type { AIChatProvider } from "@openframe/shared";

export const chatRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /chat/status - Which providers are configured
  fastify.get(
    "/status",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Check which AI chat providers are configured",
        tags: ["Chat"],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) return reply.unauthorized("Not authenticated");

      const [anthropicKey, openaiKey, geminiKey, defaultProvider] =
        await Promise.all([
          getSystemSetting(fastify.db, "anthropic", "api_key"),
          getSystemSetting(fastify.db, "openai", "api_key"),
          getSystemSetting(fastify.db, "google", "gemini_api_key"),
          getSystemSetting(fastify.db, "chat", "provider"),
        ]);

      return {
        success: true,
        data: {
          claude: !!anthropicKey,
          openai: !!openaiKey,
          gemini: !!geminiKey,
          defaultProvider: (defaultProvider as AIChatProvider) || "claude",
        },
      };
    }
  );

  // GET /chat/conversations - List conversations (paginated)
  fastify.get<{
    Querystring: { page?: string; limit?: string };
  }>(
    "/conversations",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "List chat conversations",
        tags: ["Chat"],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) return reply.unauthorized("Not authenticated");

      const page = parseInt(request.query.page || "1", 10);
      const limit = Math.min(parseInt(request.query.limit || "20", 10), 50);
      const offset = (page - 1) * limit;

      const conversations = await fastify.db
        .select({
          id: chatConversations.id,
          userId: chatConversations.userId,
          title: chatConversations.title,
          createdAt: chatConversations.createdAt,
          updatedAt: chatConversations.updatedAt,
        })
        .from(chatConversations)
        .where(eq(chatConversations.userId, user.id))
        .orderBy(desc(chatConversations.updatedAt))
        .limit(limit)
        .offset(offset);

      return {
        success: true,
        data: conversations,
      };
    }
  );

  // GET /chat/conversations/:id - Get conversation with messages
  fastify.get<{ Params: { id: string } }>(
    "/conversations/:id",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Get a chat conversation with messages",
        tags: ["Chat"],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) return reply.unauthorized("Not authenticated");

      const { id } = request.params;

      const [conversation] = await fastify.db
        .select()
        .from(chatConversations)
        .where(eq(chatConversations.id, id))
        .limit(1);

      if (!conversation || conversation.userId !== user.id) {
        return reply.notFound("Conversation not found");
      }

      const messages = await fastify.db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.conversationId, id))
        .orderBy(chatMessages.createdAt);

      return {
        success: true,
        data: {
          ...conversation,
          messages,
        },
      };
    }
  );

  // DELETE /chat/conversations/:id - Delete conversation
  fastify.delete<{ Params: { id: string } }>(
    "/conversations/:id",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Delete a chat conversation",
        tags: ["Chat"],
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) return reply.unauthorized("Not authenticated");

      const { id } = request.params;

      const [conversation] = await fastify.db
        .select()
        .from(chatConversations)
        .where(eq(chatConversations.id, id))
        .limit(1);

      if (!conversation || conversation.userId !== user.id) {
        return reply.notFound("Conversation not found");
      }

      await fastify.db
        .delete(chatConversations)
        .where(eq(chatConversations.id, id));

      return { success: true, message: "Conversation deleted" };
    }
  );

  // POST /chat - Send message and stream response via SSE
  fastify.post<{
    Body: {
      message: string;
      conversationId?: string;
      provider?: AIChatProvider;
      model?: string;
    };
  }>(
    "/",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Send a chat message and receive streaming response",
        tags: ["Chat"],
        body: {
          type: "object",
          properties: {
            message: { type: "string" },
            conversationId: { type: "string" },
            provider: { type: "string", enum: ["claude", "openai", "gemini"] },
            model: { type: "string" },
          },
          required: ["message"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) return reply.unauthorized("Not authenticated");

      const { message, conversationId, provider: requestProvider, model: requestModel } = request.body;

      // Resolve provider: request > setting > "claude"
      const settingProvider = await getSystemSetting(fastify.db, "chat", "provider");
      const provider = (requestProvider || settingProvider || "claude") as AIChatProvider;

      // Resolve model override
      const settingModel = await getSystemSetting(fastify.db, "chat", "model");
      const model = requestModel || settingModel || undefined;

      // Get API key for provider
      let apiKey: string | null = null;
      switch (provider) {
        case "claude":
          apiKey = await getSystemSetting(fastify.db, "anthropic", "api_key");
          break;
        case "openai":
          apiKey = await getSystemSetting(fastify.db, "openai", "api_key");
          break;
        case "gemini":
          apiKey = await getSystemSetting(fastify.db, "google", "gemini_api_key");
          break;
      }

      if (!apiKey) {
        return reply.badRequest(
          `API key not configured for ${provider}. Add it in Settings.`
        );
      }

      // Create or load conversation
      let convId = conversationId;
      let isNewConversation = false;

      if (!convId) {
        // Create new conversation
        const [newConv] = await fastify.db
          .insert(chatConversations)
          .values({
            userId: user.id,
            title: message.slice(0, 100),
          })
          .returning();
        convId = newConv!.id;
        isNewConversation = true;
      } else {
        // Verify conversation belongs to user
        const [existing] = await fastify.db
          .select()
          .from(chatConversations)
          .where(eq(chatConversations.id, convId))
          .limit(1);

        if (!existing || existing.userId !== user.id) {
          return reply.notFound("Conversation not found");
        }
      }

      // Save user message to DB
      await fastify.db.insert(chatMessages).values({
        conversationId: convId,
        role: "user",
        content: message,
      });

      // Load conversation history
      const history = await fastify.db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.conversationId, convId))
        .orderBy(chatMessages.createdAt);

      const historyMessages = history.map((m: any) => ({
        role: m.role,
        content: m.content,
      }));

      // Build context
      const context = await buildChatContext(
        fastify.db,
        user.id,
        user.name || undefined
      );

      // Set up SSE response
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      const sendEvent = (event: string, data: any) => {
        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      // Send conversation ID if newly created
      if (isNewConversation) {
        sendEvent("conversation_created", { conversationId: convId });
      }

      // Stream the response
      let fullResponse = "";
      let tokenUsage: any = null;

      try {
        for await (const chunk of streamChat(
          provider,
          apiKey,
          context.systemPrompt,
          historyMessages,
          model
        )) {
          if (chunk.type === "token") {
            fullResponse += chunk.data;
            sendEvent("token", { token: chunk.data });
          } else if (chunk.type === "done") {
            tokenUsage = chunk.usage || null;
          } else if (chunk.type === "error") {
            sendEvent("error", { error: chunk.data });
            reply.raw.end();
            return;
          }
        }

        // Save assistant response to DB
        const [savedMessage] = await fastify.db
          .insert(chatMessages)
          .values({
            conversationId: convId,
            role: "assistant",
            content: fullResponse,
            provider,
            model: model || null,
            tokenUsage,
          })
          .returning();

        // Update conversation timestamp
        await fastify.db
          .update(chatConversations)
          .set({ updatedAt: new Date() })
          .where(eq(chatConversations.id, convId));

        sendEvent("done", {
          messageId: savedMessage!.id,
          conversationId: convId,
        });
      } catch (error: any) {
        fastify.log.error({ err: error }, "Chat streaming error");
        sendEvent("error", { error: error.message || "Streaming error" });
      }

      reply.raw.end();
    }
  );
};
