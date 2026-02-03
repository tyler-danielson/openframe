/**
 * reMarkable Cloud Client
 * Wrapper around the reMarkable cloud API for authentication and document management.
 *
 * Authentication flow:
 * 1. User gets a one-time code from my.remarkable.com/device/desktop/connect
 * 2. We register as a device using this code to get a device token (long-lived)
 * 3. We exchange the device token for a user token (short-lived, ~24hr)
 * 4. User token is refreshed automatically before expiry
 */

import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { remarkableConfig } from "@openframe/database/schema";

// reMarkable API endpoints
const REMARKABLE_AUTH_HOST = "https://webapp-prod.cloud.remarkable.engineering";
const REMARKABLE_SYNC_HOST = "https://internal.cloud.remarkable.com";

// Device description for registration
const DEVICE_DESC = "desktop-windows";
const DEVICE_ID = "OpenFrame-Calendar";

export interface RemarkableDocument {
  id: string;
  version: number;
  name: string;
  type: "DocumentType" | "CollectionType"; // Document or folder
  parent: string; // Parent folder ID, empty for root
  lastModified: string;
  pinned: boolean;
}

export interface RemarkableClient {
  isConnected(): boolean;
  connect(oneTimeCode: string): Promise<void>;
  disconnect(): Promise<void>;
  testConnection(): Promise<boolean>;
  refreshTokenIfNeeded(): Promise<void>;
  getDocuments(folderPath?: string): Promise<RemarkableDocument[]>;
  downloadDocument(documentId: string): Promise<Buffer>;
  uploadPdf(pdfBuffer: Buffer, name: string, folderPath: string): Promise<string>;
  createFolder(name: string, parentPath?: string): Promise<string>;
  getUserToken(): Promise<string | null>;
}

/**
 * Get or create the reMarkable client for a user
 */
