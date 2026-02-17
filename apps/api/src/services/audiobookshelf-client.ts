/**
 * Audiobookshelf API Client
 */

export interface AudiobookshelfClientConfig {
  serverUrl: string;
  accessToken: string;
}

export interface AudiobookshelfLibrary {
  id: string;
  name: string;
  mediaType: string;
  folders: string[];
}

export interface AudiobookshelfItem {
  id: string;
  title: string;
  authorName?: string;
  duration?: number;
  coverUrl?: string;
  description?: string;
  progress?: number;
}

export class AudiobookshelfClient {
  private serverUrl: string;
  private accessToken: string;

  constructor(config: AudiobookshelfClientConfig) {
    this.serverUrl = config.serverUrl.replace(/\/+$/, "");
    this.accessToken = config.accessToken;
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
    };
  }

  private async fetchJson(path: string, options?: RequestInit): Promise<unknown> {
    const response = await fetch(`${this.serverUrl}${path}`, {
      ...options,
      headers: { ...this.headers, ...options?.headers },
    });

    if (!response.ok) {
      throw new Error(`Audiobookshelf API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async authenticate(): Promise<{ userId: string; username: string }> {
    const data = (await this.fetchJson("/api/authorize", { method: "POST" })) as {
      user?: { id: string; username: string };
    };

    if (!data?.user) {
      throw new Error("Failed to authenticate: invalid token");
    }

    return { userId: data.user.id, username: data.user.username };
  }

  async getLibraries(): Promise<AudiobookshelfLibrary[]> {
    const data = (await this.fetchJson("/api/libraries")) as {
      libraries?: Array<{
        id: string;
        name: string;
        mediaType: string;
        folders?: Array<{ fullPath: string }>;
      }>;
    };

    return (data?.libraries || []).map((lib) => ({
      id: lib.id,
      name: lib.name,
      mediaType: lib.mediaType,
      folders: (lib.folders || []).map((f) => f.fullPath),
    }));
  }

  async getLibraryItems(
    libraryId: string,
    options?: { search?: string; limit?: number; page?: number }
  ): Promise<AudiobookshelfItem[]> {
    let path: string;

    if (options?.search) {
      path = `/api/libraries/${libraryId}/search?q=${encodeURIComponent(options.search)}&limit=${options?.limit || 50}`;
      const data = (await this.fetchJson(path)) as {
        book?: Array<{ libraryItem: { id: string; media: { metadata: { title: string; authorName?: string; description?: string }; duration?: number }; } }>;
        podcast?: Array<{ libraryItem: { id: string; media: { metadata: { title: string; author?: string; description?: string }; duration?: number }; } }>;
      };

      const books = (data?.book || []).map((b) => ({
        id: b.libraryItem.id,
        title: b.libraryItem.media.metadata.title,
        authorName: b.libraryItem.media.metadata.authorName,
        duration: b.libraryItem.media.duration,
        coverUrl: `${this.serverUrl}/api/items/${b.libraryItem.id}/cover`,
        description: b.libraryItem.media.metadata.description,
      }));

      const podcasts = (data?.podcast || []).map((p) => ({
        id: p.libraryItem.id,
        title: p.libraryItem.media.metadata.title,
        authorName: p.libraryItem.media.metadata.author,
        duration: p.libraryItem.media.duration,
        coverUrl: `${this.serverUrl}/api/items/${p.libraryItem.id}/cover`,
        description: p.libraryItem.media.metadata.description,
      }));

      return [...books, ...podcasts];
    }

    const limit = options?.limit || 50;
    const page = options?.page || 0;
    path = `/api/libraries/${libraryId}/items?limit=${limit}&page=${page}&sort=media.metadata.title&minified=1`;

    const data = (await this.fetchJson(path)) as {
      results?: Array<{
        id: string;
        media?: {
          metadata?: {
            title?: string;
            authorName?: string;
            author?: string;
            description?: string;
          };
          duration?: number;
        };
      }>;
    };

    return (data?.results || []).map((item) => ({
      id: item.id,
      title: item.media?.metadata?.title || "Unknown",
      authorName: item.media?.metadata?.authorName || item.media?.metadata?.author,
      duration: item.media?.duration,
      coverUrl: `${this.serverUrl}/api/items/${item.id}/cover`,
      description: item.media?.metadata?.description,
    }));
  }

  async getItem(itemId: string): Promise<AudiobookshelfItem | null> {
    const data = (await this.fetchJson(`/api/items/${itemId}`)) as {
      id: string;
      media?: {
        metadata?: {
          title?: string;
          authorName?: string;
          author?: string;
          description?: string;
        };
        duration?: number;
      };
      mediaProgress?: { progress?: number };
    };

    if (!data?.id) return null;

    return {
      id: data.id,
      title: data.media?.metadata?.title || "Unknown",
      authorName: data.media?.metadata?.authorName || data.media?.metadata?.author,
      duration: data.media?.duration,
      coverUrl: `${this.serverUrl}/api/items/${data.id}/cover`,
      description: data.media?.metadata?.description,
      progress: data.mediaProgress?.progress,
    };
  }

  getWebPlayerUrl(itemId: string): string {
    return `${this.serverUrl}/item/${itemId}`;
  }

  getCoverUrl(itemId: string): string {
    return `${this.serverUrl}/api/items/${itemId}/cover?token=${this.accessToken}`;
  }
}
