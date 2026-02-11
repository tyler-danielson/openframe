/**
 * Storage service for Tizen TV
 * Wraps localStorage with app-specific prefix and error handling
 */

const STORAGE_PREFIX = "openframe_";

export interface KioskConfig {
  serverUrl: string;
  kioskToken: string;
}

/**
 * Get a value from storage
 */
export function get(key: string): string | null {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${key}`);
  } catch (error) {
    console.warn("Storage get error:", error);
    return null;
  }
}

/**
 * Set a value in storage
 */
export function set(key: string, value: string): boolean {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, value);
    return true;
  } catch (error) {
    console.warn("Storage set error:", error);
    return false;
  }
}

/**
 * Remove a value from storage
 */
export function remove(key: string): boolean {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    return true;
  } catch (error) {
    console.warn("Storage remove error:", error);
    return false;
  }
}

/**
 * Clear all app storage
 */
export function clear(): boolean {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
    return true;
  } catch (error) {
    console.warn("Storage clear error:", error);
    return false;
  }
}

/**
 * Get kiosk configuration
 */
export function getKioskConfig(): KioskConfig | null {
  const serverUrl = get("server_url");
  const kioskToken = get("kiosk_token");

  if (serverUrl && kioskToken) {
    return { serverUrl, kioskToken };
  }
  return null;
}

/**
 * Save kiosk configuration
 */
export function saveKioskConfig(config: KioskConfig): boolean {
  const serverSaved = set("server_url", config.serverUrl);
  const tokenSaved = set("kiosk_token", config.kioskToken);
  return serverSaved && tokenSaved;
}

/**
 * Clear kiosk configuration
 */
export function clearKioskConfig(): boolean {
  const serverRemoved = remove("server_url");
  const tokenRemoved = remove("kiosk_token");
  return serverRemoved && tokenRemoved;
}

export const storage = {
  get,
  set,
  remove,
  clear,
  getKioskConfig,
  saveKioskConfig,
  clearKioskConfig,
};
