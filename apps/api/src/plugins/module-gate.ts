import type { FastifyRequest, FastifyReply } from "fastify";
import { isModuleEnabled } from "../routes/modules/index.js";
import { MODULE_REGISTRY, type ModuleId } from "@openframe/shared";

/**
 * Mapping of module IDs to the API route prefixes they gate.
 */
const MODULE_ROUTE_PREFIXES: Record<string, string[]> = {
  homeassistant: ["/api/v1/homeassistant"],
  spotify: ["/api/v1/spotify"],
  iptv: ["/api/v1/iptv"],
  cameras: ["/api/v1/cameras"],
  weather: ["/api/v1/weather"],
  sports: ["/api/v1/sports"],
  news: ["/api/v1/news"],
  photos: ["/api/v1/photos"],
  recipes: ["/api/v1/recipes", "/api/v1/kitchen"],
  remarkable: ["/api/v1/remarkable"],
  youtube: ["/api/v1/youtube"],
  plex: ["/api/v1/plex"],
  audiobookshelf: ["/api/v1/audiobookshelf"],
  "ai-chat": ["/api/v1/chat"],
  automations: ["/api/v1/automations"],
  map: ["/api/v1/maps"],
  telegram: ["/api/v1/telegram"],
  capacities: ["/api/v1/capacities"],
  gmail: ["/api/v1/gmail"],
  "ai-briefing": ["/api/v1/briefing"],
  cast: ["/api/v1/cast"],
  companion: ["/api/v1/companion"],
  routines: ["/api/v1/routines"],
  matter: ["/api/v1/matter"],
};

// Build a reverse lookup: prefix -> moduleId (sorted longest-first for specificity)
const PREFIX_TO_MODULE: { prefix: string; moduleId: string }[] = [];
for (const [moduleId, prefixes] of Object.entries(MODULE_ROUTE_PREFIXES)) {
  for (const prefix of prefixes) {
    PREFIX_TO_MODULE.push({ prefix, moduleId });
  }
}
PREFIX_TO_MODULE.sort((a, b) => b.prefix.length - a.prefix.length);

/**
 * Find the module that gates a given URL path, if any.
 */
function getModuleForPath(url: string): string | null {
  for (const { prefix, moduleId } of PREFIX_TO_MODULE) {
    if (url.startsWith(prefix)) {
      return moduleId;
    }
  }
  return null;
}

/**
 * Creates a Fastify onRequest hook that checks if the relevant module is enabled.
 * Should be added as a global hook after auth is set up.
 */
export function moduleGateHook() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Strip query string for prefix matching
    const urlPath = request.url.split("?")[0] ?? request.url;

    const moduleId = getModuleForPath(urlPath);
    if (!moduleId) return; // Not a module-gated route

    // Skip gate for unauthenticated requests (auth middleware handles those)
    if (!request.user) return;

    const userId = request.server.hostedMode ? request.user.userId : null;
    const enabled = await isModuleEnabled(request.server.db, moduleId, userId);

    if (!enabled) {
      const moduleName = MODULE_REGISTRY[moduleId as ModuleId]?.name ?? moduleId;
      return reply.status(403).send({
        success: false,
        error: "module_disabled",
        moduleId,
        message: `The "${moduleName}" module is not enabled. Enable it in Settings > Modules.`,
      });
    }
  };
}
