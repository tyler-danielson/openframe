import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Camera, CheckCircle, AlertCircle, Loader2, Image as ImageIcon, X, Check, RotateCw } from "lucide-react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { api } from "../services/api";

interface UploadedFile {
  id: string;
  filename: string;
  preview?: string;
}

interface PendingFile {
  file: File;
  preview: string;
}

// Helper to create cropped image blob
async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = new Image();
  image.src = imageSrc;
  await new Promise((resolve) => {
    image.onload = resolve;
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2d context");

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas is empty"));
      },
      "image/jpeg",
      0.9
    );
  });
}

export function MobileUploadPage() {
  const { token } = useParams<{ token: string }>();
  const [albumName, setAlbumName] = useState<string>("");
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Cropping state
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  // Validate token on mount
  const validateToken = useCallback(() => {
    if (!token) {
      setIsValid(false);
      setValidationError("No upload token provided");
      return;
    }

    setIsValid(null); // loading state
    setValidationError(null);

    api.getUploadTokenInfo(token)
      .then((info) => {
        setAlbumName(info.albumName);
        setIsValid(true);
      })
      .catch((err) => {
        setIsValid(false);
        // Distinguish between expired token and network errors
        if (err instanceof TypeError || err.message?.includes("fetch")) {
          setValidationError("Cannot reach server. Make sure you're on the same network.");
        } else {
          setValidationError("Link expired. Please scan a new QR code.");
        }
      });
  }, [token]);

  useEffect(() => {
    validateToken();
  }, [validateToken]);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || !token) return;

    const validFiles = Array.from(files).filter((file) =>
      ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)
    );

    if (validFiles.length === 0) {
      setError("Please select valid image files");
      return;
    }

    setError(null);
    setIsUploading(true);

    for (const file of validFiles) {
      try {
        const preview = URL.createObjectURL(file);
        const result = await api.uploadWithToken(token, file);
        setUploadedFiles((prev) => [
          ...prev,
          { id: result.id, filename: result.filename, preview },
        ]);
      } catch (err) {
        console.error("Upload failed:", err);
        setError("Failed to upload photo");
        break;
      }
    }

    setIsUploading(false);
  };

  const handleCropConfirm = async () => {
    if (!pendingFiles[0] || !croppedAreaPixels || !token) return;

    setIsUploading(true);

    try {
      const croppedBlob = await getCroppedImg(pendingFiles[0].preview, croppedAreaPixels);
      const croppedFile = new File([croppedBlob], pendingFiles[0].file.name, { type: "image/jpeg" });

      const result = await api.uploadWithToken(token, croppedFile);
      setUploadedFiles((prev) => [
        ...prev,
        { id: result.id, filename: result.filename, preview: URL.createObjectURL(croppedBlob) },
      ]);

      // Clean up and move to next file
      URL.revokeObjectURL(pendingFiles[0].preview);
      setPendingFiles((prev) => prev.slice(1));
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    } catch (err) {
      console.error("Upload failed:", err);
      setError("Failed to upload photo");
    }

    setIsUploading(false);
  };

  const handleSkipCrop = async () => {
    if (!pendingFiles[0] || !token) return;

    setIsUploading(true);

    try {
      const result = await api.uploadWithToken(token, pendingFiles[0].file);
      setUploadedFiles((prev) => [
        ...prev,
        { id: result.id, filename: result.filename, preview: pendingFiles[0]!.preview },
      ]);

      // Move to next file (don't revoke preview since we're using it)
      setPendingFiles((prev) => prev.slice(1));
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    } catch (err) {
      console.error("Upload failed:", err);
      setError("Failed to upload photo");
    }

    setIsUploading(false);
  };

  const handleCancelCrop = () => {
    if (pendingFiles[0]) {
      URL.revokeObjectURL(pendingFiles[0].preview);
      setPendingFiles((prev) => prev.slice(1));
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    }
  };

  const removeUploadedFile = (id: string) => {
    setUploadedFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  // Loading state
  if (isValid === null) {
    return (
      <div className="h-[100dvh] bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-xl text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Invalid/expired token
  if (!isValid) {
    return (
      <div className="h-[100dvh] bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-foreground mb-3">
            {validationError?.includes("network") || validationError?.includes("server")
              ? "Connection Error"
              : "Link Expired"}
          </h1>
          <p className="text-lg text-muted-foreground mb-6">
            {validationError || "Please scan a new QR code"}
          </p>
          <button
            onClick={validateToken}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-lg touch-manipulation"
          >
            <RotateCw className="h-5 w-5 inline mr-2" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Cropping UI
  if (pendingFiles.length > 0) {
    return (
      <div className="h-[100dvh] bg-black flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between bg-black/80 text-white flex-shrink-0 z-10">
          <button
            onClick={handleCancelCrop}
            className="p-2 -ml-2 touch-manipulation"
          >
            <X className="h-7 w-7" />
          </button>
          <div className="text-center">
            <p className="text-lg font-semibold">Crop Photo</p>
            {pendingFiles.length > 1 && (
              <p className="text-sm text-white/60">{pendingFiles.length} remaining</p>
            )}
          </div>
          <button
            onClick={handleSkipCrop}
            disabled={isUploading}
            className="px-3 py-1.5 text-sm bg-white/20 rounded-lg touch-manipulation"
          >
            Skip
          </button>
        </div>

        {/* Cropper */}
        <div className="flex-1 relative">
          <Cropper
            image={pendingFiles[0]!.preview}
            crop={crop}
            zoom={zoom}
            aspect={undefined}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* Zoom slider */}
        <div className="px-8 py-4 bg-black/80 flex-shrink-0">
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full h-2 bg-white/30 rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>

        {/* Confirm button */}
        <div className="p-4 bg-black flex-shrink-0">
          <button
            onClick={handleCropConfirm}
            disabled={isUploading}
            className="w-full py-5 bg-primary text-primary-foreground rounded-2xl font-bold text-xl flex items-center justify-center gap-3 touch-manipulation disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-7 w-7 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Check className="h-7 w-7" />
                Upload
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Uploading state - full screen
  if (isUploading) {
    return (
      <div className="h-[100dvh] bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-6" />
          <p className="text-2xl font-semibold text-foreground">Uploading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-background flex flex-col">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        capture="environment"
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
      />

      {/* Album name header */}
      <div className="px-4 py-4 text-center border-b border-border flex-shrink-0">
        <p className="text-base text-muted-foreground">Uploading to</p>
        <p className="text-xl font-semibold text-primary truncate">{albumName}</p>
      </div>

      {/* Error message */}
      {error && (
        <div className="px-4 py-3 bg-destructive/10 text-destructive text-center flex-shrink-0">
          {error}
        </div>
      )}

      {/* Uploaded files strip */}
      {uploadedFiles.length > 0 && (
        <div className="px-4 py-3 border-b border-border flex-shrink-0">
          <div className="flex gap-3 overflow-x-auto pb-1">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="relative w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden bg-accent"
              >
                {file.preview ? (
                  <img
                    src={file.preview}
                    alt={file.filename}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <CheckCircle className="h-8 w-8 text-green-500" />
                  </div>
                )}
                <button
                  onClick={() => removeUploadedFile(file.id)}
                  className="absolute top-1 right-1 p-1.5 bg-black/70 rounded-full touch-manipulation"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            ))}
            <div className="flex items-center justify-center w-24 h-24 flex-shrink-0 rounded-xl bg-primary/10 text-primary font-bold text-2xl">
              {uploadedFiles.length}
            </div>
          </div>
        </div>
      )}

      {/* Two big side-by-side square buttons */}
      <div className="flex-1 flex items-center justify-center gap-6 p-6">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="aspect-square h-full max-h-[45vw] flex flex-col items-center justify-center gap-6 bg-black text-white border-4 border-primary rounded-3xl active:bg-primary/20 transition-colors touch-manipulation"
        >
          <ImageIcon className="h-24 w-24" />
          <span className="text-5xl font-bold">Gallery</span>
        </button>

        <button
          onClick={() => cameraInputRef.current?.click()}
          className="aspect-square h-full max-h-[45vw] flex flex-col items-center justify-center gap-6 bg-black text-white border-4 border-primary rounded-3xl active:bg-primary/20 transition-colors touch-manipulation"
        >
          <Camera className="h-24 w-24" />
          <span className="text-5xl font-bold">Camera</span>
        </button>
      </div>
    </div>
  );
}
