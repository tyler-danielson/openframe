/**
 * Capacities Service
 * Wrapper around the Capacities API for note-taking integration.
 *
 * API Documentation: https://api.capacities.io/docs
 *
 * Available endpoints (Beta):
 * - GET /spaces - List user's spaces
 * - GET /space-info - Get structures in a space
 * - POST /lookup - Search by title
 * - POST /save-to-daily-note - Write to today's daily note
 * - POST /save-weblink - Save URL as object
 */

import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { capacitiesConfig, capacitiesSpaces } from "@openframe/database/schema";

const CAPACITIES_API_BASE = "https://api.capacities.io";

// Capacities API types
export interface CapacitiesSpace {
  id: string;
  title: string;
  icon?: string | { name: string; color: string };
}

export interface CapacitiesSpaceInfo {
  id: string;
  title: string;
  structures: CapacitiesStructure[];
}

export interface CapacitiesStructure {
  id: string;
  pluralName: string;
  icon?: string;
}

export interface CapacitiesLookupResult {
  id: string;
  structureId: string;
  title: string;
}

export interface CapacitiesSavedObject {
  id: string;
  title: string;
  structureId: string;
}

export interface CapacitiesConfig {
  id: string;
  userId: string;
  apiToken: string;
  defaultSpaceId: string | null;
  isConnected: boolean;
  lastSyncAt: Date | null;
}

export class CapacitiesService {
  private db: FastifyInstance["db"];
  private fastify: FastifyInstance;
  private userId: string;

  constructor(fastify: FastifyInstance, userId: string) {
    this.db = fastify.db;
    this.fastify = fastify;
    this.userId = userId;
  }

  /**
   * Get the API token for the current user
   */
  private async getApiToken(): Promise<string> {
    const [config] = await this.db
      .select()
      .from(capacitiesConfig)
      .where(eq(capacitiesConfig.userId, this.userId))
      .limit(1);

    if (!config) {
      throw new Error("Capacities not connected");
    }

    return config.apiToken;
  }

  /**
   * Make authenticated request to Capacities API
   */
  private async capacitiesFetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getApiToken();

