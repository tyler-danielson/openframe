import { useAuthStore } from "../stores/auth";
import type {
  Calendar,
  CalendarEvent,
  User,
  Task,
  TaskList,
  PhotoAlbum,
  Photo,
} from "@openframe/shared";

// Types for API responses
export interface Kiosk {
  id: string;
  name: string;
  isActive: boolean;
  displayMode: "full" | "screensaver-only" | "calendar-only" | "dashboard-only";
  displayType: "touch" | "tv" | "display";
  colorScheme: string;
  homePage: string | null;
  enabledFeatures: Record<string, boolean>;
  dashboards: KioskDashboard[];
  screensaverEnabled: boolean;
  lastAccessedAt: string | null;
  createdAt: string;
}

export interface KioskDashboard {
  id: string;
  type: string;
  name: string;
  icon: string;
  pinned: boolean;
  config: Record<string, unknown>;
}

export interface WidgetState {
  widgetId: string;
  widgetType: string;
  state: Record<string, unknown>;
  updatedAt: number;
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
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

class ApiClient {
  // Mutex for token refresh to prevent race conditions
  private refreshPromise: Promise<boolean> | null = null;

  private getApiBase(): string {
    const { serverUrl } = useAuthStore.getState();
    if (!serverUrl) {
      throw new Error("Server URL not configured");
    }
    return `${serverUrl.replace(/\/$/, "")}/api/v1`;
  }

  private getAuthBase(): string {
    const { serverUrl } = useAuthStore.getState();
    if (!serverUrl) {
      throw new Error("Server URL not configured");
    }
    return `${serverUrl.replace(/\/$/, "")}`;
  }

  private async refreshTokens(): Promise<boolean> {
    const { refreshToken, setTokens, logout } = useAuthStore.getState();

    if (!refreshToken) {
      return false;
    }

    try {
      const apiBase = this.getApiBase();
      const refreshResponse = await fetch(`${apiBase}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        setTokens(data.data.accessToken, data.data.refreshToken);
        return true;
      } else {
        logout();
        return false;
      }
    } catch {
      logout();
      return false;
    }
  }

  private async ensureValidTokens(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.refreshTokens().finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  private async fetch<T>(
    path: string,
    options: RequestInit = {},
    skipAuth = false
  ): Promise<T> {
    const { accessToken, refreshToken, authMethod, apiKey } =
      useAuthStore.getState();
    const apiBase = this.getApiBase();

    const headers: HeadersInit = {
      ...options.headers,
    };

    // Set Content-Type for requests with a body
    if (options.body) {
      (headers as Record<string, string>)["Content-Type"] = "application/json";
    }

    // Dual-mode auth: Bearer token or API key
    if (!skipAuth) {
      if (authMethod === "token" && accessToken) {
        (headers as Record<string, string>)["Authorization"] =
          `Bearer ${accessToken}`;
      } else if (apiKey) {
        (headers as Record<string, string>)["x-api-key"] = apiKey;
      }
    }

    let response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers,
    });

    // Handle token refresh on 401 when using token auth
    if (
      response.status === 401 &&
      authMethod === "token" &&
      refreshToken &&
      !skipAuth
    ) {
      const refreshed = await this.ensureValidTokens();

      if (refreshed) {
        const { accessToken: newAccessToken } = useAuthStore.getState();
        (headers as Record<string, string>)["Authorization"] =
          `Bearer ${newAccessToken}`;
        response = await fetch(`${apiBase}${path}`, {
          ...options,
          headers,
        });
      } else {
        throw new Error("Session expired");
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // Handle Fastify error format { message, error, statusCode } and
      // custom formats { error: "message" } / { error: { message } }
      const errorMessage =
        errorData.message ??
        (typeof errorData.error === "string"
          ? errorData.error
          : errorData.error?.message) ??
        "Request failed";
      throw new Error(errorMessage);
    }

    const result = await response.json();
    return result.data ?? result;
  }

  // Auth
  async validateApiKey(): Promise<User> {
    return this.fetch<User>("/auth/me");
  }

  async login(
    serverUrl: string,
    email: string,
    password: string
  ): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    const base = `${serverUrl.replace(/\/$/, "")}/api/v1`;
    const response = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message ??
        (typeof errorData.error === "string"
          ? errorData.error
          : errorData.error?.message) ??
        "Login failed";
      throw new Error(errorMessage);
    }

    const result = await response.json();
    const data = result.data ?? result;
    return {
      user: data.user,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    };
  }

  async fetchCurrentUser(): Promise<User> {
    const user = await this.fetch<User>("/auth/me");
    useAuthStore.getState().setUser(user);
    return user;
  }

  getOAuthUrl(provider: "google" | "microsoft"): string {
    const base = this.getAuthBase();
    return `${base}/api/v1/auth/oauth/${provider}`;
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
    data: Partial<Pick<Calendar, "color" | "isVisible" | "syncEnabled" | "isPrimary" | "isFavorite" | "showOnDashboard">>
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

  async getEvent(id: string): Promise<CalendarEvent> {
    return this.fetch<CalendarEvent>(`/events/${id}`);
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
      body: JSON.stringify({
        ...data,
        startTime: data.startTime.toISOString(),
        endTime: data.endTime.toISOString(),
      }),
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
    data: Partial<{
      title: string;
      description: string | null;
      location: string | null;
      startTime: Date;
      endTime: Date;
      isAllDay: boolean;
    }>
  ): Promise<CalendarEvent> {
    const body: Record<string, unknown> = { ...data };
    if (data.startTime) body.startTime = data.startTime.toISOString();
    if (data.endTime) body.endTime = data.endTime.toISOString();

    return this.fetch<CalendarEvent>(`/events/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
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
      body: JSON.stringify({
        ...data,
        dueDate: data.dueDate?.toISOString(),
      }),
    });
  }

