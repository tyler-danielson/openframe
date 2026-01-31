import { useAuthStore } from "../stores/auth";
import type {
  Calendar,
  CalendarEvent,
  User,
  AuthTokens,
  PhotoAlbum,
  Photo,
  Task,
  TaskList,
  IptvServer,
  IptvCategory,
  IptvChannel,
  IptvEpgEntry,
  Camera,
  CameraSettings,
  HomeAssistantConfig,
  HomeAssistantEntity,
  HomeAssistantEntityState,
  HomeAssistantEntitySettings,
  HomeAssistantRoom,
  SportsLeague,
  SportsTeam,
  FavoriteSportsTeam,
  SportsGame,
  Automation,
  AutomationParseResult,
  AutomationTriggerType,
  AutomationTriggerConfig,
  AutomationActionType,
  AutomationActionConfig,
  AutomationNotification,
  NewsFeed,
  NewsArticle,
  NewsHeadline,
  PresetFeed,
} from "@openframe/shared";

// API Key types
export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface ApiKeyCreated {
  id: string;
  name: string;
  key: string; // Full key, only returned on creation
  keyPrefix: string;
}

// Color scheme types
export type ColorScheme = "default" | "homio" | "ocean" | "forest" | "sunset" | "lavender";

export const COLOR_SCHEMES: { value: ColorScheme; label: string; accent: string }[] = [
  { value: "default", label: "Blue (Default)", accent: "#3B82F6" },
  { value: "homio", label: "Gold (HOMIO)", accent: "#C4A77D" },
  { value: "ocean", label: "Teal Ocean", accent: "#14B8A6" },
  { value: "forest", label: "Green Forest", accent: "#22C55E" },
  { value: "sunset", label: "Orange Sunset", accent: "#F97316" },
  { value: "lavender", label: "Purple Lavender", accent: "#A855F7" },
];

const API_BASE = "/api/v1";

