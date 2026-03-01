import Fastify, { type FastifyInstance, type FastifyError } from "fastify";
import pino from "pino";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import helmet from "@fastify/helmet";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { databasePlugin } from "./plugins/database.js";
import { authPlugin } from "./plugins/auth.js";
import { schedulerPlugin } from "./plugins/scheduler.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth/index.js";
import { calendarRoutes } from "./routes/calendars/index.js";
import { eventRoutes } from "./routes/events/index.js";
import { taskRoutes } from "./routes/tasks/index.js";
import { photoRoutes } from "./routes/photos/index.js";
import { botRoutes } from "./routes/bot/index.js";
import { mapsRoutes } from "./routes/maps/index.js";
import { iptvRoutes } from "./routes/iptv/index.js";
import { cameraRoutes } from "./routes/cameras/index.js";
import { homeAssistantRoutes } from "./routes/homeassistant/index.js";
import { spotifyRoutes } from "./routes/spotify/index.js";
import { weatherRoutes } from "./routes/weather/index.js";
import { settingsRoutes } from "./routes/settings/index.js";
import { handwritingRoutes } from "./routes/handwriting/index.js";
import { sportsRoutes } from "./routes/sports/index.js";
import { automationRoutes } from "./routes/automations/index.js";
import { newsRoutes } from "./routes/news/index.js";
import { remarkableRoutes } from "./routes/remarkable/index.js";
import { capacitiesRoutes } from "./routes/capacities/index.js";
import { telegramRoutes } from "./routes/telegram/index.js";
import { kiosksRoutes } from "./routes/kiosks/index.js";
import { recipeRoutes } from "./routes/recipes/index.js";
import { kitchenRoutes } from "./routes/kitchen/index.js";
import { profileRoutes } from "./routes/profiles/index.js";
import { gmailRoutes } from "./routes/gmail/index.js";
import { briefingRoutes } from "./routes/briefing/index.js";
import { setupRoutes } from "./routes/setup/index.js";
import { castRoutes } from "./routes/cast/index.js";
import { chatRoutes } from "./routes/chat/index.js";
import { youtubeRoutes } from "./routes/youtube/index.js";
import { plexRoutes } from "./routes/plex/index.js";
import { audiobookshelfRoutes } from "./routes/audiobookshelf/index.js";
import { routineRoutes } from "./routes/routines/index.js";
import { moduleRoutes } from "./routes/modules/index.js";
import { moduleGateHook } from "./plugins/module-gate.js";
import { companionAccessRoutes } from "./routes/companion/access.js";
import { companionDataRoutes } from "./routes/companion/data.js";
import { assumptionRoutes } from "./routes/assumptions/index.js";
import { userRoutes } from "./routes/users/index.js";
import { cloudRoutes } from "./routes/cloud/index.js";
import { adminRoutes } from "./routes/admin/index.js";
import { supportRoutes } from "./routes/support/index.js";
import { matterRoutes } from "./routes/matter/index.js";
import { cloudPlugin } from "./plugins/cloud.js";
import { matterPlugin } from "./plugins/matter.js";
import { planLimitsPlugin } from "./plugins/plan-limits.js";
import { requireAdminPlugin } from "./plugins/require-admin.js";
import { logBuffer, createLogBufferStream } from "./lib/logBuffer.js";
import type { Config } from "./config.js";

declare module "fastify" {
  interface FastifyInstance {
    logBuffer: typeof logBuffer;
  }
}

