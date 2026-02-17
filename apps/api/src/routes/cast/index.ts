import type { FastifyPluginAsync } from "fastify";
import { eq, and } from "drizzle-orm";
import {
  kiosks,
  iptvServers,
  iptvChannels,
  homeAssistantConfig,
} from "@openframe/database/schema";
import { getCurrentUser } from "../../plugins/auth.js";
import { XtremeCodesClient } from "../../services/xtreme-codes.js";
import { mediamtx } from "../../services/mediamtx.js";
import { kioskCommands } from "../kiosks/index.js";

interface CastTarget {
  id: string;
  name: string;
  type: "kiosk" | "media_player";
  capabilities: ("iptv" | "cameras" | "multiview")[];
  state?: string;
}

interface CastRequest {
  targetId: string;
  targetType: "kiosk" | "media_player";
  contentType: "iptv" | "camera" | "multiview";
  channelId?: string;
  cameraId?: string;
  cameraEntityId?: string;
  multiviewItems?: unknown[];
}

async function fetchFromHA(
  url: string,
  token: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const baseUrl = url.replace(/\/+$/, "");
  return fetch(`${baseUrl}/api${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

function queueKioskCommand(
  kioskId: string,
  type: string,
  payload?: Record<string, unknown>
) {
  const existing = kioskCommands.get(kioskId) ?? [];
  existing.push({ type: type as any, payload, timestamp: Date.now() });
  kioskCommands.set(kioskId, existing);
}

export const castRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /cast-targets — list cast-capable devices
  fastify.get(
    "/cast-targets",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "List available cast targets (kiosks and media players)",
        tags: ["Cast"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    },
    async (request) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const targets: CastTarget[] = [];

      // 1. Get active kiosks
      const userKiosks = await fastify.db
        .select()
        .from(kiosks)
        .where(and(eq(kiosks.userId, user.id), eq(kiosks.isActive, true)));

      for (const kiosk of userKiosks) {
        const features = (kiosk.enabledFeatures as Record<string, boolean>) || {};
        const capabilities: ("iptv" | "cameras" | "multiview")[] = [];
        if (features.iptv) capabilities.push("iptv");
        if (features.cameras) capabilities.push("cameras");
        // Multiview is available if kiosk has any streaming features
        if (features.iptv || features.cameras) capabilities.push("multiview");

        targets.push({
          id: kiosk.id,
          name: kiosk.name,
          type: "kiosk",
          capabilities,
        });
      }

      // 2. Get HA media_player entities
      try {
        const [config] = await fastify.db
          .select()
          .from(homeAssistantConfig)
          .where(eq(homeAssistantConfig.userId, user.id))
          .limit(1);

        if (config) {
          const response = await fetchFromHA(
            config.url,
            config.accessToken,
            "/states"
          );

          if (response.ok) {
            const states = (await response.json()) as Array<{
              entity_id: string;
              state: string;
              attributes: Record<string, unknown>;
            }>;

            for (const entity of states) {
              if (entity.entity_id.startsWith("media_player.")) {
                targets.push({
                  id: entity.entity_id,
                  name:
                    (entity.attributes.friendly_name as string) ||
                    entity.entity_id,
                  type: "media_player",
                  capabilities: ["iptv", "cameras"],
                  state: entity.state,
                });
              }
            }
          }
        }
      } catch {
        // HA not configured or unreachable — just skip media players
        fastify.log.warn("Failed to fetch HA media players for cast targets");
      }

      return {
        success: true,
        data: targets,
      };
    }
  );

  // POST /cast — execute a cast action
  fastify.post(
    "/cast",
    {
      onRequest: [fastify.authenticateAny],
      schema: {
        description: "Cast content to a target device",
        tags: ["Cast"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        body: {
          type: "object",
          required: ["targetId", "targetType", "contentType"],
          properties: {
            targetId: { type: "string" },
            targetType: { type: "string", enum: ["kiosk", "media_player"] },
            contentType: {
              type: "string",
              enum: ["iptv", "camera", "multiview"],
            },
            channelId: { type: "string" },
            cameraId: { type: "string" },
            cameraEntityId: { type: "string" },
            multiviewItems: { type: "array" },
          },
        },
      },
    },
    async (request, reply) => {
      const user = await getCurrentUser(request);
      if (!user) {
        throw fastify.httpErrors.unauthorized("Not authenticated");
      }

      const body = request.body as CastRequest;
      const { targetType, contentType } = body;

      // MultiView → Media Player is not supported
      if (contentType === "multiview" && targetType === "media_player") {
        return reply.badRequest(
          "Multiview cannot be cast to media players — it requires a web-based kiosk"
        );
      }

      if (targetType === "kiosk") {
        return await handleKioskCast(fastify, user.id, body);
      } else {
        return await handleMediaPlayerCast(fastify, user.id, body);
      }
    }
  );
};

async function handleKioskCast(
  fastify: any,
  userId: string,
  body: CastRequest
) {
  const { targetId: kioskId, contentType } = body;

  // Verify kiosk ownership
  const [kiosk] = await fastify.db
    .select()
    .from(kiosks)
    .where(and(eq(kiosks.id, kioskId), eq(kiosks.userId, userId)))
    .limit(1);

  if (!kiosk) {
    throw fastify.httpErrors.notFound("Kiosk not found");
  }

  if (contentType === "iptv" && body.channelId) {
    queueKioskCommand(kioskId, "navigate", { path: "iptv" });
    queueKioskCommand(kioskId, "iptv-play", { channelId: body.channelId });
  } else if (contentType === "camera" && (body.cameraId || body.cameraEntityId)) {
    queueKioskCommand(kioskId, "navigate", { path: "cameras" });
    queueKioskCommand(kioskId, "camera-view", {
      cameraId: body.cameraId || body.cameraEntityId,
      cameraType: body.cameraEntityId ? "ha" : "standalone",
    });
  } else if (contentType === "multiview" && body.multiviewItems) {
    queueKioskCommand(kioskId, "navigate", { path: "multiview" });
    queueKioskCommand(kioskId, "multiview-set", { items: body.multiviewItems });
  } else {
    throw fastify.httpErrors.badRequest("Missing required content parameters");
  }

  fastify.log.info(`Cast ${contentType} to kiosk ${kioskId}`);
  return { success: true };
}

async function handleMediaPlayerCast(
  fastify: any,
  userId: string,
  body: CastRequest
) {
  const { targetId, contentType } = body;

  // Get HA config
  const [config] = await fastify.db
    .select()
    .from(homeAssistantConfig)
    .where(eq(homeAssistantConfig.userId, userId))
    .limit(1);

  if (!config) {
    throw fastify.httpErrors.badRequest("Home Assistant not configured");
  }

  let mediaUrl: string;

  if (contentType === "iptv" && body.channelId) {
    // Build IPTV stream URL
    const result = await fastify.db
      .select({
        channel: iptvChannels,
        server: iptvServers,
      })
      .from(iptvChannels)
      .innerJoin(iptvServers, eq(iptvChannels.serverId, iptvServers.id))
      .where(
        and(eq(iptvChannels.id, body.channelId), eq(iptvServers.userId, userId))
      )
      .limit(1);

    if (!result[0]) {
      throw fastify.httpErrors.notFound("Channel not found");
    }

    const client = new XtremeCodesClient({
      serverUrl: result[0].server.serverUrl,
      username: result[0].server.username,
      password: result[0].server.password,
    });

    mediaUrl = client.buildStreamUrl(result[0].channel.externalId);
  } else if (contentType === "camera") {
    if (body.cameraEntityId) {
      // HA camera — use HA's camera proxy stream
      mediaUrl = `${config.url}/api/camera_proxy_stream/${body.cameraEntityId}`;
    } else if (body.cameraId) {
      // Standalone camera — get HLS URL from MediaMTX
      const urls = mediamtx.getStreamUrls(body.cameraId);
      mediaUrl = urls.hlsUrl;
    } else {
      throw fastify.httpErrors.badRequest("Missing camera ID");
    }
  } else {
    throw fastify.httpErrors.badRequest("Missing required content parameters");
  }

  // Call media_player.play_media via HA
  const response = await fetchFromHA(
    config.url,
    config.accessToken,
    "/services/media_player/play_media",
    {
      method: "POST",
      body: JSON.stringify({
        entity_id: targetId,
        media_content_type: "video/mp4",
        media_content_id: mediaUrl,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    fastify.log.error(`HA media_player.play_media failed: ${error}`);
    throw fastify.httpErrors.internalServerError("Failed to cast to media player");
  }

  fastify.log.info(`Cast ${contentType} to media player ${targetId}`);
  return { success: true };
}
