import fp from "fastify-plugin";
import { eq } from "drizzle-orm";
import { users } from "@openframe/database/schema";
import type { FastifyRequest, FastifyReply } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    requireAdmin: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
  }
}

export const requireAdminPlugin = fp(
  async (fastify) => {
    fastify.decorate(
      "requireAdmin",
      async (request: FastifyRequest, reply: FastifyReply) => {
        const userId = (request.user as any)?.userId;
        if (!userId) {
          return reply.status(401).send({
            success: false,
            error: { code: "UNAUTHORIZED", message: "Not authenticated" },
          });
        }

        // Check user role in database
        const [user] = await fastify.db
          .select({ role: users.role })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!user || user.role !== "admin") {
          return reply.status(403).send({
            success: false,
            error: { code: "FORBIDDEN", message: "Admin access required" },
          });
        }
      }
    );
  },
  {
    name: "require-admin",
    dependencies: ["database", "auth"],
  }
);
