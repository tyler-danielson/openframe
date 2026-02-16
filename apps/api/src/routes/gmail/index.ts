import type { FastifyPluginAsync } from "fastify";
import { eq, and } from "drizzle-orm";
import { oauthTokens } from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";
import { getGmailHighlights, checkGmailAccess } from "../../services/gmail.js";
import { getCategorySettings } from "../settings/index.js";

export const gmailRoutes: FastifyPluginAsync = async (fastify) => {
  // Get Gmail status (check if user has Gmail access)
  fastify.get(
    "/status",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Check Gmail connection status",
        tags: ["Gmail"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  connected: { type: "boolean" },
                  hasGmailScope: { type: "boolean" },
                  error: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        return reply.unauthorized("Not authenticated");
      }

      // Get Google OAuth tokens
      const [oauth] = await fastify.db
        .select()
        .from(oauthTokens)
        .where(
          and(
            eq(oauthTokens.userId, user.id),
            eq(oauthTokens.provider, "google")
          )
        )
        .limit(1);

      if (!oauth) {
        return {
          success: true,
          data: {
            connected: false,
            hasGmailScope: false,
            error: "Not connected to Google",
          },
        };
      }

      // Check if Gmail scope is in the token
      const scope = oauth.scope || "";
      const hasGmailScope = scope.includes("gmail.readonly");

      if (!hasGmailScope) {
        return {
          success: true,
          data: {
            connected: true,
            hasGmailScope: false,
            error: "Gmail access not granted. Please re-authenticate with Google.",
          },
        };
      }

      // Verify actual access - pass OAuth credentials from DB
      const googleSettings = await getCategorySettings(fastify.db, "google");
      const accessCheck = await checkGmailAccess({
        accessToken: oauth.accessToken,
        refreshToken: oauth.refreshToken || undefined,
        clientId: googleSettings.client_id || undefined,
        clientSecret: googleSettings.client_secret || undefined,
      });

      return {
        success: true,
        data: {
          connected: true,
          hasGmailScope: accessCheck.hasAccess,
          error: accessCheck.error,
        },
      };
    }
  );

  // Get Gmail highlights (recent important emails)
  fastify.get(
    "/highlights",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Get recent email highlights",
        tags: ["Gmail"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        querystring: {
          type: "object",
          properties: {
            limit: { type: "number", default: 10 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    from: { type: "string" },
                    subject: { type: "string" },
                    snippet: { type: "string" },
                    receivedAt: { type: "string" },
                    isUnread: { type: "boolean" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        return reply.unauthorized("Not authenticated");
      }

      const { limit = 10 } = request.query as { limit?: number };

      // Get Google OAuth tokens
      const [oauth] = await fastify.db
        .select()
        .from(oauthTokens)
        .where(
          and(
            eq(oauthTokens.userId, user.id),
            eq(oauthTokens.provider, "google")
          )
        )
        .limit(1);

      if (!oauth) {
        return reply.badRequest("Not connected to Google");
      }

      // Check if Gmail scope is available
      const scope = oauth.scope || "";
      if (!scope.includes("gmail.readonly")) {
        return reply.badRequest("Gmail access not granted. Please re-authenticate with Google.");
      }

      try {
        // Pass OAuth credentials from DB
        const googleSettings = await getCategorySettings(fastify.db, "google");
        const highlights = await getGmailHighlights(
          {
            accessToken: oauth.accessToken,
            refreshToken: oauth.refreshToken || undefined,
            clientId: googleSettings.client_id || undefined,
            clientSecret: googleSettings.client_secret || undefined,
          },
          Math.min(limit, 20) // Cap at 20 emails
        );

        return {
          success: true,
          data: highlights,
        };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Failed to fetch Gmail highlights");
        return reply.internalServerError("Failed to fetch emails");
      }
    }
  );
};