  async completeTask(id: string): Promise<Task> {
    return this.fetch<Task>(`/tasks/${id}/complete`, { method: "POST" });
  }

  // Settings
  async getSettingDefinitions(): Promise<SettingCategoryDefinition[]> {
    return this.fetch<SettingCategoryDefinition[]>("/settings/definitions");
  }

  async getAllSettings(): Promise<SystemSetting[]> {
    return this.fetch<SystemSetting[]>("/settings");
  }

  async getCategorySettings(category: string): Promise<SystemSetting[]> {
    return this.fetch<SystemSetting[]>(`/settings/category/${category}`);
  }

  async updateSetting(category: string, key: string, value: string | null): Promise<void> {
    await this.fetch(`/settings/category/${category}/${key}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    });
  }

  // Kiosks
  async getKiosks(): Promise<Kiosk[]> {
    return this.fetch<Kiosk[]>("/kiosks");
  }

  async getKiosk(id: string): Promise<Kiosk> {
    return this.fetch<Kiosk>(`/kiosks/${id}`);
  }

  async refreshKiosk(): Promise<void> {
    await this.fetch("/auth/kiosk/refresh", { method: "POST", body: JSON.stringify({}) });
  }

  async sendKioskCommand(
    kioskId: string,
    type: string,
    payload?: Record<string, unknown>
  ): Promise<void> {
    await this.fetch(`/kiosks/${kioskId}/command`, {
      method: "POST",
      body: JSON.stringify({ type, payload }),
    });
  }

  async sendKioskRefresh(kioskId: string): Promise<void> {
    await this.fetch(`/kiosks/${kioskId}/refresh`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  }

  async getKioskWidgetState(kioskId: string): Promise<WidgetState[]> {
    return this.fetch<WidgetState[]>(`/kiosks/${kioskId}/widget-state`);
  }

  async companionPing(kioskId: string): Promise<void> {
    await this.fetch(`/kiosks/${kioskId}/companion-ping`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  }

  // Photo Albums
  async getAlbums(): Promise<PhotoAlbum[]> {
    return this.fetch<PhotoAlbum[]>("/photos/albums");
  }

  async createAlbum(data: { name: string; description?: string }): Promise<PhotoAlbum> {
    return this.fetch<PhotoAlbum>("/photos/albums", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async deleteAlbum(id: string): Promise<void> {
    await this.fetch(`/photos/albums/${id}`, { method: "DELETE" });
  }

  async getAlbumPhotos(albumId: string): Promise<Photo[]> {
    return this.fetch<Photo[]>(`/photos/albums/${albumId}/photos`);
  }

  async uploadPhoto(albumId: string, uri: string, filename: string, mimeType: string): Promise<Photo> {
    const { accessToken, authMethod, apiKey } = useAuthStore.getState();
    const apiBase = this.getApiBase();

    const formData = new FormData();
    formData.append("photo", {
      uri,
      name: filename,
      type: mimeType,
    } as any);

    const headers: Record<string, string> = {};
    if (authMethod === "token" && accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    } else if (apiKey) {
      headers["x-api-key"] = apiKey;
    }

    const response = await fetch(`${apiBase}/photos/albums/${albumId}/photos`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message ?? "Upload failed");
    }

    const result = await response.json();
    return result.data ?? result;
  }

  async deletePhoto(id: string): Promise<void> {
    await this.fetch(`/photos/${id}`, { method: "DELETE" });
  }

  getPhotoUrl(path: string | null | undefined): string | null {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    const { serverUrl, accessToken, apiKey, authMethod } = useAuthStore.getState();
    const base = serverUrl?.replace(/\/$/, "") ?? "";
    // Path from API already starts with /api/v1/photos/files/...
    const fullPath = path.startsWith("/") ? path : `/api/v1/photos/files/${path}`;
    const sep = fullPath.includes("?") ? "&" : "?";
    if (authMethod === "token" && accessToken) {
      return `${base}${fullPath}${sep}token=${encodeURIComponent(accessToken)}`;
    }
    if (apiKey) {
      return `${base}${fullPath}${sep}apiKey=${encodeURIComponent(apiKey)}`;
    }
    return `${base}${fullPath}`;
  }
}

export const api = new ApiClient();
