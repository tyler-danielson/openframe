import type { FastifyInstance } from "fastify";
import { getCategorySettings } from "../settings/index.js";

const DISTANCE_MATRIX_API = "https://maps.googleapis.com/maps/api/distancematrix/json";
const PLACES_AUTOCOMPLETE_API = "https://maps.googleapis.com/maps/api/place/autocomplete/json";

// Server-side distance cache: origin+destination → result + timestamp
// Traffic data is cached for 15 minutes to avoid redundant API calls
// (e.g., back-to-back events at the same location)
interface CachedDistance {
  data: {
    distance: { text: string; value: number };
    duration: { text: string; value: number };
    durationInTraffic: { text: string; value: number } | null;
  };
  timestamp: number;
}
const distanceCache = new Map<string, CachedDistance>();
const DISTANCE_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function getDistanceCacheKey(origin: string, destination: string): string {
  return `${origin.toLowerCase().trim()}|${destination.toLowerCase().trim()}`;
}

// Prune expired entries periodically (every 100 lookups)
let cacheLookupCount = 0;
function maybePruneCache() {
  cacheLookupCount++;
  if (cacheLookupCount >= 100) {
    cacheLookupCount = 0;
    const now = Date.now();
    for (const [key, entry] of distanceCache) {
      if (now - entry.timestamp > DISTANCE_CACHE_TTL) {
        distanceCache.delete(key);
      }
    }
  }
}

export async function mapsRoutes(fastify: FastifyInstance) {
  // Get driving distance and duration between two locations
  fastify.get(
    "/distance",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Get driving distance and duration between two locations",
        tags: ["Maps"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        querystring: {
          type: "object",
          required: ["origin", "destination"],
          properties: {
            origin: { type: "string", description: "Starting address" },
            destination: { type: "string", description: "Destination address" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              cached: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  distance: {
                    type: "object",
                    properties: {
                      text: { type: "string" },
                      value: { type: "number" },
                    },
                  },
                  duration: {
                    type: "object",
                    properties: {
                      text: { type: "string" },
                      value: { type: "number" },
                    },
                  },
                  durationInTraffic: {
                    type: "object",
                    nullable: true,
                    properties: {
                      text: { type: "string" },
                      value: { type: "number" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { origin, destination } = request.query as {
        origin: string;
        destination: string;
      };

      // Check server-side cache first
      maybePruneCache();
      const cacheKey = getDistanceCacheKey(origin, destination);
      const cached = distanceCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < DISTANCE_CACHE_TTL) {
        return { success: true, cached: true, data: cached.data };
      }

      const googleSettings = await getCategorySettings(fastify.db, "google");
      const serviceSettings = await getCategorySettings(fastify.db, "services");
      const hasPremiumTraffic = serviceSettings.traffic_premium === "true";
      const apiKey = googleSettings.maps_api_key || (hasPremiumTraffic ? process.env.GOOGLE_MAPS_PLATFORM_KEY : null) || process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        throw fastify.httpErrors.serviceUnavailable("Google Maps API key not configured");
      }

      try {
        const url = new URL(DISTANCE_MATRIX_API);
        url.searchParams.set("origins", origin);
        url.searchParams.set("destinations", destination);
        url.searchParams.set("mode", "driving");
        url.searchParams.set("departure_time", "now"); // For traffic-aware estimates
        url.searchParams.set("key", apiKey);

        const response = await fetch(url.toString());
        const data = await response.json() as {
          status: string;
          rows?: Array<{
            elements?: Array<{
              status: string;
              distance?: { text: string; value: number };
              duration?: { text: string; value: number };
              duration_in_traffic?: { text: string; value: number };
            }>;
          }>;
        };

        if (data.status !== "OK") {
          throw fastify.httpErrors.badRequest(`Distance Matrix API error: ${data.status}`);
        }

        const element = data.rows?.[0]?.elements?.[0];
        if (!element || element.status !== "OK") {
          throw fastify.httpErrors.badRequest(`Could not calculate distance: ${element?.status ?? "No results"}`);
        }

        const result = {
          distance: element.distance!,
          duration: element.duration!,
          durationInTraffic: element.duration_in_traffic ?? null,
        };

        // Cache the result
        distanceCache.set(cacheKey, { data: result, timestamp: Date.now() });

        return { success: true, cached: false, data: result };
      } catch (error) {
        fastify.log.error({ err: error }, "Distance Matrix API error");
        throw fastify.httpErrors.internalServerError("Failed to calculate distance");
      }
    }
  );

  // Places Autocomplete
  fastify.get(
    "/places/autocomplete",
    {
      onRequest: [fastify.authenticateKioskOrAny],
      schema: {
        description: "Search for places using Google Places Autocomplete",
        tags: ["Maps"],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        querystring: {
          type: "object",
          required: ["input"],
          properties: {
            input: { type: "string", description: "Search query" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    place_id: { type: "string" },
                    description: { type: "string" },
                    structured_formatting: {
                      type: "object",
                      properties: {
                        main_text: { type: "string" },
                        secondary_text: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { input } = request.query as { input: string };

      const googleSettings = await getCategorySettings(fastify.db, "google");
      const serviceSettings = await getCategorySettings(fastify.db, "services");
      const hasPremiumTraffic = serviceSettings.traffic_premium === "true";
      const apiKey = googleSettings.maps_api_key || (hasPremiumTraffic ? process.env.GOOGLE_MAPS_PLATFORM_KEY : null) || process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        throw fastify.httpErrors.serviceUnavailable("Google Maps API key not configured");
      }

      try {
        const url = new URL(PLACES_AUTOCOMPLETE_API);
        url.searchParams.set("input", input);
        url.searchParams.set("key", apiKey);

        const response = await fetch(url.toString());
        const data = await response.json() as {
          status: string;
          predictions?: Array<{
            place_id: string;
            description: string;
            structured_formatting: {
              main_text: string;
              secondary_text: string;
            };
          }>;
        };

        if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
          throw fastify.httpErrors.badRequest(`Places API error: ${data.status}`);
        }

        return {
          success: true,
          data: data.predictions ?? [],
        };
      } catch (error) {
        fastify.log.error({ err: error }, "Places Autocomplete API error");
        throw fastify.httpErrors.internalServerError("Failed to search places");
      }
    }
  );
}
