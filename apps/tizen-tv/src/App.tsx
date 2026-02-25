import { useState, useEffect, useCallback } from "react";
import { SetupScreen } from "@/components/SetupScreen";
import { QRLoginScreen } from "@/components/QRLoginScreen";
import { RemotePushScreen } from "@/components/RemotePushScreen";
import { KioskFrame, refreshKiosk } from "@/components/KioskFrame";
import { RemoteHandler } from "@/components/RemoteHandler";
import { storage, type KioskConfig } from "@/services/storage";
import { disableScreenSaver, isTizenTV } from "@/hooks/useTizenKeys";
import "@/styles/tv.css";

type AppState = "loading" | "setup" | "qr-login" | "remote-push" | "kiosk";

export function App() {
  const [appState, setAppState] = useState<AppState>("loading");
  const [config, setConfig] = useState<KioskConfig | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsFocusIdx, setSettingsFocusIdx] = useState(0);
  const [qrServerUrl, setQrServerUrl] = useState("");

  // Initialize app
  useEffect(() => {
    // Disable screen saver on Tizen TV
    if (isTizenTV()) {
      disableScreenSaver();
    }

    // Check for saved configuration
    const savedConfig = storage.getKioskConfig();
    if (savedConfig) {
      setConfig(savedConfig);
      setAppState("kiosk");
    } else {
      setAppState("setup");
    }
  }, []);

  const handleConnect = useCallback((newConfig: KioskConfig) => {
    setConfig(newConfig);
    setAppState("kiosk");
    setShowSettings(false);
  }, []);

  const handleQRLogin = useCallback((serverUrl: string) => {
    setQrServerUrl(serverUrl);
    setAppState("qr-login");
  }, []);

  const handleRemotePush = useCallback((serverUrl: string) => {
    setQrServerUrl(serverUrl);
    setAppState("remote-push");
  }, []);

  const handleBack = useCallback(() => {
    setAppState("setup");
    setShowSettings(false);
  }, []);

  const handleToggleSettings = useCallback(() => {
    setShowSettings((prev) => {
      if (!prev) setSettingsFocusIdx(0); // reset focus to first button when opening
      return !prev;
    });
  }, []);

  // 0 = Retry Connection, 1 = Change Server URL, 2 = Close
  const SETTINGS_BUTTON_COUNT = 3;
  const handleSettingsNavigate = useCallback(
    (action: "left" | "right" | "enter" | "back") => {
      switch (action) {
        case "left":
          setSettingsFocusIdx((i) => (i - 1 + SETTINGS_BUTTON_COUNT) % SETTINGS_BUTTON_COUNT);
          break;
        case "right":
          setSettingsFocusIdx((i) => (i + 1) % SETTINGS_BUTTON_COUNT);
          break;
        case "enter":
          setSettingsFocusIdx((i) => {
            if (i === 0) { setShowSettings(false); refreshKiosk(); }
            else if (i === 1) { handleBack(); }
            else { setShowSettings(false); }
            return i;
          });
          break;
        case "back":
          setShowSettings(false);
          break;
      }
    },
    [handleBack]
  );

  // Called by KioskFrame after all auto-retries fail — open settings so the
  // user can immediately update the server URL without having to find the Menu button.
  const handleConnectionError = useCallback(() => {
    setShowSettings(true);
  }, []);

  // Loading state
  if (appState === "loading") {
    return (
      <div className="app-loading">
        <div className="spinner" />
        <p>Loading OpenFrame Kiosk...</p>
      </div>
    );
  }

  // Setup state
  if (appState === "setup") {
    return <SetupScreen onConnect={handleConnect} onQRLogin={handleQRLogin} onRemotePush={handleRemotePush} initialConfig={config} />;
  }

  // QR Login state
  if (appState === "qr-login") {
    return (
      <QRLoginScreen
        serverUrl={qrServerUrl}
        onConnect={handleConnect}
        onBack={handleBack}
      />
    );
  }

  // Remote Push state
  if (appState === "remote-push") {
    return (
      <RemotePushScreen
        serverUrl={qrServerUrl}
        onConnect={handleConnect}
        onBack={handleBack}
      />
    );
  }

  // Kiosk state
  return (
    <div className="app-kiosk">
      {config && (
        <>
          <KioskFrame
            config={config}
            onBack={handleBack}
            onConnectionError={handleConnectionError}
          />
          <RemoteHandler
            onBack={handleBack}
            showSettings={showSettings}
            onToggleSettings={handleToggleSettings}
            onSettingsNavigate={handleSettingsNavigate}
          />
        </>
      )}

      {/* Persistent hint — visible when kiosk is running normally so the user
          always knows how to reach settings even if the server goes down. */}
      {!showSettings && (
        <div className="menu-hint-badge">
          MENU → Settings
        </div>
      )}

      {/* Settings overlay */}
      {showSettings && (
        <div className="settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
            <h2>Settings</h2>

            <div className="settings-info">
              <div className="info-item">
                <span className="info-label">Server:</span>
                <span className="info-value">{config?.serverUrl}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Token:</span>
                <span className="info-value">{config?.kioskToken.slice(0, 8)}...</span>
              </div>
            </div>

            <div className="settings-actions">
              <button
                className={`btn btn-primary${settingsFocusIdx === 0 ? " focused" : ""}`}
                onClick={() => { setShowSettings(false); refreshKiosk(); }}
              >
                Retry Connection
              </button>
              <button
                className={`btn btn-secondary${settingsFocusIdx === 1 ? " focused" : ""}`}
                onClick={handleBack}
              >
                Change Server URL
              </button>
              <button
                className={`btn btn-ghost${settingsFocusIdx === 2 ? " focused" : ""}`}
                onClick={() => setShowSettings(false)}
              >
                Close
              </button>
            </div>

            <p className="settings-hint">Press Back or Menu to close</p>
          </div>
        </div>
      )}
    </div>
  );
}
