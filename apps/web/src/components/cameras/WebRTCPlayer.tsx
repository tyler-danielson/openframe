import { useState, useEffect, useRef, useCallback } from "react";
import {
  RefreshCw,
  AlertCircle,
  Wifi,
  WifiOff,
} from "lucide-react";
import { cn } from "../../lib/utils";

interface WebRTCPlayerProps {
  webrtcUrl: string;
  hlsUrl?: string;
  className?: string;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
}

type ConnectionState = "connecting" | "connected" | "disconnected" | "failed";

export function WebRTCPlayer({
  webrtcUrl,
  hlsUrl,
  className,
  onLoad,
  onError,
  autoReconnect = true,
  reconnectInterval = 5000,
}: WebRTCPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [useHlsFallback, setUseHlsFallback] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const connectWebRTC = useCallback(async () => {
    cleanup();
    setConnectionState("connecting");

    try {
      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcRef.current = pc;

      // Handle incoming tracks
      pc.ontrack = (event) => {
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
        }
      };

      // Monitor connection state
      pc.onconnectionstatechange = () => {
        switch (pc.connectionState) {
          case "connected":
            setConnectionState("connected");
            setRetryCount(0);
            onLoad?.();
            break;
          case "disconnected":
            setConnectionState("disconnected");
            if (autoReconnect) {
              reconnectTimeoutRef.current = setTimeout(() => {
                setRetryCount((c) => c + 1);
                connectWebRTC();
              }, reconnectInterval);
            }
            break;
          case "failed":
            setConnectionState("failed");
            if (autoReconnect && retryCount < 3) {
              reconnectTimeoutRef.current = setTimeout(() => {
                setRetryCount((c) => c + 1);
                connectWebRTC();
              }, reconnectInterval);
            } else if (hlsUrl) {
              // Fall back to HLS after 3 failed attempts
              setUseHlsFallback(true);
            }
            break;
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "failed") {
          pc.restartIce();
        }
      };

      // Add transceivers for receiving media
      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering to complete
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") {
          resolve();
        } else {
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === "complete") {
              resolve();
            }
          };
        }
      });

      // Send offer to MediaMTX WHEP endpoint
      const whepUrl = webrtcUrl.replace(/\/$/, "") + "/whep";
      const response = await fetch(whepUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/sdp",
        },
        body: pc.localDescription?.sdp,
      });

      if (!response.ok) {
        throw new Error(`WHEP request failed: ${response.status} ${response.statusText}`);
      }

      const answerSdp = await response.text();
      await pc.setRemoteDescription({
        type: "answer",
        sdp: answerSdp,
      });
    } catch (error) {
      console.error("WebRTC connection error:", error);
      setConnectionState("failed");
      onError?.(error as Error);

      if (autoReconnect && retryCount < 3) {
        reconnectTimeoutRef.current = setTimeout(() => {
          setRetryCount((c) => c + 1);
          connectWebRTC();
        }, reconnectInterval);
      } else if (hlsUrl) {
        setUseHlsFallback(true);
      }
    }
  }, [webrtcUrl, hlsUrl, cleanup, onLoad, onError, autoReconnect, reconnectInterval, retryCount]);

  // Initialize connection
  useEffect(() => {
    if (!useHlsFallback) {
      connectWebRTC();
    }
    return cleanup;
  }, [webrtcUrl, useHlsFallback, connectWebRTC, cleanup]);

  // HLS fallback using native video element or hls.js
  useEffect(() => {
    if (!useHlsFallback || !hlsUrl || !videoRef.current) return;

    const video = videoRef.current;

    // Check if native HLS is supported (Safari)
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = hlsUrl;
      video.addEventListener("loadeddata", () => {
        setConnectionState("connected");
        onLoad?.();
      });
      video.addEventListener("error", () => {
        setConnectionState("failed");
        onError?.(new Error("HLS playback failed"));
      });
    } else {
      // Dynamic import hls.js for other browsers
      import("hls.js").then(({ default: Hls }) => {
        if (!Hls.isSupported()) {
          setConnectionState("failed");
          onError?.(new Error("HLS is not supported in this browser"));
          return;
        }

        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 0,
        });

        hls.loadSource(hlsUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setConnectionState("connected");
          onLoad?.();
          video.play().catch(() => {
            // Autoplay may be blocked
          });
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            setConnectionState("failed");
            onError?.(new Error(`HLS error: ${data.type}`));
          }
        });

        return () => {
          hls.destroy();
        };
      }).catch((err) => {
        console.error("Failed to load hls.js:", err);
        setConnectionState("failed");
        onError?.(new Error("Failed to load HLS support"));
      });
    }
  }, [useHlsFallback, hlsUrl, onLoad, onError]);

  const handleRetry = () => {
    setRetryCount(0);
    setUseHlsFallback(false);
    connectWebRTC();
  };

  const handleVideoError = () => {
    if (!useHlsFallback) {
      setConnectionState("failed");
    }
  };

  return (
    <div className={cn("relative bg-black", className)}>
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        autoPlay
        playsInline
        muted
        onError={handleVideoError}
        onLoadedData={() => {
          if (connectionState === "connecting") {
            setConnectionState("connected");
            onLoad?.();
          }
        }}
      />

      {/* Connection state indicator */}
      <div className="absolute top-2 right-2 flex items-center gap-1">
        {connectionState === "connected" && (
          <div className="flex items-center gap-1 rounded bg-green-500/80 px-2 py-0.5 text-xs text-white">
            <Wifi className="h-3 w-3" />
            {useHlsFallback ? "HLS" : "WebRTC"}
          </div>
        )}
        {connectionState === "connecting" && (
          <div className="flex items-center gap-1 rounded bg-yellow-500/80 px-2 py-0.5 text-xs text-white">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Connecting
          </div>
        )}
        {connectionState === "disconnected" && (
          <div className="flex items-center gap-1 rounded bg-yellow-500/80 px-2 py-0.5 text-xs text-white">
            <WifiOff className="h-3 w-3" />
            Reconnecting
          </div>
        )}
      </div>

      {/* Loading overlay */}
      {connectionState === "connecting" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <RefreshCw className="h-8 w-8 animate-spin text-white" />
        </div>
      )}

      {/* Error overlay */}
      {connectionState === "failed" && !useHlsFallback && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
          <AlertCircle className="h-10 w-10 text-destructive mb-2" />
          <p className="text-sm text-muted-foreground mb-2">Connection failed</p>
          <button
            onClick={handleRetry}
            className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Retry
          </button>
          {hlsUrl && (
            <button
              onClick={() => setUseHlsFallback(true)}
              className="mt-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Try HLS instead
            </button>
          )}
        </div>
      )}
    </div>
  );
}
