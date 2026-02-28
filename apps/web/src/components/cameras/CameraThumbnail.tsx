import { useState, useEffect, useRef } from "react";
import { Home, Camera } from "lucide-react";
import { cn } from "../../lib/utils";
import { api, type HACamera } from "../../services/api";
import { useAuthStore } from "../../stores/auth";
import type { Camera as CameraType } from "@openframe/shared";

interface CameraThumbnailProps {
  camera: CameraType | HACamera;
  type: "standalone" | "ha";
  isSelected: boolean;
  onClick: () => void;
  showPreview?: boolean; // If true, fetch a still image from camera
}

export function CameraThumbnail({
  camera,
  type,
  isSelected,
  onClick,
  showPreview = false,
}: CameraThumbnailProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const { accessToken, apiKey } = useAuthStore();
  const authToken = accessToken || apiKey;

  const name = type === "standalone"
    ? (camera as CameraType).name
    : (camera as HACamera).name;

  const cameraId = type === "standalone"
    ? (camera as CameraType).id
    : (camera as HACamera).entityId;

  // Get snapshot URL (only used if showPreview is true)
  const getSnapshotUrl = () => {
    if (type === "standalone") {
      const cam = camera as CameraType;
      if (cam.snapshotUrl || cam.rtspUrl) {
        // Backend handles derivation of snapshot URL from RTSP URL
        return `${api.getCameraSnapshotUrl(cam.id)}?token=${authToken}&t=${Date.now()}`;
      }
      return null;
    } else {
      return `${api.getHACameraSnapshotUrl(cameraId)}?token=${authToken}&t=${Date.now()}`;
    }
  };

  // Load preview image once on mount (if showPreview is enabled)
  useEffect(() => {
    if (showPreview && imgRef.current) {
      const url = getSnapshotUrl();
      if (url) {
        imgRef.current.src = url;
      }
    }
  }, [showPreview, cameraId, type, authToken]);

  const handleLoad = () => {
    setImageLoaded(true);
    setHasError(false);
  };

  const handleError = () => {
    setImageLoaded(false);
    setHasError(true);
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all duration-200",
        "hover:ring-2 hover:ring-primary/50 hover:scale-105",
        isSelected
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:border-primary/50"
      )}
      style={{ width: "100px", height: "75px" }}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-muted flex items-center justify-center">
        {showPreview ? (
          <>
            <img
              ref={imgRef}
              alt={name}
              className={cn(
                "h-full w-full object-cover",
                !imageLoaded && "hidden"
              )}
              onLoad={handleLoad}
              onError={handleError}
            />
            {!imageLoaded && !hasError && (
              <Camera className="h-6 w-6 text-muted-foreground/50" />
            )}
            {hasError && (
              <Camera className="h-6 w-6 text-muted-foreground/50" />
            )}
          </>
        ) : (
          <Camera className="h-6 w-6 text-muted-foreground/50" />
        )}
      </div>

      {/* Camera name overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
        <div className="flex items-center gap-1">
          {type === "ha" && <Home className="h-2.5 w-2.5 text-blue-400 flex-shrink-0" />}
          <span className="text-[10px] font-medium text-white truncate leading-tight">
            {name}
          </span>
        </div>
      </div>

      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
      )}
    </button>
  );
}