class ApiClient {
  private async fetch<T>(
    path: string,
    options: RequestInit = {},
    skipAuth = false
  ): Promise<T> {
    const { accessToken, refreshToken, apiKey, setTokens, logout, kioskEnabled } =
      useAuthStore.getState();

    const headers: HeadersInit = {
      ...options.headers,
    };

    // Only set Content-Type for requests with a body
    if (options.body) {
      (headers as Record<string, string>)["Content-Type"] = "application/json";
    }

    // Use API key if available, otherwise use Bearer token
    if (apiKey && !skipAuth) {
      (headers as Record<string, string>)["x-api-key"] = apiKey;
    } else if (accessToken && !skipAuth) {
      (headers as Record<string, string>).Authorization = `Bearer ${accessToken}`;
    }

    let response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    // Handle token refresh (only if we have tokens and aren't in pure kiosk mode)
    if (response.status === 401 && refreshToken && !skipAuth) {
      try {
        const refreshResponse = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          setTokens(data.data.accessToken, data.data.refreshToken);

          // Retry original request
          (headers as Record<string, string>).Authorization = `Bearer ${data.data.accessToken}`;
          response = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers,
          });
        } else if (!kioskEnabled) {
          logout();
          throw new Error("Session expired");
        }
      } catch {
        if (!kioskEnabled) {
          logout();
          throw new Error("Session expired");
        }
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // Handle both { error: "message" } and { error: { message: "message" } } formats
      const errorMessage = typeof errorData.error === "string"
        ? errorData.error
        : errorData.error?.message ?? "Request failed";
      throw new Error(errorMessage);
    }

    const result = await response.json();
    return result.data ?? result;
  }

  // Auth
  async getMe(): Promise<User> {
    return this.fetch<User>("/auth/me");
  }

  async logout(): Promise<void> {
    const { refreshToken } = useAuthStore.getState();
    await this.fetch("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
  }

  // API Keys
  async getApiKeys(): Promise<ApiKey[]> {
    return this.fetch<ApiKey[]>("/auth/api-keys");
  }

  async createApiKey(name: string, expiresInDays?: number): Promise<ApiKeyCreated> {
    return this.fetch<ApiKeyCreated>("/auth/api-keys", {
      method: "POST",
      body: JSON.stringify({ name, expiresInDays }),
    });
  }

  async deleteApiKey(id: string): Promise<void> {
    await this.fetch(`/auth/api-keys/${id}`, { method: "DELETE" });
  }

  // Server Config
  async getServerConfig(): Promise<{ frontendUrl: string }> {
    return this.fetch<{ frontendUrl: string }>("/auth/config");
  }

  // Calendars
  async getCalendars(): Promise<Calendar[]> {
    return this.fetch<Calendar[]>("/calendars?includeHidden=true");
  }

  async syncCalendar(id: string, fullSync = false): Promise<void> {
    await this.fetch(`/calendars/${id}/sync`, {
      method: "POST",
      body: JSON.stringify({ fullSync }),
    });
  }

  async syncAllCalendars(): Promise<void> {
    await this.fetch("/calendars/sync-all", { method: "POST", body: JSON.stringify({}) });
  }

  async updateCalendar(
    id: string,
    data: Partial<Pick<Calendar, "color" | "isVisible" | "syncEnabled" | "isPrimary" | "showOnDashboard">> & { visibility?: Partial<Calendar["visibility"]> }
  ): Promise<Calendar> {
    return this.fetch<Calendar>(`/calendars/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async subscribeICS(url: string, name?: string): Promise<{ id: string; name: string }> {
    return this.fetch<{ id: string; name: string }>("/calendars/ics/subscribe", {
      method: "POST",
      body: JSON.stringify({ url, name }),
    });
  }

  async deleteCalendar(id: string): Promise<void> {
    await this.fetch(`/calendars/${id}`, { method: "DELETE" });
  }

  // Events
  async getEvents(start: Date, end: Date, calendarIds?: string[]): Promise<CalendarEvent[]> {
    const params = new URLSearchParams({
      start: start.toISOString(),
      end: end.toISOString(),
    });

    if (calendarIds?.length) {
      params.set("calendarIds", calendarIds.join(","));
    }

    return this.fetch<CalendarEvent[]>(`/events?${params}`);
  }

  async createEvent(data: {
    calendarId: string;
    title: string;
    startTime: Date;
    endTime: Date;
    description?: string;
    location?: string;
    isAllDay?: boolean;
  }): Promise<CalendarEvent> {
    return this.fetch<CalendarEvent>("/events", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async createQuickEvent(text: string, calendarId?: string): Promise<CalendarEvent> {
    return this.fetch<CalendarEvent>("/events/quick", {
      method: "POST",
      body: JSON.stringify({ text, calendarId }),
    });
  }

  async updateEvent(
    id: string,
    data: Partial<CalendarEvent>
  ): Promise<CalendarEvent> {
    return this.fetch<CalendarEvent>(`/events/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteEvent(id: string): Promise<void> {
    await this.fetch(`/events/${id}`, { method: "DELETE" });
  }

  // Tasks
  async getTaskLists(): Promise<TaskList[]> {
    return this.fetch<TaskList[]>("/tasks/lists");
  }

  async getTasks(params?: {
    listId?: string;
    status?: "needsAction" | "completed";
  }): Promise<Task[]> {
    const searchParams = new URLSearchParams();
    if (params?.listId) searchParams.set("listId", params.listId);
    if (params?.status) searchParams.set("status", params.status);

    return this.fetch<Task[]>(`/tasks?${searchParams}`);
  }

  async createTask(data: {
    taskListId: string;
    title: string;
    notes?: string;
    dueDate?: Date;
  }): Promise<Task> {
    return this.fetch<Task>("/tasks", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async completeTask(id: string): Promise<Task> {
    return this.fetch<Task>(`/tasks/${id}/complete`, { method: "POST" });
  }

  async updateTask(
    id: string,
    data: Partial<{
      title: string;
      notes: string;
      status: "needsAction" | "completed";
      dueDate: Date | null;
    }>
  ): Promise<Task> {
    return this.fetch<Task>(`/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteTask(id: string): Promise<void> {
    await this.fetch(`/tasks/${id}`, { method: "DELETE" });
  }

  async syncTasks(): Promise<{ syncedLists: number; syncedTasks: number; totalLists: number }> {
    return this.fetch("/tasks/sync", { method: "POST" });
  }

  // Photos
  async getAlbums(): Promise<PhotoAlbum[]> {
    return this.fetch<PhotoAlbum[]>("/photos/albums");
  }

  async createAlbum(data: {
    name: string;
    description?: string;
  }): Promise<PhotoAlbum> {
    return this.fetch<PhotoAlbum>("/photos/albums", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateAlbum(
    albumId: string,
    data: {
      name?: string;
      description?: string;
      isActive?: boolean;
      slideshowInterval?: number;
    }
  ): Promise<PhotoAlbum> {
    return this.fetch<PhotoAlbum>(`/photos/albums/${albumId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteAlbum(albumId: string): Promise<void> {
    await this.fetch(`/photos/albums/${albumId}`, { method: "DELETE" });
  }

  async getAlbumPhotos(albumId: string): Promise<Photo[]> {
    return this.fetch<Photo[]>(`/photos/albums/${albumId}/photos`);
  }

  async uploadPhoto(albumId: string, file: File): Promise<Photo> {
    const { accessToken } = useAuthStore.getState();
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE}/photos/albums/${albumId}/photos`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Failed to upload photo");
    }

    const result = await response.json();
    return result.data;
  }

  async getSlideshow(): Promise<{
    photos: Array<{ id: string; url: string; width?: number; height?: number }>;
    interval: number;
  }> {
    return this.fetch("/photos/slideshow");
  }

  async importPhotosFromGoogle(
    albumId: string,
    sessionId: string
  ): Promise<{ imported: number; skipped: number }> {
    return this.fetch(`/photos/albums/${albumId}/import/google`, {
      method: "POST",
      body: JSON.stringify({ sessionId }),
    });
  }

  // Google Photos Picker API
  async getGooglePhotosPickerStatus(): Promise<{
    connected: boolean;
    reason: string | null;
  }> {
    return this.fetch("/photos/google/picker/status");
  }

  async createGooglePhotosPickerSession(): Promise<{
    sessionId: string;
    pickerUri: string;
    pollInterval: number;
    timeout: number;
  }> {
    return this.fetch("/photos/google/picker/session", {
      method: "POST",
      body: JSON.stringify({}),
    });
  }

  async getGooglePhotosPickerSessionStatus(sessionId: string): Promise<{
    sessionId: string;
    mediaItemsSet: boolean;
  }> {
    return this.fetch(`/photos/google/picker/session/${sessionId}`);
  }

  async getGooglePhotosPickerPhotos(sessionId: string): Promise<
    Array<{
      id: string;
      url: string;
      mimeType: string;
      filename: string;
    }>
  > {
    return this.fetch(`/photos/google/picker/session/${sessionId}/photos`);
  }

  async deleteGooglePhotosPickerSession(sessionId: string): Promise<void> {
    await this.fetch(`/photos/google/picker/session/${sessionId}`, {
      method: "DELETE",
    });
  }

  async deletePhoto(id: string): Promise<void> {
    await this.fetch(`/photos/${id}`, { method: "DELETE" });
  }

  // Photo upload tokens (for QR code mobile uploads)
  async createUploadToken(albumId: string): Promise<{ token: string; expiresAt: string; albumName: string }> {
    return this.fetch<{ token: string; expiresAt: string; albumName: string }>(
      `/photos/albums/${albumId}/upload-token`,
      { method: "POST" }
    );
  }

  async revokeUploadToken(token: string): Promise<void> {
    await this.fetch(`/photos/upload-token/${token}`, { method: "DELETE" });
  }

  async getUploadTokenInfo(token: string): Promise<{ albumName: string; expiresAt: string }> {
    const response = await fetch(`${API_BASE}/photos/upload-token/${token}`);
    if (!response.ok) {
      throw new Error("Token not found or expired");
    }
    const result = await response.json();
    return result.data;
  }

  async uploadWithToken(token: string, file: File): Promise<{ id: string; filename: string }> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE}/photos/upload-public/${token}`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Upload failed");
    }

    const result = await response.json();
    return result.data;
  }

  // Kiosk mode
  async getKioskStatus(): Promise<{ enabled: boolean }> {
    const response = await fetch(`${API_BASE}/auth/kiosk/status`);
    const result = await response.json();
    return result.data;
  }

  async getMyKioskStatus(): Promise<{ enabled: boolean }> {
    return this.fetch<{ enabled: boolean }>("/auth/kiosk/me");
  }

  async enableKiosk(): Promise<void> {
    await this.fetch("/auth/kiosk/enable", { method: "POST", body: JSON.stringify({}) });
  }

  async disableKiosk(): Promise<void> {
    await this.fetch("/auth/kiosk/disable", { method: "POST", body: JSON.stringify({}) });
  }

  // Screensaver settings
  async getScreensaverSettings(): Promise<{
    enabled: boolean;
    timeout: number;
    interval: number;
    layout: "fullscreen" | "side-by-side" | "quad" | "scatter";
    transition: "fade" | "slide-left" | "slide-right" | "slide-up" | "slide-down" | "zoom";
    colorScheme: ColorScheme;
  }> {
    const response = await fetch(`${API_BASE}/auth/kiosk/screensaver`);
    const result = await response.json();
    return result.data;
  }

  async updateScreensaverSettings(settings: {
    enabled?: boolean;
    timeout?: number;
    interval?: number;
    layout?: "fullscreen" | "side-by-side" | "quad" | "scatter";
    transition?: "fade" | "slide-left" | "slide-right" | "slide-up" | "slide-down" | "zoom";
    colorScheme?: ColorScheme;
  }): Promise<void> {
    await this.fetch("/auth/kiosk/screensaver", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  }

  // Maps
  async getDrivingDistance(
    origin: string,
    destination: string
  ): Promise<{
    distance: { text: string; value: number };
    duration: { text: string; value: number };
    durationInTraffic: { text: string; value: number } | null;
  }> {
    const params = new URLSearchParams({ origin, destination });
    return this.fetch(`/maps/distance?${params}`);
  }

  // IPTV
  async getIptvServers(): Promise<IptvServer[]> {
    return this.fetch<IptvServer[]>("/iptv/servers");
  }

  async addIptvServer(data: {
    name: string;
    serverUrl: string;
    username: string;
    password: string;
  }): Promise<IptvServer> {
    return this.fetch<IptvServer>("/iptv/servers", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async deleteIptvServer(id: string): Promise<void> {
    await this.fetch(`/iptv/servers/${id}`, { method: "DELETE" });
  }

  async syncIptvServer(id: string): Promise<{ categories: number; channels: number }> {
    return this.fetch(`/iptv/servers/${id}/sync`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  }

  async getIptvCategories(serverId?: string): Promise<IptvCategory[]> {
    const params = new URLSearchParams();
    if (serverId) params.set("serverId", serverId);
    return this.fetch<IptvCategory[]>(`/iptv/categories?${params}`);
  }

  async getIptvChannels(params?: {
    serverId?: string;
    categoryId?: string;
    search?: string;
  }): Promise<IptvChannel[]> {
    const searchParams = new URLSearchParams();
    if (params?.serverId) searchParams.set("serverId", params.serverId);
    if (params?.categoryId) searchParams.set("categoryId", params.categoryId);
    if (params?.search) searchParams.set("search", params.search);
    return this.fetch<IptvChannel[]>(`/iptv/channels?${searchParams}`);
  }

  async getIptvChannelStream(channelId: string): Promise<{
    streamUrl: string;
    channelId: string;
    channelName: string;
  }> {
    return this.fetch(`/iptv/channels/${channelId}/stream`);
  }

  async getIptvChannelEpg(channelId: string): Promise<IptvEpgEntry[]> {
    return this.fetch<IptvEpgEntry[]>(`/iptv/channels/${channelId}/epg`);
  }

  async getIptvFavorites(): Promise<IptvChannel[]> {
    return this.fetch<IptvChannel[]>("/iptv/favorites");
  }

  async addIptvFavorite(channelId: string): Promise<void> {
    await this.fetch(`/iptv/favorites/${channelId}`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  }

  async removeIptvFavorite(channelId: string): Promise<void> {
    await this.fetch(`/iptv/favorites/${channelId}`, { method: "DELETE" });
  }

  async getIptvHistory(limit?: number): Promise<IptvChannel[]> {
    const params = new URLSearchParams();
    if (limit) params.set("limit", limit.toString());
    return this.fetch<IptvChannel[]>(`/iptv/history?${params}`);
  }

  async recordIptvWatch(channelId: string): Promise<void> {
    await this.fetch(`/iptv/history/${channelId}`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  }

  // IPTV Cache endpoints
  async getIptvGuide(options?: { serverId?: string; categoryId?: string }): Promise<{
    channels: IptvChannel[];
    categories: IptvCategory[];
    epg: Record<string, Array<{
      id: string;
      title: string;
      description: string | null;
      startTime: string;
      endTime: string;
    }>>;
    cached: boolean;
    lastUpdated: string | null;
  }> {
    const params = new URLSearchParams();
    if (options?.serverId) params.set("serverId", options.serverId);
    if (options?.categoryId) params.set("categoryId", options.categoryId);
    return this.fetch(`/iptv/guide?${params}`);
  }

  async refreshIptvCache(): Promise<{
    channelCount: number;
    categoryCount: number;
    epgChannelCount: number;
    lastUpdated: string | null;
  }> {
    return this.fetch("/iptv/cache/refresh", { method: "POST" });
  }

  async getIptvCacheStatus(): Promise<{
    cached: boolean;
    valid: boolean;
    channelCount: number;
    categoryCount: number;
    epgChannelCount: number;
    lastUpdated: string | null;
  }> {
    return this.fetch("/iptv/cache/status");
  }

  // Cameras
  async getCameras(): Promise<Camera[]> {
    return this.fetch<Camera[]>("/cameras");
  }

  async getCamera(id: string): Promise<Camera> {
    return this.fetch<Camera>(`/cameras/${id}`);
  }

  async createCamera(data: {
    name: string;
    rtspUrl?: string;
    mjpegUrl?: string;
    snapshotUrl?: string;
    username?: string;
    password?: string;
    settings?: CameraSettings;
  }): Promise<Camera> {
    return this.fetch<Camera>("/cameras", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateCamera(
    id: string,
    data: Partial<{
      name: string;
      rtspUrl: string | null;
      mjpegUrl: string | null;
      snapshotUrl: string | null;
      username: string | null;
      password: string | null;
      isEnabled: boolean;
      sortOrder: number;
      settings: CameraSettings;
    }>
  ): Promise<Camera> {
    return this.fetch<Camera>(`/cameras/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async reorderCameras(order: string[]): Promise<void> {
    await this.fetch("/cameras/reorder", {
      method: "POST",
      body: JSON.stringify({ order }),
    });
  }

  async toggleCameraFavorite(id: string): Promise<{ id: string; isFavorite: boolean }> {
    return this.fetch<{ id: string; isFavorite: boolean }>(`/cameras/${id}/favorite`, {
      method: "POST",
    });
  }

  async deleteCamera(id: string): Promise<void> {
    await this.fetch(`/cameras/${id}`, { method: "DELETE" });
  }

  getCameraSnapshotUrl(id: string): string {
    return `${API_BASE}/cameras/${id}/snapshot`;
  }

  getCameraStreamUrl(id: string): string {
    return `${API_BASE}/cameras/${id}/stream`;
  }

  // MediaMTX streaming endpoints
  async getMediaMTXStatus(): Promise<{ available: boolean }> {
    return this.fetch<{ available: boolean }>("/cameras/mediamtx/status");
  }

  async getCameraWebRTCUrl(id: string): Promise<{ webrtcUrl: string; pathName: string }> {
    return this.fetch<{ webrtcUrl: string; pathName: string }>(`/cameras/${id}/webrtc-url`);
  }

  async getCameraHLSUrl(id: string): Promise<{ hlsUrl: string; pathName: string }> {
    return this.fetch<{ hlsUrl: string; pathName: string }>(`/cameras/${id}/hls-url`);
  }

  async startCameraStream(id: string): Promise<{
    pathName: string;
    webrtcUrl: string;
    hlsUrl: string;
  }> {
    return this.fetch(`/cameras/${id}/start-stream`, {
      method: "POST",
    });
  }

  async stopCameraStream(id: string): Promise<void> {
    await this.fetch(`/cameras/${id}/stop-stream`, { method: "DELETE" });
  }

  async getCameraStreamStatus(id: string): Promise<{
    mediamtxAvailable: boolean;
    streamReady: boolean;
    hasRtspUrl: boolean;
    webrtcUrl?: string;
    hlsUrl?: string;
  }> {
    return this.fetch(`/cameras/${id}/stream-status`);
  }

  // Home Assistant
  async getHomeAssistantConfig(): Promise<HomeAssistantConfig | null> {
    return this.fetch<HomeAssistantConfig | null>("/homeassistant/config");
  }

  async getHomeAssistantWebSocketConfig(): Promise<{ url: string; accessToken: string } | null> {
    return this.fetch<{ url: string; accessToken: string } | null>("/homeassistant/config/websocket");
  }

  async saveHomeAssistantConfig(data: {
    url: string;
    accessToken: string;
  }): Promise<HomeAssistantConfig> {
    return this.fetch<HomeAssistantConfig>("/homeassistant/config", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async deleteHomeAssistantConfig(): Promise<void> {
    await this.fetch("/homeassistant/config", { method: "DELETE" });
  }

  async getHomeAssistantStates(): Promise<HomeAssistantEntityState[]> {
    return this.fetch<HomeAssistantEntityState[]>("/homeassistant/states");
  }

  async getHomeAssistantState(entityId: string): Promise<HomeAssistantEntityState> {
    return this.fetch<HomeAssistantEntityState>(`/homeassistant/states/${entityId}`);
  }

  async getHomeAssistantLocations(): Promise<HALocation[]> {
    return this.fetch<HALocation[]>("/homeassistant/locations");
  }

  async getHomeAssistantZones(): Promise<HAZone[]> {
    return this.fetch<HAZone[]>("/homeassistant/zones");
  }

  async callHomeAssistantService(
    domain: string,
    service: string,
    data?: Record<string, unknown>
  ): Promise<unknown> {
    return this.fetch(`/homeassistant/services/${domain}/${service}`, {
      method: "POST",
      body: JSON.stringify(data || {}),
    });
  }

  async getHomeAssistantEntities(params?: { roomId?: string; unassigned?: boolean }): Promise<HomeAssistantEntity[]> {
    const searchParams = new URLSearchParams();
    if (params?.roomId) searchParams.set("roomId", params.roomId);
    if (params?.unassigned) searchParams.set("unassigned", "true");
    const query = searchParams.toString();
    return this.fetch<HomeAssistantEntity[]>(`/homeassistant/entities${query ? `?${query}` : ""}`);
  }

  // Room management
  async getHomeAssistantRooms(): Promise<HomeAssistantRoom[]> {
    return this.fetch<HomeAssistantRoom[]>("/homeassistant/rooms");
  }

  async createHomeAssistantRoom(data: {
    name: string;
    temperatureSensorId?: string;
    humiditySensorId?: string;
    windowSensorId?: string;
  }): Promise<HomeAssistantRoom> {
    return this.fetch<HomeAssistantRoom>("/homeassistant/rooms", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateHomeAssistantRoom(
    id: string,
    data: Partial<{
      name: string;
      sortOrder: number;
      temperatureSensorId: string | null;
      humiditySensorId: string | null;
      windowSensorId: string | null;
    }>
  ): Promise<HomeAssistantRoom> {
    return this.fetch<HomeAssistantRoom>(`/homeassistant/rooms/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteHomeAssistantRoom(id: string): Promise<void> {
    await this.fetch(`/homeassistant/rooms/${id}`, { method: "DELETE" });
  }

  async reorderHomeAssistantRooms(roomIds: string[]): Promise<void> {
    await this.fetch("/homeassistant/rooms/reorder", {
      method: "POST",
      body: JSON.stringify({ roomIds }),
    });
  }

  async assignEntityToRoom(entityId: string, roomId: string | null): Promise<HomeAssistantEntity> {
    return this.fetch<HomeAssistantEntity>(`/homeassistant/entities/${entityId}/room`, {
      method: "PATCH",
      body: JSON.stringify({ roomId }),
    });
  }

  async addHomeAssistantEntity(data: {
    entityId: string;
    displayName?: string;
    showInDashboard?: boolean;
    settings?: HomeAssistantEntitySettings;
  }): Promise<HomeAssistantEntity> {
    return this.fetch<HomeAssistantEntity>("/homeassistant/entities", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateHomeAssistantEntity(
    id: string,
    data: Partial<{
      displayName: string | null;
      sortOrder: number;
      showInDashboard: boolean;
      settings: HomeAssistantEntitySettings;
    }>
  ): Promise<HomeAssistantEntity> {
    return this.fetch<HomeAssistantEntity>(`/homeassistant/entities/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async removeHomeAssistantEntity(id: string): Promise<void> {
    await this.fetch(`/homeassistant/entities/${id}`, { method: "DELETE" });
  }

  async reorderHomeAssistantEntities(entityIds: string[]): Promise<void> {
    await this.fetch("/homeassistant/entities/reorder", {
      method: "POST",
      body: JSON.stringify({ entityIds }),
    });
  }

  async getHomeAssistantCameras(): Promise<HACamera[]> {
    return this.fetch<HACamera[]>("/homeassistant/cameras");
  }

  async getHomeAssistantAvailableCameras(): Promise<HAAvailableCamera[]> {
    return this.fetch<HAAvailableCamera[]>("/homeassistant/cameras/available");
  }

  async discoverHomeAssistant(): Promise<{ url: string; source: string }[]> {
    return this.fetch<{ url: string; source: string }[]>("/homeassistant/discover");
  }

  getHACameraSnapshotUrl(entityId: string): string {
    return `${API_BASE}/homeassistant/camera/${entityId}/snapshot`;
  }

  getHACameraStreamUrl(entityId: string): string {
    return `${API_BASE}/homeassistant/camera/${entityId}/stream`;
  }

  // Entity Timers
  async getHomeAssistantTimers(): Promise<HAEntityTimer[]> {
    return this.fetch<HAEntityTimer[]>("/homeassistant/timers");
  }

  async createHomeAssistantTimer(data: {
    entityId: string;
    action: "turn_on" | "turn_off";
    triggerAt: string;
    fadeEnabled?: boolean;
    fadeDuration?: number;
  }): Promise<HAEntityTimer> {
    return this.fetch<HAEntityTimer>("/homeassistant/timers", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async cancelHomeAssistantTimer(id: string): Promise<void> {
    await this.fetch(`/homeassistant/timers/${id}`, { method: "DELETE" });
  }

  // Home Assistant Calendars
  async getHomeAssistantCalendars(): Promise<Array<{ entityId: string; name: string; isSubscribed: boolean }>> {
    return this.fetch("/homeassistant/calendars");
  }

  async subscribeHomeAssistantCalendar(entityId: string, name?: string): Promise<{ id: string; name: string }> {
    return this.fetch("/homeassistant/calendars/subscribe", {
      method: "POST",
      body: JSON.stringify({ entityId, name }),
    });
  }

  async syncHomeAssistantCalendar(id: string): Promise<void> {
    await this.fetch(`/homeassistant/calendars/${id}/sync`, { method: "POST" });
  }

  // Spotify

  // Account type for multi-user support
  async getSpotifyStatus(): Promise<{
    connected: boolean;
    accounts?: SpotifyAccount[];
    user?: { id: string; name: string; image?: string };
  }> {
    return this.fetch("/spotify/status");
  }

  async getSpotifyAccounts(): Promise<SpotifyAccount[]> {
    return this.fetch("/spotify/accounts");
  }

  async updateSpotifyAccount(
    accountId: string,
    data: {
      accountName?: string;
      isPrimary?: boolean;
      icon?: string | null;
      defaultDeviceId?: string | null;
      favoriteDeviceIds?: string[] | null;
    }
  ): Promise<void> {
    await this.fetch(`/spotify/accounts/${accountId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  getSpotifyAuthUrl(): string {
    const { accessToken } = useAuthStore.getState();
    return `${API_BASE}/spotify/auth?token=${encodeURIComponent(accessToken || '')}`;
  }

  async disconnectSpotify(accountId?: string): Promise<void> {
    const params = accountId ? `?accountId=${accountId}` : '';
    await this.fetch(`/spotify/disconnect${params}`, { method: "DELETE" });
  }

  async getSpotifyPlayback(accountId?: string): Promise<{
    is_playing: boolean;
    progress_ms: number;
    device: { id: string; name: string; type: string; is_active: boolean; volume_percent: number } | null;
    item: {
      id: string;
      name: string;
      uri: string;
      duration_ms: number;
      artists: { id: string; name: string }[];
      album: { id: string; name: string; images: { url: string }[] };
    } | null;
    shuffle_state: boolean;
    repeat_state: "off" | "track" | "context";
  } | null> {
    const params = accountId ? `?accountId=${accountId}` : '';
    return this.fetch(`/spotify/playback${params}`);
  }

  async getSpotifyDevices(accountId?: string): Promise<
    { id: string; name: string; type: string; is_active: boolean; volume_percent: number }[]
  > {
    const params = accountId ? `?accountId=${accountId}` : '';
    return this.fetch(`/spotify/devices${params}`);
  }

  async spotifyPlay(options?: {
    deviceId?: string;
    contextUri?: string;
    uris?: string[];
    accountId?: string;
  }): Promise<void> {
    const params = options?.accountId ? `?accountId=${options.accountId}` : '';
    const { accountId, ...body } = options || {};
    await this.fetch(`/spotify/play${params}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  }

  async spotifyPause(accountId?: string): Promise<void> {
    const params = accountId ? `?accountId=${accountId}` : '';
    await this.fetch(`/spotify/pause${params}`, { method: "PUT" });
  }

  async spotifyNext(accountId?: string): Promise<void> {
    const params = accountId ? `?accountId=${accountId}` : '';
    await this.fetch(`/spotify/next${params}`, { method: "POST", body: JSON.stringify({}) });
  }

  async spotifyPrevious(accountId?: string): Promise<void> {
    const params = accountId ? `?accountId=${accountId}` : '';
    await this.fetch(`/spotify/previous${params}`, { method: "POST", body: JSON.stringify({}) });
  }

  async spotifySeek(positionMs: number, accountId?: string): Promise<void> {
    const params = accountId ? `?accountId=${accountId}` : '';
    await this.fetch(`/spotify/seek${params}`, {
      method: "PUT",
      body: JSON.stringify({ positionMs }),
    });
  }

  async spotifySetVolume(volumePercent: number, accountId?: string): Promise<void> {
    const params = accountId ? `?accountId=${accountId}` : '';
    await this.fetch(`/spotify/volume${params}`, {
      method: "PUT",
      body: JSON.stringify({ volumePercent }),
    });
  }

  async spotifySetShuffle(state: boolean, accountId?: string): Promise<void> {
    const params = accountId ? `?accountId=${accountId}` : '';
    await this.fetch(`/spotify/shuffle${params}`, {
      method: "PUT",
      body: JSON.stringify({ state }),
    });
  }

  async spotifySetRepeat(state: "off" | "track" | "context", accountId?: string): Promise<void> {
    const params = accountId ? `?accountId=${accountId}` : '';
    await this.fetch(`/spotify/repeat${params}`, {
      method: "PUT",
      body: JSON.stringify({ state }),
    });
  }

  async spotifyTransferPlayback(deviceId: string, play?: boolean, accountId?: string): Promise<void> {
    const params = accountId ? `?accountId=${accountId}` : '';
    await this.fetch(`/spotify/transfer${params}`, {
      method: "PUT",
      body: JSON.stringify({ deviceId, play }),
    });
  }

  async getSpotifyPlaylists(limit = 20, offset = 0, accountId?: string): Promise<{
    items: {
      id: string;
      name: string;
      description: string | null;
      images: { url: string }[];
      tracks: { total: number };
      uri: string;
    }[];
    total: number;
  }> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (accountId) params.set('accountId', accountId);
    return this.fetch(`/spotify/playlists?${params}`);
  }

  async getSpotifyRecentlyPlayed(limit = 20, accountId?: string): Promise<{
    items: {
      track: {
        id: string;
        name: string;
        uri: string;
        artists: { name: string }[];
        album: { name: string; images: { url: string }[] };
      };
      played_at: string;
    }[];
  }> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (accountId) params.set('accountId', accountId);
    return this.fetch(`/spotify/recently-played?${params}`);
  }

  async searchSpotify(
    query: string,
    types: string[] = ["track", "artist", "album", "playlist"],
    limit = 10,
    accountId?: string
  ): Promise<{
    tracks?: { items: { id: string; name: string; uri: string; artists: { name: string }[]; album: { name: string; images: { url: string }[] } }[] };
    playlists?: { items: { id: string; name: string; uri: string; images: { url: string }[] }[] };
  }> {
    const params = new URLSearchParams({
      q: query,
      types: types.join(","),
      limit: String(limit),
    });
    if (accountId) params.set('accountId', accountId);
    return this.fetch(`/spotify/search?${params}`);
  }

  async spotifyCheckSavedTracks(trackIds: string[], accountId?: string): Promise<boolean[]> {
    const params = `ids=${trackIds.join(",")}${accountId ? `&accountId=${accountId}` : ""}`;
    return this.fetch(`/spotify/tracks/saved?${params}`);
  }

  async spotifySaveTrack(trackId: string, accountId?: string): Promise<void> {
    const params = accountId ? `?accountId=${accountId}` : "";
    await this.fetch(`/spotify/tracks/save${params}`, {
      method: "PUT",
      body: JSON.stringify({ trackId }),
    });
  }

  async spotifyUnsaveTrack(trackId: string, accountId?: string): Promise<void> {
    const params = accountId ? `?accountId=${accountId}` : "";
    await this.fetch(`/spotify/tracks/save${params}`, {
      method: "DELETE",
      body: JSON.stringify({ trackId }),
    });
  }

  // Weather

  async getWeatherStatus(): Promise<{ configured: boolean }> {
    const res = await this.fetch<{ success: boolean; configured: boolean }>("/weather/status");
    return { configured: res.configured };
  }

  async getCurrentWeather(): Promise<WeatherData> {
    return this.fetch<WeatherData>("/weather/current");
  }

  async getWeatherForecast(): Promise<WeatherForecast[]> {
    return this.fetch<WeatherForecast[]>("/weather/forecast");
  }

  async getHourlyForecast(): Promise<HourlyForecast[]> {
    return this.fetch<HourlyForecast[]>("/weather/hourly");
  }

  // System Settings

  async getSettingDefinitions(): Promise<SettingCategoryDefinition[]> {
    return this.fetch<SettingCategoryDefinition[]>("/settings/definitions");
  }

  async getAllSettings(): Promise<SystemSetting[]> {
    return this.fetch<SystemSetting[]>("/settings");
  }

  async getCategorySettings(category: string): Promise<SystemSetting[]> {
    return this.fetch<SystemSetting[]>(`/settings/category/${category}`);
  }

  async updateCategorySettings(category: string, settings: Record<string, string | null>): Promise<void> {
    await this.fetch(`/settings/category/${category}`, {
      method: "PUT",
      body: JSON.stringify({ settings }),
    });
  }

  async updateSetting(category: string, key: string, value: string | null): Promise<void> {
    await this.fetch(`/settings/category/${category}/${key}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    });
  }

  async deleteSetting(category: string, key: string): Promise<void> {
    await this.fetch(`/settings/category/${category}/${key}`, {
      method: "DELETE",
    });
  }

  async geocodeAddress(address: string): Promise<{ latitude: string; longitude: string; formattedAddress: string }> {
    return this.fetch<{ latitude: string; longitude: string; formattedAddress: string }>("/settings/geocode", {
      method: "POST",
      body: JSON.stringify({ address }),
    });
  }

  // Handwriting Recognition

  async recognizeHandwriting(imageData: string): Promise<{ text: string; provider: string }> {
    return this.fetch<{ text: string; provider: string }>("/handwriting/recognize", {
      method: "POST",
      body: JSON.stringify({ imageData }),
    });
  }

  async getHandwritingProvider(): Promise<{
    provider: string;
    configured: {
      tesseract: boolean;
      openai: boolean;
      claude: boolean;
      gemini: boolean;
      google_vision: boolean;
    };
  }> {
    return this.fetch("/handwriting/provider");
  }

  async testHandwritingProvider(provider: string): Promise<{ message: string }> {
    return this.fetch<{ message: string }>("/handwriting/test", {
      method: "POST",
      body: JSON.stringify({ provider }),
    });
  }

  // Sports

  async getSportsLeagues(): Promise<SportsLeague[]> {
    return this.fetch<SportsLeague[]>("/sports/leagues");
  }

  async getSportsTeams(sport: string, league: string): Promise<SportsTeam[]> {
    const params = new URLSearchParams({ sport, league });
    return this.fetch<SportsTeam[]>(`/sports/teams?${params}`);
  }

  async getFavoriteTeams(): Promise<FavoriteSportsTeam[]> {
    return this.fetch<FavoriteSportsTeam[]>("/sports/favorites");
  }

  async addFavoriteTeam(team: {
    sport: string;
    league: string;
    teamId: string;
    teamName: string;
    teamAbbreviation: string;
    teamLogo?: string;
    teamColor?: string;
  }): Promise<FavoriteSportsTeam> {
    return this.fetch<FavoriteSportsTeam>("/sports/favorites", {
      method: "POST",
      body: JSON.stringify(team),
    });
  }

  async removeFavoriteTeam(id: string): Promise<void> {
    await this.fetch(`/sports/favorites/${id}`, { method: "DELETE" });
  }

  async updateFavoriteTeam(
    id: string,
    data: { isVisible?: boolean; showOnDashboard?: boolean }
  ): Promise<FavoriteSportsTeam> {
    return this.fetch<FavoriteSportsTeam>(`/sports/favorites/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async getSportsGames(params?: {
    date?: string;
    teamIds?: string[];
    sport?: string;
    league?: string;
  }): Promise<SportsGame[]> {
    const searchParams = new URLSearchParams();
    if (params?.date) searchParams.set("date", params.date);
    if (params?.teamIds?.length) searchParams.set("teamIds", params.teamIds.join(","));
    if (params?.sport) searchParams.set("sport", params.sport);
    if (params?.league) searchParams.set("league", params.league);
    return this.fetch<SportsGame[]>(`/sports/games?${searchParams}`);
  }

  async getLiveSportsGames(): Promise<SportsGame[]> {
    return this.fetch<SportsGame[]>("/sports/live");
  }

  async getTodaySportsScores(): Promise<SportsGame[]> {
    return this.fetch<SportsGame[]>("/sports/scores/today");
  }

  async getSportsEvents(start: Date, end: Date, teamIds?: string[]): Promise<CalendarEvent[]> {
    const params = new URLSearchParams({
      start: start.toISOString(),
      end: end.toISOString(),
    });
    if (teamIds?.length) {
      params.set("teamIds", teamIds.join(","));
    }
    return this.fetch<CalendarEvent[]>(`/sports/events?${params}`);
  }

  // Automations

  async parseAutomation(prompt: string): Promise<AutomationParseResult> {
    return this.fetch<AutomationParseResult>("/automations/parse", {
      method: "POST",
      body: JSON.stringify({ prompt }),
    });
  }

  async getAutomations(): Promise<Automation[]> {
    return this.fetch<Automation[]>("/automations");
  }

  async createAutomation(data: {
    name: string;
    description?: string;
    triggerType: AutomationTriggerType;
    triggerConfig: AutomationTriggerConfig;
    actionType: AutomationActionType;
    actionConfig: AutomationActionConfig;
  }): Promise<Automation> {
    return this.fetch<Automation>("/automations", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateAutomation(
    id: string,
    data: Partial<{
      name: string;
      description: string;
      enabled: boolean;
      triggerType: AutomationTriggerType;
      triggerConfig: AutomationTriggerConfig;
      actionType: AutomationActionType;
      actionConfig: AutomationActionConfig;
    }>
  ): Promise<Automation> {
    return this.fetch<Automation>(`/automations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteAutomation(id: string): Promise<void> {
    await this.fetch(`/automations/${id}`, { method: "DELETE" });
  }

  async testAutomation(id: string): Promise<{ executed: boolean }> {
    return this.fetch<{ executed: boolean }>(`/automations/${id}/test`, {
      method: "POST",
    });
  }

  async getAutomationNotifications(): Promise<AutomationNotification[]> {
    return this.fetch<AutomationNotification[]>("/automations/notifications");
  }

  async dismissAutomationNotification(notificationId: string): Promise<void> {
    await this.fetch(`/automations/notifications/${notificationId}`, {
      method: "DELETE",
    });
  }

  async clearAutomationNotifications(): Promise<void> {
    await this.fetch("/automations/notifications", { method: "DELETE" });
  }

  // News

  async getNewsPresets(): Promise<PresetFeed[]> {
    return this.fetch<PresetFeed[]>("/news/presets");
  }

  async getNewsFeeds(): Promise<NewsFeed[]> {
    return this.fetch<NewsFeed[]>("/news/feeds");
  }

  async addNewsFeed(data: {
    name: string;
    feedUrl: string;
    category?: string;
  }): Promise<NewsFeed> {
    return this.fetch<NewsFeed>("/news/feeds", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateNewsFeed(
    id: string,
    data: Partial<{
      name: string;
      category: string;
      isActive: boolean;
    }>
  ): Promise<NewsFeed> {
    return this.fetch<NewsFeed>(`/news/feeds/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteNewsFeed(id: string): Promise<void> {
    await this.fetch(`/news/feeds/${id}`, { method: "DELETE" });
  }

  async getNewsArticles(params?: {
    feedId?: string;
    limit?: number;
    offset?: number;
  }): Promise<NewsArticle[]> {
    const searchParams = new URLSearchParams();
    if (params?.feedId) searchParams.set("feedId", params.feedId);
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.offset) searchParams.set("offset", String(params.offset));
    return this.fetch<NewsArticle[]>(`/news/articles?${searchParams}`);
  }

  async getNewsHeadlines(limit?: number): Promise<NewsHeadline[]> {
    const params = limit ? `?limit=${limit}` : "";
    return this.fetch<NewsHeadline[]>(`/news/headlines${params}`);
  }

  async refreshNewsFeeds(): Promise<void> {
    await this.fetch("/news/refresh", { method: "POST" });
  }

  async validateNewsFeedUrl(feedUrl: string): Promise<{
    valid: boolean;
    title?: string;
    error?: string;
  }> {
    return this.fetch("/news/validate", {
      method: "POST",
      body: JSON.stringify({ feedUrl }),
    });
  }

  // reMarkable

  async connectRemarkable(code: string): Promise<{ connected: boolean; message: string }> {
    return this.fetch("/remarkable/connect", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  }

  async getRemarkableStatus(): Promise<{
    connected: boolean;
    lastSyncAt: string | null;
    agendaSettings: RemarkableAgendaSettings | null;
  }> {
    return this.fetch("/remarkable/status");
  }

  async disconnectRemarkable(): Promise<{ message: string }> {
    return this.fetch("/remarkable/disconnect", { method: "POST" });
  }

  async testRemarkableConnection(): Promise<{ connected: boolean; message: string }> {
    return this.fetch("/remarkable/test", { method: "POST" });
  }

  async pushRemarkableAgenda(date?: string): Promise<{
    documentId: string;
    filename: string;
    eventCount: number;
    message: string;
  }> {
    return this.fetch("/remarkable/push-agenda", {
      method: "POST",
      body: JSON.stringify({ date }),
    });
  }

  getRemarkableAgendaPreviewUrl(date?: string): string {
    const params = date ? `?date=${date}` : "";
    return `${API_BASE}/remarkable/agenda/preview${params}`;
  }

  async updateRemarkableSettings(settings: Partial<RemarkableAgendaSettings>): Promise<RemarkableAgendaSettings> {
    return this.fetch("/remarkable/settings", {
      method: "PATCH",
      body: JSON.stringify(settings),
    });
  }

  async getRemarkableNotes(includeProcessed = false): Promise<RemarkableNote[]> {
    const params = includeProcessed ? "?includeProcessed=true" : "";
    return this.fetch(`/remarkable/notes${params}`);
  }

  async processRemarkableNote(
    noteId: string,
    options?: { calendarId?: string; targetDate?: string; autoCreate?: boolean }
  ): Promise<{
    documentId: string;
    documentName: string;
    recognizedText: string;
    events: RemarkableParsedEvent[];
    createdCount: number;
  }> {
    return this.fetch(`/remarkable/notes/${noteId}/process`, {
      method: "POST",
      body: JSON.stringify(options ?? {}),
    });
  }

  async processAllRemarkableNotes(options?: {
    calendarId?: string;
    autoCreate?: boolean;
  }): Promise<{
    processedCount: number;
    totalEventsCreated: number;
    results: Array<{
      documentId: string;
      documentName: string;
      createdCount: number;
      success: boolean;
      error?: string;
    }>;
  }> {
    return this.fetch("/remarkable/notes/process-all", {
      method: "POST",
      body: JSON.stringify(options ?? {}),
    });
  }

  async syncRemarkable(): Promise<{
    added: number;
    updated: number;
    removed: number;
    message: string;
  }> {
    return this.fetch("/remarkable/sync", { method: "POST" });
  }
}

// Spotify account type
export interface SpotifyAccount {
  id: string;
  accountName: string | null;
  externalAccountId: string | null;
  isPrimary: boolean;
  icon: string | null;
  defaultDeviceId: string | null;
  favoriteDeviceIds: string[] | null;
  spotifyUser?: {
    id: string;
    display_name: string;
    images: { url: string }[];
  };
}

// Weather types
export interface WeatherData {
  temp: number;
  feels_like: number;
  temp_min: number;
  temp_max: number;
  humidity: number;
  description: string;
  icon: string;
  wind_speed: number;
  city: string;
}

export interface WeatherForecast {
  date: string;
  temp_min: number;
  temp_max: number;
  description: string;
  icon: string;
}

export interface HourlyForecast {
  time: string;
  temp: number;
  description: string;
  icon: string;
  humidity: number;
  wind_speed: number;
  pop: number; // Probability of precipitation (0-100%)
  rain?: number; // Rain volume in mm
  snow?: number; // Snow volume in mm
}

// Home Assistant Camera type (enabled cameras with settings)
export interface HACamera {
  id: string;
  entityId: string;
  name: string;
  isStreaming: boolean;
  state: string;
  attributes: Record<string, unknown>;
  refreshInterval: number;
  aspectRatio: "16:9" | "4:3" | "1:1";
}

// Available HA camera (for picker)
export interface HAAvailableCamera {
  entityId: string;
  name: string;
  isEnabled: boolean;
  state: string;
}

// HA Location (device_tracker or person entity)
export interface HALocation {
  entityId: string;
  name: string;
  latitude: number;
  longitude: number;
  state: string; // home, not_home, zone name, etc.
  icon?: string;
  entityPictureUrl?: string;
  gpsAccuracy?: number;
  lastUpdated: string;
  source?: string;
  batteryLevel?: number;
}

// HA Zone
export interface HAZone {
  entityId: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  icon?: string;
  isPassive?: boolean;
}

// HA Entity Timer
export interface HAEntityTimer {
  id: string;
  userId: string;
  entityId: string;
  action: "turn_on" | "turn_off";
  triggerAt: string;
  fadeEnabled: boolean;
  fadeDuration: number;
  createdAt: string;
}

// System Settings types
export interface SettingDefinition {
  key: string;
  label: string;
  description?: string;
  isSecret: boolean;
  placeholder?: string;
}

export interface SettingCategoryDefinition {
  category: string;
  label: string;
  description: string;
  settings: SettingDefinition[];
}

export interface SystemSetting {
  id: string;
  category: string;
  key: string;
  value: string | null;
  isSecret: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

// reMarkable types
export interface RemarkableAgendaSettings {
  enabled: boolean;
  pushTime: string;
  folderPath: string;
  includeCalendarIds: string[] | null;
  showLocation: boolean;
  showDescription: boolean;
  notesLines: number;
  templateStyle: string;
  lastPushAt: string | null;
}

export interface RemarkableNote {
  id: string;
  documentId: string;
  name: string;
  type: string;
  folderPath: string | null;
  isProcessed: boolean;
  processedAt: string | null;
  lastModifiedAt: string | null;
  recognizedText: string | null;
}

export interface RemarkableParsedEvent {
  title: string;
  startTime: string | null;
  endTime: string | null;
  isAllDay: boolean;
  created: boolean;
  eventId?: string;
  error?: string;
}

// Capacities

  async connectCapacities(apiToken: string): Promise<{
    connected: boolean;
    message: string;
    spaces: CapacitiesSpaceInfo[];
  }> {
    return this.fetch("/capacities/connect", {
      method: "POST",
      body: JSON.stringify({ apiToken }),
    });
  }

  async disconnectCapacities(): Promise<{ message: string }> {
    return this.fetch("/capacities/disconnect", { method: "DELETE" });
  }

  async getCapacitiesStatus(): Promise<CapacitiesStatus> {
    return this.fetch("/capacities/status");
  }

  async testCapacitiesConnection(): Promise<{ connected: boolean; message: string }> {
    return this.fetch("/capacities/test", { method: "POST" });
  }

  async getCapacitiesSpaces(): Promise<CapacitiesSpaceInfo[]> {
    return this.fetch("/capacities/spaces");
  }

  async setCapacitiesDefaultSpace(spaceId: string): Promise<{ message: string }> {
    return this.fetch(`/capacities/spaces/${spaceId}`, {
      method: "PATCH",
      body: JSON.stringify({ isDefault: true }),
    });
  }

  async getCapacitiesSpaceInfo(spaceId: string): Promise<{
    id: string;
    title: string;
    structures: Array<{ id: string; pluralName: string; icon?: string }>;
  }> {
    return this.fetch(`/capacities/spaces/${spaceId}/info`);
  }

  async searchCapacities(
    spaceId: string,
    searchTerm: string,
    structureId?: string
  ): Promise<Array<{ id: string; structureId: string; title: string }>> {
    return this.fetch("/capacities/search", {
      method: "POST",
      body: JSON.stringify({ spaceId, searchTerm, structureId }),
    });
  }

  async saveToCapacitiesDailyNote(data: {
    spaceId?: string;
    mdText: string;
    noTimeStamp?: boolean;
  }): Promise<{ message: string }> {
    return this.fetch("/capacities/daily-note", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async saveCapacitiesWeblink(data: {
    spaceId?: string;
    url: string;
    title?: string;
    mdText?: string;
    tags?: string[];
  }): Promise<{ id: string; title: string; structureId: string }> {
    return this.fetch("/capacities/weblink", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Telegram

  async connectTelegram(botToken: string): Promise<{
    connected: boolean;
    message: string;
    bot: { username: string; firstName: string };
  }> {
    return this.fetch("/telegram/connect", {
      method: "POST",
      body: JSON.stringify({ botToken }),
    });
  }

  async disconnectTelegram(): Promise<{ message: string }> {
    return this.fetch("/telegram/disconnect", { method: "DELETE" });
  }

  async getTelegramStatus(): Promise<TelegramStatus> {
    return this.fetch("/telegram/status");
  }

  async testTelegramConnection(): Promise<{ connected: boolean; message: string }> {
    return this.fetch("/telegram/test", { method: "POST" });
  }

  async getTelegramChats(): Promise<TelegramChatInfo[]> {
    return this.fetch("/telegram/chats");
  }

  async unlinkTelegramChat(chatId: string): Promise<{ message: string }> {
    return this.fetch(`/telegram/chats/${chatId}`, { method: "DELETE" });
  }

  async updateTelegramSettings(settings: {
    dailyAgendaEnabled?: boolean;
    dailyAgendaTime?: string;
    eventRemindersEnabled?: boolean;
    eventReminderMinutes?: number;
  }): Promise<{ message: string }> {
    return this.fetch("/telegram/settings", {
      method: "PATCH",
      body: JSON.stringify(settings),
    });
  }

  async sendTelegramMessage(
    message: string,
    chatId?: string
  ): Promise<{ sent: number; failed: number }> {
    return this.fetch("/telegram/send", {
      method: "POST",
      body: JSON.stringify({ message, chatId }),
    });
  }

  async getTelegramLinkCode(): Promise<{
    botUsername: string;
    startLink: string;
    message: string;
  }> {
    return this.fetch("/telegram/link-code");
  }

  async setupTelegramWebhook(webhookUrl: string): Promise<{
    message: string;
    webhookUrl: string;
  }> {
    return this.fetch("/telegram/webhook/setup", {
      method: "POST",
      body: JSON.stringify({ webhookUrl }),
    });
  }

  async getTelegramWebhookInfo(): Promise<TelegramWebhookInfo> {
    return this.fetch("/telegram/webhook/info");
  }

  async deleteTelegramWebhook(): Promise<{ message: string }> {
    return this.fetch("/telegram/webhook", { method: "DELETE" });
  }
}

// Capacities types
export interface CapacitiesSpaceInfo {
  id: string;
  title: string;
  icon?: string;
  isDefault?: boolean;
}

export interface CapacitiesStatus {
  connected: boolean;
  defaultSpaceId: string | null;
  lastSyncAt: string | null;
  spaces: CapacitiesSpaceInfo[];
}

// Telegram types
export interface TelegramChatInfo {
  id: string;
  chatId: string;
  chatType: "private" | "group" | "supergroup" | "channel";
  name: string;
  username: string | null;
  isActive: boolean;
  linkedAt: string;
  lastMessageAt: string | null;
}

export interface TelegramSettings {
  dailyAgendaEnabled: boolean;
  dailyAgendaTime: string;
  eventRemindersEnabled: boolean;
  eventReminderMinutes: number;
}

export interface TelegramStatus {
  connected: boolean;
  botUsername: string | null;
  settings: TelegramSettings;
  chats: TelegramChatInfo[];
}

export interface TelegramWebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
}

export const api = new ApiClient();
