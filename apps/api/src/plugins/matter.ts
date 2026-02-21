import fp from "fastify-plugin";
import { MatterControllerService } from "../services/matter/controller.js";

declare module "fastify" {
  interface FastifyInstance {
    matterController: MatterControllerService;
  }
}

export const matterPlugin = fp(
  async (fastify) => {
    const controller = new MatterControllerService();
    fastify.decorate("matterController", controller);

    try {
      await controller.initialize();
      fastify.log.info("Matter controller initialized");
    } catch (error) {
      fastify.log.warn(
        { err: error },
        "Matter controller failed to initialize (IPv6/mDNS may be unavailable) — server will continue without Matter support"
      );
    }

    fastify.addHook("onClose", async () => {
      try {
        await controller.shutdown();
        fastify.log.info("Matter controller shut down");
      } catch (error) {
        fastify.log.error({ err: error }, "Error shutting down Matter controller");
      }
    });
  },
  {
    name: "matter",
    dependencies: ["database"],
  }
);
