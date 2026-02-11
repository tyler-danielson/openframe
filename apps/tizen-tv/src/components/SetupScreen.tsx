import { useState, useRef, useEffect, useCallback } from "react";
import { useTizenKeys, type KeyAction } from "@/hooks/useTizenKeys";
import { storage, type KioskConfig } from "@/services/storage";
import "@/styles/tv.css";

interface SetupScreenProps {
  onConnect: (config: KioskConfig) => void;
  initialConfig?: KioskConfig | null;
}

type FocusableElement = "serverUrl" | "token" | "connect" | "clear";
const FOCUSABLE_ELEMENTS: FocusableElement[] = ["serverUrl", "token", "connect", "clear"];

export function SetupScreen({ onConnect, initialConfig }: SetupScreenProps) {
  // Check URL params for pre-filled values (useful for TV where typing is hard)
  const urlParams = new URLSearchParams(window.location.search);
  const paramServer = urlParams.get("server") || urlParams.get("url") || "";
  const paramToken = urlParams.get("token") || urlParams.get("kiosk") || "";

  const [serverUrl, setServerUrl] = useState(initialConfig?.serverUrl ?? paramServer ?? "");
  const [kioskToken, setKioskToken] = useState(initialConfig?.kioskToken ?? paramToken ?? "");
  const [focusedElement, setFocusedElement] = useState<FocusableElement>("serverUrl");
  const [error, setError] = useState<string | null>(null);

  // Auto-connect if both params provided
  const autoConnect = paramServer && paramToken && !initialConfig;

  const serverUrlRef = useRef<HTMLInputElement>(null);
  const tokenRef = useRef<HTMLInputElement>(null);

  // Focus the appropriate input when focus changes
  useEffect(() => {
    if (focusedElement === "serverUrl") {
      serverUrlRef.current?.focus();
    } else if (focusedElement === "token") {
      tokenRef.current?.focus();
    } else {
      // Blur inputs when not focused
      serverUrlRef.current?.blur();
      tokenRef.current?.blur();
    }
  }, [focusedElement]);

  const handleConnect = useCallback(() => {
    // Validate inputs
    if (!serverUrl.trim()) {
      setError("Please enter a server URL");
      setFocusedElement("serverUrl");
      return;
    }

    if (!kioskToken.trim()) {
      setError("Please enter a kiosk token");
      setFocusedElement("token");
      return;
    }

    // Validate URL format
    let normalizedUrl = serverUrl.trim();
    if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    // Remove trailing slash
    normalizedUrl = normalizedUrl.replace(/\/+$/, "");

    const config: KioskConfig = {
      serverUrl: normalizedUrl,
      kioskToken: kioskToken.trim(),
    };

    // Save to storage
    if (storage.saveKioskConfig(config)) {
      setError(null);
      onConnect(config);
    } else {
      setError("Failed to save configuration");
    }
  }, [serverUrl, kioskToken, onConnect]);

  // Auto-connect if URL params provided
  useEffect(() => {
    if (autoConnect) {
      handleConnect();
    }
  }, [autoConnect, handleConnect]);

  const handleClear = useCallback(() => {
    storage.clearKioskConfig();
    setServerUrl("");
    setKioskToken("");
    setError(null);
    setFocusedElement("serverUrl");
  }, []);

  const handleKeyAction = useCallback(
    (action: KeyAction) => {
      const currentIndex = FOCUSABLE_ELEMENTS.indexOf(focusedElement);

      switch (action) {
        case "up":
          if (currentIndex > 0) {
            const prev = FOCUSABLE_ELEMENTS[currentIndex - 1];
            if (prev) setFocusedElement(prev);
          }
          break;

        case "down":
          if (currentIndex < FOCUSABLE_ELEMENTS.length - 1) {
            const next = FOCUSABLE_ELEMENTS[currentIndex + 1];
            if (next) setFocusedElement(next);
          }
          break;

        case "left":
          if (focusedElement === "clear") {
            setFocusedElement("connect");
          }
          break;

        case "right":
          if (focusedElement === "connect") {
            setFocusedElement("clear");
          }
          break;

        case "enter":
          if (focusedElement === "connect") {
            handleConnect();
          } else if (focusedElement === "clear") {
            handleClear();
          }
          // For input fields, Enter is handled natively
          break;

        case "back":
          setError(null);
          break;

        case "red":
          handleClear();
          break;

        case "green":
          handleConnect();
          break;
      }
    },
    [focusedElement, handleConnect, handleClear]
  );

  useTizenKeys(handleKeyAction);

  return (
    <div className="setup-screen">
      <div className="setup-container">
        <h1 className="setup-title">OpenFrame Kiosk</h1>
        <p className="setup-subtitle">Configure your kiosk connection</p>

        {error && <div className="setup-error">{error}</div>}

        <div className="setup-form">
          <div className={`input-group ${focusedElement === "serverUrl" ? "focused" : ""}`}>
            <label htmlFor="serverUrl">Server URL</label>
            <input
              ref={serverUrlRef}
              id="serverUrl"
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://openframe.example.com"
            />
          </div>

          <div className={`input-group ${focusedElement === "token" ? "focused" : ""}`}>
            <label htmlFor="token">Kiosk Token</label>
            <input
              ref={tokenRef}
              id="token"
              type="text"
              value={kioskToken}
              onChange={(e) => setKioskToken(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </div>

          <div className="button-group">
            <button
              className={`btn btn-primary ${focusedElement === "connect" ? "focused" : ""}`}
              onClick={handleConnect}
            >
              Connect
            </button>
            <button
              className={`btn btn-secondary ${focusedElement === "clear" ? "focused" : ""}`}
              onClick={handleClear}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="setup-hints">
          <div className="hint">
            <span className="hint-key">D-pad</span>
            <span className="hint-action">Navigate</span>
          </div>
          <div className="hint">
            <span className="hint-key">OK/Enter</span>
            <span className="hint-action">Select / Edit</span>
          </div>
          <div className="hint">
            <span className="hint-key green">Green</span>
            <span className="hint-action">Connect</span>
          </div>
          <div className="hint">
            <span className="hint-key red">Red</span>
            <span className="hint-action">Clear</span>
          </div>
        </div>
      </div>
    </div>
  );
}
