// Cloud mode: when deployed as part of openframe.us cloud platform
export const isCloudMode = import.meta.env.VITE_CLOUD_MODE === "true";

// Base path for the SPA (e.g., "/app" in cloud mode, "" in self-hosted)
const rawBase = import.meta.env.VITE_BASE_PATH || "/";
export const appBasePath = rawBase.endsWith("/") ? rawBase.slice(0, -1) : rawBase;

/** Prefix a path with the app base path. E.g. appPath("/settings") → "/app/settings" in cloud mode */
export function appPath(path: string): string {
  return `${appBasePath}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Build a full return URL (origin + base path + path) for OAuth callbacks */
export function appUrl(path: string): string {
  return window.location.origin + appPath(path);
}
