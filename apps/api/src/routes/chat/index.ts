import type { FastifyPluginAsync } from "fastify";
import { eq, desc, sql } from "drizzle-orm";
import {
  chatConversations,
  chatMessages,
} from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";
import { getSystemSetting, getCategorySettings } from "../settings/index.js";
import { buildChatContext, streamChat, testProviderConnection } from "../../services/ai-chat.js";
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

      // Check global keys (platform-level)
      const [anthropicKey, openaiKey, geminiKey, azureKey, grokKey, openrouterKey, localLlmUrl, defaultProvider] =
        await Promise.all([
          getSystemSetting(fastify.db, "anthropic", "api_key"),
          getSystemSetting(fastify.db, "openai", "api_key"),
          getSystemSetting(fastify.db, "google", "gemini_api_key"),
          getSystemSetting(fastify.db, "azure_openai", "api_key"),
          getSystemSetting(fastify.db, "grok", "api_key"),
          getSystemSetting(fastify.db, "openrouter", "api_key"),
          getSystemSetting(fastify.db, "local_llm", "base_url"),
          getSystemSetting(fastify.db, "chat", "provider"),
        ]);

      // Check user-scoped keys (BYOK)
      const [userAnthropicKey, userOpenaiKey, userGeminiKey, userAzureKey, userGrokKey, userOpenrouterKey, userLocalLlmUrl, hostedAiSetting] =
        await Promise.all([
          getSystemSetting(fastify.db, "anthropic", "api_key", user.id),
          getSystemSetting(fastify.db, "openai", "api_key", user.id),
          getSystemSetting(fastify.db, "google", "gemini_api_key", user.id),
          getSystemSetting(fastify.db, "azure_openai", "api_key", user.id),
          getSystemSetting(fastify.db, "grok", "api_key", user.id),
          getSystemSetting(fastify.db, "openrouter", "api_key", user.id),
          getSystemSetting(fastify.db, "local_llm", "base_url", user.id),
          getSystemSetting(fastify.db, "chat", "hosted_ai_enabled", user.id),
        ]);

      const isHosted = fastify.hostedMode;

      // Check if cloud AI relay is available (self-hosted instances connected to cloud)
      let cloudAiAvailable = false;
      if (!isHosted) {
        const cloudCfg = await getCategorySettings(fastify.db, "cloud") as Record<string, string>;
        cloudAiAvailable = !!(
          cloudCfg?.enabled === "true" &&
          cloudCfg?.instance_id &&
          cloudCfg?.relay_secret
        );
      }

      return {
        success: true,
        data: {
          claude: !!anthropicKey || !!userAnthropicKey,
          openai: !!openaiKey || !!userOpenaiKey,
          gemini: !!geminiKey || !!userGeminiKey,
          azure_openai: !!azureKey || !!userAzureKey,
          grok: !!grokKey || !!userGrokKey,
          openrouter: !!openrouterKey || !!userOpenrouterKey,
          local_llm: !!localLlmUrl || !!userLocalLlmUrl,
          openframe: hostedAiSetting === "true",
          defaultProvider: (defaultProvider as AIChatProvider) || "claude",
          // Hosted AI info (works for both hosted instances and self-hosted via cloud relay)
          hostedAiAvailable:
            (isHosted && (!!anthropicKey || !!openaiKey || !!geminiKey)) ||
            cloudAiAvailable,
          hostedAiEnabled: hostedAiSetting === "true",
          hasOwnKey: {
            claude: !!userAnthropicKey,
            openai: !!userOpenaiKey,
            gemini: !!userGeminiKey,
            azure_openai: !!userAzureKey,
            grok: !!userGrokKey,
            openrouter: !!userOpenrouterKey,
            local_llm: !!userLocalLlmUrl,
          },
        },
      };
    }
  );

  // POST /chat/test-provider - Test connectivity to an AI provider
  fastify.post<{
    Body: {
      provider: string;
      apiKey?: string;
      config?: { baseUrl?: string; deploymentName?: string; apiVersion?: string; model?: string };
    };
  }>(
    "/test-provider",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Test connectivity to an AI provider",
        tags: ["Chat"],
        body: {
          type: "object",
          properties: {
            provider: { type: "string" },
            apiKey: { type: "string" },
            config: {
              type: "object",
              properties: {
                baseUrl: { type: "string" },
                deploymentName: { type: "string" },
                apiVersion: { type: "string" },
                model: { type: "string" },
              },
            },
          },
          required: ["provider"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) return reply.unauthorized("Not authenticated");

      const { provider, apiKey: providedKey, config: providedConfig } = request.body;

      // If no key provided, look up the stored key
      let apiKey = providedKey || null;
      let providerConfig = providedConfig || undefined;

      if (!apiKey) {
        const providerKeyMap: Record<string, { category: string; key: string }> = {
          claude: { category: "anthropic", key: "api_key" },
          openai: { category: "openai", key: "api_key" },
          gemini: { category: "google", key: "gemini_api_key" },
          azure_openai: { category: "azure_openai", key: "api_key" },
          grok: { category: "grok", key: "api_key" },
          openrouter: { category: "openrouter", key: "api_key" },
          local_llm: { category: "local_llm", key: "api_key" },
        };
        const keyInfo = providerKeyMap[provider];
        if (keyInfo) {
          apiKey = await getSystemSetting(fastify.db, keyInfo.category, keyInfo.key, user.id)
            || await getSystemSetting(fastify.db, keyInfo.category, keyInfo.key);
        }
      }

      // For providers needing extra config, fetch from settings if not provided
      if (!providerConfig) {
        if (provider === "azure_openai") {
          const [baseUrl, deploymentName, apiVersion] = await Promise.all([
            getSystemSetting(fastify.db, "azure_openai", "base_url", user.id) || getSystemSetting(fastify.db, "azure_openai", "base_url"),
            getSystemSetting(fastify.db, "azure_openai", "deployment_name", user.id) || getSystemSetting(fastify.db, "azure_openai", "deployment_name"),
            getSystemSetting(fastify.db, "azure_openai", "api_version", user.id) || getSystemSetting(fastify.db, "azure_openai", "api_version"),
          ]);
          providerConfig = { baseUrl: baseUrl || undefined, deploymentName: deploymentName || undefined, apiVersion: apiVersion || "2024-02-01" };
        } else if (provider === "local_llm") {
          const [baseUrl, localModel] = await Promise.all([
            getSystemSetting(fastify.db, "local_llm", "base_url", user.id) || getSystemSetting(fastify.db, "local_llm", "base_url"),
            getSystemSetting(fastify.db, "local_llm", "model", user.id) || getSystemSetting(fastify.db, "local_llm", "model"),
          ]);
          providerConfig = { baseUrl: baseUrl || undefined, model: localModel || undefined };
          // For local_llm, get the optional API key
          if (!apiKey) {
            apiKey = "no-key";
          }
        } else if (provider === "openrouter") {
          const orModel = await getSystemSetting(fastify.db, "openrouter", "model", user.id)
            || await getSystemSetting(fastify.db, "openrouter", "model");
          if (orModel) providerConfig = { model: orModel };
        }
      }

      if (!apiKey && provider !== "local_llm") {
        return reply.badRequest(`No API key configured for ${provider}`);
      }

      const result = await testProviderConnection(provider, apiKey || "no-key", providerConfig);
      return { success: true, data: result };
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
            provider: { type: "string", enum: ["claude", "openai", "gemini", "azure_openai", "grok", "openrouter", "local_llm", "openframe"] },
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

      // Resolve model: request > provider-specific user setting > provider-specific global > chat.model fallback
      let model = requestModel || undefined;
      if (!model) {
        const providerModelMap: Record<string, { category: string; key: string }> = {
          claude: { category: "anthropic", key: "model" },
          openai: { category: "openai", key: "model" },
          gemini: { category: "google", key: "gemini_model" },
          grok: { category: "grok", key: "model" },
          openrouter: { category: "openrouter", key: "model" },
          local_llm: { category: "local_llm", key: "model" },
        };
        const modelInfo = providerModelMap[provider];
        if (modelInfo) {
          model = await getSystemSetting(fastify.db, modelInfo.category, modelInfo.key, user.id)
            || await getSystemSetting(fastify.db, modelInfo.category, modelInfo.key)
            || undefined;
        }
        if (!model) {
          const settingModel = await getSystemSetting(fastify.db, "chat", "model");
          model = settingModel || undefined;
        }
      }

      // Resolve API key: user-scoped BYOK first, then hosted AI fallback
      let apiKey: string | null = null;
      let keySource: "user" | "platform" | "self_hosted" | "cloud" = "self_hosted";

      // Map provider to setting category/key
      const providerKeyMap: Record<string, { category: string; key: string }> = {
        claude: { category: "anthropic", key: "api_key" },
        openai: { category: "openai", key: "api_key" },
        gemini: { category: "google", key: "gemini_api_key" },
        azure_openai: { category: "azure_openai", key: "api_key" },
        grok: { category: "grok", key: "api_key" },
        openrouter: { category: "openrouter", key: "api_key" },
        local_llm: { category: "local_llm", key: "base_url" },
      };
      const keyInfo = providerKeyMap[provider];

      if (keyInfo) {
        // 1. Try user-scoped key (BYOK)
        apiKey = await getSystemSetting(
          fastify.db,
          keyInfo.category,
          keyInfo.key,
          user.id
        );
        if (apiKey) {
          keySource = "user";
        }

        // 2. If no user key, check hosted vs self-hosted mode
        if (!apiKey && fastify.hostedMode) {
          // Check if user has opted in to hosted AI
          const hostedConsent = await getSystemSetting(
            fastify.db,
            "chat",
            "hosted_ai_enabled",
            user.id
          );
          if (hostedConsent === "true") {
            // Get platform-level (global) key
            apiKey = await getSystemSetting(
              fastify.db,
              keyInfo.category,
              keyInfo.key
            );
            if (apiKey) {
              keySource = "platform";
            }
          } else {
            return reply.code(402).send({
              error: "hosted_ai_required",
              message:
                "Enable hosted AI to use this feature, or add your own API key in Settings.",
              enableUrl: "/api/billing/enable-ai",
            });
          }
        } else if (!apiKey) {
          // Self-hosted mode: fall back to global key
          apiKey = await getSystemSetting(
            fastify.db,
            keyInfo.category,
            keyInfo.key
          );
          if (apiKey) {
            keySource = "self_hosted";
          }
        }
      }

      // If still no key, check if cloud AI relay is available (self-hosted → cloud)
      let useCloudRelay = false;
      let cloudSettings: Record<string, string> | null = null;
      if (!apiKey && !fastify.hostedMode) {
        cloudSettings = await getCategorySettings(fastify.db, "cloud") as Record<string, string>;
        if (
          cloudSettings?.enabled === "true" &&
          cloudSettings?.instance_id &&
          cloudSettings?.relay_secret
        ) {
          useCloudRelay = true;
          keySource = "cloud";
        }
      }

      if (!apiKey && !useCloudRelay) {
        return reply.badRequest(
          `API key not configured for ${provider}. Add it in Settings or enable Cloud AI.`
        );
      }

      // Fetch extra provider config for providers that need more than just an API key
      let providerConfig: { baseUrl?: string; deploymentName?: string; apiVersion?: string; model?: string } | undefined;
      if (provider === "azure_openai") {
        const [baseUrl, deploymentName, apiVersion] = await Promise.all([
          getSystemSetting(fastify.db, "azure_openai", "base_url", user.id) || getSystemSetting(fastify.db, "azure_openai", "base_url"),
          getSystemSetting(fastify.db, "azure_openai", "deployment_name", user.id) || getSystemSetting(fastify.db, "azure_openai", "deployment_name"),
          getSystemSetting(fastify.db, "azure_openai", "api_version", user.id) || getSystemSetting(fastify.db, "azure_openai", "api_version"),
        ]);
        providerConfig = { baseUrl: baseUrl || undefined, deploymentName: deploymentName || undefined, apiVersion: apiVersion || "2024-02-01" };
      } else if (provider === "openrouter") {
        const orModel = await getSystemSetting(fastify.db, "openrouter", "model", user.id)
          || await getSystemSetting(fastify.db, "openrouter", "model");
        if (orModel) providerConfig = { model: orModel };
      } else if (provider === "local_llm") {
        const [baseUrl, localModel] = await Promise.all([
          getSystemSetting(fastify.db, "local_llm", "base_url", user.id) || getSystemSetting(fastify.db, "local_llm", "base_url"),
          getSystemSetting(fastify.db, "local_llm", "model", user.id) || getSystemSetting(fastify.db, "local_llm", "model"),
        ]);
        providerConfig = { baseUrl: baseUrl || undefined, model: localModel || undefined };
        // For local_llm, the "apiKey" resolved above is actually the base_url — get the real optional key
        if (provider === "local_llm") {
          const localApiKey = await getSystemSetting(fastify.db, "local_llm", "api_key", user.id)
            || await getSystemSetting(fastify.db, "local_llm", "api_key");
          apiKey = localApiKey || "no-key";
        }
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
        if (useCloudRelay && cloudSettings) {
          // Cloud AI relay: forward to cloud, parse SSE response
          const cloudUrl =
            cloudSettings.url ||
            (cloudSettings.ws_endpoint
              ? (() => {
                  try {
                    const u = new URL(cloudSettings.ws_endpoint);
                    return `${u.protocol === "wss:" ? "https" : "http"}://${u.host}`;
                  } catch {
                    return null;
                  }
                })()
              : null);

          if (!cloudUrl) {
            sendEvent("error", { error: "Cloud URL not configured" });
            reply.raw.end();
            return;
          }

          const relayResponse = await fetch(`${cloudUrl}/api/ai/relay`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-instance-id": cloudSettings.instance_id!,
              "x-relay-secret": cloudSettings.relay_secret!,
            },
            body: JSON.stringify({
              provider,
              model: model || undefined,
              systemPrompt: context.systemPrompt,
              messages: historyMessages,
            }),
          });

          if (!relayResponse.ok) {
            const errBody = await relayResponse.json().catch(() => ({ error: "Cloud AI relay error" })) as any;
            sendEvent("error", { error: errBody.error || errBody.message || `Cloud error: ${relayResponse.status}` });
            reply.raw.end();
            return;
          }

          if (!relayResponse.body) {
            sendEvent("error", { error: "No response from cloud relay" });
            reply.raw.end();
            return;
          }

          // Parse SSE events from the cloud relay response
          const reader = relayResponse.body.getReader();
          const decoder = new TextDecoder();
          let sseBuffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            sseBuffer += decoder.decode(value, { stream: true });
            const lines = sseBuffer.split("\n");
            sseBuffer = lines.pop() || "";

            let currentEvent = "";
            for (const line of lines) {
              if (line.startsWith("event: ")) {
                currentEvent = line.slice(7).trim();
              } else if (line.startsWith("data: ")) {
                const data = line.slice(6);
                try {
                  const parsed = JSON.parse(data);
                  if (currentEvent === "token" && parsed.token) {
                    fullResponse += parsed.token;
                    sendEvent("token", { token: parsed.token });
                  } else if (currentEvent === "done") {
                    tokenUsage = parsed.usage || null;
                  } else if (currentEvent === "error") {
                    sendEvent("error", { error: parsed.error });
                    reply.raw.end();
                    return;
                  }
                } catch { /* skip malformed */ }
                currentEvent = "";
              }
            }
          }
        } else {
          // Direct AI call with local API key
          for await (const chunk of streamChat(
            provider,
            apiKey!,
            context.systemPrompt,
            historyMessages,
            model,
            providerConfig
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
        }

        // Save assistant response to DB (include keySource for billing filtering)
        const [savedMessage] = await fastify.db
          .insert(chatMessages)
          .values({
            conversationId: convId,
            role: "assistant",
            content: fullResponse,
            provider,
            model: model || null,
            tokenUsage: tokenUsage ? { ...tokenUsage, keySource } : { keySource },
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
