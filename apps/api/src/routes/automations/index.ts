import type { FastifyPluginAsync } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import {
  haAutomations,
  homeAssistantConfig,
  homeAssistantEntities,
  systemSettings,
} from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";
import { getAutomationEngine } from "../../services/automation-engine.js";
import type {
  AutomationTriggerType,
  AutomationActionType,
  AutomationTriggerConfig,
  AutomationActionConfig,
  AutomationParseResult,
} from "@openframe/shared";

// AI provider types
type AIProvider = "openai" | "anthropic" | "gemini";

interface HAEntityInfo {
  entity_id: string;
  state: string;
  friendly_name: string;
  domain: string;
}

// Build AI prompt for parsing natural language automation
function buildParsePrompt(entities: HAEntityInfo[]): string {
  const entityList = entities
    .slice(0, 100) // Limit to avoid context overflow
    .map((e) => `- ${e.entity_id} (${e.friendly_name || e.entity_id}): ${e.state}`)
    .join("\n");

  return `You are a smart home automation assistant. Parse natural language requests into structured automation rules.

Available Home Assistant entities:
${entityList}

Supported trigger types:
- time: Schedule-based (e.g., "at 7am", "weekdays at sunset")
- state: When an entity changes state (e.g., "when washer finishes")
- duration: When an entity stays in a state for a period (e.g., "when garage open for 30 minutes")

Supported action types:
- service_call: Call a Home Assistant service (turn on/off lights, lock doors, etc.)
- notification: Show a notification to the user

Return a JSON object with this exact structure:
{
  "name": "Short descriptive name",
  "trigger": {
    "type": "time" | "state" | "duration",
    "config": {
      // For time: { "time": "07:00", "days": [1,2,3,4,5] } // days are 0-6, Sunday-Saturday
      // For state: { "entityId": "sensor.washer", "fromState": "running", "toState": "idle" }
      // For duration: { "entityId": "cover.garage", "targetState": "open", "durationMinutes": 30 }
    }
  },
  "action": {
    "type": "service_call" | "notification",
    "config": {
      // For service_call: { "domain": "light", "service": "turn_on", "entityId": "light.kitchen" }
      // For notification: { "title": "Alert", "message": "Your message here" }
    }
  },
  "confidence": 0.0-1.0
}

Important:
- Match entity IDs exactly from the available list
- Use appropriate domains (light, switch, cover, lock, sensor, etc.)
- For time triggers, use 24-hour format (e.g., "07:00" not "7:00 AM")
- If the request is ambiguous, set confidence lower
- Only return valid JSON, no explanations`;
}

// Call AI provider to parse the request
async function callAI(
  provider: AIProvider,
  apiKey: string,
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  if (provider === "openai") {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message?: { content?: string } }>;
    };
    return data.choices[0]?.message?.content || "";
  }

  if (provider === "anthropic") {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text?: string }>;
    };
    const content = data.content[0];
    return content?.type === "text" ? content.text || "" : "";
  }

  if (provider === "gemini") {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: `${systemPrompt}\n\nUser request: ${userMessage}` }],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  throw new Error(`Unsupported AI provider: ${provider}`);
}

