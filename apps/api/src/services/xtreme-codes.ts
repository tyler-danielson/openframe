/**
 * Xtreme Codes API Client
 * Handles communication with Xtreme Codes IPTV servers
 */

export interface XtremeCodesCredentials {
  serverUrl: string;
  username: string;
  password: string;
}

export interface XtremeCodesUserInfo {
  username: string;
  password: string;
  status: string;
  expDate: string | null;
  isTrial: boolean;
  activeCons: number;
  maxConnections: number;
  allowedOutputFormats: string[];
}

export interface XtremeCodesServerInfo {
  url: string;
  port: string;
  httpsPort: string;
  serverProtocol: string;
  rtmpPort: string;
  timezone: string;
  timestampNow: number;
  timeNow: string;
}

export interface XtremeCodesCategory {
  category_id: string;
  category_name: string;
  parent_id: number;
}

export interface XtremeCodesStream {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string;
  epg_channel_id: string | null;
  added: string;
  category_id: string;
  custom_sid: string;
  tv_archive: number;
  direct_source: string;
  tv_archive_duration: number;
}

export interface XtremeCodesEpgListing {
  id: string;
  epg_id: string;
  title: string;
  lang: string;
  start: string;
  end: string;
  description: string;
  channel_id: string;
  start_timestamp: string;
  stop_timestamp: string;
}

export interface XtremeCodesAuthResponse {
  user_info: XtremeCodesUserInfo;
  server_info: XtremeCodesServerInfo;
}

export class XtremeCodesClient {
  private serverUrl: string;
  private username: string;
  private password: string;

  constructor(credentials: XtremeCodesCredentials) {
    // Normalize server URL (remove trailing slash)
    this.serverUrl = credentials.serverUrl.replace(/\/+$/, "");
    this.username = credentials.username;
    this.password = credentials.password;
  }

  private buildApiUrl(action: string, params: Record<string, string> = {}): string {
    const url = new URL(`${this.serverUrl}/player_api.php`);
    url.searchParams.set("username", this.username);
    url.searchParams.set("password", this.password);
    url.searchParams.set("action", action);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    return url.toString();
  }

  /**
   * Authenticate and get user/server info
   */
  async authenticate(): Promise<XtremeCodesAuthResponse> {
    const url = this.buildApiUrl("");
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.status}`);
    }

    const data = await response.json() as {
      user_info?: {
        auth?: number;
        username?: string;
        password?: string;
        status?: string;
        exp_date?: string;
        is_trial?: string;
        active_cons?: string;
        max_connections?: string;
        allowed_output_formats?: string[];
      };
      server_info?: {
        url?: string;
        port?: string;
        https_port?: string;
        server_protocol?: string;
        rtmp_port?: string;
        timezone?: string;
        timestamp_now?: number;
        time_now?: string;
      };
    };

    if (!data.user_info) {
      throw new Error("Invalid server response - missing user info");
    }

    if (data.user_info.auth === 0) {
      throw new Error("Invalid credentials");
    }

    return {
      user_info: {
        username: data.user_info.username || "",
        password: data.user_info.password || "",
        status: data.user_info.status || "",
        expDate: data.user_info.exp_date || null,
        isTrial: data.user_info.is_trial === "1",
        activeCons: parseInt(data.user_info.active_cons || "0") || 0,
        maxConnections: parseInt(data.user_info.max_connections || "1") || 1,
        allowedOutputFormats: data.user_info.allowed_output_formats || [],
      },
      server_info: {
        url: data.server_info?.url || "",
        port: data.server_info?.port || "",
        httpsPort: data.server_info?.https_port || "",
        serverProtocol: data.server_info?.server_protocol || "",
        rtmpPort: data.server_info?.rtmp_port || "",
        timezone: data.server_info?.timezone || "",
        timestampNow: data.server_info?.timestamp_now || 0,
        timeNow: data.server_info?.time_now || "",
      },
    };
  }

  /**
   * Get live TV categories
   */
  async getLiveCategories(): Promise<XtremeCodesCategory[]> {
    const url = this.buildApiUrl("get_live_categories");
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch categories: ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  /**
   * Get live TV streams (channels)
   * @param categoryId Optional category ID to filter by
   */
  async getLiveStreams(categoryId?: string): Promise<XtremeCodesStream[]> {
    const params: Record<string, string> = {};
    if (categoryId) {
      params.category_id = categoryId;
    }

    const url = this.buildApiUrl("get_live_streams", params);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch streams: ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  /**
   * Get EPG (Electronic Program Guide) for a stream
   * @param streamId The stream ID to get EPG for
   * @param limit Number of entries to return
   */
  async getEpg(streamId: string, limit = 10): Promise<XtremeCodesEpgListing[]> {
    const url = this.buildApiUrl("get_short_epg", {
      stream_id: streamId,
      limit: limit.toString(),
    });

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch EPG: ${response.status}`);
    }

    const data = await response.json() as { epg_listings?: XtremeCodesEpgListing[] };
    return data.epg_listings || [];
  }

  /**
   * Get full EPG for all channels
   */
  async getFullEpg(): Promise<Record<string, XtremeCodesEpgListing[]>> {
    const url = this.buildApiUrl("get_simple_data_table", {
      stream_id: "all",
    });

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch full EPG: ${response.status}`);
    }

    const data = await response.json() as { epg_listings?: Record<string, XtremeCodesEpgListing[]> };
    return data.epg_listings || {};
  }

  /**
   * Build the stream URL for a live channel
   * @param streamId The stream ID
   * @param format Output format (m3u8 for HLS, ts for MPEG-TS)
   */
  buildStreamUrl(streamId: string | number, format: "m3u8" | "ts" = "m3u8"): string {
    return `${this.serverUrl}/live/${this.username}/${this.password}/${streamId}.${format}`;
  }

  /**
   * Build the stream URL for timeshift (catch-up TV)
   * @param streamId The stream ID
   * @param start Start timestamp (Unix)
   * @param duration Duration in minutes
   */
  buildTimeshiftUrl(
    streamId: string | number,
    start: number,
    duration: number
  ): string {
    return `${this.serverUrl}/timeshift/${this.username}/${this.password}/${duration}/${start}/${streamId}.ts`;
  }
}
