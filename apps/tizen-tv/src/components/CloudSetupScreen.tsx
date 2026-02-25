import { useState, useEffect, useCallback, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useTizenKeys, type KeyAction } from "@/hooks/useTizenKeys";
import { storage, type KioskConfig } from "@/services/storage";
import "@/styles/tv.css";

const CLOUD_URL = "https://openframe.us";
const POLL_INTERVAL_MS = 3000;
const SETUP_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface CloudSetupScreenProps {
  onConnect: (config: KioskConfig) => void;
  onManualSetup: () => void;
}

type SetupState = "waiting" | "completed" | "expired";

function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older Tizen
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function CloudSetupScreen({ onConnect, onManualSetup }: CloudSetupScreenProps) {
  // Stable UUID — useRef so re-renders don't regenerate it
  const codeRef = useRef<string>(generateUUID());
  const [code] = useState(() => codeRef.current);

  const [state, setState] = useState<SetupState>("waiting");
  const [secondsLeft, setSecondsLeft] = useState(Math.floor(SETUP_TTL_MS / 1000));
  const [dots, setDots] = useState("");

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dotsRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    if (dotsRef.current) { clearInterval(dotsRef.current); dotsRef.current = null; }
  }, []);

  const startPolling = useCallback((currentCode: string) => {
    cleanup();
    setState("waiting");
    setSecondsLeft(Math.floor(SETUP_TTL_MS / 1000));

    // Animated dots
    dotsRef.current = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 500);

    // Countdown timer
    countdownRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          cleanup();
          setState("expired");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Poll cloud for completion
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `${CLOUD_URL}/api/tv-setup?code=${encodeURIComponent(currentCode)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "completed" && data.serverUrl && data.kioskToken) {
          cleanup();
          setState("completed");
          const config: KioskConfig = {
            serverUrl: data.serverUrl,
            kioskToken: data.kioskToken,
          };
          storage.saveKioskConfig(config);
          setTimeout(() => onConnect(config), 1500);
        }
      } catch {
        // Network errors are silent — will retry
      }
    }, POLL_INTERVAL_MS);
  }, [cleanup, onConnect]);

  const regenerate = useCallback(() => {
    codeRef.current = generateUUID();
    // Force re-render with new code by restarting polling with new UUID
    startPolling(codeRef.current);
  }, [startPolling]);

  useEffect(() => {
    startPolling(codeRef.current);
    return cleanup;
  }, [startPolling, cleanup]);

  const handleKeyAction = useCallback(
    (action: KeyAction) => {
      switch (action) {
        case "back":
          cleanup();
          onManualSetup();
          break;
        case "enter":
          if (state === "expired") regenerate();
          break;
        case "red":
          cleanup();
          onManualSetup();
          break;
      }
    },
    [state, cleanup, onManualSetup, regenerate]
  );

  useTizenKeys(handleKeyAction);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const qrUrl = `${CLOUD_URL}/tv-setup/${codeRef.current}`;
  const shortCode = codeRef.current.slice(0, 8).toUpperCase();

  return (
    <div className="setup-screen">
      <div className="qr-login-container">
        <h1 className="setup-title">Connect TV with Phone</h1>

        {state === "waiting" && (
          <>
            <div className="qr-display">
              <div className="qr-code-wrapper">
                <QRCodeSVG
                  value={qrUrl}
                  size={260}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  level="M"
                />
              </div>

              <div className="qr-instructions">
                <div className="qr-step">
                  <span className="qr-step-number">1</span>
                  <span>Scan QR code with your phone</span>
                </div>
                <div className="qr-step">
                  <span className="qr-step-number">2</span>
                  <span>Enter your server URL on the phone</span>
                </div>
                <div className="qr-step">
                  <span className="qr-step-number">3</span>
                  <span>Log in and pick a kiosk</span>
                </div>

                <div className="qr-or-divider">
                  <span>Code: <strong>{shortCode}</strong></span>
                </div>

                <div className="qr-timer">
                  Waiting for phone{dots} &nbsp; Expires in{" "}
                  <strong>{formatTime(secondsLeft)}</strong>
                </div>
              </div>
            </div>
          </>
        )}

        {state === "completed" && (
          <div className="qr-approved">
            <div className="qr-success-icon">&#10003;</div>
            <h2>Setup Complete!</h2>
            <p>Connecting to your kiosk...</p>
          </div>
        )}

        {state === "expired" && (
          <div className="qr-expired">
            <h2>Code Expired</h2>
            <p>The setup code has expired.</p>
            <button className="btn btn-primary focused" onClick={regenerate}>
              Generate New Code
            </button>
            <p className="qr-hint">
              Press <strong>OK/Enter</strong> to generate a new code
            </p>
          </div>
        )}

        <div className="setup-hints">
          <div className="hint">
            <span className="hint-key">Back</span>
            <span className="hint-action">Manual Setup</span>
          </div>
          {state === "expired" && (
            <div className="hint">
              <span className="hint-key">OK/Enter</span>
              <span className="hint-action">New Code</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
