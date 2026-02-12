import { useState, useEffect, useCallback, useRef } from "react";
import { useTizenKeys, type KeyAction } from "@/hooks/useTizenKeys";
import { storage, type KioskConfig } from "@/services/storage";
import "@/styles/tv.css";

interface RemotePushScreenProps {
  serverUrl: string;
  onConnect: (config: KioskConfig) => void;
  onBack: () => void;
}

type RemotePushState = "loading" | "waiting" | "assigned" | "expired" | "error";

export function RemotePushScreen({ serverUrl, onConnect, onBack }: RemotePushScreenProps) {
  const [state, setState] = useState<RemotePushState>("loading");
  const [registrationId, setRegistrationId] = useState("");
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

  const register = useCallback(async () => {
    cleanup();
    setState("loading");
    setError(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${serverUrl}/api/v1/auth/tv-connect/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const result = await response.json();
      const data = result.data;

      setRegistrationId(data.registrationId);
      setSecondsLeft(data.expiresIn);
      setState("waiting");

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
            `${serverUrl}/api/v1/auth/tv-connect/poll`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ registrationId: data.registrationId }),
            }
          );

          if (!pollResponse.ok) return;

          const pollResult = await pollResponse.json();
          const pollData = pollResult.data;

          if (pollData.status === "assigned" && pollData.kioskToken) {
            cleanup();
            setState("assigned");

            const config: KioskConfig = {
              serverUrl,
              kioskToken: pollData.kioskToken,
            };
            storage.saveKioskConfig(config);

            setTimeout(() => {
              onConnect(config);
            }, 1500);
          } else if (pollData.status === "expired") {
            cleanup();
            setState("expired");
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

  // Register on mount
  useEffect(() => {
    register();
    return cleanup;
  }, [register, cleanup]);

  const handleKeyAction = useCallback(
    (action: KeyAction) => {
      switch (action) {
        case "back":
          cleanup();
          onBack();
          break;
        case "enter":
          if (state === "expired" || state === "error") {
            register();
          }
          break;
      }
    },
    [state, onBack, cleanup, register]
  );

  useTizenKeys(handleKeyAction);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="setup-screen">
      <div className="remote-push-container">
        <h1 className="setup-title">Remote Setup</h1>

        {state === "loading" && (
          <div className="qr-loading">
            <div className="spinner" />
            <p>Registering with server...</p>
          </div>
        )}

        {state === "waiting" && (
          <div className="remote-push-status">
            <div className="spinner" />
            <h2>Waiting for admin to assign a kiosk...</h2>

            <div className="remote-push-steps">
              <div className="qr-step">
                <span className="qr-step-number">1</span>
                <span>Open the web app on your phone or computer</span>
              </div>
              <div className="qr-step">
                <span className="qr-step-number">2</span>
                <span>Go to Settings &rarr; Kiosks</span>
              </div>
              <div className="qr-step">
                <span className="qr-step-number">3</span>
                <span>Find this device under "Pending Devices" and assign a kiosk</span>
              </div>
            </div>

            <div className="qr-timer">
              Expires in <strong>{formatTime(secondsLeft)}</strong>
            </div>
          </div>
        )}

        {state === "assigned" && (
          <div className="qr-approved">
            <div className="qr-success-icon">&#10003;</div>
            <h2>Kiosk Assigned!</h2>
            <p>Connecting to your kiosk...</p>
          </div>
        )}

        {state === "expired" && (
          <div className="qr-expired">
            <h2>Registration Expired</h2>
            <p>The registration window has expired.</p>
            <button className="btn btn-primary focused" onClick={register}>
              Try Again
            </button>
            <p className="qr-hint">Press <strong>OK/Enter</strong> to register again</p>
          </div>
        )}

        {state === "error" && (
          <div className="qr-error">
            <h2>Error</h2>
            <p>{error || "Something went wrong"}</p>
            <button className="btn btn-primary focused" onClick={register}>
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
              <span className="hint-action">Retry</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