export const automationRoutes: FastifyPluginAsync = async (fastify) => {
  // ==================== PARSE ====================

  // Parse natural language into automation structure
  fastify.post(
    "/parse",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Parse natural language into automation structure using AI",
        tags: ["Automations"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            prompt: { type: "string", minLength: 1 },
          },
          required: ["prompt"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        return reply.unauthorized("Not authenticated");
      }
      const { prompt } = request.body as { prompt: string };

      // Get AI provider settings
      const aiSettings = await fastify.db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.category, "ai"));

      const providerSetting = aiSettings.find((s) => s.key === "provider");
      const provider = (providerSetting?.value || "openai") as AIProvider;

      const apiKeySetting = aiSettings.find((s) => s.key === `${provider}_api_key`);
      if (!apiKeySetting?.value) {
        return reply.status(400).send({
          success: false,
          error: { code: "AI_NOT_CONFIGURED", message: `${provider} API key not configured` },
        });
      }

      // Get HA config
      const [haConfig] = await fastify.db
        .select()
        .from(homeAssistantConfig)
        .where(eq(homeAssistantConfig.userId, user.id))
        .limit(1);

      if (!haConfig) {
        return reply.status(400).send({
          success: false,
          error: { code: "HA_NOT_CONFIGURED", message: "Home Assistant not configured" },
        });
      }

      // Fetch all HA entities
      const baseUrl = haConfig.url.replace(/\/+$/, "");
      const statesResponse = await fetch(`${baseUrl}/api/states`, {
        headers: {
          Authorization: `Bearer ${haConfig.accessToken}`,
        },
      });

      if (!statesResponse.ok) {
        return reply.status(500).send({
          success: false,
          error: { code: "HA_ERROR", message: "Failed to fetch Home Assistant states" },
        });
      }

      const states = (await statesResponse.json()) as Array<{
        entity_id: string;
        state: string;
        attributes: Record<string, unknown>;
      }>;

      // Build entity info list
      const entities: HAEntityInfo[] = states.map((s) => ({
        entity_id: s.entity_id,
        state: s.state,
        friendly_name: (s.attributes.friendly_name as string) || s.entity_id,
        domain: s.entity_id.split(".")[0] || "",
      }));

      // Build prompt and call AI
      const systemPrompt = buildParsePrompt(entities);

      try {
        const aiResponse = await callAI(provider, apiKeySetting.value, systemPrompt, prompt);

        // Parse AI response
        let parsed: AutomationParseResult;
        try {
          // Extract JSON from response (in case of markdown formatting)
          const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error("No JSON found in response");
          }
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          return reply.status(500).send({
            success: false,
            error: { code: "PARSE_ERROR", message: "Failed to parse AI response" },
          });
        }

        return {
          success: true,
          data: parsed,
        };
      } catch (error) {
        fastify.log.error({ err: error }, "AI parsing failed");
        return reply.status(500).send({
          success: false,
          error: { code: "AI_ERROR", message: "AI parsing failed" },
        });
      }
    }
  );

  // ==================== CRUD ====================

  // List all automations
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "List all automations",
        tags: ["Automations"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const automations = await fastify.db
        .select()
        .from(haAutomations)
        .where(eq(haAutomations.userId, user.id))
        .orderBy(desc(haAutomations.createdAt));

      return {
        success: true,
        data: automations,
      };
    }
  );

  // Create automation
  fastify.post(
    "/",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Create a new automation",
        tags: ["Automations"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1 },
            description: { type: "string" },
            triggerType: { type: "string", enum: ["time", "state", "duration"] },
            triggerConfig: { type: "object" },
            actionType: { type: "string", enum: ["service_call", "notification"] },
            actionConfig: { type: "object" },
          },
          required: ["name", "triggerType", "triggerConfig", "actionType", "actionConfig"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const body = request.body as {
        name: string;
        description?: string;
        triggerType: AutomationTriggerType;
        triggerConfig: AutomationTriggerConfig;
        actionType: AutomationActionType;
        actionConfig: AutomationActionConfig;
      };

      const [automation] = await fastify.db
        .insert(haAutomations)
        .values({
          userId: user.id,
          name: body.name,
          description: body.description || null,
          triggerType: body.triggerType,
          triggerConfig: body.triggerConfig,
          actionType: body.actionType,
          actionConfig: body.actionConfig,
        })
        .returning();

      return {
        success: true,
        data: automation,
      };
    }
  );

  // Update automation
  fastify.patch(
    "/:id",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Update an automation",
        tags: ["Automations"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            enabled: { type: "boolean" },
            triggerType: { type: "string", enum: ["time", "state", "duration"] },
            triggerConfig: { type: "object" },
            actionType: { type: "string", enum: ["service_call", "notification"] },
            actionConfig: { type: "object" },
          },
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        return reply.unauthorized("Not authenticated");
      }
      const { id } = request.params as { id: string };
      const body = request.body as Partial<{
        name: string;
        description: string;
        enabled: boolean;
        triggerType: AutomationTriggerType;
        triggerConfig: AutomationTriggerConfig;
        actionType: AutomationActionType;
        actionConfig: AutomationActionConfig;
      }>;

      // Verify ownership
      const [existing] = await fastify.db
        .select()
        .from(haAutomations)
        .where(and(eq(haAutomations.id, id), eq(haAutomations.userId, user.id)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Automation not found" },
        });
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.enabled !== undefined) updateData.enabled = body.enabled;
      if (body.triggerType !== undefined) updateData.triggerType = body.triggerType;
      if (body.triggerConfig !== undefined) updateData.triggerConfig = body.triggerConfig;
      if (body.actionType !== undefined) updateData.actionType = body.actionType;
      if (body.actionConfig !== undefined) updateData.actionConfig = body.actionConfig;

      const [automation] = await fastify.db
        .update(haAutomations)
        .set(updateData)
        .where(eq(haAutomations.id, id))
        .returning();

      return {
        success: true,
        data: automation,
      };
    }
  );

  // Delete automation
  fastify.delete(
    "/:id",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Delete an automation",
        tags: ["Automations"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        return reply.unauthorized("Not authenticated");
      }
      const { id } = request.params as { id: string };

      // Verify ownership
      const [existing] = await fastify.db
        .select()
        .from(haAutomations)
        .where(and(eq(haAutomations.id, id), eq(haAutomations.userId, user.id)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Automation not found" },
        });
      }

      await fastify.db.delete(haAutomations).where(eq(haAutomations.id, id));

      return {
        success: true,
        data: { deleted: true },
      };
    }
  );

  // ==================== TEST ====================

  // Test execute an automation
  fastify.post(
    "/:id/test",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Test execute an automation",
        tags: ["Automations"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        return reply.unauthorized("Not authenticated");
      }
      const { id } = request.params as { id: string };

      // Get automation
      const [automation] = await fastify.db
        .select()
        .from(haAutomations)
        .where(and(eq(haAutomations.id, id), eq(haAutomations.userId, user.id)))
        .limit(1);

      if (!automation) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Automation not found" },
        });
      }

      const engine = getAutomationEngine(fastify);
      const result = await engine.testExecute(automation);

      if (!result.success) {
        return reply.status(500).send({
          success: false,
          error: { code: "EXECUTION_FAILED", message: result.error },
        });
      }

      return {
        success: true,
        data: { executed: true },
      };
    }
  );

  // ==================== NOTIFICATIONS ====================

  // Get pending notifications
  fastify.get(
    "/notifications",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get pending automation notifications",
        tags: ["Automations"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const engine = getAutomationEngine(fastify);
      const notifications = engine.getNotifications(user.id);

      return {
        success: true,
        data: notifications,
      };
    }
  );

  // Dismiss a notification
  fastify.delete(
    "/notifications/:notificationId",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Dismiss an automation notification",
        tags: ["Automations"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            notificationId: { type: "string" },
          },
          required: ["notificationId"],
        },
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const { notificationId } = request.params as { notificationId: string };
      const engine = getAutomationEngine(fastify);
      engine.dismissNotification(user.id, notificationId);

      return {
        success: true,
        data: { dismissed: true },
      };
    }
  );

  // Clear all notifications
  fastify.delete(
    "/notifications",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Clear all automation notifications",
        tags: ["Automations"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }
      const engine = getAutomationEngine(fastify);
      engine.clearNotifications(user.id);

      return {
        success: true,
        data: { cleared: true },
      };
    }
  );
};
