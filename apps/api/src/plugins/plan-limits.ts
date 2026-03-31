import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { userPlans, type PlanLimits, kiosks, calendars, cameras } from "@openframe/database/schema";

// All features are available on every tier.
// Differentiation is resource-based (kiosks, photos, AI queries).
const DEFAULT_FREE_LIMITS: PlanLimits = {
  maxKiosks: 1,
  maxCalendars: -1, // Unlimited
  maxCameras: -1, // Unlimited
  maxPhotos: 100,
  maxPhotoResolution: 1080,
  hostedAiQueries: 25,
  features: {
    iptv: true,
    spotify: true,
    ai: true,
    homeAssistant: true,
    automations: true,
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

  // Ensure all features are true regardless of what's stored
  const limits = plan.limits as PlanLimits;
  limits.features = {
    iptv: true,
    spotify: true,
    ai: true,
    homeAssistant: true,
    automations: true,
    companion: true,
  };

  return limits;
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

        // Resource count limits only — no feature gating
        if (feature === "kiosks" && limits.maxKiosks !== -1) {
          const count = await countUserResources(fastify.db, userId, "kiosks");
          if (count >= limits.maxKiosks) {
            return reply.status(403).send({
              success: false,
              error: "plan_limit",
              feature: "kiosks",
              current: count,
              limit: limits.maxKiosks,
              message: `Your plan allows up to ${limits.maxKiosks} kiosk${limits.maxKiosks > 1 ? "s" : ""}. Upgrade for more.`,
              upgrade_url: "https://openframe.us/pricing",
            });
          }
        } else if (feature === "calendars" && limits.maxCalendars !== -1) {
          const count = await countUserResources(fastify.db, userId, "calendars");
          if (count >= limits.maxCalendars) {
            return reply.status(403).send({
              success: false,
              error: "plan_limit",
              feature: "calendars",
              current: count,
              limit: limits.maxCalendars,
              message: `Your plan allows up to ${limits.maxCalendars} calendar account${limits.maxCalendars > 1 ? "s" : ""}. Upgrade for more.`,
              upgrade_url: "https://openframe.us/pricing",
            });
          }
        } else if (feature === "cameras" && limits.maxCameras !== -1) {
          const count = await countUserResources(fastify.db, userId, "cameras");
          if (count >= limits.maxCameras) {
            return reply.status(403).send({
              success: false,
              error: "plan_limit",
              feature: "cameras",
              current: count,
              limit: limits.maxCameras,
              message: `Your plan allows up to ${limits.maxCameras} camera${limits.maxCameras > 1 ? "s" : ""}. Upgrade for more.`,
              upgrade_url: "https://openframe.us/pricing",
            });
          }
        }
        // All features are available on every plan — no feature boolean checks
      };
    });
  },
  {
    name: "plan-limits",
    dependencies: ["database"],
  }
);
