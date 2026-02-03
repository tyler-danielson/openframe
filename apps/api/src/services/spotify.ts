import type { FastifyInstance } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import { oauthTokens } from "@openframe/database/schema";

export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  volume_percent: number;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  uri: string;
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  images: { url: string; width: number; height: number }[];
  uri: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
}

export interface SpotifyPlaybackState {
  is_playing: boolean;
  progress_ms: number;
  device: SpotifyDevice | null;
  item: SpotifyTrack | null;
  shuffle_state: boolean;
  repeat_state: "off" | "track" | "context";
  context: {
    type: string;
    uri: string;
  } | null;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string | null;
  images: { url: string }[];
  tracks: { total: number };
  uri: string;
}

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

export class SpotifyService {
  private db: FastifyInstance["db"];
  private userId: string;
  private accountId?: string; // Specific account ID to use

  constructor(db: FastifyInstance["db"], userId: string, accountId?: string) {
    this.db = db;
    this.userId = userId;
    this.accountId = accountId;
  }

  private async getToken(): Promise<typeof oauthTokens.$inferSelect> {
    // If a specific account ID is provided, use that
    if (this.accountId) {
      const [token] = await this.db
        .select()
        .from(oauthTokens)
        .where(
          and(
            eq(oauthTokens.id, this.accountId),
            eq(oauthTokens.userId, this.userId),
            eq(oauthTokens.provider, "spotify")
          )
        )
        .limit(1);

      if (!token) {
        throw new Error("Spotify account not found");
      }
      return token;
    }

    // Otherwise, try to find the primary account first
    const [primaryToken] = await this.db
      .select()
      .from(oauthTokens)
      .where(
        and(
          eq(oauthTokens.userId, this.userId),
          eq(oauthTokens.provider, "spotify"),
          eq(oauthTokens.isPrimary, true)
        )
      )
      .limit(1);

    if (primaryToken) {
      return primaryToken;
    }

    // Fall back to the first connected account
    const [token] = await this.db
      .select()
      .from(oauthTokens)
      .where(
        and(
          eq(oauthTokens.userId, this.userId),
          eq(oauthTokens.provider, "spotify")
        )
      )
      .orderBy(desc(oauthTokens.createdAt))
      .limit(1);

    if (!token) {
      throw new Error("Spotify not connected");
    }

    return token;
  }

  private async getAccessToken(): Promise<string> {
    const token = await this.getToken();

    // Check if token needs refresh
    if (token.expiresAt && token.expiresAt < new Date()) {
      return this.refreshAccessToken(token.id, token.refreshToken!);
    }

    return token.accessToken;
  }

