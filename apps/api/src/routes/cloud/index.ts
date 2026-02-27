import type { FastifyPluginAsync } from "fastify";
import { eq, and } from "drizzle-orm";
import { systemSettings } from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";
import { getCategorySettings } from "../settings/index.js";
import { kioskCommands } from "../kiosks/index.js";

export const cloudRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/cloud/status — Get cloud connection status
  fastify.get(
    "/status",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Get cloud relay connection status",
        tags: ["Cloud"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("User not found");

      const cloudSettings = await getCategorySettings(fastify.db, "cloud");

      return {
        success: true,
        data: {
          enabled: cloudSettings.enabled === "true",
          connected: fastify.cloudRelay.isConnected,
          state: fastify.cloudRelay.connectionState,
          instanceId: cloudSettings.instance_id || null,
          wsEndpoint: cloudSettings.ws_endpoint || null,
        },
      };
    }
  );

  // POST /api/v1/cloud/connect — Initiate cloud connection (generates claim code)
  fastify.post(
    "/connect",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Start the cloud connection process by generating a claim code",
        tags: ["Cloud"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        body: {
          type: "object",
          properties: {
            cloudUrl: {
              type: "string",
              description: "Cloud server URL (e.g., https://openframe.us)",
            },
          },
          required: ["cloudUrl"],
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("User not found");

      const { cloudUrl } = request.body as { cloudUrl: string };

      // Get external URL for callback
      const [externalUrlSetting] = await fastify.db
        .select()
        .from(systemSettings)
        .where(
          and(
            eq(systemSettings.category, "server"),
            eq(systemSettings.key, "external_url")
          )
        )
        .limit(1);

      const externalUrl = externalUrlSetting?.value || `http://localhost:3000`;
      const callbackUrl = `${externalUrl}/api/v1/cloud/callback`;

      // Request a claim code from the cloud
      try {
        const res = await fetch(`${cloudUrl}/api/relay/claim`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callbackUrl, externalUrl }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Unknown error" }));
          return reply.status(502).send({
            success: false,
            error: `Cloud server error: ${err.error || res.statusText}`,
          });
        }

        const data = (await res.json()) as {
          code: string;
          expiresAt: string;
        };

        // Start polling for claim completion in the background
        const claimCode = data.code;
        const pollInterval = setInterval(async () => {
          try {
            const pollRes = await fetch(`${cloudUrl}/api/relay/claim?code=${claimCode}`);
            if (!pollRes.ok) { clearInterval(pollInterval); return; }
            const pollData = await pollRes.json() as { status: string; instanceId?: string; relaySecret?: string; wsEndpoint?: string };
            if (pollData.status === "claimed" && pollData.instanceId && pollData.relaySecret && pollData.wsEndpoint) {
              clearInterval(pollInterval);
              // Store cloud settings
              const settings = [
                { category: "cloud", key: "enabled", value: "true", isSecret: false },
                { category: "cloud", key: "instance_id", value: pollData.instanceId, isSecret: false },
                { category: "cloud", key: "relay_secret", value: pollData.relaySecret, isSecret: true },
                { category: "cloud", key: "ws_endpoint", value: pollData.wsEndpoint, isSecret: false },
              ];
              for (const setting of settings) {
                const [existing] = await fastify.db
                  .select()
                  .from(systemSettings)
                  .where(and(eq(systemSettings.category, setting.category), eq(systemSettings.key, setting.key)))
                  .limit(1);
                if (existing) {
                  await fastify.db.update(systemSettings).set({ value: setting.value, isSecret: setting.isSecret }).where(eq(systemSettings.id, existing.id));
                } else {
                  await fastify.db.insert(systemSettings).values(setting);
                }
              }
              // Configure and connect the relay
              fastify.cloudRelay.configure({ instanceId: pollData.instanceId, relaySecret: pollData.relaySecret, wsEndpoint: pollData.wsEndpoint, externalUrl });
              fastify.cloudRelay.connect();
              fastify.cloudRelay.onCommand((kioskId, commandType, cmdData) => {
                const commands = kioskCommands.get(kioskId) || [];
                commands.push({ type: commandType as any, payload: cmdData, timestamp: Date.now() });
                kioskCommands.set(kioskId, commands);
              });
              fastify.log.info(`[cloud] Claim code ${claimCode} claimed, relay connected`);
            }
          } catch {
            // Poll failed, keep trying
          }
        }, 3000);

        // Stop polling after 10 minutes (code expiry)
        setTimeout(() => clearInterval(pollInterval), 10 * 60 * 1000);

        // Return the claim URL for the frontend to open
        return {
          success: true,
          data: {
            code: data.code,
            expiresAt: data.expiresAt,
            claimUrl: `${cloudUrl}/claim?code=${data.code}&callback=${encodeURIComponent(callbackUrl)}`,
          },
        };
      } catch (err) {
        return reply.status(502).send({
          success: false,
          error: `Could not reach cloud server: ${err instanceof Error ? err.message : "Unknown error"}`,
        });
      }
    }
  );

  // POST /api/v1/cloud/callback — Called by cloud after user confirms claim
  fastify.post(
    "/callback",
    {
      schema: {
        description: "Callback from cloud server after claim confirmation",
        tags: ["Cloud"],
        querystring: {
          type: "object",
          properties: {
            instanceId: { type: "string" },
            relaySecret: { type: "string" },
            wsEndpoint: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const { instanceId, relaySecret, wsEndpoint } = request.query as {
        instanceId?: string;
        relaySecret?: string;
        wsEndpoint?: string;
      };

      if (!instanceId || !relaySecret || !wsEndpoint) {
        return reply.status(400).send({
          success: false,
          error: "Missing required parameters",
        });
      }

      // Store cloud settings
      const settings = [
        { category: "cloud", key: "enabled", value: "true", isSecret: false },
        { category: "cloud", key: "instance_id", value: instanceId, isSecret: false },
        { category: "cloud", key: "relay_secret", value: relaySecret, isSecret: true },
        { category: "cloud", key: "ws_endpoint", value: wsEndpoint, isSecret: false },
      ];

      for (const setting of settings) {
        const [existing] = await fastify.db
          .select()
          .from(systemSettings)
          .where(
            and(
              eq(systemSettings.category, setting.category),
              eq(systemSettings.key, setting.key)
            )
          )
          .limit(1);

        if (existing) {
          await fastify.db
            .update(systemSettings)
            .set({ value: setting.value, isSecret: setting.isSecret })
            .where(eq(systemSettings.id, existing.id));
        } else {
          await fastify.db.insert(systemSettings).values(setting);
        }
      }

      // Read external URL for relay auth
      const [externalUrlSetting] = await fastify.db
        .select()
        .from(systemSettings)
        .where(
          and(
            eq(systemSettings.category, "server"),
            eq(systemSettings.key, "external_url")
          )
        )
        .limit(1);
      const cbExternalUrl = externalUrlSetting?.value || undefined;

      // Configure and connect the relay
      fastify.cloudRelay.configure({
        instanceId,
        relaySecret,
        wsEndpoint,
        externalUrl: cbExternalUrl,
      });
      fastify.cloudRelay.connect();

      // Register command handler for cloud-originated commands
      fastify.cloudRelay.onCommand((kioskId, commandType, data) => {
        const commands = kioskCommands.get(kioskId) || [];
        commands.push({
          type: commandType as any,
          payload: data,
          timestamp: Date.now(),
        });
        kioskCommands.set(kioskId, commands);
      });

      return { success: true };
    }
  );

  // POST /api/v1/cloud/disconnect — Disconnect from cloud
  fastify.post(
    "/disconnect",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Disconnect from cloud relay",
        tags: ["Cloud"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("User not found");

      // Disconnect relay
      fastify.cloudRelay.disconnect();

      // Clear cloud settings
      await fastify.db
        .delete(systemSettings)
        .where(eq(systemSettings.category, "cloud"));

      return { success: true };
    }
  );

  // POST /api/v1/cloud/sync — Manually trigger kiosk sync
  fastify.post(
    "/sync",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Manually trigger kiosk sync to cloud",
        tags: ["Cloud"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) throw fastify.httpErrors.unauthorized("User not found");

      if (!fastify.cloudRelay.isConnected) {
        throw fastify.httpErrors.serviceUnavailable(
          "Cloud relay is not connected"
        );
      }

      await fastify.cloudRelay.syncKiosks();

      return { success: true };
    }
  );
};
