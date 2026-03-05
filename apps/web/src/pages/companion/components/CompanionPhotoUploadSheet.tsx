import { useRef, useState } from "react";
import { X, ImagePlus, Camera } from "lucide-react";
import { api } from "../../../services/api";

interface CompanionPhotoUploadSheetProps {
  albumId: string;
  onClose: () => void;
  onComplete: () => void;
}

export function CompanionPhotoUploadSheet({
  albumId,
  onClose,
  onComplete,
}: CompanionPhotoUploadSheetProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, errors: 0 });

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    setUploading(true);
    setProgress({ done: 0, total: fileArray.length, errors: 0 });

    let errors = 0;
    for (let i = 0; i < fileArray.length; i++) {
      try {
        await api.uploadPhoto(albumId, fileArray[i]!);
      } catch {
        errors++;
      }
      setProgress({ done: i + 1, total: fileArray.length, errors });
    }

    setTimeout(() => {
      onComplete();
      onClose();
    }, 600);
  }

  const pct = progress.total > 0 ? (progress.done / progress.total) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-card rounded-t-2xl p-5 pb-8 animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold">Upload Photos</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-primary/10 transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {uploading ? (
          <div className="space-y-3">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              {progress.done} / {progress.total} uploaded
              {progress.errors > 0 && (
                <span className="text-destructive ml-2">
                  ({progress.errors} failed)
                </span>
              )}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-2 p-6 rounded-xl border border-primary/30 hover:bg-primary/5 transition-colors"
            >
              <ImagePlus className="h-8 w-8 text-primary" />
              <span className="text-sm font-medium">Choose from Library</span>
            </button>
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="flex flex-col items-center gap-2 p-6 rounded-xl border border-primary/30 hover:bg-primary/5 transition-colors"
            >
              <Camera className="h-8 w-8 text-primary" />
              <span className="text-sm font-medium">Take Photo</span>
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
    </div>
  );
}