  private async refreshAccessToken(tokenId: string, refreshToken: string): Promise<string> {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Spotify token refresh failed:", response.status, errorBody);
      throw new Error(`Failed to refresh Spotify token: ${response.status} - ${errorBody}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
    };

    // Update stored token by ID
    await this.db
      .update(oauthTokens)
      .set({
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
        updatedAt: new Date(),
      })
      .where(eq(oauthTokens.id, tokenId));

    return data.access_token;
  }

  private async spotifyFetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (response.status === 204) {
      return {} as T;
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Spotify API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  async getPlaybackState(): Promise<SpotifyPlaybackState | null> {
    try {
      const state = await this.spotifyFetch<SpotifyPlaybackState>("/me/player");
      return state;
    } catch {
      return null;
    }
  }

  async getDevices(): Promise<SpotifyDevice[]> {
    try {
      const response = await this.spotifyFetch<{ devices: SpotifyDevice[] }>(
        "/me/player/devices"
      );
      return response.devices || [];
    } catch (error) {
      console.error("Failed to get Spotify devices:", error);
      return [];
    }
  }

  async play(options?: {
    deviceId?: string;
    contextUri?: string;
    uris?: string[];
    positionMs?: number;
  }): Promise<void> {
    const params = options?.deviceId
      ? `?device_id=${options.deviceId}`
      : "";

    const body: Record<string, unknown> = {};
    if (options?.contextUri) body.context_uri = options.contextUri;
    if (options?.uris) body.uris = options.uris;
    if (options?.positionMs) body.position_ms = options.positionMs;

    await this.spotifyFetch(`/me/player/play${params}`, {
      method: "PUT",
      body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
    });
  }

  async pause(): Promise<void> {
    await this.spotifyFetch("/me/player/pause", { method: "PUT" });
  }

  async next(): Promise<void> {
    await this.spotifyFetch("/me/player/next", { method: "POST" });
  }

  async previous(): Promise<void> {
    await this.spotifyFetch("/me/player/previous", { method: "POST" });
  }

  async seek(positionMs: number): Promise<void> {
    await this.spotifyFetch(`/me/player/seek?position_ms=${positionMs}`, {
      method: "PUT",
    });
  }

  async setVolume(volumePercent: number): Promise<void> {
    await this.spotifyFetch(
      `/me/player/volume?volume_percent=${Math.round(volumePercent)}`,
      { method: "PUT" }
    );
  }

  async setShuffle(state: boolean): Promise<void> {
    await this.spotifyFetch(`/me/player/shuffle?state=${state}`, {
      method: "PUT",
    });
  }

  async setRepeat(state: "off" | "track" | "context"): Promise<void> {
    await this.spotifyFetch(`/me/player/repeat?state=${state}`, {
      method: "PUT",
    });
  }

  async transferPlayback(deviceId: string, play?: boolean): Promise<void> {
    await this.spotifyFetch("/me/player", {
      method: "PUT",
      body: JSON.stringify({
        device_ids: [deviceId],
        play: play ?? false,
      }),
    });
  }

  async getPlaylists(
    limit = 20,
    offset = 0
  ): Promise<{ items: SpotifyPlaylist[]; total: number }> {
    const response = await this.spotifyFetch<{
      items: SpotifyPlaylist[];
      total: number;
    }>(`/me/playlists?limit=${limit}&offset=${offset}`);
    return response;
  }

  async getRecentlyPlayed(
    limit = 20
  ): Promise<{ items: { track: SpotifyTrack; played_at: string }[] }> {
    const response = await this.spotifyFetch<{
      items: { track: SpotifyTrack; played_at: string }[];
    }>(`/me/player/recently-played?limit=${limit}`);
    return response;
  }

  async search(
    query: string,
    types: string[] = ["track", "artist", "album", "playlist"],
    limit = 10
  ): Promise<{
    tracks?: { items: SpotifyTrack[] };
    artists?: { items: SpotifyArtist[] };
    albums?: { items: SpotifyAlbum[] };
    playlists?: { items: SpotifyPlaylist[] };
  }> {
    const response = await this.spotifyFetch<{
      tracks?: { items: SpotifyTrack[] };
      artists?: { items: SpotifyArtist[] };
      albums?: { items: SpotifyAlbum[] };
      playlists?: { items: SpotifyPlaylist[] };
    }>(
      `/search?q=${encodeURIComponent(query)}&type=${types.join(",")}&limit=${limit}`
    );
    return response;
  }

  async getCurrentUser(): Promise<{ id: string; display_name: string; images: { url: string }[] }> {
    return this.spotifyFetch("/me");
  }

  async saveTrack(trackId: string): Promise<void> {
    await this.spotifyFetch(`/me/tracks?ids=${trackId}`, { method: "PUT" });
  }

  async unsaveTrack(trackId: string): Promise<void> {
    await this.spotifyFetch(`/me/tracks?ids=${trackId}`, { method: "DELETE" });
  }

  async checkSavedTracks(trackIds: string[]): Promise<boolean[]> {
    const response = await this.spotifyFetch<boolean[]>(
      `/me/tracks/contains?ids=${trackIds.join(",")}`
    );
    return response;
  }

  // Static methods for account management (don't require specific account context)

  static async getAllAccounts(
    db: FastifyInstance["db"],
    userId: string
  ): Promise<SpotifyAccount[]> {
    const tokens = await db
      .select({
        id: oauthTokens.id,
        accountName: oauthTokens.accountName,
        externalAccountId: oauthTokens.externalAccountId,
        isPrimary: oauthTokens.isPrimary,
        icon: oauthTokens.icon,
        defaultDeviceId: oauthTokens.defaultDeviceId,
        favoriteDeviceIds: oauthTokens.favoriteDeviceIds,
      })
      .from(oauthTokens)
      .where(
        and(
          eq(oauthTokens.userId, userId),
          eq(oauthTokens.provider, "spotify")
        )
      )
      .orderBy(desc(oauthTokens.isPrimary), desc(oauthTokens.createdAt));

    return tokens;
  }

  static async updateAccount(
    db: FastifyInstance["db"],
    userId: string,
    accountId: string,
    data: {
      accountName?: string;
      isPrimary?: boolean;
      icon?: string | null;
      defaultDeviceId?: string | null;
      favoriteDeviceIds?: string[] | null;
    }
  ): Promise<void> {
    // If setting as primary, unset other accounts first
    if (data.isPrimary === true) {
      await db
        .update(oauthTokens)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(
          and(
            eq(oauthTokens.userId, userId),
            eq(oauthTokens.provider, "spotify")
          )
        );
    }

    await db
      .update(oauthTokens)
      .set({
        ...(data.accountName !== undefined && { accountName: data.accountName }),
        ...(data.isPrimary !== undefined && { isPrimary: data.isPrimary }),
        ...(data.icon !== undefined && { icon: data.icon }),
        ...(data.defaultDeviceId !== undefined && { defaultDeviceId: data.defaultDeviceId }),
        ...(data.favoriteDeviceIds !== undefined && { favoriteDeviceIds: data.favoriteDeviceIds }),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(oauthTokens.id, accountId),
          eq(oauthTokens.userId, userId),
          eq(oauthTokens.provider, "spotify")
        )
      );
  }

  static async deleteAccount(
    db: FastifyInstance["db"],
    userId: string,
    accountId: string
  ): Promise<void> {
    await db
      .delete(oauthTokens)
      .where(
        and(
          eq(oauthTokens.id, accountId),
          eq(oauthTokens.userId, userId),
          eq(oauthTokens.provider, "spotify")
        )
      );
  }

  static async setExternalAccountId(
    db: FastifyInstance["db"],
    tokenId: string,
    externalAccountId: string
  ): Promise<void> {
    await db
      .update(oauthTokens)
      .set({ externalAccountId, updatedAt: new Date() })
      .where(eq(oauthTokens.id, tokenId));
  }
}
