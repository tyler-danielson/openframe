import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Upload, Camera, CheckCircle, AlertCircle, Loader2, Image as ImageIcon, X } from "lucide-react";
import { api } from "../services/api";

interface UploadedFile {
  id: string;
  filename: string;
  preview?: string;
}

export function MobileUploadPage() {
  const { token } = useParams<{ token: string }>();
  const [albumName, setAlbumName] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setIsValid(false);
      return;
    }

    api.getUploadTokenInfo(token)
      .then((info) => {
        setAlbumName(info.albumName);
        setExpiresAt(new Date(info.expiresAt));
        setIsValid(true);
      })
      .catch(() => {
        setIsValid(false);
      });
  }, [token]);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || !token) return;

    const validFiles = Array.from(files).filter((file) =>
      ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)
    );

    if (validFiles.length === 0) {
      setError("Please select valid image files (JPEG, PNG, WebP, GIF)");
      return;
    }

    setError(null);
    setIsUploading(true);

    for (const file of validFiles) {
      try {
        // Create preview
        const preview = URL.createObjectURL(file);

        const result = await api.uploadWithToken(token, file);
        setUploadedFiles((prev) => [
          ...prev,
          { id: result.id, filename: result.filename, preview },
        ]);
      } catch (err) {
        console.error("Upload failed:", err);
        setError(`Failed to upload ${file.name}`);
      }
    }

    setIsUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
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
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Validating upload link...</p>
        </div>
      </div>
    );
  }

  // Invalid/expired token
  if (!isValid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">
            Link Expired or Invalid
          </h1>
          <p className="text-muted-foreground">
            This upload link is no longer valid. Please scan a new QR code from the photos page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-safe">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mx-auto mb-3">
          <Upload className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-xl font-semibold text-foreground mb-1">
          Upload to Album
        </h1>
        <p className="text-primary font-medium">{albumName}</p>
      </div>

      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />

        {isUploading ? (
          <div className="py-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-3" />
            <p className="text-foreground font-medium">Uploading...</p>
          </div>
        ) : (
          <>
            <ImageIcon className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-foreground font-medium mb-2">
              Tap to select photos
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              or drag and drop
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <ImageIcon className="h-5 w-5" />
                Choose from Gallery
              </button>

              <button
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.setAttribute("capture", "environment");
                    fileInputRef.current.click();
                    fileInputRef.current.removeAttribute("capture");
                  }
                }}
                className="w-full py-3 px-4 bg-accent text-accent-foreground rounded-xl font-medium hover:bg-accent/80 transition-colors flex items-center justify-center gap-2"
              >
                <Camera className="h-5 w-5" />
                Take Photo
              </button>
            </div>
          </>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Uploaded ({uploadedFiles.length})
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="relative aspect-square rounded-lg overflow-hidden bg-accent"
              >
                {file.preview ? (
                  <img
                    src={file.preview}
                    alt={file.filename}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-green-500" />
                  </div>
                )}
                <button
                  onClick={() => removeUploadedFile(file.id)}
                  className="absolute top-1 right-1 p-1 bg-black/50 rounded-full"
                >
                  <X className="h-4 w-4 text-white" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-1">
                  <CheckCircle className="h-4 w-4 text-green-400 mx-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="mt-6 text-center text-xs text-muted-foreground">
        <p>Photos are uploaded directly to your album.</p>
        <p>This link will expire when closed on the main device.</p>
      </div>
    </div>
  );
}
