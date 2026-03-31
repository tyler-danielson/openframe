"use client";

import { useEffect, useState, useRef, useCallback } from "react";

// Minimal QR code generation via external API (no dependency needed)
function qrImageUrl(text: string, size = 280): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&margin=8`;
}

type LinkState = "connecting" | "waiting" | "approved" | "expired" | "error";

export default function LinkPage() {
  const [state, setState] = useState<LinkState>("connecting");
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [userCode, setUserCode] = useState("");
  const [verificationUrl, setVerificationUrl] = useState("");
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [error, setError] = useState("");

  const deviceCodeRef = useRef("");
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    pollTimerRef.current = null;
    countdownTimerRef.current = null;
  }, []);

  const requestCode = useCallback(async () => {
    cleanup();
    setState("connecting");

    try {
      const res = await fetch("/api/v1/auth/device-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });

      if (!res.ok) throw new Error(`Server returned ${res.status}`);

      const json = await res.json();
      const { deviceCode, userCode: code, verificationUrl: url, expiresIn } = json.data;

      deviceCodeRef.current = deviceCode;
      setUserCode(code);
      setVerificationUrl(url);
      setSecondsRemaining(expiresIn);
      setQrUrl(qrImageUrl(url));
      setState("waiting");

      // Countdown
      countdownTimerRef.current = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            cleanup();
            setState("expired");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Poll
      pollTimerRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch("/api/v1/auth/device-code/poll", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deviceCode }),
          });
          if (!pollRes.ok) return;
          const pollJson = await pollRes.json();
          const { status, kioskToken } = pollJson.data;

          if (status === "approved" && kioskToken) {
            cleanup();
            setState("approved");
            setTimeout(() => {
              window.location.href = `/app/kiosk/${kioskToken}`;
            }, 1500);
          } else if (status === "expired") {
            cleanup();
            setState("expired");
          } else if (status === "denied") {
            cleanup();
            setState("error");
            setError("Pairing was denied.");
          }
        } catch {
          // silent
        }
      }, 4000);
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Connection failed");
    }
  }, [cleanup]);

  useEffect(() => {
    requestCode();
    return cleanup;
  }, [requestCode, cleanup]);

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  const fmtCode = (c: string) => c.length === 6 ? `${c.slice(0, 3)}-${c.slice(3)}` : c;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0A0A0A",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{ textAlign: "center", maxWidth: 480, padding: 40 }}>
        <div style={{ fontSize: 36, fontWeight: 700, color: "#FAFAFA", marginBottom: 8 }}>
          OpenFrame
        </div>
        <div style={{ fontSize: 16, color: "#71717A", marginBottom: 40 }}>
          Scan to connect this display
        </div>

        {state === "connecting" && (
          <div style={{ color: "#A1A1AA", fontSize: 18 }}>Connecting...</div>
        )}

        {state === "waiting" && (
          <>
            {qrUrl && (
              <div style={{
                background: "#fff",
                borderRadius: 16,
                padding: 16,
                display: "inline-block",
                marginBottom: 24,
              }}>
                <img src={qrUrl} alt="QR Code" width={248} height={248} style={{ display: "block" }} />
              </div>
            )}

            <div style={{
              fontSize: 40,
              fontWeight: 700,
              fontFamily: "monospace",
              color: "#3B82F6",
              letterSpacing: 4,
              marginBottom: 12,
            }}>
              {fmtCode(userCode)}
            </div>

            <div style={{
              fontSize: 14,
              color: secondsRemaining < 60 ? "#EAB308" : "#71717A",
              marginBottom: 24,
            }}>
              Expires in {fmtTime(secondsRemaining)}
            </div>

            <div style={{ fontSize: 13, color: "#52525B", lineHeight: 1.6 }}>
              Or visit <span style={{ color: "#A1A1AA" }}>{verificationUrl}</span>
              <br />and enter the code above
            </div>
          </>
        )}

        {state === "approved" && (
          <div style={{ color: "#22C55E", fontSize: 24, fontWeight: 600 }}>
            Connected! Redirecting...
          </div>
        )}

        {state === "expired" && (
          <>
            <div style={{ color: "#EAB308", fontSize: 20, fontWeight: 600, marginBottom: 16 }}>
              Code Expired
            </div>
            <button onClick={requestCode} style={{
              background: "#3B82F6", color: "#fff", border: "none", borderRadius: 8,
              padding: "12px 32px", fontSize: 16, fontWeight: 600, cursor: "pointer",
            }}>
              Generate New Code
            </button>
          </>
        )}

        {state === "error" && (
          <>
            <div style={{ color: "#EF4444", fontSize: 18, marginBottom: 16 }}>{error}</div>
            <button onClick={requestCode} style={{
              background: "#3B82F6", color: "#fff", border: "none", borderRadius: 8,
              padding: "12px 32px", fontSize: 16, fontWeight: 600, cursor: "pointer",
            }}>
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
