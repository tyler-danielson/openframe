/**
 * Dual-mode storage service for Echo Show.
 *
 * - Alexa mode: Config comes from the Start directive and persists via
 *   sendMessage -> Lambda -> S3. No localStorage available.
 * - Silk/browser mode: Falls back to localStorage.
 */

import { isRunningInAlexa, sendMessage, getStartData } from "./alexa";

const STORAGE_PREFIX = "openframe_";

export interface KioskConfig {
  serverUrl: string;
  kioskToken: string;
}

// In-memory cache for Alexa mode (no localStorage available)
let memoryConfig: KioskConfig | null = null;

export function getKioskConfig(): KioskConfig | null {
  if (isRunningInAlexa()) {
    if (memoryConfig) return memoryConfig;

    const startData = getStartData();
    if (startData?.serverUrl && startData?.kioskToken) {
      memoryConfig = {
        serverUrl: startData.serverUrl,
        kioskToken: startData.kioskToken,
      };
      return memoryConfig;
    }
    return null;
  }

  // Silk/browser mode — localStorage
  try {
    const serverUrl = localStorage.getItem(`${STORAGE_PREFIX}server_url`);
    const kioskToken = localStorage.getItem(`${STORAGE_PREFIX}kiosk_token`);
    if (serverUrl && kioskToken) {
      return { serverUrl, kioskToken };
    }
  } catch (err) {
    console.warn("Storage get error:", err);
  }
  return null;
}

export function saveKioskConfig(config: KioskConfig): boolean {
  if (isRunningInAlexa()) {
    memoryConfig = config;
    sendMessage({
      action: "saveConfig",
      serverUrl: config.serverUrl,
      kioskToken: config.kioskToken,
    });
    return true;
  }

  try {
    localStorage.setItem(`${STORAGE_PREFIX}server_url`, config.serverUrl);
    localStorage.setItem(`${STORAGE_PREFIX}kiosk_token`, config.kioskToken);
    return true;
  } catch (err) {
    console.warn("Storage save error:", err);
    return false;
  }
}

export function clearKioskConfig(): boolean {
  if (isRunningInAlexa()) {
    memoryConfig = null;
    sendMessage({ action: "clearConfig" });
    return true;
  }

  try {
    localStorage.removeItem(`${STORAGE_PREFIX}server_url`);
    localStorage.removeItem(`${STORAGE_PREFIX}kiosk_token`);
    return true;
  } catch (err) {
    console.warn("Storage clear error:", err);
    return false;
  }
}

export function needsSetup(): boolean {
  if (isRunningInAlexa()) {
    const startData = getStartData();
    return startData?.needsSetup === true || !startData?.serverUrl;
  }
  return !getKioskConfig();
}

export const storage = {
  getKioskConfig,
  saveKioskConfig,
  clearKioskConfig,
  needsSetup,
};
