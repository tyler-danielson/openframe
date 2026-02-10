import type { FastifyInstance } from "fastify";

const DISTANCE_MATRIX_API = "https://maps.googleapis.com/maps/api/distancematrix/json";
const PLACES_AUTOCOMPLETE_API = "https://maps.googleapis.com/maps/api/place/autocomplete/json";

export async function mapsRoutes(fastify: FastifyInstance) {
  // Get driving distance and duration between two locations
  fastify.get(
    "/distance",
    {
      schema: {
        description: "Get driving distance and duration between two locations",
        tags: ["Maps"],
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

      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
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

        return {
          success: true,
          data: {
            distance: element.distance,
            duration: element.duration,
            durationInTraffic: element.duration_in_traffic ?? null,
          },
        };
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
      schema: {
        description: "Search for places using Google Places Autocomplete",
        tags: ["Maps"],
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

      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
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
