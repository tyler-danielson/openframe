import { useState, useRef, useEffect, useCallback } from "react";
import type { KioskConfig } from "@/services/storage";
import { isRunningInAlexa, onMessage, sendMessage } from "@/services/alexa";

interface KioskFrameProps {
  config: KioskConfig;
  onBack: () => void;
}

type ConnectionState = "loading" | "connected" | "error" | "timeout";

const LOAD_TIMEOUT_MS = 30000;
const RETRY_DELAY_MS = 5000;

export function KioskFrame({ config, onBack }: KioskFrameProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const kioskUrl = `${config.serverUrl}/kiosk/${config.kioskToken}`;

  const clearLoadTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startLoadTimeout = useCallback(() => {
    clearLoadTimeout();
    timeoutRef.current = setTimeout(() => {
      setConnectionState("timeout");
      setErrorMessage("Connection timed out. Please check your network and server URL.");
    }, LOAD_TIMEOUT_MS);
  }, [clearLoadTimeout]);

  const loadKiosk = useCallback(() => {
    setConnectionState("loading");
    setErrorMessage(null);
    startLoadTimeout();

    if (iframeRef.current) {
      iframeRef.current.src = kioskUrl;
    }
  }, [kioskUrl, startLoadTimeout]);

  const handleIframeLoad = useCallback(() => {
    clearLoadTimeout();
    setConnectionState("connected");
    setRetryCount(0);
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
    return () => clearLoadTimeout();
  }, [loadKiosk, clearLoadTimeout]);

  // Auto-retry on error (up to 3 times)
  useEffect(() => {
    if ((connectionState === "error" || connectionState === "timeout") && retryCount < 3) {
      const retryTimeout = setTimeout(() => handleRetry(), RETRY_DELAY_MS);
      return () => clearTimeout(retryTimeout);
    }
  }, [connectionState, retryCount, handleRetry]);

  // Send navigation command to iframe
  const sendNavigationCommand = useCallback(
    (page: string) => {
      if (iframeRef.current?.contentWindow) {
        try {
          iframeRef.current.contentWindow.postMessage(
            { type: "navigate", page },
            "*"
          );
        } catch (err) {
          console.warn("Failed to send navigation command:", err);
        }
      }
    },
    []
  );

  // Listen for Alexa voice commands
  useEffect(() => {
    if (!isRunningInAlexa()) return;

    onMessage((message) => {
      const action = message.action as string;

      switch (action) {
        case "navigate":
          sendNavigationCommand(message.page as string);
          break;
        case "next":
          sendNavigationCommand("scroll:right");
          break;
        case "previous":
          sendNavigationCommand("scroll:left");
          break;
        case "refresh":
          loadKiosk();
          break;
        case "setup":
          onBack();
          break;
        case "configSaved":
          console.log("[Alexa] Config saved to S3");
          break;
        case "configCleared":
          console.log("[Alexa] Config cleared from S3");
          onBack();
          break;
      }
    });
  }, [sendNavigationCommand, loadKiosk, onBack]);

  // Keep Alexa session alive with periodic pings
  useEffect(() => {
    if (!isRunningInAlexa()) return;

    const interval = setInterval(() => {
      sendMessage({ action: "keepAlive" });
    }, 60000); // Ping every 60 seconds

    return () => clearInterval(interval);
  }, []);

  // Listen for "back-unhandled" from iframe
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "back-unhandled") {
        onBack();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onBack]);

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

      {/* Settings touch target (tap bottom-right corner) */}
      <button
        className="settings-touch-target"
        onClick={() => setShowSettings(true)}
        aria-label="Open settings"
      />

      {/* Settings overlay */}
      {showSettings && (
        <div className="settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
            <h2>Settings</h2>

            <div className="settings-info">
              <div className="info-item">
                <span className="info-label">Server</span>
                <span className="info-value">{config.serverUrl}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Token</span>
                <span className="info-value">{config.kioskToken.slice(0, 8)}...</span>
              </div>
            </div>

            <div className="settings-actions">
              <button className="btn btn-secondary" onClick={onBack}>
                Change Configuration
              </button>
              <button className="btn btn-primary" onClick={() => setShowSettings(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
