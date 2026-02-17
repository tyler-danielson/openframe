import { useState, useEffect, useCallback, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, Clock, RefreshCw } from "lucide-react";
import { api } from "../../services/api";
import { useKiosk } from "../../contexts/KioskContext";

interface KioskQRUploadProps {
  className?: string;
}

export function KioskQRUpload({ className = "" }: KioskQRUploadProps) {
  const { token: kioskToken } = useKiosk();
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [albumName, setAlbumName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const isLoadingRef = useRef(false);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const generateToken = useCallback(async () => {
    if (!kioskToken || isLoadingRef.current) return;

    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.getKioskUploadToken(kioskToken);
      setUploadUrl(result.uploadUrl);
      setExpiresAt(new Date(result.expiresAt));
      setAlbumName(result.albumName);
    } catch (err) {
      setError("Failed to generate QR code");
      console.error("Kiosk upload token error:", err);
      // Schedule a retry after 10 seconds on failure
      retryTimeoutRef.current = setTimeout(() => {
        isLoadingRef.current = false;
        generateToken();
      }, 10000);
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, [kioskToken]);

  // Generate token on mount
  useEffect(() => {
    generateToken();
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, [generateToken]);

  // Update countdown timer and auto-refresh before expiry
  useEffect(() => {
    if (!expiresAt) return;

    const updateTimer = () => {
      const now = new Date();
      const diff = expiresAt.getTime() - now.getTime();

      // Refresh token when 2 minutes remaining
      if (diff <= 2 * 60 * 1000 && diff > 0) {
        if (!isLoadingRef.current) {
          generateToken();
        }
        return;
      }

      if (diff <= 0) {
        setTimeRemaining("Expired");
        if (!isLoadingRef.current) {
          generateToken();
        }
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, "0")}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, generateToken]);

  // Don't render if no kiosk token
  if (!kioskToken) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 bg-card/90 backdrop-blur-sm border border-primary/30 rounded-xl p-4 shadow-lg ${className}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
          <QrCode className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-primary">Upload Photos</p>
          <p className="text-xs text-muted-foreground">{albumName}</p>
        </div>
      </div>

      {isLoading && !uploadUrl ? (
        <div className="w-32 h-32 flex items-center justify-center bg-muted/50 rounded-lg">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="w-32 h-32 flex flex-col items-center justify-center bg-muted/50 rounded-lg gap-2">
          <p className="text-xs text-destructive text-center px-2">{error}</p>
          <button
            onClick={generateToken}
            className="text-xs text-primary hover:underline"
          >
            Retry
          </button>
        </div>
      ) : uploadUrl ? (
        <>
          <div className="bg-white p-2 rounded-lg">
            <QRCodeSVG
              value={uploadUrl}
              size={120}
              level="M"
              includeMargin={false}
            />
          </div>
          <div className="flex items-center justify-center gap-1.5 mt-3 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{timeRemaining}</span>
          </div>
        </>
      ) : (
        <div className="w-32 h-32 flex items-center justify-center bg-muted/50 rounded-lg">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
