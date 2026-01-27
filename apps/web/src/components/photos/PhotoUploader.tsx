import { useState, useRef, useCallback } from "react";
import { Upload, Camera, X, RefreshCw, Check, AlertCircle } from "lucide-react";
import { api } from "../../services/api";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";

interface PhotoUploaderProps {
  albumId: string;
  onUploadComplete: () => void;
}

interface FilePreview {
  file: File;
  preview: string;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
}

export function PhotoUploader({ albumId, onUploadComplete }: PhotoUploaderProps) {
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const validFiles = fileArray.filter((file) =>
      ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)
    );

    const previews: FilePreview[] = validFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      status: "pending",
    }));

    setFiles((prev) => [...prev, ...previews]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => {
      const file = prev[index];
      if (file) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
        e.target.value = "";
      }
    },
    [addFiles]
  );

  const uploadFiles = async () => {
    if (files.length === 0) return;

    setIsUploading(true);

    for (let i = 0; i < files.length; i++) {
      const filePreview = files[i];
      if (!filePreview || filePreview.status !== "pending") continue;

      setFiles((prev) =>
        prev.map((f, idx) =>
          idx === i ? { ...f, status: "uploading" } : f
        )
      );

      try {
        await api.uploadPhoto(albumId, filePreview.file);
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: "success" } : f
          )
        );
      } catch (error) {
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i
              ? {
                  ...f,
                  status: "error",
                  error: error instanceof Error ? error.message : "Upload failed",
                }
              : f
          )
        );
      }
    }

    setIsUploading(false);
    onUploadComplete();

    // Clear successful uploads after a delay
    setTimeout(() => {
      setFiles((prev) => {
        prev.forEach((f) => {
          if (f.status === "success") {
            URL.revokeObjectURL(f.preview);
          }
        });
        return prev.filter((f) => f.status !== "success");
      });
    }, 2000);
  };

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const successCount = files.filter((f) => f.status === "success").length;

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/50"
        )}
      >
        <Upload
          className={cn(
            "h-8 w-8 mb-2",
            isDragging ? "text-primary" : "text-muted-foreground"
          )}
        />
        <p className="text-sm font-medium">
          {isDragging ? "Drop photos here" : "Drag photos here or tap to select"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          JPEG, PNG, WebP, GIF supported
        </p>
      </div>

      {/* File inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Camera button for mobile */}
      <Button
        variant="outline"
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "image/*";
          input.capture = "environment";
          input.onchange = (e) => {
            const target = e.target as HTMLInputElement;
            if (target.files && target.files.length > 0) {
              addFiles(target.files);
            }
          };
          input.click();
        }}
        className="w-full min-h-[44px]"
      >
        <Camera className="mr-2 h-4 w-4" />
        Take Photo with Camera
      </Button>

      {/* File previews */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-2">
            {files.map((filePreview, index) => (
              <div
                key={index}
                className="relative aspect-square rounded-lg overflow-hidden bg-muted"
              >
                <img
                  src={filePreview.preview}
                  alt=""
                  className="h-full w-full object-cover"
                />

                {/* Status overlay */}
                {filePreview.status === "uploading" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <RefreshCw className="h-6 w-6 animate-spin text-white" />
                  </div>
                )}
                {filePreview.status === "success" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-green-500/50">
                    <Check className="h-6 w-6 text-white" />
                  </div>
                )}
                {filePreview.status === "error" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-red-500/50">
                    <AlertCircle className="h-6 w-6 text-white" />
                  </div>
                )}

                {/* Remove button */}
                {filePreview.status === "pending" && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                    className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Upload button */}
          {pendingCount > 0 && (
            <Button
              onClick={uploadFiles}
              disabled={isUploading}
              className="w-full min-h-[44px]"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload {pendingCount} Photo{pendingCount !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          )}

          {/* Success message */}
          {successCount > 0 && pendingCount === 0 && !isUploading && (
            <p className="text-sm text-green-600 text-center">
              {successCount} photo{successCount !== 1 ? "s" : ""} uploaded successfully
            </p>
          )}
        </div>
      )}
    </div>
  );
}
