import type { FastifyPluginAsync } from "fastify";
import { sql } from "drizzle-orm";
import os from "os";

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

  // Server info endpoint - returns server IP addresses for kiosk URL generation
  fastify.get(
    "/health/info",
    {
      schema: {
        description: "Get server information including IP addresses",
        tags: ["Health"],
        response: {
          200: {
            type: "object",
            properties: {
              hostname: { type: "string" },
              port: { type: "number" },
              addresses: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
        },
      },
    },
    async () => {
      const interfaces = os.networkInterfaces();
      const addresses: string[] = [];

      for (const [, nets] of Object.entries(interfaces)) {
        if (!nets) continue;
        for (const net of nets) {
          // Skip internal (127.0.0.1) and non-IPv4 addresses
          if (net.family === "IPv4" && !net.internal) {
            addresses.push(net.address);
          }
        }
      }

      return {
        hostname: os.hostname(),
        port: fastify.config.port,
        addresses,
      };
    }
  );
};
