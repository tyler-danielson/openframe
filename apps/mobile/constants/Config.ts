// API configuration
// In development, you can set this to your local server IP
// In production, this should be configured per environment or through app settings
export const API_CONFIG = {
  // Default to empty - user will configure this in settings or via QR code
  baseUrl: "",
  // API version prefix
  apiPrefix: "/api/v1",
};

export const getApiUrl = (baseUrl: string, path: string): string => {
  const cleanBaseUrl = baseUrl.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${cleanBaseUrl}${API_CONFIG.apiPrefix}${cleanPath}`;
};
