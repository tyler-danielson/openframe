import type { FastifyPluginAsync } from "fastify";
import { sql } from "drizzle-orm";

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/health",
    {
      schema: {
        description: "Health check endpoint",
        tags: ["Health"],
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              timestamp: { type: "string" },
              version: { type: "string" },
            },
          },
        },
      },
    },
    async () => {
      return {
        status: "ok",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      };
    }
  );

  fastify.get(
    "/health/ready",
    {
      schema: {
        description: "Readiness check - verifies all dependencies are available",
        tags: ["Health"],
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              checks: {
                type: "object",
                properties: {
                  database: { type: "string" },
                },
              },
            },
          },
          503: {
            type: "object",
            properties: {
              status: { type: "string" },
              checks: {
                type: "object",
                properties: {
                  database: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const checks: Record<string, string> = {};

      // Check database
      try {
        await fastify.db.execute(sql`SELECT 1`);
        checks.database = "ok";
      } catch {
        checks.database = "error";
      }

      const allOk = Object.values(checks).every((v) => v === "ok");

      if (!allOk) {
        return reply.status(503).send({
          status: "error",
          checks,
        });
      }

      return {
        status: "ok",
        checks,
      };
    }
  );
};
