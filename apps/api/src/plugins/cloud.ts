import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { CloudRelay } from "../services/cloud-relay.js";
import { getCategorySettings } from "../routes/settings/index.js";

declare module "fastify" {
  interface FastifyInstance {
    cloudRelay: CloudRelay;
  }
}

export const cloudPlugin: FastifyPluginAsync = fp(
  async (fastify) => {
    const relay = new CloudRelay(fastify.db, fastify.log as any);

    fastify.decorate("cloudRelay", relay);

    // Try to connect on startup if cloud settings exist
    try {
      const cloudSettings = await getCategorySettings(fastify.db, "cloud");
      const instanceId = cloudSettings.instance_id;
      const relaySecret = cloudSettings.relay_secret;
      const wsEndpoint = cloudSettings.ws_endpoint;
      const enabled = cloudSettings.enabled;

      if (enabled === "true" && instanceId && relaySecret && wsEndpoint) {
        relay.configure({
          instanceId,
          relaySecret,
          wsEndpoint,
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