export function getRemarkableClient(
  fastify: FastifyInstance,
  userId: string
): RemarkableClient {
  let cachedUserToken: string | null = null;
  let cachedTokenExpiry: Date | null = null;

  /**
   * Register as a device using one-time code
   * Returns a long-lived device token
   */
  async function registerDevice(oneTimeCode: string): Promise<string> {
    const response = await fetch(`${REMARKABLE_AUTH_HOST}/token/json/2/device/new`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: oneTimeCode,
        deviceDesc: DEVICE_DESC,
        deviceID: DEVICE_ID,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to register device: ${response.status} ${text}`);
    }

    // Response is the device token as plain text
    const deviceToken = await response.text();
    return deviceToken.trim();
  }

  /**
   * Exchange device token for user token
   * User tokens are short-lived (~24 hours)
   */
  async function exchangeForUserToken(deviceToken: string): Promise<{ token: string; expiresAt: Date }> {
    const response = await fetch(`${REMARKABLE_AUTH_HOST}/token/json/2/user/new`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${deviceToken}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to get user token: ${response.status} ${text}`);
    }

    const userToken = await response.text();

    // User tokens typically expire in 24 hours
    // We'll refresh 1 hour before expiry to be safe
    const expiresAt = new Date(Date.now() + 23 * 60 * 60 * 1000);

    return { token: userToken.trim(), expiresAt };
  }

  /**
   * Get the current user's reMarkable config
   */
  async function getConfig() {
    const [config] = await fastify.db
      .select()
      .from(remarkableConfig)
      .where(eq(remarkableConfig.userId, userId))
      .limit(1);
    return config;
  }

  /**
   * Save config to database
   */
  async function saveConfig(data: {
    deviceToken: string;
    userToken?: string | null;
    userTokenExpiresAt?: Date | null;
    isConnected?: boolean;
    lastSyncAt?: Date | null;
  }) {
    const existing = await getConfig();

    if (existing) {
      await fastify.db
        .update(remarkableConfig)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(remarkableConfig.userId, userId));
    } else {
      await fastify.db.insert(remarkableConfig).values({
        userId,
        deviceToken: data.deviceToken,
        userToken: data.userToken,
        userTokenExpiresAt: data.userTokenExpiresAt,
        isConnected: data.isConnected ?? true,
      });
    }
  }

  /**
   * Get list of all folders, returning a map of path -> ID
   */
  async function getFolderMap(userToken: string): Promise<Map<string, string>> {
    const response = await fetch(`${REMARKABLE_SYNC_HOST}/sync/v2/signed-urls/downloads`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get document list: ${response.status}`);
    }

    const data = await response.json() as { docs: RemarkableDocument[] };
    const folderMap = new Map<string, string>();

    // Build folder paths
    const folders = data.docs.filter(d => d.type === "CollectionType");

    function buildPath(folder: RemarkableDocument): string {
      if (!folder.parent) {
        return "/" + folder.name;
      }
      const parentFolder = folders.find(f => f.id === folder.parent);
      if (parentFolder) {
        return buildPath(parentFolder) + "/" + folder.name;
      }
      return "/" + folder.name;
    }

    for (const folder of folders) {
      const path = buildPath(folder);
      folderMap.set(path, folder.id);
    }

    return folderMap;
  }

  return {
    isConnected(): boolean {
      // This is a sync check - real check done via testConnection
      return true;
    },

    async connect(oneTimeCode: string): Promise<void> {
      fastify.log.info("Registering with reMarkable cloud...");

      // Register as device
      const deviceToken = await registerDevice(oneTimeCode);

      // Get initial user token
      const { token: userToken, expiresAt } = await exchangeForUserToken(deviceToken);

      // Save to database
      await saveConfig({
        deviceToken,
        userToken,
        userTokenExpiresAt: expiresAt,
        isConnected: true,
      });

      // Cache the token
      cachedUserToken = userToken;
      cachedTokenExpiry = expiresAt;

      fastify.log.info("Successfully connected to reMarkable cloud");
    },

    async disconnect(): Promise<void> {
      const config = await getConfig();
      if (config) {
        await fastify.db
          .delete(remarkableConfig)
          .where(eq(remarkableConfig.userId, userId));
      }
      cachedUserToken = null;
      cachedTokenExpiry = null;
      fastify.log.info("Disconnected from reMarkable cloud");
    },

    async testConnection(): Promise<boolean> {
      try {
        await this.refreshTokenIfNeeded();
        const userToken = await this.getUserToken();

        if (!userToken) {
          return false;
        }

        // Try to list documents as a connection test
        const response = await fetch(`${REMARKABLE_SYNC_HOST}/sync/v2/signed-urls/downloads`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        });

        return response.ok;
      } catch (error) {
        fastify.log.error({ err: error }, "reMarkable connection test failed");
        return false;
      }
    },

    async refreshTokenIfNeeded(): Promise<void> {
      const config = await getConfig();
      if (!config) {
        throw new Error("reMarkable not connected");
      }

      // Check if cached token is still valid
      if (cachedUserToken && cachedTokenExpiry && cachedTokenExpiry > new Date()) {
        return;
      }

      // Check if DB token is still valid (with 1 hour buffer)
      const bufferTime = new Date(Date.now() + 60 * 60 * 1000);
      if (config.userToken && config.userTokenExpiresAt && config.userTokenExpiresAt > bufferTime) {
        cachedUserToken = config.userToken;
        cachedTokenExpiry = config.userTokenExpiresAt;
        return;
      }

      // Need to refresh
      fastify.log.info("Refreshing reMarkable user token...");
      const { token: userToken, expiresAt } = await exchangeForUserToken(config.deviceToken);

      await saveConfig({
        deviceToken: config.deviceToken,
        userToken,
        userTokenExpiresAt: expiresAt,
      });

      cachedUserToken = userToken;
      cachedTokenExpiry = expiresAt;
      fastify.log.info("reMarkable user token refreshed");
    },

    async getDocuments(folderPath?: string): Promise<RemarkableDocument[]> {
      await this.refreshTokenIfNeeded();
      const userToken = await this.getUserToken();

      if (!userToken) {
        throw new Error("No user token available");
      }

      const response = await fetch(`${REMARKABLE_SYNC_HOST}/sync/v2/signed-urls/downloads`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get documents: ${response.status}`);
      }

      const data = await response.json() as { docs: RemarkableDocument[] };

      if (!folderPath) {
        return data.docs;
      }

      // Filter by folder path
      const folderMap = await getFolderMap(userToken);
      const folderId = folderMap.get(folderPath);

      if (!folderId) {
        return [];
      }

      return data.docs.filter(d => d.parent === folderId && d.type === "DocumentType");
    },

    async downloadDocument(documentId: string): Promise<Buffer> {
      await this.refreshTokenIfNeeded();
      const userToken = await this.getUserToken();

      if (!userToken) {
        throw new Error("No user token available");
      }

      // Get download URL for the document
      const urlResponse = await fetch(
        `${REMARKABLE_SYNC_HOST}/sync/v2/signed-urls/downloads?doc=${documentId}`,
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      if (!urlResponse.ok) {
        throw new Error(`Failed to get download URL: ${urlResponse.status}`);
      }

      const urlData = await urlResponse.json() as { url: string };

      // Download the document
      const docResponse = await fetch(urlData.url);
      if (!docResponse.ok) {
        throw new Error(`Failed to download document: ${docResponse.status}`);
      }

      const arrayBuffer = await docResponse.arrayBuffer();
      return Buffer.from(arrayBuffer);
    },

    async uploadPdf(pdfBuffer: Buffer, name: string, folderPath: string): Promise<string> {
      await this.refreshTokenIfNeeded();
      const userToken = await this.getUserToken();

      if (!userToken) {
        throw new Error("No user token available");
      }

      // Generate a document ID
      const documentId = crypto.randomUUID();

      // Get or create the folder
      const folderMap = await getFolderMap(userToken);
      let parentId = "";

      if (folderPath && folderPath !== "/") {
        let folderId = folderMap.get(folderPath);
        if (!folderId) {
          // Create the folder path
          folderId = await this.createFolder(folderPath);
        }
        parentId = folderId;
      }

      // Request upload URL
      const uploadUrlResponse = await fetch(`${REMARKABLE_SYNC_HOST}/sync/v2/signed-urls/uploads`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${userToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          docID: documentId,
          docType: "pdf",
        }),
      });

      if (!uploadUrlResponse.ok) {
        throw new Error(`Failed to get upload URL: ${uploadUrlResponse.status}`);
      }

      const uploadData = await uploadUrlResponse.json() as { url: string };

      // Upload the PDF - convert Buffer to Uint8Array for fetch compatibility
      const uploadResponse = await fetch(uploadData.url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/pdf",
        },
        body: new Uint8Array(pdfBuffer),
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload PDF: ${uploadResponse.status}`);
      }

      // Register the document in the metadata
      const metadataResponse = await fetch(`${REMARKABLE_SYNC_HOST}/sync/v2/docs`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${userToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: documentId,
          type: "DocumentType",
          name: name,
          parent: parentId,
          version: 1,
          pinned: false,
        }),
      });

      if (!metadataResponse.ok) {
        throw new Error(`Failed to register document metadata: ${metadataResponse.status}`);
      }

      // Update last sync time
      await saveConfig({
        deviceToken: (await getConfig())!.deviceToken,
        lastSyncAt: new Date(),
      });

      return documentId;
    },

    async createFolder(folderPath: string, parentPath?: string): Promise<string> {
      await this.refreshTokenIfNeeded();
      const userToken = await this.getUserToken();

      if (!userToken) {
        throw new Error("No user token available");
      }

      // Parse the folder path and create each level if needed
      const parts = folderPath.split("/").filter(p => p);
      const folderMap = await getFolderMap(userToken);

      let currentPath = "";
      let parentId = "";

      for (const part of parts) {
        currentPath += "/" + part;

        let folderId = folderMap.get(currentPath);
        if (!folderId) {
          // Create this folder level
          folderId = crypto.randomUUID();

          const response = await fetch(`${REMARKABLE_SYNC_HOST}/sync/v2/docs`, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${userToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id: folderId,
              type: "CollectionType",
              name: part,
              parent: parentId,
              version: 1,
              pinned: false,
            }),
          });

          if (!response.ok) {
            throw new Error(`Failed to create folder ${part}: ${response.status}`);
          }

          folderMap.set(currentPath, folderId);
        }

        parentId = folderId;
      }

      return parentId;
    },

    async getUserToken(): Promise<string | null> {
      if (cachedUserToken && cachedTokenExpiry && cachedTokenExpiry > new Date()) {
        return cachedUserToken;
      }

      const config = await getConfig();
      return config?.userToken ?? null;
    },
  };
}
