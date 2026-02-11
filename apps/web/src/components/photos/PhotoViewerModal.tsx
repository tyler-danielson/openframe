import { useState, useCallback } from "react";
import { X, Trash2, RotateCw, Crop, Check, Loader2, AlertTriangle } from "lucide-react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { Button } from "../ui/Button";
import { api } from "../../services/api";
import { cn } from "../../lib/utils";
import type { Photo } from "@openframe/shared";

interface PhotoViewerModalProps {
  photo: Photo;
  isOpen: boolean;
  onClose: () => void;
  onPhotoUpdated: () => void;
  onPhotoDeleted: () => void;
}

// Aspect ratio presets
type AspectRatioKey = "free" | "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "3:2" | "2:3";

interface AspectRatioOption {
  key: AspectRatioKey;
  label: string;
  value: number | undefined; // undefined = free crop
  icon: string; // Visual representation
}

const aspectRatios: AspectRatioOption[] = [
  { key: "free", label: "Free", value: undefined, icon: "⬚" },
  { key: "1:1", label: "1:1", value: 1, icon: "□" },
  { key: "16:9", label: "16:9", value: 16 / 9, icon: "▬" },
  { key: "9:16", label: "9:16", value: 9 / 16, icon: "▮" },
  { key: "4:3", label: "4:3", value: 4 / 3, icon: "▭" },
  { key: "3:4", label: "3:4", value: 3 / 4, icon: "▯" },
  { key: "3:2", label: "3:2", value: 3 / 2, icon: "━" },
  { key: "2:3", label: "2:3", value: 2 / 3, icon: "┃" },
];

// Helper to create cropped/rotated image blob
async function getEditedImage(
  imageSrc: string,
  pixelCrop: Area | null,
  rotation: number
): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = imageSrc;
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2d context");

  // Calculate dimensions after rotation
  const radians = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));

  // If we're cropping, use crop dimensions; otherwise use rotated full image dimensions
  if (pixelCrop) {
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(radians);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

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
  } else {
    // Just rotation, no crop
    const newWidth = image.width * cos + image.height * sin;
    const newHeight = image.width * sin + image.height * cos;
    canvas.width = newWidth;
    canvas.height = newHeight;

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(radians);
    ctx.drawImage(image, -image.width / 2, -image.height / 2);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas is empty"));
      },
      "image/jpeg",
      0.92
    );
  });
}

