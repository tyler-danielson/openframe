import type { FastifyPluginAsync } from "fastify";
import { eq, and, isNull } from "drizzle-orm";
import { systemSettings } from "@openframe/database/schema";
import {
  MODULE_REGISTRY,
  MODULE_IDS,
  MODULE_CATEGORIES,
  getModuleDependents,
  areDependenciesMet,
  type ModuleId,
} from "@openframe/shared";

export const moduleRoutes: FastifyPluginAsync = async (fastify) => {
  const { authenticate, authenticateAny } = fastify;

  // GET /api/v1/modules — list all modules with enabled state
  fastify.get(
    "/",
    {
      preHandler: [authenticateAny],
      schema: {
        description: "Get all modules with their enabled/available state",
        tags: ["Modules"],
      },
    },
    async (request) => {
      const userId = request.user.userId;
      const isHosted = fastify.hostedMode;

      // Read module settings from DB
      const moduleSettings = isHosted
        ? await fastify.db
            .select()
            .from(systemSettings)
            .where(
              and(
                eq(systemSettings.category, "modules"),
                eq(systemSettings.userId, userId)
              )
            )
        : await fastify.db
            .select()
            .from(systemSettings)
            .where(
              and(
                eq(systemSettings.category, "modules"),
                isNull(systemSettings.userId)
              )
            );

      const enabledMap = new Map<string, boolean>();
      for (const setting of moduleSettings) {
        enabledMap.set(setting.key, setting.value === "true");
      }

      // Get plan limits for cloud mode
      let planFeatures: Record<string, boolean> | null = null;
      if (isHosted) {
        const limits = await fastify.getUserPlanLimits(userId);
        planFeatures = limits.features as Record<string, boolean>;
      }

      const modules = MODULE_IDS.map((id) => {
        const def = MODULE_REGISTRY[id];
        const enabled = enabledMap.get(id) ?? false;
        // In self-hosted, all modules are available. In cloud, check plan.
        const available = !isHosted || isPlanFeatureAvailable(id, planFeatures);
        return {
          id: def.id,
          name: def.name,
          description: def.description,
          icon: def.icon,
          category: def.category,
          dependsOn: def.dependsOn,
          enabled,
          available,
        };
      });

      return {
        success: true,
        data: { modules, categories: MODULE_CATEGORIES },
      };
    }
  );

  // POST /api/v1/modules/:moduleId — toggle a module on/off
  fastify.post<{
    Params: { moduleId: string };
    Body: { enabled: boolean };
  }>(
    "/:moduleId",
    {
      preHandler: [authenticate],
      schema: {
        description: "Enable or disable a module",
        tags: ["Modules"],
        params: {
          type: "object",
          properties: { moduleId: { type: "string" } },
          required: ["moduleId"],
        },
        body: {
          type: "object",
          properties: { enabled: { type: "boolean" } },
          required: ["enabled"],
        },
      },
    },
    async (request, reply) => {
      const { moduleId } = request.params;
      const { enabled } = request.body;
      const userId = request.user.userId;
      const isHosted = fastify.hostedMode;

      // Validate moduleId
      if (!MODULE_REGISTRY[moduleId as ModuleId]) {
        return reply.status(400).send({
          success: false,
          error: "invalid_module",
          message: `Unknown module: "${moduleId}"`,
        });
      }

      const modId = moduleId as ModuleId;

      // Check plan access in hosted mode
      if (isHosted && enabled) {
        const limits = await fastify.getUserPlanLimits(userId);
        const planFeatures = limits.features as Record<string, boolean>;
        if (!isPlanFeatureAvailable(modId, planFeatures)) {
          return reply.status(403).send({
            success: false,
            error: "plan_limit",
            message: `The "${MODULE_REGISTRY[modId].name}" module is not available on your current plan`,
            upgrade_url: "https://openframe.us/billing",
          });
        }
      }

      // Read current enabled modules for dependency checks
      const moduleSettings = isHosted
        ? await fastify.db
            .select()
            .from(systemSettings)
            .where(
              and(
                eq(systemSettings.category, "modules"),
                eq(systemSettings.userId, userId)
              )
            )
        : await fastify.db
            .select()
            .from(systemSettings)
            .where(
              and(
                eq(systemSettings.category, "modules"),
                isNull(systemSettings.userId)
              )
            );

      const enabledSet = new Set<string>();
      for (const setting of moduleSettings) {
        if (setting.value === "true") enabledSet.add(setting.key);
      }

      // Validate dependencies when enabling
      if (enabled) {
        if (!areDependenciesMet(modId, enabledSet)) {
          const deps = MODULE_REGISTRY[modId].dependsOn
            .filter((d) => !enabledSet.has(d))
            .map((d) => MODULE_REGISTRY[d].name);
          return reply.status(400).send({
            success: false,
            error: "dependency_missing",
            message: `Enable ${deps.join(", ")} first`,
            missingDependencies: MODULE_REGISTRY[modId].dependsOn.filter(
              (d) => !enabledSet.has(d)
            ),
          });
        }
      }

      // Collect modules to update (module itself + cascade disables)
      const modulesToUpdate: { id: ModuleId; enabled: boolean }[] = [
        { id: modId, enabled },
      ];

      // On disable, cascade to dependents
      if (!enabled) {
        const dependents = getAllDependents(modId);
        for (const depId of dependents) {
          if (enabledSet.has(depId)) {
            modulesToUpdate.push({ id: depId, enabled: false });
          }
        }
      }

      // Upsert each module setting
      const userIdValue = isHosted ? userId : null;
      for (const mod of modulesToUpdate) {
        await upsertModuleSetting(
          fastify.db,
          userIdValue,
          mod.id,
          mod.enabled
        );
      }

      // Clear the module cache
      moduleCache.delete(isHosted ? userId : "__instance__");

      return {
        success: true,
        data: {
          moduleId: modId,
          enabled,
          cascadeDisabled: modulesToUpdate
            .filter((m) => m.id !== modId && !m.enabled)
            .map((m) => m.id),
        },
      };
    }
  );
};

