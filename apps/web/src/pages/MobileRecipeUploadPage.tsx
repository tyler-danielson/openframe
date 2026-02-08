import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  Camera,
  CheckCircle,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  ChefHat,
  Sparkles,
} from "lucide-react";
import { api } from "../services/api";

type UploadStatus = "idle" | "uploading" | "processing" | "success" | "error";

interface ParsedRecipe {
  id: string;
  title: string;
}

export function MobileRecipeUploadPage() {
  const { token } = useParams<{ token: string }>();
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [parsedRecipe, setParsedRecipe] = useState<ParsedRecipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setIsValid(false);
      return;
    }

    api
      .getRecipeUploadTokenInfo(token)
      .then((info) => {
        setExpiresAt(new Date(info.expiresAt));
        setIsValid(true);
      })
      .catch(() => {
        setIsValid(false);
      });
  }, [token]);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0 || !token) return;

    const file = files[0];
    if (!file) return;

    // Validate file type
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Please select a valid image file (JPEG, PNG, or WebP)");
      return;
    }

    // Create preview
    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);
    setError(null);
    setStatus("uploading");

    try {
      // Upload and process with AI
      setStatus("processing");
      const result = await api.uploadRecipeWithToken(token, file);
      setParsedRecipe({ id: result.id, title: result.title });
      setStatus("success");
    } catch (err) {
      console.error("Upload failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to process recipe. Please try again."
      );
      setStatus("error");
    }
  };

  const handleReset = () => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    setPreview(null);
    setParsedRecipe(null);
    setStatus("idle");
    setError(null);
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
            This upload link is no longer valid. Please scan a new QR code from
            the recipes page.
          </p>
        </div>
      </div>
    );
  }

  // Success state
  if (status === "success" && parsedRecipe) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">
            Recipe Added!
          </h1>
          <p className="text-primary font-medium mb-4">{parsedRecipe.title}</p>
          <p className="text-muted-foreground mb-6">
            Your recipe has been processed and added to your collection. You can
            view it on the main device.
          </p>
          <button
            onClick={handleReset}
            className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors"
          >
            Add Another Recipe
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-safe">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mx-auto mb-3">
          <ChefHat className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-xl font-semibold text-foreground mb-1">
          Snap a Recipe
        </h1>
        <p className="text-muted-foreground text-sm">
          Take a photo of your recipe card or cookbook page
        </p>
      </div>

      {/* Upload Area */}
      <div className="border-2 border-dashed rounded-2xl p-8 text-center border-border hover:border-primary/50 transition-colors">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />

        {status === "uploading" || status === "processing" ? (
          <div className="py-4">
            {preview && (
              <div className="mb-4 mx-auto w-32 h-32 rounded-lg overflow-hidden">
                <img
                  src={preview}
                  alt="Recipe preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-3" />
            <p className="text-foreground font-medium">
              {status === "uploading" ? "Uploading..." : "Processing with AI..."}
            </p>
            {status === "processing" && (
              <p className="text-sm text-muted-foreground mt-2 flex items-center justify-center gap-1">
                <Sparkles className="h-4 w-4" />
                Extracting recipe details
              </p>
            )}
          </div>
        ) : (
          <>
            <ImageIcon className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-foreground font-medium mb-2">
              Tap to select an image
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              AI will extract ingredients & instructions
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.setAttribute("capture", "environment");
                    fileInputRef.current.click();
                    fileInputRef.current.removeAttribute("capture");
                  }
                }}
                className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <Camera className="h-5 w-5" />
                Take Photo
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 px-4 bg-accent text-accent-foreground rounded-xl font-medium hover:bg-accent/80 transition-colors flex items-center justify-center gap-2"
              >
                <ImageIcon className="h-5 w-5" />
                Choose from Gallery
              </button>
            </div>
          </>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-destructive">{error}</p>
              <button
                onClick={handleReset}
                className="text-sm text-destructive underline mt-2"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Features Info */}
      <div className="mt-6 space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span>AI extracts title, ingredients & instructions</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span>Automatically detects prep & cook times</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span>Recipe appears on main device instantly</span>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-6 text-center text-xs text-muted-foreground">
        <p>For best results, use good lighting and a clear image.</p>
        <p>This link will expire when closed on the main device.</p>
      </div>
    </div>
  );
}