export function PhotoViewerModal({
  photo,
  isOpen,
  onClose,
  onPhotoUpdated,
  onPhotoDeleted,
}: PhotoViewerModalProps) {
  const [mode, setMode] = useState<"view" | "crop">("view");
  const [rotation, setRotation] = useState(0);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioKey>("free");
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Always use original resolution for full quality
  const imageUrl = photo.originalUrl;
  const currentAspectRatio = aspectRatios.find((ar) => ar.key === aspectRatio);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleEnterCropMode = () => {
    setMode("crop");
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setAspectRatio("free");
  };

  const handleCancelCrop = () => {
    // Discard crop changes and go back to view
    setMode("view");
    setCroppedAreaPixels(null);
    setAspectRatio("free");
    // Clear preview if we had one
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const handleApplyCrop = async () => {
    // Generate preview of the cropped image
    if (!croppedAreaPixels) {
      setMode("view");
      return;
    }

    setIsGeneratingPreview(true);
    try {
      const previewBlob = await getEditedImage(imageUrl, croppedAreaPixels, rotation);
      // Revoke old preview URL if exists
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      const newPreviewUrl = URL.createObjectURL(previewBlob);
      setPreviewUrl(newPreviewUrl);
      setMode("view");
    } catch (err) {
      console.error("Failed to generate preview:", err);
      setError("Failed to generate preview");
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const handleAspectRatioChange = (key: AspectRatioKey) => {
    setAspectRatio(key);
    // Reset crop position when changing aspect ratio
    setCrop({ x: 0, y: 0 });
  };

  const handleSave = async () => {
    // Only save if there are changes
    if (!hasChanges) {
      onClose();
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      let editedBlob: Blob;

      if (previewUrl) {
        // If we have a preview, fetch the blob from the preview URL
        const response = await fetch(previewUrl);
        const previewBlob = await response.blob();

        // If there's additional rotation after the crop preview, apply it
        if (rotation !== 0) {
          editedBlob = await getEditedImage(previewUrl, null, rotation);
        } else {
          editedBlob = previewBlob;
        }
      } else if (rotation !== 0) {
        // Only rotation, no crop
        editedBlob = await getEditedImage(imageUrl, null, rotation);
      } else {
        // No changes
        handleClose();
        return;
      }

      const editedFile = new File([editedBlob], photo.filename, { type: "image/jpeg" });
      await api.updatePhoto(photo.id, editedFile);
      onPhotoUpdated();
      handleClose();
    } catch (err) {
      console.error("Failed to save photo:", err);
      setError("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      await api.deletePhoto(photo.id);
      onPhotoDeleted();
      handleClose();
    } catch (err) {
      console.error("Failed to delete photo:", err);
      setError("Failed to delete photo");
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleClose = () => {
    setMode("view");
    setRotation(0);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setAspectRatio("free");
    setCroppedAreaPixels(null);
    setShowDeleteConfirm(false);
    setError(null);
    // Clean up preview URL
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    onClose();
  };

  const handleDiscardChanges = () => {
    // Reset all edits without closing
    setRotation(0);
    setCroppedAreaPixels(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const hasChanges = rotation !== 0 || previewUrl !== null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 text-white flex-shrink-0 z-10">
        <button onClick={handleClose} className="p-2 -ml-2 touch-manipulation">
          <X className="h-6 w-6" />
        </button>

        <div className="flex items-center gap-2">
          {mode === "view" ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRotate}
                className="text-white hover:bg-white/20"
              >
                <RotateCw className="h-5 w-5 mr-1" />
                Rotate
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEnterCropMode}
                className="text-white hover:bg-white/20"
              >
                <Crop className="h-5 w-5 mr-1" />
                Crop
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-red-400 hover:bg-red-500/20 hover:text-red-300"
              >
                <Trash2 className="h-5 w-5 mr-1" />
                Delete
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelCrop}
                className="text-white hover:bg-white/20"
                disabled={isGeneratingPreview}
              >
                Cancel
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleApplyCrop}
                className="text-green-400 hover:bg-green-500/20"
                disabled={isGeneratingPreview}
              >
                {isGeneratingPreview ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-1 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Check className="h-5 w-5 mr-1" />
                    Apply
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="px-4 py-2 bg-red-500/20 text-red-300 text-center text-sm flex-shrink-0">
          {error}
        </div>
      )}

      {/* Image area */}
      <div className="flex-1 relative overflow-hidden">
        {mode === "crop" ? (
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={currentAspectRatio?.value}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <img
              src={previewUrl ?? imageUrl}
              alt={photo.originalFilename}
              className="max-w-full max-h-full object-contain transition-transform duration-200"
              style={{ transform: `rotate(${rotation}deg)` }}
            />
          </div>
        )}
      </div>

      {/* Crop controls (crop mode only) */}
      {mode === "crop" && (
        <div className="bg-black/90 flex-shrink-0 space-y-3 px-4 py-4">
          {/* Aspect ratio selector */}
          <div className="flex items-center justify-center gap-1 flex-wrap">
            {aspectRatios.map((ar) => (
              <button
                key={ar.key}
                onClick={() => handleAspectRatioChange(ar.key)}
                className={cn(
                  "px-3 py-2 rounded-lg text-sm font-medium transition-colors flex flex-col items-center min-w-[52px]",
                  aspectRatio === ar.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
                )}
              >
                <span className="text-lg leading-none mb-0.5">{ar.icon}</span>
                <span className="text-xs">{ar.label}</span>
              </button>
            ))}
          </div>

          {/* Zoom slider */}
          <div className="px-4">
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full h-2 bg-white/30 rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <p className="text-center text-white/50 text-xs mt-1">Zoom</p>
          </div>
        </div>
      )}

      {/* Save button (when there are changes) */}
      {hasChanges && mode === "view" && (
        <div className="p-4 bg-black flex-shrink-0">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-4 text-lg"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-5 w-5 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      )}

      {/* Delete confirmation overlay */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm mx-4 text-center">
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-500" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Delete Photo?
            </h3>
            <p className="text-muted-foreground mb-6">
              This action cannot be undone. The photo will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
