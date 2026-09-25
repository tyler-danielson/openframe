import type { FastifyPluginAsync } from "fastify";
import { eq, and, isNull } from "drizzle-orm";
import { systemSettings } from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";
import { getCategorySettings } from "../settings/index.js";
import { encrypt } from "../../lib/encryption.js";
import { kioskCommands } from "../kiosks/index.js";

export const cloudRoutes: FastifyPluginAsync = async (fastify) => {
  // Connecting to OpenFrame Cloud is for self-hosted servers. The hosted
  // service is the cloud's own backend: it never connects to the relay.
  if (fastify.hostedMode) {
    fastify.get("/status", { onRequest: [fastify.authenticateAny] }, async () => ({
      success: true,
      data: { enabled: false, connected: false, state: "disabled", instanceId: null, wsEndpoint: null },
    }));
    return;
  }

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
  // Connecting changes the whole server, and hands the cloud a way in: admins only
  fastify.post(
    "/connect",
    {
      onRequest: [fastify.authenticateAny, fastify.requireAdmin],
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
      try {
        const parsed = new URL(cloudUrl);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error();
      } catch {
        return reply.badRequest("Cloud server URL must be an http(s) address");
      }

      const { external_url: externalUrlSetting } = await getCategorySettings(fastify.db, "server");
      const externalUrl = externalUrlSetting || `http://localhost:3000`;

      // Request a claim code from the cloud. This server then polls for the
      // result: the cloud never calls back in with the relay credentials.
      try {
        const res = await fetch(`${cloudUrl}/api/relay/claim`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ externalUrl }),
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
            const pollRes = await fetch(`${cloudUrl}/api/relay/claim?code=${encodeURIComponent(claimCode)}`);
            if (!pollRes.ok) { clearInterval(pollInterval); return; }
            const pollData = await pollRes.json() as { status: string; instanceId?: string; relaySecret?: string; wsEndpoint?: string };
            if (pollData.status === "claimed" && pollData.instanceId && pollData.relaySecret && pollData.wsEndpoint) {
              clearInterval(pollInterval);
              // Store cloud settings
              const settings = [
                { category: "cloud", key: "enabled", value: "true", isSecret: false },
                { category: "cloud", key: "url", value: cloudUrl, isSecret: false },
                { category: "cloud", key: "instance_id", value: pollData.instanceId, isSecret: false },
                { category: "cloud", key: "relay_secret", value: encrypt(pollData.relaySecret), isSecret: true },
                { category: "cloud", key: "ws_endpoint", value: pollData.wsEndpoint, isSecret: false },
              ];
              for (const setting of settings) {
                const [existing] = await fastify.db
                  .select()
                  .from(systemSettings)
                  .where(and(eq(systemSettings.category, setting.category), eq(systemSettings.key, setting.key), isNull(systemSettings.userId)))
                  .limit(1);
                if (existing) {
                  await fastify.db.update(systemSettings).set({ value: setting.value, isSecret: setting.isSecret }).where(eq(systemSettings.id, existing.id));
                } else {
                  await fastify.db.insert(systemSettings).values(setting);
                }
              }
              // Configure and connect the relay; relayed requests use the new secret
              fastify.relaySecret = pollData.relaySecret;
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
            claimUrl: `${cloudUrl}/claim?code=${encodeURIComponent(data.code)}`,
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

  // POST /api/v1/cloud/disconnect — Disconnect from cloud
  fastify.post(
    "/disconnect",
    {
      onRequest: [fastify.authenticateAny, fastify.requireAdmin],
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
      fastify.relaySecret = null;

      // Clear the server's cloud settings
      await fastify.db
        .delete(systemSettings)
        .where(and(eq(systemSettings.category, "cloud"), isNull(systemSettings.userId)));

      return { success: true };
    }
  );

  // POST /api/v1/cloud/sync — Manually trigger kiosk sync
  fastify.post(
    "/sync",
    {
      onRequest: [fastify.authenticateAny, fastify.requireAdmin],
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
