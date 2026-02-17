/**
 * Plex Media Server API Client
 */

export interface PlexClientConfig {
  serverUrl: string;
  accessToken: string;
}

export interface PlexLibrary {
  key: string;
  title: string;
  type: string;
  thumb?: string;
  count?: number;
}

export interface PlexItem {
  ratingKey: string;
  title: string;
  type: string;
  year?: number;
  thumb?: string;
  art?: string;
  duration?: number;
  summary?: string;
  grandparentTitle?: string;
  parentTitle?: string;
}

export class PlexClient {
  private serverUrl: string;
  private accessToken: string;

  constructor(config: PlexClientConfig) {
    this.serverUrl = config.serverUrl.replace(/\/+$/, "");
    this.accessToken = config.accessToken;
  }

  private get headers(): Record<string, string> {
    return {
      "X-Plex-Token": this.accessToken,
      Accept: "application/json",
    };
  }

  private async fetchJson(path: string): Promise<unknown> {
    const url = `${this.serverUrl}${path}`;
    const separator = path.includes("?") ? "&" : "?";
    const response = await fetch(`${url}${separator}X-Plex-Token=${this.accessToken}`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Plex API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async authenticate(): Promise<string> {
    const data = (await this.fetchJson("/")) as {
      MediaContainer?: { machineIdentifier?: string };
    };

    const machineId = data?.MediaContainer?.machineIdentifier;
    if (!machineId) {
      throw new Error("Failed to authenticate: invalid server response");
    }

    return machineId;
  }

  async getLibraries(): Promise<PlexLibrary[]> {
    const data = (await this.fetchJson("/library/sections")) as {
      MediaContainer?: {
        Directory?: Array<{
          key: string;
          title: string;
          type: string;
          thumb?: string;
          count?: number;
        }>;
      };
    };

    return (data?.MediaContainer?.Directory || []).map((dir) => ({
      key: dir.key,
      title: dir.title,
      type: dir.type,
      thumb: dir.thumb,
      count: dir.count,
    }));
  }

  async getLibraryContents(
    sectionKey: string,
    options?: { search?: string; start?: number; size?: number }
  ): Promise<PlexItem[]> {
    let path = `/library/sections/${sectionKey}/all`;
    const params = new URLSearchParams();

    if (options?.search) {
      path = `/library/sections/${sectionKey}/search`;
      params.set("query", options.search);
    }
    if (options?.start !== undefined) params.set("X-Plex-Container-Start", options.start.toString());
    if (options?.size !== undefined) params.set("X-Plex-Container-Size", options.size.toString());

    const paramStr = params.toString();
    const fullPath = paramStr ? `${path}?${paramStr}` : path;

    const data = (await this.fetchJson(fullPath)) as {
      MediaContainer?: {
        Metadata?: Array<{
          ratingKey: string;
          title: string;
          type: string;
          year?: number;
          thumb?: string;
          art?: string;
          duration?: number;
          summary?: string;
          grandparentTitle?: string;
          parentTitle?: string;
        }>;
      };
    };

    return (data?.MediaContainer?.Metadata || []).map((item) => ({
      ratingKey: item.ratingKey,
      title: item.title,
      type: item.type,
      year: item.year,
      thumb: item.thumb,
      art: item.art,
      duration: item.duration,
      summary: item.summary,
      grandparentTitle: item.grandparentTitle,
      parentTitle: item.parentTitle,
    }));
  }

  async getItem(ratingKey: string): Promise<PlexItem | null> {
    const data = (await this.fetchJson(`/library/metadata/${ratingKey}`)) as {
      MediaContainer?: {
        Metadata?: Array<{
          ratingKey: string;
          title: string;
          type: string;
          year?: number;
          thumb?: string;
          art?: string;
          duration?: number;
          summary?: string;
          grandparentTitle?: string;
          parentTitle?: string;
        }>;
      };
    };

    const item = data?.MediaContainer?.Metadata?.[0];
    if (!item) return null;

    return {
      ratingKey: item.ratingKey,
      title: item.title,
      type: item.type,
      year: item.year,
      thumb: item.thumb,
      art: item.art,
      duration: item.duration,
      summary: item.summary,
      grandparentTitle: item.grandparentTitle,
      parentTitle: item.parentTitle,
    };
  }

  async search(query: string): Promise<PlexItem[]> {
    const data = (await this.fetchJson(`/search?query=${encodeURIComponent(query)}`)) as {
      MediaContainer?: {
        Metadata?: Array<{
          ratingKey: string;
          title: string;
          type: string;
          year?: number;
          thumb?: string;
          art?: string;
          duration?: number;
          summary?: string;
          grandparentTitle?: string;
          parentTitle?: string;
        }>;
      };
    };

    return (data?.MediaContainer?.Metadata || []).map((item) => ({
      ratingKey: item.ratingKey,
      title: item.title,
      type: item.type,
      year: item.year,
      thumb: item.thumb,
      art: item.art,
      duration: item.duration,
      summary: item.summary,
      grandparentTitle: item.grandparentTitle,
      parentTitle: item.parentTitle,
    }));
  }

  getThumbUrl(thumbPath: string): string {
    if (!thumbPath) return "";
    return `${this.serverUrl}${thumbPath}?X-Plex-Token=${this.accessToken}`;
  }

  getWebPlayerUrl(ratingKey: string, machineId: string): string {
    return `${this.serverUrl}/web/index.html#!/server/${machineId}/details?key=${encodeURIComponent(`/library/metadata/${ratingKey}`)}`;
  }
}
