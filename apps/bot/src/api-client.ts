interface TodayResponse {
  date: string;
  events: Array<{
    title: string;
    time: string;
    calendar: string;
    location?: string;
  }>;
  summary: string;
}

interface UpcomingResponse {
  startDate: string;
  endDate: string;
  days: Array<{
    date: string;
    dayName: string;
    events: Array<{
      title: string;
      time: string;
      calendar: string;
      location?: string;
    }>;
  }>;
}

interface QuickEventResponse {
  id: string;
  title: string;
  date: string;
  time: string;
  calendar: string;
}

interface AddEventInput {
  title: string;
  date: string;
  time?: string;
  duration?: number;
}

export class ApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}/api/v1${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(error.error?.message ?? "API request failed");
    }

    const result = await response.json() as { data: T };
    return result.data;
  }

  async getToday(): Promise<TodayResponse> {
    return this.fetch<TodayResponse>("/bot/today");
  }

  async getUpcoming(days = 7): Promise<UpcomingResponse> {
    return this.fetch<UpcomingResponse>(`/bot/upcoming?days=${days}`);
  }

  async createQuickEvent(text: string): Promise<QuickEventResponse> {
    return this.fetch<QuickEventResponse>("/events/quick", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  }

  async addEvent(input: AddEventInput): Promise<QuickEventResponse> {
    return this.fetch<QuickEventResponse>("/bot/add-event", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
}
