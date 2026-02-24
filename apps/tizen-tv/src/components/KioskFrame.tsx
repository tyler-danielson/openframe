import { useState, useRef, useEffect, useCallback } from "react";
import type { KioskConfig } from "@/services/storage";
import "@/styles/tv.css";

interface KioskFrameProps {
  config: KioskConfig;
  onBack: () => void;
  onConnectionError?: () => void;
  onNavigate?: (page: string) => void;
}

type ConnectionState = "loading" | "connected" | "error" | "timeout";

const HEALTH_CHECK_TIMEOUT_MS = 6000; // 6 seconds before giving up on health check
const LOAD_TIMEOUT_MS = 20000; // 20 seconds for iframe load after health check passes
const RETRY_DELAY_MS = 5000; // 5 seconds between auto-retries

export function KioskFrame({ config, onBack, onConnectionError, onNavigate }: KioskFrameProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timeoutRef = useRef<number | null>(null);
  const connectionErrorFiredRef = useRef(false);
  // Guard to ignore onLoad events for about:blank (before health check completes)
  const expectingKioskLoadRef = useRef(false);

  const kioskUrl = `${config.serverUrl}/kiosk/${config.kioskToken}`;
  const healthUrl = `${config.serverUrl}/api/v1/health`;

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
      setErrorMessage("Connection timed out. Check your network and server URL.");
    }, LOAD_TIMEOUT_MS);
  }, [clearLoadTimeout]);

  // Check server reachability before loading the iframe.
  // Samsung Tizen shows its own "Unable to Load page" inside the iframe and still
  // fires onLoad, so we can't rely on iframe events alone to detect server-down.
  const checkServerHealth = useCallback(async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
      await fetch(healthUrl, {
        method: "HEAD",
        signal: controller.signal,
        cache: "no-store",
      });
      window.clearTimeout(timer);
      // Require 2xx so we don't get a false-positive from a router or other
      // service that happens to be at the same IP (e.g. 192.168.1.250)
      return response.ok;
    } catch {
      return false; // network error or abort = server unreachable
    }
  }, [healthUrl]);

  const loadKiosk = useCallback(() => {
    setConnectionState("loading");
    setErrorMessage(null);

    // Run health check async before committing to loading the iframe.
    // This prevents the Tizen browser from showing its own error page inside
    // the iframe when the server is down.
    (async () => {
      const reachable = await checkServerHealth();
      if (!reachable) {
        clearLoadTimeout();
        setConnectionState("error");
        setErrorMessage(
          `Cannot reach server at ${config.serverUrl}.\nCheck your network connection or press "Change Settings" to update the server URL.`
        );
        return;
      }
      // Server is up — load the iframe
      expectingKioskLoadRef.current = true;
      startLoadTimeout();
      if (iframeRef.current) {
        iframeRef.current.src = kioskUrl;
      }
    })();
  }, [config.serverUrl, kioskUrl, checkServerHealth, clearLoadTimeout, startLoadTimeout]);

  const handleIframeLoad = useCallback(() => {
    // Ignore the load event fired for the initial about:blank src
    if (!expectingKioskLoadRef.current) return;
    expectingKioskLoadRef.current = false;
    clearLoadTimeout();
    setConnectionState("connected");
    setRetryCount(0);
    connectionErrorFiredRef.current = false;
  }, [clearLoadTimeout]);

  const handleIframeError = useCallback(() => {
    expectingKioskLoadRef.current = false;
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

  // After all auto-retries fail, notify parent so it can open the settings overlay
  useEffect(() => {
    if (
      (connectionState === "error" || connectionState === "timeout") &&
      retryCount >= 3 &&
      !connectionErrorFiredRef.current
    ) {
      connectionErrorFiredRef.current = true;
      onConnectionError?.();
    }
  }, [connectionState, retryCount, onConnectionError]);

  // Send navigation command to iframe
  const sendNavigationCommand = useCallback(
    (page: string) => {
      if (iframeRef.current?.contentWindow) {
        try {
          iframeRef.current.contentWindow.postMessage(
            { type: "navigate", page },
            "*"
          );
          onNavigate?.(page);
        } catch (error) {
          console.warn("Failed to send navigation command:", error);
        }
      }
    },
    [config.serverUrl, onNavigate]
  );

  // Listen for "back-unhandled" messages from the iframe (block nav didn't consume back)
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "back-unhandled") {
        onBack();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onBack]);

  // Expose navigation method via ref or context
  useEffect(() => {
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
            <p>
              {retryCount === 0
                ? "Checking server connection..."
                : `Reconnecting... (attempt ${retryCount}/3)`}
            </p>
          </div>
        </div>
      )}

      {/* Error overlay — shown immediately on first failure, not just after 3 retries.
          Previously this only appeared after retryCount >= 3, which meant Samsung's
          "Unable to Load page" browser error was all the user ever saw. */}
      {(connectionState === "error" || connectionState === "timeout") && (
        <div className="kiosk-overlay error">
          <div className="kiosk-error">
            <h2>Connection Failed</h2>
            <p>{errorMessage}</p>
            {retryCount < 3 ? (
              <p className="retry-info">Auto-retrying in 5 seconds… ({retryCount}/3)</p>
            ) : (
              <p className="retry-info">All automatic retries failed.</p>
            )}
            <div className="kiosk-error-actions">
              <button className="btn btn-primary" onClick={handleRetry}>
                Retry Now
              </button>
              <button className="btn btn-secondary" onClick={onBack}>
                Change Settings
              </button>
            </div>
            <p className="settings-hint">Press the MENU button on your remote to change the server URL</p>
          </div>
        </div>
      )}

      {/* Kiosk iframe — src is set imperatively by loadKiosk() after the health
          check passes. We intentionally omit src from JSX so React doesn't reset
          it back to an empty string on re-renders. */}
      <iframe
        ref={iframeRef}
        className="kiosk-iframe"
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