export async function buildApp(config: Config): Promise<FastifyInstance> {
  // Build multistream: stdout (or pino-pretty in dev) + in-memory log buffer
  const bufferStream = createLogBufferStream(logBuffer);
  const streams: pino.StreamEntry[] = [{ stream: bufferStream }];

  if (config.nodeEnv === "development") {
    const pinoPretty = await import("pino-pretty");
    streams.unshift({
      stream: pinoPretty.default({ colorize: true }),
    });
  } else {
    streams.unshift({ stream: process.stdout });
  }

  const logStream = pino.multistream(streams);

  const app = Fastify({
    logger: {
      level: config.logLevel,
      stream: logStream,
    },
  });

  // Register core plugins
  await app.register(sensible);

  await app.register(cors, {
    origin: config.corsOrigins,
    credentials: true,
  });

  await app.register(cookie, {
    secret: config.cookieSecret,
  });

  await app.register(jwt, {
    secret: config.jwtSecret,
    sign: {
      expiresIn: "15m",
    },
  });

  await app.register(rateLimit, {
    max: 500,
    timeWindow: "1 minute",
  });

  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
    },
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });

  // Swagger documentation (development only)
  if (config.nodeEnv !== "production") {
    await app.register(swagger, {
      openapi: {
        openapi: "3.0.0",
        info: {
          title: "OpenFrame API",
          description: "Self-hosted calendar dashboard API",
          version: "1.0.0",
        },
        servers: [
          {
            url: `http://localhost:${config.port}`,
            description: "Development server",
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
            },
            apiKey: {
              type: "apiKey",
              in: "header",
              name: "X-API-Key",
            },
          },
        },
      },
    });

    await app.register(swaggerUi, {
      routePrefix: "/docs",
    });
  }

  // Custom plugins
  await app.register(databasePlugin, { connectionString: config.databaseUrl });
  await app.register(authPlugin);
  await app.register(schedulerPlugin);
  await app.register(cloudPlugin);
  await app.register(matterPlugin);

  // Hosted mode config (SaaS multi-tenant)
  app.decorate("hostedMode", config.hostedMode);
  app.decorate("provisioningSecret", config.provisioningSecret ?? null);

  // Plan limits (active in hosted mode only)
  await app.register(planLimitsPlugin);

  // Admin access guard
  await app.register(requireAdminPlugin);

  // Log buffer for admin debug page
  app.decorate("logBuffer", logBuffer);

  // Shared upload tokens Map (must be decorated at app level so all routes share it)
  app.decorate("uploadTokens", new Map());

  // Module gate: block requests to disabled modules
  app.addHook("onRequest", moduleGateHook());

  // Routes
  await app.register(healthRoutes, { prefix: "/api/v1" });
  await app.register(authRoutes, { prefix: "/api/v1/auth" });
  await app.register(calendarRoutes, { prefix: "/api/v1/calendars" });
  await app.register(eventRoutes, { prefix: "/api/v1/events" });
  await app.register(taskRoutes, { prefix: "/api/v1/tasks" });
  await app.register(photoRoutes, { prefix: "/api/v1/photos" });
  await app.register(botRoutes, { prefix: "/api/v1/bot" });
  await app.register(mapsRoutes, { prefix: "/api/v1/maps" });
  await app.register(iptvRoutes, { prefix: "/api/v1/iptv" });
  await app.register(cameraRoutes, { prefix: "/api/v1/cameras" });
  await app.register(homeAssistantRoutes, { prefix: "/api/v1/homeassistant" });
  await app.register(spotifyRoutes, { prefix: "/api/v1/spotify" });
  await app.register(weatherRoutes, { prefix: "/api/v1/weather" });
  await app.register(settingsRoutes, { prefix: "/api/v1/settings" });
  await app.register(handwritingRoutes, { prefix: "/api/v1/handwriting" });
  await app.register(sportsRoutes, { prefix: "/api/v1/sports" });
  await app.register(automationRoutes, { prefix: "/api/v1/automations" });
  await app.register(newsRoutes, { prefix: "/api/v1/news" });
  await app.register(remarkableRoutes, { prefix: "/api/v1/remarkable" });
  await app.register(capacitiesRoutes, { prefix: "/api/v1/capacities" });
  await app.register(telegramRoutes, { prefix: "/api/v1/telegram" });
  await app.register(kiosksRoutes, { prefix: "/api/v1/kiosks" });
  await app.register(recipeRoutes, { prefix: "/api/v1/recipes" });
  await app.register(kitchenRoutes, { prefix: "/api/v1/kitchen" });
  await app.register(profileRoutes, { prefix: "/api/v1/profiles" });
  await app.register(gmailRoutes, { prefix: "/api/v1/gmail" });
  await app.register(briefingRoutes, { prefix: "/api/v1/briefing" });
  await app.register(setupRoutes, { prefix: "/api/v1/setup" });
  await app.register(castRoutes, { prefix: "/api/v1/cast" });
  await app.register(chatRoutes, { prefix: "/api/v1/chat" });
  await app.register(youtubeRoutes, { prefix: "/api/v1/youtube" });
  await app.register(plexRoutes, { prefix: "/api/v1/plex" });
  await app.register(audiobookshelfRoutes, { prefix: "/api/v1/audiobookshelf" });
  await app.register(routineRoutes, { prefix: "/api/v1/routines" });
  await app.register(moduleRoutes, { prefix: "/api/v1/modules" });
  await app.register(companionAccessRoutes, { prefix: "/api/v1/companion/access" });
  await app.register(companionDataRoutes, { prefix: "/api/v1/companion/data" });
  await app.register(assumptionRoutes, { prefix: "/api/v1/assumptions" });
  await app.register(userRoutes, { prefix: "/api/v1/users" });
  await app.register(cloudRoutes, { prefix: "/api/v1/cloud" });
  await app.register(adminRoutes, { prefix: "/api/v1/admin" });
  await app.register(supportRoutes, { prefix: "/api/v1/support" });
  await app.register(matterRoutes, { prefix: "/api/v1/matter" });

  // Error handler
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    app.log.error(error);

    const statusCode = error.statusCode ?? 500;
    const response = {
      success: false,
      error: {
        code: error.code ?? "INTERNAL_ERROR",
        message:
          config.nodeEnv === "production" && statusCode === 500
            ? "Internal server error"
            : error.message,
      },
    };

    reply.status(statusCode).send(response);
  });

  return app;
}
