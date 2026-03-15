import type { FastifyPluginAsync } from "fastify";
import {
  chatMessages,
  chatConversations,
} from "@openframe/database/schema";
import { eq, and } from "drizzle-orm";
import { timingSafeEqual } from "crypto";
import { getSystemSetting } from "../settings/index.js";
import { streamChat } from "../../services/ai-chat.js";
import type { AIChatProvider } from "@openframe/shared";

// POST /api/v1/ai-relay
// Called by Cloud Next.js to relay AI chat requests from self-hosted instances.
// Auth: provisioning secret. The Cloud verifies instance credentials before forwarding here.
export const aiRelayRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/",
    {
      schema: {
        description: "Relay AI chat request using platform API keys",
        tags: ["AI Relay"],
        body: {
          type: "object",
          properties: {
            provider: {
              type: "string",
              enum: ["claude", "openai", "gemini", "azure_openai", "grok", "openrouter", "local_llm"],
            },
            model: { type: "string" },
            systemPrompt: { type: "string" },
            messages: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  role: { type: "string" },
                  content: { type: "string" },
                },
                required: ["role", "content"],
              },
            },
            userId: { type: "string" },
          },
          required: ["provider", "systemPrompt", "messages", "userId"],
        },
      },
    },
    async (request, reply) => {
      // Verify provisioning secret (timing-safe)
      const secret = request.headers["x-provisioning-secret"];
      if (
        !fastify.provisioningSecret ||
        !secret ||
        typeof secret !== "string" ||
        secret.length !== fastify.provisioningSecret.length ||
        !timingSafeEqual(
          Buffer.from(secret),
          Buffer.from(fastify.provisioningSecret)
        )
      ) {
        return reply.forbidden("Invalid provisioning secret");
      }

      const { provider, model, systemPrompt, messages, userId } =
        request.body as {
          provider: AIChatProvider;
          model?: string;
          systemPrompt: string;
          messages: { role: string; content: string }[];
          userId: string;
        };

      // Get platform API key (global, not user-scoped)
      const providerKeyMap: Record<
        string,
        { category: string; key: string }
      > = {
        claude: { category: "anthropic", key: "api_key" },
        openai: { category: "openai", key: "api_key" },
        gemini: { category: "google", key: "gemini_api_key" },
        azure_openai: { category: "azure_openai", key: "api_key" },
        grok: { category: "grok", key: "api_key" },
        openrouter: { category: "openrouter", key: "api_key" },
        local_llm: { category: "local_llm", key: "base_url" },
      };
      const keyInfo = providerKeyMap[provider];
      if (!keyInfo) {
        return reply.badRequest(`Unknown provider: ${provider}`);
      }

      const apiKey = await getSystemSetting(
        fastify.db,
        keyInfo.category,
        keyInfo.key
      );
      if (!apiKey) {
        return reply.badRequest(
          `Platform API key not configured for ${provider}`
        );
      }

      // Set up SSE response
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      const sendEvent = (event: string, data: any) => {
        reply.raw.write(
          `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
        );
      };

      let fullResponse = "";
      let tokenUsage: any = null;

      try {
        for await (const chunk of streamChat(
          provider,
          apiKey,
          systemPrompt,
          messages,
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

        // Record usage in a billing conversation for this user
        // Find or create a billing-tracking conversation
        let [billingConv] = await fastify.db
          .select()
          .from(chatConversations)
          .where(
            and(
              eq(chatConversations.userId, userId),
              eq(chatConversations.title, "__cloud_ai_billing__")
            )
          )
          .limit(1);

        if (!billingConv) {
          [billingConv] = await fastify.db
            .insert(chatConversations)
            .values({
              userId,
              title: "__cloud_ai_billing__",
            })
            .returning();
        }

        // Insert assistant message with usage for billing aggregation
        await fastify.db.insert(chatMessages).values({
          conversationId: billingConv!.id,
          role: "assistant",
          content: "[cloud relay]",
          provider,
          model: model || null,
          tokenUsage: tokenUsage
            ? { ...tokenUsage, keySource: "platform" }
            : { keySource: "platform" },
        });

        sendEvent("done", {
          usage: tokenUsage,
        });
      } catch (error: any) {
        fastify.log.error({ err: error }, "AI relay streaming error");
        sendEvent("error", {
          error: error.message || "Streaming error",
        });
      }

      reply.raw.end();
    }
  );
};
