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

      const savedConfig = storage.getKioskConfig();
      if (savedConfig) {
        setConfig(savedConfig);
        setAppState("kiosk");
      } else {
        setAppState("setup");
      }
    }
    init();
  }, []);

  // Listen for Alexa setup messages (Lambda tells us to show setup)
  useEffect(() => {
    if (!isRunningInAlexa()) return;
    onMessage((message) => {
      if (message.action === "setup") {
        setAppState("setup");
      }
    });
  }, []);

  // Request fullscreen on first interaction (Silk browser mode only)
  useEffect(() => {
    if (isRunningInAlexa()) return; // Alexa handles fullscreen itself

    const requestFullscreen = () => {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      } else if ((el as any).webkitRequestFullscreen) {
        (el as any).webkitRequestFullscreen();
      }
      document.removeEventListener("touchstart", requestFullscreen);
      document.removeEventListener("click", requestFullscreen);
    };

    document.addEventListener("touchstart", requestFullscreen, { once: true });
    document.addEventListener("click", requestFullscreen, { once: true });

    return () => {
      document.removeEventListener("touchstart", requestFullscreen);
      document.removeEventListener("click", requestFullscreen);
    };
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

  if (appState === "loading") {
    return (
      <div className="app-loading">
        <div className="spinner" />
        <p>Loading OpenFrame...</p>
      </div>
    );
  }

  if (appState === "setup") {
    return (
      <SetupScreen
        onConnect={handleConnect}
        onQRLogin={handleQRLogin}
        initialConfig={config}
      />
    );
  }

  if (appState === "qr-login") {
    return (
      <QRLoginScreen
        serverUrl={qrServerUrl}
        onConnect={handleConnect}
        onBack={handleBack}
      />
    );
  }

  return (
    <div className="app-kiosk">
      {config && <KioskFrame config={config} onBack={handleBack} />}
      <KeepAlive />
    </div>
  );
}
