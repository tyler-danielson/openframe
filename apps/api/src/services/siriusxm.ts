/**
 * SiriusXM Client — reverse-engineered web API integration.
 *
 * Based on the open-source sxm.py (andrew0/SiriusXM) which documents the
 * unofficial SiriusXM web player API. This service handles:
 * - Authentication (login + session resume)
 * - Channel listing
 * - HLS stream URL retrieval
 * - Playlist rewriting (proxy segment URLs through our server)
 * - Audio segment proxying
 */

import { URL } from "url";

const BASE_URL =
  "https://player.siriusxm.com/rest/v2/experience/modules/";
const HLS_AES_KEY = Buffer.from("0Nsco7MAgxowGvkUT8aYag==", "base64");

const DEVICE_INFO = {
  osVersion: "Mac",
  platform: "Web",
  sxmAppVersion: "3.1802.10011.0",
  browser: "Safari",
  browserVersion: "11.0.3",
  appRegion: "US",
  deviceModel: "K2WebClient",
  clientDeviceId: "null",
  player: "html5",
  clientDeviceType: "web",
};

export interface SXMChannel {
  channelId: string;
  name: string;
  shortName: string;
  channelNumber: number;
  category: string;
  genre: string;
  logoUrl?: string;
  description?: string;
  nowPlaying?: {
    title: string;
    artist?: string;
    album?: string;
    albumArt?: string;
  };
}

interface SXMSession {
  cookies: Record<string, string>;
  channels: SXMChannel[];
  channelsLastFetched: number;
  lastAuthenticated: number;
}

// Per-user session cache (keyed by account ID)
const sessionCache = new Map<string, SXMSession>();

// Session expires after 25 minutes (SXM sessions last ~30 min)
const SESSION_TTL = 25 * 60 * 1000;
// Channel cache: 1 hour
const CHANNEL_CACHE_TTL = 60 * 60 * 1000;

export class SiriusXMClient {
  private username: string;
  private password: string;
  private accountId: string;
  private session: SXMSession | null;

  constructor(username: string, password: string, accountId: string) {
    this.username = username;
    this.password = password;
    this.accountId = accountId;
    this.session = sessionCache.get(accountId) || null;
  }

  /** Check if the current session is still valid. */
  private isSessionValid(): boolean {
    if (!this.session) return false;
    return Date.now() - this.session.lastAuthenticated < SESSION_TTL;
  }

  /** Check if cached channels are still fresh. */
  private areChannelsFresh(): boolean {
    if (!this.session || !this.session.channelsLastFetched) return false;
    return Date.now() - this.session.channelsLastFetched < CHANNEL_CACHE_TTL;
  }

