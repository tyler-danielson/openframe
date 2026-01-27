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
} from "@openframe/shared";

const API_BASE = "/api/v1";

class ApiClient {
  private async fetch<T>(
    path: string,
    options: RequestInit = {},
    skipAuth = false
  ): Promise<T> {
    const { accessToken, refreshToken, setTokens, logout, kioskEnabled } =
      useAuthStore.getState();

    const headers: HeadersInit = {
      ...options.headers,
    };

    // Only set Content-Type for requests with a body
    if (options.body) {
      (headers as Record<string, string>)["Content-Type"] = "application/json";
    }

    // Only add auth header if not in kiosk mode without auth, or if we have a token
    if (accessToken && !skipAuth) {
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
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message ?? "Request failed");
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
    data: Partial<Pick<Calendar, "color" | "isVisible" | "syncEnabled" | "isPrimary">>
  ): Promise<Calendar> {
    return this.fetch<Calendar>(`/calendars/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
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

  async deleteCamera(id: string): Promise<void> {
    await this.fetch(`/cameras/${id}`, { method: "DELETE" });
  }

  getCameraSnapshotUrl(id: string): string {
    return `${API_BASE}/cameras/${id}/snapshot`;
  }

  getCameraStreamUrl(id: string): string {
    return `${API_BASE}/cameras/${id}/stream`;
  }

  // Home Assistant
  async getHomeAssistantConfig(): Promise<HomeAssistantConfig | null> {
    return this.fetch<HomeAssistantConfig | null>("/homeassistant/config");
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

  async getHomeAssistantEntities(): Promise<HomeAssistantEntity[]> {
    return this.fetch<HomeAssistantEntity[]>("/homeassistant/entities");
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
}

export const api = new ApiClient();
