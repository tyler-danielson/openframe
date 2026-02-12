import { useState, useEffect, useCallback } from "react";
import { SetupScreen } from "@/components/SetupScreen";
import { QRLoginScreen } from "@/components/QRLoginScreen";
import { RemotePushScreen } from "@/components/RemotePushScreen";
import { KioskFrame } from "@/components/KioskFrame";
import { RemoteHandler } from "@/components/RemoteHandler";
import { storage, type KioskConfig } from "@/services/storage";
import { disableScreenSaver, isTizenTV } from "@/hooks/useTizenKeys";
import "@/styles/tv.css";

type AppState = "loading" | "setup" | "qr-login" | "remote-push" | "kiosk";

export function App() {
  const [appState, setAppState] = useState<AppState>("loading");
  const [config, setConfig] = useState<KioskConfig | null>(null);
  const [showSettings, setShowSettings] = useState(false);
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
    setShowSettings((prev) => !prev);
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
          <KioskFrame config={config} onBack={handleBack} />
          <RemoteHandler
            onBack={handleBack}
            showSettings={showSettings}
            onToggleSettings={handleToggleSettings}
          />
        </>
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
              <button className="btn btn-secondary" onClick={handleBack}>
                Change Configuration
              </button>
              <button className="btn btn-primary" onClick={() => setShowSettings(false)}>
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