/** Recursively collect all modules that depend on the given module */
function getAllDependents(moduleId: ModuleId): ModuleId[] {
  const result: ModuleId[] = [];
  const direct = getModuleDependents(moduleId);
  for (const dep of direct) {
    result.push(dep);
    result.push(...getAllDependents(dep));
  }
  return [...new Set(result)];
}

/** Upsert a module enabled setting */
async function upsertModuleSetting(
  db: any,
  userId: string | null,
  moduleId: string,
  enabled: boolean
) {
  const condition = userId
    ? and(
        eq(systemSettings.category, "modules"),
        eq(systemSettings.key, moduleId),
        eq(systemSettings.userId, userId)
      )
    : and(
        eq(systemSettings.category, "modules"),
        eq(systemSettings.key, moduleId),
        isNull(systemSettings.userId)
      );

  const [existing] = await db
    .select()
    .from(systemSettings)
    .where(condition)
    .limit(1);

  if (existing) {
    await db
      .update(systemSettings)
      .set({ value: String(enabled), updatedAt: new Date() })
      .where(eq(systemSettings.id, existing.id));
  } else {
    await db.insert(systemSettings).values({
      userId,
      category: "modules",
      key: moduleId,
      value: String(enabled),
      isSecret: false,
    });
  }
}

/**
 * Check if a module is available on the user's plan.
 * Maps module IDs to plan feature keys where they exist.
 */
function isPlanFeatureAvailable(
  moduleId: ModuleId,
  planFeatures: Record<string, boolean> | null
): boolean {
  if (!planFeatures) return true;

  // Map module IDs to plan feature keys
  const featureMap: Partial<Record<ModuleId, string>> = {
    iptv: "iptv",
    spotify: "spotify",
    "ai-chat": "ai",
    "ai-briefing": "ai",
    gmail: "ai",
    homeassistant: "homeAssistant",
    automations: "automations",
    map: "homeAssistant",
    cast: "homeAssistant",
    companion: "companion",
  };

  const planKey = featureMap[moduleId];
  if (!planKey) return true; // Module not gated by plan
  return planFeatures[planKey] !== false;
}

// ---- In-memory cache for module enabled state ----

interface CacheEntry {
  enabledSet: Set<string>;
  expiresAt: number;
}

const CACHE_TTL_MS = 30_000; // 30 seconds
export const moduleCache = new Map<string, CacheEntry>();

/**
 * Check if a module is enabled. Cached for 30s.
 * For self-hosted: cacheKey = "__instance__", userId = null
 * For cloud: cacheKey = userId
 */
export async function isModuleEnabled(
  db: any,
  moduleId: string,
  userId: string | null
): Promise<boolean> {
  const cacheKey = userId ?? "__instance__";
  const now = Date.now();
  const cached = moduleCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return cached.enabledSet.has(moduleId);
  }

  // Fetch from DB
  const condition = userId
    ? and(
        eq(systemSettings.category, "modules"),
        eq(systemSettings.userId, userId)
      )
    : and(
        eq(systemSettings.category, "modules"),
        isNull(systemSettings.userId)
      );

  const rows = await db
    .select({ key: systemSettings.key, value: systemSettings.value })
    .from(systemSettings)
    .where(condition);

  const enabledSet = new Set<string>();
  for (const row of rows) {
    if (row.value === "true") enabledSet.add(row.key);
  }

  moduleCache.set(cacheKey, { enabledSet, expiresAt: now + CACHE_TTL_MS });
  return enabledSet.has(moduleId);
}
