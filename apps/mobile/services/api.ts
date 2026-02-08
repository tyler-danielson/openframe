import { useAuthStore } from "../stores/auth";
import type {
  Calendar,
  CalendarEvent,
  User,
  Task,
  TaskList,
} from "@openframe/shared";

// Types for API responses
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
  private getApiBase(): string {
    const { serverUrl } = useAuthStore.getState();
    if (!serverUrl) {
      throw new Error("Server URL not configured");
    }
    return `${serverUrl.replace(/\/$/, "")}/api/v1`;
  }

  private async fetch<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const { apiKey } = useAuthStore.getState();
    const apiBase = this.getApiBase();

    const headers: HeadersInit = {
      ...options.headers,
    };

    // Set Content-Type for requests with a body
    if (options.body) {
      (headers as Record<string, string>)["Content-Type"] = "application/json";
    }

    // Use API key for authentication
    if (apiKey) {
      (headers as Record<string, string>)["x-api-key"] = apiKey;
    }

    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        typeof errorData.error === "string"
          ? errorData.error
          : errorData.error?.message ?? "Request failed";
      throw new Error(errorMessage);
    }

    const result = await response.json();
    return result.data ?? result;
  }

  // Auth
  async validateApiKey(): Promise<User> {
    return this.fetch<User>("/auth/me");
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

  // Kiosk
  async refreshKiosk(): Promise<void> {
    await this.fetch("/auth/kiosk/refresh", { method: "POST", body: JSON.stringify({}) });
  }
}

export const api = new ApiClient();
