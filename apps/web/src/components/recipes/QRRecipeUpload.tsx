import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, Loader2, QrCode, Clock, CheckCircle, Camera } from "lucide-react";
import { Button } from "../ui/Button";
import { api } from "../../services/api";

interface QRRecipeUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function QRRecipeUpload({ isOpen, onClose, onSuccess }: QRRecipeUploadProps) {
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  // Generate token when modal opens
  useEffect(() => {
    if (isOpen && !token) {
      generateToken();
    }
  }, [isOpen]);

  // Update countdown timer
  useEffect(() => {
    if (!expiresAt) return;

    const updateTimer = () => {
      const now = new Date();
      const diff = expiresAt.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining("Expired");
        setToken(null);
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, "0")}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const generateToken = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.createRecipeUploadToken();
      setToken(result.token);
      setExpiresAt(new Date(result.expiresAt));
    } catch (err) {
      setError("Failed to generate upload link");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setToken(null);
    setExpiresAt(null);
    onClose();
  };

  if (!isOpen) return null;

  // Generate the upload URL - this will be a mobile-friendly recipe upload page
  const uploadUrl = token
    ? `${window.location.origin}/upload-recipe/${token}`
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Camera className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Snap a Recipe
              </h2>
              <p className="text-sm text-muted-foreground">
                Upload from your phone
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col items-center">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Generating upload link...</p>
            </div>
          ) : error ? (
            <div className="py-12 flex flex-col items-center gap-4">
              <p className="text-destructive">{error}</p>
              <Button onClick={generateToken}>Try Again</Button>
            </div>
          ) : token ? (
            <>
              {/* QR Code */}
              <div className="bg-white p-4 rounded-xl mb-6">
                <QRCodeSVG
                  value={uploadUrl}
                  size={200}
                  level="M"
                  includeMargin={false}
                />
              </div>

              {/* Instructions */}
              <div className="text-center space-y-2 mb-6">
                <p className="text-foreground font-medium">
                  Scan with your phone camera
                </p>
                <p className="text-sm text-muted-foreground">
                  Take a photo of your recipe card or cookbook page
                </p>
              </div>

              {/* Timer */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-accent/50 px-4 py-2 rounded-full">
                <Clock className="h-4 w-4" />
                <span>Expires in {timeRemaining}</span>
              </div>

              {/* Features */}
              <div className="mt-6 w-full space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>AI automatically extracts recipe details</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>No login required on mobile</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Recipe appears here after upload</span>
                </div>
              </div>
            </>
          ) : (
            <div className="py-12 flex flex-col items-center gap-4">
              <p className="text-muted-foreground">Token expired</p>
              <Button onClick={generateToken}>Generate New Link</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
