/**
 * MediaMTX API Client
 *
 * Manages RTSP streams via MediaMTX's REST API for WebRTC/HLS transcoding.
 * MediaMTX converts RTSP camera feeds to browser-compatible formats.
 */

// MediaMTX API base URL - configurable via environment
const MEDIAMTX_API_URL = process.env.MEDIAMTX_API_URL || "http://localhost:9997";

export interface MediaMTXPath {
  name: string;
  confName: string;
  source: {
    type: string;
    id: string;
  } | null;
  ready: boolean;
  readyTime: string | null;
  tracks: string[];
  bytesReceived: number;
  bytesSent: number;
  readers: Array<{
    type: string;
    id: string;
  }>;
}

export interface MediaMTXPathConfig {
  name?: string;
  source?: string;
  sourceProtocol?: "automatic" | "tcp" | "udp" | "multicast";
  sourceOnDemand?: boolean;
  sourceOnDemandStartTimeout?: string;
  sourceOnDemandCloseAfter?: string;
  publishUser?: string;
  publishPass?: string;
  readUser?: string;
  readPass?: string;
  runOnDemand?: string;
  runOnDemandRestart?: boolean;
  runOnDemandStartTimeout?: string;
  runOnDemandCloseAfter?: string;
}

export interface MediaMTXConfig {
  logLevel: string;
  api: boolean;
  apiAddress: string;
  rtsp: boolean;
  rtspAddress: string;
  hls: boolean;
  hlsAddress: string;
  webrtc: boolean;
  webrtcAddress: string;
  paths: Record<string, MediaMTXPathConfig>;
}

class MediaMTXService {
  private baseUrl: string;

  constructor(baseUrl: string = MEDIAMTX_API_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Check if MediaMTX is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v3/config/global/get`, {
        method: "GET",
        signal: AbortSignal.timeout(2000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get all configured paths
   */
  async getPaths(): Promise<MediaMTXPath[]> {
    const response = await fetch(`${this.baseUrl}/v3/paths/list`);
    if (!response.ok) {
      throw new Error(`Failed to get paths: ${response.statusText}`);
    }
    const data = (await response.json()) as { items?: MediaMTXPath[] };
    return data.items || [];
  }

  /**
   * Get a specific path
   */
  async getPath(pathName: string): Promise<MediaMTXPath | null> {
    const response = await fetch(`${this.baseUrl}/v3/paths/get/${encodeURIComponent(pathName)}`);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Failed to get path: ${response.statusText}`);
    }
    return (await response.json()) as MediaMTXPath;
  }

  /**
   * Add a new RTSP stream path
   */
  async addPath(pathName: string, rtspUrl: string, options?: Partial<MediaMTXPathConfig>): Promise<void> {
    const config: MediaMTXPathConfig = {
      source: rtspUrl,
      sourceProtocol: "tcp",
      sourceOnDemand: true,
      sourceOnDemandStartTimeout: "10s",
      sourceOnDemandCloseAfter: "10s",
      ...options,
    };

    const response = await fetch(`${this.baseUrl}/v3/config/paths/add/${encodeURIComponent(pathName)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to add path: ${error}`);
    }
  }

  /**
   * Update an existing path configuration
   */
  async updatePath(pathName: string, config: Partial<MediaMTXPathConfig>): Promise<void> {
    const response = await fetch(`${this.baseUrl}/v3/config/paths/patch/${encodeURIComponent(pathName)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update path: ${error}`);
    }
  }

  /**
   * Remove a path
   */
  async removePath(pathName: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/v3/config/paths/delete/${encodeURIComponent(pathName)}`, {
      method: "DELETE",
    });

    if (!response.ok && response.status !== 404) {
      const error = await response.text();
      throw new Error(`Failed to remove path: ${error}`);
    }
  }

  /**
   * Get the WebRTC URL for a path
   */
  getWebRTCUrl(pathName: string): string {
    // WebRTC endpoint for MediaMTX
    const webrtcPort = process.env.MEDIAMTX_WEBRTC_PORT || "8889";
    const host = process.env.MEDIAMTX_HOST || "localhost";
    return `http://${host}:${webrtcPort}/${encodeURIComponent(pathName)}`;
  }

  /**
   * Get the HLS URL for a path
   */
  getHLSUrl(pathName: string): string {
    const hlsPort = process.env.MEDIAMTX_HLS_PORT || "8888";
    const host = process.env.MEDIAMTX_HOST || "localhost";
    return `http://${host}:${hlsPort}/${encodeURIComponent(pathName)}/index.m3u8`;
  }

  /**
   * Generate a safe path name from camera ID
   * Uses "camera/" prefix for organization
   */
  getPathName(cameraId: string): string {
    return `camera/${cameraId}`;
  }

  /**
   * Build RTSP URL with credentials embedded
   */
  buildRtspUrl(baseUrl: string, username?: string | null, password?: string | null): string {
    if (!username || !password) {
      return baseUrl;
    }

    try {
      const url = new URL(baseUrl);
      url.username = username;
      url.password = password;
      return url.toString();
    } catch {
      // If URL parsing fails, return original
      return baseUrl;
    }
  }

  /**
   * Register a camera stream with MediaMTX
   */
  async registerCamera(
    cameraId: string,
    rtspUrl: string,
    username?: string | null,
    password?: string | null
  ): Promise<{ pathName: string; webrtcUrl: string; hlsUrl: string }> {
    const pathName = this.getPathName(cameraId);
    const fullRtspUrl = this.buildRtspUrl(rtspUrl, username, password);

    // Check if path already exists
    const existing = await this.getPath(pathName);
    if (existing) {
      // Update existing path
      await this.updatePath(pathName, { source: fullRtspUrl });
    } else {
      // Add new path
      await this.addPath(pathName, fullRtspUrl);
    }

    return {
      pathName,
      webrtcUrl: this.getWebRTCUrl(pathName),
      hlsUrl: this.getHLSUrl(pathName),
    };
  }

  /**
   * Unregister a camera stream from MediaMTX
   */
  async unregisterCamera(cameraId: string): Promise<void> {
    const pathName = this.getPathName(cameraId);
    await this.removePath(pathName);
  }

  /**
   * Get stream URLs for a camera (without registering)
   */
  getStreamUrls(cameraId: string): { webrtcUrl: string; hlsUrl: string } {
    const pathName = this.getPathName(cameraId);
    return {
      webrtcUrl: this.getWebRTCUrl(pathName),
      hlsUrl: this.getHLSUrl(pathName),
    };
  }

  /**
   * Check if a camera stream is active/ready
   */
  async isStreamReady(cameraId: string): Promise<boolean> {
    const pathName = this.getPathName(cameraId);
    const path = await this.getPath(pathName);
    return path?.ready ?? false;
  }
}

// Export singleton instance
export const mediamtx = new MediaMTXService();

// Export class for testing or custom instances
export { MediaMTXService };
