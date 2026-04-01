import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { eq, and, sql, count } from "drizzle-orm";
import {
  userPlans,
  type PlanLimits,
  kiosks,
  companionAccess,
  aiUsage,
  photos,
  photoAlbums,
} from "@openframe/database/schema";

const ALL_FEATURES_ENABLED: PlanLimits["features"] = {
  iptv: true,
  spotify: true,
  ai: true,
  homeAssistant: true,
  automations: true,
  companion: true,
  cameras: true,
  sports: true,
  news: true,
  recipes: true,
};

// All features are available on every tier.
// Differentiation is resource-based (kiosks, photos, AI queries).
const DEFAULT_FREE_LIMITS: PlanLimits = {
  maxKiosks: 1,
  maxPhotos: 100,
  maxPhotoResolution: 1080,
  aiQueriesPerMonth: 25,
  aiSoftCap: true,
  features: ALL_FEATURES_ENABLED,
};

declare module "fastify" {
  interface FastifyInstance {
    checkPlanLimit: (
      feature: string
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    getUserPlanLimits: (userId: string) => Promise<PlanLimits>;
  }
}

/**
 * If the given userId belongs to a companion user, return their owner's userId.
 * Otherwise return the userId unchanged (they are the owner).
 */
async function resolveToOwner(db: any, userId: string): Promise<string> {
  const [companionLink] = await db
    .select({ ownerId: companionAccess.ownerId })
    .from(companionAccess)
    .where(
      and(
        eq(companionAccess.userId, userId),
        eq(companionAccess.isActive, true)
      )
    )
    .limit(1);

  return companionLink?.ownerId ?? userId;
}

/**
 * Normalize stored plan limits to the current interface.
 * Handles legacy fields (hostedAiQueries, maxCalendars, maxCameras) and
 * ensures all new feature flags are present.
 */
function normalizeLimits(stored: any): PlanLimits {
  const features = {
    ...ALL_FEATURES_ENABLED,
    ...(stored.features || {}),
  };

  return {
    maxKiosks: stored.maxKiosks ?? 1,
    maxPhotos: stored.maxPhotos ?? 100,
    maxPhotoResolution: stored.maxPhotoResolution ?? 1080,
    aiQueriesPerMonth: stored.aiQueriesPerMonth ?? stored.hostedAiQueries ?? 25,
    aiSoftCap: stored.aiSoftCap ?? true,
    features,
  };
}

async function getUserPlanLimits(
  db: any,
  userId: string
): Promise<PlanLimits> {
  // Step 1: Check if this user has their own plan
  const [directPlan] = await db
    .select()
    .from(userPlans)
    .where(eq(userPlans.userId, userId))
    .limit(1);

  if (directPlan) {
    if (!directPlan.expiresAt || new Date(directPlan.expiresAt) >= new Date()) {
      return normalizeLimits(directPlan.limits);
    }
  }

  // Step 2: No valid direct plan — check if user is a companion
  const ownerId = await resolveToOwner(db, userId);

  if (ownerId !== userId) {
    const [ownerPlan] = await db
      .select()
      .from(userPlans)
      .where(eq(userPlans.userId, ownerId))
      .limit(1);

    if (ownerPlan) {
      if (!ownerPlan.expiresAt || new Date(ownerPlan.expiresAt) >= new Date()) {
        return normalizeLimits(ownerPlan.limits);
      }
    }
  }

  // Step 3: No plan found anywhere — fall back to free limits
  return DEFAULT_FREE_LIMITS;
}

/**
 * Count kiosks against the owner (not the companion).
 */
async function countUserKiosks(db: any, userId: string): Promise<number> {
  const effectiveUserId = await resolveToOwner(db, userId);
  const [row] = await db
    .select({ total: count() })
    .from(kiosks)
    .where(eq(kiosks.userId, effectiveUserId));
  return Number(row?.total ?? 0);
}

/**
 * Count photos across all albums for the owner.
 */
async function countUserPhotos(db: any, userId: string): Promise<number> {
  const effectiveUserId = await resolveToOwner(db, userId);
  const [row] = await db
    .select({ total: count() })
    .from(photos)
    .innerJoin(photoAlbums, eq(photos.albumId, photoAlbums.id))
    .where(eq(photoAlbums.userId, effectiveUserId));
  return Number(row?.total ?? 0);
}

/**
 * Check AI usage for the current month. Resolves to owner for companions.
 */
async function checkAiUsage(
  db: any,
  userId: string,
  limits: PlanLimits
): Promise<{ allowed: boolean; current: number; limit: number; isOverage: boolean }> {
  const effectiveUserId = await resolveToOwner(db, userId);
  const month = new Date().toISOString().slice(0, 7); // "2026-03"

  const [usage] = await db
    .select()
    .from(aiUsage)
    .where(
      and(
        eq(aiUsage.userId, effectiveUserId),
        eq(aiUsage.month, month)
      )
    )
    .limit(1);

  const current = usage?.queryCount ?? 0;
  const limit = limits.aiQueriesPerMonth;

  if (limit === -1) {
    return { allowed: true, current, limit, isOverage: false };
  }

  if (current < limit) {
    return { allowed: true, current, limit, isOverage: false };
  }

  // Soft cap: allow ~10% overage
  if (limits.aiSoftCap) {
    const softLimit = Math.ceil(limit * 1.1);
    if (current < softLimit) {
      return { allowed: true, current, limit, isOverage: true };
    }
  }

  return { allowed: false, current, limit, isOverage: false };
}

/**
 * Increment AI usage counter for the current month (counted against owner).
 */
async function incrementAiUsage(db: any, userId: string): Promise<void> {
  const effectiveUserId = await resolveToOwner(db, userId);
  const month = new Date().toISOString().slice(0, 7);

  await db
    .insert(aiUsage)
    .values({ userId: effectiveUserId, month, queryCount: 1 })
    .onConflictDoUpdate({
      target: [aiUsage.userId, aiUsage.month],
      set: {
        queryCount: sql`${aiUsage.queryCount} + 1`,
        updatedAt: new Date(),
      },
    });
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

        switch (feature) {
          case "kiosks": {
            if (limits.maxKiosks === -1) return; // unlimited
            const kioskCount = await countUserKiosks(fastify.db, userId);
            if (kioskCount >= limits.maxKiosks) {
              return reply.status(403).send({
                success: false,
                error: "plan_limit",
                feature: "kiosks",
                current: kioskCount,
                limit: limits.maxKiosks,
                message: `You've reached your plan limit of ${limits.maxKiosks} kiosk${limits.maxKiosks === 1 ? "" : "s"}. Upgrade for more.`,
                upgrade_url: "https://openframe.us/pricing",
              });
            }
            break;
          }

          case "photos": {
            if (limits.maxPhotos === -1) return; // unlimited
            const photoCount = await countUserPhotos(fastify.db, userId);
            if (photoCount >= limits.maxPhotos) {
              return reply.status(403).send({
                success: false,
                error: "plan_limit",
                feature: "photos",
                current: photoCount,
                limit: limits.maxPhotos,
                message: `You've reached your plan limit of ${limits.maxPhotos} photos. Upgrade for more storage.`,
                upgrade_url: "https://openframe.us/pricing",
              });
            }
            break;
          }

          case "ai": {
            const aiCheck = await checkAiUsage(fastify.db, userId, limits);
            if (!aiCheck.allowed) {
              return reply.status(429).send({
                success: false,
                error: "ai_quota_exceeded",
                current: aiCheck.current,
                limit: aiCheck.limit,
                message: "You've used your AI queries for this month. Upgrade or add your own API key.",
                upgrade_url: "https://openframe.us/pricing",
              });
            }
            // Store overage flag on request for downstream use
            (request as any).aiOverage = aiCheck.isOverage;
            break;
          }

          default: {
            // Feature flag check (backward compat, should always be true on cloud)
            const featureKey = feature as keyof PlanLimits["features"];
            if (limits.features[featureKey] !== undefined && !limits.features[featureKey]) {
              return reply.status(403).send({
                success: false,
                error: "plan_limit",
                feature,
                message: `The ${feature} feature is not available on your current plan`,
                upgrade_url: "https://openframe.us/pricing",
              });
            }
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

// Export helpers for use in route handlers
export {
  resolveToOwner,
  countUserPhotos,
  checkAiUsage,
  incrementAiUsage,
  DEFAULT_FREE_LIMITS,
  ALL_FEATURES_ENABLED,
};
