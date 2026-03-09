import type { FastifyPluginAsync } from "fastify";
import {
  chatMessages,
  chatConversations,
  systemSettings,
} from "@openframe/database/schema";
import { eq, and, gt, sql, isNull } from "drizzle-orm";
import { timingSafeEqual } from "crypto";

export const usageRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/usage/ai-tokens?since=<ISO timestamp>
  // Protected by provisioning secret — called by Cloud cron to aggregate AI token usage
  fastify.get(
    "/ai-tokens",
    {
      schema: {
        description: "Get aggregated AI token usage since a given timestamp",
        tags: ["Usage"],
        querystring: {
          type: "object",
          properties: {
            since: { type: "string", format: "date-time" },
          },
          required: ["since"],
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

      // Get user ID from relay header
      const userId = request.headers["x-relay-user-id"] as string;
      if (!userId) {
        return reply.badRequest("Missing x-relay-user-id header");
      }

      const { since } = request.query as { since: string };
      const sinceDate = new Date(since);

      if (isNaN(sinceDate.getTime())) {
        return reply.badRequest("Invalid since timestamp");
      }

      // Aggregate token usage from assistant messages since the watermark
      // Only include messages where keySource = "platform" (hosted AI) — BYOK usage is never billed
      const rows = await fastify.db
        .select({
          provider: chatMessages.provider,
          model: chatMessages.model,
          promptTokens: sql<number>`coalesce(sum((${chatMessages.tokenUsage}->>'promptTokens')::int), 0)`,
          completionTokens: sql<number>`coalesce(sum((${chatMessages.tokenUsage}->>'completionTokens')::int), 0)`,
          messageCount: sql<number>`count(*)::int`,
        })
        .from(chatMessages)
        .innerJoin(
          chatConversations,
          eq(chatMessages.conversationId, chatConversations.id)
        )
        .where(
          and(
            eq(chatConversations.userId, userId),
            eq(chatMessages.role, "assistant"),
            gt(chatMessages.createdAt, sinceDate),
            sql`${chatMessages.tokenUsage}->>'keySource' = 'platform'`
          )
        )
        .groupBy(chatMessages.provider, chatMessages.model);

      return {
        success: true,
        data: rows.map((r) => ({
          provider: r.provider,
          model: r.model,
          promptTokens: Number(r.promptTokens),
          completionTokens: Number(r.completionTokens),
          messageCount: Number(r.messageCount),
        })),
      };
    }
  );

  // POST /api/v1/usage/hosted-ai-consent
  // Protected by provisioning secret — called by Cloud to enable/disable hosted AI for a user
  fastify.post(
    "/hosted-ai-consent",
    {
      schema: {
        description: "Enable or disable hosted AI consent for a user",
        tags: ["Usage"],
        body: {
          type: "object",
          properties: {
            enabled: { type: "boolean" },
          },
          required: ["enabled"],
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

      // Get user ID from relay header
      const userId = request.headers["x-relay-user-id"] as string;
      if (!userId) {
        return reply.badRequest("Missing x-relay-user-id header");
      }

      const { enabled } = request.body as { enabled: boolean };

      if (enabled) {
        // Upsert the hosted_ai_enabled setting
        await fastify.db
          .insert(systemSettings)
          .values({
            userId,
            category: "chat",
            key: "hosted_ai_enabled",
            value: "true",
            isSecret: false,
          })
          .onConflictDoUpdate({
            target: [
              systemSettings.userId,
              systemSettings.category,
              systemSettings.key,
            ],
            set: {
              value: "true",
              updatedAt: new Date(),
            },
          });
      } else {
        // Delete the setting
        await fastify.db
          .delete(systemSettings)
          .where(
            and(
              eq(systemSettings.userId, userId),
              eq(systemSettings.category, "chat"),
              eq(systemSettings.key, "hosted_ai_enabled")
            )
          );
      }

      return { success: true, enabled };
    }
  );
};
