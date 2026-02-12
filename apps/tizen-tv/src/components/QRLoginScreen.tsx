import { useState, useEffect, useCallback, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useTizenKeys, type KeyAction } from "@/hooks/useTizenKeys";
import { storage, type KioskConfig } from "@/services/storage";
import "@/styles/tv.css";

interface QRLoginScreenProps {
  serverUrl: string;
  onConnect: (config: KioskConfig) => void;
  onBack: () => void;
}

type QRState = "loading" | "displaying" | "approved" | "expired" | "error";

export function QRLoginScreen({ serverUrl, onConnect, onBack }: QRLoginScreenProps) {
  const [state, setState] = useState<QRState>("loading");
  const [deviceCode, setDeviceCode] = useState("");
  const [userCode, setUserCode] = useState("");
  const [verificationUrl, setVerificationUrl] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const requestDeviceCode = useCallback(async () => {
    cleanup();
    setState("loading");
    setError(null);

    try {
      const response = await fetch(`${serverUrl}/api/v1/auth/device-code`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const result = await response.json();
      const data = result.data;

      setDeviceCode(data.deviceCode);
      setUserCode(data.userCode);
      setVerificationUrl(data.verificationUrl);
      setSecondsLeft(data.expiresIn);
      setState("displaying");

      // Start countdown
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

      // Start polling
      pollIntervalRef.current = setInterval(async () => {
        try {
          const pollResponse = await fetch(
            `${serverUrl}/api/v1/auth/device-code/poll`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ deviceCode: data.deviceCode }),
            }
          );

          if (!pollResponse.ok) return;

          const pollResult = await pollResponse.json();
          const pollData = pollResult.data;

          if (pollData.status === "approved" && pollData.kioskToken) {
            cleanup();
            setState("approved");

            // Save config and connect
            const config: KioskConfig = {
              serverUrl,
              kioskToken: pollData.kioskToken,
            };
            storage.saveKioskConfig(config);

            // Short delay to show success state
            setTimeout(() => {
              onConnect(config);
            }, 1500);
          } else if (pollData.status === "expired") {
            cleanup();
            setState("expired");
          } else if (pollData.status === "denied") {
            cleanup();
            setError("Login was denied");
            setState("error");
          }
        } catch {
          // Polling errors are silent - will retry
        }
      }, 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect to server");
      setState("error");
    }
  }, [serverUrl, onConnect, cleanup]);

  // Request device code on mount
  useEffect(() => {
    requestDeviceCode();
    return cleanup;
  }, [requestDeviceCode, cleanup]);

  const handleKeyAction = useCallback(
    (action: KeyAction) => {
      switch (action) {
        case "back":
          cleanup();
          onBack();
          break;
        case "enter":
          if (state === "expired" || state === "error") {
            requestDeviceCode();
          }
          break;
      }
    },
    [state, onBack, cleanup, requestDeviceCode]
  );

  useTizenKeys(handleKeyAction);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const formatUserCode = (code: string) => {
    if (code.length === 6) {
      return `${code.slice(0, 3)}-${code.slice(3)}`;
    }
    return code;
  };

  return (
    <div className="setup-screen">
      <div className="qr-login-container">
        <h1 className="setup-title">Login with QR Code</h1>

        {state === "loading" && (
          <div className="qr-loading">
            <div className="spinner" />
            <p>Generating login code...</p>
          </div>
        )}

        {state === "displaying" && (
          <>
            <div className="qr-display">
              <div className="qr-code-wrapper">
                <QRCodeSVG
                  value={verificationUrl}
                  size={280}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  level="M"
                />
              </div>

              <div className="qr-instructions">
                <div className="qr-step">
                  <span className="qr-step-number">1</span>
                  <span>Scan the QR code with your phone</span>
                </div>
                <div className="qr-step">
                  <span className="qr-step-number">2</span>
                  <span>Log in to your account</span>
                </div>
                <div className="qr-step">
                  <span className="qr-step-number">3</span>
                  <span>Approve this device</span>
                </div>

                <div className="qr-or-divider">
                  <span>or enter this code manually</span>
                </div>

                <div className="qr-user-code">{formatUserCode(userCode)}</div>

                <div className="qr-timer">
                  Code expires in <strong>{formatTime(secondsLeft)}</strong>
                </div>
              </div>
            </div>
          </>
        )}

        {state === "approved" && (
          <div className="qr-approved">
            <div className="qr-success-icon">&#10003;</div>
            <h2>Device Approved!</h2>
            <p>Connecting to your kiosk...</p>
          </div>
        )}

        {state === "expired" && (
          <div className="qr-expired">
            <h2>Code Expired</h2>
            <p>The login code has expired.</p>
            <button className="btn btn-primary focused" onClick={requestDeviceCode}>
              Generate New Code
            </button>
            <p className="qr-hint">Press <strong>OK/Enter</strong> to generate a new code</p>
          </div>
        )}

        {state === "error" && (
          <div className="qr-error">
            <h2>Error</h2>
            <p>{error || "Something went wrong"}</p>
            <button className="btn btn-primary focused" onClick={requestDeviceCode}>
              Try Again
            </button>
            <p className="qr-hint">Press <strong>OK/Enter</strong> to try again</p>
          </div>
        )}

        <div className="setup-hints">
          <div className="hint">
            <span className="hint-key">Back</span>
            <span className="hint-action">Return to Setup</span>
          </div>
          {(state === "expired" || state === "error") && (
            <div className="hint">
              <span className="hint-key">OK/Enter</span>
              <span className="hint-action">Regenerate Code</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
