import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Upload, Image, Facebook, RefreshCw, Check, AlertCircle } from "lucide-react";
import { api } from "../../services/api";
import { Button } from "../ui/Button";

interface AddPhotosModalProps {
  albumId: string;
  albumName: string;
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

type ImportSource = "device" | "google" | "facebook";

export function AddPhotosModal({
  albumId,
  albumName,
  isOpen,
  onClose,
  onImportComplete,
}: AddPhotosModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedSource, setSelectedSource] = useState<ImportSource | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    total: number;
    completed: number;
    errors: number;
  } | null>(null);
  const [importProgress, setImportProgress] = useState<{
    status: "selecting" | "processing" | "importing" | "complete" | "error";
    imported?: number;
    skipped?: number;
    error?: string;
  } | null>(null);

  // Check Google Photos Picker status
  const { data: pickerStatus, isLoading: loadingPickerStatus } = useQuery({
    queryKey: ["google-photos-picker-status"],
    queryFn: () => api.getGooglePhotosPickerStatus(),
    enabled: isOpen,
    retry: false,
  });

  // Upload photos mutation
  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      setUploadProgress({ total: files.length, completed: 0, errors: 0 });

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;
        try {
          await api.uploadPhoto(albumId, file);
          setUploadProgress((prev) =>
            prev ? { ...prev, completed: prev.completed + 1 } : null
          );
        } catch {
          setUploadProgress((prev) =>
            prev ? { ...prev, errors: prev.errors + 1 } : null
          );
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["album-photos", albumId] });
      queryClient.invalidateQueries({ queryKey: ["photo-albums"] });
      queryClient.refetchQueries({ queryKey: ["photo-albums"] });
      onImportComplete();
      setTimeout(() => {
        setUploadProgress(null);
        setSelectedSource(null);
        onClose();
      }, 1500);
    },
  });

  // Import from Google mutation
  const importGoogleMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return api.importPhotosFromGoogle(albumId, sessionId);
    },
    onSuccess: (data) => {
      setImportProgress({
        status: "complete",
        imported: data.imported,
        skipped: data.skipped,
      });
      queryClient.invalidateQueries({ queryKey: ["album-photos", albumId] });
      queryClient.invalidateQueries({ queryKey: ["photo-albums"] });
      queryClient.refetchQueries({ queryKey: ["photo-albums"] });
      onImportComplete();
    },
    onError: (error) => {
      setImportProgress({
        status: "error",
        error: error instanceof Error ? error.message : "Import failed",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadMutation.mutate(files);
    }
  };

  const handleGooglePhotos = async () => {
    setImportProgress({ status: "selecting" });

    try {
      const session = await api.createGooglePhotosPickerSession();

      // Calculate centered popup position
      const width = 900;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      // Open the picker in a centered popup window
      const pickerWindow = window.open(
        session.pickerUri,
        "Google Photos Picker",
        `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
      );

      let isComplete = false;

      // Helper to close the popup safely
      const closePopup = () => {
        try {
          if (pickerWindow && !pickerWindow.closed) {
            pickerWindow.close();
          }
        } catch (e) {
          console.log("Could not close popup:", e);
        }
      };

      // Poll for completion
      console.log(`Starting poll with interval: ${session.pollInterval}ms`);
      const pollInterval = setInterval(async () => {
        if (isComplete) return;

        try {
          const status = await api.getGooglePhotosPickerSessionStatus(session.sessionId);
          console.log(`Poll result - mediaItemsSet: ${status.mediaItemsSet}`);

          if (status.mediaItemsSet) {
            console.log("Media items set! Starting import...");
            isComplete = true;
            clearInterval(pollInterval);

            // Close the popup immediately
            closePopup();

            // Start the import process
            setImportProgress({ status: "importing" });
            importGoogleMutation.mutate(session.sessionId);
          }
        } catch (err) {
          console.error("Poll error:", err);
        }
      }, session.pollInterval);

      // Check if window was closed - give more time for API to process
      const checkWindowClosed = setInterval(() => {
        if (pickerWindow && pickerWindow.closed && !isComplete) {
          clearInterval(checkWindowClosed);
          console.log("Picker window closed, waiting for API to process selection...");
          // Show processing status to user
          setImportProgress({ status: "processing" });
          // Give 30 seconds for the API to process the selection
          // The polling will continue and should detect mediaItemsSet=true
          setTimeout(() => {
            if (!isComplete) {
              console.log("Timed out waiting for media items after window close");
              clearInterval(pollInterval);
              setImportProgress({
                status: "error",
                error: "Timed out waiting for Google Photos. Please try again.",
              });
            }
          }, 30000);
        }
        // Clean up window check when complete
        if (isComplete) {
          clearInterval(checkWindowClosed);
        }
      }, 1000);

      // Timeout after the session expires
      setTimeout(() => {
        if (!isComplete) {
          clearInterval(pollInterval);
          clearInterval(checkWindowClosed);
          closePopup();
          setImportProgress(null);
          setSelectedSource(null);
        }
      }, session.timeout);
    } catch (error) {
      console.error("Failed to open photo picker:", error);
      setImportProgress({
        status: "error",
        error: "Failed to open Google Photos picker. Please try again.",
      });
    }
  };

  const handleSourceSelect = (source: ImportSource) => {
    setSelectedSource(source);

    if (source === "device") {
      fileInputRef.current?.click();
    } else if (source === "google") {
      handleGooglePhotos();
    }
  };

  const handleClose = () => {
    if (!uploadMutation.isPending && importProgress?.status !== "importing") {
      setSelectedSource(null);
      setUploadProgress(null);
      setImportProgress(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-md rounded-lg bg-card border border-border shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h2 className="text-lg font-semibold">Add Photos</h2>
            <p className="text-sm text-muted-foreground">to {albumName}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={uploadMutation.isPending || importProgress?.status === "importing"}
            className="rounded-full p-1 hover:bg-muted transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Upload progress */}
          {uploadProgress && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {uploadProgress.completed === uploadProgress.total ? (
                  <Check className="h-5 w-5 text-green-500" />
                ) : (
                  <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                )}
                <div className="flex-1">
                  <p className="font-medium">
                    {uploadProgress.completed === uploadProgress.total
                      ? "Upload complete!"
                      : "Uploading photos..."}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {uploadProgress.completed} of {uploadProgress.total} photos
                    {uploadProgress.errors > 0 && ` (${uploadProgress.errors} failed)`}
                  </p>
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{
                    width: `${(uploadProgress.completed / uploadProgress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Import progress */}
          {importProgress && (
            <div className="space-y-3">
              {importProgress.status === "selecting" && (
                <div className="flex items-center gap-3">
                  <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                  <div>
                    <p className="font-medium">Select photos in Google Photos</p>
                    <p className="text-sm text-muted-foreground">
                      A new window has opened. Select photos and click Done.
                    </p>
                  </div>
                </div>
              )}

              {importProgress.status === "processing" && (
                <div className="flex items-center gap-3">
                  <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                  <div>
                    <p className="font-medium">Processing your selection...</p>
                    <p className="text-sm text-muted-foreground">
                      Please wait while Google Photos processes your selected photos.
                    </p>
                  </div>
                </div>
              )}

              {importProgress.status === "importing" && (
                <div className="flex items-center gap-3">
                  <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                  <div>
                    <p className="font-medium">Importing photos...</p>
                    <p className="text-sm text-muted-foreground">
                      Downloading and saving photos to your album.
                    </p>
                  </div>
                </div>
              )}

              {importProgress.status === "complete" && (
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">Import complete!</p>
                    <p className="text-sm text-muted-foreground">
                      {importProgress.imported} photos imported
                      {importProgress.skipped! > 0 && `, ${importProgress.skipped} skipped`}
                    </p>
                  </div>
                </div>
              )}

              {importProgress.status === "error" && (
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="font-medium text-red-600">Import failed</p>
                    <p className="text-sm text-muted-foreground">
                      {importProgress.error}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Source selection */}
          {!uploadProgress && !importProgress && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground mb-4">
                Choose where to add photos from:
              </p>

              {/* Upload from device */}
              <button
                type="button"
                onClick={() => handleSourceSelect("device")}
                className="flex w-full items-center gap-4 rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Upload className="h-5 w-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Upload from device</p>
                  <p className="text-sm text-muted-foreground">
                    Select photos from your computer or phone
                  </p>
                </div>
              </button>

              {/* Import from Google Photos */}
              <button
                type="button"
                onClick={() => handleSourceSelect("google")}
                disabled={loadingPickerStatus || !pickerStatus?.connected}
                className="flex w-full items-center gap-4 rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                  <Image className="h-5 w-5 text-red-500" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-medium">Import from Google Photos</p>
                  <p className="text-sm text-muted-foreground">
                    {loadingPickerStatus
                      ? "Checking connection..."
                      : !pickerStatus?.connected
                      ? pickerStatus?.reason || "Connect Google Photos in settings"
                      : "Select photos to download and save locally"}
                  </p>
                </div>
              </button>

              {/* Facebook (coming soon) */}
              <button
                type="button"
                disabled
                className="flex w-full items-center gap-4 rounded-lg border border-border p-4 opacity-50 cursor-not-allowed"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <Facebook className="h-5 w-5 text-blue-500" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Import from Facebook</p>
                  <p className="text-sm text-muted-foreground">Coming soon</p>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {(importProgress?.status === "complete" || importProgress?.status === "error") && (
          <div className="border-t border-border p-4">
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </div>
  );
}
