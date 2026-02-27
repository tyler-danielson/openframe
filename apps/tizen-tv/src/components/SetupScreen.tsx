import { useState, useRef, useEffect, useCallback } from "react";
import { useTizenKeys, type KeyAction } from "@/hooks/useTizenKeys";
import { storage, type KioskConfig } from "@/services/storage";
import "@/styles/tv.css";

interface SetupScreenProps {
  onConnect: (config: KioskConfig) => void;
  onQRLogin: (serverUrl: string) => void;
  onRemotePush: (serverUrl: string) => void;
  onBack?: () => void;
  initialConfig?: KioskConfig | null;
}

type FocusableElement = "serverUrl" | "qrLogin" | "remotePush" | "token" | "connect" | "clear";
const FOCUSABLE_ELEMENTS: FocusableElement[] = ["serverUrl", "qrLogin", "remotePush", "token", "connect", "clear"];

export function SetupScreen({ onConnect, onQRLogin, onRemotePush, onBack, initialConfig }: SetupScreenProps) {
  // Check URL params for pre-filled values (useful for TV where typing is hard)
  const urlParams = new URLSearchParams(window.location.search);
  const paramServer = urlParams.get("server") || urlParams.get("url") || "";
  const paramToken = urlParams.get("token") || urlParams.get("kiosk") || "";

  const [serverUrl, setServerUrl] = useState(initialConfig?.serverUrl ?? paramServer ?? "");
  const [kioskToken, setKioskToken] = useState(initialConfig?.kioskToken ?? paramToken ?? "");
  const [focusedElement, setFocusedElement] = useState<FocusableElement>("serverUrl");
  const [editingField, setEditingField] = useState<"serverUrl" | "token" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-connect if both params provided
  const autoConnect = paramServer && paramToken && !initialConfig;

  const serverUrlRef = useRef<HTMLInputElement>(null);
  const tokenRef = useRef<HTMLInputElement>(null);

  // Only focus (and trigger keyboard) when actively editing
  useEffect(() => {
    if (editingField === "serverUrl") {
      serverUrlRef.current?.focus();
    } else if (editingField === "token") {
      tokenRef.current?.focus();
    } else {
      serverUrlRef.current?.blur();
      tokenRef.current?.blur();
    }
  }, [editingField]);

  const getNormalizedServerUrl = useCallback(() => {
    let normalizedUrl = serverUrl.trim();
    if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    return normalizedUrl.replace(/\/+$/, "");
  }, [serverUrl]);

  const handleQRLoginClick = useCallback(() => {
    if (!serverUrl.trim()) {
      setError("Please enter a server URL first");
      setFocusedElement("serverUrl");
      return;
    }
    onQRLogin(getNormalizedServerUrl());
  }, [serverUrl, onQRLogin, getNormalizedServerUrl]);

  const handleRemotePushClick = useCallback(() => {
    if (!serverUrl.trim()) {
      setError("Please enter a server URL first");
      setFocusedElement("serverUrl");
      return;
    }
    onRemotePush(getNormalizedServerUrl());
  }, [serverUrl, onRemotePush, getNormalizedServerUrl]);

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
    const normalizedUrl = getNormalizedServerUrl();

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
          if (editingField) break; // Don't navigate while keyboard is open
          if (currentIndex > 0) {
            const prev = FOCUSABLE_ELEMENTS[currentIndex - 1];
            if (prev) setFocusedElement(prev);
          }
          break;

        case "down":
          if (editingField) break; // Don't navigate while keyboard is open
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
          if (focusedElement === "serverUrl" || focusedElement === "token") {
            if (editingField === focusedElement) {
              // Already editing — confirm and exit editing mode
              setEditingField(null);
            } else {
              // Start editing — this will focus the input and trigger the keyboard
              setEditingField(focusedElement);
            }
          } else if (focusedElement === "connect") {
            handleConnect();
          } else if (focusedElement === "clear") {
            handleClear();
          } else if (focusedElement === "qrLogin") {
            handleQRLoginClick();
          } else if (focusedElement === "remotePush") {
            handleRemotePushClick();
          }
          break;

        case "back":
          if (editingField) {
            // Exit editing mode first, don't navigate away
            setEditingField(null);
          } else if (onBack) {
            onBack();
          } else {
            setError(null);
          }
          break;

        case "red":
          handleClear();
          break;

        case "green":
          handleConnect();
          break;

        case "yellow":
          handleQRLoginClick();
          break;

        case "blue":
          handleRemotePushClick();
          break;
      }
    },
    [focusedElement, editingField, handleConnect, handleClear, handleQRLoginClick, handleRemotePushClick]
  );

  useTizenKeys(handleKeyAction);

  return (
    <div className="setup-screen">
      <div className="setup-container">
        <h1 className="setup-title">Manual Setup</h1>
        <p className="setup-subtitle">Configure your kiosk connection</p>

        {error && <div className="setup-error">{error}</div>}

        <div className="setup-form">
          <div className={`input-group ${focusedElement === "serverUrl" ? "focused" : ""} ${editingField === "serverUrl" ? "editing" : ""}`}>
            <label htmlFor="serverUrl">Server URL</label>
            <input
              ref={serverUrlRef}
              id="serverUrl"
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://openframe.example.com"
              readOnly={editingField !== "serverUrl"}
            />
            {focusedElement === "serverUrl" && !editingField && (
              <span className="input-hint">Press OK to edit</span>
            )}
          </div>

          <button
            className={`btn btn-primary qr-login-btn ${focusedElement === "qrLogin" ? "focused" : ""}`}
            onClick={handleQRLoginClick}
          >
            Login with QR Code
          </button>

          <button
            className={`btn btn-secondary qr-login-btn ${focusedElement === "remotePush" ? "focused" : ""}`}
            onClick={handleRemotePushClick}
          >
            Remote Setup
          </button>

          <div className="setup-divider">
            <span>or enter token manually</span>
          </div>

          <div className={`input-group ${focusedElement === "token" ? "focused" : ""} ${editingField === "token" ? "editing" : ""}`}>
            <label htmlFor="token">Kiosk Token</label>
            <input
              ref={tokenRef}
              id="token"
              type="text"
              value={kioskToken}
              onChange={(e) => setKioskToken(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              readOnly={editingField !== "token"}
            />
            {focusedElement === "token" && !editingField && (
              <span className="input-hint">Press OK to edit</span>
            )}
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
          {onBack && (
            <div className="hint">
              <span className="hint-key">Back</span>
              <span className="hint-action">QR Setup</span>
            </div>
          )}
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
          <div className="hint">
            <span className="hint-key yellow">Yellow</span>
            <span className="hint-action">QR Login</span>
          </div>
          <div className="hint">
            <span className="hint-key blue">Blue</span>
            <span className="hint-action">Remote Setup</span>
          </div>
        </div>
      </div>
    </div>
  );
}
