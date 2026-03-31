import { useState, useRef, useCallback, useEffect } from "react";
import { storage, type KioskConfig } from "@/services/storage";

interface SetupScreenProps {
  onConnect: (config: KioskConfig) => void;
  onQRLogin: (serverUrl: string) => void;
  initialConfig?: KioskConfig | null;
}

export function SetupScreen({ onConnect, onQRLogin, initialConfig }: SetupScreenProps) {
  const urlParams = new URLSearchParams(window.location.search);
  const paramServer = urlParams.get("server") || urlParams.get("url") || "";
  const paramToken = urlParams.get("token") || urlParams.get("kiosk") || "";

  const [serverUrl, setServerUrl] = useState(initialConfig?.serverUrl ?? paramServer ?? "");
  const [kioskToken, setKioskToken] = useState(initialConfig?.kioskToken ?? paramToken ?? "");
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const serverUrlRef = useRef<HTMLInputElement>(null);
  const tokenRef = useRef<HTMLInputElement>(null);

  const autoConnect = paramServer && paramToken && !initialConfig;

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
      serverUrlRef.current?.focus();
      return;
    }
    onQRLogin(getNormalizedServerUrl());
  }, [serverUrl, onQRLogin, getNormalizedServerUrl]);

  const handleConnect = useCallback(() => {
    if (!serverUrl.trim()) {
      setError("Please enter a server URL");
      serverUrlRef.current?.focus();
      return;
    }
    if (!kioskToken.trim()) {
      setError("Please enter a kiosk token");
      tokenRef.current?.focus();
      return;
    }

    const config: KioskConfig = {
      serverUrl: getNormalizedServerUrl(),
      kioskToken: kioskToken.trim(),
    };

    if (storage.saveKioskConfig(config)) {
      setError(null);
      onConnect(config);
    } else {
      setError("Failed to save configuration");
    }
  }, [serverUrl, kioskToken, onConnect, getNormalizedServerUrl]);

  useEffect(() => {
    if (autoConnect) {
      handleConnect();
    }
  }, [autoConnect, handleConnect]);

  const handleClear = useCallback(() => {
    storage.clearKioskConfig();
    setServerUrl("");
    setKioskToken("");
    setShowTokenInput(false);
    setError(null);
    serverUrlRef.current?.focus();
  }, []);

  return (
    <div className="setup-screen">
      <div className="setup-container">
        <div className="setup-logo">OF</div>
        <h1 className="setup-title">OpenFrame</h1>
        <p className="setup-subtitle">Connect to your OpenFrame server</p>

        {error && <div className="setup-error">{error}</div>}

        <div className="setup-form">
          <div className="input-group">
            <label htmlFor="serverUrl">Server URL</label>
            <input
              ref={serverUrlRef}
              id="serverUrl"
              type="url"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://your-server.openframe.us"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleQRLoginClick();
              }}
            />
          </div>

          <button
            className="btn btn-primary full-width"
            onClick={handleQRLoginClick}
          >
            Login with QR Code
          </button>

          <div className="setup-divider">
            <span>or</span>
          </div>

          {!showTokenInput ? (
            <button
              className="btn btn-secondary full-width"
              onClick={() => setShowTokenInput(true)}
            >
              Enter Token Manually
            </button>
          ) : (
            <>
              <div className="input-group">
                <label htmlFor="token">Kiosk Token</label>
                <input
                  ref={tokenRef}
                  id="token"
                  type="text"
                  inputMode="text"
                  autoCapitalize="off"
                  autoCorrect="off"
                  value={kioskToken}
                  onChange={(e) => setKioskToken(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConnect();
                  }}
                />
              </div>

              <button className="btn btn-primary full-width" onClick={handleConnect}>
                Connect
              </button>
            </>
          )}

          {(initialConfig || serverUrl || kioskToken) && (
            <button className="btn btn-ghost full-width" onClick={handleClear}>
              Clear Configuration
            </button>
          )}
        </div>

        <p className="setup-hint">
          Tap the bottom-right corner of the kiosk to access settings
        </p>
      </div>
    </div>
  );
}
