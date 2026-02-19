import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { userPlans, type PlanLimits, kiosks, calendars, cameras } from "@openframe/database/schema";

const DEFAULT_FREE_LIMITS: PlanLimits = {
  maxKiosks: 2,
  maxCalendars: 5,
  maxCameras: 2,
  features: {
    iptv: false,
    spotify: false,
    ai: false,
    homeAssistant: true,
    automations: false,
    companion: true,
  },
};

declare module "fastify" {
  interface FastifyInstance {
    checkPlanLimit: (
      feature: string
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    getUserPlanLimits: (userId: string) => Promise<PlanLimits>;
  }
}

async function getUserPlanLimits(
  db: any,
  userId: string
): Promise<PlanLimits> {
  const [plan] = await db
    .select()
    .from(userPlans)
    .where(eq(userPlans.userId, userId))
    .limit(1);

  if (!plan) return DEFAULT_FREE_LIMITS;

  // Check if plan has expired
  if (plan.expiresAt && new Date(plan.expiresAt) < new Date()) {
    return DEFAULT_FREE_LIMITS;
  }

  return plan.limits;
}

async function countUserResources(
  db: any,
  userId: string,
  resource: "kiosks" | "calendars" | "cameras"
): Promise<number> {
  const table = { kiosks, calendars, cameras }[resource];
  const userIdCol = table.userId;
  const rows = await db
    .select()
    .from(table)
    .where(eq(userIdCol, userId));
  return rows.length;
}

export const planLimitsPlugin: FastifyPluginAsync = fp(
  async (fastify) => {
    // Only active in hosted mode
    if (!fastify.hostedMode) {
      // Decorate with no-ops for self-hosted
      fastify.decorate(
        "checkPlanLimit",
        () => async () => {}
      );
      fastify.decorate(
        "getUserPlanLimits",
        async () => DEFAULT_FREE_LIMITS
      );
      return;
    }

    fastify.decorate("getUserPlanLimits", async (userId: string) => {
      return getUserPlanLimits(fastify.db, userId);
    });

    fastify.decorate("checkPlanLimit", (feature: string) => {
      return async (request: FastifyRequest, reply: FastifyReply) => {
        const userId = (request.user as any)?.userId;
        if (!userId) return; // Auth will handle this

        const limits = await getUserPlanLimits(fastify.db, userId);

        // Check resource count limits
        if (feature === "kiosks") {
          const count = await countUserResources(fastify.db, userId, "kiosks");
          if (count >= limits.maxKiosks) {
            return reply.status(403).send({
              success: false,
              error: "plan_limit",
              feature: "kiosks",
              current: count,
              limit: limits.maxKiosks,
              message: `You've reached your plan limit of ${limits.maxKiosks} kiosks`,
              upgrade_url: "https://openframe.us/billing",
            });
          }
        } else if (feature === "calendars") {
          const count = await countUserResources(
            fastify.db,
            userId,
            "calendars"
          );
          if (count >= limits.maxCalendars) {
            return reply.status(403).send({
              success: false,
              error: "plan_limit",
              feature: "calendars",
              current: count,
              limit: limits.maxCalendars,
              message: `You've reached your plan limit of ${limits.maxCalendars} calendars`,
              upgrade_url: "https://openframe.us/billing",
            });
          }
        } else if (feature === "cameras") {
          const count = await countUserResources(
            fastify.db,
            userId,
            "cameras"
          );
          if (count >= limits.maxCameras) {
            return reply.status(403).send({
              success: false,
              error: "plan_limit",
              feature: "cameras",
              current: count,
              limit: limits.maxCameras,
              message: `You've reached your plan limit of ${limits.maxCameras} cameras`,
              upgrade_url: "https://openframe.us/billing",
            });
          }
        } else {
          // Feature flag check
          const featureKey = feature as keyof PlanLimits["features"];
          if (
            limits.features[featureKey] !== undefined &&
            !limits.features[featureKey]
          ) {
            return reply.status(403).send({
              success: false,
              error: "plan_limit",
              feature,
              message: `The ${feature} feature is not available on your current plan`,
              upgrade_url: "https://openframe.us/billing",
            });
          }
        }
      };
    });
  },
  {
    name: "plan-limits",
    dependencies: ["database"],
  }
);
