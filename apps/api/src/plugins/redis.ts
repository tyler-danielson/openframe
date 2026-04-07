import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { Redis } from "ioredis";

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis | null;
  }
}

const redisPlugin: FastifyPluginAsync<{ url: string }> = async (
  fastify,
  opts
) => {
  let redis: Redis | null = null;

  try {
    redis = new Redis(opts.url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > 5) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    await redis.connect();
    fastify.log.info("Redis connected");
  } catch (err) {
    fastify.log.warn({ err }, "Redis connection failed — weather cache will use in-memory fallback");
    redis = null;
  }

  fastify.decorate("redis", redis);

  fastify.addHook("onClose", async () => {
    if (redis) {
      await redis.quit();
    }
  });
};

export default fp(redisPlugin, { name: "redis" });