  /** Build cookie header string from session cookies. */
  private getCookieHeader(): string {
    if (!this.session) return "";
    return Object.entries(this.session.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  /** Parse Set-Cookie headers from a response and merge into session. */
  private parseCookies(response: Response): void {
    if (!this.session) return;
    const setCookies = response.headers.getSetCookie?.() || [];
    for (const cookie of setCookies) {
      const parts = cookie.split(";")[0];
      if (parts) {
        const eqIdx = parts.indexOf("=");
        if (eqIdx > 0) {
          const name = parts.substring(0, eqIdx).trim();
          const value = parts.substring(eqIdx + 1).trim();
          this.session.cookies[name] = value;
        }
      }
    }
  }

  /** Make a POST request to the SiriusXM API. */
  private async post(
    endpoint: string,
    body: unknown,
    authenticate = true
  ): Promise<any> {
    const url = `${BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (authenticate && this.session) {
      headers["Cookie"] = this.getCookieHeader();
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      redirect: "manual",
    });

    this.parseCookies(response);

    if (!response.ok) {
      throw new Error(`SiriusXM API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /** Make a GET request to the SiriusXM API. */
  private async get(
    endpoint: string,
    params?: Record<string, string>
  ): Promise<any> {
    const url = new URL(`${BASE_URL}${endpoint}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (this.session) {
      headers["Cookie"] = this.getCookieHeader();
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers,
      redirect: "manual",
    });

    this.parseCookies(response);

    if (!response.ok) {
      throw new Error(`SiriusXM API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /** Login with username/password. */
  async login(): Promise<boolean> {
    // Initialize clean session
    this.session = {
      cookies: {},
      channels: [],
      channelsLastFetched: 0,
      lastAuthenticated: 0,
    };

    const postdata = {
      moduleList: {
        modules: [
          {
            moduleRequest: {
              resultTemplate: "web",
              deviceInfo: DEVICE_INFO,
              standardAuth: {
                username: this.username,
                password: this.password,
              },
            },
          },
        ],
      },
    };

    try {
      const data = await this.post("modify/authentication", postdata, false);

      // Check for SXMAUTH cookie (indicates login success)
      if (!this.session.cookies["SXMAUTH"]) {
        // Check for error in response
        const status =
          data?.ModuleListResponse?.moduleList?.modules?.[0]?.moduleResponse
            ?.status;
        if (status && status !== 1) {
          throw new Error(
            `Login failed: ${data?.ModuleListResponse?.moduleList?.modules?.[0]?.moduleResponse?.message || "Invalid credentials"}`
          );
        }
        throw new Error("Login failed: no auth cookie received");
      }

      return true;
    } catch (err: any) {
      this.session = null;
      throw err;
    }
  }

  /** Authenticate session (must be called after login). */
  async authenticate(): Promise<boolean> {
    if (!this.session?.cookies["SXMAUTH"]) {
      await this.login();
    }

    const postdata = {
      moduleList: {
        modules: [
          {
            moduleRequest: {
              resultTemplate: "web",
              deviceInfo: DEVICE_INFO,
            },
          },
        ],
      },
    };

    try {
      await this.post("resume?OAtrial=false", postdata, false);

      // Check we got session cookies
      if (
        !this.session!.cookies["AWSELB"] &&
        !this.session!.cookies["JSESSIONID"]
      ) {
        throw new Error("Session authentication failed: missing session cookies");
      }

      this.session!.lastAuthenticated = Date.now();
      sessionCache.set(this.accountId, this.session!);
      return true;
    } catch (err: any) {
      throw new Error(`Session authentication failed: ${err.message}`);
    }
  }

  /** Ensure we have a valid authenticated session. */
  async ensureAuthenticated(): Promise<void> {
    if (this.isSessionValid()) return;
    await this.login();
    await this.authenticate();
  }

  /** Fetch all available channels. */
  async getChannels(forceRefresh = false): Promise<SXMChannel[]> {
    await this.ensureAuthenticated();

    if (!forceRefresh && this.areChannelsFresh() && this.session!.channels.length > 0) {
      return this.session!.channels;
    }

    const postdata = {
      moduleList: {
        modules: [
          {
            moduleArea: "Discovery",
            moduleType: "ChannelListing",
            moduleRequest: {
              consumeRequests: [],
              resultTemplate: "responsive",
              alerts: [],
              profileInfos: [],
            },
          },
        ],
      },
    };

    const data = await this.post("get", postdata);

    const rawChannels =
      data?.ModuleListResponse?.moduleList?.modules?.[0]?.moduleResponse
        ?.contentData?.channelListing?.channels || [];

    const channels: SXMChannel[] = rawChannels.map((ch: any) => {
      const nowPlaying = ch.cut
        ? {
            title: ch.cut.title || "",
            artist: ch.cut?.artists?.[0]?.name || ch.cut?.galaxyAssetId || "",
            album: ch.cut?.album?.title || "",
            albumArt:
              ch.cut?.album?.creativeArts?.[0]?.url ||
              ch.cut?.creativeArts?.[0]?.url ||
              "",
          }
        : undefined;

      return {
        channelId: ch.channelId || String(ch.siriusChannelNumber || ch.channelNumber),
        name: ch.name || ch.longName || "",
        shortName: ch.shortName || ch.name || "",
        channelNumber: ch.siriusChannelNumber || ch.channelNumber || 0,
        category: ch.category || ch.genre?.name || "Other",
        genre: ch.genre?.name || "",
        logoUrl:
          ch.images?.images?.find?.((i: any) => i.name === "color channel logo image")
            ?.url ||
          ch.images?.images?.[0]?.url ||
          "",
        description: ch.shortDescription || ch.longDescription || "",
        nowPlaying,
      };
    });

    // Sort by channel number
    channels.sort((a, b) => a.channelNumber - b.channelNumber);

    this.session!.channels = channels;
    this.session!.channelsLastFetched = Date.now();
    sessionCache.set(this.accountId, this.session!);

    return channels;
  }

  /** Get the raw HLS playlist URL for a channel. */
  async getPlaylistUrl(
    channelId: string
  ): Promise<{ url: string; guid: string }> {
    await this.ensureAuthenticated();

    const channel = this.session!.channels.find(
      (c) =>
        c.channelId === channelId ||
        String(c.channelNumber) === channelId ||
        c.shortName.toLowerCase() === channelId.toLowerCase()
    );
    if (!channel) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    const params: Record<string, string> = {
      assetGUID: channel.channelId,
      ccRequestType: "AUDIO_VIDEO",
      channelId: channel.channelId,
      hls_output_mode: "custom",
      marker_mode: "all_separate_cue_points",
      "result-template": "web",
      time: String(Date.now()),
      timestamp: new Date().toISOString(),
    };

    const data = await this.get("tune/now-playing-live", params);

    // Extract HLS URL from response
    const hlsInfos =
      data?.ModuleListResponse?.moduleList?.modules?.[0]?.moduleResponse
        ?.liveChannelData?.hlsAudioInfos ||
      data?.ModuleListResponse?.moduleList?.modules?.[0]?.moduleResponse
        ?.liveChannelData?.HLSAudioInfos ||
      [];

    // Find the LARGE quality variant
    const hlsInfo =
      hlsInfos.find((h: any) => h.size === "LARGE") ||
      hlsInfos.find((h: any) => h.size === "MEDIUM") ||
      hlsInfos[0];

    if (!hlsInfo?.url) {
      throw new Error("No HLS stream URL available for this channel");
    }

    return {
      url: hlsInfo.url,
      guid: channel.channelId,
    };
  }

  /**
   * Fetch the m3u8 playlist for a channel and rewrite segment URLs
   * to route through our proxy.
   */
  async getPlaylist(
    channelId: string,
    proxyBaseUrl: string
  ): Promise<string> {
    const { url } = await this.getPlaylistUrl(channelId);

    const headers: Record<string, string> = {};
    if (this.session) {
      headers["Cookie"] = this.getCookieHeader();
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch playlist: ${response.status}`);
    }

    let playlist = await response.text();

    // Rewrite segment URLs to go through our proxy
    // Replace absolute URLs with our proxy URLs
    const baseHlsUrl = url.substring(0, url.lastIndexOf("/") + 1);

    playlist = playlist
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("#")) {
          // Rewrite key URI if present
          if (trimmed.includes("URI=")) {
            return trimmed.replace(
              /URI="([^"]+)"/,
              `URI="${proxyBaseUrl}/key"`
            );
          }
          return line;
        }
        if (trimmed.length > 0 && !trimmed.startsWith("#")) {
          // This is a segment URL
          let segmentUrl = trimmed;
          if (!segmentUrl.startsWith("http")) {
            segmentUrl = baseHlsUrl + segmentUrl;
          }
          // Encode the real URL and proxy it
          return `${proxyBaseUrl}/segment/${encodeURIComponent(segmentUrl)}`;
        }
        return line;
      })
      .join("\n");

    return playlist;
  }

  /** Fetch an audio segment from SiriusXM CDN. */
  async getSegment(segmentUrl: string): Promise<Buffer> {
    const headers: Record<string, string> = {};
    if (this.session) {
      headers["Cookie"] = this.getCookieHeader();
    }

    const response = await fetch(segmentUrl, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch segment: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /** Get the HLS AES decryption key. */
  getHLSKey(): Buffer {
    return HLS_AES_KEY;
  }

  /** Clear the cached session for this account. */
  clearSession(): void {
    sessionCache.delete(this.accountId);
    this.session = null;
  }

  /**
   * Validate credentials by attempting to login.
   * Returns true if login succeeds.
   */
  static async validateCredentials(
    username: string,
    password: string
  ): Promise<boolean> {
    const client = new SiriusXMClient(username, password, "validation");
    try {
      await client.login();
      await client.authenticate();
      sessionCache.delete("validation");
      return true;
    } catch {
      sessionCache.delete("validation");
      return false;
    }
  }
}
