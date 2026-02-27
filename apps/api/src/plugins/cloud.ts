import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { eq, and } from "drizzle-orm";
import { systemSettings } from "@openframe/database/schema";
import { CloudRelay } from "../services/cloud-relay.js";
import { getCategorySettings } from "../routes/settings/index.js";

declare module "fastify" {
  interface FastifyInstance {
    cloudRelay: CloudRelay;
    relaySecret: string | null;
    hostedMode: boolean;
    provisioningSecret: string | null;
  }
}

export const cloudPlugin: FastifyPluginAsync = fp(
  async (fastify) => {
    const port = Number(process.env.PORT) || 3001;
    const relay = new CloudRelay(fastify.db, fastify.log as any, port);

    fastify.decorate("cloudRelay", relay);
    fastify.decorate("relaySecret", null as string | null);

    // Try to connect on startup if cloud settings exist
    try {
      const cloudSettings = await getCategorySettings(fastify.db, "cloud");
      const instanceId = cloudSettings.instance_id;
      const relaySecret = cloudSettings.relay_secret;
      const wsEndpoint = cloudSettings.ws_endpoint;
      const enabled = cloudSettings.enabled;

      if (enabled === "true" && instanceId && relaySecret && wsEndpoint) {
        fastify.relaySecret = relaySecret;

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
        const externalUrl = externalUrlSetting?.value || undefined;

        relay.configure({
          instanceId,
          relaySecret,
          wsEndpoint,
          externalUrl,
        });
        relay.connect();
        fastify.log.info("[cloud] Cloud relay initialized and connecting");
      } else {
        fastify.log.info("[cloud] Cloud relay not configured, skipping");
      }
    } catch {
      fastify.log.info("[cloud] Could not load cloud settings, skipping");
    }

    // Cleanup on shutdown
    fastify.addHook("onClose", async () => {
      relay.disconnect();
      fastify.log.info("[cloud] Cloud relay disconnected");
    });
  },
  {
    name: "cloud",
    dependencies: ["database"],
  }
);
