import { useState, useRef, useEffect, useCallback } from "react";
import type { KioskConfig } from "@/services/storage";
import "@/styles/tv.css";

interface KioskFrameProps {
  config: KioskConfig;
  onBack: () => void;
  onNavigate?: (page: string) => void;
}

type ConnectionState = "loading" | "connected" | "error" | "timeout";

const LOAD_TIMEOUT_MS = 30000; // 30 seconds
const RETRY_DELAY_MS = 5000; // 5 seconds

export function KioskFrame({ config, onBack, onNavigate }: KioskFrameProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timeoutRef = useRef<number | null>(null);

  const kioskUrl = `${config.serverUrl}/kiosk/${config.kioskToken}`;

  const clearLoadTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startLoadTimeout = useCallback(() => {
    clearLoadTimeout();
    timeoutRef.current = window.setTimeout(() => {
      setConnectionState("timeout");
      setErrorMessage("Connection timed out. Please check your network and server URL.");
    }, LOAD_TIMEOUT_MS);
  }, [clearLoadTimeout]);

  const loadKiosk = useCallback(() => {
    setConnectionState("loading");
    setErrorMessage(null);
    startLoadTimeout();

    // Force reload by updating iframe src
    if (iframeRef.current) {
      iframeRef.current.src = kioskUrl;
    }
  }, [kioskUrl, startLoadTimeout]);

  const handleIframeLoad = useCallback(() => {
    clearLoadTimeout();

    // Check if iframe loaded successfully
    try {
      // We can't access cross-origin iframe content, but load event means something loaded
      setConnectionState("connected");
      setRetryCount(0);
    } catch {
      // If there's an error, it might be a CORS issue or the page didn't load
      setConnectionState("error");
      setErrorMessage("Failed to load kiosk. Please check your server URL and token.");
    }
  }, [clearLoadTimeout]);

  const handleIframeError = useCallback(() => {
    clearLoadTimeout();
    setConnectionState("error");
    setErrorMessage("Failed to connect to kiosk server.");
  }, [clearLoadTimeout]);

  const handleRetry = useCallback(() => {
    setRetryCount((prev) => prev + 1);
    loadKiosk();
  }, [loadKiosk]);

  // Initial load
  useEffect(() => {
    loadKiosk();

    return () => {
      clearLoadTimeout();
    };
  }, [loadKiosk, clearLoadTimeout]);

  // Auto-retry on error (up to 3 times)
  useEffect(() => {
    if ((connectionState === "error" || connectionState === "timeout") && retryCount < 3) {
      const retryTimeout = window.setTimeout(() => {
        handleRetry();
      }, RETRY_DELAY_MS);

      return () => window.clearTimeout(retryTimeout);
    }
  }, [connectionState, retryCount, handleRetry]);

  // Send navigation command to iframe
  const sendNavigationCommand = useCallback(
    (page: string) => {
      if (iframeRef.current?.contentWindow) {
        try {
          iframeRef.current.contentWindow.postMessage(
            { type: "navigate", page },
            config.serverUrl
          );
          onNavigate?.(page);
        } catch (error) {
          console.warn("Failed to send navigation command:", error);
        }
      }
    },
    [config.serverUrl, onNavigate]
  );

  // Expose navigation method via ref or context
  useEffect(() => {
    // Attach to window for RemoteHandler access
    (window as unknown as { kioskNavigate?: (page: string) => void }).kioskNavigate = sendNavigationCommand;

    return () => {
      delete (window as unknown as { kioskNavigate?: (page: string) => void }).kioskNavigate;
    };
  }, [sendNavigationCommand]);

  // Refresh kiosk
  const refreshKiosk = useCallback(() => {
    loadKiosk();
  }, [loadKiosk]);

  // Expose refresh method
  useEffect(() => {
    (window as unknown as { kioskRefresh?: () => void }).kioskRefresh = refreshKiosk;

    return () => {
      delete (window as unknown as { kioskRefresh?: () => void }).kioskRefresh;
    };
  }, [refreshKiosk]);

  return (
    <div className="kiosk-frame-container">
      {/* Loading overlay */}
      {connectionState === "loading" && (
        <div className="kiosk-overlay">
          <div className="kiosk-loading">
            <div className="spinner" />
            <p>Connecting to kiosk...</p>
            {retryCount > 0 && <p className="retry-count">Retry attempt {retryCount}/3</p>}
          </div>
        </div>
      )}

      {/* Error overlay */}
      {(connectionState === "error" || connectionState === "timeout") && retryCount >= 3 && (
        <div className="kiosk-overlay error">
          <div className="kiosk-error">
            <h2>Connection Failed</h2>
            <p>{errorMessage}</p>
            <div className="kiosk-error-actions">
              <button className="btn btn-primary" onClick={handleRetry}>
                Retry
              </button>
              <button className="btn btn-secondary" onClick={onBack}>
                Back to Setup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kiosk iframe */}
      <iframe
        ref={iframeRef}
        className="kiosk-iframe"
        src={kioskUrl}
        title="OpenFrame Kiosk"
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        allow="fullscreen; autoplay"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />

      {/* Connection status indicator */}
      {connectionState === "connected" && (
        <div className="connection-indicator connected">
          <span className="indicator-dot" />
          Connected
        </div>
      )}
    </div>
  );
}

// Export navigation helper for external use
export function navigateKiosk(page: string): void {
  const navigate = (window as unknown as { kioskNavigate?: (page: string) => void }).kioskNavigate;
  if (navigate) {
    navigate(page);
  }
}

export function refreshKiosk(): void {
  const refresh = (window as unknown as { kioskRefresh?: () => void }).kioskRefresh;
  if (refresh) {
    refresh();
  }
}