    const response = await fetch(`${CAPACITIES_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      this.fastify.log.error(
        { status: response.status, body: text },
        "Capacities API error"
      );

      // Handle specific error codes
      if (response.status === 401) {
        // Mark as disconnected
        await this.db
          .update(capacitiesConfig)
          .set({ isConnected: false, updatedAt: new Date() })
          .where(eq(capacitiesConfig.userId, this.userId));
        throw new Error("Invalid API token. Please reconnect.");
      }

      if (response.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }

      throw new Error(`Capacities API error: ${response.status} ${text}`);
    }

    // Some endpoints return empty response
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return response.json();
    }

    return {} as T;
  }

  /**
   * Get list of user's spaces
   * Rate limit: 5 requests per 60 seconds
   */
  async getSpaces(): Promise<CapacitiesSpace[]> {
    const result = await this.capacitiesFetch<{ spaces: CapacitiesSpace[] }>(
      "/spaces"
    );
    return result.spaces || [];
  }

  /**
   * Get structures (content types) in a space
   * Rate limit: 5 requests per 60 seconds
   */
  async getSpaceInfo(spaceId: string): Promise<CapacitiesSpaceInfo> {
    const params = new URLSearchParams({ spaceId });
    return this.capacitiesFetch<CapacitiesSpaceInfo>(`/space-info?${params}`);
  }

  /**
   * Search content by title
   * Rate limit: 120 requests per 60 seconds
   */
  async lookup(
    spaceId: string,
    searchTerm: string,
    structureId?: string
  ): Promise<CapacitiesLookupResult[]> {
    const body: Record<string, string> = {
      spaceId,
      searchTerm,
    };

    if (structureId) {
      body.structureId = structureId;
    }

    const result = await this.capacitiesFetch<{
      results: CapacitiesLookupResult[];
    }>("/lookup", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return result.results || [];
  }

  /**
   * Save text to today's daily note
   * Rate limit: 5 requests per 60 seconds
   */
  async saveToDailyNote(
    spaceId: string,
    mdText: string,
    options?: {
      noTimeStamp?: boolean;
      origin?: string;
    }
  ): Promise<void> {
    await this.capacitiesFetch("/save-to-daily-note", {
      method: "POST",
      body: JSON.stringify({
        spaceId,
        mdText,
        noTimeStamp: options?.noTimeStamp ?? false,
        origin: options?.origin,
      }),
    });
  }

  /**
   * Save a weblink as an object
   * Rate limit: 10 requests per 60 seconds
   */
  async saveWeblink(
    spaceId: string,
    url: string,
    options?: {
      mdText?: string;
      title?: string;
      tags?: string[];
      origin?: string;
    }
  ): Promise<CapacitiesSavedObject> {
    return this.capacitiesFetch<CapacitiesSavedObject>("/save-weblink", {
      method: "POST",
      body: JSON.stringify({
        spaceId,
        url,
        mdText: options?.mdText,
        title: options?.title,
        tags: options?.tags,
        origin: options?.origin,
      }),
    });
  }

  // --- Static connection management methods ---

  /**
   * Connect a user to Capacities with their API token
   */
  static async connect(
    fastify: FastifyInstance,
    userId: string,
    apiToken: string
  ): Promise<{ spaces: CapacitiesSpace[] }> {
    // First test the token by fetching spaces
    const response = await fetch(`${CAPACITIES_API_BASE}/spaces`, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 401) {
        throw new Error("Invalid API token");
      }
      throw new Error(`Failed to connect: ${response.status} ${text}`);
    }

    const data = await response.json();
    const spaces: CapacitiesSpace[] = data.spaces || [];

    // Check if already connected
    const [existing] = await fastify.db
      .select()
      .from(capacitiesConfig)
      .where(eq(capacitiesConfig.userId, userId))
      .limit(1);

    if (existing) {
      // Update existing config
      await fastify.db
        .update(capacitiesConfig)
        .set({
          apiToken,
          isConnected: true,
          updatedAt: new Date(),
        })
        .where(eq(capacitiesConfig.userId, userId));
    } else {
      // Create new config
      await fastify.db.insert(capacitiesConfig).values({
        userId,
        apiToken,
        isConnected: true,
      });
    }

    // Cache spaces
    await CapacitiesService.cacheSpaces(fastify, userId, spaces);

    return { spaces };
  }

  /**
   * Disconnect a user from Capacities
   */
  static async disconnect(
    fastify: FastifyInstance,
    userId: string
  ): Promise<void> {
    // Delete config
    await fastify.db
      .delete(capacitiesConfig)
      .where(eq(capacitiesConfig.userId, userId));

    // Delete cached spaces
    await fastify.db
      .delete(capacitiesSpaces)
      .where(eq(capacitiesSpaces.userId, userId));
  }

  /**
   * Get the current user's Capacities config
   */
  static async getConfig(
    fastify: FastifyInstance,
    userId: string
  ): Promise<CapacitiesConfig | null> {
    const [config] = await fastify.db
      .select()
      .from(capacitiesConfig)
      .where(eq(capacitiesConfig.userId, userId))
      .limit(1);

    return config || null;
  }

  /**
   * Test if the connection is still valid
   */
  static async testConnection(
    fastify: FastifyInstance,
    userId: string
  ): Promise<boolean> {
    try {
      const config = await CapacitiesService.getConfig(fastify, userId);
      if (!config) {
        return false;
      }

      const response = await fetch(`${CAPACITIES_API_BASE}/spaces`, {
        headers: {
          Authorization: `Bearer ${config.apiToken}`,
          "Content-Type": "application/json",
        },
      });

      const isValid = response.ok;

      // Update connection status if changed
      if (config.isConnected !== isValid) {
        await fastify.db
          .update(capacitiesConfig)
          .set({ isConnected: isValid, updatedAt: new Date() })
          .where(eq(capacitiesConfig.userId, userId));
      }

      return isValid;
    } catch (error) {
      fastify.log.error({ err: error }, "Capacities connection test failed");
      return false;
    }
  }

  /**
   * Cache spaces in database for faster lookups
   */
  private static async cacheSpaces(
    fastify: FastifyInstance,
    userId: string,
    spaces: CapacitiesSpace[]
  ): Promise<void> {
    // Delete existing cached spaces
    await fastify.db
      .delete(capacitiesSpaces)
      .where(eq(capacitiesSpaces.userId, userId));

    // Get default space ID from config
    const [config] = await fastify.db
      .select()
      .from(capacitiesConfig)
      .where(eq(capacitiesConfig.userId, userId))
      .limit(1);

    // Insert new spaces
    if (spaces.length > 0) {
      await fastify.db.insert(capacitiesSpaces).values(
        spaces.map((space, index) => ({
          userId,
          spaceId: space.id,
          title: space.title,
          icon: typeof space.icon === "string" ? space.icon : JSON.stringify(space.icon),
          isDefault: config?.defaultSpaceId === space.id || (index === 0 && !config?.defaultSpaceId),
        }))
      );
    }

    // Update last sync time
    await fastify.db
      .update(capacitiesConfig)
      .set({ lastSyncAt: new Date(), updatedAt: new Date() })
      .where(eq(capacitiesConfig.userId, userId));
  }

  /**
   * Get cached spaces for a user
   */
  static async getCachedSpaces(
    fastify: FastifyInstance,
    userId: string
  ): Promise<typeof capacitiesSpaces.$inferSelect[]> {
    return fastify.db
      .select()
      .from(capacitiesSpaces)
      .where(eq(capacitiesSpaces.userId, userId));
  }

  /**
   * Set the default space for a user
   */
  static async setDefaultSpace(
    fastify: FastifyInstance,
    userId: string,
    spaceId: string
  ): Promise<void> {
    // Update config
    await fastify.db
      .update(capacitiesConfig)
      .set({ defaultSpaceId: spaceId, updatedAt: new Date() })
      .where(eq(capacitiesConfig.userId, userId));

    // Update cached spaces - clear all defaults first
    await fastify.db
      .update(capacitiesSpaces)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(capacitiesSpaces.userId, userId));

    // Set new default
    await fastify.db
      .update(capacitiesSpaces)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(
        and(
          eq(capacitiesSpaces.userId, userId),
          eq(capacitiesSpaces.spaceId, spaceId)
        )
      );
  }

  /**
   * Refresh spaces from API
   */
  async refreshSpaces(): Promise<CapacitiesSpace[]> {
    const spaces = await this.getSpaces();
    await CapacitiesService.cacheSpaces(this.fastify, this.userId, spaces);
    return spaces;
  }
}
