import { useState, useEffect, useCallback } from "react";
import { SetupScreen } from "@/components/SetupScreen";
import { QRLoginScreen } from "@/components/QRLoginScreen";
import { KioskFrame } from "@/components/KioskFrame";
import { KeepAlive } from "@/components/KeepAlive";
import { initAlexa, isRunningInAlexa, onMessage } from "@/services/alexa";
import { storage, type KioskConfig } from "@/services/storage";
import "@/styles/echo-show.css";

type AppState = "loading" | "setup" | "qr-login" | "kiosk";

export function App() {
  const [appState, setAppState] = useState<AppState>("loading");
  const [config, setConfig] = useState<KioskConfig | null>(null);
  const [qrServerUrl, setQrServerUrl] = useState("");

  // Initialize: detect Alexa vs Silk mode, load config
  useEffect(() => {
    async function init() {
      await initAlexa();

      // Check for saved configuration
      const savedConfig = storage.getKioskConfig();
      if (savedConfig) {
        setConfig(savedConfig);
        setAppState("kiosk");
      } else if (storage.needsSetup()) {
        setAppState("setup");
      } else {
        setAppState("setup");
      }
    }

    init();
  }, []);

  // Listen for Alexa setup messages (when Lambda tells us to show setup)
  useEffect(() => {
    if (!isRunningInAlexa()) return;

    onMessage((message) => {
      if (message.action === "setup") {
        setAppState("setup");
      }
    });
  }, []);

  const handleConnect = useCallback((newConfig: KioskConfig) => {
    setConfig(newConfig);
    setAppState("kiosk");
  }, []);

  const handleQRLogin = useCallback((serverUrl: string) => {
    setQrServerUrl(serverUrl);
    setAppState("qr-login");
  }, []);

  const handleBack = useCallback(() => {
    setAppState("setup");
  }, []);

  // Loading state
  if (appState === "loading") {
    return (
      <div className="app-loading">
        <div className="spinner" />
        <p>Loading OpenFrame...</p>
      </div>
    );
  }

  // Setup state
  if (appState === "setup") {
    return (
      <SetupScreen
        onConnect={handleConnect}
        onQRLogin={handleQRLogin}
        initialConfig={config}
      />
    );
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

  // Kiosk state
  return (
    <div className="app-kiosk">
      {config && <KioskFrame config={config} onBack={handleBack} />}
      <KeepAlive />
    </div>
  );
}
